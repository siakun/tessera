import hashlib
import hmac
import json
import logging

from fastapi import BackgroundTasks, FastAPI, Request, Response

from app.config import settings
from app.sync_service import SyncService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="GitHub-Notion Sync")
sync_service = SyncService()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/webhook/sync-all")
async def webhook_sync_all(request: Request, background_tasks: BackgroundTasks):
    """Notion '전체 리포지토리 업데이트' 버튼에서 호출."""
    body = await request.body()
    logger.info(f"[sync-all] 웹훅 수신: {body.decode(errors='replace')}")

    background_tasks.add_task(sync_service.sync_all)
    return {"status": "accepted", "message": "전체 동기화를 시작합니다."}


@app.post("/webhook/sync-one")
async def webhook_sync_one(request: Request, background_tasks: BackgroundTasks):
    """Notion '선택한 리포지토리 업데이트' 버튼에서 호출."""
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

    background_tasks.add_task(sync_service.sync_one, page_id, repo_url)
    return {"status": "accepted", "message": f"리포지토리 동기화를 시작합니다: {repo_url}"}


@app.post("/webhook/github-push")
async def webhook_github_push(request: Request, background_tasks: BackgroundTasks):
    """GitHub push 이벤트 웹훅."""
    body = await request.body()

    # HMAC-SHA256 서명 검증
    if settings.github_webhook_secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.github_webhook_secret.encode(),
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

    # main/master 브랜치 push만 처리
    ref = data.get("ref", "")
    if ref not in ("refs/heads/main", "refs/heads/master"):
        logger.info(f"[github-push] main/master 브랜치가 아님, 무시: {ref}")
        return {"status": "ignored", "message": f"브랜치 무시: {ref}"}

    full_name = data.get("repository", {}).get("full_name")
    if not full_name:
        return Response(status_code=400, content="Missing repository.full_name")

    background_tasks.add_task(sync_service.sync_on_push, full_name)
    return {"status": "accepted", "message": f"Push 동기화를 시작합니다: {full_name}"}


def _extract_page_id(data: dict) -> str | None:
    """Notion 웹훅 페이로드에서 page_id를 추출한다."""
    # Notion 웹훅 페이로드 형식이 정확히 문서화되어 있지 않으므로
    # 여러 경로를 시도한다
    for key in ("page_id", "pageId", "id"):
        if key in data:
            return data[key]

    if "data" in data and isinstance(data["data"], dict):
        for key in ("page_id", "pageId", "id"):
            if key in data["data"]:
                return data["data"][key]

    return None


def _extract_repo_url(data: dict) -> str | None:
    """Notion 웹훅 페이로드에서 리포지토리 URL을 추출한다."""
    url_prop = settings.notion_prop_url

    # 직접 URL 키 시도
    if "url" in data and "github.com" in str(data["url"]):
        return data["url"]

    # properties에서 URL 추출 시도
    props = data.get("properties", data.get("data", {}).get("properties", {}))
    if isinstance(props, dict):
        url_obj = props.get(url_prop, props.get("URL", props.get("url", {})))
        if isinstance(url_obj, dict):
            return url_obj.get("url")
        if isinstance(url_obj, str) and "github.com" in url_obj:
            return url_obj

    # 모든 값에서 github URL 찾기
    for value in data.values():
        if isinstance(value, str) and "github.com" in value:
            return value

    return None


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
