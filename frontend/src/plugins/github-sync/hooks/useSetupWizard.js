import { useMemo, useState } from 'react'
import { pluginApi } from '../../../shared/api/client'
import { PROPERTY_FIELDS, createEmptyAccount } from '../../../shared/constants/formHelpers'

const api = pluginApi('github-sync')

const STEPS = [
  {
    title: 'GitHub 액세스 확인',
    description: '개인 액세스 토큰을 테스트해 실제 동기화 권한이 있는지 먼저 확인합니다.',
  },
  {
    title: '동기화 대상 계정 지정',
    description: '개인 계정과 조직 계정을 추가해 동기화 범위를 정의합니다.',
  },
  {
    title: 'Notion 데이터베이스 연결',
    description: 'Integration Token과 Database ID를 검사해 실제 DB 구조를 읽어옵니다.',
  },
  {
    title: '속성 자동 매핑 검토',
    description: '감지된 Notion 컬럼과 GitHub 메타데이터 필드를 연결합니다.',
  },
  {
    title: '검토 후 저장',
    description: '최종 구성을 검토하고 설정 파일을 저장해 대시보드를 활성화합니다.',
  },
]

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

function maskToken(token) {
  if (!token) return '미입력'
  if (token.length <= 8) return token
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}

/**
 * SetupWizard 전체 상태 관리 Hook.
 *
 * WPF 비유: SetupWizardViewModel에 해당.
 * 5단계 위자드의 모든 상태와 비즈니스 로직을 관리한다.
 *
 * @param {Function} onComplete - 설정 저장 완료 콜백
 * @param {boolean} isReconfigure - 재설정 모드 여부
 * @returns {Object} 위자드 상태와 핸들러
 */
export default function useSetupWizard(onComplete, isReconfigure = false) {
  const [step, setStep] = useState(0)

  // Step 0: GitHub
  const [githubToken, setGithubToken] = useState('')
  const [githubUser, setGithubUser] = useState(null)
  const [githubError, setGithubError] = useState('')
  const [githubTesting, setGithubTesting] = useState(false)

  // Step 1: Accounts
  const [accounts, setAccounts] = useState([createEmptyAccount()])
  const [accountPreviews, setAccountPreviews] = useState({})
  const [accountErrors, setAccountErrors] = useState({})
  const [previewLoading, setPreviewLoading] = useState({})

  // Step 2: Notion
  const [notionToken, setNotionToken] = useState('')
  const [notionDbId, setNotionDbId] = useState('')
  const [notionResult, setNotionResult] = useState(null)
  const [notionError, setNotionError] = useState('')
  const [notionTesting, setNotionTesting] = useState(false)

  // Step 3: Property mapping
  const [propertyMap, setPropertyMap] = useState({})

  // Step 4: Review & save
  const [webhookSecret, setWebhookSecret] = useState('')
  const [visibilityError, setVisibilityError] = useState('Error')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // -- Handlers --

  const testGithub = async () => {
    setGithubTesting(true)
    setGithubError('')
    setGithubUser(null)

    try {
      const data = await api.post('/setup/test-github', { token: githubToken })
      setGithubUser(data)
    } catch (error) {
      setGithubError(getErrorMessage(error, 'GitHub 연결을 확인할 수 없습니다.'))
    } finally {
      setGithubTesting(false)
    }
  }

  const addAccount = () => {
    setAccounts((prev) => [...prev, createEmptyAccount()])
  }

  const removeAccount = (index) => {
    setAccounts((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [createEmptyAccount()]
    })
    setAccountPreviews((prev) => { const next = { ...prev }; delete next[index]; return next })
    setAccountErrors((prev) => { const next = { ...prev }; delete next[index]; return next })
  }

  const updateAccount = (index, field, value) => {
    setAccounts((prev) =>
      prev.map((account, i) => (i === index ? { ...account, [field]: value } : account)),
    )
  }

  const previewAccount = async (index) => {
    const account = accounts[index]
    if (!account.name) return

    setPreviewLoading((prev) => ({ ...prev, [index]: true }))
    setAccountErrors((prev) => ({ ...prev, [index]: '' }))
    setAccountPreviews((prev) => ({ ...prev, [index]: null }))

    try {
      const data = await api.post('/setup/test-github-account', {
        token: githubToken,
        name: account.name,
        type: account.type,
      })
      setAccountPreviews((prev) => ({ ...prev, [index]: data }))
    } catch (error) {
      setAccountErrors((prev) => ({
        ...prev,
        [index]: getErrorMessage(error, '계정 미리보기를 불러오지 못했습니다.'),
      }))
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [index]: false }))
    }
  }

  const testNotion = async () => {
    setNotionTesting(true)
    setNotionError('')
    setNotionResult(null)

    try {
      const data = await api.post('/setup/test-notion', {
        token: notionToken,
        database_id: notionDbId,
      })
      setNotionResult(data)

      const propertyNames = Object.keys(data.properties || {})
      const nextMap = {}
      PROPERTY_FIELDS.forEach((field) => {
        const matched = propertyNames.find(
          (name) => name.toLowerCase() === field.defaultMatch.toLowerCase(),
        )
        if (matched) nextMap[field.key] = matched
      })
      setPropertyMap(nextMap)
    } catch (error) {
      setNotionError(getErrorMessage(error, 'Notion 데이터베이스를 확인할 수 없습니다.'))
    } finally {
      setNotionTesting(false)
    }
  }

  const handleSave = async () => {
    if (isReconfigure && !window.confirm('기존 설정을 덮어씁니다. 계속하시겠습니까?')) {
      return
    }
    setSaving(true)
    setSaveError('')

    try {
      await api.post('/setup/save', {
        github_token: githubToken,
        github_webhook_secret: webhookSecret,
        github_accounts: accounts.filter((a) => a.name.trim()),
        notion_token: notionToken,
        notion_database_id: notionDbId,
        notion_properties: propertyMap,
        visibility_error: visibilityError,
      })
      onComplete()
    } catch (error) {
      setSaveError(getErrorMessage(error, '설정을 저장할 수 없습니다.'))
    } finally {
      setSaving(false)
    }
  }

  const handleGithubTokenChange = (value) => {
    setGithubToken(value)
    setGithubUser(null)
    setGithubError('')
  }

  const handleNotionTokenChange = (value) => {
    setNotionToken(value)
    setNotionResult(null)
    setNotionError('')
  }

  const handleNotionDbIdChange = (value) => {
    setNotionDbId(value)
    setNotionResult(null)
    setNotionError('')
  }

  // -- Computed (useMemo = Computed Property) --

  const reachableStep = useMemo(() => {
    if (!githubUser) return 0
    if (!accounts.some((a) => a.name.trim())) return 1
    if (!notionResult) return 2
    return STEPS.length - 1
  }, [githubUser, accounts, notionResult])

  const currentStep = STEPS[step]
  const activeAccounts = useMemo(() => accounts.filter((a) => a.name.trim()), [accounts])
  const mappedPropertyCount = useMemo(() => Object.values(propertyMap).filter(Boolean).length, [propertyMap])

  return {
    // Navigation
    step, setStep, currentStep, reachableStep, STEPS,

    // Step 0: GitHub
    githubToken, handleGithubTokenChange, githubUser, githubError, githubTesting, testGithub,

    // Step 1: Accounts
    accounts, accountPreviews, accountErrors, previewLoading, activeAccounts,
    addAccount, removeAccount, updateAccount, previewAccount,

    // Step 2: Notion
    notionToken, handleNotionTokenChange,
    notionDbId, handleNotionDbIdChange,
    notionResult, notionError, notionTesting, testNotion,

    // Step 3: Property mapping
    propertyMap, setPropertyMap, mappedPropertyCount,

    // Step 4: Review & save
    webhookSecret, setWebhookSecret,
    visibilityError, setVisibilityError,
    saving, saveError, handleSave,

    // Utils
    maskToken,
  }
}
