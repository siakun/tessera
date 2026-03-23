"""
동기화 비즈니스 로직.

GitHubClient와 NotionClient를 조합하여 실제 동기화를 수행하는 핵심 모듈.
- sync_all(): 전체 동기화 (모든 계정 리포 → Notion DB, repository-id 기반 매칭)
- sync_one(): 단일 리포 동기화 (Notion 행의 URL → GitHub 조회 → Notion 업데이트)
- sync_on_push(): GitHub push 이벤트 → 해당 리포만 Notion에 반영

main.py의 웹훅 엔드포인트에서 BackgroundTasks로 호출된다.
"""

import logging

from app.config import settings
from app.github_client import GitHubClient
from app.notion_client import NotionClient

logger = logging.getLogger(__name__)


class SyncService:
    def __init__(self) -> None:
        self.github = GitHubClient()
        self.notion = NotionClient()

    async def sync_all(self) -> dict:
        """전체 리포지토리를 Notion DB에 동기화한다."""
        logger.info("=== 전체 동기화 시작 ===")

        try:
            repos = await self.github.get_all_repos()
            pages = await self.notion.query_all_pages()
            id_lookup = self.notion.build_repo_id_lookup(pages)

            created = 0
            updated = 0

            for repo in repos:
                page_id = id_lookup.get(repo.repo_id)

                try:
                    if page_id:
                        await self.notion.update_page(page_id, repo)
                        updated += 1
                    else:
                        await self.notion.create_page(repo)
                        created += 1
                except Exception as e:
                    logger.error(f"{repo.name} 동기화 실패: {e}")

            # repository-id가 없는 기존 행을 ⚠️ Error로 표시
            error_count = 0
            for page in pages:
                props = page.get("properties", {})
                repo_id_obj = props.get(settings.notion_prop_repo_id, {})
                repo_id = repo_id_obj.get("number")
                if repo_id is None:
                    try:
                        await self.notion.mark_error(page["id"])
                        error_count += 1
                    except Exception as e:
                        logger.error(f"Error 표시 실패 (page {page['id']}): {e}")

            result = {
                "total_repos": len(repos),
                "created": created,
                "updated": updated,
                "error_marked": error_count,
            }
            logger.info(f"=== 전체 동기화 완료: {result} ===")
            return result
        finally:
            await self.github.close()
            await self.notion.close()

    async def sync_one(self, page_id: str, repo_url: str) -> dict:
        """단일 리포지토리를 Notion 페이지에 동기화한다."""
        logger.info(f"=== 단일 동기화 시작: {repo_url} ===")

        try:
            full_name = self._extract_full_name(repo_url)
            repo = await self.github.get_repo_by_full_name(full_name)
            await self.notion.update_page(page_id, repo)

            result = {"repo": repo.name, "page_id": page_id}
            logger.info(f"=== 단일 동기화 완료: {result} ===")
            return result
        finally:
            await self.github.close()
            await self.notion.close()

    async def sync_on_push(self, full_name: str) -> dict:
        """GitHub push 이벤트 시 해당 리포를 Notion에 동기화한다."""
        logger.info(f"=== Push 동기화 시작: {full_name} ===")

        try:
            repo = await self.github.get_repo_by_full_name(full_name)

            # 전체 페이지 조회 대신 repository-id 필터로 단일 조회
            page_id = await self.notion.query_page_by_repo_id(repo.repo_id)

            if page_id:
                await self.notion.update_page(page_id, repo)
                action = "updated"
            else:
                await self.notion.create_page(repo)
                action = "created"

            result = {"repo": repo.name, "action": action}
            logger.info(f"=== Push 동기화 완료: {result} ===")
            return result
        finally:
            await self.github.close()
            await self.notion.close()

    @staticmethod
    def _extract_full_name(url: str) -> str:
        """GitHub URL에서 owner/repo를 추출한다."""
        # https://github.com/owner/repo → owner/repo
        url = url.rstrip("/")
        parts = url.split("github.com/")
        if len(parts) == 2:
            return parts[1]
        raise ValueError(f"올바른 GitHub URL이 아닙니다: {url}")
