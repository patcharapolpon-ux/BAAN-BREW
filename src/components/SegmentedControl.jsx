import { useLayoutEffect, useRef, useState } from 'react'

// Row of buttons with one highlighted pill that *slides* to the chosen option.
// The pill is a single absolutely-positioned element; we measure the active button
// and move the pill with transform (GPU-friendly, no layout shift).
// `renderOption(option, active)` lets callers draw icons instead of text.
function SegmentedControl({ options, value, onChange, label, renderOption, className = '', buttonClassName = '' }) {
  const buttons = useRef({})
  const [pill, setPill] = useState(null)

  useLayoutEffect(() => {
    const measure = () => {
      const el = buttons.current[value]
      if (el) setPill({ x: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value, options])

  return (
    <div role="group" aria-label={label} className={`relative flex rounded-full border border-line bg-surface p-1 shadow-card ${className}`}>
      {pill && (
        <span
          aria-hidden="true"
          className="seg-pill absolute top-1 bottom-1 left-0 rounded-full bg-surface-2 ring-1 ring-line"
          style={{ width: pill.width, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            ref={(el) => (buttons.current[option.value] = el)}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={(e) => onChange(option.value, e)}
            className={`relative z-10 flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            } ${buttonClassName}`}
          >
            {renderOption ? renderOption(option, active) : option.label}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
