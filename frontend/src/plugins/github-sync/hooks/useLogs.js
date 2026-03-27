import { useEffect, useMemo, useState } from 'react'
import { pluginApi } from '../../../shared/api/client'
import { formatLogExportLine, sortLogs } from '../../../shared/utils/formatters'

const api = pluginApi('github-sync')

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'sync_start', label: '시작' },
  { key: 'sync_complete', label: '완료' },
  { key: 'sync_error', label: '오류' },
]

/**
 * 로그 fetch + 필터링 + 복사 Hook.
 *
 * 독립적으로 /sync/logs를 fetch한다 (useDashboard에 의존하지 않음).
 */
export default function useLogs() {
  const [logs, setLogs] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/sync/logs')
      .then((data) => { if (!cancelled) setLogs(data.logs || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!copied) return undefined
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const { filteredLogs, counts } = useMemo(() => {
    const sorted = sortLogs(logs)
    return {
      filteredLogs: activeFilter === 'all' ? sorted : sorted.filter((log) => log.type === activeFilter),
      counts: FILTERS.reduce((result, filter) => {
        result[filter.key] = filter.key === 'all' ? logs.length : logs.filter((log) => log.type === filter.key).length
        return result
      }, {}),
    }
  }, [logs, activeFilter])

  const handleCopy = async () => {
    if (filteredLogs.length === 0) return
    try {
      await navigator.clipboard.writeText(filteredLogs.map(formatLogExportLine).join('\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return { logs, activeFilter, setActiveFilter, filteredLogs, counts, copied, handleCopy, FILTERS }
}
