"""
Core 앱 상태 관리.

플러그인별 상태를 레지스트리로 관리한다.
각 플러그인은 자체 상태 객체를 등록하고, core는 집계만 담당한다.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CoreState:
    """코어 애플리케이션 상태."""
    configured_plugins: list[str] = field(default_factory=list)
    _plugin_states: dict[str, Any] = field(default_factory=dict)

    def get_plugin_state(self, plugin_id: str) -> Any:
        return self._plugin_states.get(plugin_id)

    def set_plugin_state(self, plugin_id: str, state: Any):
        self._plugin_states[plugin_id] = state

    @property
    def has_any_configured(self) -> bool:
        return len(self.configured_plugins) > 0


core_state = CoreState()
