"""GitHub Sync 플러그인 라우터 엔드포인트 테스트."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app, STATIC_DIR
from backend.core.auth.jwt_utils import create_token

client = TestClient(app)
# 테스트용 세션 쿠키 설정 (conftest에서 auth를 우회하지만 미들웨어가 쿠키를 검증)
_token = create_token({"email": "test@test.com"}, "test-jwt-secret", 3600)
client.cookies.set("tessera_session", _token)

has_static = (STATIC_DIR / "index.html").exists()


class Test플러그인엔드포인트:
    def test_헬스체크_응답(self):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "version" not in data
        assert "plugins" not in data

    def test_플러그인_목록_조회(self):
        res = client.get("/api/plugins")
        assert res.status_code == 200
        plugins = res.json()["plugins"]
        assert len(plugins) >= 1
        assert plugins[0]["id"] == "github-sync"
        assert "api_prefix" in plugins[0]

    def test_설정_상태_조회(self):
        res = client.get("/api/plugins/github-sync/status")
        assert res.status_code == 200
        assert "configured" in res.json()

    def test_미설정시_대시보드_configured_False(self):
        res = client.get("/api/plugins/github-sync/dashboard")
        assert res.status_code == 200
        assert res.json()["configured"] is False

    def test_초기_로그_빈_배열(self):
        res = client.get("/api/plugins/github-sync/sync/logs")
        assert res.status_code == 200
        assert res.json()["logs"] == []

    def test_미설정시_동기화_트리거_503(self):
        res = client.post("/api/plugins/github-sync/sync/trigger")
        assert res.status_code == 503

    def test_설정파일_없으면_404(self):
        res = client.get("/api/plugins/github-sync/settings")
        assert res.status_code == 404

    @pytest.mark.skipif(not has_static, reason="backend/static/ 빌드 출력물 없음 (CI 환경)")
    def test_알수없는_경로는_SPA_index_html(self):
        res = client.get("/some-random-path")
        assert res.status_code == 200
        assert "<!doctype html>" in res.text.lower()
