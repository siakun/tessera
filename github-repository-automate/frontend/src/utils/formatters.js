const numberFormatter = new Intl.NumberFormat('ko-KR')

const LOG_META = {
  sync_start: {
    label: '시작',
    badgeClass: 'bg-accent-soft text-accent-text',
    dotClass: 'is-info',
  },
  sync_complete: {
    label: '완료',
    badgeClass: 'bg-ok-soft text-ok-text',
    dotClass: 'is-success',
  },
  sync_error: {
    label: '오류',
    badgeClass: 'bg-err-soft text-err-text',
    dotClass: 'is-error',
  },
}

function toMilliseconds(value) {
  if (!value) return null
  return value > 1e12 ? value : value * 1000
}

export function formatCount(value) {
  if (value == null) return '-'
  return numberFormatter.format(value)
}

export function formatRelativeTime(unixValue) {
  const ms = toMilliseconds(unixValue)
  if (!ms) return '아직 없음'

  const diff = Math.floor((Date.now() - ms) / 1000)

  if (diff <= 5) return '방금 전'
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`

  return formatDateTime(unixValue)
}

export function formatDateTime(unixValue) {
  const ms = toMilliseconds(unixValue)
  if (!ms) return '기록 없음'

  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function sortLogs(logs = []) {
  return [...logs].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
}

export function getLogMeta(type) {
  return LOG_META[type] ?? {
    label: '이벤트',
    badgeClass: 'bg-surface-tertiary text-fg-muted',
    dotClass: 'is-neutral',
  }
}

export function formatLogTitle(log) {
  if (!log) return '이벤트 없음'

  switch (log.type) {
    case 'sync_start':
      return log.scope === 'all'
        ? '전체 GitHub 계정 동기화를 시작했습니다'
        : '동기화 작업을 시작했습니다'
    case 'sync_complete':
      return '동기화가 정상적으로 완료되었습니다'
    case 'sync_error':
      return '동기화 중 오류가 발생했습니다'
    default:
      return '새 이벤트가 기록되었습니다'
  }
}

export function formatLogDetail(log) {
  if (!log) return '표시할 로그가 없습니다.'

  if (log.type === 'sync_complete' && log.result) {
    const result = log.result
    return [
      `전체 ${formatCount(result.total_repos ?? result.total ?? 0)}개`,
      `생성 ${formatCount(result.created ?? 0)}개`,
      `업데이트 ${formatCount(result.updated ?? 0)}개`,
      `아카이브 ${formatCount(result.archived ?? 0)}개`,
      `오류 ${formatCount(result.marked_error ?? result.errors ?? 0)}개`,
    ].join(' · ')
  }

  if (log.type === 'sync_error') {
    return log.error || '오류 상세 메시지를 받아오지 못했습니다.'
  }

  if (log.scope === 'all') {
    return '등록된 모든 계정의 저장소 메타데이터를 Notion 데이터베이스에 반영합니다.'
  }

  if (log.result?.scope) {
    return `${log.result.scope} 범위를 기준으로 작업이 기록되었습니다.`
  }

  return '서버가 동기화 이벤트를 기록했습니다.'
}

export function formatLogExportLine(log) {
  const meta = getLogMeta(log?.type)
  return `${formatDateTime(log?.timestamp)} [${meta.label}] ${formatLogTitle(log)} - ${formatLogDetail(log)}`
}
