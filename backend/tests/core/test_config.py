"""Core config 로드/저장 유닛 테스트."""

import tomllib

from backend.core import config as config_module
from backend.core.config import try_load_config, get_raw_config, get_sections, update_raw_config
from backend.core.toml_writer import write_config_toml


class TestConfigToml로드:
    def test_유효한_TOML_파일_정상_로드(self, tmp_path, sample_config, monkeypatch):
        toml_path = tmp_path / "config.toml"
        write_config_toml(sample_config, toml_path)
        monkeypatch.setattr(config_module, "CONFIG_PATH", toml_path)

        result = try_load_config()
        assert result is not None
        assert result["github"]["token"] == "ghp_test1234567890"

    def test_파일_없으면_None_반환(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config_module, "CONFIG_PATH", tmp_path / "nonexistent.toml")
        assert try_load_config() is None

    def test_잘못된_TOML_형식이면_None_반환(self, tmp_path, monkeypatch):
        toml_path = tmp_path / "config.toml"
        toml_path.write_text("invalid = [toml content", encoding="utf-8")
        monkeypatch.setattr(config_module, "CONFIG_PATH", toml_path)
        assert try_load_config() is None


class TestConfig섹션필터:
    def test_요청한_섹션만_반환(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {
            "github": {"token": "t"},
            "notion": {"token": "n"},
            "visibility": {"error": "E"},
        })
        result = get_sections("github", "notion")
        assert "github" in result
        assert "notion" in result
        assert "visibility" not in result

    def test_존재하지_않는_섹션_요청시_빈_dict(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {"github": {"token": "t"}})
        result = get_sections("nonexistent")
        assert result == {}


class TestConfig업데이트:
    def test_기존_설정에_병합(self, monkeypatch):
        monkeypatch.setattr(config_module, "_raw_config", {"a": 1})
        update_raw_config({"b": 2})
        assert get_raw_config() == {"a": 1, "b": 2}


class TestToml저장_라운드트립:
    def test_저장_후_다시_읽으면_동일(self, tmp_path, sample_config):
        path = tmp_path / "config.toml"
        write_config_toml(sample_config, path)

        with open(path, "rb") as f:
            loaded = tomllib.load(f)

        assert loaded["github"]["token"] == sample_config["github"]["token"]
        assert loaded["notion"]["database_id"] == sample_config["notion"]["database_id"]
        assert loaded["visibility"]["error"] == "Error"

    def test_계정_목록_보존(self, tmp_path, sample_config):
        path = tmp_path / "config.toml"
        write_config_toml(sample_config, path)

        with open(path, "rb") as f:
            loaded = tomllib.load(f)

        assert len(loaded["github"]["accounts"]) == 2
        assert loaded["github"]["accounts"][0]["name"] == "testuser"

    def test_특수문자_이스케이프_처리(self, tmp_path):
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
