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
    github_sources_raw: list[str] = _raw["github"]["sources"]
    port: int = _raw.get("server", {}).get("port", 8000)

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

    # Visibility labels
    _vis = _raw.get("visibility", {})
    visibility_label_public: str = _vis.get("public", "Public")
    visibility_label_private: str = _vis.get("private", "Private")
    visibility_label_error: str = _vis.get("error", "Error")
    _visibility_map: dict[str, str] = _vis.get("map", {})

    def get_sources(self) -> list[dict[str, str]]:
        """Parse sources list into [{type, name}]."""
        sources = []
        for src in self.github_sources_raw:
            src = src.strip()
            if src.startswith("org:"):
                sources.append({"type": "org", "name": src[4:]})
            else:
                sources.append({"type": "user", "name": src})
        return sources

    def get_visibility_map(self) -> dict[str, str]:
        """Return org-name to label mapping."""
        return self._visibility_map


settings = Settings()
