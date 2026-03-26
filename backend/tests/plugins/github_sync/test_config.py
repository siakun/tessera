"""GitHubSync Settings 파싱 유닛 테스트."""

import pytest

from backend.plugins.github_sync.config import Settings, try_load_settings


class TestSettings:
    def test_parse_full_config(self, sample_config):
        s = Settings(sample_config)
        assert s.github_token == "ghp_test1234567890"
        assert s.github_webhook_secret == "secret123"
        assert len(s.github_accounts) == 2
        assert s.notion_token == "ntn_test1234567890"
        assert s.notion_database_id == "abc-def-123"
        assert s.notion_prop_name == "Name"
        assert s.notion_prop_repo_id == "repository-id"
        assert s.visibility_label_error == "Error"

    def test_parse_minimal_config(self, minimal_config):
        s = Settings(minimal_config)
        assert s.github_token == "ghp_minimal"
        assert s.github_webhook_secret == ""  # 기본값
        assert s.notion_prop_name == "Name"  # 기본값
        assert s.visibility_label_error == "Error"  # 기본값

    def test_missing_github_token_raises(self):
        with pytest.raises(KeyError):
            Settings({"github": {}, "notion": {"token": "x", "database_id": "y"}})

    def test_get_accounts(self, sample_config):
        s = Settings(sample_config)
        accounts = s.get_accounts()
        assert len(accounts) == 2
        assert accounts[0] == {"name": "testuser", "type": "user", "label": "Personal"}
        assert accounts[1] == {"name": "testorg", "type": "org", "label": "Work"}

    def test_get_account_label_found(self, sample_config):
        s = Settings(sample_config)
        assert s.get_account_label("testuser") == "Personal"
        assert s.get_account_label("testorg") == "Work"

    def test_get_account_label_not_found(self, sample_config):
        s = Settings(sample_config)
        assert s.get_account_label("unknown") is None

    def test_default_property_names(self):
        config = {
            "github": {"token": "t", "accounts": [{"name": "u", "label": "l"}]},
            "notion": {"token": "t", "database_id": "d"},
        }
        s = Settings(config)
        assert s.notion_prop_name == "Name"
        assert s.notion_prop_url == "URL"
        assert s.notion_prop_commit_count == "Commit Count"


class TestTryLoadSettings:
    def test_returns_none_when_no_config(self, monkeypatch):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config", lambda: {}
        )
        assert try_load_settings() is None

    def test_returns_none_when_missing_keys(self, monkeypatch):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config",
            lambda: {"github": {}},
        )
        assert try_load_settings() is None

    def test_returns_settings_when_valid(self, monkeypatch, sample_config):
        monkeypatch.setattr(
            "backend.plugins.github_sync.config.get_raw_config",
            lambda: sample_config,
        )
        result = try_load_settings()
        assert result is not None
        assert result.github_token == "ghp_test1234567890"
