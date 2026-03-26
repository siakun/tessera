"""
GitHub Repository Sync 플러그인.

GitHub 저장소 메타데이터를 Notion 데이터베이스에 자동 동기화한다.
"""

PLUGIN_MANIFEST = {
    "id": "github-sync",
    "name": "GitHub Repository Sync",
    "description": "GitHub 저장소 메타데이터를 Notion 데이터베이스에 자동 동기화합니다.",
    "version": "1.0.0",
    "icon": "github",
    "config_sections": ["github", "notion", "visibility"],
    "has_setup": True,
    "has_dashboard_widget": True,
}


def get_router():
    from .router import router
    return router


def on_startup():
    """앱 시작 시 호출. core config에서 플러그인 설정을 로드한다."""
    from . import config as plugin_config
    from .state import plugin_state
    from backend.core.state import core_state

    loaded = plugin_config.try_load_settings()
    plugin_config.settings = loaded
    plugin_state.configured = loaded is not None

    if loaded is not None:
        core_state.configured_plugins.append(PLUGIN_MANIFEST["id"])
