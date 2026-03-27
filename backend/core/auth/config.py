"""
인증 설정 모듈.

data/auth.json에서 Google OAuth 설정을 읽는다.
파일이 없으면 인증 미설정 상태 (초기 설정 페이지 표시).
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
AUTH_CONFIG_PATH = DATA_DIR / "auth.json"


@dataclass(frozen=True)
class AuthConfig:
    google_client_id: str
    google_client_secret: str
    allowed_emails: list[str]
    jwt_secret: str
    oauth_redirect_uri: str | None
    session_max_age: int


def load_auth_config() -> AuthConfig | None:
    """data/auth.json에서 인증 설정을 로드한다. 파일 없으면 None."""
    if not AUTH_CONFIG_PATH.exists():
        return None

    try:
        with open(AUTH_CONFIG_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("auth.json 파싱 실패: %s", e)
        return None

    client_id = data.get("google_client_id", "").strip()
    client_secret = data.get("google_client_secret", "").strip()
    allowed = data.get("allowed_emails", [])
    jwt_secret = data.get("jwt_secret", "").strip()

    if not all([client_id, client_secret, allowed, jwt_secret]):
        return None

    # 이메일 소문자 정규화
    allowed = [e.strip().lower() for e in allowed if e.strip()]
    if not allowed:
        return None

    return AuthConfig(
        google_client_id=client_id,
        google_client_secret=client_secret,
        allowed_emails=allowed,
        jwt_secret=jwt_secret,
        oauth_redirect_uri=data.get("oauth_redirect_uri") or None,
        session_max_age=int(data.get("session_max_age", 604800)),
    )


def save_auth_config(data: dict) -> None:
    """인증 설정을 data/auth.json에 저장한다."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(AUTH_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
