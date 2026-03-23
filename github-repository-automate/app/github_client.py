"""
GitHub REST API 클라이언트.

config.py의 토큰과 계정 목록을 사용하여 GitHub API를 호출한다.
- get_all_repos(): 모든 계정(개인/조직)의 리포지토리 목록 + 커밋 수 조회
- get_repo_by_full_name(): 단일 리포지토리 조회 (push 이벤트용)
- 커밋 수는 pagination trick으로 조회 (per_page=1, Link 헤더의 last 페이지)

동시 요청은 Semaphore(10)로 제한한다.
sync_service에서 호출되며, 결과는 models.RepoData로 반환된다.
"""

import asyncio
import logging
import re

import httpx

from app.config import settings
from app.models import RepoData

logger = logging.getLogger(__name__)

API_BASE = "https://api.github.com"
SEMAPHORE = asyncio.Semaphore(10)


class GitHubClient:
    def __init__(self) -> None:
        self.headers = {
            "Authorization": f"Bearer {settings.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        """httpx.AsyncClient를 lazy-init으로 재사용한다."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(headers=self.headers, timeout=30)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def get_all_repos(self) -> list[RepoData]:
        """모든 소스에서 리포지토리 목록을 가져온다."""
        accounts = settings.get_accounts()

        # 모든 소스에서 동시에 리포 목록 가져오기
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

        # 각 리포의 커밋 개수를 동시에 조회
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
        """단일 리포지토리 정보를 가져온다. (owner/repo 형식)"""
        resp = await self.client.get(f"{API_BASE}/repos/{full_name}")
        resp.raise_for_status()
        raw = resp.json()
        owner = full_name.split("/")[0]
        commit_count = await self._get_commit_count(full_name)
        return self._parse_repo(raw, owner, commit_count)

    async def _get_user_repos(self) -> list[dict]:
        """인증된 사용자의 모든 리포지토리를 가져온다."""
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
        """조직의 모든 리포지토리를 가져온다."""
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
        """커밋 개수를 pagination trick으로 조회한다."""
        async with SEMAPHORE:
            try:
                resp = await self.client.get(
                    f"{API_BASE}/repos/{full_name}/commits",
                    params={"per_page": 1},
                )
                if resp.status_code == 409:
                    # 빈 리포지토리 (커밋 없음)
                    return 0
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                logger.warning(f"{full_name}: 커밋 수 조회 실패")
                return 0

        link_header = resp.headers.get("Link", "")
        if not link_header:
            # Link 헤더 없음 = 1페이지뿐 = 커밋 수가 1 이하
            data = resp.json()
            return len(data)

        # Link 헤더에서 last 페이지 번호 추출
        match = re.search(r'page=(\d+)>;\s*rel="last"', link_header)
        if match:
            return int(match.group(1))
        return 0

    async def _build_repo_data(self, raw: dict, owner: str) -> RepoData:
        """GitHub API 응답을 RepoData로 변환한다."""
        full_name = raw["full_name"]
        commit_count = await self._get_commit_count(full_name)
        return self._parse_repo(raw, owner, commit_count)

    def _parse_repo(self, raw: dict, owner: str, commit_count: int) -> RepoData:
        """GitHub API 원시 데이터를 RepoData 모델로 변환한다."""
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
