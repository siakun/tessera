"""Core config 로드/저장 유닛 테스트."""

import tomllib

import pytest

from backend.core import config as config_module
from backend.core.config import try_load_config, get_raw_config, get_sections, update_raw_config
from backend.core.toml_writer import write_config_toml


class TestTryLoadConfig:
    def test_load_valid_toml(self, tmp_path, sample_config, monkeypatch):
        toml_path = tmp_path / "config.toml"
        write_config_toml(sample_config, toml_path)
        monkeypatch.setattr(config_module, "CONFIG_PATH", toml_path)

        result = try_load_config()
        assert result is not None
        assert result["github"]["token"] == "ghp_test1234567890"

    def test_load_missing_file(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config_module, "CONFIG_PATH", tmp_path / "nonexistent.toml")
        assert try_load_config() is None

    def test_load_invalid_toml(self, tmp_path, monkeypatch):
        toml_path = tmp_path / "config.toml"
        toml_path.write_text("invalid = [toml content", encoding="utf-8")
        monkeypatch.setattr(config_module, "CONFIG_PATH", toml_path)
        assert try_load_config() is None


class TestGetSections:
    def test_filter_existing_sections(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {
            "github": {"token": "t"},
            "notion": {"token": "n"},
            "visibility": {"error": "E"},
        })
        result = get_sections("github", "notion")
        assert "github" in result
        assert "notion" in result
        assert "visibility" not in result

    def test_filter_nonexistent_section(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {"github": {"token": "t"}})
        result = get_sections("nonexistent")
        assert result == {}


class TestUpdateRawConfig:
    def test_update_merges(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {"a": 1})
        update_raw_config({"b": 2})
        assert get_raw_config() == {"a": 1, "b": 2}


class TestTomlWriterRoundtrip:
    def test_write_and_read_back(self, tmp_path, sample_config):
        path = tmp_path / "config.toml"
        write_config_toml(sample_config, path)

        with open(path, "rb") as f:
            loaded = tomllib.load(f)

        assert loaded["github"]["token"] == sample_config["github"]["token"]
        assert loaded["notion"]["database_id"] == sample_config["notion"]["database_id"]
        assert loaded["visibility"]["error"] == "Error"

    def test_roundtrip_preserves_accounts(self, tmp_path, sample_config):
        path = tmp_path / "config.toml"
        write_config_toml(sample_config, path)

        with open(path, "rb") as f:
            loaded = tomllib.load(f)

        assert len(loaded["github"]["accounts"]) == 2
        assert loaded["github"]["accounts"][0]["name"] == "testuser"

    def test_special_characters_escaped(self, tmp_path):
        config = {
            "github": {
                "token": 'token_with"quotes',
                "accounts": [{"name": "user", "label": "test\\path"}],
            },
            "notion": {"token": "t", "database_id": "d"},
        }
        path = tmp_path / "config.toml"
        write_config_toml(config, path)

        with open(path, "rb") as f:
            loaded = tomllib.load(f)

        assert loaded["github"]["token"] == 'token_with"quotes'
