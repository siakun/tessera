"""GitHub Sync 플러그인 라우터 엔드포인트 테스트."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


class TestPluginEndpoints:
    def test_health(self):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "github-sync" in data["plugins"]

    def test_list_plugins(self):
        res = client.get("/api/plugins")
        assert res.status_code == 200
        plugins = res.json()["plugins"]
        assert len(plugins) >= 1
        assert plugins[0]["id"] == "github-sync"
        assert "api_prefix" in plugins[0]

    def test_plugin_status(self):
        res = client.get("/api/plugins/github-sync/status")
        assert res.status_code == 200
        assert "configured" in res.json()

    def test_plugin_dashboard_unconfigured(self):
        res = client.get("/api/plugins/github-sync/dashboard")
        assert res.status_code == 200
        assert res.json()["configured"] is False

    def test_plugin_logs_empty(self):
        res = client.get("/api/plugins/github-sync/sync/logs")
        assert res.status_code == 200
        assert res.json()["logs"] == []

    def test_sync_trigger_requires_config(self):
        res = client.post("/api/plugins/github-sync/sync/trigger")
        assert res.status_code == 503

    def test_settings_requires_file(self):
        res = client.get("/api/plugins/github-sync/settings")
        assert res.status_code == 404

    def test_spa_fallback(self):
        res = client.get("/some-random-path")
        assert res.status_code == 200
        assert "<!doctype html>" in res.text.lower()
