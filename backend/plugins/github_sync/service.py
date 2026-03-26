"""
동기화 비즈니스 로직.

GitHubClient와 NotionClient를 조합하여 실제 동기화를 수행하는 핵심 모듈.
- sync_all(): 전체 동기화 (모든 계정 리포 -> Notion DB)
- sync_one(): 단일 리포 동기화 (Notion 행의 URL -> GitHub 조회 -> Notion 업데이트)
- sync_on_push(): GitHub push 이벤트 -> 해당 리포만 반영
- deduplicate(): repo_id 없는 중복 행을 아카이브
"""

import logging

from backend.plugins.github_sync import config
from backend.plugins.github_sync.github_client import GitHubClient
from backend.plugins.github_sync.notion_client import NotionClient
from backend.plugins.github_sync.state import plugin_state

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
            valid_repo_ids = {repo.repo_id for repo in repos}

            pages = await self.notion.query_all_pages()
            sanitized = await self._sanitize_repo_ids(pages, valid_repo_ids)
            id_lookup = self.notion.build_repo_id_lookup(pages)

            created = 0
            updated = 0
            cancelled = False

            for repo in repos:
                if plugin_state.cancel_requested:
                    logger.info("=== 동기화 중지 요청 감지 ===")
                    cancelled = True
                    break
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

            dedup_result = {"archived": 0, "marked_error": 0}
            if not cancelled:
                pages = await self.notion.query_all_pages()
                dedup_result = await self._deduplicate(pages)

            result = {
                "total_repos": len(repos),
                "created": created,
                "updated": updated,
                "sanitized": sanitized,
                "archived": dedup_result["archived"],
                "marked_error": dedup_result["marked_error"],
                "cancelled": cancelled,
            }
            logger.info(f"=== 전체 동기화 {'중지됨' if cancelled else '완료'}: {result} ===")
            return result
        finally:
            await self.github.close()
            await self.notion.close()

    async def deduplicate(self) -> dict:
        logger.info("=== 중복 제거 시작 ===")
        try:
            pages = await self.notion.query_all_pages()
            result = await self._deduplicate(pages)
            logger.info(f"=== 중복 제거 완료: {result} ===")
            return result
        finally:
            await self.notion.close()

    async def deduplicate_one(self, page_id: str) -> dict:
        logger.info(f"=== 개별 중복 제거: {page_id} ===")
        try:
            pages = await self.notion.query_all_pages()

            target = None
            for page in pages:
                if page["id"] == page_id:
                    target = page
                    break

            if target is None:
                return {"page_id": page_id, "action": "not_found"}

            if self.notion.get_page_repo_id(target) is not None:
                return {"page_id": page_id, "action": "skipped", "reason": "repo_id 있음"}

            names_with_repo_id = self._collect_names_with_repo_id(pages)
            return await self._try_archive_duplicate(target, names_with_repo_id)
        finally:
            await self.notion.close()

    async def sync_one(self, page_id: str, repo_url: str) -> dict:
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
        logger.info(f"=== Push 동기화 시작: {full_name} ===")
        try:
            repo = await self.github.get_repo_by_full_name(full_name)
            page_id = await self.notion.query_page_by_repo_id(repo.repo_id)

            if page_id:
                await self.notion.update_page(page_id, repo)
                action = "updated"
            else:
                await self.notion.create_page(repo)
                action = "created"

            if action == "created":
                await self._deduplicate_by_name(repo.name)

            result = {"repo": repo.name, "action": action}
            logger.info(f"=== Push 동기화 완료: {result} ===")
            return result
        finally:
            await self.github.close()
            await self.notion.close()

    # -- 내부 메서드 --

    async def _sanitize_repo_ids(
        self, pages: list[dict], valid_repo_ids: set[int]
    ) -> int:
        sanitized = 0
        for page in pages:
            repo_id = self.notion.get_page_repo_id(page)
            if repo_id is not None and repo_id not in valid_repo_ids:
                name = self.notion.get_page_name(page)
                try:
                    await self.notion.clear_repo_id(page["id"])
                    logger.warning(f"잘못된 repo_id 초기화: {name} (repo_id={repo_id})")
                    page["properties"][config.settings.notion_prop_repo_id]["number"] = None
                    sanitized += 1
                except Exception as e:
                    logger.error(f"repo_id 초기화 실패: {name} ({page['id']}): {e}")
        return sanitized

    def _collect_names_with_repo_id(self, pages: list[dict]) -> set[str]:
        names = set()
        for page in pages:
            if self.notion.get_page_repo_id(page) is not None:
                name = self.notion.get_page_name(page)
                if name:
                    names.add(name)
        return names

    async def _deduplicate(self, pages: list[dict]) -> dict:
        names_with_repo_id = self._collect_names_with_repo_id(pages)
        orphan_pages = [
            p for p in pages if self.notion.get_page_repo_id(p) is None
        ]

        archived = 0
        marked_error = 0
        details: list[dict] = []

        for page in orphan_pages:
            result = await self._try_archive_duplicate(page, names_with_repo_id)
            details.append(result)
            if result["action"] == "archived":
                archived += 1
            elif result["action"] == "marked_error":
                marked_error += 1

        return {"archived": archived, "marked_error": marked_error, "details": details}

    async def _deduplicate_by_name(self, name: str) -> None:
        pages = await self.notion.query_pages_by_name(name)
        if len(pages) <= 1:
            return

        has_repo_id = any(
            self.notion.get_page_repo_id(p) is not None for p in pages
        )
        if not has_repo_id:
            return

        for page in pages:
            if self.notion.get_page_repo_id(page) is None:
                try:
                    await self.notion.archive_page(page["id"])
                    logger.info(f"Push 중복 아카이브: {name} ({page['id']})")
                except Exception as e:
                    logger.error(f"Push 중복 아카이브 실패: {name} ({page['id']}): {e}")

    async def _try_archive_duplicate(
        self, page: dict, names_with_repo_id: set[str]
    ) -> dict:
        page_id = page["id"]
        name = self.notion.get_page_name(page)

        if not name:
            logger.info(f"건너뜀 (이름 없음): {page_id}")
            return {"page_id": page_id, "name": "", "action": "skipped", "reason": "이름 없음"}

        if name in names_with_repo_id:
            try:
                await self.notion.archive_page(page_id)
                logger.info(f"중복 아카이브: {name} ({page_id})")
                return {"page_id": page_id, "name": name, "action": "archived"}
            except Exception as e:
                logger.error(f"아카이브 실패: {name} ({page_id}): {e}")
                return {"page_id": page_id, "name": name, "action": "error", "reason": str(e)}
        else:
            try:
                await self.notion.mark_error(page_id)
                logger.info(f"Error 표시 (매칭 없음): {name} ({page_id})")
                return {"page_id": page_id, "name": name, "action": "marked_error"}
            except Exception as e:
                logger.error(f"Error 표시 실패: {name} ({page_id}): {e}")
                return {"page_id": page_id, "name": name, "action": "error", "reason": str(e)}

    @staticmethod
    def _extract_full_name(url: str) -> str:
        url = url.rstrip("/")
        parts = url.split("github.com/")
        if len(parts) == 2:
            return parts[1]
        raise ValueError(f"올바른 GitHub URL이 아닙니다: {url}")
