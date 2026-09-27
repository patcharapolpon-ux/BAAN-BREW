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

// Segmented control: three real buttons, current one marked with aria-pressed.
function ThemeToggle({ preference, onChange }) {
  return (
    <div role="group" aria-label="ธีมสี" className="flex rounded-full border border-line bg-surface p-1 shadow-card">
      {OPTIONS.map(({ value, label }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => onChange(value)}
            className={`flex size-8 items-center sm:size-9 justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[value]}
            </svg>
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ThemeToggle
