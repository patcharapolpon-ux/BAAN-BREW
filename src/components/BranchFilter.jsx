// Row of branch chips. Picking one filters the whole dashboard; "ทุกสาขา" clears it.
// Real buttons with aria-pressed, so it works by keyboard too (the bar chart click is a bonus).
function BranchFilter({ branches, value, onChange }) {
  const options = [{ value: null, label: 'ทุกสาขา' }, ...branches.map((b) => ({ value: b, label: b }))]
  return (
    <div role="group" aria-label="เลือกสาขา" className="flex flex-wrap gap-2">
      {options.map(({ value: v, label }) => {
        const active = v === value
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-all duration-300 [transition-timing-function:var(--ease-spring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 ${
              active
                ? 'chip-active border-accent bg-accent text-surface shadow-card'
                : 'border-line bg-surface/80 text-ink-2 hover:-translate-y-0.5 hover:border-accent/50 hover:text-ink'
            }`}
          >
            {/* Checkmark grows in on the active chip (width animates via max-width, cheap here) */}
            <svg
              viewBox="0 0 16 16"
              className={`size-3.5 transition-all duration-300 ${active ? 'max-w-4 opacity-100' : 'max-w-0 opacity-0'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
            </svg>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default BranchFilter
