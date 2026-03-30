"""
Tessera 애플리케이션 엔트리포인트.

- 플러그인을 자동 발견하여 라우터를 등록한다.
- React SPA(index.html)를 서빙한다.
- 설정 미완료 시 React가 /setup으로 리다이렉트

라우터 등록 순서가 중요하다:
  1. config 로드
  2. 인증 미들웨어 (항상) + auth 라우터
  3. 플러그인 디스커버리 (라우터 등록)
  4. Core 라우터
  5. SPA catch-all (반드시 마지막)
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from slowapi.errors import RateLimitExceeded

from backend.core.config import try_load_config
from backend.core.database import init_db
from backend.core.plugin_registry import discover_plugins
from backend.core.rate_limit import limiter, rate_limit_exceeded_handler
from backend.core.version import VERSION_STRING
from backend.core.auth import auth_configured
from backend.core.auth.middleware import AuthMiddleware
from backend.core.auth.router import router as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
_STATIC_DIR_RESOLVED = STATIC_DIR.resolve()


@asynccontextmanager
async def lifespan(app):
    """앱 시작/종료 생명주기."""
    await init_db()
    logger.info("DB 초기화 완료 (data/tessera.db)")
    yield


_DEBUG = os.environ.get("TESSERA_DEBUG", "").lower() in ("1", "true", "yes")

app = FastAPI(
    title="Tessera",
    lifespan=lifespan,
    docs_url="/docs" if _DEBUG else None,
    redoc_url="/redoc" if _DEBUG else None,
    openapi_url="/openapi.json" if _DEBUG else None,
)

# ── 1. Config 로드 ──
_config = try_load_config()
if _config:
    logger.info("config.toml 로드 완료")
else:
    logger.warning("config.toml 없음 — 설정 마법사 모드로 시작합니다.")

# ── 2. 인증 미들웨어 (항상 활성) + auth 라우터 + Rate Limiting ──
app.add_middleware(AuthMiddleware)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.include_router(auth_router)

if auth_configured():
    logger.info("OAuth 인증 설정됨")
else:
    logger.info("인증 미설정 — 초기 설정 페이지를 표시합니다.")

# ── 3. 플러그인 디스커버리 (라우터가 SPA catch-all보다 먼저 등록되어야 한다) ──
discover_plugins(app)

# ── 4. Core 라우터 ──
from backend.routers import plugins as plugins_router  # noqa: E402

app.include_router(plugins_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── 5. React SPA 정적 파일 서빙 (반드시 마지막) ──
if STATIC_DIR.exists() and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """API가 아닌 모든 경로에서 React SPA의 index.html을 반환한다."""
    try:
        file_path = (STATIC_DIR / full_path).resolve()
        file_path.relative_to(_STATIC_DIR_RESOLVED)
    except (ValueError, OSError):
        # STATIC_DIR 외부 접근 시도 (Path Traversal) → SPA fallback
        return FileResponse(STATIC_DIR / "index.html")
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
