"""
데이터 모델 정의.

GitHub API 응답을 정규화한 RepoData 모델을 정의한다.
github_client가 API 응답을 RepoData로 변환하고,
notion_client가 RepoData를 Notion 속성 형식으로 변환하는 데 사용된다.

의존 관계: config ← models ← github_client, notion_client
"""

from pydantic import BaseModel


class RepoData(BaseModel):
    repo_id: int
    name: str
    full_name: str
    html_url: str
    description: str | None = None
    private: bool = False
    pushed_at: str | None = None
    commit_count: int = 0
    # 추가 정보 (추후 Notion 매핑 확장용)
    language: str | None = None
    stargazers_count: int = 0
    forks_count: int = 0
    archived: bool = False
    default_branch: str = "main"
    created_at: str | None = None
    updated_at: str | None = None
    topics: list[str] = []
    owner: str = ""
