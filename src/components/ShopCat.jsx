import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'

// The shop cat. It wanders along the bottom of the screen, sits, sometimes hops onto a KPI
// card for a nap, and falls asleep when nobody has touched the page for a while.
// Click it and it meows.
//
// Smoothness: walking is ONE CSS transition on transform (duration = distance ÷ speed), so
// the browser animates it on the compositor with no JavaScript per frame. JS only wakes up
// when the cat reaches its target (transitionend) to pick the next thing to do.

const W = 64
const H = 48
const SPEED = 60 // px per second
const IDLE_SLEEP = 25000 // ms without input → sleep

const rand = (a, b) => a + Math.random() * (b - a)

function CatSvg() {
  return (
    <svg viewBox="0 0 64 48" width={W} height={H} aria-hidden="true" className="cat-svg overflow-visible">
      {/* tail */}
      <path className="cat-tail" d="M12 30c-6-2-9-9-6-15" fill="none" stroke="#e08a3c" strokeWidth="5" strokeLinecap="round" />
      {/* back legs, front legs (animated when walking) */}
      <g fill="#d27a2e">
        <rect className="cat-leg cat-leg-b1" x="15" y="34" width="5" height="11" rx="2.5" />
        <rect className="cat-leg cat-leg-b2" x="21" y="34" width="5" height="11" rx="2.5" />
        <rect className="cat-leg cat-leg-f1" x="38" y="34" width="5" height="11" rx="2.5" />
        <rect className="cat-leg cat-leg-f2" x="44" y="34" width="5" height="11" rx="2.5" />
      </g>
      {/* body */}
      <ellipse cx="31" cy="31" rx="20" ry="10" fill="#e8913f" />
      <path d="M22 23c2 3 2 7 0 10M30 22c2 3 2 7 0 11" stroke="#c86f25" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* head */}
      <g className="cat-head">
        <path d="M44 14l2-9 6 7M55 12l4-8 2 10" fill="#e8913f" />
        <circle cx="53" cy="20" r="10" fill="#e8913f" />
        <path d="M47 11l1.5-4 3 4" fill="#f5b8a0" />
        <g className="cat-eyes" fill="#2b2118">
          <ellipse cx="50" cy="19" rx="1.4" ry="2" />
          <ellipse cx="57" cy="19" rx="1.4" ry="2" />
        </g>
        <path className="cat-closed" d="M48.5 19.5q1.5 1.2 3 0M55.5 19.5q1.5 1.2 3 0" stroke="#2b2118" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M53 22.5l-1.2 1.2h2.4z" fill="#f08a8a" />
        <path d="M53 23.7q-1 1.6-2.6 1M53 23.7q1 1.6 2.6 1" stroke="#2b2118" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d="M60 22h4M60 24l3.5 1M46 22h-4M46 24l-3.5 1" stroke="#fff" strokeWidth="0.7" opacity="0.8" />
      </g>
    </svg>
  )
}

function ShopCat() {
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

    // Scrolling moves the card away from under a napping cat → it hops down.
    const onScroll = () => state.current.mode === 'nap' && jumpDown()
    const onResize = () => (s.mode === 'nap' ? jumpDown() : place(s.x, floorY()))
    // Any input resets the sleep timer and wakes the cat up.
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
    playSound('meow')
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
        aria-label="แมวประจำร้าน (กดเพื่อลูบ)"
        className={`cat cat-${mode} block cursor-pointer focus-visible:outline-2 focus-visible:outline-accent`}
        style={{ transform: `scaleX(${facing})` }}
      >
        <CatSvg />
      </button>
      {mode === 'sleep' && (
        <span className="cat-zzz pointer-events-none absolute -top-5 right-0 text-sm font-semibold text-muted" aria-hidden="true">
          z<span>z</span>
          <span>Z</span>
        </span>
      )}
      {hearts.map((id) => (
        <span key={id} className="cat-heart pointer-events-none absolute -top-3 left-1/2 text-lg" aria-hidden="true">
          ❤️
        </span>
      ))}
    </div>
  )
}

export default ShopCat
