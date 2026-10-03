import { useEffect, useSyncExternalStore } from 'react'
import { showToast } from './toast'

// Easter eggs that live outside any one component: the DevTools greeting, the tab title,
// the late-night nag, typed secret words, seasonal decorations and a tiny event bus so
// e.g. the shop sign can switch the lights off for <Eggs />.

// ─── event bus: emitEgg('parade') anywhere → useEgg() in <Eggs /> sees it ───
let active = null // { name, id }
let id = 0
const listeners = new Set()
export function emitEgg(name) {
  active = { name, id: ++id }
  listeners.forEach((fn) => fn())
}
export function clearEgg() {
  active = null
  listeners.forEach((fn) => fn())
}
export const useEgg = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => active,
  )

// ─── seasons: ?season=halloween|xmas|songkran|newyear previews one any day ───
const SEASONS = [
  { key: 'newyear', from: '12-31', to: '01-01' },
  { key: 'songkran', from: '04-12', to: '04-16' },
  { key: 'halloween', from: '10-24', to: '11-01' },
  { key: 'xmas', from: '12-18', to: '12-26' },
]
export function currentSeason(date = new Date()) {
  const forced = new URLSearchParams(window.location.search).get('season')
  if (forced) return SEASONS.some((s) => s.key === forced) ? forced : null
  const md = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(5) // "MM-DD"
  const hit = SEASONS.find((s) => (s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to))
  return hit?.key ?? null
}
export const SEASON_HAT = { halloween: '🎃', xmas: '🎅', newyear: '🥳', songkran: '🌺' }

// ─── once per page load ───
const PUG_ART = String.raw`
      __      _
    o'')}____//      บ้านบรู · ฝ่ายไอที (ตำแหน่ง: น้องปั๊ก)
     \_/      )
     (_(_/-(_/       สวัสดีนักพัฒนา! แอบเปิด DevTools ใช่มั้ย 👀
`
function greetDevelopers() {
  console.log(`%c${PUG_ART}`, 'color:#d9955a;font-family:monospace;font-size:12px')
  console.log('%cลองพิมพ์ baanbrew.help() ดูสิ ☕', 'color:#8a4b1c;font-weight:bold;font-size:13px')
  window.baanbrew = {
    help() {
      console.log(
        [
          '🔎 ความลับในร้านนี้ (คำใบ้ ไม่ใช่เฉลย):',
          '  1. นักเล่นเกมยุค 90 รู้รหัสลับ ↑↑↓↓…',
          '  2. ป้าย OPEN ไม่ชอบโดนจิ้มบ่อย ๆ',
          '  3. ลองพิมพ์ชื่อพนักงานดีเด่นของร้าน (ภาษาไทยหรืออังกฤษก็ได้)',
          '  4. แม่น้ำในแผนที่ 3D มีอะไรล่องมาถ้าเคาะเรียก',
          '  5. ยอดขายรวม… ถ้าคลิกรัว ๆ จะอ่านออกเสียงแบบเช็คธนาคาร',
          '  6. ปล่อยหน้าเว็บไว้เฉย ๆ สักพัก',
          '  7. น้องปั๊กชอบให้ลูบ ลูบเยอะ ๆ ได้ไหม?',
          '  8. คนทำเว็บหล่อจริงไหม ลองชี้ชื่อค้างไว้',
          '  9. เทศกาลไทยบางวันร้านจะแต่งตัว (?season=songkran)',
          '  เพิ่มเติม: baanbrew.pug() · baanbrew.lights()',
        ].join('\n'),
      )
      return '☕ ขอให้สนุก'
    },
    pug: () => (emitEgg('parade'), '🐶🐶🐶'),
    lights: () => (emitEgg('lights'), '🔦'),
  }
}

function lateNightNag() {
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false })) % 24
  if (hour >= 5) return
  setTimeout(() => showToast({ icon: '🌙', title: 'ดึกแล้วนะ…', text: 'ร้านปิดตั้งแต่สามทุ่ม ไปนอนได้แล้ว น้องปั๊กหลับไปนานแล้ว 💤', duration: 5000 }), 2500)
}

// The tab title changes while you're looking at another tab, and greets you when you come back.
function tabTitle() {
  const original = document.title
  let timer = 0
  const onChange = () => {
    clearTimeout(timer)
    if (document.hidden) document.title = '☕ กลับมาก่อน… น้องปั๊กคิดถึง'
    else {
      document.title = '🐶 เย้! กลับมาแล้ว'
      timer = setTimeout(() => (document.title = original), 2000)
    }
  }
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

// Typing "pug" or "ปั๊ก" anywhere (outside form fields) starts the pug parade.
const WORDS = ['pug', 'ปั๊ก', 'ปัก'] // ปัก: tone marks are easy to miss on a Thai keyboard
function secretWords() {
  let typed = ''
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.key.length !== 1) return
    typed = (typed + e.key.toLowerCase()).slice(-6)
    if (WORDS.some((w) => typed.endsWith(w))) {
      typed = ''
      emitEgg('parade')
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

/** Installs all the page-wide eggs once (from App). */
export function useGlobalEggs() {
  useEffect(() => {
    greetDevelopers()
    lateNightNag()
    const offTitle = tabTitle()
    const offWords = secretWords()
    return () => {
      offTitle()
      offWords()
      delete window.baanbrew
    }
  }, [])
}

/** Click something `count` times within `ms` → callback. Returns the click handler. */
export function rapidClicks(count, ms, callback) {
  let times = []
  return () => {
    const now = performance.now()
    times = [...times.filter((t) => now - t < ms), now]
    if (times.length >= count) {
      times = []
      callback()
    }
  }
}
