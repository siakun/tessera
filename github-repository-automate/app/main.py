"""
FastAPI 애플리케이션 엔트리포인트.

- 설정 미완료 시: 설정 마법사 (setup.html)
- 설정 완료 후: 대시보드 (dashboard.html)
- 웹훅 엔드포인트는 설정 완료 후에만 동작 (503)
"""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.config import try_load_config
from app.state import app_state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="GitHub-Notion Sync")

STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
async def startup():
    """서버 시작 시 config.toml을 로드한다."""
    loaded = try_load_config()
    config.settings = loaded
    app_state.configured = loaded is not None
    if loaded:
        logger.info("설정 로드 완료")
    else:
        logger.warning("설정 미완료 — 설정 마법사 모드로 시작합니다.")


# 라우터 등록
from app.routers import webhook, setup, dashboard  # noqa: E402

app.include_router(webhook.router)
app.include_router(setup.router)
app.include_router(dashboard.router)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root():
    """설정 여부에 따라 대시보드 또는 설정 마법사를 표시한다."""
    if app_state.configured:
        return FileResponse(STATIC_DIR / "dashboard.html")
    return FileResponse(STATIC_DIR / "setup.html")


@app.get("/setup")
async def setup_page():
    """설정 마법사 페이지."""
    return FileResponse(STATIC_DIR / "setup.html")


@app.get("/settings")
async def settings_page():
    """설정 편집 페이지."""
    return FileResponse(STATIC_DIR / "settings.html")


@app.get("/health")
async def health():
    return {"status": "ok", "configured": app_state.configured}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
