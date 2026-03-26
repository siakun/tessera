import Field from '../../shared/components/Field'
import StatusMessage from '../../shared/components/StatusMessage'

export default function StepNotion({ wizard }) {
  const {
    notionToken, handleNotionTokenChange,
    notionDbId, handleNotionDbIdChange,
    notionResult, notionError, notionTesting, testNotion,
  } = wizard

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Notion Integration Token">
          <input
            type="password"
            value={notionToken}
            onChange={(event) => handleNotionTokenChange(event.target.value)}
            placeholder="ntn_xxxxxxxxxxxx"
          />
        </Field>

        <Field label="Database ID">
          <input
            type="text"
            value={notionDbId}
            onChange={(event) => handleNotionDbIdChange(event.target.value)}
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
          데이터베이스 연결이 확인되었습니다. 토큰이 유효합니다.
          <span className="block pt-1 text-xs opacity-80">
            DB: {notionResult.title || '제목 없음'} · 속성 {Object.keys(notionResult.properties || {}).length}개 감지
          </span>
        </StatusMessage>
      )}

      {notionError && (
        <StatusMessage tone="error">
          {notionError}
        </StatusMessage>
      )}
    </div>
  )
}
