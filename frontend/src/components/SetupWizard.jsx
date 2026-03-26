import SummaryRow from '../shared/components/SummaryRow'
import useSetupWizard from '../plugins/github-sync/hooks/useSetupWizard'
import StepGithub from './steps/StepGithub'
import StepAccounts from './steps/StepAccounts'
import StepNotion from './steps/StepNotion'
import StepMapping from './steps/StepMapping'
import StepReview from './steps/StepReview'

export default function SetupWizard({ onComplete, isReconfigure = false }) {
  const wizard = useSetupWizard(onComplete, isReconfigure)

  const {
    step, setStep, currentStep, reachableStep, STEPS,
    githubUser, notionResult, activeAccounts, mappedPropertyCount,
    saving, handleSave,
  } = wizard

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
                disabled={index > reachableStep}
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
          {step === 0 && <StepGithub wizard={wizard} />}
          {step === 1 && <StepAccounts wizard={wizard} />}
          {step === 2 && <StepNotion wizard={wizard} />}
          {step === 3 && <StepMapping wizard={wizard} />}
          {step === 4 && <StepReview wizard={wizard} />}
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
              disabled={step >= reachableStep}
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
