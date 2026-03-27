"""
Core 인증 모듈.

data/auth.json 기반 Google OAuth + 이메일 화이트리스트.
파일 미존재 시 초기 설정 페이지를 표시한다.
"""

from .config import AuthConfig, load_auth_config

_auth_config: AuthConfig | None = load_auth_config()


def auth_configured() -> bool:
    """인증 설정이 완료되었는지 반환한다."""
    return _auth_config is not None


def get_auth_config() -> AuthConfig | None:
    """인증 설정을 반환한다. 미설정 시 None."""
    return _auth_config


def reload_auth_config() -> None:
    """auth.json을 다시 로드한다. 초기 설정 완료 후 호출."""
    global _auth_config
    _auth_config = load_auth_config()
