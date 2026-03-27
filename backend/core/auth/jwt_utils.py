"""
JWT 유틸리티 (HS256).

stdlib만 사용하여 최소한의 JWT를 생성하고 검증한다.
외부 의존성 없이 세션 토큰을 관리한다.
"""

import base64
import hashlib
import hmac
import json
import time


def create_token(payload: dict, secret: str, max_age: int) -> str:
    """JWT를 생성한다. payload에 iat, exp를 자동 추가."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    full_payload = {**payload, "iat": now, "exp": now + max_age}

    segments = [
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode()),
        _b64url_encode(json.dumps(full_payload, separators=(",", ":")).encode()),
    ]
    signing_input = f"{segments[0]}.{segments[1]}"
    signature = hmac.new(
        secret.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    segments.append(_b64url_encode(signature))
    return ".".join(segments)


def verify_token(token: str, secret: str) -> dict | None:
    """JWT를 검증하고 payload를 반환한다. 유효하지 않으면 None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        signing_input = f"{parts[0]}.{parts[1]}"
        expected_sig = hmac.new(
            secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(parts[2])

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(parts[1]))

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)
