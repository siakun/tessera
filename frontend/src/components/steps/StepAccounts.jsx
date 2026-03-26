import Field from '../../shared/components/Field'
import StatusMessage from '../../shared/components/StatusMessage'

export default function StepAccounts({ wizard }) {
  const {
    githubToken, accounts, accountPreviews, accountErrors, previewLoading,
    addAccount, removeAccount, updateAccount, previewAccount,
  } = wizard

  return (
    <div className="space-y-4">
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
                연결 확인 — 저장소 {accountPreviews[index].count_preview}개 이상 감지
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
    </div>
  )
}
