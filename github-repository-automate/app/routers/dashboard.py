"""
대시보드 및 설정 API.

동기화 상태 조회, 수동 트리거, 로그 조회, 설정 읽기/수정 엔드포인트.
"""

import logging
import tomllib

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app import config
from app.config import CONFIG_PATH, try_load_config
from app.state import app_state
from app.sync_service import SyncService
from app.toml_writer import write_config_toml

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
async def get_dashboard():
    """대시보드 데이터를 반환한다."""
    if not app_state.configured:
        return {"configured": False}
    return {
        "configured": True,
        "last_sync_time": app_state.last_sync_time,
        "last_sync_result": app_state.last_sync_result,
        "sync_in_progress": app_state.sync_in_progress,
        "accounts": config.settings.get_accounts() if config.settings else [],
    }


@router.post("/api/sync/trigger")
async def trigger_sync(background_tasks: BackgroundTasks):
    """수동 전체 동기화를 트리거한다."""
    if not app_state.configured:
        raise HTTPException(503, "설정이 완료되지 않았습니다.")
    if app_state.sync_in_progress:
        raise HTTPException(409, "동기화가 이미 진행 중입니다.")

    svc = SyncService()
    background_tasks.add_task(_run_sync, svc)
    return {"status": "accepted", "message": "전체 동기화를 시작합니다."}


async def _run_sync(svc: SyncService) -> None:
    """동기화를 실행하고 AppState를 업데이트한다."""
    app_state.sync_in_progress = True
    app_state.add_log({"type": "sync_start", "scope": "all"})
    try:
        result = await svc.sync_all()
        app_state.record_sync(result)
    except Exception as e:
        logger.error(f"동기화 실패: {e}")
        app_state.add_log({"type": "sync_error", "error": str(e)})
    finally:
        app_state.sync_in_progress = False


@router.get("/api/sync/logs")
async def get_logs():
    """최근 동기화 로그를 반환한다."""
    return {"logs": app_state.sync_logs}


@router.get("/api/settings")
async def get_settings():
    """현재 설정을 반환한다. 토큰은 마스킹 처리."""
    if not CONFIG_PATH.exists():
        raise HTTPException(404, "설정 파일이 없습니다.")
    with open(CONFIG_PATH, "rb") as f:
        raw = tomllib.load(f)
    # 토큰 마스킹
    gh_token = raw.get("github", {}).get("token", "")
    raw["github"]["token"] = gh_token[:8] + "***" if len(gh_token) > 8 else gh_token
    nt_token = raw.get("notion", {}).get("token", "")
    raw["notion"]["token"] = nt_token[:8] + "***" if len(nt_token) > 8 else nt_token
    return raw


class UpdateSettingsRequest(BaseModel):
    github_token: str | None = None
    github_webhook_secret: str | None = None
    github_accounts: list[dict] | None = None
    notion_token: str | None = None
    notion_database_id: str | None = None
    notion_properties: dict | None = None
    visibility_error: str | None = None


@router.post("/api/settings")
async def update_settings(req: UpdateSettingsRequest):
    """설정을 수정하고 리로드한다. 제공된 필드만 업데이트."""
    with open(CONFIG_PATH, "rb") as f:
        current = tomllib.load(f)

    # 변경된 필드만 병합 (마스킹된 토큰은 무시)
    if req.github_token and "***" not in req.github_token:
        current["github"]["token"] = req.github_token
    if req.github_webhook_secret is not None:
        current["github"]["webhook_secret"] = req.github_webhook_secret
    if req.github_accounts is not None:
        current["github"]["accounts"] = req.github_accounts
    if req.notion_token and "***" not in req.notion_token:
        current["notion"]["token"] = req.notion_token
    if req.notion_database_id is not None:
        current["notion"]["database_id"] = req.notion_database_id
    if req.notion_properties is not None:
        current.setdefault("notion", {})["properties"] = req.notion_properties
    if req.visibility_error is not None:
        current.setdefault("visibility", {})["error"] = req.visibility_error

    write_config_toml(current, CONFIG_PATH)

    loaded = try_load_config()
    if loaded is None:
        raise HTTPException(500, "설정 저장 후 로드에 실패했습니다.")
    config.settings = loaded
    logger.info("설정 수정 및 리로드 완료")
    return {"status": "ok", "message": "설정이 수정되었습니다."}
