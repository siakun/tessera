"""GitHubSync Settings 파싱 유닛 테스트."""

import pytest

from backend.plugins.github_sync.config import Settings, try_load_settings


class TestSettings파싱:
    def test_전체_설정_정상_파싱(self, sample_config):
        s = Settings(sample_config)
        assert s.github_token == "ghp_test1234567890"
        assert s.github_webhook_secret == "secret123"
        assert len(s.github_accounts) == 2
        assert s.notion_token == "ntn_test1234567890"
        assert s.notion_database_id == "abc-def-123"
        assert s.notion_prop_name == "Name"
        assert s.notion_prop_repo_id == "repository-id"
        assert s.visibility_label_error == "Error"

    def test_최소_설정_기본값_폴백(self, minimal_config):
        s = Settings(minimal_config)
        assert s.github_token == "ghp_minimal"
        assert s.github_webhook_secret == ""
        assert s.notion_prop_name == "Name"
        assert s.visibility_label_error == "Error"

    def test_필수_키_누락시_KeyError(self):
        with pytest.raises(KeyError):
            Settings({"github": {}, "notion": {"token": "x", "database_id": "y"}})

    def test_계정_목록_포맷팅(self, sample_config):
        s = Settings(sample_config)
        accounts = s.get_accounts()
        assert len(accounts) == 2
        assert accounts[0] == {"name": "testuser", "type": "user", "label": "Personal"}
        assert accounts[1] == {"name": "testorg", "type": "org", "label": "Work"}

    def test_계정_라벨_조회_성공(self, sample_config):
        s = Settings(sample_config)
        assert s.get_account_label("testuser") == "Personal"
        assert s.get_account_label("testorg") == "Work"

    def test_존재하지_않는_계정_라벨_None(self, sample_config):
        s = Settings(sample_config)
        assert s.get_account_label("unknown") is None

    def test_속성명_기본값(self):
        config = {
            "github": {"token": "t", "accounts": [{"name": "u", "label": "l"}]},
            "notion": {"token": "t", "database_id": "d"},
        }
        s = Settings(config)
        assert s.notion_prop_name == "Name"
        assert s.notion_prop_url == "URL"
        assert s.notion_prop_commit_count == "Commit Count"


class TestSettings로드:
    def test_빈_config면_None(self, monkeypatch):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config", lambda: {}
        )
        assert try_load_settings() is None

    def test_필수_키_없으면_None(self, monkeypatch):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config",
            lambda: {"github": {}},
        )
        assert try_load_settings() is None

    def test_유효한_설정이면_Settings_반환(self, monkeypatch, sample_config):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config",
            lambda: sample_config,
        )
        result = try_load_settings()
        assert result is not None
        assert result.github_token == "ghp_test1234567890"
