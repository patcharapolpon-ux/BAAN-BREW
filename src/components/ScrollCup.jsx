import { useEffect, useRef } from 'react'
import { useScrollProgress } from '../lib/motion'
import { playSound } from '../lib/sound'
import { showToast } from './Toaster'

// Reading progress as a coffee cup in the bottom-left corner: the further you scroll, the
// fuller the cup. At the bottom, foam bubbles rise and (once per visit) a toast says you're done.
// The coffee level is a single transform: scaleY on one rect, no layout work.
function ScrollCup() {
  const progress = useScrollProgress()
  const full = progress > 0.985
  const celebrated = useRef(false)
  const visible = progress > 0.02

  useEffect(() => {
    if (!full || celebrated.current) return
    celebrated.current = true
    playSound('pour')
    showToast({ icon: '☕', title: 'เต็มแก้วแล้ว!', text: 'อ่านครบทั้งหน้า ขอบคุณที่แวะมานะ' })
  }, [full])

  return (
    <div
      role="progressbar"
      aria-label="อ่านไปแล้ว"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className={`fixed bottom-4 left-4 z-40 grid size-12 place-items-center rounded-full border border-line bg-surface shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] sm:bottom-8 sm:left-8 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      } ${full ? 'cup-full' : ''}`}
    >
      <svg viewBox="0 0 48 48" className="size-9" aria-hidden="true">
        <defs>
          <clipPath id="cup-clip">
            <path d="M11 17h21l-2.3 17.5a4 4 0 0 1-4 3.5h-8.4a4 4 0 0 1-4-3.5z" />
          </clipPath>
        </defs>
        {/* foam bubbles + steam, only animated while the cup is full */}
        <g className="cup-foam fill-accent-soft">
          <circle cx="17" cy="15" r="1.6" />
          <circle cx="22" cy="14" r="2" />
          <circle cx="27" cy="15" r="1.4" />
        </g>
        <g clipPath="url(#cup-clip)">
          <rect x="9" y="17" width="25" height="22" className="fill-surface-2" />
          <rect
            x="9"
            y="17"
            width="25"
            height="22"
            className="cup-liquid fill-accent"
            style={{ transform: `scaleY(${progress})` }}
          />
        </g>
        <path
          d="M11 17h21l-2.3 17.5a4 4 0 0 1-4 3.5h-8.4a4 4 0 0 1-4-3.5z M32 21h2.5a3.5 3.5 0 0 1 0 7H31"
          className="stroke-ink-2"
          strokeWidth="1.8"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default ScrollCup
