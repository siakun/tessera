"""
Core 플러그인 API.

등록된 플러그인 목록을 반환하는 엔드포인트.
프론트엔드가 이 API를 호출하여 설치된 플러그인을 파악한다.
"""

from fastapi import APIRouter

from backend.core.plugin_registry import get_registered

router = APIRouter(tags=["core"])


@router.get("/api/plugins")
async def list_plugins():
    """등록된 플러그인 매니페스트 목록을 반환한다."""
    return {"plugins": get_registered()}
