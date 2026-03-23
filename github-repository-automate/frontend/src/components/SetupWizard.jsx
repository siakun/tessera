/**
 * SetupWizard - 5단계 초기 설정 마법사
 */
import { useState } from 'react'

const STEPS = [
  { label: 'GitHub 토큰' },
  { label: 'GitHub 계정' },
  { label: 'Notion 연결' },
  { label: '속성 매핑' },
  { label: '검토 및 저장' },
]

const PROPERTY_FIELDS = [
  { key: 'name', label: '이름', defaultMatch: 'Name' },
  { key: 'url', label: 'URL', defaultMatch: 'URL' },
  { key: 'description', label: '설명', defaultMatch: 'Description' },
  { key: 'last_commit', label: '마지막 커밋', defaultMatch: 'Last Commit' },
  { key: 'commit_count', label: '커밋 수', defaultMatch: 'Commit Count' },
  { key: 'visibility', label: '공개 여부', defaultMatch: 'Visibility' },
  { key: 'repo_id', label: '리포지토리 ID', defaultMatch: 'repository-id' },
]

function maskToken(token) {
  if (!token || token.length <= 8) return token || ''
  return token.slice(0, 4) + '****' + token.slice(-4)
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)

  // Step 1
  const [githubToken, setGithubToken] = useState('')
  const [githubUser, setGithubUser] = useState(null)
  const [githubError, setGithubError] = useState('')
  const [githubTesting, setGithubTesting] = useState(false)

  // Step 2
  const [accounts, setAccounts] = useState([{ name: '', type: 'user', label: '' }])
  const [accountPreviews, setAccountPreviews] = useState({})
  const [accountErrors, setAccountErrors] = useState({})
  const [previewLoading, setPreviewLoading] = useState({})

  // Step 3
  const [notionToken, setNotionToken] = useState('')
  const [notionDbId, setNotionDbId] = useState('')
  const [notionResult, setNotionResult] = useState(null)
  const [notionError, setNotionError] = useState('')
  const [notionTesting, setNotionTesting] = useState(false)

  // Step 4
  const [propertyMap, setPropertyMap] = useState({})

  // Step 5
  const [webhookSecret, setWebhookSecret] = useState('')
  const [visibilityError, setVisibilityError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Step 1: GitHub 토큰 테스트 ──

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
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setGithubUser(data)
    } catch (e) {
      setGithubError(e.message || '연결 실패')
    } finally {
      setGithubTesting(false)
    }
  }

  // ── Step 2: 계정 관리 ──

  const addAccount = () => {
    setAccounts([...accounts, { name: '', type: 'user', label: '' }])
  }

  const removeAccount = (idx) => {
    setAccounts(accounts.filter((_, i) => i !== idx))
    setAccountPreviews((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
    setAccountErrors((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }

  const updateAccount = (idx, field, value) => {
    setAccounts(accounts.map((a, i) => (i === idx ? { ...a, [field]: value } : a)))
  }

  const previewAccount = async (idx) => {
    const acc = accounts[idx]
    if (!acc.name) return
    setPreviewLoading((p) => ({ ...p, [idx]: true }))
    setAccountErrors((p) => ({ ...p, [idx]: '' }))
    setAccountPreviews((p) => ({ ...p, [idx]: null }))
    try {
      const res = await fetch('/api/setup/test-github-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, name: acc.name, type: acc.type }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setAccountPreviews((p) => ({ ...p, [idx]: data }))
    } catch (e) {
      setAccountErrors((p) => ({ ...p, [idx]: e.message || '조회 실패' }))
    } finally {
      setPreviewLoading((p) => ({ ...p, [idx]: false }))
    }
  }

  // ── Step 3: Notion 테스트 ──

  const testNotion = async () => {
    setNotionTesting(true)
    setNotionError('')
    setNotionResult(null)
    try {
      const res = await fetch('/api/setup/test-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: notionToken, database_id: notionDbId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setNotionResult(data)
      // Auto-match property defaults
      const props = data.properties || {}
      const propNames = Object.keys(props)
      const autoMap = {}
      PROPERTY_FIELDS.forEach((f) => {
        const match = propNames.find(
          (p) => p.toLowerCase() === f.defaultMatch.toLowerCase()
        )
        if (match) autoMap[f.key] = match
      })
      setPropertyMap(autoMap)
    } catch (e) {
      setNotionError(e.message || '연결 실패')
    } finally {
      setNotionTesting(false)
    }
  }

  // ── Step 5: 저장 ──

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
          github_accounts: accounts.filter((a) => a.name),
          notion_token: notionToken,
          notion_database_id: notionDbId,
          notion_properties: propertyMap,
          visibility_error: visibilityError,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${res.status}`)
      }
      onComplete()
    } catch (e) {
      setSaveError(e.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  // ── Navigation guard ──

  const canNext = () => {
    if (step === 0) return !!githubUser
    if (step === 1) return accounts.some((a) => a.name.trim())
    if (step === 2) return !!notionResult
    if (step === 3) return true
    return true
  }

  // ── Render helpers ──

  const renderStepIndicator = () => (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-initial">
          <div className="flex flex-col items-center">
            <div
              className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                i < step
                  ? 'bg-ok text-white'
                  : i === step
                    ? 'bg-accent text-white'
                    : 'bg-surface-widget text-fg-muted'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 text-center ${
                i < step
                  ? 'text-ok-text'
                  : i === step
                    ? 'text-accent'
                    : 'text-fg-muted'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className="flex-1 h-px bg-edge mx-1" />}
        </div>
      ))}
    </div>
  )

  const Section = ({ title, children }) => (
    <div className="border border-edge-focus rounded-lg">
      <div className="flex items-center px-4 py-2 bg-surface-tertiary rounded-t-[7px]">
        <span className="text-xs font-semibold text-fg-muted">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )

  // ── Step contents ──

  const renderStep0 = () => (
    <Section title="STEP 1 — GITHUB 토큰">
      <div>
        <label className="text-[11px] text-fg-muted mb-1 block">GitHub Personal Access Token</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => {
              setGithubToken(e.target.value)
              setGithubUser(null)
              setGithubError('')
            }}
            placeholder="ghp_xxxxxxxxxxxx"
            className="flex-1 px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
          />
          <button
            onClick={testGithub}
            disabled={!githubToken || githubTesting}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {githubTesting ? '테스트 중...' : '연결 테스트'}
          </button>
        </div>
      </div>
      {githubUser && (
        <div className="px-3 py-2 bg-ok-soft text-ok-text rounded text-sm">
          연결 성공: {githubUser.name || githubUser.login} ({githubUser.login})
        </div>
      )}
      {githubError && (
        <div className="px-3 py-2 bg-err-soft text-err-text rounded text-sm">
          {githubError}
        </div>
      )}
    </Section>
  )

  const renderStep1 = () => (
    <Section title="STEP 2 — GITHUB 계정">
      <p className="text-sm text-fg-muted">
        동기화할 GitHub 사용자 또는 조직을 추가하세요.
      </p>
      {accounts.map((acc, idx) => (
        <div key={idx} className="border border-edge rounded p-3 mb-2">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-fg-muted mb-1 block">계정 이름</label>
              <input
                type="text"
                value={acc.name}
                onChange={(e) => updateAccount(idx, 'name', e.target.value)}
                placeholder="username 또는 org-name"
                className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div className="w-28">
              <label className="text-[11px] text-fg-muted mb-1 block">유형</label>
              <select
                value={acc.type}
                onChange={(e) => updateAccount(idx, 'type', e.target.value)}
                className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg focus:outline-none focus:border-accent"
              >
                <option value="user">User</option>
                <option value="org">Organization</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-fg-muted mb-1 block">라벨 (선택)</label>
              <input
                type="text"
                value={acc.label}
                onChange={(e) => updateAccount(idx, 'label', e.target.value)}
                placeholder="표시 이름"
                className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => previewAccount(idx)}
              disabled={!acc.name || previewLoading[idx]}
              className="px-3 py-1.5 bg-surface-widget hover:bg-surface-active text-fg text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewLoading[idx] ? '...' : '미리보기'}
            </button>
            {accounts.length > 1 && (
              <button
                onClick={() => removeAccount(idx)}
                className="px-3 py-1.5 bg-surface-widget hover:bg-surface-active text-fg text-sm rounded"
              >
                삭제
              </button>
            )}
          </div>
          {accountPreviews[idx] && (
            <div className="mt-2 px-3 py-2 bg-ok-soft text-ok-text rounded text-sm">
              리포지토리 {accountPreviews[idx].count_preview}개 감지
              {accountPreviews[idx].repos?.length > 0 && (
                <span className="ml-1">
                  ({accountPreviews[idx].repos.slice(0, 5).join(', ')}
                  {accountPreviews[idx].repos.length > 5 && ' ...'})
                </span>
              )}
            </div>
          )}
          {accountErrors[idx] && (
            <div className="mt-2 px-3 py-2 bg-err-soft text-err-text rounded text-sm">
              {accountErrors[idx]}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addAccount}
        className="px-3 py-1.5 bg-surface-widget hover:bg-surface-active text-fg text-sm rounded"
      >
        + 계정 추가
      </button>
    </Section>
  )

  const renderStep2 = () => (
    <Section title="STEP 3 — NOTION 연결">
      <div>
        <label className="text-[11px] text-fg-muted mb-1 block">Notion Integration Token</label>
        <input
          type="password"
          value={notionToken}
          onChange={(e) => {
            setNotionToken(e.target.value)
            setNotionResult(null)
            setNotionError('')
          }}
          placeholder="ntn_xxxxxxxxxxxx"
          className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-[11px] text-fg-muted mb-1 block">Database ID</label>
        <input
          type="text"
          value={notionDbId}
          onChange={(e) => {
            setNotionDbId(e.target.value)
            setNotionResult(null)
            setNotionError('')
          }}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
        />
      </div>
      <button
        onClick={testNotion}
        disabled={!notionToken || !notionDbId || notionTesting}
        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {notionTesting ? '테스트 중...' : '연결 테스트'}
      </button>
      {notionResult && (
        <div className="px-3 py-2 bg-ok-soft text-ok-text rounded text-sm space-y-2">
          <div>데이터베이스: <strong>{notionResult.title}</strong></div>
          <div className="text-[11px]">
            감지된 속성:{' '}
            {Object.entries(notionResult.properties || {}).map(([name, type], i) => (
              <span key={name}>
                {i > 0 && ', '}
                {name} <span className="opacity-70">({type})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {notionError && (
        <div className="px-3 py-2 bg-err-soft text-err-text rounded text-sm">
          {notionError}
        </div>
      )}
    </Section>
  )

  const renderStep3 = () => {
    const propNames = notionResult ? Object.keys(notionResult.properties || {}) : []
    return (
      <Section title="STEP 4 — 속성 매핑">
        <p className="text-sm text-fg-muted">
          Notion 데이터베이스 속성을 각 필드에 매핑하세요.
        </p>
        <div className="space-y-2">
          {PROPERTY_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="w-32 text-sm text-fg shrink-0">{f.label}</span>
              <select
                value={propertyMap[f.key] || ''}
                onChange={(e) =>
                  setPropertyMap({ ...propertyMap, [f.key]: e.target.value })
                }
                className="flex-1 px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg focus:outline-none focus:border-accent"
              >
                <option value="">— 선택 —</option>
                {propNames.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Section>
    )
  }

  const renderStep4 = () => (
    <Section title="STEP 5 — 검토 및 저장">
      {/* Summary table */}
      <div className="border border-edge rounded overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-edge">
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary w-40">GitHub 토큰</td>
              <td className="px-3 py-2 text-fg font-mono text-xs">{maskToken(githubToken)}</td>
            </tr>
            <tr className="border-b border-edge">
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary">GitHub 사용자</td>
              <td className="px-3 py-2 text-fg">{githubUser?.login || '-'}</td>
            </tr>
            <tr className="border-b border-edge">
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary">GitHub 계정</td>
              <td className="px-3 py-2 text-fg">
                {accounts.filter((a) => a.name).map((a) => a.label || a.name).join(', ') || '-'}
              </td>
            </tr>
            <tr className="border-b border-edge">
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary">Notion 토큰</td>
              <td className="px-3 py-2 text-fg font-mono text-xs">{maskToken(notionToken)}</td>
            </tr>
            <tr className="border-b border-edge">
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary">Notion DB</td>
              <td className="px-3 py-2 text-fg">{notionResult?.title || notionDbId || '-'}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-fg-muted bg-surface-tertiary">속성 매핑</td>
              <td className="px-3 py-2 text-fg text-xs">
                {PROPERTY_FIELDS.filter((f) => propertyMap[f.key]).map((f) => (
                  <span key={f.key} className="inline-block mr-2">
                    {f.label}: {propertyMap[f.key]}
                  </span>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Additional inputs */}
      <div>
        <label className="text-[11px] text-fg-muted mb-1 block">Webhook Secret (선택)</label>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="GitHub Webhook Secret"
          className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-[11px] text-fg-muted mb-1 block">비공개 리포 오류 문구 (선택)</label>
        <input
          type="text"
          value={visibilityError}
          onChange={(e) => setVisibilityError(e.target.value)}
          placeholder="예: 비공개 리포는 동기화에서 제외됩니다"
          className="w-full px-3 py-2 bg-surface-widget border border-edge rounded text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent"
        />
      </div>

      {saveError && (
        <div className="px-3 py-2 bg-err-soft text-err-text rounded text-sm">{saveError}</div>
      )}
    </Section>
  )

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4]

  return (
    <div className="max-w-[640px] mx-auto py-10 px-4">
      {renderStepIndicator()}
      {stepRenderers[step]()}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-1.5 bg-surface-widget hover:bg-surface-active text-fg text-sm rounded"
            >
              이전
            </button>
          )}
        </div>
        <div>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
