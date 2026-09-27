import { useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatPercent } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

// Horizontal bars so Thai branch names stay readable; data arrives sorted largest first.
// Value labels carry baht + share of total on wide screens, baht only on phones.
// Hovering a bar fades the others (focus + context). `show` = the panel has scrolled into
// view; until then we keep an empty box of the same height so bars "grow" when you arrive.
function BranchSalesChart({ data, colors, show = true }) {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(null)
  const shareByBranch = Object.fromEntries(data.map((d) => [d.branch, d.share]))
  const height = Math.max(200, data.length * (isMobile ? 44 : 54))

  if (!show) return <div style={{ height }} />

  const renderLabel = ({ x, y, width, height, value, index }) => {
    const branch = data[index].branch
    const dim = activeIndex != null && activeIndex !== index
    return (
      <text
        x={x + width + 10}
        y={y + height / 2}
        dominantBaseline="central"
        fontSize={isMobile ? 12 : 13}
        className="bar-cell"
        style={{ opacity: dim ? 0.35 : 1 }}
      >
        <tspan fill={colors.ink} fontWeight={activeIndex === index ? 600 : 400} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatBaht(value)}
        </tspan>
        {!isMobile && <tspan fill={colors.muted}>{`  ·  ${formatPercent(shareByBranch[branch])}`}</tspan>}
      </text>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: isMobile ? 80 : 150, bottom: 0, left: 0 }}
        barCategoryGap={isMobile ? 12 : 14}
        onMouseMove={(state) => {
          const i = state?.activeTooltipIndex
          setActiveIndex(i == null ? null : Number(i))
        }}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          {/* Bars get darker toward their tip — reads like a coffee "pour". */}
          <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.accentSoft} />
            <stop offset="100%" stopColor={colors.accent} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="branch"
          tick={{ fontSize: isMobile ? 12 : 14, fill: colors.ink2 }}
          tickLine={false}
          axisLine={false}
          width={isMobile ? 78 : 104}
        />
        <Tooltip
          cursor={{ fill: colors.surface2, radius: 8 }}
          content={
            <ChartTooltip
              series={{ sales: { name: 'ยอดขาย', color: colors.accent } }}
              extra={(d) => `อันดับ ${data.indexOf(d) + 1} จาก ${data.length} · ${formatPercent(d.share)} ของทั้งหมด`}
            />
          }
        />
        <Bar
          dataKey="sales"
          radius={[0, 8, 8, 0]}
          isAnimationActive={!reduced}
          animationDuration={1100}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell
              key={d.branch}
              className="bar-cell"
              fill="url(#barFill)"
              style={{ opacity: activeIndex != null && activeIndex !== i ? 0.35 : 1 }}
            />
          ))}
          <LabelList dataKey="sales" content={renderLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default BranchSalesChart
