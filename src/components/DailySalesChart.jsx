import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { describeDaily, findAnomalies, formatBaht, formatBahtCompact, formatThaiDate, lastDays } from '../lib/metrics'
import { sonify } from '../lib/sound'
import { useReducedMotion } from '../lib/motion'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'
import SegmentedControl from './SegmentedControl'

const RANGES = [
  { value: 30, label: '30 วัน' },
  { value: 90, label: '90 วัน' },
  { value: 180, label: '6 เดือน' },
  { value: 0, label: 'ทั้งหมด' },
]

function LegendItem({ color, thickness, label }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block w-5 rounded-full" style={{ height: thickness, background: color }} />
      {label}
    </span>
  )
}

// "Live" marker on the latest day: a solid dot with a ring that keeps pulsing outward.
function PulseDot({ cx, cy, fill, stroke }) {
  if (cx == null || cy == null) return null
  return (
    <g className="pulse-dot">
      <circle className="pulse-ring" cx={cx} cy={cy} r={6} fill={fill} />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke={stroke} strokeWidth={2} />
    </g>
  )
}

// 7-day average is the headline (solid line + soft wash); daily values stay as faded context.
// Range buttons pick how many recent days to show; the chart redraws with an animation each time.
function DailySalesChart({ data, colors }) {
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const [range, setRange] = useState(isMobile ? 90 : 0)
  const shown = lastDays(data, range)

  // 🎧 Listen to the chart: the 7-day average becomes a melody, unusual days ring a bell,
  // and a playhead follows along. `playing` = index into `shown` being heard, or null.
  const [playing, setPlaying] = useState(null)
  const stopRef = useRef(null)
  const summaryId = useId()
  const summary = useMemo(() => describeDaily(shown), [shown])
  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    setPlaying(null)
  }
  useEffect(() => stop, [range]) // a new range (or leaving the page) stops the tune
  const listen = () => {
    if (stopRef.current) return stop()
    const unusual = new Set(findAnomalies(data).map((a) => a.date))
    const accents = new Set(shown.flatMap((d, i) => (unusual.has(d.date) ? [i] : [])))
    stopRef.current = sonify(
      shown.map((d) => d.salesAvg ?? d.sales),
      { seconds: range && range <= 30 ? 6 : 12, accents, onStep: setPlaying, onEnd: () => ((stopRef.current = null), setPlaying(null)) },
    )
    setPlaying(0)
  }
  const heard = playing != null ? shown[playing] : null

  const axis = { fontSize: isMobile ? 11 : 12, fill: colors.muted }
  // Long ranges: one tick per month (the 1st). Short ranges: one tick per week, counted back from today.
  const ticks =
    range && range <= 90
      ? shown.filter((_, i) => (shown.length - 1 - i) % 7 === 0).map((d) => d.date)
      : shown.filter((d) => d.date.endsWith('-01')).map((d) => d.date)
  const tickFormat = range && range <= 90 ? { day: 'numeric', month: 'short' } : { month: 'short', year: '2-digit' }
  const last = shown.at(-1)
  const series = {
    salesAvg: { name: 'ค่าเฉลี่ย 7 วัน', color: colors.accent },
    sales: { name: 'ยอดขายรายวัน', color: colors.accentSoft },
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2 sm:text-sm">
          <LegendItem color={colors.accent} thickness={3} label={series.salesAvg.name} />
          <LegendItem color={colors.accentSoft} thickness={2} label={series.sales.name} />
          <button
            type="button"
            data-sound="none"
            onClick={listen}
            aria-pressed={playing != null}
            className="-my-1 inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition hover:text-accent"
          >
            {playing != null ? '⏹ หยุดฟัง' : '🎧 ฟังกราฟ'}
          </button>
        </div>
        <SegmentedControl
          label="ช่วงเวลา"
          options={RANGES}
          value={range}
          onChange={setRange}
          buttonClassName="h-9 px-3 text-xs sm:text-sm whitespace-nowrap"
        />
      </div>
      {heard && (
        <p className="mb-2 text-xs text-accent tabular-nums" aria-live="off">
          ♪ {formatThaiDate(heard.date, { day: 'numeric', month: 'short', year: '2-digit' })} · {formatBaht(heard.salesAvg ?? heard.sales)}
        </p>
      )}
      <div role="img" aria-label="กราฟยอดขายรายวัน" aria-describedby={summaryId}>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 320}>
        {/* key={range} remounts the chart so the draw-in animation replays on every range change. */}
        <ComposedChart
          key={range}
          data={shown}
          margin={isMobile ? { top: 12, right: 12, bottom: 0, left: 0 } : { top: 12, right: 20, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="avgWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={(d) => formatThaiDate(d, tickFormat)}
            tick={axis}
            tickLine={false}
            axisLine={{ stroke: colors.line }}
            minTickGap={24}
          />
          <YAxis tickFormatter={formatBahtCompact} tick={axis} tickLine={false} axisLine={false} width={isMobile ? 44 : 56} />
          <Tooltip
            cursor={{ stroke: colors.accent, strokeOpacity: 0.5, strokeDasharray: '3 4' }}
            animationDuration={200}
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
            strokeWidth={isMobile ? 0.75 : range && range <= 90 ? 1.75 : 1.25}
            dot={false}
            activeDot={{ r: 3.5, fill: colors.accentSoft, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={1400}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="salesAvg"
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="url(#avgWash)"
            dot={false}
            activeDot={{ r: 6, fill: colors.accent, stroke: colors.surface, strokeWidth: 3 }}
            isAnimationActive={!reduced}
            animationDuration={1600}
            animationBegin={150}
            animationEasing="ease-out"
          />
          {heard && <ReferenceLine x={heard.date} stroke={colors.accent} strokeWidth={2} />}
          {last?.salesAvg != null && (
            <ReferenceDot
              x={last.date}
              y={last.salesAvg}
              shape={<PulseDot fill={colors.accent} stroke={colors.surface} />}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm text-ink-2">
        <summary className="cursor-pointer text-xs text-muted hover:text-accent">📝 อ่านกราฟนี้เป็นข้อความ</summary>
        <p id={summaryId} className="mt-2 rounded-xl bg-surface-2 p-3 leading-relaxed">
          {summary}
        </p>
      </details>
    </>
  )
}

export default DailySalesChart
