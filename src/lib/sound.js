import { useSyncExternalStore } from 'react'

// Sound effects, synthesized with the Web Audio API: no audio files to download, and each
// sound is a handful of oscillator/noise nodes that the browser throws away when it ends.
//
// Smoothness notes:
// - The AudioContext is created lazily on the first click (browsers block audio before a
//   user gesture anyway) and suspended again after a few idle seconds, so a silent page
//   costs nothing.
// - The noise buffer is generated once and reused.
// - Rapid clicks are throttled so spamming a button can't pile up hundreds of nodes.

const STORAGE_KEY = 'baanbrew-sound'
const listeners = new Set()
let enabled = readSaved()
let ctx = null
let noise = null
let idleTimer = 0
let lastPlay = 0

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(next) {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // private mode etc. — the toggle still works for this visit
  }
  listeners.forEach((fn) => fn())
}

/** [enabled, setEnabled] shared by every component that uses it. */
export function useSound() {
  const value = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => enabled,
  )
  return [value, setSoundEnabled]
}

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
    // 1 s of white noise, reused by every "pour"/"whoosh" sound.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => ctx.suspend(), 4000)
  return ctx
}

// Short pitched blip with a fast attack and exponential fade — the building block for taps.
function blip(ac, { freq, to = freq, start = 0, dur = 0.08, gain = 0.2, type = 'sine' }) {
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

// Band-passed noise whose filter sweeps from→to: sounds like liquid pouring or air moving.
function swoosh(ac, { from, to, dur, gain = 0.25, q = 1.2 }) {
  const t = ac.currentTime
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  src.buffer = noise
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

const SOUNDS = {
  // Soft wooden "tok" — every ordinary button.
  tap: (ac) => blip(ac, { freq: 520, to: 180, dur: 0.07, gain: 0.18 }),
  // Two rising notes — picking a filter / tab.
  select: (ac) => {
    blip(ac, { freq: 660, dur: 0.07, gain: 0.12, type: 'triangle' })
    blip(ac, { freq: 990, start: 0.06, dur: 0.1, gain: 0.12, type: 'triangle' })
  },
  // Coffee pouring as the new theme spreads over the page.
  pour: (ac) => {
    swoosh(ac, { from: 2400, to: 500, dur: 0.55, gain: 0.3, q: 2 })
    blip(ac, { freq: 300, to: 420, start: 0.05, dur: 0.35, gain: 0.05 })
  },
  // Beans rattling — a burst of tiny random clicks (the logo easter egg).
  beans: (ac) => {
    for (let i = 0; i < 9; i++) {
      const f = 1400 + Math.random() * 1800
      blip(ac, { freq: f, to: f * 0.6, start: i * 0.03 + Math.random() * 0.02, dur: 0.03, gain: 0.08, type: 'square' })
    }
  },
  // Upward whoosh — back to top.
  whoosh: (ac) => swoosh(ac, { from: 300, to: 3000, dur: 0.4, gain: 0.22 }),
}

export function playSound(name = 'tap') {
  if (!enabled || !SOUNDS[name]) return
  const now = performance.now()
  if (now - lastPlay < 45) return
  lastPlay = now
  const ac = audio()
  if (ac) SOUNDS[name](ac)
}

/**
 * One delegated listener for the whole page instead of wiring every button.
 * Plays the sound named by the nearest data-sound attribute, or "tap" for any other button/link.
 */
export function installClickSounds() {
  const onDown = (e) => {
    if (e.button !== 0) return
    const target = e.target.closest?.('[data-sound], button, a[href], [role="tab"]')
    if (!target || target.disabled) return
    const named = target.closest('[data-sound]')?.dataset.sound
    playSound(named || 'tap')
  }
  document.addEventListener('pointerdown', onDown, { passive: true })
  return () => document.removeEventListener('pointerdown', onDown)
}
