import { useSyncExternalStore } from 'react'

// Tiny toast store: call showToast() from anywhere, <Toaster /> renders the current one.
// Only one toast at a time — a new one replaces the old, so they never stack up.

let current = null
let timer = 0
let id = 0
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export function showToast({ icon, title, text, duration = 2800 }) {
  current = { id: ++id, icon, title, text }
  clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, duration)
  emit()
}

export function useToast() {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => current,
  )
}
