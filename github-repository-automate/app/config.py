"""
설정 관리 모듈.

config.toml 파일에서 GitHub/Notion 토큰, 계정 목록, Notion DB 속성명 등
모든 설정을 로드한다. 개인정보가 코드에 포함되지 않도록 외부 TOML 파일로 분리.

- config.toml이 없거나 유효하지 않으면 settings = None (서버 크래시 방지)
- 다른 모듈은 `from app import config` 후 `config.settings`로 접근
- 설정 마법사에서 저장 후 config.settings를 재할당하면 즉시 반영
"""

import logging
import tomllib
from pathlib import Path

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.toml"


class Settings:
    """config.toml에서 파싱된 설정. try_load_config()으로만 생성한다."""

    def __init__(self, raw: dict) -> None:
        # GitHub
        self.github_token: str = raw["github"]["token"]
        self.github_webhook_secret: str = raw["github"].get("webhook_secret", "")
        self.github_accounts: list[dict] = raw["github"]["accounts"]

        # Notion
        self.notion_token: str = raw["notion"]["token"]
        self.notion_database_id: str = raw["notion"]["database_id"]

        # Notion DB property names (기본값은 config.example.toml 기준)
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


def try_load_config() -> Settings | None:
    """config.toml을 로드한다. 실패 시 None 반환 (서버 크래시 방지)."""
    if not CONFIG_PATH.exists():
        logger.warning(f"config.toml not found at {CONFIG_PATH}")
        return None
    try:
        with open(CONFIG_PATH, "rb") as f:
            raw = tomllib.load(f)
        # 필수 키 검증
        _ = raw["github"]["token"]
        _ = raw["github"]["accounts"]
        _ = raw["notion"]["token"]
        _ = raw["notion"]["database_id"]
        return Settings(raw)
    except (KeyError, tomllib.TOMLDecodeError) as e:
        logger.warning(f"config.toml 로드 실패: {e}")
        return None


# 모듈 레벨 싱글턴 — main.py startup에서 설정, 설정 마법사에서 재할당
settings: Settings | None = None
