import { lazy } from 'react'

export default {
  id: 'github-sync',
  name: 'GitHub Sync',
  description: 'GitHub 저장소 메타데이터를 Notion에 자동 동기화',
  icon: 'github',

  // 메인 네비게이션에 추가될 탭
  tabs: [
    {
      key: 'github-sync',
      label: 'GitHub Sync',
      title: 'GitHub Sync',
      description: 'GitHub 리포지토리를 Notion에 동기화합니다. 설정과 로그를 관리합니다.',
      component: lazy(() => import('./components/GitHubSyncTab')),
    },
  ],

  // 셋업 위자드 (미설정 시 표시)
  setupWizard: lazy(() => import('./components/SetupWizard')),

  // 대시보드에 표시될 위젯
  dashboardWidget: lazy(() => import('./components/DashboardWidget')),
}
