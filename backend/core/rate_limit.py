"""요청 속도 제한 (Rate Limiting)."""

from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

from backend.core.auth.middleware import _get_client_ip

limiter = Limiter(key_func=_get_client_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """429 응답을 JSON 형식으로 반환한다."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests"},
    )
