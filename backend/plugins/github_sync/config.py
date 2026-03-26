"""
GitHub Sync 플러그인 설정.

core config에서 [github], [notion], [visibility] 섹션을 파싱하여
플러그인 전용 Settings 객체를 생성한다.
"""

import logging

from backend.core.config import get_raw_config

logger = logging.getLogger(__name__)


class Settings:
    """GitHub Sync 플러그인 설정. try_load_settings()으로만 생성한다."""

    def __init__(self, raw: dict) -> None:
        # GitHub
        self.github_token: str = raw["github"]["token"]
        self.github_webhook_secret: str = raw["github"].get("webhook_secret", "")
        self.github_accounts: list[dict] = raw["github"]["accounts"]

        # Notion
        self.notion_token: str = raw["notion"]["token"]
        self.notion_database_id: str = raw["notion"]["database_id"]

        # Notion DB property names
        props = raw.get("notion", {}).get("properties", {})
        self.notion_prop_name: str = props.get("name", "Name")
        self.notion_prop_url: str = props.get("url", "URL")
        self.notion_prop_description: str = props.get("description", "Description")
        self.notion_prop_last_commit: str = props.get("last_commit", "Last Commit")
        self.notion_prop_commit_count: str = props.get("commit_count", "Commit Count")
        self.notion_prop_visibility: str = props.get("visibility", "Visibility")
        self.notion_prop_repo_id: str = props.get("repo_id", "repository-id")

        # Visibility
        self.visibility_label_error: str = raw.get("visibility", {}).get("error", "Error")

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


def try_load_settings() -> Settings | None:
    """core config에서 플러그인 설정을 로드한다. 실패 시 None."""
    raw = get_raw_config()
    if not raw:
        return None
    try:
        _ = raw["github"]["token"]
        _ = raw["github"]["accounts"]
        _ = raw["notion"]["token"]
        _ = raw["notion"]["database_id"]
        return Settings(raw)
    except (KeyError, TypeError) as e:
        logger.warning("GitHub Sync 설정 로드 실패: %s", e)
        return None


# 모듈 레벨 싱글턴 — on_startup에서 설정, 설정 마법사에서 재할당
settings: Settings | None = None
