import { flushSync } from 'react-dom'
import { prefersReducedMotion } from '../lib/motion'
import SegmentedControl from './SegmentedControl'

const ICONS = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  dark: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
}

const OPTIONS = [
  { value: 'light', label: 'สว่าง' },
  { value: 'dark', label: 'มืด' },
  { value: 'system', label: 'ตามระบบ' },
]

/**
 * Theme change with a circular "ink spreading" reveal from the button that was clicked.
 * View Transitions API: the browser screenshots the old page, we update the DOM
 * (flushSync makes React do it right now), then we animate a growing circle clip-path
 * over the new page. Browsers without the API (or reduced motion) just switch instantly.
 */
function switchTheme(next, event, onChange) {
  if (!document.startViewTransition || prefersReducedMotion()) {
    onChange(next)
    return
  }
  const { clientX: x, clientY: y } = event
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const transition = document.startViewTransition(() => flushSync(() => onChange(next)))
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
}

function ThemeToggle({ preference, onChange }) {
  return (
    <SegmentedControl
      label="ธีมสี"
      options={OPTIONS}
      value={preference}
      onChange={(next, event) => next !== preference && switchTheme(next, event, onChange)}
      buttonClassName="size-8 sm:size-9"
      renderOption={({ value, label }, active) => (
        <>
          {/* key changes when it becomes active → React remounts it → spin-in replays */}
          <svg
            key={active ? 'on' : 'off'}
            viewBox="0 0 24 24"
            className={`size-[18px] ${active ? 'spin-in' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[value]}
          </svg>
          <span className="sr-only">{label}</span>
        </>
      )}
    />
  )
}

export default ThemeToggle
