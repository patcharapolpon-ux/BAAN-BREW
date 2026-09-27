import Papa from 'papaparse'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fireConfetti } from '../lib/confetti'
import { formatBaht, THAI_WEEKDAYS, topProducts } from '../lib/metrics'
import { playSound } from '../lib/sound'
import Overlay from './Overlay'

// Mini game "บาริสต้าชงไม่ทัน". Orders drop into the queue; serve the FIRST ticket by pressing
// its menu (or keys 1–4) before its timer runs out. The menu is the shop's 4 real best-sellers,
// and the pace comes from the real sales of the chosen heatmap slot: busier hour = faster orders.
//
// Game state lives in one ref and a single 100 ms interval drives spawning and expiry, so the
// game doesn't re-render at 60 fps; the ticket countdown bars are CSS animations.

const EMOJI = { กาแฟ: '☕', ชา: '🍵', นอนคอฟฟี่: '🥛', ปั่น: '🥤' }
const ROUND_MS = 45_000
const MAX_QUEUE = 5
const HEARTS = 3
const BEST_KEY = 'baanbrew-game-best'

const lerp = (a, b, t) => a + (b - a) * t

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function rating(score) {
  if (score >= 30) return 'บาริสต้ามือทอง 🏆'
  if (score >= 20) return 'หัวหน้าบาร์ ⭐'
  if (score >= 10) return 'บาริสต้าฝึกหัดไฟแรง 💪'
  return 'เด็กล้างแก้ว 🧽 (ลองใหม่นะ)'
}

function BaristaGame({ rows, slot, onClose }) {
  const [menu, setMenu] = useState(null)
  const [phase, setPhase] = useState('ready') // ready | play | over
  const [view, setView] = useState({ queue: [], score: 0, hearts: HEARTS, combo: 0, left: ROUND_MS, flash: null })
  const [best, setBest] = useState(readBest)
  const game = useRef(null)
  const level = slot.level // 0–1 from the heatmap
  const spawnEvery = lerp(2400, 750, level)
  const patience = lerp(7500, 3600, level)

  useEffect(() => {
    Papa.parse('/products.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (r) => setMenu(topProducts(rows, r.data, 4).map((p) => ({ ...p, emoji: EMOJI[p.category] ?? '☕' }))),
    })
  }, [rows])

  const sync = () => {
    const g = game.current
    setView({ queue: [...g.queue], score: g.score, hearts: g.hearts, combo: g.combo, left: Math.max(0, g.end - performance.now()), flash: g.flash })
  }

  const finish = useCallback(() => {
    const g = game.current
    clearInterval(g.timer)
    setPhase('over')
    if (g.score > readBest()) {
      try {
        localStorage.setItem(BEST_KEY, String(g.score))
      } catch {
        // storage blocked — the best score just isn't kept
      }
      setBest(g.score)
      if (g.score > 0) fireConfetti()
    }
    playSound('fanfare')
  }, [])

  const loseHeart = (g) => {
    g.hearts--
    g.combo = 0
    g.flash = { type: 'bad', id: performance.now() }
    playSound('wrong')
    if (g.hearts <= 0) finish()
  }

  const start = () => {
    const now = performance.now()
    game.current = { queue: [], score: 0, hearts: HEARTS, combo: 0, end: now + ROUND_MS, nextSpawn: now + 400, id: 0, flash: null, timer: 0 }
    const g = game.current
    g.timer = setInterval(() => {
      const t = performance.now()
      if (t >= g.end) return finish()
      if (t >= g.nextSpawn && g.queue.length < MAX_QUEUE) {
        const item = Math.floor(Math.random() * menu.length)
        g.queue.push({ id: ++g.id, item, due: t + patience })
        g.nextSpawn = t + spawnEvery * lerp(0.7, 1.3, Math.random())
      }
      const expired = g.queue.findIndex((o) => o.due <= t)
      if (expired !== -1) {
        g.queue.splice(expired, 1)
        loseHeart(g)
      }
      sync()
    }, 100)
    setPhase('play')
    sync()
  }

  const serve = (item) => {
    const g = game.current
    if (phase !== 'play' || !g.queue.length) return
    if (g.queue[0].item === item) {
      g.queue.shift()
      g.combo++
      g.score += g.combo >= 5 ? 2 : 1 // combo bonus
      g.flash = { type: 'good', id: performance.now() }
      playSound('ding')
    } else {
      loseHeart(g)
    }
    sync()
  }

  // Keys 1–4 serve.
  useEffect(() => {
    const onKey = (e) => {
      if (phase === 'play' && /^[1-4]$/.test(e.key)) serve(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => () => clearInterval(game.current?.timer), [])

  // Wrong or missed order → the queue shakes. Web Animations on the element, so the tickets
  // (and their countdown bars) aren't remounted.
  const queueRef = useRef(null)
  useEffect(() => {
    if (view.flash?.type !== 'bad') return
    queueRef.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    )
  }, [view.flash])

  const slotText = `วัน${THAI_WEEKDAYS[slot.weekday]} ${String(slot.hour).padStart(2, '0')}:00`

  return (
    <Overlay title="มินิเกม บาริสต้าชงไม่ทัน" onClose={onClose}>
      <div className="pr-10">
        <p className="text-xs tracking-wide text-muted sm:text-sm">☕ มินิเกม · {slotText} · ยอดขายจริง {formatBaht(slot.sales)}</p>
        <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">บาริสต้าชงไม่ทัน!</h2>
      </div>

      {!menu && <p className="mt-6 text-muted">กำลังเตรียมบาร์…</p>}

      {menu && phase === 'ready' && (
        <div className="barista-in mt-5 space-y-3 text-sm text-ink-2">
          <p>ออเดอร์จะเข้าคิวเรื่อยๆ กดเมนูให้ตรงกับ <b className="text-ink">ใบแรกซ้ายสุด</b> ก่อนแถบเวลาหมด (คีย์บอร์ดกด 1–4 ได้)</p>
          <p>
            ความเร็วมาจากยอดขายจริงของช่วงนี้: ระดับความยุ่ง <b className="text-accent">{Math.round(level * 100)}%</b>
            {level > 0.85 ? ' — ช่วงพีค ขอให้โชคดี 😵‍💫' : level < 0.3 ? ' — ช่วงชิล อุ่นเครื่องก่อน ☺️' : ''}
          </p>
          <p>ผิดหรือช้า เสียหัวใจ ❤️ 1 ดวง · ถูก 5 ใบติดได้ 2 แต้ม · เวลา 45 วินาที</p>
          <button
            type="button"
            onClick={start}
            className="mt-2 inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-surface transition-transform hover:scale-105 active:scale-95"
          >
            ▶ เริ่มชง!
          </button>
          {best > 0 && <p className="text-xs text-muted">สถิติสูงสุดของคุณ: {best} แต้ม</p>}
        </div>
      )}

      {menu && phase !== 'ready' && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span aria-label={`หัวใจเหลือ ${view.hearts}`}>{'❤️'.repeat(Math.max(view.hearts, 0))}{'🤍'.repeat(HEARTS - Math.max(view.hearts, 0))}</span>
            <span className="text-ink tabular-nums">
              แต้ม <b className="text-lg">{view.score}</b>
              {view.combo >= 3 && <span className="ml-2 text-accent">คอมโบ ×{view.combo}🔥</span>}
            </span>
            <span className="text-muted tabular-nums">⏱ {Math.ceil(view.left / 1000)} วิ</span>
          </div>

          {/* queue of order tickets */}
          <div
            ref={queueRef}
            className="mt-3 flex min-h-28 gap-2 overflow-hidden rounded-2xl bg-surface-2 p-2"
            aria-live="polite"
          >
            {view.queue.length === 0 && phase === 'play' && <p className="m-auto text-sm text-muted">รอลูกค้า…</p>}
            {view.queue.map((o, i) => (
              <div
                key={o.id}
                className={`ticket-in relative flex w-[19%] min-w-0 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border bg-surface px-1 py-2 text-center ${
                  i === 0 ? 'border-accent ring-2 ring-accent/40' : 'border-line opacity-80'
                }`}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden="true">{menu[o.item].emoji}</span>
                <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-ink sm:text-xs">{menu[o.item].name}</span>
                <span className="ticket-timer absolute inset-x-0 bottom-0 h-1 origin-left bg-accent" style={{ animationDuration: `${patience}ms` }} />
              </div>
            ))}
          </div>

          {phase === 'play' && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {menu.map((p, i) => (
                <button
                  key={p.product_id}
                  type="button"
                  data-sound="none"
                  onClick={() => serve(i)}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-3 text-left text-sm text-ink shadow-card transition-transform hover:-translate-y-0.5 active:scale-95"
                >
                  <span className="text-2xl" aria-hidden="true">{p.emoji}</span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate">{p.name}</span>
                    <span className="text-xs text-muted">กด {i + 1}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {phase === 'over' && (
            <div className="barista-in mt-4 rounded-2xl bg-surface-2 p-4 text-center">
              <p className="text-sm text-muted">{view.hearts <= 0 ? 'หัวใจหมดแล้ว! ลูกค้าเดินออกร้าน 😭' : 'หมดเวลา! ปิดรอบ ☕'}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-ink">{view.score} แต้ม</p>
              <p className="mt-1 text-accent">{rating(view.score)}</p>
              <p className="mt-1 text-xs text-muted">สถิติสูงสุด {best} แต้ม</p>
              <button
                type="button"
                onClick={start}
                className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-surface transition-transform hover:scale-105 active:scale-95"
              >
                ↺ เล่นอีกรอบ
              </button>
            </div>
          )}
        </div>
      )}
    </Overlay>
  )
}

export default BaristaGame
