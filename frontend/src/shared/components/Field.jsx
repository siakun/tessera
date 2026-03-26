export default function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-faint">
        {label}
      </span>
      {children}
    </label>
  )
}
