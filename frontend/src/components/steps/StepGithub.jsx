import Field from '../../shared/components/Field'
import StatusMessage from '../../shared/components/StatusMessage'

export default function StepGithub({ wizard }) {
  const { githubToken, handleGithubTokenChange, githubUser, githubError, githubTesting, testGithub } = wizard

  return (
    <div className="space-y-4">
      <Field label="GitHub Personal Access Token">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="password"
            value={githubToken}
            onChange={(event) => handleGithubTokenChange(event.target.value)}
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
          계정 연결이 확인되었습니다. API 키가 유효합니다.
          <span className="block pt-1 text-xs opacity-80">
            {githubUser.name || githubUser.login} ({githubUser.login})
          </span>
        </StatusMessage>
      )}

      {githubError && (
        <StatusMessage tone="error">
          {githubError}
        </StatusMessage>
      )}
    </div>
  )
}
