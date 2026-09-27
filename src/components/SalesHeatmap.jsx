import { useEffect, useState } from 'react'
import { baristaLine } from '../lib/barista'
import { formatBaht } from '../lib/metrics'

const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`

/**
 * Weekday × hour grid: darker = more sales. Built with plain CSS grid (no chart library)
 * so every cell is an element we can animate and hover.
 * - Entrance: each cell's delay = (row + column) × 18ms → a diagonal "wave" sweeps across.
 * - Hover: the cell pops, and its row + column labels light up so you can read the axes.
 * - The readout line below repeats the hovered value in text (and shows the peak by default),
 *   so nothing depends on color or the mouse alone.
 */
function SalesHeatmap({ data, show = true }) {
  const [hover, setHover] = useState(null) // { day, hour, sales, name }
  const { hours, days, max, peak } = data
  const focus = hover ?? peak
  // After the entrance wave has played, mark cells settled so hover reacts with no delay.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => setSettled(true), 1200)
    return () => clearTimeout(timer)
  }, [show])

  return (
    <div>
      <div
        role="img"
        aria-label={peak ? `ช่วงขายดีที่สุดคือวัน${peak.name} ${hourLabel(peak.hour)} ยอด ${formatBaht(peak.sales)}` : 'ไม่มีข้อมูล'}
        className="grid gap-[3px] sm:gap-1"
        style={{ gridTemplateColumns: `auto repeat(${hours.length}, minmax(0, 1fr))` }}
        onMouseLeave={() => setHover(null)}
      >
        <span />
        {hours.map((h, i) => (
          <span
            key={h}
            aria-hidden="true"
            className={`pb-1 text-center text-[10px] tabular-nums transition-colors duration-200 sm:text-xs ${
              hover?.hour === h ? 'font-semibold text-accent' : 'text-muted'
            } ${i % 2 ? 'max-sm:invisible' : ''}`}
          >
            {h}
          </span>
        ))}

        {days.map((day, row) => (
          <div key={day.weekday} className="contents">
            <span
              aria-hidden="true"
              className={`pr-2 text-right text-xs leading-none transition-colors duration-200 sm:pr-3 sm:text-sm ${
                hover?.day === day.weekday ? 'font-semibold text-accent' : 'text-ink-2'
              } self-center`}
            >
              {day.name}
            </span>
            {day.cells.map((cell, col) => {
              const level = max ? cell.sales / max : 0
              const isHover = hover?.day === day.weekday && hover?.hour === cell.hour
              const inCross = hover && (hover.day === day.weekday || hover.hour === cell.hour)
              return (
                <span
                  key={cell.hour}
                  aria-hidden="true"
                  onMouseEnter={() => setHover({ day: day.weekday, name: day.name, hour: cell.hour, sales: cell.sales })}
                  className={`heat-cell aspect-square rounded-[4px] sm:aspect-[3/2] sm:rounded-md ${show ? 'is-visible' : ''} ${settled ? 'is-settled' : ''} ${isHover ? 'is-hover' : ''} ${
                    hover && !inCross ? 'is-dim' : ''
                  }`}
                  style={{
                    // color-mix blends accent into the empty-cell color by the sales level (10%–100%).
                    // backgroundColor (not background) so the color change can transition when the filter changes.
                    backgroundColor: `color-mix(in oklab, var(--accent) ${Math.round(10 + level * 90)}%, var(--surface-2))`,
                    '--d': `${(row + col) * 18}ms`,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <p aria-live="polite" className="min-h-5 text-ink-2">
          {focus && (
            <>
              <span className="text-muted">{hover ? 'ช่วงนี้: ' : 'ขายดีที่สุด: '}</span>
              <span className="font-medium text-ink">
                วัน{focus.name} {hourLabel(focus.hour)}–{hourLabel(focus.hour + 1)}
              </span>
              <span className="text-muted"> · </span>
              <span className="font-medium text-ink tabular-nums">{formatBaht(focus.sales)}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-muted" aria-hidden="true">
          น้อย
          <span
            className="h-2.5 w-24 rounded-full"
            style={{ background: 'linear-gradient(90deg, color-mix(in oklab, var(--accent) 10%, var(--surface-2)), var(--accent))' }}
          />
          มาก
        </div>
      </div>

      {focus && (
        // key = the cell → remounts on every new cell, so the bubble pops in again
        <div key={`${focus.day ?? focus.weekday}-${focus.hour}`} className="barista-in mt-3 flex items-end gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg ring-1 ring-line" aria-hidden="true">
            🧑‍🍳
          </span>
          <p className="rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2 text-sm text-ink ring-1 ring-line">
            <span className="sr-only">บาริสต้าบอกว่า: </span>
            {baristaLine({ weekday: focus.day ?? focus.weekday, hour: focus.hour, sales: focus.sales, max })}
          </p>
        </div>
      )}
    </div>
  )
}

export default SalesHeatmap
