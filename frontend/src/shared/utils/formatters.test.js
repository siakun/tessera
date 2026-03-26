import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatCount,
  formatRelativeTime,
  formatDateTime,
  sortLogs,
  getLogMeta,
  formatLogTitle,
  formatLogDetail,
  formatLogExportLine,
} from './formatters'

describe('formatCount', () => {
  it('null/undefined → "-"', () => {
    expect(formatCount(null)).toBe('-')
    expect(formatCount(undefined)).toBe('-')
  })

  it('0 → "0"', () => {
    expect(formatCount(0)).toBe('0')
  })

  it('큰 수에 천단위 구분자', () => {
    const result = formatCount(1234567)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('null/undefined → "아직 없음"', () => {
    expect(formatRelativeTime(null)).toBe('아직 없음')
    expect(formatRelativeTime(undefined)).toBe('아직 없음')
  })

  it('방금 전 (5초 이내)', () => {
    const now = Date.now() / 1000
    expect(formatRelativeTime(now)).toBe('방금 전')
  })

  it('초 단위', () => {
    const thirtySecsAgo = Date.now() / 1000 - 30
    expect(formatRelativeTime(thirtySecsAgo)).toBe('30초 전')
  })

  it('분 단위', () => {
    const fiveMinAgo = Date.now() / 1000 - 300
    expect(formatRelativeTime(fiveMinAgo)).toBe('5분 전')
  })

  it('시간 단위', () => {
    const twoHoursAgo = Date.now() / 1000 - 7200
    expect(formatRelativeTime(twoHoursAgo)).toBe('2시간 전')
  })

  it('밀리초 타임스탬프도 처리', () => {
    const now = Date.now()
    expect(formatRelativeTime(now)).toBe('방금 전')
  })
})

describe('formatDateTime', () => {
  it('null → "기록 없음"', () => {
    expect(formatDateTime(null)).toBe('기록 없음')
  })

  it('유효한 타임스탬프 → 한국어 날짜', () => {
    const ts = new Date('2026-01-15T10:30:00Z').getTime() / 1000
    const result = formatDateTime(ts)
    expect(result).toContain('2026')
    expect(result).toContain('1')
    expect(result).toContain('15')
  })
})

describe('sortLogs', () => {
  it('빈 배열', () => {
    expect(sortLogs([])).toEqual([])
  })

  it('undefined → 빈 배열', () => {
    expect(sortLogs(undefined)).toEqual([])
  })

  it('최신순 정렬', () => {
    const logs = [
      { timestamp: 100 },
      { timestamp: 300 },
      { timestamp: 200 },
    ]
    const sorted = sortLogs(logs)
    expect(sorted[0].timestamp).toBe(300)
    expect(sorted[2].timestamp).toBe(100)
  })

  it('원본 배열 불변', () => {
    const logs = [{ timestamp: 1 }, { timestamp: 2 }]
    sortLogs(logs)
    expect(logs[0].timestamp).toBe(1)
  })
})

describe('getLogMeta', () => {
  it('sync_start → 시작', () => {
    expect(getLogMeta('sync_start').label).toBe('시작')
  })

  it('sync_complete → 완료', () => {
    expect(getLogMeta('sync_complete').label).toBe('완료')
  })

  it('sync_error → 오류', () => {
    expect(getLogMeta('sync_error').label).toBe('오류')
  })

  it('알 수 없는 타입 → 이벤트', () => {
    expect(getLogMeta('unknown').label).toBe('이벤트')
  })
})

describe('formatLogTitle', () => {
  it('null → "이벤트 없음"', () => {
    expect(formatLogTitle(null)).toBe('이벤트 없음')
  })

  it('sync_start (all) → 전체 동기화 시작', () => {
    const result = formatLogTitle({ type: 'sync_start', scope: 'all' })
    expect(result).toContain('전체')
  })

  it('sync_complete → 정상 완료', () => {
    const result = formatLogTitle({ type: 'sync_complete' })
    expect(result).toContain('완료')
  })

  it('sync_error → 오류 발생', () => {
    const result = formatLogTitle({ type: 'sync_error' })
    expect(result).toContain('오류')
  })
})

describe('formatLogDetail', () => {
  it('null → 기본 메시지', () => {
    expect(formatLogDetail(null)).toBe('표시할 로그가 없습니다.')
  })

  it('sync_complete → 통계 문자열', () => {
    const log = {
      type: 'sync_complete',
      result: { total_repos: 10, created: 3, updated: 5, archived: 1, marked_error: 1 },
    }
    const result = formatLogDetail(log)
    expect(result).toContain('10')
    expect(result).toContain('3')
  })

  it('sync_error → 에러 메시지', () => {
    const log = { type: 'sync_error', error: 'timeout' }
    expect(formatLogDetail(log)).toBe('timeout')
  })
})

describe('formatLogExportLine', () => {
  it('로그를 한 줄 텍스트로 변환', () => {
    const log = { type: 'sync_start', scope: 'all', timestamp: 1700000000 }
    const line = formatLogExportLine(log)
    expect(line).toContain('[시작]')
    expect(line).toContain('전체')
  })
})
