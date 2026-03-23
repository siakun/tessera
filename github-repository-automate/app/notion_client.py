import asyncio
import logging

import httpx

from app.config import settings
from app.models import RepoData

logger = logging.getLogger(__name__)

API_BASE = "https://api.notion.com/v1"
SEMAPHORE = asyncio.Semaphore(3)


class NotionClient:
    def __init__(self) -> None:
        self.headers = {
            "Authorization": f"Bearer {settings.notion_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        }
        self.database_id = settings.notion_database_id

    async def query_all_pages(self) -> list[dict]:
        """데이터베이스의 모든 페이지를 조회한다."""
        pages = []
        start_cursor = None

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            while True:
                body: dict = {}
                if start_cursor:
                    body["start_cursor"] = start_cursor

                async with SEMAPHORE:
                    resp = await client.post(
                        f"{API_BASE}/databases/{self.database_id}/query",
                        json=body,
                    )
                    resp.raise_for_status()

                data = resp.json()
                pages.extend(data["results"])

                if not data.get("has_more"):
                    break
                start_cursor = data.get("next_cursor")

        logger.info(f"Notion DB에서 {len(pages)}개 페이지 조회")
        return pages

    async def create_page(self, repo: RepoData) -> dict:
        """데이터베이스에 새 페이지를 생성한다."""
        body = {
            "parent": {"database_id": self.database_id},
            "properties": self._build_properties(repo),
        }

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            async with SEMAPHORE:
                resp = await client.post(f"{API_BASE}/pages", json=body)
                resp.raise_for_status()

        logger.info(f"Notion 페이지 생성: {repo.name}")
        return resp.json()

    async def update_page(self, page_id: str, repo: RepoData) -> dict:
        """기존 페이지의 속성을 업데이트한다."""
        body = {"properties": self._build_properties(repo)}

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            async with SEMAPHORE:
                resp = await client.patch(
                    f"{API_BASE}/pages/{page_id}", json=body
                )
                resp.raise_for_status()

        logger.info(f"Notion 페이지 업데이트: {repo.name}")
        return resp.json()

    async def mark_error(self, page_id: str) -> dict:
        """매칭 불가 페이지의 공유여부를 ⚠️ Error로 표시한다."""
        body = {
            "properties": {
                settings.notion_prop_visibility: {
                    "select": {"name": settings.visibility_label_error}
                }
            }
        }

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            async with SEMAPHORE:
                resp = await client.patch(
                    f"{API_BASE}/pages/{page_id}", json=body
                )
                resp.raise_for_status()

        logger.info(f"Error 표시: {page_id}")
        return resp.json()

    def build_repo_id_lookup(self, pages: list[dict]) -> dict[int, str]:
        """페이지 목록에서 {repository-id: page_id} 매핑을 생성한다."""
        lookup = {}
        repo_id_prop = settings.notion_prop_repo_id
        for page in pages:
            props = page.get("properties", {})
            repo_id_obj = props.get(repo_id_prop, {})
            repo_id = repo_id_obj.get("number")
            if repo_id is not None:
                lookup[int(repo_id)] = page["id"]
        return lookup

    def _build_properties(self, repo: RepoData) -> dict:
        """RepoData를 Notion 속성 형식으로 변환한다."""
        props: dict = {
            settings.notion_prop_name: {
                "title": [{"text": {"content": repo.name}}]
            },
            settings.notion_prop_url: {"url": repo.html_url},
            settings.notion_prop_description: {
                "rich_text": [{"text": {"content": repo.description or ""}}]
            },
            settings.notion_prop_repo_id: {"number": repo.repo_id},
            settings.notion_prop_commit_count: {"number": repo.commit_count},
            settings.notion_prop_visibility: {
                "select": {"name": self._get_visibility_label(repo)}
            },
        }

        if repo.pushed_at:
            props[settings.notion_prop_last_commit] = {
                "date": {"start": repo.pushed_at}
            }

        return props

    @staticmethod
    def _get_visibility_label(repo: RepoData) -> str:
        """소속 조직과 공개 여부에 따라 가시성 라벨을 반환한다."""
        visibility_map = settings.get_visibility_map()
        if repo.owner in visibility_map:
            return visibility_map[repo.owner]
        if repo.private:
            return settings.visibility_label_private
        return settings.visibility_label_public
