"""GitHubSyncState 유닛 테스트."""

from backend.plugins.github_sync.state import GitHubSyncState


class TestGitHubSyncState:
    def test_initial_state(self):
        state = GitHubSyncState()
        assert state.configured is False
        assert state.sync_in_progress is False
        assert state.cancel_requested is False
        assert state.last_sync_time is None
        assert state.last_sync_result is None
        assert state.sync_logs == []

    def test_add_log(self):
        state = GitHubSyncState()
        state.add_log({"type": "sync_start", "scope": "all"})
        assert len(state.sync_logs) == 1
        assert state.sync_logs[0]["type"] == "sync_start"
        assert "timestamp" in state.sync_logs[0]

    def test_add_log_max_limit(self):
        state = GitHubSyncState()
        for i in range(150):
            state.add_log({"type": "test", "index": i})
        assert len(state.sync_logs) == state.MAX_LOGS

    def test_add_log_preserves_recent(self):
        state = GitHubSyncState()
        for i in range(150):
            state.add_log({"type": "test", "index": i})
        # 가장 오래된 로그(index=0~49)는 잘리고, 최신(index=50~149)만 남아야 함
        assert state.sync_logs[0]["index"] == 50
        assert state.sync_logs[-1]["index"] == 149

    def test_record_sync(self):
        state = GitHubSyncState()
        result = {"total_repos": 10, "created": 3, "updated": 7}
        state.record_sync(result)
        assert state.last_sync_result == result
        assert state.last_sync_time is not None
        assert len(state.sync_logs) == 1
        assert state.sync_logs[0]["type"] == "sync_complete"

    def test_record_sync_sets_timestamp(self):
        state = GitHubSyncState()
        state.record_sync({"total": 0})
        assert state.last_sync_time > 0
