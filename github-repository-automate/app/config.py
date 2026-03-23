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


class Settings:
    # GitHub
    github_token: str = _raw["github"]["token"]
    github_webhook_secret: str = _raw["github"].get("webhook_secret", "")
    github_accounts: list[dict] = _raw["github"]["accounts"]

    # Notion
    notion_token: str = _raw["notion"]["token"]
    notion_database_id: str = _raw["notion"]["database_id"]

    # Notion DB property names
    _props = _raw.get("notion", {}).get("properties", {})
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
        """Parse accounts into [{name, type, label}]."""
        sources = []
        for src in self.github_accounts:
            sources.append({
                "name": src["name"],
                "type": src.get("type", "user"),
                "label": src["label"],
            })
        return sources

    def get_account_label(self, owner: str) -> str | None:
        """계정 이름으로 라벨을 조회한다."""
        for src in self.github_accounts:
            if src["name"] == owner:
                return src["label"]
        return None


settings = Settings()
