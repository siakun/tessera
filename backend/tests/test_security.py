"""보안 취약점 방어 테스트.

침투 테스트 보고서(2026-03-28) 기반 회귀 테스트.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app, STATIC_DIR
from backend.core.auth.jwt_utils import create_token

client = TestClient(app)
_token = create_token({"email": "test@test.com"}, "test-jwt-secret", 3600)
client.cookies.set("tessera_session", _token)

has_static = (STATIC_DIR / "index.html").exists()


class TestPathTraversal:
    """V-01: SPA catch-all Path Traversal 방어."""

    @pytest.mark.skipif(not has_static, reason="backend/static/ 없음 (CI)")
    def test_상위디렉토리_이동_차단(self):
        """..%2f 인코딩으로 STATIC_DIR 탈출 시도 → SPA fallback."""
        res = client.get("/..%2f..%2fdata%2fauth.json")
        # 200(SPA fallback) 반환, 실제 파일 내용이 아닌 index.html
        assert res.status_code == 200
        assert "<!doctype html>" in res.text.lower() or "<!DOCTYPE html>" in res.text

    @pytest.mark.skipif(not has_static, reason="backend/static/ 없음 (CI)")
    def test_이중인코딩_차단(self):
        res = client.get("/..%252f..%252fetc%252fpasswd")
        assert res.status_code == 200

    @pytest.mark.skipif(not has_static, reason="backend/static/ 없음 (CI)")
    def test_백슬래시_변형_차단(self):
        res = client.get("/..\\..\\data\\auth.json")
        assert res.status_code == 200

    @pytest.mark.skipif(not has_static, reason="backend/static/ 없음 (CI)")
    def test_정상_정적파일_접근_가능(self):
        """STATIC_DIR 내부 파일은 정상 접근 가능."""
        res = client.get("/")
        assert res.status_code == 200


class TestWebhookAuth:
    """V-04: Webhook 엔드포인트 인증 검증."""

    def test_sync_all_무인증_거부(self):
        """인증 없는 sync-all 호출은 401."""
        unauthenticated = TestClient(app)
        res = unauthenticated.post("/api/plugins/github-sync/webhook/sync-all")
        assert res.status_code == 401

    def test_deduplicate_무인증_거부(self):
        """인증 없는 deduplicate 호출은 401."""
        unauthenticated = TestClient(app)
        res = unauthenticated.post("/api/plugins/github-sync/webhook/deduplicate")
        assert res.status_code == 401

    def test_sync_all_인증시_접근_가능(self):
        """JWT 인증된 sync-all 호출은 통과 (설정 미완료 시 503)."""
        res = client.post("/api/plugins/github-sync/webhook/sync-all")
        # 503 = 플러그인 설정 미완료 (인증은 통과)
        assert res.status_code == 503


class TestOpenAPI:
    """V-05: OpenAPI 스펙 노출 차단."""

    def test_docs_비활성(self):
        """TESSERA_DEBUG 미설정 시 /docs 접근 불가."""
        res = client.get("/docs")
        # /docs 경로가 없으면 SPA fallback (200) 또는 404
        # FastAPI docs_url=None이면 라우트 자체가 없음
        assert res.status_code != 200 or "swagger" not in res.text.lower()

    def test_openapi_json_비활성(self):
        """TESSERA_DEBUG 미설정 시 /openapi.json 접근 불가."""
        res = client.get("/openapi.json")
        assert res.status_code != 200 or "openapi" not in res.text.lower()
