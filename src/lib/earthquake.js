import { showToast } from './toast'
import { prefersReducedMotion } from './motion'
import { playSound } from './sound'

// "Earthquake": the cards and panels on screen fall down under real physics (Matter.js) and
// can be grabbed and thrown with the mouse. Press the button again and everything flies home.
//
// How it stays smooth:
// - Matter.js is loaded with import() on the first quake, so normal visits never download it.
// - Each element stays where it is in the layout; we only write a transform (translate +
//   rotate) per frame, which the GPU composites without re-layout.
// - Only elements visible on screen take part, and page scrolling is locked meanwhile, so the
//   physics world is simply the viewport.

let active = null // { items, cleanup } while a quake is on

const SELECTOR = 'main .card, main .reveal, main [role="group"][aria-label="เลือกสาขา"]'

export function isQuaking() {
  return active != null
}

let starting = false // true while loading Matter.js / shaking, so double clicks don't start two quakes

export async function toggleQuake() {
  if (active) return restore()
  if (starting) return
  if (prefersReducedMotion()) {
    showToast({ icon: '🌍', title: 'ปิดแผ่นดินไหวไว้', text: 'เครื่องนี้ตั้งค่าลดการเคลื่อนไหวไว้' })
    return
  }
  starting = true
  const { default: Matter } = await import('matter-js')
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter

  const visible = [...document.querySelectorAll(SELECTOR)].filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.top < innerHeight && r.width > 0
  })
  // an element inside another picked element moves with its parent, so skip it
  const els = visible.filter((el) => !visible.some((other) => other !== el && other.contains(el)))
  if (!els.length) {
    starting = false
    return
  }

  document.documentElement.style.overflow = 'hidden'
  const engine = Engine.create({ gravity: { y: 1.1 } })
  const wall = { isStatic: true }
  const T = 200 // wall thickness, well outside the screen
  Composite.add(engine.world, [
    Bodies.rectangle(innerWidth / 2, innerHeight + T / 2, innerWidth * 3, T, wall),
    Bodies.rectangle(-T / 2, innerHeight / 2, T, innerHeight * 4, wall),
    Bodies.rectangle(innerWidth + T / 2, innerHeight / 2, T, innerHeight * 4, wall),
    Bodies.rectangle(innerWidth / 2, -innerHeight - T, innerWidth * 3, T, wall),
  ])

  const items = els.map((el) => {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const body = Bodies.rectangle(cx, cy, r.width, r.height, {
      restitution: 0.25,
      friction: 0.4,
      frictionAir: 0.015,
      chamfer: { radius: 16 },
    })
    // a little random kick so it doesn't just drop straight down
    Body.setVelocity(body, { x: (Math.random() - 0.5) * 6, y: -Math.random() * 4 })
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05)
    // Keep the element's animations/transitions from fighting our per-frame transform.
    const saved = { transform: el.style.transform, transition: el.style.transition, animation: el.style.animation, opacity: el.style.opacity, willChange: el.style.willChange, zIndex: el.style.zIndex, position: el.style.position }
    el.style.animation = 'none'
    el.style.opacity = '1'
    el.style.transition = 'none'
    el.style.willChange = 'transform'
    el.style.position = el.style.position || 'relative'
    el.style.zIndex = '46'
    return { el, body, cx, cy, saved }
  })
  Composite.add(engine.world, items.map((i) => i.body))

  // Transparent layer that catches the mouse for dragging, plus the "fix it" button on top.
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[48] cursor-grab active:cursor-grabbing'
  overlay.setAttribute('aria-hidden', 'true')
  document.body.append(overlay)
  const mouse = Mouse.create(overlay)
  mouse.pixelRatio = 1
  const grab = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } })
  Composite.add(engine.world, grab)

  const fix = document.createElement('button')
  fix.type = 'button'
  fix.dataset.sound = 'select'
  fix.textContent = '🔧 ซ่อมบ้าน'
  fix.className = 'quake-fix fixed top-4 left-1/2 z-[49] -translate-x-1/2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-surface shadow-card'
  fix.addEventListener('click', () => restore())
  document.body.append(fix)

  // Thuds when things hit hard enough (the sound module throttles rapid repeats).
  Events.on(engine, 'collisionStart', (e) => {
    for (const pair of e.pairs) {
      const speed = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y)
      if (speed > 6) {
        playSound('thud')
        break
      }
    }
  })

  // Our own loop: step the physics, then write the transforms.
  let raf = 0
  let last = performance.now()
  const loop = (now) => {
    Engine.update(engine, Math.max(1, Math.min(now - last, 32))) // clamp: rAF time can be before `last`
    last = now
    for (const { el, body, cx, cy } of items) {
      el.style.transform = `translate(${body.position.x - cx}px, ${body.position.y - cy}px) rotate(${body.angle}rad)`
    }
    raf = requestAnimationFrame(loop)
  }

  // Shake first, then let go.
  playSound('rumble')
  document.documentElement.classList.add('quake-shake')
  await new Promise((r) => setTimeout(r, 650))
  document.documentElement.classList.remove('quake-shake')
  raf = requestAnimationFrame(loop)

  const onKey = (e) => e.key === 'Escape' && restore()
  window.addEventListener('keydown', onKey)

  starting = false
  active = {
    items,
    cleanup() {
      cancelAnimationFrame(raf)
      Events.off(engine)
      Engine.clear(engine)
      overlay.remove()
      fix.remove()
      window.removeEventListener('keydown', onKey)
    },
  }
  showToast({ icon: '🌍', title: 'แผ่นดินไหว!', text: 'ลากโยนการ์ดเล่นได้ · กด 🔧 หรือ Esc เพื่อซ่อม' })
}

function restore() {
  if (!active) return
  const { items, cleanup } = active
  active = null
  cleanup()
  // Everything flies back home with a springy transition, then we hand the styles back.
  for (const { el } of items) {
    el.style.transition = 'transform 900ms cubic-bezier(0.34, 1.56, 0.64, 1)'
    el.style.transform = 'translate(0px, 0px) rotate(0rad)'
  }
  playSound('whoosh')
  setTimeout(() => {
    for (const { el, saved } of items) Object.assign(el.style, saved)
    document.documentElement.style.overflow = ''
  }, 950)
}
