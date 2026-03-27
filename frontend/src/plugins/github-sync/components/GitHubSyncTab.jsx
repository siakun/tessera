import { useState } from 'react'
import Field from '../../../shared/components/Field'
import Spinner from '../../../shared/components/Spinner'
import SummaryRow from '../../../shared/components/SummaryRow'
import { PROPERTY_FIELDS } from '../../../shared/constants/formHelpers'
import {
  formatDateTime,
  formatLogDetail,
  formatLogTitle,
  formatRelativeTime,
  getLogMeta,
} from '../../../shared/utils/formatters'
import useSettings from '../hooks/useSettings'
import useLogs from '../hooks/useLogs'

/**
 * GitHub Sync 플러그인 통합 탭.
 *
 * 설정 폼 + 동기화 로그를 하나의 뷰에서 관리한다.
 * 기존 SettingsTab + LogsTab을 병합.
 */
export default function GitHubSyncTab() {
  const {
    form, loading, saving, toast,
    connectedAccounts, mappedProperties,
    handleChange, handlePropertyChange, handleAccountChange,
    addAccount, removeAccount, handleSave,
    ACCOUNT_TYPES,
  } = useSettings()

  const { logs, activeFilter, setActiveFilter, filteredLogs, counts, copied, handleCopy, FILTERS } = useLogs()
  const [logsOpen, setLogsOpen] = useState(true)

  if (loading) {
    return (
      <div className="panel panel-spacious fade-in flex h-full items-center justify-center text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary text-fg-muted">
          <Spinner className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-fg">
          설정을 불러오는 중입니다
        </h2>
      </div>
    )
  }

  return (
    <div className="scroll-pane h-full space-y-5 pr-1">
      {/* ── 설정 요약 ── */}
      <section className="panel p-5 fade-in">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="연결 계정" value={`${connectedAccounts.length}개`} />
          <SummaryTile label="속성 매핑" value={`${mappedProperties}개`} />
          <SummaryTile label="오류 라벨" value={form.visibility_error || '-'} />
        </div>
        <div className="mt-4 space-y-2">
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

      {/* ── 설정 폼 ── */}
      <ConfigSection
        title="GitHub 액세스"
        description="동기화에 사용할 개인 액세스 토큰과 Webhook 보안 시크릿을 관리합니다."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Personal Access Token">
            <input
              type="password"
              value={form.github_token}
              onChange={(e) => handleChange('github_token', e.target.value)}
              placeholder="ghp_..."
            />
          </Field>
          <Field label="Webhook Secret">
            <input
              type="password"
              value={form.github_webhook_secret}
              onChange={(e) => handleChange('github_webhook_secret', e.target.value)}
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
                    onChange={(e) => handleAccountChange(index, 'name', e.target.value)}
                    placeholder="username 또는 organization"
                  />
                </Field>
                <Field label="유형">
                  <select
                    value={account.type}
                    onChange={(e) => handleAccountChange(index, 'type', e.target.value)}
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="표시 라벨">
                  <input
                    type="text"
                    value={account.label}
                    onChange={(e) => handleAccountChange(index, 'label', e.target.value)}
                    placeholder="예: Personal, Work"
                  />
                </Field>
                <button type="button" onClick={() => removeAccount(index)} className="secondary-button min-w-[92px]">
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
              onChange={(e) => handleChange('notion_token', e.target.value)}
              placeholder="secret_..."
            />
          </Field>
          <Field label="Database ID">
            <input
              type="text"
              value={form.notion_database_id}
              onChange={(e) => handleChange('notion_database_id', e.target.value)}
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
                onChange={(e) => handlePropertyChange(field.key, e.target.value)}
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
            onChange={(e) => handleChange('visibility_error', e.target.value)}
            placeholder="Error"
          />
        </Field>
      </ConfigSection>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className="primary-button">
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {/* ── 동기화 로그 (접기/펴기) ── */}
      <section className="panel fade-in fade-in-delayed overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-5 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">
              동기화 로그
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              최근 100개의 서버 로그 · {logs.length}개
            </p>
          </div>
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-fg-muted transition-transform ${logsOpen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {logsOpen && (
          <div className="border-t border-edge">
            {/* 필터 + 복사 */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-4">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    activeFilter === filter.key
                      ? 'border-transparent bg-accent-soft text-accent-text'
                      : 'border-edge bg-surface-elevated text-fg-muted hover:text-fg'
                  }`}
                >
                  {filter.label}
                  <span className="ml-2 text-xs text-fg-faint">{counts[filter.key] ?? 0}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleCopy}
                disabled={filteredLogs.length === 0}
                className="secondary-button ml-auto"
              >
                {copied ? '복사 완료' : '복사'}
              </button>
            </div>

            {/* 로그 목록 */}
            {filteredLogs.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-fg-muted">
                선택한 필터에 해당하는 로그가 없습니다.
              </div>
            ) : (
              <div className="max-h-[400px] divide-y divide-edge overflow-y-auto">
                {filteredLogs.map((log, index) => {
                  const meta = getLogMeta(log.type)
                  return (
                    <div
                      key={`${log.timestamp}-${index}`}
                      className="grid gap-4 px-6 py-4 transition-colors hover:bg-surface-hover/70 lg:grid-cols-[190px_minmax(0,1fr)_auto]"
                    >
                      <div className="font-mono text-xs leading-6 text-fg-faint">
                        {formatDateTime(log.timestamp)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                          <h3 className="text-sm font-semibold text-fg">{formatLogTitle(log)}</h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-fg-muted">{formatLogDetail(log)}</p>
                      </div>
                      <div className="text-xs text-fg-faint lg:text-right">
                        {formatRelativeTime(log.timestamp)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function ConfigSection({ title, description, children }) {
  return (
    <section className="panel p-6 fade-in fade-in-delayed">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-[24px] border border-edge bg-surface/70 px-4 py-4">
      <div className="metric-label">{label}</div>
      <div className="mt-3 text-lg font-semibold tracking-tight text-fg">{value}</div>
    </div>
  )
}
