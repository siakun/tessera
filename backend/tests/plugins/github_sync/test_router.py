"""GitHub Sync 플러그인 라우터 엔드포인트 테스트."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class Test플러그인엔드포인트:
    def test_헬스체크_응답(self):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "github-sync" in data["plugins"]

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

    def test_알수없는_경로는_SPA_index_html(self):
        res = client.get("/some-random-path")
        assert res.status_code == 200
        assert "<!doctype html>" in res.text.lower()
