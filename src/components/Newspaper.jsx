import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatBaht, formatNumber, formatPercent, formatThaiDate, toThaiDate } from '../lib/metrics'
import { buildPaper } from '../lib/newspaper'
import { playSound } from '../lib/sound'
import { loadLottery, loadProducts, useStatic } from '../lib/staticData'
import { PugSvg } from './ShopDog'

// "บ้านบรูรายวัน": the data as a 90s Thai newspaper front page. It spins in like a newspaper
// in an old film, can be printed (print CSS hides the dashboard behind it), and every word
// is generated from the data by lib/newspaper.js.

function Paper({ paper }) {
  const { headline, stories, lotto, weather, ads, stats } = paper
  return (
    <article className="paper mx-auto max-w-5xl px-5 py-6 text-stone-900 sm:px-10 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-1 text-[11px] sm:text-xs">
        <span>ปีที่ 1 ฉบับที่ {formatNumber(paper.issue)}</span>
        <span>{formatThaiDate(paper.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span>ราคา 5 บาท</span>
      </div>
      <header className="py-2 text-center">
        <h1 className="paper-mast font-display text-5xl leading-none font-bold sm:text-7xl">บ้านบรูรายวัน</h1>
        <p className="mt-1 text-xs tracking-widest sm:text-sm">หนังสือพิมพ์ที่น้องปั๊กอ่านทุกเช้า · เชื่อถือได้ (บ้าง)</p>
      </header>
      <div className="paper-rule" />

      <h2 className="paper-headline mt-4 text-center font-display text-3xl leading-tight font-bold sm:text-6xl">{headline.title}</h2>
      {headline.sub && <p className="mx-auto mt-2 max-w-3xl text-center text-base font-semibold sm:text-xl">{headline.sub}</p>}

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <figure className="paper-photo">
            <div className="grid h-48 place-items-center sm:h-64">
              <div className="scale-[3.2] grayscale sepia-[.4]">
                <PugSvg />
              </div>
            </div>
            <figcaption className="border-t border-stone-800 px-2 py-1 text-xs italic">
              ภาพ: น้องปั๊กให้สัมภาษณ์พิเศษ "ผมรู้อยู่แล้วว่าวันนั้นต้องยุ่ง" (ภาพจากแฟ้ม)
            </figcaption>
          </figure>
          {headline.lead && <p className="paper-lead mt-4 text-justify leading-relaxed">{headline.lead}</p>}
        </div>

        <aside className="space-y-4">
          {lotto && (
            <section className="paper-box">
              <h3 className="paper-box-title">🎰 ผลสลากกินแบ่งรัฐบาล</h3>
              <p className="text-xs">งวดวันที่ {formatThaiDate(lotto.latest.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mt-1 text-xs">รางวัลที่ 1</p>
              <p className="paper-lotto font-display text-4xl font-bold tracking-[0.15em]">{lotto.latest.first}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                <div>
                  เลขท้าย 2 ตัว
                  <p className="font-display text-2xl font-bold">{lotto.latest.last2}</p>
                </div>
                <div>
                  เลขท้าย 3 ตัว
                  <p className="font-display text-lg font-bold">{lotto.latest.last3b.join(' ')}</p>
                </div>
              </div>
              <p className="mt-3 border-t border-dashed border-stone-500 pt-2 text-xs leading-relaxed">
                {lotto.isDrawDay ? 'เลขท้ายยอดขายวันหวยออก' : 'ยังไม่มียอดวันหวยออก ใช้วันล่าสุดแทน'} ({formatBaht(lotto.lastDay.sales)}) คือ{' '}
                <b>{lotto.tail}</b>{' '}
                {lotto.hit ? '🎉 ถูกเลขท้าย 2 ตัว! เลี้ยงกาแฟทั้งร้าน' : '… ไม่ถูก ปลอบใจด้วยลาเต้เย็น'}
                <br />
                {lotto.luck.total > 0 && (
                  <>
                    ทั้ง {lotto.luck.total} งวดที่ผ่านมา ร้านเคย "ถูกหวย" {lotto.wins.length} งวด · วันหวยออกขาย{' '}
                    {formatPercent(lotto.luck.averageLift, 1, true)} จากปกติ
                  </>
                )}
              </p>
            </section>
          )}

          <section className="paper-box">
            <h3 className="paper-box-title">พยากรณ์ยอดขาย</h3>
            <p className="flex items-center gap-3">
              <span className="text-4xl">{weather.icon}</span>
              <span className="text-sm">
                {weather.text}
                {weather.change != null && <span className="block text-xs">30 วันล่าสุด {formatPercent(weather.change, 1, true)}</span>}
              </span>
            </p>
          </section>

          <section className="paper-box">
            <h3 className="paper-box-title">ตัวเลขประจำฉบับ</h3>
            <dl className="space-y-1 text-sm">
              {stats.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-dotted border-stone-400">
                  <dt>{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      <div className="paper-rule mt-6" />
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {stories.map((s) => (
          <section key={s.title} className="md:border-r md:border-stone-400 md:pr-6 md:last:border-0 md:last:pr-0">
            <span className="paper-kicker">{s.kicker}</span>
            <h3 className="mt-1 font-display text-xl leading-snug font-bold">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="paper-rule mt-6" />
      <h3 className="mt-3 text-center font-display text-lg font-bold">ประกาศย่อย</h3>
      <div className="mt-2 gap-3 text-xs leading-relaxed sm:columns-3">
        {ads.map((a) => (
          <p key={a} className="paper-ad mb-3 break-inside-avoid">
            {a}
          </p>
        ))}
      </div>

      <footer className="mt-4 border-t border-stone-800 pt-2 text-center text-[10px]">
        พิมพ์ที่โรงพิมพ์ข้อมูลบ้านบรู · ทุกตัวเลขมาจาก sales.csv จริง · ผลสลาก: {lotto?.source ?? 'โหลดไม่สำเร็จ'}
      </footer>
    </article>
  )
}

function Newspaper({ rows, onClose }) {
  const products = useStatic(loadProducts)
  const lottery = useStatic(loadLottery)
  const [lotteryTimedOut, setLotteryTimedOut] = useState(false)
  // Back issues: one per lottery draw from the shop's first day on, newest first. null = latest.
  const [drawDate, setDrawDate] = useState(null)
  const issues = useMemo(() => {
    if (!lottery) return []
    const first = rows.reduce((min, r) => (r.datetime < min ? r.datetime : min), rows[0]?.datetime ?? '')
    return lottery.draws.map((d) => d.date).filter((d) => d >= toThaiDate(first)).reverse()
  }, [lottery, rows])
  const current = drawDate ?? issues[0] ?? null
  const at = issues.indexOf(current)
  const goTo = (date) => {
    if (!date || date === current) return
    playSound('whoosh')
    setTimeout(() => playSound('thud'), 900)
    setDrawDate(date)
  }
  const older = () => goTo(issues[at + 1])
  const newer = () => goTo(issues[at - 1])
  // Don't wait forever for lottery.json: after 3 s print the paper without the lottery box.
  useEffect(() => {
    const t = setTimeout(() => setLotteryTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [])
  const ready = products && (lottery || lotteryTimedOut)
  const paper = useMemo(() => (ready ? buildPaper(rows, products, lottery, current) : null), [ready, rows, products, lottery, current])

  // ← older issue, → newer issue. Re-subscribed each render so it always sees the current issue.
  useEffect(() => {
    const onArrow = (e) => {
      if (e.target.closest?.('select')) return // the dropdown handles its own arrows
      if (e.key === 'ArrowLeft') older()
      if (e.key === 'ArrowRight') newer()
    }
    window.addEventListener('keydown', onArrow)
    return () => window.removeEventListener('keydown', onArrow)
  })

  useEffect(() => {
    playSound('whoosh')
    const t = setTimeout(() => playSound('thud'), 900)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
      document.documentElement.style.overflow = overflow
    }
  }, [onClose])

  return createPortal(
    <div className="paper-overlay overlay-in fixed inset-0 z-[80] overflow-y-auto bg-stone-900/85 py-4 sm:py-8" role="dialog" aria-modal="true" aria-label="หนังสือพิมพ์บ้านบรูรายวัน" onClick={onClose}>
      <div className="paper-controls sticky top-0 z-10 mx-auto mb-3 flex max-w-5xl flex-wrap items-center justify-end gap-2 px-3" onClick={(e) => e.stopPropagation()}>
        {issues.length > 1 && (
          <div className="mr-auto flex items-center gap-1 rounded-full bg-white/90 p-1 text-sm text-stone-900 shadow">
            <button type="button" onClick={older} disabled={at >= issues.length - 1} className="grid size-8 place-items-center rounded-full hover:bg-stone-200 disabled:opacity-30" aria-label="ฉบับก่อนหน้า">
              ◀
            </button>
            <label className="flex items-center gap-1">
              <span className="hidden sm:inline">📅 ฉบับวันหวยออก</span>
              <select value={current ?? ''} onChange={(e) => goTo(e.target.value)} className="rounded-full bg-transparent px-1 py-1 font-medium" aria-label="เลือกฉบับ">
                {issues.map((d) => (
                  <option key={d} value={d}>
                    {formatThaiDate(d, { day: 'numeric', month: 'short', year: '2-digit' })}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={newer} disabled={at <= 0} className="grid size-8 place-items-center rounded-full hover:bg-stone-200 disabled:opacity-30" aria-label="ฉบับถัดไป">
              ▶
            </button>
          </div>
        )}
        <button type="button" onClick={() => window.print()} className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-stone-900 shadow hover:bg-white">
          🖨️ พิมพ์
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-stone-900 shadow hover:bg-white" aria-label="ปิด">
          ✕ ปิด
        </button>
      </div>
      <div key={paper?.date} className="paper-spin px-3" onClick={(e) => e.stopPropagation()}>
        {paper ? <Paper paper={paper} /> : <p className="py-20 text-center text-white">กำลังเรียงพิมพ์…</p>}
      </div>
    </div>,
    document.body,
  )
}

/** The button on the sales page. */
export function NewspaperButton({ rows }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        data-sound="none"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95"
      >
        📰 หนังสือพิมพ์
      </button>
      {open && <Newspaper rows={rows} onClose={() => setOpen(false)} />}
    </>
  )
}

export default Newspaper
