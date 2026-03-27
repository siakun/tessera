"""
GitHub Sync 플러그인 라우터.

기존 setup.py, dashboard.py, webhook.py를 하나로 병합.
Core가 /api/plugins/github-sync 접두사를 자동으로 붙인다.
"""

import hashlib
import hmac
import json
import logging
import tomllib

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import BaseModel

from backend.core.config import CONFIG_PATH, try_load_config
from backend.core.toml_writer import write_config_toml
from backend.core.state import core_state
from backend.plugins.github_sync import config
from backend.plugins.github_sync.config import try_load_settings
from backend.plugins.github_sync.state import plugin_state
from backend.plugins.github_sync.service import SyncService

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════
#  Setup 엔드포인트
# ═══════════════════════════════════════════════════════════════

@router.get("/status")
async def setup_status():
    """설정 완료 여부를 반환한다."""
    return {"configured": plugin_state.configured}


class TestGitHubRequest(BaseModel):
    token: str


@router.post("/setup/test-github")
async def test_github(req: TestGitHubRequest):
    """GitHub 토큰을 검증하고 인증된 사용자 정보를 반환한다."""
    import httpx
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {req.token}",
                "Accept": "application/vnd.github+json",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(400, "GitHub 토큰이 유효하지 않습니다.")
    user = resp.json()
    return {"login": user["login"], "name": user.get("name")}


class TestGitHubAccountRequest(BaseModel):
    token: str
    name: str
    type: str = "user"


@router.post("/setup/test-github-account")
async def test_github_account(req: TestGitHubAccountRequest):
    """GitHub 계정의 리포지토리 목록을 미리보기한다."""
    import httpx
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        if req.type == "org":
            resp = await client.get(
                f"https://api.github.com/orgs/{req.name}/repos",
                headers=headers,
                params={"per_page": 5},
            )
        else:
            resp = await client.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={"per_page": 5, "affiliation": "owner"},
            )
    if resp.status_code != 200:
        raise HTTPException(400, f"계정 '{req.name}'을 찾을 수 없거나 접근 권한이 없습니다.")
    repos = resp.json()
    return {
        "repos": [r["full_name"] for r in repos[:5]],
        "count_preview": len(repos),
    }


class TestNotionRequest(BaseModel):
    token: str
    database_id: str


@router.post("/setup/test-notion")
async def test_notion(req: TestNotionRequest):
    """Notion 토큰과 DB ID를 검증하고 DB 속성 목록을 반환한다."""
    import httpx
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Notion-Version": "2022-06-28",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"https://api.notion.com/v1/databases/{req.database_id}",
            headers=headers,
        )
    if resp.status_code != 200:
        raise HTTPException(400, "Notion 토큰 또는 데이터베이스 ID가 유효하지 않습니다.")
    db = resp.json()
    title_arr = db.get("title", [])
    title = title_arr[0].get("plain_text", "") if title_arr else ""
    properties = {name: prop["type"] for name, prop in db.get("properties", {}).items()}
    return {"title": title, "properties": properties}


class SaveConfigRequest(BaseModel):
    github_token: str
    github_webhook_secret: str = ""
    github_accounts: list[dict]
    notion_token: str
    notion_database_id: str
    notion_properties: dict
    visibility_error: str = "Error"


@router.post("/setup/save")
async def save_config(req: SaveConfigRequest):
    """config.toml을 저장하고 설정을 리로드한다."""
    data = {
        "github": {
            "token": req.github_token,
            "webhook_secret": req.github_webhook_secret,
            "accounts": req.github_accounts,
        },
        "notion": {
            "token": req.notion_token,
            "database_id": req.notion_database_id,
            "properties": req.notion_properties,
        },
        "visibility": {
            "error": req.visibility_error,
        },
    }
    write_config_toml(data, CONFIG_PATH)

    # Core config 리로드
    loaded_raw = try_load_config()
    if loaded_raw is None:
        raise HTTPException(500, "설정 저장 후 로드에 실패했습니다.")

    # Plugin config 리로드
    loaded = try_load_settings()
    if loaded is None:
        raise HTTPException(500, "설정 저장 후 로드에 실패했습니다.")
    config.settings = loaded
    plugin_state.configured = True

    # Core에 등록
    plugin_id = "github-sync"
    if plugin_id not in core_state.configured_plugins:
        core_state.configured_plugins.append(plugin_id)

    logger.info("config.toml 저장 및 리로드 완료")
    return {"status": "ok", "message": "설정이 저장되었습니다."}


# ═══════════════════════════════════════════════════════════════
#  Dashboard 엔드포인트
# ═══════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard():
    """대시보드 데이터를 반환한다."""
    if not plugin_state.configured:
        return {"configured": False}
    return {
        "configured": True,
        "last_sync_time": plugin_state.last_sync_time,
        "last_sync_result": plugin_state.last_sync_result,
        "sync_in_progress": plugin_state.sync_in_progress,
        "accounts": config.settings.get_accounts() if config.settings else [],
    }


@router.post("/sync/trigger")
async def trigger_sync(background_tasks: BackgroundTasks):
    """수동 전체 동기화를 트리거한다."""
    if not plugin_state.configured:
        raise HTTPException(503, "설정이 완료되지 않았습니다.")
    if plugin_state.sync_in_progress:
        raise HTTPException(409, "동기화가 이미 진행 중입니다.")

    svc = SyncService()
    background_tasks.add_task(_run_sync, svc)
    return {"status": "accepted", "message": "전체 동기화를 시작합니다."}


async def _run_sync(svc: SyncService) -> None:
    """동기화를 실행하고 상태를 업데이트한다."""
    plugin_state.sync_in_progress = True
    plugin_state.add_log({"type": "sync_start", "scope": "all"})
    try:
        result = await svc.sync_all()
        plugin_state.record_sync(result)
    except Exception as e:
        logger.error(f"동기화 실패: {e}")
        plugin_state.add_log({"type": "sync_error", "error": str(e)})
    finally:
        plugin_state.sync_in_progress = False
        plugin_state.cancel_requested = False


@router.post("/sync/cancel")
async def cancel_sync():
    """진행 중인 동기화를 중지 요청한다."""
    if not plugin_state.sync_in_progress:
        raise HTTPException(409, "진행 중인 동기화가 없습니다.")
    plugin_state.cancel_requested = True
    plugin_state.add_log({"type": "sync_cancel", "scope": "all"})
    return {"status": "accepted", "message": "중지 요청이 전달되었습니다."}


@router.get("/sync/logs")
async def get_logs():
    """최근 동기화 로그를 반환한다."""
    return {"logs": plugin_state.sync_logs}


@router.get("/settings")
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


@router.post("/settings")
async def update_settings(req: UpdateSettingsRequest):
    """설정을 수정하고 리로드한다."""
    with open(CONFIG_PATH, "rb") as f:
        current = tomllib.load(f)

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

    # Core config 리로드
    try_load_config()

    # Plugin config 리로드
    loaded = try_load_settings()
    if loaded is None:
        raise HTTPException(500, "설정 저장 후 로드에 실패했습니다.")
    config.settings = loaded
    logger.info("설정 수정 및 리로드 완료")
    return {"status": "ok", "message": "설정이 수정되었습니다."}


# ═══════════════════════════════════════════════════════════════
#  Webhook 엔드포인트
# ═══════════════════════════════════════════════════════════════

def _require_configured() -> None:
    if config.settings is None:
        raise HTTPException(status_code=503, detail="설정이 완료되지 않았습니다.")


@router.post("/webhook/sync-all")
async def webhook_sync_all(request: Request, background_tasks: BackgroundTasks):
    """Notion '전체 리포지토리 업데이트' 버튼에서 호출."""
    _require_configured()
    body = await request.body()
    logger.info(f"[sync-all] 웹훅 수신: {body.decode(errors='replace')}")

    svc = SyncService()
    background_tasks.add_task(svc.sync_all)
    return {"status": "accepted", "message": "전체 동기화를 시작합니다."}


@router.post("/webhook/sync-one")
async def webhook_sync_one(request: Request, background_tasks: BackgroundTasks):
    """Notion '선택한 리포지토리 업데이트' 버튼에서 호출."""
    _require_configured()
    body = await request.body()
    body_text = body.decode(errors="replace")
    logger.info(f"[sync-one] 웹훅 수신: {body_text}")

    try:
        data = json.loads(body_text) if body_text.strip() else {}
    except json.JSONDecodeError:
        data = {}

    page_id = _extract_page_id(data)
    repo_url = _extract_repo_url(data)

    if not page_id or not repo_url:
        logger.error(f"[sync-one] page_id 또는 repo_url 추출 실패: {data}")
        return Response(
            content=json.dumps(
                {"status": "error", "message": "page_id 또는 URL을 찾을 수 없습니다."},
                ensure_ascii=False,
            ),
            status_code=400,
            media_type="application/json",
        )

    svc = SyncService()
    background_tasks.add_task(svc.sync_one, page_id, repo_url)
    return {"status": "accepted", "message": f"리포지토리 동기화를 시작합니다: {repo_url}"}


@router.post("/webhook/github-push")
async def webhook_github_push(request: Request, background_tasks: BackgroundTasks):
    """GitHub push 이벤트 웹훅."""
    _require_configured()
    body = await request.body()

    if not config.settings.github_webhook_secret:
        logger.warning("[github-push] webhook_secret 미설정 — 요청 거부")
        return Response(
            status_code=403,
            content="Webhook secret not configured. Set [github] webhook_secret in settings.",
        )

    signature = request.headers.get("X-Hub-Signature-256", "")
    expected = "sha256=" + hmac.new(
        config.settings.github_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        logger.warning("[github-push] 서명 검증 실패")
        return Response(status_code=403, content="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return Response(status_code=400, content="Invalid JSON")

    logger.info(f"[github-push] 이벤트 수신: ref={data.get('ref')}, repo={data.get('repository', {}).get('full_name')}")

    ref = data.get("ref", "")
    if ref not in ("refs/heads/main", "refs/heads/master"):
        logger.info(f"[github-push] main/master 브랜치가 아님, 무시: {ref}")
        return {"status": "ignored", "message": f"브랜치 무시: {ref}"}

    full_name = data.get("repository", {}).get("full_name")
    if not full_name:
        return Response(status_code=400, content="Missing repository.full_name")

    svc = SyncService()
    background_tasks.add_task(svc.sync_on_push, full_name)
    return {"status": "accepted", "message": f"Push 동기화를 시작합니다: {full_name}"}


@router.post("/webhook/deduplicate")
async def webhook_deduplicate(request: Request, background_tasks: BackgroundTasks):
    """중복 행을 찾아 아카이브한다."""
    _require_configured()
    body = await request.body()
    body_text = body.decode(errors="replace")
    logger.info(f"[deduplicate] 요청 수신: {body_text}")

    try:
        data = json.loads(body_text) if body_text.strip() else {}
    except json.JSONDecodeError:
        data = {}

    page_id = data.get("page_id")
    svc = SyncService()

    if page_id:
        background_tasks.add_task(svc.deduplicate_one, page_id)
        return {"status": "accepted", "message": f"개별 중복 제거: {page_id}"}
    else:
        background_tasks.add_task(svc.deduplicate)
        return {"status": "accepted", "message": "전체 중복 제거를 시작합니다."}


# -- 유틸 --

def _extract_page_id(data: dict) -> str | None:
    for key in ("page_id", "pageId", "id"):
        if key in data:
            return data[key]
    if "data" in data and isinstance(data["data"], dict):
        for key in ("page_id", "pageId", "id"):
            if key in data["data"]:
                return data["data"][key]
    return None


def _extract_repo_url(data: dict) -> str | None:
    url_prop = config.settings.notion_prop_url if config.settings else "URL"

    if "url" in data and "github.com" in str(data["url"]):
        return data["url"]

    props = data.get("properties", data.get("data", {}).get("properties", {}))
    if isinstance(props, dict):
        url_obj = props.get(url_prop, props.get("URL", props.get("url", {})))
        if isinstance(url_obj, dict):
            return url_obj.get("url")
        if isinstance(url_obj, str) and "github.com" in url_obj:
            return url_obj

    for value in data.values():
        if isinstance(value, str) and "github.com" in value:
            return value

    return None
