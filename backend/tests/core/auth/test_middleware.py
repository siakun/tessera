"""인증 미들웨어 테스트."""

from backend.core.auth.middleware import AuthMiddleware


class TestAuth우회경로:
    """_skip_auth: 인증 검증을 건너뛰는 경로."""

    def test_auth_경로_우회(self):
        assert AuthMiddleware._skip_auth("/auth/status") is True
        assert AuthMiddleware._skip_auth("/auth/login") is True

    def test_health_우회(self):
        assert AuthMiddleware._skip_auth("/health") is True

    def test_github_push_webhook_우회(self):
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/webhook/github-push") is True

    def test_정적파일_우회(self):
        assert AuthMiddleware._skip_auth("/") is True
        assert AuthMiddleware._skip_auth("/assets/index.js") is True

    def test_api_경로는_인증_필요(self):
        assert AuthMiddleware._skip_auth("/api/plugins") is False
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/status") is False


class TestWebhook보안:
    """V-04: github-push 외의 webhook은 JWT 인증 필요."""

    def test_sync_all_인증_필요(self):
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/webhook/sync-all") is False

    def test_sync_one_인증_필요(self):
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/webhook/sync-one") is False

    def test_deduplicate_인증_필요(self):
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/webhook/deduplicate") is False

    def test_임의_webhook_경로_인증_필요(self):
        """신규 플러그인의 임의 webhook도 기본적으로 인증 필요."""
        assert AuthMiddleware._skip_auth("/api/plugins/youtube/webhook/push") is False
        assert AuthMiddleware._skip_auth("/api/plugins/foo/webhook/bar") is False

    def test_github_push만_우회(self):
        """github-push 패턴만 JWT 인증을 우회한다."""
        assert AuthMiddleware._skip_auth("/api/plugins/github-sync/webhook/github-push") is True
        assert AuthMiddleware._skip_auth("/api/plugins/other/webhook/github-push") is True


class Test정적파일제외:
    """_is_static: 감사 로그에서 제외할 정적 파일."""

    def test_assets_제외(self):
        assert AuthMiddleware._is_static("/assets/index-abc.js") is True
        assert AuthMiddleware._is_static("/assets/style.css") is True

    def test_정적_확장자_제외(self):
        assert AuthMiddleware._is_static("/favicon.ico") is True
        assert AuthMiddleware._is_static("/favicon.svg") is True

    def test_SSE_스트림_제외(self):
        assert AuthMiddleware._is_static("/api/system/logs/stream") is True

    def test_API_경로는_로그_기록(self):
        assert AuthMiddleware._is_static("/api/plugins") is False
        assert AuthMiddleware._is_static("/api/plugins/github-sync/status") is False
        assert AuthMiddleware._is_static("/api/plugins/github-sync/dashboard") is False

    def test_auth_경로는_로그_기록(self):
        assert AuthMiddleware._is_static("/auth/status") is False
        assert AuthMiddleware._is_static("/auth/login") is False
        assert AuthMiddleware._is_static("/auth/callback") is False

    def test_health는_로그_기록(self):
        assert AuthMiddleware._is_static("/health") is False

    def test_webhook은_로그_기록(self):
        assert AuthMiddleware._is_static("/api/plugins/github-sync/webhook/github-push") is False

    def test_SPA_페이지접근은_로그_기록(self):
        assert AuthMiddleware._is_static("/") is False
        assert AuthMiddleware._is_static("/some-random-path") is False


class Test설계_강제성:
    """새 경로 추가 시 감사 로그가 자동으로 남는 구조 검증."""

    def test_신규_api_경로는_인증_필요하고_로그_기록(self):
        """가상의 새 플러그인 경로도 인증 + 로그 대상."""
        assert AuthMiddleware._skip_auth("/api/plugins/youtube/status") is False
        assert AuthMiddleware._is_static("/api/plugins/youtube/status") is False

    def test_신규_webhook은_기본적으로_인증_필요하고_로그_기록(self):
        """신규 webhook은 기본적으로 인증이 필요하며 감사 로그에 남아야 한다."""
        assert AuthMiddleware._skip_auth("/api/plugins/youtube/webhook/notify") is False
        assert AuthMiddleware._is_static("/api/plugins/youtube/webhook/notify") is False
