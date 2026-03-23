"""
설정 마법사 API.

초기 설정이 없을 때 브라우저에서 GitHub/Notion 토큰을 입력하고
연결 테스트 후 config.toml을 생성하는 엔드포인트.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import config
from app.config import CONFIG_PATH, try_load_config
from app.state import app_state
from app.toml_writer import write_config_toml

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/setup", tags=["setup"])


@router.get("/status")
async def setup_status():
    """설정 완료 여부를 반환한다."""
    return {"configured": app_state.configured}


class TestGitHubRequest(BaseModel):
    token: str


@router.post("/test-github")
async def test_github(req: TestGitHubRequest):
    """GitHub 토큰을 검증하고 인증된 사용자 정보를 반환한다."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {req.token}",
                "Accept": "application/vnd.github+json",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(400, "GitHub 토큰이 유효하지 않습니다.")
    user = resp.json()
    return {"login": user["login"], "name": user.get("name")}


class TestGitHubAccountRequest(BaseModel):
    token: str
    name: str
    type: str = "user"


@router.post("/test-github-account")
async def test_github_account(req: TestGitHubAccountRequest):
    """GitHub 계정(유저/조직)의 리포지토리 목록을 미리보기한다."""
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        if req.type == "org":
            resp = await client.get(
                f"https://api.github.com/orgs/{req.name}/repos",
                headers=headers,
                params={"per_page": 5},
            )
        else:
            resp = await client.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={"per_page": 5, "affiliation": "owner"},
            )
    if resp.status_code != 200:
        raise HTTPException(400, f"계정 '{req.name}'을 찾을 수 없거나 접근 권한이 없습니다.")
    repos = resp.json()
    return {
        "repos": [r["full_name"] for r in repos[:5]],
        "count_preview": len(repos),
    }


class TestNotionRequest(BaseModel):
    token: str
    database_id: str


@router.post("/test-notion")
async def test_notion(req: TestNotionRequest):
    """Notion 토큰과 DB ID를 검증하고 DB 속성 목록을 반환한다."""
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Notion-Version": "2022-06-28",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"https://api.notion.com/v1/databases/{req.database_id}",
            headers=headers,
        )
    if resp.status_code != 200:
        raise HTTPException(400, "Notion 토큰 또는 데이터베이스 ID가 유효하지 않습니다.")
    db = resp.json()
    title_arr = db.get("title", [])
    title = title_arr[0].get("plain_text", "") if title_arr else ""
    properties = {name: prop["type"] for name, prop in db.get("properties", {}).items()}
    return {"title": title, "properties": properties}


class SaveConfigRequest(BaseModel):
    github_token: str
    github_webhook_secret: str = ""
    github_accounts: list[dict]
    notion_token: str
    notion_database_id: str
    notion_properties: dict
    visibility_error: str = "Error"


@router.post("/save")
async def save_config(req: SaveConfigRequest):
    """config.toml을 저장하고 설정을 리로드한다."""
    data = {
        "github": {
            "token": req.github_token,
            "webhook_secret": req.github_webhook_secret,
            "accounts": req.github_accounts,
        },
        "notion": {
            "token": req.notion_token,
            "database_id": req.notion_database_id,
            "properties": req.notion_properties,
        },
        "visibility": {
            "error": req.visibility_error,
        },
    }
    write_config_toml(data, CONFIG_PATH)

    loaded = try_load_config()
    if loaded is None:
        raise HTTPException(500, "설정 저장 후 로드에 실패했습니다.")
    config.settings = loaded
    app_state.configured = True
    logger.info("config.toml 저장 및 리로드 완료")
    return {"status": "ok", "message": "설정이 저장되었습니다."}
