import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Full-screen dialog shell for the time machine and the mini game.
// Esc or the ✕ closes it; the page behind stops scrolling while it's open.
// Esc is caught in the capture phase and marked handled, so the neon-mode Esc shortcut
// doesn't also fire.
function Overlay({ title, onClose, children, className = '' }) {
  const panel = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    const previous = document.activeElement
    const { overflow } = document.documentElement.style
    document.documentElement.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.documentElement.style.overflow = overflow
      previous?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="overlay-in fixed inset-0 z-[70] grid place-items-center bg-black/55 p-3 sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`panel-in relative max-h-full w-full max-w-3xl overflow-auto rounded-3xl border border-line bg-surface p-4 shadow-card outline-none sm:p-7 ${className}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent sm:top-5 sm:right-5"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Overlay
