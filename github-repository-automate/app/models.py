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
