"""
Tessera 애플리케이션 엔트리포인트.

- 플러그인을 자동 발견하여 라우터를 등록한다.
- React SPA(index.html)를 서빙한다.
- 설정 미완료 시 React가 /setup으로 리다이렉트
"""

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import try_load_config
from backend.core.plugin_registry import discover_plugins

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tessera")

STATIC_DIR = Path(__file__).parent / "static"


@app.on_event("startup")
async def startup():
    """서버 시작 시 config.toml을 로드하고 플러그인을 등록한다."""
    config = try_load_config()
    if config:
        logger.info("config.toml 로드 완료")
    else:
        logger.warning("config.toml 없음 — 설정 마법사 모드로 시작합니다.")

    discover_plugins(app)


# Core 라우터
from backend.routers import plugins as plugins_router  # noqa: E402

app.include_router(plugins_router.router)


@app.get("/health")
async def health():
    from backend.core.plugin_registry import get_registered
    return {
        "status": "ok",
        "plugins": [p["id"] for p in get_registered()],
    }


# React SPA 정적 파일 서빙
if STATIC_DIR.exists() and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """API가 아닌 모든 경로에서 React SPA의 index.html을 반환한다."""
    file_path = STATIC_DIR / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
