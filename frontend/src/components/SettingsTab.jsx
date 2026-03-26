import { useCallback, useEffect, useMemo, useState } from 'react'
import Field from '../shared/components/Field'
import Spinner from '../shared/components/Spinner'
import SummaryRow from '../shared/components/SummaryRow'
import { PROPERTY_FIELDS, createEmptyAccount } from '../shared/constants/formHelpers'

const DEFAULT_PROPERTIES = PROPERTY_FIELDS.reduce((result, field) => {
  result[field.key] = field.placeholder
  return result
}, {})

const ACCOUNT_TYPES = [
  { value: 'user', label: 'User' },
  { value: 'org', label: 'Organization' },
]

function createInitialForm() {
  return {
    github_token: '',
    github_webhook_secret: '',
    github_accounts: [createEmptyAccount()],
    notion_token: '',
    notion_database_id: '',
    notion_properties: { ...DEFAULT_PROPERTIES },
    visibility_error: 'Error',
  }
}

function parseSettings(data) {
  const github = data.github ?? {}
  const notion = data.notion ?? {}
  const visibility = data.visibility ?? {}

  return {
    github_token: github.token ?? '',
    github_webhook_secret: github.webhook_secret ?? '',
    github_accounts: github.accounts?.length ? github.accounts : [createEmptyAccount()],
    notion_token: notion.token ?? '',
    notion_database_id: notion.database_id ?? '',
    notion_properties: {
      ...DEFAULT_PROPERTIES,
      ...(notion.properties ?? {}),
    },
    visibility_error: visibility.error ?? 'Error',
  }
}

export default function SettingsTab() {
  const [form, setForm] = useState(createInitialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError })
  }, [])

  useEffect(() => {
    if (!toast) return undefined

    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const fetchSettings = useCallback(async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/plugins/github-sync/settings')
      if (!res.ok) throw new Error('설정을 불러올 수 없습니다.')

      const data = await res.json()
      setForm(parseSettings(data))
    } catch {
      showToast('설정을 불러오지 못했습니다.', true)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handlePropertyChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      notion_properties: {
        ...prev.notion_properties,
        [key]: value,
      },
    }))
  }

  const handleAccountChange = (index, key, value) => {
    setForm((prev) => {
      const nextAccounts = [...prev.github_accounts]
      nextAccounts[index] = { ...nextAccounts[index], [key]: value }
      return { ...prev, github_accounts: nextAccounts }
    })
  }

  const addAccount = () => {
    setForm((prev) => ({
      ...prev,
      github_accounts: [...prev.github_accounts, createEmptyAccount()],
    }))
  }

  const removeAccount = (index) => {
    setForm((prev) => {
      const nextAccounts = prev.github_accounts.filter((_, accountIndex) => accountIndex !== index)
      return {
        ...prev,
        github_accounts: nextAccounts.length > 0 ? nextAccounts : [createEmptyAccount()],
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const res = await fetch('/api/plugins/github-sync/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) throw new Error('설정을 저장할 수 없습니다.')
      showToast('설정이 저장되었습니다.')
    } catch {
      showToast('설정을 저장하지 못했습니다.', true)
    } finally {
      setSaving(false)
    }
  }

  const connectedAccounts = useMemo(() => form.github_accounts.filter((a) => a.name.trim()), [form.github_accounts])
  const mappedProperties = useMemo(() => Object.values(form.notion_properties).filter(Boolean).length, [form.notion_properties])

  if (loading) {
    return (
      <div className="panel panel-spacious fade-in flex h-full items-center justify-center text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary text-fg-muted">
          <Spinner className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-fg">
          설정을 불러오는 중입니다
        </h2>
        <p className="mt-3 text-sm leading-6 text-fg-muted">
          현재 config.toml과 Notion 매핑 상태를 읽어오는 동안 잠시만 기다려 주세요.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 xl:grid xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="shrink-0 space-y-5 xl:min-h-0">
        <section className="panel panel-spacious fade-in">
          <div>
            <div className="eyebrow">Settings</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              연결 설정을 모던한 운영 폼으로 재정리했습니다
            </h1>
            <p className="mt-3 text-sm leading-6 text-fg-muted">
              GitHub 토큰, 동기화 대상 계정, Notion 데이터베이스, 속성 매핑을 viewport 안에서 관리할 수 있도록 정리했습니다.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <SummaryTile label="연결 계정" value={`${connectedAccounts.length}개`} />
            <SummaryTile label="속성 매핑" value={`${mappedProperties}개`} />
            <SummaryTile label="오류 라벨" value={form.visibility_error || '-'} />
          </div>
        </section>

        <section className="panel p-5 fade-in fade-in-delayed">
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            현재 구성 요약
          </h2>
          <div className="mt-5 space-y-4">
            <SummaryRow label="GitHub Token" value={form.github_token ? '입력됨' : '비어 있음'} />
            <SummaryRow label="Notion Token" value={form.notion_token ? '입력됨' : '비어 있음'} />
            <SummaryRow label="Database ID" value={form.notion_database_id ? '연결됨' : '미입력'} />
            <SummaryRow label="Webhook Secret" value={form.github_webhook_secret ? '사용 중' : '미사용'} />
          </div>
        </section>

        {toast && (
          <div className={`notice-inline fade-in ${toast.isError ? 'is-error' : 'is-success'}`}>
            {toast.message}
          </div>
        )}
      </aside>

      <div className="scroll-pane flex-1 space-y-5 pr-1 xl:h-full">
        <section className="panel p-5 fade-in">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              빠른 편집
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-fg-muted">
              각 영역은 독립 패널로 나누어 한 화면 안에서 바로 수정할 수 있게 유지했습니다.
            </p>
          </div>
        </div>
      </section>

          <ConfigSection
            title="GitHub 액세스"
            description="동기화에 사용할 개인 액세스 토큰과 Webhook 보안 시크릿을 관리합니다."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Personal Access Token">
                <input
                  type="password"
                  value={form.github_token}
                  onChange={(event) => handleChange('github_token', event.target.value)}
                  placeholder="ghp_..."
                />
              </Field>
              <Field label="Webhook Secret">
                <input
                  type="password"
                  value={form.github_webhook_secret}
                  onChange={(event) => handleChange('github_webhook_secret', event.target.value)}
                  placeholder="선택 사항"
                />
              </Field>
            </div>
          </ConfigSection>

          <ConfigSection
            title="동기화 대상 계정"
            description="개인 계정과 조직 계정을 함께 운영할 수 있도록 행 단위로 관리합니다."
          >
            <div className="space-y-3">
              {form.github_accounts.map((account, index) => (
                <div key={index} className="rounded-[24px] border border-edge bg-surface/70 p-4">
                  <div className="grid gap-3 md:grid-cols-[1.2fr_180px_1fr_auto] md:items-end">
                    <Field label="계정 이름">
                      <input
                        type="text"
                        value={account.name}
                        onChange={(event) => handleAccountChange(index, 'name', event.target.value)}
                        placeholder="username 또는 organization"
                      />
                    </Field>
                    <Field label="유형">
                      <select
                        value={account.type}
                        onChange={(event) => handleAccountChange(index, 'type', event.target.value)}
                      >
                        {ACCOUNT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="표시 라벨">
                      <input
                        type="text"
                        value={account.label}
                        onChange={(event) => handleAccountChange(index, 'label', event.target.value)}
                        placeholder="예: Personal, Work"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => removeAccount(index)}
                      className="secondary-button min-w-[92px]"
                    >
                      제거
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addAccount} className="secondary-button mt-4">
              계정 추가
            </button>
          </ConfigSection>

          <ConfigSection
            title="Notion 데이터베이스"
            description="자동화가 반영될 Integration Token과 Database ID를 설정합니다."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Integration Token">
                <input
                  type="password"
                  value={form.notion_token}
                  onChange={(event) => handleChange('notion_token', event.target.value)}
                  placeholder="secret_..."
                />
              </Field>
              <Field label="Database ID">
                <input
                  type="text"
                  value={form.notion_database_id}
                  onChange={(event) => handleChange('notion_database_id', event.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </Field>
            </div>
          </ConfigSection>

          <ConfigSection
            title="속성 매핑"
            description="Notion 데이터베이스 컬럼 이름과 GitHub 메타데이터 필드를 매핑합니다."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {PROPERTY_FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  <input
                    type="text"
                    value={form.notion_properties[field.key] ?? ''}
                    onChange={(event) => handlePropertyChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                </Field>
              ))}
            </div>
          </ConfigSection>

          <ConfigSection
            title="예외 처리 라벨"
            description="repository-id가 맞지 않는 행을 Notion에서 어떤 라벨로 표시할지 지정합니다."
          >
            <Field label="Visibility Error Label">
              <input
                type="text"
                value={form.visibility_error}
                onChange={(event) => handleChange('visibility_error', event.target.value)}
                placeholder="Error"
              />
            </Field>
          </ConfigSection>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="primary-button"
            >
              {saving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
      </div>
    </div>
  )
}

function ConfigSection({ title, description, children }) {
  return (
    <section className="panel p-6 fade-in fade-in-delayed">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-fg">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-[24px] border border-edge bg-surface/70 px-4 py-4">
      <div className="metric-label">{label}</div>
      <div className="mt-3 text-lg font-semibold tracking-tight text-fg">
        {value}
      </div>
    </div>
  )
}

