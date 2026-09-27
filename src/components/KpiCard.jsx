// A single headline number. `trend` is an optional { value, text, label }: value is the
// signed ratio (sets the arrow direction), text its formatted form. Arrow + words, never color alone.
function KpiCard({ label, value, hint, trend, delay = 0 }) {
  return (
    <div
      className="rise min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs tracking-wide text-muted sm:text-sm">{label}</p>
      <p className="mt-2 text-2xl font-light tracking-tight text-ink tabular-nums sm:mt-3 sm:text-4xl">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted sm:text-sm">{hint}</p>}
      {trend && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs whitespace-nowrap text-ink-2">
          <svg viewBox="0 0 12 12" className={`size-3 ${trend.value < 0 ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M6 2.5 10 8H2z" fill="currentColor" />
          </svg>
          <span className="font-medium tabular-nums">{trend.text}</span>
          <span className="text-muted">{trend.label}</span>
        </p>
      )}
    </div>
  )
}

export default KpiCard
