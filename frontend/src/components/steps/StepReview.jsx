import Field from '../../shared/components/Field'
import StatusMessage from '../../shared/components/StatusMessage'
import { PROPERTY_FIELDS } from '../../shared/constants/formHelpers'

export default function StepReview({ wizard }) {
  const {
    githubToken, githubUser, activeAccounts, notionToken, notionResult, notionDbId,
    propertyMap, webhookSecret, setWebhookSecret, visibilityError, setVisibilityError,
    saveError, maskToken,
  } = wizard

  return (
    <div className="space-y-4">
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
