"""
GitHub Sync 플러그인 상태 관리.

동기화 상태, 로그, 진행 중 여부를 추적한다.
플러그인 라우터에서 이 상태를 조회하고, service에서 업데이트한다.
"""

import time
from dataclasses import dataclass, field


@dataclass
class GitHubSyncState:
    configured: bool = False
    last_sync_time: float | None = None
    last_sync_result: dict | None = None
    sync_logs: list[dict] = field(default_factory=list)
    sync_in_progress: bool = False
    cancel_requested: bool = False

    MAX_LOGS = 100

    def add_log(self, entry: dict) -> None:
        """로그 항목을 추가한다. 최대 MAX_LOGS건 유지."""
        entry["timestamp"] = time.time()
        self.sync_logs.append(entry)
        if len(self.sync_logs) > self.MAX_LOGS:
            self.sync_logs = self.sync_logs[-self.MAX_LOGS:]

    def record_sync(self, result: dict) -> None:
        """동기화 완료를 기록한다."""
        self.last_sync_time = time.time()
        self.last_sync_result = result
        self.add_log({"type": "sync_complete", "result": result})


plugin_state = GitHubSyncState()
