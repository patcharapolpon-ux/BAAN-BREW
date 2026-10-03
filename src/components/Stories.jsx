import Papa from 'papaparse'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fireConfetti } from '../lib/confetti'
import { formatBaht, formatNumber, formatPercent, formatThaiDate, storyFacts, thaiBahtText } from '../lib/metrics'
import { useCountUp } from '../lib/motion'
import { downloadShareCard } from '../lib/shareCard'
import { isBeatPlaying, playSound, startBeat, stopBeat } from '../lib/sound'
import { showToast } from '../lib/toast'
import { PugSvg } from './ShopDog'

// Instagram-style "Stories" recap of the sales data: full screen, tap right/left to move,
// hold to pause, progress bars on top.
//
// The timer is the progress bar itself: the active bar runs a CSS animation for SLIDE_MS and
// its `animationend` moves to the next slide. Holding the screen just sets
// animation-play-state: paused — so pausing needs no JavaScript clock at all.

const SLIDE_MS = 6000
const HOLD_MS = 180 // press longer than this = "hold to pause", shorter = a tap
const BAIYOKE_M = 304 // Baiyoke Tower II, roof height
const CUP_M = 0.15 // a stacked takeaway cup, roughly

// Counts up from 0 every time a slide appears (each slide is remounted by its key).
function Count({ value, format = formatNumber }) {
  const shown = useCountUp(value, { duration: 1600, delay: 250 })
  return format(shown)
}

const Line = ({ i = 0, className = '', children }) => (
  <div className={`story-line ${className}`} style={{ animationDelay: `${120 + i * 160}ms` }}>
    {children}
  </div>
)

function buildSlides(f, branch) {
  const where = branch ? `สาขา${branch}` : 'บ้านบรู'
  const range = `${formatThaiDate(f.first, { day: 'numeric', month: 'short', year: '2-digit' })} – ${formatThaiDate(f.last, { day: 'numeric', month: 'short', year: '2-digit' })}`
  const stackM = f.cups * CUP_M
  const bestTimes = f.kpi.salesPerDay ? f.bestDay.sales / f.kpi.salesPerDay : 0
  const [first, ...others] = f.topMenu
  const maxBranch = f.branches[0]?.sales || 1

  const slides = [
    {
      bg: 'from-[#3b2314] via-[#8a4b1c] to-[#d9955a]',
      emoji: ['☕', '🫘', '✨'],
      body: (
        <>
          <Line className="mx-auto mb-6 w-fit scale-[2.2]">
            <span className="dog dog-sit inline-block">
              <PugSvg />
            </span>
          </Line>
          <Line i={1} className="text-sm tracking-[0.3em] uppercase opacity-80">
            {where} Wrapped
          </Line>
          <Line i={2} className="mt-2 font-display text-4xl leading-tight font-semibold">
            ปีของเรา
            <br />
            ในแก้วกาแฟ
          </Line>
          <Line i={3} className="mt-4 text-sm opacity-80">
            {range}
          </Line>
          <Line i={4} className="mt-10 animate-pulse text-xs opacity-70">
            แตะขวาเพื่อไปต่อ · กดค้างเพื่อหยุด
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#1d3b2a] via-[#2f7a55] to-[#9bd3a8]',
      emoji: ['🥤', '🧋', '☕'],
      body: (
        <>
          <Line className="text-lg opacity-90">เราชงไปทั้งหมด</Line>
          <Line i={1} className="mt-2 text-6xl font-light tabular-nums sm:text-7xl">
            <Count value={f.cups} />
          </Line>
          <Line i={2} className="text-2xl">แก้ว</Line>
          <Line i={4} className="mx-auto mt-8 max-w-xs rounded-2xl bg-white/15 p-4 text-sm leading-relaxed">
            ถ้าวางซ้อนกันจะสูง <b>{formatNumber(stackM / 1000, 1)} กม.</b>
            <br />
            เท่ากับตึกใบหยก 2 ต่อกัน <b>{formatNumber(stackM / BAIYOKE_M)}</b> ตึก 🏙️
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#2a1b3d] via-[#6b3fa0] to-[#e3a1d9]',
      emoji: ['💸', '🪙', '💰'],
      body: (
        <>
          <Line className="text-lg opacity-90">ยอดขายรวม</Line>
          <Line i={1} className="mt-2 text-5xl font-light tabular-nums sm:text-6xl">
            <Count value={f.kpi.totalSales} format={(v) => formatBaht(v)} />
          </Line>
          <Line i={2} className="mx-auto mt-4 max-w-xs text-sm leading-relaxed opacity-80">
            ({thaiBahtText(f.kpi.totalSales)})
          </Line>
          <Line i={3} className="mt-8 text-base">
            เฉลี่ยวันละ <b>{formatBaht(f.kpi.salesPerDay)}</b> · {formatNumber(f.kpi.orderCount)} บิล
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#3d1a1a] via-[#b3412e] to-[#f2b35e]',
      emoji: ['🔥', '📈', '🎉'],
      body: (
        <>
          <Line className="text-lg opacity-90">วันที่ขายดีที่สุดคือ</Line>
          <Line i={1} className="mt-3 font-display text-4xl font-semibold">
            {formatThaiDate(f.bestDay.date, { weekday: 'long' })}
          </Line>
          <Line i={2} className="text-2xl">{formatThaiDate(f.bestDay.date, { day: 'numeric', month: 'long', year: 'numeric' })}</Line>
          <Line i={3} className="mt-6 text-5xl font-light tabular-nums">
            <Count value={f.bestDay.sales} format={(v) => formatBaht(v)} />
          </Line>
          <Line i={4} className="mt-4 text-base">
            ขายได้ <b>{formatNumber(bestTimes, 1)} เท่า</b> ของวันปกติ 🚀
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#2b2410] via-[#8a6d1c] to-[#f1d38a]',
      emoji: ['🏆', '🥇', '⭐'],
      body: first && (
        <>
          <Line className="text-lg opacity-90">เมนูขวัญใจลูกค้า</Line>
          <Line i={1} className="mt-3 text-6xl">🏆</Line>
          <Line i={2} className="mt-2 font-display text-4xl font-semibold">{first.name}</Line>
          <Line i={3} className="mt-2 text-xl">
            <Count value={first.qty} /> แก้ว
          </Line>
          <Line i={4} className="mx-auto mt-8 w-full max-w-xs space-y-2 text-left">
            {others.map((p, k) => (
              <div key={p.product_id} className="flex justify-between rounded-xl bg-white/15 px-4 py-2 text-sm">
                <span>
                  {k === 0 ? '🥈' : '🥉'} {p.name}
                </span>
                <span className="tabular-nums">{formatNumber(p.qty)}</span>
              </div>
            ))}
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#10243d] via-[#1f5f99] to-[#f7c873]',
      emoji: ['⏰', '🌤️', '⚡'],
      body: f.peak && (
        <>
          <Line className="text-lg opacity-90">ชั่วโมงทองของร้าน</Line>
          <Line i={1} className="mt-3 font-display text-5xl font-semibold">
            {String(f.peak.hour).padStart(2, '0')}:00
          </Line>
          <Line i={2} className="text-2xl">ทุกวัน{f.peak.name}</Line>
          <Line i={3} className="mt-6 text-sm opacity-90">
            ช่วงเดียวรวมทั้งปีขายได้ <b>{formatBaht(f.peak.sales)}</b>
          </Line>
          <Line i={4} className="mx-auto mt-8 max-w-xs rounded-2xl bg-white/15 p-4 text-sm">
            วันที่คึกคักที่สุดของสัปดาห์คือ <b>วัน{f.weekdays[0]?.name}</b>
            <br />
            ส่วนวัน{f.weekdays.at(-1)?.name} เงียบที่สุด 😴
          </Line>
        </>
      ),
    },
    !branch && {
      bg: 'from-[#1e1e1e] via-[#4a3426] to-[#c58b57]',
      emoji: ['👑', '🏪', '🥊'],
      body: (
        <>
          <Line className="text-lg opacity-90">สาขาแชมป์</Line>
          <Line i={1} className="mt-2 font-display text-5xl font-semibold">👑 {f.branches[0]?.branch}</Line>
          <Line i={2} className="mt-1 text-lg">
            ครองยอด <b>{formatPercent(f.branches[0]?.share ?? 0, 0)}</b> ของทุกสาขา
          </Line>
          <Line i={3} className="mx-auto mt-8 w-full max-w-xs space-y-2">
            {f.branches.map((b, k) => (
              <div key={b.branch} className="flex items-center gap-2 text-left text-sm">
                <span className="w-24 shrink-0 truncate">{b.branch}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div className="story-bar h-full rounded-full bg-white" style={{ width: `${(b.sales / maxBranch) * 100}%`, animationDelay: `${600 + k * 120}ms` }} />
                </div>
              </div>
            ))}
          </Line>
        </>
      ),
    },
    {
      bg: 'from-[#0f2f2f] via-[#127a72] to-[#7fe0c9]',
      emoji: ['🧾', '🤑', '👀'],
      body: (
        <>
          <Line className="text-lg opacity-90">บิลที่ใหญ่ที่สุด</Line>
          <Line i={1} className="mt-3 text-6xl font-light tabular-nums">
            <Count value={f.biggestBill.total} format={(v) => formatBaht(v)} />
          </Line>
          <Line i={2} className="mt-3 text-lg">
            {formatNumber(f.biggestBill.items)} แก้วในบิลเดียว!
          </Line>
          <Line i={3} className="mt-1 text-sm opacity-90">
            สาขา{f.biggestBill.branch} · {formatThaiDate(f.biggestBill.date, { day: 'numeric', month: 'short', year: '2-digit' })}
          </Line>
          <Line i={4} className="mt-8 text-base">ใครกันนะ… เลี้ยงทั้งออฟฟิศเลยหรือเปล่า 👀</Line>
        </>
      ),
    },
    {
      bg: 'from-[#3a1530] via-[#a33a6b] to-[#f6a5c0]',
      emoji: ['💖', '🎟️', '🙌'],
      body: (
        <>
          <Line className="text-lg opacity-90">ลูกค้าประจำของเรา</Line>
          <Line i={1} className="mt-2 text-6xl font-light tabular-nums">
            <Count value={f.kpi.uniqueMembers} />
          </Line>
          <Line i={2} className="text-xl">สมาชิกที่แวะมาอุดหนุน</Line>
          <Line i={3} className="mt-6 text-base">
            <b>{formatPercent(f.kpi.memberOrderShare, 0)}</b> ของบิลมาจากสมาชิก
          </Line>
          {f.topPayment && (
            <Line i={4} className="mx-auto mt-6 max-w-xs rounded-2xl bg-white/15 p-4 text-sm">
              จ่ายด้วย <b>{f.topPayment.name}</b> มากที่สุด ({formatPercent(f.topPayment.share, 0)})
            </Line>
          )}
        </>
      ),
    },
  ]
  return slides.filter(Boolean).filter((s) => s.body)
}

function Stories({ rows, branch, kpi, range, topBranch, recentChange, onClose }) {
  const [products, setProducts] = useState(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const holdTimer = useRef(0)
  const held = useRef(false)

  useEffect(() => {
    Papa.parse('/products.csv', { download: true, header: true, skipEmptyLines: true, complete: (r) => setProducts(r.data) })
  }, [])

  const facts = useMemo(() => (products ? storyFacts(rows, products) : null), [rows, products])
  const slides = useMemo(() => (facts ? buildSlides(facts, branch) : []), [facts, branch])
  const total = slides.length + 1 // + the outro
  const isOutro = index === slides.length

  // Lo-fi music while open (only stopped on close if Stories was the one that started it).
  useEffect(() => {
    const startedHere = !isBeatPlaying()
    startBeat()
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = 'hidden'
    return () => {
      if (startedHere) stopBeat()
      document.documentElement.style.overflow = overflow
    }
  }, [])

  const go = (next) => {
    if (next < 0) return
    if (next >= total) return onClose()
    playSound(next > index ? 'select' : 'tap')
    if (next === total - 1) fireConfetti()
    setIndex(next)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (['Escape', 'ArrowRight', 'ArrowLeft', ' '].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const onDown = () => {
    held.current = false
    holdTimer.current = setTimeout(() => {
      held.current = true
      setPaused(true)
    }, HOLD_MS)
  }
  const onUp = (e) => {
    clearTimeout(holdTimer.current)
    setPaused(false)
    if (held.current) return
    const r = e.currentTarget.getBoundingClientRect()
    go(e.clientX - r.left < r.width * 0.3 ? index - 1 : index + 1)
  }

  const save = async () => {
    try {
      await downloadShareCard({ branch, range, kpi, topBranch, recentChange })
      showToast({ icon: '📸', title: 'บันทึกการ์ดแล้ว', text: 'เอาไปลงสตอรี่จริงได้เลย' })
    } catch {
      showToast({ icon: '😵', title: 'สร้างรูปไม่สำเร็จ', text: 'ลองอีกครั้งนะ' })
    }
  }

  const slide = slides[index]
  return createPortal(
    <div className="overlay-in fixed inset-0 z-[80] grid place-items-center bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="สรุปแบบสตอรี่">
      <div
        className={`story relative h-full w-full overflow-hidden bg-gradient-to-br text-center text-white select-none sm:h-[min(92vh,820px)] sm:w-auto sm:aspect-[9/16] sm:rounded-3xl sm:shadow-2xl ${
          slide?.bg ?? 'from-[#3b2314] via-[#8a4b1c] to-[#d9955a]'
        }`}
        onPointerDown={isOutro ? undefined : onDown}
        onPointerUp={isOutro ? undefined : onUp}
        onPointerLeave={() => {
          clearTimeout(holdTimer.current)
          setPaused(false)
        }}
      >
        {/* progress bars: the active one IS the timer */}
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
          {Array.from({ length: total }, (_, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              {k < index && <div className="h-full w-full bg-white" />}
              {k === index && !isOutro && (
                <div
                  key={index}
                  className="story-progress h-full bg-white"
                  style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused || !facts ? 'paused' : 'running' }}
                  onAnimationEnd={() => go(index + 1)}
                />
              )}
              {k === index && isOutro && <div className="h-full w-full bg-white" />}
            </div>
          ))}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-6 right-3 z-20 grid size-10 place-items-center rounded-full text-2xl text-white/90 hover:bg-white/15"
        >
          ×
        </button>

        {/* floating emoji in the background */}
        {slide?.emoji.map((e, k) => (
          <span key={`${index}-${k}`} className="story-float pointer-events-none absolute text-5xl opacity-30" style={{ left: `${12 + k * 32}%`, animationDelay: `${k * 1.3}s` }} aria-hidden="true">
            {e}
          </span>
        ))}

        <div key={index} className="relative z-[1] flex h-full flex-col justify-center px-8 pt-10 pb-8">
          {!facts && <p className="animate-pulse">กำลังชงสรุป…</p>}
          {slide?.body}
          {isOutro && facts && (
            <>
              <Line className="text-6xl">☕💛</Line>
              <Line i={1} className="mt-4 font-display text-4xl font-semibold">ขอบคุณทุกแก้ว</Line>
              <Line i={2} className="mt-2 text-sm opacity-85">
                {formatNumber(facts.kpi.orderCount)} บิล · {formatNumber(facts.kpi.dayCount)} วัน · 1 น้องปั๊ก
              </Line>
              <Line i={3} className="mx-auto mt-10 flex w-full max-w-xs flex-col gap-3">
                <button type="button" onClick={save} className="h-12 rounded-full bg-white font-medium text-stone-900 transition hover:scale-[1.03] active:scale-95">
                  📸 บันทึกการ์ดสรุป
                </button>
                <button type="button" onClick={() => setIndex(0)} className="h-12 rounded-full bg-white/15 font-medium transition hover:bg-white/25 active:scale-95">
                  ↺ ดูอีกรอบ
                </button>
              </Line>
            </>
          )}
        </div>
        {paused && <span className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs">หยุดชั่วคราว</span>}
      </div>
    </div>,
    document.body,
  )
}

/** The button on the sales page; Stories (and its data crunching) only mounts when opened. */
export function StoriesButton(props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        data-sound="select"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95"
      >
        <span className="story-ring grid size-5 place-items-center rounded-full text-[11px]" aria-hidden="true">
          ▶
        </span>
        สตอรี่
      </button>
      {open && <Stories {...props} onClose={() => setOpen(false)} />}
    </>
  )
}

export default Stories
