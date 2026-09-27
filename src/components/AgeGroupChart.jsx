import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBaht, formatNumber, formatPercent } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

// Members per age group, youngest → oldest (a fixed order, never re-sorted by size, so the
// x-axis reads like an age scale). Spend per member is a different measure, so it lives in
// the tooltip and the panel's summary line instead of a second axis.
function AgeGroupChart({ data, colors, show = true }) {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const height = isMobile ? 220 : 260

  if (!show) return <div style={{ height }} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%">
        <defs>
          <linearGradient id="ageFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.accentSoft} />
            <stop offset="100%" stopColor={colors.accent} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12, fill: colors.ink2 }} tickLine={false} axisLine={{ stroke: colors.line }} interval={0} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: colors.surface2, radius: 6 }}
          content={
            <ChartTooltip
              format={(v) => `${formatNumber(v)} คน`}
              formatLabel={(l) => `อายุ ${l}`}
              series={{ members: { name: 'สมาชิก', color: colors.accent } }}
              extra={(d) => `${formatPercent(d.share)} ของสมาชิก · ใช้จ่ายเฉลี่ย ${formatBaht(d.spendPerBuyer)}/คน`}
            />
          }
        />
        <Bar dataKey="members" fill="url(#ageFill)" radius={[6, 6, 0, 0]} isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out">
          <LabelList
            dataKey="members"
            position="top"
            formatter={(v) => formatNumber(v)}
            style={{ fontSize: 12, fill: colors.ink2, fontVariantNumeric: 'tabular-nums' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default AgeGroupChart
