import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts'
import { formatBaht, formatPercent } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'

/**
 * Donut with a live center label. Hover a slice (or its legend row) and:
 * - that slice slides outward (bigger outerRadius) with a soft halo ring,
 * - the other slices fade,
 * - the center switches from the total to that slice's name + share.
 * Legend rows are real buttons, so keyboard users get the same highlight via focus.
 */
function DonutChart({ data, colors, show = true }) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(null)
  const total = data.reduce((sum, d) => sum + d.sales, 0)
  const current = active != null ? data[active] : null
  const color = (i) => colors.categorical[i % colors.categorical.length]

  // Custom slice renderer: the hovered one grows and gets a thin outer ring.
  const renderShape = (props) => {
    const isActive = props.index === active
    return (
      <g style={{ opacity: active == null || isActive ? 1 : 0.35, transition: 'opacity 300ms' }}>
        <Sector {...props} outerRadius={props.outerRadius + (isActive ? 8 : 0)} cornerRadius={6} />
        {isActive && (
          <Sector
            {...props}
            innerRadius={props.outerRadius + 12}
            outerRadius={props.outerRadius + 15}
            fill={props.fill}
            opacity={0.5}
          />
        )}
      </g>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6 lg:flex-col xl:flex-row">
      <div className="relative size-52 shrink-0">
        {show && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="sales"
                nameKey="name"
                innerRadius="58%"
                outerRadius="80%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                shape={renderShape}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
                isAnimationActive={!reduced}
                animationDuration={1100}
                animationEasing="ease-out"
                rootTabIndex={-1}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={color(i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        {/* Center label sits on top of the SVG; pointer-events-none so it doesn't block hover. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div key={current?.name ?? 'total'} className="pop">
            <p className="text-xs text-muted">{current ? current.name : 'รวมทั้งหมด'}</p>
            <p className="text-lg font-medium text-ink tabular-nums">
              {current ? formatPercent(current.share) : formatBaht(total)}
            </p>
          </div>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {data.map((d, i) => (
          <li key={d.name}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-accent ${
                active === i ? 'translate-x-1 bg-surface-2' : ''
              } ${active != null && active !== i ? 'opacity-50' : ''}`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: color(i) }} />
              {/* Name on top, baht underneath — keeps full Thai names readable in a narrow column. */}
              <span className="min-w-0 flex-1">
                <span className="block text-ink-2">{d.name}</span>
                <span className="block text-xs text-muted tabular-nums">{formatBaht(d.sales)}</span>
              </span>
              <span className="font-medium text-ink tabular-nums">{formatPercent(d.share)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DonutChart
