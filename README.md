# notion-automate

GitHub repository information is automatically synced to a Notion database via webhook server.

## Features

- **Full Sync** - Sync all repositories to Notion DB via Notion button click
- **Single Sync** - Update a specific repository via per-row Notion button
- **Auto Sync on Push** - Automatically update Notion when pushing to main branch (GitHub Webhook)
- **Error Marking** - Mark unmatched rows (missing `repository-id`) with configurable error label

## Tech Stack

- Python 3.12 + FastAPI
- httpx (async HTTP client)
- uvicorn (ASGI server)
- TOML configuration (Python 3.11+ built-in `tomllib`)

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/webhook/sync-all` | Sync all repositories |
| POST | `/webhook/sync-one` | Sync a single repository |
| POST | `/webhook/github-push` | Receive GitHub push event |

## Quick Start

### Local

```bash
cd github-repository-automate
pip install -r requirements.txt
cp config.example.toml config.toml  # Edit with your tokens
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
cd github-repository-automate
cp config.example.toml config.toml  # Edit with your tokens
docker compose up -d
```

## Configuration

All settings are in `config.toml`. Copy `config.example.toml` to get started.

```toml
[server]
port = 8000

[github]
token = "ghp_xxxxxxxxxxxx"
webhook_secret = ""
sources = ["your-username", "org:your-org-name"]

[notion]
token = "ntn_xxxxxxxxxxxx"
database_id = "your_database_id_here"

# Notion DB property name overrides (defaults shown)
[notion.properties]
name = "Name"
url = "URL"
description = "Description"
last_commit = "Last Commit"
commit_count = "Commit Count"
visibility = "Visibility"
repo_id = "repository-id"

# Visibility labels
[visibility]
public = "Public"
private = "Private"
error = "Error"

# Organization-specific visibility labels
[visibility.map]
my-testing-org = "Testing"
my-archive-org = "Archive"
```

### GitHub Sources

Prefix `org:` for organization repositories:
```toml
sources = ["my-user", "org:my-org", "org:another-org"]
```

### Visibility Map

Map specific organizations to custom labels instead of the default Public/Private:
```toml
[visibility.map]
my-testing-org = "Testing"
my-archive-org = "Archive"
```

## Notion Button Setup

### "Sync All" Button
1. Add a button block to your Notion page
2. Edit automation → Add action → **Send webhook**
3. URL: `https://your-domain/webhook/sync-all`

### "Sync One" Button (per-row)
1. Add a button property to your database
2. Edit automation → Add action → **Send webhook**
3. URL: `https://your-domain/webhook/sync-one`

### GitHub Push Webhook
1. Go to your repo/org → Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain/webhook/github-push`
3. Content type: `application/json`
4. Secret: same as `webhook_secret` in config.toml
5. Events: **Just the push event**

## Swagger UI

API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
