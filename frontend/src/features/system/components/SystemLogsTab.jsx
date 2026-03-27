import { useCallback, useRef, useState } from 'react'
import useSystemLogs from '../hooks/useSystemLogs'

const EVENT_LABELS = {
  login_success: { label: '로그인', cls: 'bg-ok/20 text-ok' },
  login_rejected: { label: '차단', cls: 'bg-danger/20 text-danger' },
  auth_setup: { label: '설정', cls: 'bg-accent-soft text-accent-text' },
  logout: { label: '로그아웃', cls: 'bg-surface-tertiary text-fg-muted' },
}

const COLUMNS = [
  { key: 'time', label: '시간', defaultWidth: 60, minWidth: 40 },
  { key: 'ip', label: 'IP', defaultWidth: 130, minWidth: 60 },
  { key: 'method', label: '메서드', defaultWidth: 50, minWidth: 40 },
  { key: 'path', label: '경로', defaultWidth: 0, minWidth: 100 },  // 0 = flex
  { key: 'user', label: '사용자', defaultWidth: 140, minWidth: 60 },
  { key: 'event', label: '이벤트', defaultWidth: 70, minWidth: 50 },
]

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function relativeTime(ts) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

function buildGridTemplate(widths) {
  return widths.map((w) => (w === 0 ? 'minmax(0,1fr)' : `${w}px`)).join(' ')
}

/**
 * 시스템 감사 로그 탭.
 *
 * 리사이즈 가능한 컬럼 헤더 + 실시간 로그 스트림.
 */
export default function SystemLogsTab() {
  const { logs, totalCount, activeFilter, setActiveFilter, FILTERS } = useSystemLogs()
  const [widths, setWidths] = useState(() => COLUMNS.map((c) => c.defaultWidth))
  const dragRef = useRef(null)

  const handlePointerDown = useCallback((colIndex, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widths[colIndex]
    const minW = COLUMNS[colIndex].minWidth

    const onMove = (ev) => {
      const delta = ev.clientX - startX
      setWidths((prev) => {
        const next = [...prev]
        next[colIndex] = Math.max(minW, startWidth + delta)
        return next
      })
    }

    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      dragRef.current = null
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    dragRef.current = { colIndex }
  }, [widths])

  const gridTemplate = buildGridTemplate(widths)

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5">
      {/* 헤더 */}
      <section className="panel p-5 fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">Audit</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              시스템 로그
            </h1>
            <p className="mt-2 text-sm text-fg-muted">
              접속 IP, 인증 시도, API 호출 등 모든 이벤트를 추적합니다. 최근 {totalCount}건.
            </p>
          </div>
          <div className="subtle-chip">
            <span className="inline-flex h-2 w-2 rounded-full bg-ok status-pulse" />
            <span>실시간</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === f.key
                  ? 'border-transparent bg-accent-soft text-accent-text'
                  : 'border-edge bg-surface-elevated text-fg-muted hover:text-fg'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* 로그 테이블 */}
      <section className="panel flex min-h-0 flex-col overflow-hidden fade-in fade-in-delayed">
        {/* 컬럼 헤더 (리사이즈 핸들 포함) */}
        <div className="border-b border-edge px-6 py-3 select-none">
          <div className="grid gap-0" style={{ gridTemplateColumns: gridTemplate }}>
            {COLUMNS.map((col, i) => (
              <div key={col.key} className="relative flex items-center">
                <span className="truncate px-1.5 text-xs font-medium text-fg-faint">{col.label}</span>
                {/* 리사이즈 핸들 (flex 컬럼과 마지막 컬럼 제외) */}
                {col.defaultWidth !== 0 && i < COLUMNS.length - 1 && (
                  <div
                    className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-accent/20 active:bg-accent/30"
                    onPointerDown={(e) => handlePointerDown(i, e)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 로그 행 */}
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-fg-muted">
            기록된 로그가 없습니다.
          </div>
        ) : (
          <div className="scroll-pane divide-y divide-edge">
            {logs.map((log, i) => {
              const evMeta = log.event ? EVENT_LABELS[log.event] : null
              return (
                <div
                  key={`${log.timestamp}-${i}`}
                  className="grid items-center px-6 py-2.5 text-sm transition-colors hover:bg-surface-hover/70"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <span className="truncate px-1.5 font-mono text-xs text-fg-faint" title={formatTime(log.timestamp)}>
                    {relativeTime(log.timestamp)}
                  </span>
                  <span className="truncate px-1.5 font-mono text-xs text-fg-muted" title={log.ip}>
                    {log.ip}
                  </span>
                  <span className={`truncate px-1.5 font-mono text-xs ${log.status >= 400 ? 'text-danger' : 'text-fg-muted'}`}>
                    {log.method}
                  </span>
                  <span className="truncate px-1.5 text-fg" title={log.path}>
                    {log.path}
                    {log.detail && <span className="ml-2 text-xs text-fg-faint">({log.detail})</span>}
                  </span>
                  <span className="truncate px-1.5 text-xs text-fg-muted" title={log.user || ''}>
                    {log.user || '-'}
                  </span>
                  <span className="px-1.5">
                    {evMeta ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${evMeta.cls}`}>
                        {evMeta.label}
                      </span>
                    ) : (
                      <span className="text-xs text-fg-faint">{log.status}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
