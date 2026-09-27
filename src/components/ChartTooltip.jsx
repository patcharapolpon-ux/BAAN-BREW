import { formatBaht } from '../lib/metrics'

// Shared hover card. `series` maps dataKey → { name, color } and sets the row order.
// Values stay in text ink; the swatch carries identity. Names show only for 2+ series.
function ChartTooltip({ active, payload, label, formatLabel = (l) => l, series }) {
  if (!active || !payload?.length) return null
  const byKey = Object.fromEntries(payload.map((entry) => [entry.dataKey, entry]))
  const rows = Object.entries(series).filter(([key]) => byKey[key]?.value != null)
  const showNames = rows.length > 1

  return (
    <div className="min-w-40 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-card">
      <p className="text-xs text-muted">{formatLabel(label)}</p>
      {rows.map(([key, { name, color }]) => (
        <p key={key} className="mt-1.5 flex items-center gap-2 tabular-nums">
          <span className="inline-block size-2 rounded-full" style={{ background: color }} />
          {showNames && <span className="text-ink-2">{name}</span>}
          <span className="ml-auto pl-4 font-medium text-ink">{formatBaht(byKey[key].value)}</span>
        </p>
      ))}
    </div>
  )
}

export default ChartTooltip
