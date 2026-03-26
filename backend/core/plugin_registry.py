"""
플러그인 자동 발견 엔진.

backend/plugins/ 디렉토리를 스캔하여 PLUGIN_MANIFEST가 있는 패키지를
자동으로 등록한다. 각 플러그인의 라우터는 /api/plugins/{id} 접두사로
마운트된다.
"""

import importlib
import logging
import pkgutil

from fastapi import FastAPI

logger = logging.getLogger(__name__)

_registered: list[dict] = []


def discover_plugins(app: FastAPI):
    """backend/plugins/ 디렉토리를 스캔하여 플러그인을 자동 등록한다."""
    from backend import plugins as plugins_pkg

    _registered.clear()

    for _, name, ispkg in pkgutil.iter_modules(plugins_pkg.__path__):
        if not ispkg:
            continue

        try:
            module = importlib.import_module(f"backend.plugins.{name}")
            manifest = getattr(module, "PLUGIN_MANIFEST", None)

            if manifest is None:
                logger.warning("플러그인 %s: PLUGIN_MANIFEST 없음, 건너뜀", name)
                continue

            # 라우터 등록
            router = module.get_router()
            prefix = f"/api/plugins/{manifest['id']}"
            app.include_router(router, prefix=prefix, tags=[manifest["name"]])

            # 플러그인 초기화 (설정 로드 등)
            on_startup = getattr(module, "on_startup", None)
            if on_startup:
                on_startup()

            _registered.append({**manifest, "api_prefix": prefix})
            logger.info("플러그인 등록: %s (%s)", manifest["name"], prefix)

        except Exception:
            logger.exception("플러그인 %s 로드 실패", name)


def get_registered() -> list[dict]:
    """등록된 플러그인 매니페스트 목록을 반환한다."""
    return list(_registered)
