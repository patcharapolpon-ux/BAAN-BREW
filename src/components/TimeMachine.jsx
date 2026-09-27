import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fireConfetti } from '../lib/confetti'
import { branchRace, formatBaht, formatNumber, formatThaiDate } from '../lib/metrics'
import { playSound } from '../lib/sound'
import Overlay from './Overlay'

// "Time machine": replays the whole sales history day by day as a bar chart race.
// Plain divs, not Recharts: each bar's rank is a translateY and its length a scaleX, both
// with a CSS transition as long as one step, so bars glide between steps without React
// having to render every animation frame. The clock is requestAnimationFrame but React only
// re-renders when the day actually changes (at most `speed` times a second).

const SPEEDS = [
  { value: 15, label: '1×' },
  { value: 40, label: '3×' },
  { value: 100, label: '7×' },
]
const ROW = 44 // px per bar row

function TimeMachine({ rows, colors, onClose }) {
  const race = useMemo(() => branchRace(rows), [rows])
  const { frames, branches } = race
  const [day, setDay] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(SPEEDS[0].value)
  const pos = useRef(0) // fractional day, advanced by the clock
  const leader = useRef(null)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      pos.current = Math.min(pos.current + ((now - last) / 1000) * speed, frames.length - 1)
      last = now
      const next = Math.floor(pos.current)
      setDay((d) => (d === next ? d : next)) // same value → React skips the render
      if (next >= frames.length - 1) {
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, frames.length])

  const frame = frames[day]
  const order = useMemo(
    () => frame.byBranch.map((v, i) => i).sort((a, b) => frame.byBranch[b] - frame.byBranch[a]),
    [frame],
  )
  const top = frame.byBranch[order[0]] || 1
  const finished = day >= frames.length - 1

  // Overtakes get a "whoosh", the finish gets confetti.
  useEffect(() => {
    if (leader.current != null && leader.current !== order[0]) playSound('whoosh')
    leader.current = order[0]
  }, [order])
  useEffect(() => {
    if (!finished) return
    fireConfetti()
    playSound('fanfare')
  }, [finished])

  const restart = () => {
    pos.current = 0
    leader.current = null
    setDay(0)
    setPlaying(true)
  }
  const month = formatThaiDate(frame.date, { month: 'long', year: 'numeric' })
  const stepMs = Math.max(1000 / speed, 60)

  return (
    <Overlay title="ย้อนเวลา" onClose={onClose}>
      <div className="flex flex-wrap items-end justify-between gap-4 pr-10">
        <div>
          <p className="text-xs tracking-wide text-muted sm:text-sm">⏪ ย้อนเวลา · บ้านบรู</p>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">ใครจะขายดีที่สุด?</h2>
        </div>
        {/* flip calendar: key = month → remounts → the flip animation replays each new month */}
        <div className="calendar grid w-28 overflow-hidden rounded-2xl border border-line bg-surface-2 text-center shadow-card">
          <div className="bg-accent px-2 py-1 text-xs font-medium text-surface">{month}</div>
          <div key={frame.date.slice(0, 7)} className="flip-in py-1 font-display text-4xl leading-tight font-semibold text-ink tabular-nums">
            {Number(frame.date.slice(8))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ['ยอดขายสะสม', formatBaht(frame.sales)],
          ['บิลสะสม', formatNumber(frame.bills)],
          ['ยอดวันนี้', formatBaht(frame.daySales)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-2 p-3">
            <p className="text-[11px] text-muted sm:text-xs">{label}</p>
            <p className="truncate text-base font-light text-ink tabular-nums sm:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-5" style={{ height: branches.length * ROW }} role="list" aria-label="อันดับสาขา">
        {branches.map((name, i) => {
          const rank = order.indexOf(i)
          const value = frame.byBranch[i]
          return (
            <div
              key={name}
              role="listitem"
              className="race-row absolute inset-x-0 top-0 flex items-center gap-3"
              style={{ height: ROW - 8, transform: `translateY(${rank * ROW}px)`, transitionDuration: `${stepMs * 4}ms` }}
            >
              <span className="w-20 shrink-0 truncate text-right text-sm text-ink-2 sm:w-24">
                {rank === 0 && '👑 '}
                {name}
              </span>
              <div className="relative h-full min-w-0 flex-1">
                <div
                  className="race-bar absolute inset-y-0 left-0 w-full rounded-lg"
                  style={{ background: colors.categorical[i % colors.categorical.length], transform: `scaleX(${value / top})`, transitionDuration: `${stepMs}ms` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-xs text-ink tabular-nums sm:text-sm">{formatBaht(value)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* progress through the whole period */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="race-progress h-full w-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${day / (frames.length - 1)})` }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (finished ? restart() : setPlaying((p) => !p))}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-surface transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95"
          >
            {finished ? '↺ ดูอีกรอบ' : playing ? '❚❚ หยุด' : '▶ เล่นต่อ'}
          </button>
        </div>
        <div role="group" aria-label="ความเร็ว" data-sound="select" className="flex gap-1 rounded-full border border-line p-1">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={speed === s.value}
              onClick={() => setSpeed(s.value)}
              className={`h-8 rounded-full px-3 text-sm transition-colors ${speed === s.value ? 'bg-surface-2 text-ink ring-1 ring-line' : 'text-muted hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {finished && (
        <p className="barista-in mt-4 rounded-2xl bg-surface-2 p-3 text-center text-sm text-ink">
          🏆 สาขา<b>{branches[order[0]]}</b> ชนะขาด ด้วยยอด {formatBaht(frame.byBranch[order[0]])} ตลอด {formatNumber(frames.length)} วัน
        </p>
      )}
    </Overlay>
  )
}

/** Button + the overlay it opens. */
export function TimeMachineButton({ rows, colors }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button
        type="button"
        data-sound="select"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95"
      >
        <span aria-hidden="true">⏪</span> ย้อนเวลา
      </button>
      {open && <TimeMachine rows={rows} colors={colors} onClose={close} />}
    </>
  )
}

export default TimeMachine
