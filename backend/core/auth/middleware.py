"""
인증 + 감사 로그 미들웨어.

모든 HTTP 요청을 감사 로그에 기록한다 (정적 파일만 제외).
인증 검증은 별도 판단으로, 로그 기록과 독립적이다.

새 엔드포인트를 추가해도 감사 로그는 자동으로 남는다.
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.core.auth import auth_configured, get_auth_config
from backend.core.auth.jwt_utils import verify_token
from backend.core import audit

logger = logging.getLogger(__name__)


def _get_client_ip(request: Request) -> str:
    """클라이언트 IP를 추출한다. 리버스 프록시 헤더 우선."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method
        ip = _get_client_ip(request)

        # ── 1. 인증 처리 ──
        if self._skip_auth(path):
            response = await call_next(request)
        else:
            response = await self._authenticate(request, call_next, ip, method, path)

        # ── 2. 보안 헤더 ──
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        # ── 3. 감사 로그 (정적 파일만 제외, 나머지 전부 기록) ──
        if not self._is_static(path):
            user = None
            if hasattr(request.state, "user"):
                user = request.state.user.get("email")
            await audit.add_entry(
                ip=ip, method=method, path=path,
                status=response.status_code, user=user,
            )

        return response

    async def _authenticate(self, request, call_next, ip, method, path):
        """JWT 쿠키를 검증한다. 실패 시 401 응답."""
        if not auth_configured():
            return JSONResponse(
                status_code=401, content={"detail": "Authentication not configured"}
            )

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
    def _skip_auth(path: str) -> bool:
        """인증 검증을 건너뛰는 경로. 로그와는 무관."""
        if path.startswith("/auth/"):
            return True
        if path == "/health":
            return True
        # 외부 서비스 웹훅만 JWT 우회 (핸들러에서 HMAC 자체 검증)
        if path.endswith("/webhook/github-push"):
            return True
        if not path.startswith("/api/"):
            return True
        return False

    @staticmethod
    def _is_static(path: str) -> bool:
        """감사 로그에서 제외할 정적 파일 및 long-lived 연결."""
        if path.startswith("/assets/"):
            return True
        if path.endswith(("/system/logs/stream",)):
            return True
        static_ext = (".js", ".css", ".svg", ".png", ".ico", ".woff", ".woff2", ".map")
        return path.endswith(static_ext)
