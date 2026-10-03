import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'

// The shop pug. It wanders along the bottom of the screen, sits, sometimes hops onto a KPI
// card for a nap, and falls asleep when nobody has touched the page for a while.
// Click it and it barks.
//
// Smoothness: walking is ONE CSS transition on transform (duration = distance ÷ speed), so
// the browser animates it on the compositor with no JavaScript per frame. JS only wakes up
// when the dog reaches its target (transitionend) to pick the next thing to do.

const W = 64
const H = 48
const SPEED = 60 // px per second
const IDLE_SLEEP = 25000 // ms without input → sleep

const rand = (a, b) => a + Math.random() * (b - a)

function PugSvg() {
  return (
    <svg viewBox="0 0 64 48" width={W} height={H} aria-hidden="true" className="dog-svg overflow-visible">
      {/* curly tail */}
      <path className="dog-tail" d="M14 27c-7 0-8-9-2-10 5-1 6 5 1 6" fill="none" stroke="#d6ad76" strokeWidth="4.5" strokeLinecap="round" />
      {/* back legs, front legs (animated when walking) — short and stubby */}
      <g fill="#c99a62">
        <rect className="dog-leg dog-leg-b1" x="15" y="35" width="6" height="10" rx="3" />
        <rect className="dog-leg dog-leg-b2" x="22" y="35" width="6" height="10" rx="3" />
        <rect className="dog-leg dog-leg-f1" x="37" y="35" width="6" height="10" rx="3" />
        <rect className="dog-leg dog-leg-f2" x="44" y="35" width="6" height="10" rx="3" />
      </g>
      {/* chunky body */}
      <ellipse cx="31" cy="30" rx="20" ry="11.5" fill="#e3c08f" />
      <ellipse cx="33" cy="35" rx="13" ry="4.5" fill="#efd3a8" />
      {/* head */}
      <g className="dog-head">
        <circle cx="52" cy="21" r="11.5" fill="#e3c08f" />
        {/* folded black ears */}
        <path d="M43.5 12.5q-4.5 1-4 7.5 3.5-1.5 6.5-4.5z" fill="#3a2b22" />
        <path d="M58.5 11q5 .5 5.5 6.5-3.5-.5-6.5-3z" fill="#3a2b22" />
        {/* forehead wrinkles */}
        <path d="M48 13.5q4-2 8 0M47.5 16q4.5-1.6 9 0" stroke="#b98a55" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* black mask */}
        <ellipse cx="53.5" cy="25.5" rx="7.5" ry="5.5" fill="#3a2b22" />
        {/* big round eyes with a shine */}
        <g className="dog-eyes">
          <circle cx="47.5" cy="20" r="2.8" fill="#1b140f" />
          <circle cx="57.5" cy="19.5" r="2.8" fill="#1b140f" />
          <circle cx="48.4" cy="19.1" r="0.9" fill="#fff" />
          <circle cx="58.4" cy="18.6" r="0.9" fill="#fff" />
        </g>
        <path className="dog-closed" d="M45.5 20.5q2 1.4 4 0M55.5 20q2 1.4 4 0" stroke="#1b140f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* nose, mouth, tongue */}
        <ellipse cx="54" cy="23.2" rx="2.4" ry="1.6" fill="#111" />
        <path d="M54 24.8q-1.6 2.2-3.6 1.2M54 24.8q1.6 2.2 3.6 1.2" stroke="#111" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path className="dog-tongue" d="M53.4 26.6q.6 3.6 2.4 3.2 1.2-.4.6-3.4z" fill="#f08a8a" />
      </g>
      {/* red collar with a gold tag */}
      <path d="M42.5 24.5q2.5 6.5 8.5 8" stroke="#d64545" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="32.5" r="1.8" fill="#f2c94c" />
    </svg>
  )
}

function ShopDog() {
  const reduced = useReducedMotion()
  const el = useRef(null)
  const state = useRef({ x: 80, y: 0, facing: 1, mode: 'sit', timer: 0 })
  const [mode, setMode] = useState('sit') // walk | sit | nap | sleep | jump
  const [facing, setFacing] = useState(1)
  const [hearts, setHearts] = useState([])
  const idle = useRef(0)

  const floorY = () => window.innerHeight - H - 6

  // Move instantly (no transition) or glide over `ms`.
  const place = useCallback((x, y, ms = 0, easing = 'linear') => {
    const s = state.current
    x = Math.max(0, Math.min(x, window.innerWidth - W)) // always on screen, even after a resize
    y = Math.max(0, y)
    s.x = x
    s.y = y
    const node = el.current
    if (!node) return
    node.style.transition = ms ? `transform ${ms}ms ${easing}` : 'none'
    node.style.transform = `translate(${x}px, ${y}px)`
  }, [])

  const setModeBoth = useCallback((m) => {
    state.current.mode = m
    setMode(m)
  }, [])

  const next = useCallback(() => {
    const s = state.current
    clearTimeout(s.timer)
    if (s.mode === 'sleep') return
    const r = Math.random()
    const cards = [...document.querySelectorAll('.card')].filter((c) => {
      const b = c.getBoundingClientRect()
      return b.top > 80 && b.top < window.innerHeight - 120 && b.width > W + 20
    })
    if (r < 0.2 && cards.length && s.mode !== 'nap') {
      // hop onto a visible card and nap there
      const b = cards[Math.floor(Math.random() * cards.length)].getBoundingClientRect()
      const x = b.left + rand(8, b.width - W - 8)
      const y = b.top - H + 10
      setFacing(x > s.x ? 1 : -1)
      setModeBoth('jump')
      const node = el.current
      node.style.transition = 'none'
      node.animate(
        [
          { transform: `translate(${s.x}px, ${s.y}px)` },
          { transform: `translate(${(s.x + x) / 2}px, ${Math.min(s.y, y) - 70}px)`, offset: 0.5 },
          { transform: `translate(${x}px, ${y}px)` },
        ],
        { duration: 650, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
      ).onfinish = () => {
        place(x, y)
        setModeBoth('nap')
        s.timer = setTimeout(() => jumpDown(), rand(9000, 15000))
      }
    } else if (r < 0.6 || s.mode === 'nap') {
      if (s.mode === 'nap') return jumpDown()
      setModeBoth('sit')
      s.timer = setTimeout(next, rand(2500, 6000))
    } else {
      // walk somewhere along the floor
      const x = rand(10, window.innerWidth - W - 10)
      const dist = Math.abs(x - s.x)
      setFacing(x > s.x ? 1 : -1)
      setModeBoth('walk')
      place(x, floorY(), (dist / SPEED) * 1000)
      s.timer = setTimeout(next, (dist / SPEED) * 1000 + 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, setModeBoth])

  const jumpDown = useCallback(() => {
    const s = state.current
    clearTimeout(s.timer)
    setModeBoth('jump')
    const y = floorY()
    place(s.x, y, 450, 'cubic-bezier(0.5, 0, 0.9, 0.6)')
    s.timer = setTimeout(() => {
      setModeBoth('sit')
      s.timer = setTimeout(next, rand(1500, 3500))
    }, 460)
  }, [next, place, setModeBoth])

  useEffect(() => {
    if (reduced) return
    const s = state.current
    place(rand(20, window.innerWidth * 0.4), floorY())
    s.timer = setTimeout(next, 1500)

    // Scrolling moves the card away from under a napping dog → it hops down.
    const onScroll = () => state.current.mode === 'nap' && jumpDown()
    const onResize = () => (s.mode === 'nap' ? jumpDown() : place(s.x, floorY()))
    // Any input resets the sleep timer and wakes the dog up.
    const wake = () => {
      clearTimeout(idle.current)
      idle.current = setTimeout(() => {
        clearTimeout(s.timer)
        if (s.mode === 'nap' || s.mode === 'jump') place(s.x, floorY(), 400)
        setModeBoth('sleep')
      }, IDLE_SLEEP)
      if (s.mode === 'sleep') {
        setModeBoth('sit')
        s.timer = setTimeout(next, 1200)
      }
    }
    wake()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake)
    window.addEventListener('wheel', wake, { passive: true })
    return () => {
      clearTimeout(s.timer)
      clearTimeout(idle.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('wheel', wake)
    }
  }, [reduced, next, jumpDown, place, setModeBoth])

  const pet = () => {
    playSound('woof')
    const id = Date.now()
    setHearts((h) => [...h.slice(-4), id])
    setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000)
  }

  if (reduced) return null
  return (
    <div ref={el} className="fixed top-0 left-0 z-30" style={{ width: W, height: H }}>
      <button
        type="button"
        data-sound="none"
        onClick={pet}
        aria-label="น้องปั๊กประจำร้าน (กดเพื่อลูบ)"
        className={`dog dog-${mode} block cursor-pointer focus-visible:outline-2 focus-visible:outline-accent`}
        style={{ transform: `scaleX(${facing})` }}
      >
        <PugSvg />
      </button>
      {mode === 'sleep' && (
        <span className="dog-zzz pointer-events-none absolute -top-5 right-0 text-sm font-semibold text-muted" aria-hidden="true">
          z<span>z</span>
          <span>Z</span>
        </span>
      )}
      {hearts.map((id) => (
        <span key={id} className="dog-heart pointer-events-none absolute -top-3 left-1/2 text-lg" aria-hidden="true">
          ❤️
        </span>
      ))}
    </div>
  )
}

export default ShopDog
