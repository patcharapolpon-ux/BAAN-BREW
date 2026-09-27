import { useId } from 'react'

// Tiny trend line drawn by hand — no chart library, just an SVG <path>.
// How the "draw-in" works: pathLength="1" makes the path's length count as 1, so
// stroke-dasharray: 1 + stroke-dashoffset animating 1 → 0 reveals it from left to right.
// `key` on the path (from the data) replays the draw whenever the data changes.
function Sparkline({ values, className = '' }) {
  // useId gives a unique id per instance; strip characters that break url(#id).
  const id = `spark${useId().replace(/[^\w-]/g, '')}`
  if (values.length < 2) return null
  const width = 100
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)])
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const key = values.join(',')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path key={`a${key}`} d={area} fill={`url(#${id})`} className="spark-area" />
      <path
        key={`l${key}`}
        d={line}
        pathLength="1"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-line"
      />
    </svg>
  )
}

export default Sparkline
