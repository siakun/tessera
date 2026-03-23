"""
TOML 파일 직렬화.

Python 3.12의 tomllib은 읽기 전용이므로, config.toml 저장을 위해
직접 TOML 형식으로 직렬화한다. 이 프로젝트의 config 구조만 지원한다.
"""

from pathlib import Path


def write_config_toml(data: dict, path: Path) -> None:
    """config dict를 TOML 파일로 저장한다."""
    lines = ["# GitHub-Notion Sync Configuration", ""]

    # [github]
    lines.append("[github]")
    lines.append(f'token = "{_escape(data["github"]["token"])}"')
    lines.append(f'webhook_secret = "{_escape(data["github"].get("webhook_secret", ""))}"')
    lines.append("")

    # [[github.accounts]]
    for acc in data["github"]["accounts"]:
        lines.append("[[github.accounts]]")
        lines.append(f'name = "{_escape(acc["name"])}"')
        if acc.get("type") and acc["type"] != "user":
            lines.append(f'type = "{_escape(acc["type"])}"')
        lines.append(f'label = "{_escape(acc["label"])}"')
        lines.append("")

    # [notion]
    lines.append("[notion]")
    lines.append(f'token = "{_escape(data["notion"]["token"])}"')
    lines.append(f'database_id = "{_escape(data["notion"]["database_id"])}"')
    lines.append("")

    # [notion.properties]
    props = data.get("notion", {}).get("properties", {})
    if props:
        lines.append("[notion.properties]")
        for k, v in props.items():
            lines.append(f'{k} = "{_escape(v)}"')
        lines.append("")

    # [visibility]
    vis = data.get("visibility", {})
    if vis:
        lines.append("[visibility]")
        lines.append(f'error = "{_escape(vis.get("error", "Error"))}"')
        lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def _escape(s: str) -> str:
    """TOML 문자열 값의 특수문자를 이스케이프한다."""
    return s.replace("\\", "\\\\").replace('"', '\\"')
