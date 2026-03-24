import { useEffect, useState } from 'react'
import {
  formatDateTime,
  formatLogDetail,
  formatLogExportLine,
  formatLogTitle,
  formatRelativeTime,
  getLogMeta,
  sortLogs,
} from '../utils/formatters'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'sync_start', label: '시작' },
  { key: 'sync_complete', label: '완료' },
  { key: 'sync_error', label: '오류' },
]

export default function LogsTab({ logs, syncing, onSync }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined

    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const sorted = sortLogs(logs)
  const filteredLogs = activeFilter === 'all'
    ? sorted
    : sorted.filter((log) => log.type === activeFilter)

  const counts = FILTERS.reduce((result, filter) => {
    result[filter.key] = filter.key === 'all'
      ? logs.length
      : logs.filter((log) => log.type === filter.key).length
    return result
  }, {})

  const handleCopy = async () => {
    if (filteredLogs.length === 0) return

    const text = filteredLogs.map(formatLogExportLine).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5">
      <section className="panel panel-spacious fade-in">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Logs</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              동기화 이력과 오류를 한 흐름으로 추적합니다
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted sm:text-[15px]">
              최근 100개의 서버 로그를 시간순으로 정렬하고, 시작·완료·오류 이벤트를 필터링해 빠르게 운영 상태를 파악할 수 있도록 구성했습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              disabled={filteredLogs.length === 0}
              className="secondary-button"
            >
              {copied ? '복사 완료' : '현재 필터 복사'}
            </button>
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="primary-button"
            >
              {syncing && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {syncing ? '동기화 진행 중' : '전체 동기화'}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === filter.key
                  ? 'border-transparent bg-accent-soft text-accent-text'
                  : 'border-edge bg-surface-elevated text-fg-muted hover:text-fg'
              }`}
            >
              {filter.label}
              <span className="ml-2 text-xs text-fg-faint">
                {counts[filter.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel flex min-h-0 flex-col overflow-hidden fade-in fade-in-delayed">
        <div className="flex flex-col gap-3 border-b border-edge px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              로그 스트림
            </h2>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              현재 필터 기준 {filteredLogs.length}개의 이벤트를 표시합니다.
            </p>
          </div>
          <p className="text-xs text-fg-faint">
            서버 메모리 기준 최근 100개 로그만 유지됩니다.
          </p>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary text-fg-muted">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h10" />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight text-fg">
              선택한 필터에 해당하는 로그가 없습니다
            </h3>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              새 동기화를 실행하거나 다른 필터를 선택해 최근 이벤트를 확인하세요.
            </p>
          </div>
        ) : (
          <div className="scroll-pane divide-y divide-edge">
            {filteredLogs.map((log, index) => {
              const meta = getLogMeta(log.type)

              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="grid gap-4 px-6 py-5 transition-colors hover:bg-surface-hover/70 lg:grid-cols-[190px_minmax(0,1fr)_auto]"
                >
                  <div className="font-mono text-xs leading-6 text-fg-faint">
                    {formatDateTime(log.timestamp)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      <h3 className="text-sm font-semibold text-fg sm:text-[15px]">
                        {formatLogTitle(log)}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-fg-muted">
                      {formatLogDetail(log)}
                    </p>
                  </div>

                  <div className="text-xs text-fg-faint lg:text-right">
                    {formatRelativeTime(log.timestamp)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
