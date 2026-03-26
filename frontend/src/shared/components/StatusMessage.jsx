export default function StatusMessage({ tone, children }) {
  const toneClass = tone === 'error'
    ? 'border-err-soft bg-err-soft text-err-text'
    : 'border-ok-soft bg-ok-soft text-ok-text'

  return (
    <div className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${toneClass}`}>
      {children}
    </div>
  )
}
