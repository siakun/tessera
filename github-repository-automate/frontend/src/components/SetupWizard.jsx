import { useState } from 'react'

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

const PROPERTY_FIELDS = [
  { key: 'name', label: '이름', defaultMatch: 'Name' },
  { key: 'url', label: 'URL', defaultMatch: 'URL' },
  { key: 'description', label: '설명', defaultMatch: 'Description' },
  { key: 'last_commit', label: '마지막 커밋', defaultMatch: 'Last Commit' },
  { key: 'commit_count', label: '커밋 수', defaultMatch: 'Commit Count' },
  { key: 'visibility', label: '가시성', defaultMatch: 'Visibility' },
  { key: 'repo_id', label: '저장소 ID', defaultMatch: 'repository-id' },
]

function createEmptyAccount() {
  return { name: '', type: 'user', label: '' }
}

function maskToken(token) {
  if (!token) return '미입력'
  if (token.length <= 8) return token
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)

  const [githubToken, setGithubToken] = useState('')
  const [githubUser, setGithubUser] = useState(null)
  const [githubError, setGithubError] = useState('')
  const [githubTesting, setGithubTesting] = useState(false)

  const [accounts, setAccounts] = useState([createEmptyAccount()])
  const [accountPreviews, setAccountPreviews] = useState({})
  const [accountErrors, setAccountErrors] = useState({})
  const [previewLoading, setPreviewLoading] = useState({})

  const [notionToken, setNotionToken] = useState('')
  const [notionDbId, setNotionDbId] = useState('')
  const [notionResult, setNotionResult] = useState(null)
  const [notionError, setNotionError] = useState('')
  const [notionTesting, setNotionTesting] = useState(false)

  const [propertyMap, setPropertyMap] = useState({})

  const [webhookSecret, setWebhookSecret] = useState('')
  const [visibilityError, setVisibilityError] = useState('Error')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const testGithub = async () => {
    setGithubTesting(true)
    setGithubError('')
    setGithubUser(null)

    try {
      const res = await fetch('/api/setup/test-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'GitHub 연결을 확인할 수 없습니다.')
      }

      const data = await res.json()
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
      const next = prev.filter((_, accountIndex) => accountIndex !== index)
      return next.length > 0 ? next : [createEmptyAccount()]
    })

    setAccountPreviews((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })

    setAccountErrors((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const updateAccount = (index, field, value) => {
    setAccounts((prev) =>
      prev.map((account, accountIndex) => (
        accountIndex === index ? { ...account, [field]: value } : account
      )),
    )
  }

  const previewAccount = async (index) => {
    const account = accounts[index]
    if (!account.name) return

    setPreviewLoading((prev) => ({ ...prev, [index]: true }))
    setAccountErrors((prev) => ({ ...prev, [index]: '' }))
    setAccountPreviews((prev) => ({ ...prev, [index]: null }))

    try {
      const res = await fetch('/api/setup/test-github-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          name: account.name,
          type: account.type,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '계정 미리보기를 불러오지 못했습니다.')
      }

      const data = await res.json()
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
      const res = await fetch('/api/setup/test-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: notionToken,
          database_id: notionDbId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Notion 데이터베이스를 확인할 수 없습니다.')
      }

      const data = await res.json()
      setNotionResult(data)

      const propertyNames = Object.keys(data.properties || {})
      const nextMap = {}

      PROPERTY_FIELDS.forEach((field) => {
        const matchedName = propertyNames.find(
          (propertyName) => propertyName.toLowerCase() === field.defaultMatch.toLowerCase(),
        )

        if (matchedName) nextMap[field.key] = matchedName
      })

      setPropertyMap(nextMap)
    } catch (error) {
      setNotionError(getErrorMessage(error, 'Notion 데이터베이스를 확인할 수 없습니다.'))
    } finally {
      setNotionTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')

    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_token: githubToken,
          github_webhook_secret: webhookSecret,
          github_accounts: accounts.filter((account) => account.name.trim()),
          notion_token: notionToken,
          notion_database_id: notionDbId,
          notion_properties: propertyMap,
          visibility_error: visibilityError,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '설정을 저장할 수 없습니다.')
      }

      onComplete()
    } catch (error) {
      setSaveError(getErrorMessage(error, '설정을 저장할 수 없습니다.'))
    } finally {
      setSaving(false)
    }
  }

  const canNext = () => {
    if (step === 0) return !!githubUser
    if (step === 1) return accounts.some((account) => account.name.trim())
    if (step === 2) return !!notionResult
    return true
  }

  const currentStep = STEPS[step]
  const activeAccounts = accounts.filter((account) => account.name.trim())
  const mappedPropertyCount = Object.values(propertyMap).filter(Boolean).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex shrink-0 min-h-0 flex-col gap-5">
        <section className="panel p-5 fade-in">
          <div className="eyebrow">Step by Step</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg">
            5단계로 자동화를 연결합니다
          </h2>
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            GitHub 확인부터 Notion 매핑, 최종 저장까지 한 단계씩 점검하며 진행합니다.
          </p>
        </section>

        <section className="panel scroll-pane p-3 fade-in fade-in-delayed">
          {STEPS.map((item, index) => {
            const isActive = index === step
            const isComplete = index < step

            return (
              <button
                key={item.title}
                type="button"
                disabled={index > step}
                onClick={() => setStep(index)}
                className={`wizard-step-item w-full ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
              >
                <span className="wizard-step-index">
                  {isComplete ? '✓' : `0${index + 1}`}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-fg">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-fg-muted">
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </section>

        <section className="panel p-5 fade-in fade-in-late">
          <h3 className="text-lg font-semibold tracking-tight text-fg">
            현재 준비 상태
          </h3>
          <div className="mt-5 space-y-4">
            <SummaryRow label="GitHub 인증" value={githubUser ? '완료' : '대기'} />
            <SummaryRow label="동기화 계정" value={`${activeAccounts.length}개`} />
            <SummaryRow label="Notion 연결" value={notionResult ? '완료' : '대기'} />
            <SummaryRow label="속성 매핑" value={`${mappedPropertyCount}개`} />
          </div>
        </section>
      </aside>

      <section className="panel panel-spacious fade-in flex min-h-0 flex-col">
        <div className="flex shrink-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">Step {step + 1}</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {currentStep.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
              {currentStep.description}
            </p>
          </div>
          <div className="subtle-chip">
            진행률 {step + 1} / {STEPS.length}
          </div>
        </div>

        <div className="scroll-pane mt-6 flex-1 pr-1">
          {step === 0 && (
            <WizardSection>
              <Field label="GitHub Personal Access Token">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(event) => {
                      setGithubToken(event.target.value)
                      setGithubUser(null)
                      setGithubError('')
                    }}
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={testGithub}
                    disabled={!githubToken || githubTesting}
                    className="primary-button md:min-w-[160px]"
                  >
                    {githubTesting ? '검사 중...' : '연결 테스트'}
                  </button>
                </div>
              </Field>

              {githubUser && (
                <StatusMessage tone="success">
                  연결 완료: {githubUser.name || githubUser.login} ({githubUser.login})
                </StatusMessage>
              )}

              {githubError && (
                <StatusMessage tone="error">
                  {githubError}
                </StatusMessage>
              )}
            </WizardSection>
          )}

          {step === 1 && (
            <WizardSection>
              <p className="text-sm leading-6 text-fg-muted">
                동기화할 GitHub 사용자 또는 조직 계정을 추가하고, 각 계정이 실제로 접근 가능한지 미리보기로 확인합니다.
              </p>

              <div className="space-y-3">
                {accounts.map((account, index) => (
                  <div key={index} className="rounded-[24px] border border-edge bg-surface/70 p-4">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_180px_1fr_auto_auto] md:items-end">
                      <Field label="계정 이름">
                        <input
                          type="text"
                          value={account.name}
                          onChange={(event) => updateAccount(index, 'name', event.target.value)}
                          placeholder="username 또는 organization"
                        />
                      </Field>

                      <Field label="유형">
                        <select
                          value={account.type}
                          onChange={(event) => updateAccount(index, 'type', event.target.value)}
                        >
                          <option value="user">User</option>
                          <option value="org">Organization</option>
                        </select>
                      </Field>

                      <Field label="표시 라벨">
                        <input
                          type="text"
                          value={account.label}
                          onChange={(event) => updateAccount(index, 'label', event.target.value)}
                          placeholder="예: Personal, Team"
                        />
                      </Field>

                      <button
                        type="button"
                        onClick={() => previewAccount(index)}
                        disabled={!githubToken || !account.name || previewLoading[index]}
                        className="secondary-button"
                      >
                        {previewLoading[index] ? '불러오는 중' : '미리보기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeAccount(index)}
                        className="secondary-button"
                      >
                        제거
                      </button>
                    </div>

                    {accountPreviews[index] && (
                      <StatusMessage tone="success">
                        감지된 저장소 {accountPreviews[index].count_preview}개
                        {accountPreviews[index].repos?.length > 0 && (
                          <span className="block pt-1 text-xs opacity-80">
                            {accountPreviews[index].repos.join(', ')}
                          </span>
                        )}
                      </StatusMessage>
                    )}

                    {accountErrors[index] && (
                      <StatusMessage tone="error">
                        {accountErrors[index]}
                      </StatusMessage>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={addAccount} className="secondary-button">
                계정 추가
              </button>
            </WizardSection>
          )}

          {step === 2 && (
            <WizardSection>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Notion Integration Token">
                  <input
                    type="password"
                    value={notionToken}
                    onChange={(event) => {
                      setNotionToken(event.target.value)
                      setNotionResult(null)
                      setNotionError('')
                    }}
                    placeholder="ntn_xxxxxxxxxxxx"
                  />
                </Field>

                <Field label="Database ID">
                  <input
                    type="text"
                    value={notionDbId}
                    onChange={(event) => {
                      setNotionDbId(event.target.value)
                      setNotionResult(null)
                      setNotionError('')
                    }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={testNotion}
                disabled={!notionToken || !notionDbId || notionTesting}
                className="primary-button"
              >
                {notionTesting ? '검사 중...' : '데이터베이스 확인'}
              </button>

              {notionResult && (
                <StatusMessage tone="success">
                  연결 완료: <strong>{notionResult.title || '제목 없음'}</strong>
                  <span className="mt-2 block text-xs opacity-80">
                    감지된 속성: {Object.entries(notionResult.properties || {}).map(([name, type]) => `${name} (${type})`).join(', ')}
                  </span>
                </StatusMessage>
              )}

              {notionError && (
                <StatusMessage tone="error">
                  {notionError}
                </StatusMessage>
              )}
            </WizardSection>
          )}

          {step === 3 && (
            <WizardSection>
              <p className="text-sm leading-6 text-fg-muted">
                감지된 Notion 속성과 GitHub 메타데이터를 연결합니다. 기본값은 자동으로 맞춰지며 필요한 경우 직접 수정할 수 있습니다.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                {PROPERTY_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <select
                      value={propertyMap[field.key] || ''}
                      onChange={(event) => setPropertyMap((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))}
                    >
                      <option value="">선택 안 함</option>
                      {Object.keys(notionResult?.properties || {}).map((propertyName) => (
                        <option key={propertyName} value={propertyName}>
                          {propertyName}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </WizardSection>
          )}

          {step === 4 && (
            <WizardSection>
              <div className="overflow-hidden rounded-[24px] border border-edge">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <ReviewRow label="GitHub Token" value={maskToken(githubToken)} />
                    <ReviewRow label="GitHub 사용자" value={githubUser?.login || '-'} />
                    <ReviewRow
                      label="동기화 계정"
                      value={activeAccounts.map((account) => account.label || account.name).join(', ') || '-'}
                    />
                    <ReviewRow label="Notion Token" value={maskToken(notionToken)} />
                    <ReviewRow label="Notion DB" value={notionResult?.title || notionDbId || '-'} />
                    <ReviewRow
                      label="속성 매핑"
                      value={PROPERTY_FIELDS
                        .filter((field) => propertyMap[field.key])
                        .map((field) => `${field.label}: ${propertyMap[field.key]}`)
                        .join(' · ') || '-'}
                      isLast
                    />
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Webhook Secret">
                  <input
                    type="password"
                    value={webhookSecret}
                    onChange={(event) => setWebhookSecret(event.target.value)}
                    placeholder="선택 사항"
                  />
                </Field>

                <Field label="예외 라벨">
                  <input
                    type="text"
                    value={visibilityError}
                    onChange={(event) => setVisibilityError(event.target.value)}
                    placeholder="Error"
                  />
                </Field>
              </div>

              {saveError && (
                <StatusMessage tone="error">
                  {saveError}
                </StatusMessage>
              )}
            </WizardSection>
          )}
        </div>

        <div className="mt-6 flex shrink-0 flex-col gap-3 border-t border-edge pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
            disabled={step === 0}
            className="secondary-button"
          >
            이전 단계
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev + 1)}
              disabled={!canNext()}
              className="primary-button"
            >
              다음 단계
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="primary-button"
            >
              {saving ? '저장 중...' : '설정 저장 후 대시보드 시작'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function WizardSection({ children }) {
  return (
    <div className="space-y-4">
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusMessage({ tone, children }) {
  const toneClass = tone === 'error'
    ? 'border-err-soft bg-err-soft text-err-text'
    : 'border-ok-soft bg-ok-soft text-ok-text'

  return (
    <div className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${toneClass}`}>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="text-sm font-semibold text-fg">{value}</span>
    </div>
  )
}

function ReviewRow({ label, value, isLast = false }) {
  return (
    <tr className={isLast ? '' : 'border-b border-edge'}>
      <td className="w-40 bg-surface-tertiary px-4 py-3 text-sm text-fg-muted">
        {label}
      </td>
      <td className="px-4 py-3 text-sm text-fg">
        {value}
      </td>
    </tr>
  )
}
