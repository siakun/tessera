/**
 * DashboardTab - 메인 대시보드 뷰 (동기화 상태 표시)
 */

function relativeTime(unixTs) {
  if (!unixTs) return '없음'
  const diff = Math.floor(Date.now() / 1000 - unixTs)
  if (diff < 0) return '방금'
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export default function DashboardTab({ dashboard, syncing }) {
  if (!dashboard) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-fg-muted">대시보드 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const { last_sync_time, last_sync_result, sync_in_progress, accounts = [] } = dashboard
  const isSyncing = syncing || sync_in_progress

  return (
    <div>
      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* 서버 상태 */}
        <div className="border border-edge rounded-lg p-4">
          <div className="text-[11px] text-fg-muted font-medium uppercase tracking-wider">
            서버 상태
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-xl font-bold text-fg">동기화 중</span>
              </>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xl font-bold text-fg">정상</span>
              </>
            )}
          </div>
        </div>

        {/* 마지막 동기화 */}
        <div className="border border-edge rounded-lg p-4">
          <div className="text-[11px] text-fg-muted font-medium uppercase tracking-wider">
            마지막 동기화
          </div>
          <div className="text-xl font-bold text-fg mt-1">
            {relativeTime(last_sync_time)}
          </div>
        </div>

        {/* 등록 계정 */}
        <div className="border border-edge rounded-lg p-4">
          <div className="text-[11px] text-fg-muted font-medium uppercase tracking-wider">
            등록 계정
          </div>
          <div className="text-xl font-bold text-fg mt-1">
            {accounts.length}개
          </div>
          {accounts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {accounts.map((acc) => (
                <span
                  key={acc.name}
                  className="inline-block text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-fg-muted"
                >
                  {acc.label || acc.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 마지막 동기화 결과 */}
      {last_sync_result && (
        <div className="border border-edge-focus rounded-lg mb-6">
          <div className="flex items-center px-4 py-2 bg-surface-tertiary rounded-t-[7px]">
            <span className="text-xs font-semibold text-fg-muted">마지막 동기화 결과</span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-[11px] text-fg-muted">전체 리포</div>
                <div className="text-lg font-bold text-fg">{last_sync_result.total_repos ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-muted">생성</div>
                <div className="text-lg font-bold text-fg">{last_sync_result.created ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-muted">업데이트</div>
                <div className="text-lg font-bold text-fg">{last_sync_result.updated ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-muted">아카이브</div>
                <div className="text-lg font-bold text-fg">{last_sync_result.archived ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-muted">오류</div>
                <div className="text-lg font-bold text-fg">{last_sync_result.marked_error ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
