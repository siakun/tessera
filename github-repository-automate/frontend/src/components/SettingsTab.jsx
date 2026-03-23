import { useState, useEffect } from 'react'

const PROPERTY_FIELDS = [
  { key: 'name', label: '이름', placeholder: 'Name' },
  { key: 'url', label: 'URL', placeholder: 'URL' },
  { key: 'description', label: '설명', placeholder: 'Description' },
  { key: 'last_commit', label: '마지막 커밋', placeholder: 'Last Commit' },
  { key: 'commit_count', label: '커밋 개수', placeholder: 'Commit Count' },
  { key: 'visibility', label: '공유여부', placeholder: 'Visibility' },
  { key: 'repo_id', label: '리포 ID', placeholder: 'repository-id' },
]

const ACCOUNT_TYPES = ['user', 'org']

export default function SettingsTab() {
  const [form, setForm] = useState({
    github_token: '',
    webhook_secret: '',
    github_accounts: [],
    notion_token: '',
    notion_database_id: '',
    property_name: '',
    property_url: '',
    property_description: '',
    property_last_commit: '',
    property_commit_count: '',
    property_visibility: '',
    property_repo_id: '',
    error_label: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setForm({
        github_token: data.github_token ?? '',
        webhook_secret: data.webhook_secret ?? '',
        github_accounts: data.github_accounts ?? [],
        notion_token: data.notion_token ?? '',
        notion_database_id: data.notion_database_id ?? '',
        property_name: data.property_name ?? '',
        property_url: data.property_url ?? '',
        property_description: data.property_description ?? '',
        property_last_commit: data.property_last_commit ?? '',
        property_commit_count: data.property_commit_count ?? '',
        property_visibility: data.property_visibility ?? '',
        property_repo_id: data.property_repo_id ?? '',
        error_label: data.error_label ?? '',
      })
    } catch {
      showToast('설정을 불러오지 못했습니다.', true)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError })
    setTimeout(() => setToast(''), 3000)
  }

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleAccountChange = (index, key, value) => {
    setForm(prev => {
      const accounts = [...prev.github_accounts]
      accounts[index] = { ...accounts[index], [key]: value }
      return { ...prev, github_accounts: accounts }
    })
  }

  const addAccount = () => {
    setForm(prev => ({
      ...prev,
      github_accounts: [...prev.github_accounts, { name: '', type: 'user', label: '' }],
    }))
  }

  const removeAccount = (index) => {
    setForm(prev => ({
      ...prev,
      github_accounts: prev.github_accounts.filter((_, i) => i !== index),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      showToast('설정이 저장되었습니다.')
    } catch {
      showToast('저장에 실패했습니다.', true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-[640px] mx-auto py-8 flex items-center justify-center text-fg-muted text-sm">
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        로딩 중...
      </div>
    )
  }

  return (
    <div className="max-w-[640px] mx-auto">

      {/* GitHub */}
      <Section title="GitHub">
        <Field label="Token">
          <input
            type="password"
            value={form.github_token}
            onChange={e => handleChange('github_token', e.target.value)}
            placeholder="ghp_..."
          />
        </Field>
        <Field label="Webhook Secret">
          <input
            type="text"
            value={form.webhook_secret}
            onChange={e => handleChange('webhook_secret', e.target.value)}
            placeholder="webhook secret"
          />
        </Field>
      </Section>

      {/* GitHub 계정 */}
      <Section title="GitHub 계정">
        {form.github_accounts.map((account, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center">
            <input
              type="text"
              value={account.name}
              onChange={e => handleAccountChange(i, 'name', e.target.value)}
              placeholder="이름"
            />
            <select
              value={account.type}
              onChange={e => handleAccountChange(i, 'type', e.target.value)}
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              value={account.label}
              onChange={e => handleAccountChange(i, 'label', e.target.value)}
              placeholder="라벨"
            />
            <button
              onClick={() => removeAccount(i)}
              className="w-7 h-7 flex items-center justify-center text-fg-muted hover:text-err-text hover:bg-err-soft rounded"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addAccount}
          className="text-accent-text hover:text-accent-hover text-sm font-medium"
        >
          + 계정 추가
        </button>
      </Section>

      {/* Notion */}
      <Section title="Notion">
        <Field label="Token">
          <input
            type="password"
            value={form.notion_token}
            onChange={e => handleChange('notion_token', e.target.value)}
            placeholder="secret_..."
          />
        </Field>
        <Field label="Database ID">
          <input
            type="text"
            value={form.notion_database_id}
            onChange={e => handleChange('notion_database_id', e.target.value)}
            placeholder="database id"
          />
        </Field>
      </Section>

      {/* Notion 속성명 */}
      <Section title="Notion 속성명">
        {PROPERTY_FIELDS.map(f => (
          <Field key={f.key} label={f.label}>
            <input
              type="text"
              value={form[`property_${f.key}`]}
              onChange={e => handleChange(`property_${f.key}`, e.target.value)}
              placeholder={f.placeholder}
            />
          </Field>
        ))}
      </Section>

      {/* 기타 */}
      <Section title="기타">
        <Field label="Error Label">
          <input
            type="text"
            value={form.error_label}
            onChange={e => handleChange('error_label', e.target.value)}
            placeholder="error label"
          />
        </Field>
      </Section>

      {/* Toast + Save */}
      <div className="flex items-center gap-3 mt-2">
        {toast && (
          <div className={`rounded px-3 py-2 text-sm ${toast.isError ? 'bg-err-soft text-err-text' : 'bg-ok-soft text-ok-text'}`}>
            {toast.msg}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border border-edge-focus rounded-lg mb-5">
      <div className="flex items-center px-4 py-2 bg-surface-tertiary rounded-t-[7px]">
        <span className="text-xs font-semibold text-fg-muted">{title}</span>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] text-fg-muted mb-1 block">{label}</label>
      {children}
    </div>
  )
}
