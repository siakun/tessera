export default function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="text-sm font-semibold text-fg">{value}</span>
    </div>
  )
}
