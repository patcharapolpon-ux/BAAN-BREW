import { useState } from 'react'

// Plain-HTML horizontal bars with the numbers written on every row, so nothing depends on
// color or hovering. Bars grow from 0 when `show` turns true; hovering a row fades the rest.
// items: [{ key, label, value, text, sub?, strength? }]
//   value    → bar length (relative to the largest item)
//   text     → the number printed at the right
//   sub      → small grey line under the label
//   strength → 0–1 bar opacity, e.g. to fade from "recent" to "long ago"; 0 = hatched grey
function BarList({ items, show = true }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(...items.map((d) => d.value), 1)

  return (
    <ul className="space-y-3">
      {items.map((d, i) => {
        const dim = hover != null && hover !== i
        const empty = d.strength === 0
        return (
          <li
            key={d.key}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`transition-opacity duration-200 ${dim ? 'opacity-40' : ''}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink-2">{d.label}</span>
              <span className="shrink-0 font-medium text-ink tabular-nums">{d.text}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 [transition-timing-function:var(--ease-out)] ${empty ? 'hatch' : 'bg-accent'}`}
                style={{
                  width: show ? `${(d.value / max) * 100}%` : '0%',
                  opacity: empty ? undefined : (d.strength ?? 1),
                  transitionDelay: `${i * 70}ms`,
                }}
              />
            </div>
            {d.sub && <p className="mt-1 text-xs text-muted">{d.sub}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export default BarList
