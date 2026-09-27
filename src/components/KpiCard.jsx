import { useCountUp, useTilt } from '../lib/motion'
import Sparkline from './Sparkline'

// Line icons (24×24, stroke = currentColor) so they follow the theme like text does.
const ICONS = {
  sales: (
    <>
      <path d="M3 17l5-5 4 4 8-8" />
      <path d="M15 8h5v5" />
    </>
  ),
  bills: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  cup: (
    <>
      <path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z" />
      <path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 3c0 1.5 1.5 1.5 1.5 3M12 3c0 1.5 1.5 1.5 1.5 3" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  newMember: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14.5h2" />
    </>
  ),
  repeat: (
    <>
      <path d="M4 11a8 8 0 0 1 14-5l2 2" />
      <path d="M20 4v4h-4" />
      <path d="M20 13a8 8 0 0 1-14 5l-2-2" />
      <path d="M4 20v-4h4" />
    </>
  ),
}

// A single headline number that counts up from 0. `value` is the raw number and `format`
// turns it into text, so the animation runs on numbers, not strings.
// `spark` = optional list of numbers for a mini trend line under the value.
// `trend` is an optional { value, text, label }: value is the signed ratio (arrow direction).
// Arrow + words, never color alone.
function KpiCard({ label, value, format, hint, trend, icon, spark, delay = 0 }) {
  const shown = useCountUp(value, { delay: delay + 200 })
  const tiltRef = useTilt()

  return (
    <div
      ref={tiltRef}
      className="card rise min-w-0 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs tracking-wide text-muted sm:text-sm">{label}</p>
        {icon && (
          <span className="card-icon hidden size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent sm:grid">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[icon]}
            </svg>
          </span>
        )}
      </div>
      {/* Screen readers get the final value once; the ticking digits are hidden from them. */}
      <p className="mt-2 text-2xl font-light tracking-tight text-ink tabular-nums sm:mt-1 sm:text-4xl">
        <span aria-hidden="true">{format(shown)}</span>
        <span className="sr-only">{format(value)}</span>
      </p>
      {hint && <p className="mt-2 text-xs text-muted sm:text-sm">{hint}</p>}
      {spark && <Sparkline values={spark} className="mt-3 h-8 w-full" />}
      {trend && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs whitespace-nowrap text-ink-2">
          <svg viewBox="0 0 12 12" className={`size-3 ${trend.value < 0 ? 'rotate-180' : 'animate-bounce'}`} aria-hidden="true">
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
