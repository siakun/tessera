"""
Notion API 클라이언트.

config의 토큰과 DB ID를 사용하여 Notion 데이터베이스를 조작한다.
Notion API rate limit이 엄격하므로 Semaphore(3)으로 동시 요청을 제한한다.
"""

import asyncio
import logging

import httpx

from backend.plugins.github_sync import config
from backend.plugins.github_sync.models import RepoData

logger = logging.getLogger(__name__)

API_BASE = "https://api.notion.com/v1"
SEMAPHORE = asyncio.Semaphore(3)


class NotionClient:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def _settings(self):
        return config.settings

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            s = self._settings
            self._client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {s.notion_token}",
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def query_all_pages(self) -> list[dict]:
        pages = []
        start_cursor = None
        db_id = self._settings.notion_database_id

        while True:
            body: dict = {}
            if start_cursor:
                body["start_cursor"] = start_cursor

            async with SEMAPHORE:
                resp = await self.client.post(
                    f"{API_BASE}/databases/{db_id}/query",
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

    async def query_page_by_repo_id(self, repo_id: int) -> str | None:
        s = self._settings
        body = {
            "filter": {
                "property": s.notion_prop_repo_id,
                "number": {"equals": repo_id},
            },
            "page_size": 1,
        }

        async with SEMAPHORE:
            resp = await self.client.post(
                f"{API_BASE}/databases/{s.notion_database_id}/query",
                json=body,
            )
            resp.raise_for_status()

        data = resp.json()
        results = data.get("results", [])
        if results:
            return results[0]["id"]
        return None

    async def create_page(self, repo: RepoData) -> dict:
        body = {
            "parent": {"database_id": self._settings.notion_database_id},
            "properties": self._build_properties(repo),
        }

        async with SEMAPHORE:
            resp = await self.client.post(f"{API_BASE}/pages", json=body)
            resp.raise_for_status()

        logger.info(f"Notion 페이지 생성: {repo.name}")
        return resp.json()

    async def update_page(self, page_id: str, repo: RepoData) -> None:
        await self._patch_page(page_id, {"properties": self._build_properties(repo)})
        logger.info(f"Notion 페이지 업데이트: {repo.name}")

    async def clear_repo_id(self, page_id: str) -> None:
        await self._patch_page(page_id, {
            "properties": {self._settings.notion_prop_repo_id: {"number": None}}
        })
        logger.info(f"repo_id 초기화: {page_id}")

    async def query_pages_by_name(self, name: str) -> list[dict]:
        s = self._settings
        body = {
            "filter": {
                "property": s.notion_prop_name,
                "title": {"equals": name},
            },
        }

        async with SEMAPHORE:
            resp = await self.client.post(
                f"{API_BASE}/databases/{s.notion_database_id}/query",
                json=body,
            )
            resp.raise_for_status()

        return resp.json().get("results", [])

    async def archive_page(self, page_id: str) -> None:
        await self._patch_page(page_id, {"archived": True})
        logger.info(f"페이지 아카이브: {page_id}")

    async def mark_error(self, page_id: str) -> None:
        s = self._settings
        await self._patch_page(page_id, {
            "properties": {
                s.notion_prop_visibility: {
                    "select": {"name": s.visibility_label_error}
                }
            }
        })
        logger.info(f"Error 표시: {page_id}")

    async def _patch_page(self, page_id: str, body: dict) -> dict:
        async with SEMAPHORE:
            resp = await self.client.patch(
                f"{API_BASE}/pages/{page_id}", json=body
            )
            resp.raise_for_status()
        return resp.json()

    def build_repo_id_lookup(self, pages: list[dict]) -> dict[int, str]:
        lookup = {}
        for page in pages:
            repo_id = self.get_page_repo_id(page)
            if repo_id is not None:
                lookup[repo_id] = page["id"]
        return lookup

    def _build_properties(self, repo: RepoData) -> dict:
        s = self._settings
        props: dict = {
            s.notion_prop_name: {
                "title": [{"text": {"content": repo.name}}]
            },
            s.notion_prop_url: {"url": repo.html_url},
            s.notion_prop_description: {
                "rich_text": [{"text": {"content": repo.description or ""}}]
            },
            s.notion_prop_repo_id: {"number": repo.repo_id},
            s.notion_prop_commit_count: {"number": repo.commit_count},
            s.notion_prop_visibility: {
                "select": {"name": self._get_visibility_label(repo)}
            },
        }

        if repo.pushed_at:
            props[s.notion_prop_last_commit] = {
                "date": {"start": repo.pushed_at}
            }

        return props

    def get_page_name(self, page: dict) -> str:
        props = page.get("properties", {})
        name_obj = props.get(self._settings.notion_prop_name, {})
        title_arr = name_obj.get("title", [])
        return title_arr[0]["plain_text"] if title_arr else ""

    def get_page_repo_id(self, page: dict) -> int | None:
        props = page.get("properties", {})
        repo_id_obj = props.get(self._settings.notion_prop_repo_id, {})
        repo_id = repo_id_obj.get("number")
        return int(repo_id) if repo_id is not None else None

    @staticmethod
    def _get_visibility_label(repo: RepoData) -> str:
        label = config.settings.get_account_label(repo.owner)
        if label:
            return label
        return config.settings.visibility_label_error
