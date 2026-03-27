"""
인증 라우터.

Google OAuth 플로우, 세션 관리, 초기 설정 엔드포인트.
/auth/* 경로는 미들웨어에서 우회되므로 인증 없이 접근 가능.
"""

import base64
import json
import logging
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from backend.core.auth import auth_configured, get_auth_config, reload_auth_config
from backend.core.auth.config import save_auth_config
from backend.core.auth.jwt_utils import create_token, verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


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
async def auth_setup(req: AuthSetupRequest):
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
        secure=request.url.scheme == "https",
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

    user_info = _decode_id_token(id_token)
    if not user_info:
        return RedirectResponse(url="/?auth_error=google_error")

    email = user_info.get("email", "").lower()
    name = user_info.get("name", "")

    if not user_info.get("email_verified", False):
        return RedirectResponse(url="/?auth_error=email_not_verified")

    if email not in cfg.allowed_emails:
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
        secure=request.url.scheme == "https",
        max_age=cfg.session_max_age,
        path="/",
    )
    response.delete_cookie(key="tessera_oauth_state", path="/auth")
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


def _decode_id_token(id_token: str) -> dict | None:
    """Google id_token의 payload를 디코드한다 (서명 검증 생략 — confidential client)."""
    try:
        parts = id_token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return None
