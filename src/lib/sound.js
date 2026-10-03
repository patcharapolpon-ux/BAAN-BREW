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
let beat = null // { timer, master, step, nextTime } while the secret-mode music plays

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
  idleTimer = setTimeout(() => !beat && ctx.suspend(), 4000)
  return ctx
}

// Short pitched blip with a fast attack and exponential fade — the building block for taps.
function blip(ac, { freq, to = freq, start = 0, dur = 0.08, gain = 0.2, type = 'sine', out = ac.destination }) {
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(amp).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

// Band-passed noise whose filter sweeps from→to: sounds like liquid pouring or air moving.
function swoosh(ac, { from, to, dur, gain = 0.25, q = 1.2, start = 0, type = 'bandpass', out = ac.destination }) {
  const t = ac.currentTime + start
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const amp = ac.createGain()
  src.buffer = noise
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(amp).connect(out)
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
  // Ta-da-da-DAAA — the top branch was picked.
  fanfare: (ac) => {
    ;[523, 659, 784].forEach((f, i) => blip(ac, { freq: f, start: i * 0.1, dur: 0.12, gain: 0.12, type: 'triangle' }))
    ;[1047, 1319].forEach((f) => blip(ac, { freq: f, start: 0.3, dur: 0.6, gain: 0.08, type: 'triangle' }))
    swoosh(ac, { from: 4000, to: 8000, dur: 0.5, gain: 0.08, q: 0.8 })
  },
  // "Meow": a sawtooth that rises then falls, through a vowel-ish band-pass.
  // Pug bark: two short, low, slightly growly "boof"s.
  woof: (ac) => {
    const t0 = ac.currentTime
    for (const [delay, pitch] of [[0, 1], [0.2, 0.92]]) {
      const t = t0 + delay
      const osc = ac.createOscillator()
      const mouth = ac.createBiquadFilter()
      const amp = ac.createGain()
      osc.type = 'sawtooth'
      const base = (330 + Math.random() * 40) * pitch
      osc.frequency.setValueAtTime(base, t)
      osc.frequency.linearRampToValueAtTime(base * 1.25, t + 0.03)
      osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.14)
      mouth.type = 'lowpass'
      mouth.Q.value = 6
      mouth.frequency.setValueAtTime(1400, t)
      mouth.frequency.exponentialRampToValueAtTime(500, t + 0.14)
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(0.35, t + 0.015)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(mouth).connect(amp).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.18)
    }
  },
  // Cash register: drawer clunk, then a bright two-bell "ka-CHING".
  kaching: (ac) => {
    swoosh(ac, { from: 900, to: 300, dur: 0.08, gain: 0.2, q: 0.9, type: 'lowpass' })
    blip(ac, { freq: 2093, start: 0.06, dur: 0.18, gain: 0.08, type: 'triangle' })
    ;[2637, 3136, 3951].forEach((f) => blip(ac, { freq: f, start: 0.13, dur: 0.55, gain: 0.06, type: 'triangle' }))
  },
  // The pug eating: three quick crunchy noise bites.
  chomp: (ac) => {
    for (let i = 0; i < 3; i++) swoosh(ac, { from: 2200, to: 700, dur: 0.07, gain: 0.25, q: 1.5, start: i * 0.11 })
  },

  // Earthquake: long low rumble.
  rumble: (ac) => {
    swoosh(ac, { from: 90, to: 50, dur: 1.6, gain: 0.9, q: 0.6, type: 'lowpass' })
    blip(ac, { freq: 55, to: 35, dur: 1.4, gain: 0.35 })
  },
  // Something heavy landing.
  thud: (ac) => {
    blip(ac, { freq: 140 + Math.random() * 60, to: 45, dur: 0.18, gain: 0.35 })
    swoosh(ac, { from: 600, to: 200, dur: 0.12, gain: 0.15, q: 0.8, type: 'lowpass' })
  },
  // Game: correct serve (ding) / wrong or missed (buzz).
  ding: (ac) => {
    blip(ac, { freq: 1320, dur: 0.25, gain: 0.12, type: 'triangle' })
    blip(ac, { freq: 1760, start: 0.07, dur: 0.3, gain: 0.1, type: 'triangle' })
  },
  wrong: (ac) => blip(ac, { freq: 180, to: 110, dur: 0.28, gain: 0.14, type: 'square' }),
  // Rising arpeggio — entering the secret mode.
  secret: (ac) => {
    ;[392, 494, 587, 784, 988].forEach((f, i) => blip(ac, { freq: f, start: i * 0.07, dur: 0.2, gain: 0.1, type: 'square' }))
  },
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

// ─── Secret-mode music: a small lo-fi loop, scheduled ahead on the audio clock ───
// A timer wakes every 50 ms and books the notes of the next ~0.2 s on the AudioContext's own
// clock, so the rhythm stays tight even if the page is busy (the standard Web Audio pattern).

const BPM = 84
const STEP = 60 / BPM / 4 // one 16th note, in seconds
const KICK = new Set([0, 7, 10])
const SNARE = new Set([4, 12])
// Am7 → Fmaj7 → Cmaj7 → G6, one chord per bar
const CHORDS = [
  [220, 261.6, 329.6, 392],
  [174.6, 220, 261.6, 329.6],
  [261.6, 329.6, 392, 493.9],
  [196, 246.9, 293.7, 329.6],
]

function scheduleStep(ac, step, time) {
  const { master } = beat
  const at = time - ac.currentTime
  const s = step % 16
  if (KICK.has(s)) blip(ac, { freq: 130, to: 42, start: at, dur: 0.28, gain: 0.5, out: master })
  if (SNARE.has(s)) swoosh(ac, { from: 1800, to: 1200, dur: 0.16, gain: 0.25, q: 0.7, start: at, out: master })
  if (s % 2 === 0) swoosh(ac, { from: 9000, to: 7000, dur: 0.04, gain: s % 4 === 2 ? 0.08 : 0.04, q: 1, start: at, type: 'highpass', out: master })
  if (s === 0 || s === 10) {
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length]
    chord.forEach((f) => blip(ac, { freq: f, start: at, dur: s === 0 ? 1.6 : 0.9, gain: 0.035, type: 'triangle', out: master }))
  }
}

// ─── Sonification: hear a chart. Higher sales = higher note, time = left → right speaker ───
// Notes come from a pentatonic scale (no notes clash, so any data sounds musical). Long
// series are averaged into at most MAX_NOTES notes so the whole chart takes `seconds`.
// It plays even when click sounds are switched off: pressing "listen" is an explicit request.

const PENTATONIC = [0, 2, 4, 7, 9] // C D E G A
const MAX_NOTES = 120
const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12)

/**
 * Plays `values` as a melody. `accents` = indexes to mark with a bell (e.g. unusual days).
 * onStep(i) is called with the index (into `values`) being heard; onEnd() when done.
 * Returns stop().
 */
export function sonify(values, { seconds = 10, accents = new Set(), onStep, onEnd } = {}) {
  const ac = audio()
  if (!ac || values.length === 0) return () => {}
  const per = Math.max(1, Math.ceil(values.length / MAX_NOTES))
  const notes = []
  for (let i = 0; i < values.length; i += per) {
    const chunk = values.slice(i, i + per)
    notes.push({ start: i, value: chunk.reduce((a, b) => a + b, 0) / chunk.length, accent: chunk.some((_, k) => accents.has(i + k)) })
  }
  const min = Math.min(...notes.map((n) => n.value))
  const max = Math.max(...notes.map((n) => n.value))
  const steps = PENTATONIC.length * 2 // two octaves
  const step = seconds / notes.length
  const master = ac.createGain()
  master.gain.value = 0.9
  master.connect(ac.destination)
  const t0 = ac.currentTime + 0.15
  notes.forEach((n, k) => {
    const level = max === min ? 0.5 : (n.value - min) / (max - min)
    const idx = Math.round(level * (steps - 1))
    const midi = 60 + 12 * Math.floor(idx / PENTATONIC.length) + PENTATONIC[idx % PENTATONIC.length]
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null
    if (pan) {
      pan.pan.value = notes.length === 1 ? 0 : (k / (notes.length - 1)) * 2 - 1
      pan.connect(master)
    }
    const out = pan ?? master
    const at = t0 + k * step - ac.currentTime
    blip(ac, { freq: midiToHz(midi), start: at, dur: Math.max(0.09, step * 1.6), gain: 0.09, type: 'triangle', out })
    if (n.accent) blip(ac, { freq: midiToHz(midi + 24), start: at, dur: 0.35, gain: 0.07, type: 'sine', out })
  })
  // Keep the context awake for the whole tune (audio() would otherwise suspend it when idle).
  const keepAwake = setInterval(() => audio(), 2000)
  let raf = 0
  const tick = () => {
    const k = Math.floor((ac.currentTime - t0) / step)
    if (k >= notes.length) {
      stop()
      onEnd?.()
      return
    }
    if (k >= 0) onStep?.(notes[k].start)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  function stop() {
    cancelAnimationFrame(raf)
    clearInterval(keepAwake)
    master.gain.setTargetAtTime(0, ac.currentTime, 0.05)
    setTimeout(() => master.disconnect(), 300)
  }
  return stop
}

/** Is the lo-fi loop playing right now? (Stories only stops it if it started it.) */
export const isBeatPlaying = () => beat !== null

export function startBeat() {
  if (beat || !enabled) return
  const ac = audio()
  if (!ac) return
  // Master volume with a low-pass "warmth" filter; fades in so it doesn't start abruptly.
  const master = ac.createGain()
  const warm = ac.createBiquadFilter()
  warm.type = 'lowpass'
  warm.frequency.value = 3200
  master.gain.setValueAtTime(0.0001, ac.currentTime)
  master.gain.exponentialRampToValueAtTime(0.6, ac.currentTime + 1.2)
  master.connect(warm).connect(ac.destination)
  beat = { master, step: 0, nextTime: ac.currentTime + 0.1 }
  beat.timer = setInterval(() => {
    while (beat.nextTime < ac.currentTime + 0.2) {
      scheduleStep(ac, beat.step, beat.nextTime)
      beat.step++
      beat.nextTime += STEP
    }
  }, 50)
}

export function stopBeat() {
  if (!beat) return
  const { timer, master } = beat
  clearInterval(timer)
  beat = null
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value || 0.0001, t)
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  setTimeout(() => master.disconnect(), 600)
  audio() // restart the idle timer so the context can sleep again
}
