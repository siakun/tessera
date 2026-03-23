# notion-automate

GitHub 리포지토리 정보를 Notion 데이터베이스에 자동으로 동기화하는 웹훅 서버

## 기능

- **전체 동기화** - Notion 버튼 클릭 시 모든 리포지토리를 Notion DB에 동기화
- **단일 동기화** - Notion DB 행의 버튼 클릭 시 해당 리포만 업데이트
- **Push 자동 반영** - GitHub main 브랜치 push 시 자동으로 Notion 업데이트
- **오류 표시** - `repository-id`로 매칭할 수 없는 행을 설정된 오류 라벨로 표시

## 기술 스택

- Python 3.12 + FastAPI
- httpx (비동기 HTTP 클라이언트)
- uvicorn (ASGI 서버)
- TOML 설정 파일 (Python 3.11+ 내장 `tomllib`)

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 서버 상태 확인 |
| POST | `/webhook/sync-all` | 전체 리포지토리 동기화 |
| POST | `/webhook/sync-one` | 단일 리포지토리 동기화 |
| POST | `/webhook/github-push` | GitHub push 이벤트 수신 |

## 빠른 시작

### 로컬 실행

```bash
cd github-repository-automate
pip install -r requirements.txt
cp config.example.toml config.toml  # 토큰 등 설정 편집
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Docker 실행

```bash
cd github-repository-automate
cp config.example.toml config.toml  # 토큰 등 설정 편집
docker compose up -d
```

## 설정

모든 설정은 `config.toml`에서 관리합니다. `config.example.toml`을 복사하여 시작하세요.

```toml
[github]
token = "ghp_xxxxxxxxxxxx"
webhook_secret = ""

# 각 계정에 name, label을 지정합니다. 조직은 type = "org"을 추가합니다.
[[github.accounts]]
name = "your-username"
label = "Personal"

[[github.accounts]]
name = "your-org"
type = "org"
label = "Organization"

[notion]
token = "ntn_xxxxxxxxxxxx"
database_id = "your_database_id_here"

# Notion DB 속성명 (기본값)
[notion.properties]
name = "Name"
url = "URL"
description = "Description"
last_commit = "Last Commit"
commit_count = "Commit Count"
visibility = "Visibility"
repo_id = "repository-id"

# 매칭 불가 행의 라벨
[visibility]
error = "Error"
```

### GitHub 계정 설정

각 계정에 `name`과 `label`을 지정합니다. 조직 계정은 `type = "org"`을 추가합니다:
```toml
[[github.accounts]]
name = "my-user"
label = "Personal"

[[github.accounts]]
name = "my-org"
type = "org"
label = "Work"
```

## Notion 버튼 설정

### "전체 동기화" 버튼
1. Notion 페이지에 버튼 블록 추가
2. 자동화 편집 → 작업 추가 → **웹훅 보내기**
3. URL: `https://your-domain/webhook/sync-all`

### "단일 동기화" 버튼 (행별)
1. 데이터베이스에 버튼 속성 추가
2. 자동화 편집 → 작업 추가 → **웹훅 보내기**
3. URL: `https://your-domain/webhook/sync-one`

### GitHub Push Webhook
1. 리포/조직 → Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain/webhook/github-push`
3. Content type: `application/json`
4. Secret: config.toml의 `webhook_secret`과 동일한 값
5. Events: **Just the push event**

## API 문서

서버 실행 시 자동으로 제공됩니다:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
