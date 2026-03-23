import React from "react";

const TYPE_BADGE = {
  sync_start: "bg-accent-soft text-accent-text",
  sync_complete: "bg-ok-soft text-ok-text",
  sync_error: "bg-err-soft text-err-text",
};

const TYPE_LABEL = {
  sync_start: "시작",
  sync_complete: "완료",
  sync_error: "오류",
};

function formatTimestamp(ts) {
  return new Date(ts * 1000).toLocaleString("ko-KR");
}

function formatDetail(log) {
  if (log.type === "sync_complete" && log.result) {
    const r = log.result;
    return `전체 ${r.total ?? 0}, 생성 ${r.created ?? 0}, 업데이트 ${r.updated ?? 0}, 아카이브 ${r.archived ?? 0}, 오류 ${r.errors ?? 0}`;
  }
  if (log.type === "sync_error" && log.error) {
    return log.error;
  }
  return log.result?.scope ?? "-";
}

export default function LogsTab({ logs }) {
  const sorted = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="border border-edge-focus rounded-lg">
      <div className="flex items-center px-4 py-2 bg-surface-tertiary rounded-t-[7px]">
        <span className="text-xs font-semibold text-fg-muted">동기화 로그</span>
        <span className="ml-auto text-[10px] text-fg-faint">{logs.length}건</span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center text-fg-muted text-sm">
          로그가 없습니다.
        </div>
      ) : (
        <div className="divide-y divide-edge">
          {sorted.map((log, i) => (
            <div
              key={`${log.timestamp}-${i}`}
              className="px-4 py-3 hover:bg-surface-hover transition-colors flex items-center gap-3"
            >
              <span className="font-mono text-xs text-fg-tertiary whitespace-nowrap">
                {formatTimestamp(log.timestamp)}
              </span>

              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${TYPE_BADGE[log.type] ?? "bg-accent-soft text-accent-text"}`}
              >
                {TYPE_LABEL[log.type] ?? log.type}
              </span>

              <span className="text-sm text-fg truncate">
                {formatDetail(log)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
