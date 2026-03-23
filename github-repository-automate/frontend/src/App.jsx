import { useState, useEffect, useCallback, useRef } from 'react'
import DashboardTab from './components/DashboardTab'
import SettingsTab from './components/SettingsTab'
import LogsTab from './components/LogsTab'
import SetupWizard from './components/SetupWizard'
import ThemeToggle from './components/ThemeToggle'

const TABS = [
  { key: 'dashboard', label: '대시보드' },
  { key: 'settings', label: '설정' },
  { key: 'logs', label: '로그' },
]

export default function App() {
  const [configured, setConfigured] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [logs, setLogs] = useState([])
  const [syncing, setSyncing] = useState(false)
  const pollRef = useRef(null)

  // ── 데이터 페칭 ──

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
    } catch { /* ignore */ }
  }, [])

  // ── 폴링 ──

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const data = await fetchDashboard()
      if (data && !data.sync_in_progress) {
        clearInterval(pollRef.current)
        pollRef.current = null
        setSyncing(false)
        fetchLogs()
      }
    }, 3000)
  }, [fetchDashboard, fetchLogs])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // ── 초기 로드 ──

  useEffect(() => {
    fetchStatus().then(ok => {
      if (ok) {
        fetchDashboard().then(data => {
          if (data?.sync_in_progress) {
            setSyncing(true)
            startPolling()
          }
        })
        fetchLogs()
      }
    })
    return () => stopPolling()
  }, [fetchStatus, fetchDashboard, fetchLogs, startPolling, stopPolling])

  // ── 동기화 트리거 ──

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' })
      if (!res.ok) throw new Error()
      startPolling()
    } catch {
      setSyncing(false)
    }
  }

  // ── 설정 완료 콜백 ──

  const handleSetupComplete = () => {
    setConfigured(true)
    setActiveTab('dashboard')
    fetchDashboard()
    fetchLogs()
  }

  // ── 로딩 ──

  if (configured === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Spinner /> <span className="ml-2 text-fg-muted text-sm">로딩 중...</span>
      </div>
    )
  }

  // ── 초기 설정 ──

  if (!configured) {
    return (
      <div className="min-h-screen bg-surface">
        <nav className="border-b border-edge bg-surface-elevated">
          <div className="px-6 py-3 flex items-center">
            <span className="text-xl font-bold text-accent-text">GitHub-Notion Sync</span>
            <div className="ml-auto"><ThemeToggle /></div>
          </div>
        </nav>
        <SetupWizard onComplete={handleSetupComplete} />
      </div>
    )
  }

  // ── 메인 앱 ──

  return (
    <div className="min-h-screen bg-surface">
      {/* Nav */}
      <nav className="border-b border-edge bg-surface-elevated">
        <div className="px-6 py-3 flex items-center gap-6">
          <span className="text-xl font-bold text-accent-text">GitHub-Notion Sync</span>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="px-6 border-b border-edge">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-accent-text text-accent-text'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              {tab.label}
              {tab.key === 'logs' && logs.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-surface-widget rounded-full">
                  {logs.length}
                </span>
              )}
            </button>
          ))}

          {/* 동기화 버튼 (우측) */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="ml-auto px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncing && <Spinner />}
            {syncing ? '동기화 중...' : '전체 동기화'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <main className="px-6 py-6">
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          <DashboardTab dashboard={dashboard} syncing={syncing} />
        </div>
        <div className={activeTab === 'settings' ? '' : 'hidden'}>
          <SettingsTab />
        </div>
        <div className={activeTab === 'logs' ? '' : 'hidden'}>
          <LogsTab logs={logs} />
        </div>
      </main>
    </div>
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
