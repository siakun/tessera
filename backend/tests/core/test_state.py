"""CoreState 유닛 테스트."""

from backend.core.state import CoreState


class TestCoreState:
    def test_초기_상태는_빈_플러그인_목록(self):
        state = CoreState()
        assert state.configured_plugins == []
        assert state.has_any_configured is False

    def test_플러그인_상태_등록_후_조회(self):
        state = CoreState()
        state.set_plugin_state("github-sync", {"status": "ok"})
        assert state.get_plugin_state("github-sync") == {"status": "ok"}

    def test_미등록_플러그인_조회시_None(self):
        state = CoreState()
        assert state.get_plugin_state("nonexistent") is None

    def test_플러그인_등록_후_has_any_configured_True(self):
        state = CoreState()
        state.configured_plugins.append("github-sync")
        assert state.has_any_configured is True

    def test_여러_플러그인_독립_상태_관리(self):
        state = CoreState()
        state.set_plugin_state("a", 1)
        state.set_plugin_state("b", 2)
        assert state.get_plugin_state("a") == 1
        assert state.get_plugin_state("b") == 2
