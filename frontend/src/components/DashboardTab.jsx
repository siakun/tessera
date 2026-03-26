import { useMemo } from 'react'
import {
  formatCount,
  formatRelativeTime,
  formatLogDetail,
  formatLogTitle,
  getLogMeta,
  sortLogs,
} from '../utils/formatters'

export default function DashboardTab({ dashboard, logs, syncing, onNavigate }) {
  if (!dashboard) {
    return <p className="p-6 text-sm text-fg-muted">대시보드 데이터를 불러오지 못했습니다.</p>
  }

  const { last_sync_result, sync_in_progress } = dashboard
  const isSyncing = syncing || sync_in_progress
  const sr = last_sync_result ?? {}
  const recentLogs = useMemo(() => sortLogs(logs).slice(0, 5), [logs])

  return (
    <div className="space-y-5 pr-1">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">대시보드</h1>
        <div className="subtle-chip">
          <span className={`inline-flex h-2 w-2 rounded-full ${isSyncing ? 'bg-accent status-pulse' : 'bg-ok'}`} />
          <span>{isSyncing ? '동기화 중' : '대기 중'}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="panel grid grid-cols-3 divide-x divide-edge">
        <div className="px-4 py-4">
          <div className="metric-label">전체 리포</div>
          <div className="metric-value mt-2">{formatCount(sr.total_repos ?? 0)}</div>
        </div>
        <div className="px-4 py-4">
          <div className="metric-label">생성 + 업데이트</div>
          <div className="metric-value mt-2">{formatCount((sr.created ?? 0) + (sr.updated ?? 0))}</div>
        </div>
        <div className="px-4 py-4">
          <div className="metric-label">오류</div>
          <div className="metric-value mt-2">{formatCount(sr.marked_error ?? 0)}</div>
        </div>
      </div>

      {/* Last sync result */}
      {last_sync_result && (
        <div className="panel p-5">
          <h2 className="eyebrow">마지막 동기화 결과</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ['전체 리포', formatCount(sr.total_repos ?? 0)],
              ['생성', formatCount(sr.created ?? 0)],
              ['업데이트', formatCount(sr.updated ?? 0)],
              ['아카이브', formatCount(sr.archived ?? 0)],
              ['오류', formatCount(sr.marked_error ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="font-semibold text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Recent logs */}
      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">최근 로그</h2>
          <button type="button" onClick={() => onNavigate('logs')} className="secondary-button">
            전체 로그
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">표시할 로그가 아직 없습니다.</p>
        ) : (
          <div className="log-rail mt-4 space-y-4">
            {recentLogs.map((log) => {
              const meta = getLogMeta(log.type)
              return (
                <div key={`${log.timestamp}-${log.type}`} className="relative flex gap-4">
                  <span className={`log-dot ${meta.dotClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <span className="text-sm font-semibold text-fg">{formatLogTitle(log)}</span>
                      <span className="text-xs text-fg-faint">{formatRelativeTime(log.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-sm text-fg-muted">{formatLogDetail(log)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
