"""
GitHub REST API 클라이언트.

config의 토큰과 계정 목록을 사용하여 GitHub API를 호출한다.
- get_all_repos(): 모든 계정(개인/조직)의 리포지토리 목록 + 커밋 수 조회
- get_repo_by_full_name(): 단일 리포지토리 조회 (push 이벤트용)

동시 요청은 Semaphore(10)로 제한한다.
"""

import asyncio
import logging
import re

import httpx

from backend.plugins.github_sync import config
from backend.plugins.github_sync.models import RepoData

logger = logging.getLogger(__name__)

API_BASE = "https://api.github.com"
SEMAPHORE = asyncio.Semaphore(10)


class GitHubClient:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                headers={
                    "Authorization": f"Bearer {config.settings.github_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                timeout=30,
            )
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def get_all_repos(self) -> list[RepoData]:
        accounts = config.settings.get_accounts()

        tasks = []
        for source in accounts:
            if source["type"] == "user":
                tasks.append(self._get_user_repos())
            else:
                tasks.append(self._get_org_repos(source["name"]))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_repos_raw: list[tuple[dict, str]] = []
        for i, result in enumerate(results):
            source = accounts[i]
            if isinstance(result, Exception):
                logger.error(f"소스 {source['name']}에서 리포 조회 실패: {result}")
                continue
            for repo in result:
                all_repos_raw.append((repo, source["name"]))

        repo_data_tasks = [
            self._build_repo_data(raw, owner)
            for raw, owner in all_repos_raw
        ]
        repo_results = await asyncio.gather(*repo_data_tasks, return_exceptions=True)

        repos = []
        for result in repo_results:
            if isinstance(result, Exception):
                logger.error(f"리포 데이터 생성 실패: {result}")
                continue
            repos.append(result)

        logger.info(f"총 {len(repos)}개 리포지토리 조회 완료")
        return repos

    async def get_repo_by_full_name(self, full_name: str) -> RepoData:
        resp = await self.client.get(f"{API_BASE}/repos/{full_name}")
        resp.raise_for_status()
        raw = resp.json()
        owner = full_name.split("/")[0]
        commit_count = await self._get_commit_count(full_name)
        return self._parse_repo(raw, owner, commit_count)

    async def _get_user_repos(self) -> list[dict]:
        repos = []
        page = 1
        while True:
            async with SEMAPHORE:
                resp = await self.client.get(
                    f"{API_BASE}/user/repos",
                    params={
                        "per_page": 100,
                        "page": page,
                        "affiliation": "owner",
                        "sort": "updated",
                    },
                )
                resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            repos.extend(data)
            page += 1
        logger.info(f"개인 계정: {len(repos)}개 리포 조회")
        return repos

    async def _get_org_repos(self, org: str) -> list[dict]:
        repos = []
        page = 1
        while True:
            async with SEMAPHORE:
                resp = await self.client.get(
                    f"{API_BASE}/orgs/{org}/repos",
                    params={"per_page": 100, "page": page, "sort": "updated"},
                )
                resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            repos.extend(data)
            page += 1
        logger.info(f"조직 {org}: {len(repos)}개 리포 조회")
        return repos

    async def _get_commit_count(self, full_name: str) -> int:
        async with SEMAPHORE:
            try:
                resp = await self.client.get(
                    f"{API_BASE}/repos/{full_name}/commits",
                    params={"per_page": 1},
                )
                if resp.status_code == 409:
                    return 0
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.warning(f"{full_name}: 커밋 수 조회 실패")
                return 0

        link_header = resp.headers.get("Link", "")
        if not link_header:
            data = resp.json()
            return len(data)

        match = re.search(r'page=(\d+)>;\s*rel="last"', link_header)
        if match:
            return int(match.group(1))
        return 0

    async def _build_repo_data(self, raw: dict, owner: str) -> RepoData:
        full_name = raw["full_name"]
        commit_count = await self._get_commit_count(full_name)
        return self._parse_repo(raw, owner, commit_count)

    def _parse_repo(self, raw: dict, owner: str, commit_count: int) -> RepoData:
        return RepoData(
            repo_id=raw["id"],
            name=raw["name"],
            full_name=raw["full_name"],
            html_url=raw["html_url"],
            description=raw.get("description"),
            private=raw.get("private", False),
            pushed_at=raw.get("pushed_at"),
            commit_count=commit_count,
            language=raw.get("language"),
            stargazers_count=raw.get("stargazers_count", 0),
            forks_count=raw.get("forks_count", 0),
            archived=raw.get("archived", False),
            default_branch=raw.get("default_branch", "main"),
            created_at=raw.get("created_at"),
            updated_at=raw.get("updated_at"),
            topics=raw.get("topics", []),
            owner=owner,
        )
