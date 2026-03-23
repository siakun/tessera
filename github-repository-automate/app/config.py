"""
설정 관리 모듈.

config.toml 파일에서 GitHub/Notion 토큰, 계정 목록, Notion DB 속성명 등
모든 설정을 로드한다. 개인정보가 코드에 포함되지 않도록 외부 TOML 파일로 분리.

- 모듈 임포트 시점에 config.toml을 읽어 Settings 싱글턴을 생성한다.
- config.toml이 없으면 FileNotFoundError를 발생시킨다.
- 다른 모든 모듈(github_client, notion_client, sync_service, main)이
  `from app.config import settings`로 이 설정을 참조한다.
"""

import tomllib
from pathlib import Path


def _load_toml() -> dict:
    """config.toml 파일을 로드한다."""
    config_path = Path(__file__).resolve().parent.parent / "config.toml"
    if not config_path.exists():
        raise FileNotFoundError(
            f"config.toml not found at {config_path}\n"
            "Copy config.example.toml to config.toml and edit it."
        )
    with open(config_path, "rb") as f:
        return tomllib.load(f)


_raw = _load_toml()


_props = _raw.get("notion", {}).get("properties", {})


class Settings:
    # GitHub
    github_token: str = _raw["github"]["token"]
    github_webhook_secret: str = _raw["github"].get("webhook_secret", "")
    github_accounts: list[dict] = _raw["github"]["accounts"]

    # Notion
    notion_token: str = _raw["notion"]["token"]
    notion_database_id: str = _raw["notion"]["database_id"]

    # Notion DB property names (기본값은 config.example.toml 기준)
    notion_prop_name: str = _props.get("name", "Name")
    notion_prop_url: str = _props.get("url", "URL")
    notion_prop_description: str = _props.get("description", "Description")
    notion_prop_last_commit: str = _props.get("last_commit", "Last Commit")
    notion_prop_commit_count: str = _props.get("commit_count", "Commit Count")
    notion_prop_visibility: str = _props.get("visibility", "Visibility")
    notion_prop_repo_id: str = _props.get("repo_id", "repository-id")

    # Visibility
    visibility_label_error: str = _raw.get("visibility", {}).get("error", "Error")

    def get_accounts(self) -> list[dict[str, str]]:
        """계정 목록을 [{name, type, label}] 형태로 반환한다."""
        return [
            {
                "name": src["name"],
                "type": src.get("type", "user"),
                "label": src["label"],
            }
            for src in self.github_accounts
        ]

    def get_account_label(self, owner: str) -> str | None:
        """계정 이름으로 라벨을 조회한다."""
        for src in self.github_accounts:
            if src["name"] == owner:
                return src["label"]
        return None


settings = Settings()

# 모듈 로드 후 임시 변수 정리
del _raw, _props
