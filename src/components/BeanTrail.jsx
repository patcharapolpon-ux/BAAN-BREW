import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../lib/motion'

// Coffee beans that tumble out behind the mouse cursor.
//
// Built for smoothness rather than with one DOM element per bean:
// - One full-screen <canvas>; it never takes part in layout, so no reflow while you move.
// - A fixed pool of bean objects, reused forever — no garbage created per frame.
// - The bean is drawn once into a small sprite canvas (per theme color) and then just
//   stamped with drawImage, which is far cheaper than drawing paths every frame.
// - The animation loop only runs while beans are alive. Mouse still → loop stops → zero cost.
// - Movement is time-based (dt), so it looks the same on 60 Hz and 144 Hz screens.
// - Mouse only (pointer: fine): touch screens and "reduce motion" users don't get it.

const POOL = 48
const SPACING = 16 // px of mouse travel between beans
const LIFE = 750 // ms
const SPRITE = 32 // sprite size in px (before devicePixelRatio)

function makeSprite(color, dpr) {
  const c = document.createElement('canvas')
  c.width = c.height = SPRITE * dpr
  const g = c.getContext('2d')
  g.scale(dpr, dpr)
  g.translate(SPRITE / 2, SPRITE / 2)
  g.rotate(Math.PI / 5)
  g.fillStyle = color
  g.beginPath()
  g.ellipse(0, 0, 6, 8.5, 0, 0, Math.PI * 2)
  g.fill()
  // the crease down the middle of a coffee bean
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  g.lineWidth = 1.4
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(0, -6.5)
  g.bezierCurveTo(-2.5, -2, 2.5, 2, 0, 6.5)
  g.stroke()
  return c
}

function BeanTrail({ theme }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()
  const spriteRef = useRef(null)

  // Re-draw the sprite in the new accent color whenever the theme changes.
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8a4b1c'
    spriteRef.current = makeSprite(color, Math.min(window.devicePixelRatio || 1, 2))
  }, [theme])

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return
    const canvas = canvasRef.current
    const g = canvas.getContext('2d')
    const beans = Array.from({ length: POOL }, () => ({ alive: false }))
    let next = 0
    let alive = 0
    let raf = 0
    let last = 0
    let lastX = null
    let lastY = null
    let travel = 0
    let dpr = 1

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
    }
    resize()

    const spawn = (x, y, dx, dy) => {
      const b = beans[next]
      next = (next + 1) % POOL
      if (!b.alive) alive++
      const speed = Math.hypot(dx, dy) || 1
      b.alive = true
      b.x = x
      b.y = y
      // drift a little backwards from the direction of travel, plus some scatter
      b.vx = (-dx / speed) * 0.04 + (Math.random() - 0.5) * 0.12
      b.vy = (-dy / speed) * 0.04 - Math.random() * 0.08
      b.rot = Math.random() * Math.PI * 2
      b.spin = (Math.random() - 0.5) * 0.012
      b.size = 0.55 + Math.random() * 0.45
      b.age = 0
    }

    const frame = (now) => {
      const dt = Math.min(now - last, 50) // after a tab switch, don't jump a whole second
      last = now
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, canvas.width, canvas.height)
      const sprite = spriteRef.current
      const half = SPRITE / 2
      for (const b of beans) {
        if (!b.alive) continue
        b.age += dt
        if (b.age >= LIFE) {
          b.alive = false
          alive--
          continue
        }
        b.vy += 0.0006 * dt // gravity
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.rot += b.spin * dt
        const t = b.age / LIFE
        const s = b.size * (1 - t * 0.6) * dpr
        g.globalAlpha = 1 - t * t
        g.setTransform(s * Math.cos(b.rot), s * Math.sin(b.rot), -s * Math.sin(b.rot), s * Math.cos(b.rot), b.x * dpr, b.y * dpr)
        g.drawImage(sprite, -half, -half, SPRITE, SPRITE)
      }
      g.globalAlpha = 1
      raf = alive > 0 ? requestAnimationFrame(frame) : 0
    }

    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return
      const { clientX: x, clientY: y } = e
      if (lastX == null) {
        lastX = x
        lastY = y
        return
      }
      const dx = x - lastX
      const dy = y - lastY
      travel += Math.hypot(dx, dy)
      lastX = x
      lastY = y
      if (travel < SPACING) return
      travel = 0
      spawn(x, y, dx, dy)
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const onLeave = () => (lastX = lastY = null)

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', resize)
    }
  }, [reduced])

  if (reduced) return null
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />
}

export default BeanTrail
