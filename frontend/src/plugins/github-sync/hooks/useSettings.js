import { useCallback, useEffect, useMemo, useState } from 'react'
import { pluginApi } from '../../../shared/api/client'
import { PROPERTY_FIELDS, createEmptyAccount } from '../../../shared/constants/formHelpers'

const api = pluginApi('github-sync')

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

/**
 * Settings 폼 관리 Hook.
 *
 * WPF 비유: SettingsViewModel에 해당.
 * 폼 상태, 로딩, 저장, 토스트를 모두 관리한다.
 *
 * @returns {{ form, loading, saving, toast, connectedAccounts, mappedProperties,
 *   handleChange, handlePropertyChange, handleAccountChange, addAccount, removeAccount, handleSave, ACCOUNT_TYPES }}
 */
export default function useSettings() {
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
      const data = await api.get('/settings')
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
      await api.post('/settings', form)
      showToast('설정이 저장되었습니다.')
    } catch {
      showToast('설정을 저장하지 못했습니다.', true)
    } finally {
      setSaving(false)
    }
  }

  const connectedAccounts = useMemo(() => form.github_accounts.filter((a) => a.name.trim()), [form.github_accounts])
  const mappedProperties = useMemo(() => Object.values(form.notion_properties).filter(Boolean).length, [form.notion_properties])

  return {
    form, loading, saving, toast,
    connectedAccounts, mappedProperties,
    handleChange, handlePropertyChange, handleAccountChange,
    addAccount, removeAccount, handleSave,
    ACCOUNT_TYPES,
  }
}
