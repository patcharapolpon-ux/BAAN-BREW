import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBahtCompact, formatThaiDate } from '../lib/metrics'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

function LegendItem({ color, thickness, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block w-5 rounded-full" style={{ height: thickness, background: color }} />
      {label}
    </span>
  )
}

// 7-day average is the headline (solid line + soft wash); daily values stay as faded context.
function DailySalesChart({ data, colors }) {
  const isMobile = useIsMobile()
  const axis = { fontSize: isMobile ? 11 : 12, fill: colors.muted }
  // One tick per month (the 1st), instead of hundreds of daily labels.
  const monthTicks = data.filter((d) => d.date.endsWith('-01')).map((d) => d.date)
  const series = {
    salesAvg: { name: 'ค่าเฉลี่ย 7 วัน', color: colors.accent },
    sales: { name: 'ยอดขายรายวัน', color: colors.accentSoft },
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2 sm:text-sm">
        <LegendItem color={colors.accent} thickness={3} label={series.salesAvg.name} />
        <LegendItem color={colors.accentSoft} thickness={2} label={series.sales.name} />
      </div>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
        <ComposedChart
          data={data}
          margin={isMobile ? { top: 8, right: 8, bottom: 0, left: 0 } : { top: 8, right: 16, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="avgWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="date"
            ticks={monthTicks}
            tickFormatter={(d) => formatThaiDate(d, { day: 'numeric', month: 'short', year: '2-digit' })}
            tick={axis}
            tickLine={false}
            axisLine={{ stroke: colors.line }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatBahtCompact}
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={isMobile ? 44 : 56}
          />
          <Tooltip
            cursor={{ stroke: colors.muted, strokeDasharray: '3 4' }}
            content={
              <ChartTooltip
                series={series}
                formatLabel={(d) => formatThaiDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              />
            }
          />
          <Line
            type="linear"
            dataKey="sales"
            stroke={colors.accentSoft}
            strokeWidth={isMobile ? 0.75 : 1.25}
            dot={false}
            activeDot={{ r: 3.5, fill: colors.accentSoft, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="salesAvg"
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="url(#avgWash)"
            dot={false}
            activeDot={{ r: 5, fill: colors.accent, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  )
}

export default DailySalesChart
