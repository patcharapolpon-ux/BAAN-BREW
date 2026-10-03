// Today's branch race, live. Each row is absolutely positioned at (rank × row height), so when
// a branch overtakes another, only the `transform` changes and CSS slides the rows past each
// other. Rows are keyed by branch (not by rank) — that's what lets React keep the same element
// and the browser animate it, instead of swapping text in place.
import { BRANCHES } from '../lab3/saleModel.js'
import { formatBaht, formatNumber } from '../lib/metrics'

const ROW_H = 52

function LiveRace({ standings, colors }) {
  const max = Math.max(1, standings[0]?.revenue ?? 0)
  return (
    <div className="relative" style={{ height: standings.length * ROW_H }}>
      {standings.map((row, rank) => {
        const color = colors.categorical[BRANCHES.indexOf(row.branch) % colors.categorical.length]
        return (
          <div
            key={row.branch}
            className="race-row absolute inset-x-0 top-0 flex items-center gap-3"
            style={{ transform: `translateY(${rank * ROW_H}px)`, height: ROW_H - 8 }}
          >
            <span className="w-6 text-center text-lg" aria-hidden="true">
              {rank === 0 && row.revenue > 0 ? '👑' : <span className="text-sm text-muted tabular-nums">{rank + 1}</span>}
            </span>
            <span className="w-24 shrink-0 truncate text-sm text-ink">{row.branch}</span>
            <div className="relative h-full flex-1 overflow-hidden rounded-lg bg-surface-2">
              <div
                className="race-bar absolute inset-y-0 left-0 rounded-lg"
                style={{ width: `${(row.revenue / max) * 100}%`, background: color }}
              />
              <span className="absolute inset-y-0 right-2 flex items-center text-xs text-muted tabular-nums">
                {formatNumber(row.orders)} บิล
              </span>
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-ink tabular-nums">{formatBaht(row.revenue)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default LiveRace
