# Tessera Architecture Guide

NAS Docker 기반 자동화 플랫폼. 단일 컨테이너(FastAPI + React SPA)로 구동되며, **플러그인 기반 모놀리스** 아키텍처를 따른다.

## 핵심 원칙

**Core는 플러그인이 뭔지 모른다. 플러그인이 자기 자신을 등록한다.**

새 자동화 서비스 추가 = `backend/plugins/` 패키지 + `frontend/src/plugins/` 폴더 + `registry.js` 1줄. Core 코드 수정 0줄.

## 기술 스택

- **Backend**: Python 3.12, FastAPI, httpx, uvicorn
- **Frontend**: React 19, Vite 8, Tailwind CSS 4
- **배포**: Docker (multi-stage build), GitHub Actions → GHCR

## 프론트엔드 MVVM 패턴

WPF MVVM을 React에 매핑한 교육 레퍼런스 프로젝트. 모든 컴포넌트는 이 규칙을 따른다:

| MVVM | React | 위치 규칙 |
|---|---|---|
| **View** (XAML) | Component (JSX) | `components/`, `features/*/components/`, `plugins/*/components/` |
| **ViewModel** (C# class) | Custom Hook | `hooks/`, `features/*/hooks/`, `plugins/*/hooks/` |
| **Model** (Service) | API Client | `shared/api/client.js` → `pluginApi()` |

**컴포넌트에 비즈니스 로직을 넣지 않는다.** useState, useEffect, fetch, 데이터 가공은 반드시 Custom Hook에 둔다. 컴포넌트는 Hook이 반환하는 상태와 핸들러만 사용하여 렌더링한다.

## 디렉토리 구조 설계

```
tessera/
├── backend/                          # FastAPI 서버
│   ├── main.py                       # 엔트리포인트: plugin discovery + SPA 서빙
│   ├── core/                         # 플러그인-불가지론 인프라
│   │   ├── config.py                 # config.toml 로더 (섹션 기반, 전체 raw dict 보관)
│   │   ├── state.py                  # CoreState: 플러그인별 상태 레지스트리
│   │   ├── plugin_registry.py        # discover_plugins(): pkgutil 스캔 → 라우터 자동 마운트
│   │   └── toml_writer.py            # TOML 직렬화 유틸
│   ├── routers/                      # Core 전용 API
│   │   └── plugins.py                # GET /api/plugins
│   └── plugins/                      # 자동 발견 대상 패키지들
│       └── github_sync/              # 첫 번째 플러그인
│
├── frontend/src/
│   ├── app/                          # (예약) 향후 App.jsx 이동 대상
│   ├── plugins/                      # 플러그인 UI 모듈
│   │   ├── registry.js               # 유일한 등록 지점
│   │   └── {plugin-id}/              # 플러그인별 폴더
│   │       ├── manifest.js           # id, name, tabs[], setupWizard, dashboardWidget
│   │       ├── components/           # View
│   │       └── hooks/                # ViewModel
│   ├── features/                     # Core UI 기능 (플러그인 아님)
│   │   ├── dashboard/                # 통합 대시보드
│   │   └── logs/                     # 통합 로그 뷰어
│   └── shared/                       # 크로스-플러그인 공유
│       ├── api/client.js             # request(), pluginApi(id), coreApi
│       ├── components/               # Spinner, Field, SummaryRow, StatusMessage 등
│       ├── hooks/                    # useNotice 등
│       ├── constants/                # PROPERTY_FIELDS, createEmptyAccount 등
│       └── utils/                    # formatters 등
```

## 백엔드 플러그인 계약

`backend/plugins/` 하위의 Python 패키지가 자동 발견 대상이다. 각 패키지는 다음을 구현해야 한다:

**`__init__.py` 필수 요소:**
```python
PLUGIN_MANIFEST = {
    "id": "plugin-id",           # API prefix에 사용: /api/plugins/{id}/
    "name": "표시 이름",
    "description": "설명",
    "version": "1.0.0",
    "config_sections": [...],    # 이 플러그인이 소유하는 config.toml 최상위 섹션
    "has_setup": True,
}

def get_router():                # FastAPI APIRouter 반환 (prefix 없이)
    from .router import router
    return router

def on_startup():                # (선택) 앱 시작 시 설정 로드 등 초기화
    ...
```

**`router.py`**: prefix 없는 APIRouter. Core가 `/api/plugins/{id}` prefix를 자동 마운트한다.

**`config.py`**: `backend.core.config.get_raw_config()`에서 자기 섹션만 파싱하는 Settings 클래스 + `settings` 모듈 싱글턴.

**`state.py`**: 플러그인 전용 상태 dataclass + `plugin_state` 모듈 싱글턴.

## 프론트엔드 플러그인 계약

`frontend/src/plugins/registry.js`에 등록된 매니페스트가 플러그인을 정의한다.

**`manifest.js` 필수 요소:**
```js
export default {
  id: 'plugin-id',              // 백엔드 PLUGIN_MANIFEST.id와 일치
  name: '표시 이름',
  tabs: [{                      // 메인 네비게이션에 추가될 탭
    key: 'unique-tab-key',
    label: '탭 이름',
    component: lazy(() => import('./components/SomeTab')),
  }],
  setupWizard: lazy(() => ...),   // 미설정 시 표시
  dashboardWidget: lazy(() => ...), // 대시보드 위젯
}
```

**`registry.js`에 등록:**
```js
import myPlugin from './my-plugin'
const plugins = [myPlugin]
```

## API 라우팅 규칙

- Core API: `/api/plugins`, `/health`
- Plugin API: `/api/plugins/{plugin-id}/*` (자동 prefix)
- 프론트엔드: `pluginApi('plugin-id').get('/path')` → `/api/plugins/plugin-id/path`

## Config 소유권

`config.toml`의 각 최상위 섹션은 하나의 플러그인이 소유한다. `PLUGIN_MANIFEST.config_sections`에 선언한 섹션만 읽고 쓴다. 다른 플러그인의 섹션에 접근하지 않는다.

## 빌드 파이프라인

- `cd frontend && npm run build` → `backend/static/`에 SPA 빌드 출력
- FastAPI가 `backend/static/`을 서빙 (SPA fallback: 모든 비-API 경로 → index.html)
- Dockerfile: Node Stage(프론트 빌드) → Python Stage(백엔드 + 빌드 결과 복사)
- `uvicorn backend.main:app --host 0.0.0.0 --port 8000`

## 상태 관리 단계적 도입 기준

| 시점 | 도구 |
|---|---|
| 컴포넌트 내부 | `useState` (기본) |
| 컴포넌트 간 공유 (1-2단계) | Lifting State Up (props) |
| prop drilling 3단계 이상 + 드문 변경 | Context API |
| 빈번한 변경 + 다수 플러그인 간 공유 | Zustand (미도입, 필요 시) |

## 하지 않는 것

- Microservices (NAS Docker 단일 컨테이너)
- React Router (탭 수준에 과함)
- Redux (보일러플레이트 과함, Zustand 우선)
- TypeScript (별도 이니셔티브)
- Testing framework (별도 이니셔티브)
- Feature 내부 types/store/ 세분화 (파일 2-3개면 flat 유지)
