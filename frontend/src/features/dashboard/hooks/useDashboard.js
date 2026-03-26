import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pluginApi } from '../../../shared/api/client'
import useNotice from '../../../shared/hooks/useNotice'

const api = pluginApi('github-sync')

/**
 * 대시보드 전체 상태 관리 Hook.
 *
 * WPF 비유: MainViewModel에 해당.
 * 설정 상태 확인, 대시보드 데이터, 로그, 동기화 제어(폴링),
 * 탭 네비게이션을 모두 관리한다.
 *
 * 기존 App.jsx의 모든 비즈니스 로직을 추출하여
 * React Rules of Hooks 위반(조건부 return 뒤 useMemo)을 자연 해결한다.
 *
 * @returns {Object} 대시보드 상태와 핸들러
 */
export default function useDashboard() {
  const [configured, setConfigured] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showSetup, setShowSetup] = useState(window.location.pathname === '/setup')
  const [dashboard, setDashboard] = useState(null)
  const [logs, setLogs] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const pollRef = useRef(null)

  const { notice, showNotice } = useNotice()

  // useMemo들이 Hook 내부에서 항상 호출되므로 Rules of Hooks 위반 해결
  const accountCount = useMemo(() => dashboard?.accounts?.length ?? 0, [dashboard])
  const statusLabel = useMemo(
    () => cancelling ? '중지하는 중' : syncing ? '동기화 진행 중' : '대기 중',
    [cancelling, syncing],
  )

  // -- Data fetching --

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/status')
      setConfigured(data.configured)
      return data.configured
    } catch {
      setConfigured(false)
      return false
    }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.get('/dashboard')
      setDashboard(data)
      setSyncing(data.sync_in_progress)
      return data
    } catch {
      return null
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.get('/sync/logs')
      setLogs(data.logs || [])
    } catch {
      // ignore
    }
  }, [])

  // -- Polling --

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
        setCancelling(false)
        fetchLogs()
        const msg = data.last_sync_result?.cancelled ? '동기화가 중지되었습니다.' : '동기화가 완료되었습니다.'
        showNotice('info', msg)
      }
    }, 3000)
  }, [fetchDashboard, fetchLogs, showNotice])

  // -- Bootstrap --

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

  // -- Actions --

  const handleSync = async () => {
    if (syncing) return

    setSyncing(true)
    showNotice('info', '백그라운드 동기화를 시작했습니다.')

    try {
      await api.post('/sync/trigger')
      startPolling()
      fetchDashboard()
    } catch {
      setSyncing(false)
      showNotice('error', '동기화를 시작할 수 없습니다. 설정과 서버 상태를 확인하세요.')
    }
  }

  const handleCancelSync = async () => {
    setShowCancelConfirm(false)
    setCancelling(true)
    try {
      await api.post('/sync/cancel')
    } catch {
      setCancelling(false)
      showNotice('error', '중지 요청에 실패했습니다.')
    }
  }

  const handleSetupComplete = () => {
    setConfigured(true)
    setShowSetup(false)
    setActiveTab('dashboard')
    window.history.replaceState(null, '', '/')
    fetchDashboard().then((data) => {
      if (data?.sync_in_progress) {
        setSyncing(true)
        startPolling()
      }
    })
    fetchLogs()
    showNotice('info', '설정이 저장되었습니다. 이제 대시보드에서 동기화를 운영할 수 있습니다.')
  }

  return {
    // State
    configured, activeTab, setActiveTab, showSetup, setShowSetup,
    dashboard, logs, syncing, cancelling,
    showCancelConfirm, setShowCancelConfirm,
    notice, showNotice,
    accountCount, statusLabel,

    // Actions
    handleSync, handleCancelSync, handleSetupComplete,
  }
}
