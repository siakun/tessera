"""
Core 설정 관리 모듈.

config.toml 파일을 로드하여 raw dict로 보관한다.
각 플러그인은 get_raw_config()으로 전체 설정을 읽고,
자기 섹션만 파싱하여 사용한다.
"""

import logging
import tomllib
from pathlib import Path

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config.toml"

_raw_config: dict = {}


def try_load_config() -> dict | None:
    """config.toml을 로드하여 raw dict로 반환한다. 실패 시 None."""
    global _raw_config

    if not CONFIG_PATH.exists():
        logger.warning("config.toml 없음: %s", CONFIG_PATH)
        return None

    try:
        with open(CONFIG_PATH, "rb") as f:
            _raw_config = tomllib.load(f)
        return _raw_config
    except (tomllib.TOMLDecodeError, OSError) as e:
        logger.warning("config.toml 파싱 실패: %s", e)
        return None


def get_raw_config() -> dict:
    """전체 설정 dict를 반환한다."""
    return _raw_config


def get_sections(*section_names: str) -> dict:
    """지정된 섹션만 포함하는 dict를 반환한다."""
    return {key: _raw_config[key] for key in section_names if key in _raw_config}


def update_raw_config(data: dict):
    """설정을 업데이트한다. 플러그인이 setup/save 시 호출."""
    global _raw_config
    _raw_config.update(data)
