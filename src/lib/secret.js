import { useEffect, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { showToast } from './toast'
import { prefersReducedMotion } from './motion'
import { playSound } from './sound'

// Secret "2 a.m. café" neon mode.
// Ways in: the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) on a keyboard, or tapping the logo
// 5 times quickly on a phone. The same again (or Esc) switches it off.
// It only sets <html data-mode="neon">; index.css swaps the color tokens, so every
// component and chart follows without knowing this mode exists. Not saved: it's a secret.

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
const listeners = new Set()
let neon = false
let taps = []

function setNeon(next) {
  if (next === neon) return
  const apply = () => {
    neon = next
    if (next) document.documentElement.dataset.mode = 'neon'
    else delete document.documentElement.dataset.mode
    flushSync(() => listeners.forEach((fn) => fn()))
  }
  // Same circular reveal as the theme switch, but from the middle of the screen.
  if (document.startViewTransition && !prefersReducedMotion()) {
    const transition = document.startViewTransition(apply)
    transition.ready.then(() => {
      const r = Math.hypot(innerWidth, innerHeight) / 2
      document.documentElement.animate(
        { clipPath: [`circle(0px at 50% 50%)`, `circle(${r}px at 50% 50%)`] },
        { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    }).catch(() => {}) // hidden tab or interrupted: the change still applies, just without the animation
  } else {
    apply()
  }
  if (next) {
    playSound('secret')
    showToast({ icon: '🌙', title: 'โหมดคาเฟ่ตีสอง', text: 'ใส่รหัสอีกครั้ง หรือกด Esc เพื่อกลับ', duration: 3500 })
  } else {
    showToast({ icon: '☀️', title: 'กลับสู่โลกปกติ', duration: 1800 })
  }
}

export const toggleNeon = () => setNeon(!neon)

/** Call on every logo tap; 5 taps within 2 seconds toggles the mode. */
export function countLogoTap() {
  const now = performance.now()
  taps = [...taps.filter((t) => now - t < 2000), now]
  if (taps.length >= 5) {
    taps = []
    toggleNeon()
  }
}

/** Is neon mode on? Also installs the keyboard listener (once, from App). */
export function useNeonMode() {
  const value = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => neon,
  )
  useEffect(() => {
    let recent = [] // the last 10 keys pressed
    const onKey = (e) => {
      if (e.defaultPrevented) return // an open dialog already handled this key
      if (e.key === 'Escape' && neon) return setNeon(false)
      // e.code for B/A, so it still works with the keyboard switched to Thai (where B types "ิ").
      const key = e.code === 'KeyB' ? 'b' : e.code === 'KeyA' ? 'a' : e.key
      recent = [...recent, key].slice(-KONAMI.length)
      if (recent.join() === KONAMI.join()) {
        recent = []
        toggleNeon()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return value
}
