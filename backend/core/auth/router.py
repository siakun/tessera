"""
인증 라우터.

Google OAuth 플로우, 세션 관리, 초기 설정 엔드포인트.
/auth/* 경로는 미들웨어에서 우회되므로 인증 없이 접근 가능.
"""

import asyncio
import logging
import secrets
from urllib.parse import urlencode

import google.auth.transport.requests
import httpx
from fastapi import APIRouter, Request
from google.oauth2 import id_token as google_id_token
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from backend.core.auth import auth_configured, get_auth_config, reload_auth_config
from backend.core.auth.config import save_auth_config
from backend.core.auth.jwt_utils import create_token, verify_token
from backend.core import audit
from backend.core.auth.middleware import _get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _is_https(request: Request) -> bool:
    """TLS 종료 프록시 뒤에서도 HTTPS 여부를 올바르게 판별한다."""
    if request.url.scheme == "https":
        return True
    return request.headers.get("x-forwarded-proto", "").lower() == "https"


# ═══════════════════════════════════════════════════════════════
#  상태 확인
# ═══════════════════════════════════════════════════════════════

@router.get("/status")
async def auth_status(request: Request):
    """인증 설정 여부와 현재 세션 상태를 반환한다."""
    if not auth_configured():
        return {"auth_configured": False}

    cfg = get_auth_config()
    token = request.cookies.get("tessera_session")
    if not token:
        return {"auth_configured": True, "authenticated": False}

    payload = verify_token(token, cfg.jwt_secret)
    if not payload:
        return {"auth_configured": True, "authenticated": False}

    return {
        "auth_configured": True,
        "authenticated": True,
        "email": payload.get("email"),
        "name": payload.get("name"),
    }


# ═══════════════════════════════════════════════════════════════
#  초기 설정 (auth.json 미존재 시만 허용)
# ═══════════════════════════════════════════════════════════════

class AuthSetupRequest(BaseModel):
    google_client_id: str
    google_client_secret: str
    allowed_emails: list[str]
    oauth_redirect_uri: str | None = None


@router.post("/setup")
async def auth_setup(req: AuthSetupRequest, req_raw: Request):
    """초기 인증 설정을 저장한다. 이미 설정된 경우 403."""
    if auth_configured():
        return JSONResponse(
            status_code=403,
            content={"detail": "Authentication already configured"},
        )

    if not req.google_client_id or not req.google_client_secret:
        return JSONResponse(
            status_code=400,
            content={"detail": "Client ID and Secret are required"},
        )

    emails = [e.strip().lower() for e in req.allowed_emails if e.strip()]
    if not emails:
        return JSONResponse(
            status_code=400,
            content={"detail": "At least one email is required"},
        )

    # Google OAuth 자격 증명 검증
    redirect_uri = req.oauth_redirect_uri or "http://localhost/auth/callback"
    validation_error = await _validate_google_credentials(
        req.google_client_id.strip(),
        req.google_client_secret.strip(),
        redirect_uri.strip(),
    )
    if validation_error:
        return JSONResponse(status_code=400, content={"detail": validation_error})

    # JWT secret 자동 생성
    jwt_secret = secrets.token_urlsafe(48)

    data = {
        "google_client_id": req.google_client_id.strip(),
        "google_client_secret": req.google_client_secret.strip(),
        "allowed_emails": emails,
        "jwt_secret": jwt_secret,
    }
    if req.oauth_redirect_uri:
        data["oauth_redirect_uri"] = req.oauth_redirect_uri.strip()

    save_auth_config(data)
    reload_auth_config()

    ip = _get_client_ip(req_raw)
    await audit.add_entry(ip=ip, method="POST", path="/auth/setup", status=200,
                    event="auth_setup", detail=f"allowed: {', '.join(emails)}")
    logger.info("인증 초기 설정 완료: 허용 이메일 %d개", len(emails))
    return {"status": "ok", "allowed_emails": emails}


# ═══════════════════════════════════════════════════════════════
#  Google OAuth 플로우
# ═══════════════════════════════════════════════════════════════

@router.get("/login")
async def auth_login(request: Request):
    """Google OAuth 동의 화면으로 리다이렉트한다."""
    cfg = get_auth_config()
    if not cfg:
        return JSONResponse(
            status_code=404, content={"detail": "Authentication not configured"}
        )

    state = secrets.token_urlsafe(32)
    redirect_uri = _get_redirect_uri(request, cfg)

    params = {
        "client_id": cfg.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }

    response = RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}")
    response.set_cookie(
        key="tessera_oauth_state",
        value=state,
        httponly=True,
        samesite="lax",
        secure=_is_https(request),
        max_age=600,
        path="/auth",
    )
    return response


@router.get("/callback")
async def auth_callback(request: Request, code: str = "", state: str = ""):
    """Google OAuth 콜백을 처리한다."""
    cfg = get_auth_config()
    if not cfg:
        return RedirectResponse(url="/?auth_error=not_configured")

    saved_state = request.cookies.get("tessera_oauth_state")
    if not saved_state or not secrets.compare_digest(saved_state, state):
        return RedirectResponse(url="/?auth_error=invalid_state")

    redirect_uri = _get_redirect_uri(request, cfg)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": cfg.google_client_id,
                    "client_secret": cfg.google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if resp.status_code != 200:
                logger.warning("Google token exchange failed: %s", resp.text)
                return RedirectResponse(url="/?auth_error=google_error")

            token_data = resp.json()
    except httpx.HTTPError as e:
        logger.warning("Google token exchange error: %s", e)
        return RedirectResponse(url="/?auth_error=google_error")

    id_token = token_data.get("id_token")
    if not id_token:
        return RedirectResponse(url="/?auth_error=google_error")

    user_info = await _verify_id_token(id_token, cfg.google_client_id)
    if not user_info:
        return RedirectResponse(url="/?auth_error=google_error")

    email = user_info.get("email", "").lower()
    name = user_info.get("name", "")

    if not user_info.get("email_verified", False):
        return RedirectResponse(url="/?auth_error=email_not_verified")

    ip = _get_client_ip(request)

    if email not in cfg.allowed_emails:
        await audit.add_entry(ip=ip, method="GET", path="/auth/callback", status=403,
                        event="login_rejected", user=email, detail="not in whitelist")
        logger.warning("Login rejected: %s not in allowed_emails", email)
        return RedirectResponse(url="/?auth_error=not_whitelisted")

    session_token = create_token(
        {"email": email, "name": name},
        cfg.jwt_secret,
        cfg.session_max_age,
    )

    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="tessera_session",
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=_is_https(request),
        max_age=cfg.session_max_age,
        path="/",
    )
    response.delete_cookie(key="tessera_oauth_state", path="/auth")

    await audit.add_entry(ip=ip, method="GET", path="/auth/callback", status=302,
                    event="login_success", user=email)
    return response


@router.post("/logout")
async def auth_logout():
    """세션 쿠키를 삭제한다."""
    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie(key="tessera_session", path="/")
    return response


# ═══════════════════════════════════════════════════════════════
#  내부 유틸
# ═══════════════════════════════════════════════════════════════

def _get_redirect_uri(request: Request, cfg) -> str:
    if cfg.oauth_redirect_uri:
        return cfg.oauth_redirect_uri
    return str(request.base_url).rstrip("/") + "/auth/callback"


async def _validate_google_credentials(
    client_id: str, client_secret: str, redirect_uri: str,
) -> str | None:
    """Google 토큰 엔드포인트에 더미 요청을 보내 자격 증명을 검증한다.

    invalid_client → Client ID 또는 Secret이 잘못됨
    invalid_grant / redirect_uri_mismatch → 자격 증명은 유효 (코드만 더미)
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": "dummy_validation_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            error_data = resp.json()
            error_code = error_data.get("error", "")

            if error_code == "invalid_client":
                return "Google Client ID 또는 Client Secret이 올바르지 않습니다."

            # invalid_grant, redirect_uri_mismatch 등은 자격 증명이 유효한 것
            return None
    except httpx.HTTPError as e:
        logger.warning("Google credential validation error: %s", e)
        return "Google 서버에 연결할 수 없습니다. 네트워크를 확인하세요."


_google_transport = google.auth.transport.requests.Request()


async def _verify_id_token(id_token: str, client_id: str) -> dict | None:
    """Google ID Token의 서명을 검증하고 payload를 반환한다."""
    try:
        return await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            id_token, _google_transport, client_id,
        )
    except Exception as e:
        logger.warning("Google ID Token 검증 실패: %s", e)
        return None
