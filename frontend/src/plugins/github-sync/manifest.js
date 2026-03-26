import { lazy } from 'react'

export default {
  id: 'github-sync',
  name: 'GitHub Sync',
  description: 'GitHub 저장소 메타데이터를 Notion에 자동 동기화',
  icon: 'github',

  // 메인 네비게이션에 추가될 탭
  tabs: [
    {
      key: 'github-settings',
      label: 'GitHub 설정',
      title: 'GitHub 연결 설정',
      description: 'GitHub, Notion, 속성 매핑 구성을 관리합니다.',
      component: lazy(() => import('./components/SettingsTab')),
    },
  ],

  // 셋업 위자드 (미설정 시 표시)
  setupWizard: lazy(() => import('./components/SetupWizard')),

  // 대시보드에 표시될 위젯
  dashboardWidget: lazy(() => import('./components/DashboardWidget')),
}
