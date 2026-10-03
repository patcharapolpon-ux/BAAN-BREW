import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fireConfetti } from '../lib/confetti'
import { clearEgg, currentSeason, useEgg } from '../lib/eggs'
import { prefersReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'
import { showToast } from '../lib/toast'
import { PugSvg } from './ShopDog'

// The visible half of the easter eggs (lib/eggs.js has the triggers).

// ─── Pug parade: a dozen pugs of different sizes trot across the bottom of the screen ───
const PARADE_MS = 7000
function PugParade({ onDone }) {
  const [pugs] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({ delay: i * 330 + Math.random() * 200, scale: 0.6 + Math.random() * 0.9, bottom: Math.random() * 40 })),
  )
  useEffect(() => {
    playSound('woof')
    showToast({ icon: '🐶', title: 'ขบวนพาเหรดน้องปั๊ก!', text: 'ใครเรียกชื่อพวกเรา~' })
    const barks = [1200, 2600, 4100].map((t) => setTimeout(() => playSound('woof'), t))
    const end = setTimeout(onDone, PARADE_MS + 1500)
    return () => {
      barks.forEach(clearTimeout)
      clearTimeout(end)
    }
  }, [onDone])
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[65] h-40 overflow-hidden" aria-hidden="true">
      {pugs.map((p, i) => (
        <div key={i} className="parade-pug absolute left-0" style={{ bottom: p.bottom, animationDelay: `${p.delay}ms`, '--s': p.scale }}>
          <div className="dog dog-walk">
            <PugSvg />
          </div>
        </div>
      ))}
    </div>,
    document.body,
  )
}

// ─── Lights out: the page goes dark except a flashlight around the pointer.
// A light switch hides somewhere on screen; find it to turn the lights back on. ───
function LightsOut({ onDone }) {
  const dark = useRef(null)
  const [switchAt] = useState(() => ({ x: 10 + Math.random() * 75, y: 18 + Math.random() * 65 }))
  useEffect(() => {
    playSound('thud')
    showToast({ icon: '🔦', title: 'ไฟดับ!', text: 'ใช้ไฟฉายหาสวิตช์ไฟให้เจอ (หรือกด Esc)', duration: 4000 })
    const move = (e) => {
      dark.current?.style.setProperty('--fx', `${e.clientX}px`)
      dark.current?.style.setProperty('--fy', `${e.clientY}px`)
    }
    const key = (e) => e.key === 'Escape' && onDone()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('keydown', key)
    }
  }, [onDone])
  const found = () => {
    playSound('ding')
    fireConfetti()
    showToast({ icon: '💡', title: 'ไฟติดแล้ว!', text: 'สายตาดีมาก นักสืบ' })
    onDone()
  }
  return createPortal(
    <>
      <div ref={dark} className="lights-out pointer-events-none fixed inset-0 z-[66]" aria-hidden="true" />
      <button
        type="button"
        data-sound="none"
        onClick={found}
        className="light-switch fixed z-[65] grid size-12 place-items-center rounded-xl border-2 border-stone-400 bg-stone-100 text-2xl shadow-lg"
        style={{ left: `${switchAt.x}%`, top: `${switchAt.y}%` }}
        aria-label="สวิตช์ไฟ"
      >
        💡
      </button>
    </>,
    document.body,
  )
}

// ─── Screensaver: after IDLE_MS without input, the logo bounces around like an old DVD player.
// Hitting a corner exactly is the moment everyone waited for. ───
const IDLE_MS = 90000
const LOGO_W = 150
const LOGO_H = 64
const HUES = [25, 140, 200, 280, 330, 50]

function Screensaver({ onDone }) {
  const el = useRef(null)
  const [hue, setHue] = useState(0)
  useEffect(() => {
    const s = { x: Math.random() * (innerWidth - LOGO_W), y: Math.random() * (innerHeight - LOGO_H), vx: 2.2, vy: 1.7 }
    let raf = 0
    const tick = () => {
      s.x += s.vx
      s.y += s.vy
      let hitX = false
      let hitY = false
      if (s.x <= 0 || s.x >= innerWidth - LOGO_W) {
        s.vx *= -1
        s.x = Math.max(0, Math.min(s.x, innerWidth - LOGO_W))
        hitX = true
      }
      if (s.y <= 0 || s.y >= innerHeight - LOGO_H) {
        s.vy *= -1
        s.y = Math.max(0, Math.min(s.y, innerHeight - LOGO_H))
        hitY = true
      }
      if (hitX || hitY) setHue((h) => (h + 1) % HUES.length)
      if (hitX && hitY) {
        playSound('fanfare')
        fireConfetti()
        showToast({ icon: '📀', title: 'เข้ามุมพอดีเป๊ะ!!!', text: 'ช่วงเวลาที่ทุกคนรอคอย' })
      }
      if (el.current) el.current.style.transform = `translate(${s.x}px, ${s.y}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const wake = () => onDone()
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    // A moment's grace so the mouse nudge that's still settling doesn't close it instantly.
    const arm = setTimeout(() => events.forEach((ev) => window.addEventListener(ev, wake, { passive: true })), 400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(arm)
      events.forEach((ev) => window.removeEventListener(ev, wake))
    }
  }, [onDone])
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black" aria-hidden="true">
      <div
        ref={el}
        className="absolute top-0 left-0 grid place-items-center rounded-full font-display text-3xl font-semibold"
        style={{ width: LOGO_W, height: LOGO_H, color: `hsl(${HUES[hue]} 90% 60%)`, border: `3px solid hsl(${HUES[hue]} 90% 60%)` }}
      >
        บ้านบรู
      </div>
      <p className="absolute inset-x-0 bottom-6 text-center text-xs text-white/30">ขยับเมาส์เพื่อกลับไปทำงาน</p>
    </div>,
    document.body,
  )
}

function useIdle(ms, enabled) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let timer = 0
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => !document.hidden && setIdle(true), ms)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart']
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((ev) => window.removeEventListener(ev, reset))
    }
  }, [ms, enabled, idle])
  const wake = useCallback(() => setIdle(false), [])
  return [idle, wake]
}

// ─── Seasonal decorations ───
function Seasonal({ season }) {
  // Songkran: every click splashes water.
  useEffect(() => {
    if (season !== 'songkran') return
    const splash = (e) => {
      for (let i = 0; i < 10; i++) {
        const d = document.createElement('span')
        d.className = 'splash-drop'
        d.textContent = '💧'
        d.style.left = `${e.clientX}px`
        d.style.top = `${e.clientY}px`
        const a = Math.random() * Math.PI * 2
        d.style.setProperty('--dx', `${Math.cos(a) * (40 + Math.random() * 60)}px`)
        d.style.setProperty('--dy', `${Math.sin(a) * (40 + Math.random() * 60) - 30}px`)
        document.body.append(d)
        d.addEventListener('animationend', () => d.remove())
      }
    }
    window.addEventListener('pointerdown', splash, { passive: true })
    showToast({ icon: '💦', title: 'สุขสันต์วันสงกรานต์!', text: 'คลิกตรงไหนก็เปียก' })
    return () => window.removeEventListener('pointerdown', splash)
  }, [season])

  useEffect(() => {
    if (season === 'newyear') {
      const t = [600, 1400, 2300].map((ms) => setTimeout(fireConfetti, ms))
      showToast({ icon: '🎆', title: 'สวัสดีปีใหม่!', text: 'ขอให้ยอดขายปีนี้ปังกว่าเดิม' })
      return () => t.forEach(clearTimeout)
    }
    if (season === 'halloween') showToast({ icon: '🎃', title: 'Happy Halloween', text: 'น้องปั๊กแต่งตัวมาด้วยนะ' })
    if (season === 'xmas') showToast({ icon: '🎄', title: 'Merry Christmas', text: 'หิมะตกที่กรุงเทพฯ (ในเว็บเท่านั้น)' })
  }, [season])

  if (season !== 'halloween' && season !== 'xmas') return null
  const flakes = season === 'xmas' ? 40 : 6
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden="true">
      {Array.from({ length: flakes }, (_, i) => (
        <span
          key={i}
          className={season === 'xmas' ? 'snowflake' : 'bat'}
          style={{
            left: `${(i * 97) % 100}%`,
            top: season === 'halloween' ? `${10 + ((i * 37) % 60)}%` : undefined,
            animationDelay: `${(i * 1.7) % (season === 'xmas' ? 10 : 18)}s`,
            animationDuration: `${season === 'xmas' ? 8 + (i % 7) : 14 + (i % 5) * 2}s`,
            fontSize: season === 'xmas' ? `${8 + (i % 4) * 4}px` : undefined,
          }}
        >
          {season === 'xmas' ? '❄' : '🦇'}
        </span>
      ))}
    </div>,
    document.body,
  )
}

function Eggs() {
  const egg = useEgg()
  const [season] = useState(currentSeason)
  const [idle, wakeUp] = useIdle(IDLE_MS, !egg && !prefersReducedMotion())

  return (
    <>
      {egg?.name === 'parade' && !prefersReducedMotion() && <PugParade key={egg.id} onDone={clearEgg} />}
      {egg?.name === 'lights' && <LightsOut key={egg.id} onDone={clearEgg} />}
      {idle && <Screensaver onDone={wakeUp} />}
      {season && <Seasonal season={season} />}
    </>
  )
}

export default Eggs
