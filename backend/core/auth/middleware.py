"""
인증 미들웨어.

항상 활성화되며, 인증 상태에 따라 동작:
- auth 미설정: /auth/* 외 모든 /api/* 차단 (초기 설정 유도)
- auth 설정됨: JWT 쿠키 검증
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.core.auth import auth_configured, get_auth_config
from backend.core.auth.jwt_utils import verify_token

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 항상 우회하는 경로
        if self._is_bypassed(path):
            return await call_next(request)

        # auth 미설정: /api/* 접근 차단 (프론트엔드가 설정 페이지로 안내)
        if not auth_configured():
            return JSONResponse(
                status_code=401, content={"detail": "Authentication not configured"}
            )

        # auth 설정됨: JWT 쿠키 검증
        cfg = get_auth_config()
        token = request.cookies.get("tessera_session")
        if not token:
            return JSONResponse(
                status_code=401, content={"detail": "Not authenticated"}
            )

        payload = verify_token(token, cfg.jwt_secret)
        if not payload:
            return JSONResponse(
                status_code=401, content={"detail": "Session expired"}
            )

        request.state.user = payload
        return await call_next(request)

    @staticmethod
    def _is_bypassed(path: str) -> bool:
        if path.startswith("/auth/"):
            return True
        if path == "/health":
            return True
        if "/webhook/" in path:
            return True
        if not path.startswith("/api/"):
            return True
        return False
