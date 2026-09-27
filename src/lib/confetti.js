import { prefersReducedMotion } from './motion'

// Confetti burst, same recipe as the bean trail: one canvas, time-based motion, and the
// loop ends as soon as the last piece has fallen. The canvas is created on the first burst
// and removed when it's done, so the page carries nothing extra between celebrations.

const COUNT = 140
const LIFE = 2600 // ms

let canvas = null
let g = null
let pieces = []
let raf = 0
let last = 0
let dpr = 1

function colors() {
  const css = getComputedStyle(document.documentElement)
  return ['--cat-1', '--cat-2', '--cat-3', '--cat-4', '--accent-soft'].map((v) => css.getPropertyValue(v).trim())
}

function ensureCanvas() {
  if (canvas) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'pointer-events-none fixed inset-0 z-[60] h-full w-full'
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  document.body.append(canvas)
  g = canvas.getContext('2d')
}

function frame(now) {
  const dt = Math.min(now - last, 50)
  last = now
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, canvas.width, canvas.height)
  let alive = 0
  for (const p of pieces) {
    p.age += dt
    if (p.age >= LIFE) continue
    alive++
    p.vy += 0.0009 * dt // gravity
    p.vx *= 0.985 // air drag
    p.vy *= 0.985
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.spin * dt
    p.flip += p.flipSpeed * dt
    const fade = p.age > LIFE - 500 ? (LIFE - p.age) / 500 : 1
    g.globalAlpha = fade
    g.fillStyle = p.color
    // cos(flip) squashes the piece on one axis → looks like paper tumbling in 3D
    const c = Math.cos(p.rot) * dpr
    const s = Math.sin(p.rot) * dpr
    const f = Math.cos(p.flip)
    g.setTransform(c, s, -s * f, c * f, p.x * dpr, p.y * dpr)
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
  }
  if (alive > 0) {
    raf = requestAnimationFrame(frame)
  } else {
    canvas.remove()
    canvas = g = null
    pieces = []
    raf = 0
  }
}

/** Two cannons fire from the bottom corners toward the middle of the screen. */
export function fireConfetti() {
  if (prefersReducedMotion()) return
  ensureCanvas()
  const palette = colors()
  pieces = pieces.filter((p) => p.age < LIFE) // drop finished pieces from an earlier burst
  for (let i = 0; i < COUNT; i++) {
    const left = i % 2 === 0
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7
    const speed = 1.1 + Math.random() * 0.9
    pieces.push({
      x: left ? -10 : innerWidth + 10,
      y: innerHeight * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.02,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.008 + Math.random() * 0.012,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      color: palette[i % palette.length],
      age: 0,
    })
  }
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
}
