import { useCallback, useEffect, useRef, useState } from 'react'
import DashboardTab from './components/DashboardTab'
import SettingsTab from './components/SettingsTab'
import LogsTab from './components/LogsTab'
import SetupWizard from './components/SetupWizard'
import ThemeToggle from './components/ThemeToggle'
import { formatDateTime, formatRelativeTime } from './utils/formatters'

const TABS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    title: '운영 대시보드',
    description: '통계, 최근 이벤트, 연결된 계정을 하나의 워크스페이스에서 확인합니다.',
  },
  {
    key: 'settings',
    label: 'Settings',
    title: '연결 설정',
    description: 'GitHub, Notion, 속성 매핑 구성을 같은 톤으로 관리합니다.',
  },
  {
    key: 'logs',
    label: 'Logs',
    title: '운영 로그',
    description: '최근 동기화 이력과 오류를 빠르게 스캔할 수 있는 로그 스트림입니다.',
  },
]

export default function App() {
  const [configured, setConfigured] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [logs, setLogs] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState(null)
  const pollRef = useRef(null)

  const showNotice = useCallback((tone, message) => {
    setNotice({ tone, message })
  }, [])

  useEffect(() => {
    if (!notice) return undefined

    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/setup/status')
      const data = await res.json()
      setConfigured(data.configured)
      return data.configured
    } catch {
      setConfigured(false)
      return false
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) return null
      const data = await res.json()
      setDashboard(data)
      setSyncing(data.sync_in_progress)
      return data
    } catch {
      return null
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/logs')
      if (!res.ok) return
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      // ignore
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return

    pollRef.current = setInterval(async () => {
      const data = await fetchDashboard()

      if (data && !data.sync_in_progress) {
        clearInterval(pollRef.current)
        pollRef.current = null
        setSyncing(false)
        fetchLogs()
        showNotice('info', '동기화가 완료되었습니다.')
      }
    }, 3000)
  }, [fetchDashboard, fetchLogs, showNotice])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const ok = await fetchStatus()
      if (!ok || cancelled) return

      const data = await fetchDashboard()
      if (cancelled) return

      await fetchLogs()

      if (data?.sync_in_progress) {
        setSyncing(true)
        startPolling()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [fetchStatus, fetchDashboard, fetchLogs, startPolling, stopPolling])

  const handleSync = async () => {
    if (syncing) return

    setSyncing(true)
    showNotice('info', '백그라운드 동기화를 시작했습니다.')

    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '동기화를 시작할 수 없습니다.')
      }

      startPolling()
      fetchDashboard()
    } catch {
      setSyncing(false)
      showNotice('error', '동기화를 시작할 수 없습니다. 설정과 서버 상태를 확인하세요.')
    }
  }

  const handleSetupComplete = () => {
    setConfigured(true)
    setActiveTab('dashboard')
    fetchDashboard().then((data) => {
      if (data?.sync_in_progress) {
        setSyncing(true)
        startPolling()
      }
    })
    fetchLogs()
    showNotice('info', '설정이 저장되었습니다. 이제 대시보드에서 동기화를 운영할 수 있습니다.')
  }

  if (configured === null) {
    return (
      <ScreenFrame>
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-6 w-6 text-accent" />
            <p className="text-sm text-fg-muted">워크스페이스를 준비하고 있습니다</p>
          </div>
        </div>
      </ScreenFrame>
    )
  }

  if (!configured) {
    return (
      <ScreenFrame>
        <div className="mx-auto h-full w-full max-w-[1540px] p-3 sm:p-5">
          <div className="shell-frame flex h-full flex-col overflow-hidden">
            <header className="shrink-0 border-b border-edge px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="eyebrow">GitHub to Notion</div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                    Notion Automate
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-fg-muted">
                    단순한 설정 폼 대신, 실제 운영 워크플로에 맞춘 단계형 온보딩으로 자동화를 연결합니다.
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-hidden px-5 py-5 sm:px-8 sm:py-6">
              <SetupWizard onComplete={handleSetupComplete} />
            </main>
          </div>
        </div>
      </ScreenFrame>
    )
  }

  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[0]
  const accountCount = dashboard?.accounts?.length ?? 0
  const statusLabel = syncing ? '동기화 진행 중' : '대기 중'

  return (
    <ScreenFrame>
      <div className="mx-auto flex h-full w-full max-w-[1680px] p-3 sm:p-5">
        <div className="shell-frame grid h-full w-full overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex h-full flex-col overflow-hidden border-b border-edge px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:py-7">
            <div>
              <div className="eyebrow">Operations</div>
              <h1 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-fg">
                Notion Automate
              </h1>
              <p className="mt-3 max-w-xs text-sm leading-6 text-fg-muted">
                저장소 메타데이터와 최신 동기화 결과를 차분한 SaaS 워크스페이스 형태로 관리합니다.
              </p>
            </div>

            <nav className="mt-8 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`nav-item min-w-[180px] lg:min-w-0 ${activeTab === tab.key ? 'is-active' : ''}`}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-medium text-fg">{tab.label}</div>
                    <div className="mt-1 truncate text-xs text-fg-muted">
                      {tab.description}
                    </div>
                  </div>
                  {tab.key === 'logs' && logs.length > 0 && (
                    <span className="rounded-full bg-surface-tertiary px-2 py-1 text-[11px] font-semibold text-fg-muted">
                      {logs.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

          </aside>

          <section className="flex min-h-0 h-full flex-col overflow-hidden">
            <header className="shrink-0 border-b border-edge px-5 py-4 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight text-fg">
                    {currentTab.title}
                  </h2>
                  <p className="mt-1 text-sm text-fg-muted">{currentTab.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {/* 상태 pill */}
                  <div className="subtle-chip hidden sm:inline-flex">
                    <span className={`inline-flex h-2 w-2 rounded-full ${syncing ? 'bg-accent status-pulse' : 'bg-ok'}`} />
                    <span>{statusLabel}</span>
                  </div>

                  {/* 동기화 버튼 + 호버 팝오버 */}
                  <div className="group relative">
                    <button
                      type="button"
                      onClick={handleSync}
                      disabled={syncing}
                      className="primary-button"
                    >
                      {syncing && <Spinner className="h-4 w-4" />}
                      {syncing ? '동기화 중' : '전체 동기화'}
                    </button>
                    <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-2xl border border-edge bg-surface-elevated p-3 text-sm opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                      <div className="flex items-center justify-between">
                        <span className="text-fg-muted">마지막 동기화:</span>
                        <span className="font-medium text-fg">{dashboard?.last_sync_time ? formatRelativeTime(dashboard.last_sync_time) : '없음'}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-fg-muted">연결 계정:</span>
                        <span className="font-medium text-fg">{accountCount}개</span>
                      </div>
                    </div>
                  </div>

                  <ThemeToggle />
                </div>
              </div>
            </header>

            {notice && (
              <div className={`notice-banner shrink-0 ${notice.tone === 'error' ? 'is-error' : 'is-info'}`}>
                {notice.message}
              </div>
            )}

            <main className="flex-1 min-h-0 overflow-hidden px-5 py-5 sm:px-8 sm:py-6">
              {activeTab === 'dashboard' && (
                <div className="h-full">
                  <DashboardTab
                    dashboard={dashboard}
                    logs={logs}
                    syncing={syncing}
                    onNavigate={setActiveTab}
                  />
                </div>
              )}
              {activeTab === 'settings' && (
                <div className="h-full">
                  <SettingsTab />
                </div>
              )}
              {activeTab === 'logs' && (
                <div className="h-full">
                  <LogsTab
                    logs={logs}
                    syncing={syncing}
                    onSync={handleSync}
                  />
                </div>
              )}
            </main>
          </section>
        </div>
      </div>
    </ScreenFrame>
  )
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ScreenFrame({ children }) {
  return (
    <div className="h-[100svh] overflow-hidden">
      {children}
    </div>
  )
}
