"""공통 테스트 fixture."""

import pytest


@pytest.fixture
def sample_config():
    """유효한 config.toml 구조의 샘플 dict."""
    return {
        "github": {
            "token": "ghp_test1234567890",
            "webhook_secret": "secret123",
            "accounts": [
                {"name": "testuser", "type": "user", "label": "Personal"},
                {"name": "testorg", "type": "org", "label": "Work"},
            ],
        },
        "notion": {
            "token": "ntn_test1234567890",
            "database_id": "abc-def-123",
            "properties": {
                "name": "Name",
                "url": "URL",
                "description": "Description",
                "last_commit": "Last Commit",
                "commit_count": "Commit Count",
                "visibility": "Visibility",
                "repo_id": "repository-id",
            },
        },
        "visibility": {
            "error": "Error",
        },
    }


@pytest.fixture
def minimal_config():
    """필수 키만 있는 최소 config dict."""
    return {
        "github": {
            "token": "ghp_minimal",
            "accounts": [{"name": "user1", "label": "Me"}],
        },
        "notion": {
            "token": "ntn_minimal",
            "database_id": "db-id",
        },
    }
