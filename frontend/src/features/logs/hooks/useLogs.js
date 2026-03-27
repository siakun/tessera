import { useEffect, useMemo, useState } from 'react'
import { formatLogExportLine, sortLogs } from '../../../shared/utils/formatters'

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'sync_start', label: '시작' },
  { key: 'sync_complete', label: '완료' },
  { key: 'sync_error', label: '오류' },
]

/**
 * 로그 필터링 + 복사 Hook.
 *
 * WPF 비유: LogsViewModel에 해당.
 * 로그 데이터를 필터링하고 클립보드 복사 기능을 제공한다.
 *
 * @param {Array} logs - 서버에서 받은 로그 배열
 * @returns {{ activeFilter, setActiveFilter, filteredLogs, counts, copied, handleCopy, FILTERS }}
 */
export default function useLogs(logs) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [copied, setCopied] = useState(false)

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

    const text = filteredLogs.map(formatLogExportLine).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return { activeFilter, setActiveFilter, filteredLogs, counts, copied, handleCopy, FILTERS }
}
