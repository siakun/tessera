"""GitHubSyncState 유닛 테스트."""

from backend.plugins.github_sync.state import GitHubSyncState


class TestGitHubSync상태:
    def test_초기_상태_기본값(self):
        state = GitHubSyncState()
        assert state.configured is False
        assert state.sync_in_progress is False
        assert state.cancel_requested is False
        assert state.last_sync_time is None
        assert state.last_sync_result is None
        assert state.sync_logs == []

    def test_로그_추가시_타임스탬프_자동_생성(self):
        state = GitHubSyncState()
        state.add_log({"type": "sync_start", "scope": "all"})
        assert len(state.sync_logs) == 1
        assert state.sync_logs[0]["type"] == "sync_start"
        assert "timestamp" in state.sync_logs[0]

    def test_로그_100개_초과시_오래된_항목_제거(self):
        state = GitHubSyncState()
        for i in range(150):
            state.add_log({"type": "test", "index": i})
        assert len(state.sync_logs) == state.MAX_LOGS

    def test_로그_순환버퍼_최신_항목_유지(self):
        state = GitHubSyncState()
        for i in range(150):
            state.add_log({"type": "test", "index": i})
        # index 0~49는 잘리고 50~149만 남음
        assert state.sync_logs[0]["index"] == 50
        assert state.sync_logs[-1]["index"] == 149

    def test_동기화_완료_기록(self):
        state = GitHubSyncState()
        result = {"total_repos": 10, "created": 3, "updated": 7}
        state.record_sync(result)
        assert state.last_sync_result == result
        assert state.last_sync_time is not None
        assert len(state.sync_logs) == 1
        assert state.sync_logs[0]["type"] == "sync_complete"

    def test_동기화_완료시_타임스탬프_양수(self):
        state = GitHubSyncState()
        state.record_sync({"total": 0})
        assert state.last_sync_time > 0
