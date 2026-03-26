"""CoreState 유닛 테스트."""

from backend.core.state import CoreState


class TestCoreState:
    def test_initial_state(self):
        state = CoreState()
        assert state.configured_plugins == []
        assert state.has_any_configured is False

    def test_set_and_get_plugin_state(self):
        state = CoreState()
        state.set_plugin_state("github-sync", {"status": "ok"})
        assert state.get_plugin_state("github-sync") == {"status": "ok"}

    def test_get_unregistered_plugin_returns_none(self):
        state = CoreState()
        assert state.get_plugin_state("nonexistent") is None

    def test_has_any_configured(self):
        state = CoreState()
        state.configured_plugins.append("github-sync")
        assert state.has_any_configured is True

    def test_multiple_plugins(self):
        state = CoreState()
        state.set_plugin_state("a", 1)
        state.set_plugin_state("b", 2)
        assert state.get_plugin_state("a") == 1
        assert state.get_plugin_state("b") == 2
