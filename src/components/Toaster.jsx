import { useSyncExternalStore } from 'react'

// Tiny toast system: call showToast() from anywhere, <Toaster /> renders the current one.
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

function Toaster() {
  const toast = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => current,
  )
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 sm:top-24">
      {toast && (
        // key remounts the element so the pop-in replays for every new toast
        <div
          key={toast.id}
          className="toast-in flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card"
        >
          <span className="toast-icon text-3xl leading-none" aria-hidden="true">
            {toast.icon}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-ink">{toast.title}</p>
            {toast.text && <p className="text-xs text-muted sm:text-sm">{toast.text}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default Toaster
