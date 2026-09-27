import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber, formatThaiDate } from '../lib/metrics'
import { useReducedMotion } from '../lib/motion'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

const monthLabel = (m) => formatThaiDate(`${m}-01`, { month: 'short', year: '2-digit' })
const people = (v) => `${formatNumber(v)} คน`

// New members per month. The month that isn't over yet is drawn faint with a "*" so nobody
// reads its short bar as a drop (same trap as BadChart4 in Lab 2.2).
function JoinsChart({ data, colors, show = true }) {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const height = isMobile ? 220 : 280

  if (!show) return <div style={{ height }} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
        <defs>
          <linearGradient id="joinFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.accentSoft} />
            <stop offset="100%" stopColor={colors.accent} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="month"
          tickFormatter={(m) => monthLabel(m) + (data.find((d) => d.month === m)?.partial ? '*' : '')}
          tick={{ fontSize: 11, fill: colors.muted }}
          tickLine={false}
          axisLine={{ stroke: colors.line }}
          minTickGap={isMobile ? 18 : 8}
        />
        <YAxis
          tickFormatter={(v) => formatNumber(v)}
          tick={{ fontSize: 11, fill: colors.muted }}
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
          domain={[0, (max) => Math.ceil(max / 50) * 50]}
          tickCount={6}
        />
        <Tooltip
          cursor={{ fill: colors.surface2, radius: 6 }}
          content={
            <ChartTooltip
              format={people}
              formatLabel={monthLabel}
              series={{ count: { name: 'สมาชิกใหม่', color: colors.accent } }}
              extra={(d) => (d.partial ? 'เดือนนี้ยังไม่จบ ข้อมูลยังไม่ครบทั้งเดือน' : null)}
            />
          }
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={!reduced} animationDuration={900} animationEasing="ease-out">
          {data.map((d) => (
            <Cell key={d.month} fill="url(#joinFill)" fillOpacity={d.partial ? 0.35 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default JoinsChart
