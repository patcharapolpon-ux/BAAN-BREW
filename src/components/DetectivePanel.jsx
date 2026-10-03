import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  dailySales,
  explainDay,
  findAnomalies,
  formatBaht,
  formatBahtCompact,
  formatNumber,
  formatPercent,
  formatThaiDate,
  lotteryEffect,
  rowsByDate,
} from '../lib/metrics'
import { playSound } from '../lib/sound'
import { loadLottery, loadProducts, useStatic } from '../lib/staticData'
import { eventNear } from '../lib/thaiEvents'
import { useIsMobile } from '../lib/useIsMobile'
import ChartTooltip from './ChartTooltip'

// Data detective: finds days whose sales were far from normal (z-score vs the same weekday in
// past weeks), pins them on a chart, and explains each "case" by branch, menu and hour.
// Also checks whether lottery draw days (public/lottery.json) sell differently.

const SHORT = { day: 'numeric', month: 'short', year: '2-digit' }
const MAX_CASES = 8
const SPIKE = '#16a34a'
const DROP = '#dc2626'

function DiffList({ title, items, format = (k) => k }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.diff)))
  return (
    <div>
      <p className="mb-2 text-xs text-muted">{title}</p>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map((i) => (
          <li key={i.key} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-sm">
            <span className="truncate text-ink">{format(i.key)}</span>
            <span className="relative h-2.5 rounded-full bg-surface-2">
              <span
                className="absolute inset-y-0 rounded-full"
                style={{
                  background: i.diff >= 0 ? SPIKE : DROP,
                  width: `${(Math.abs(i.diff) / max) * 50}%`,
                  [i.diff >= 0 ? 'left' : 'right']: '50%',
                }}
              />
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
            </span>
            <span className={`text-right tabular-nums ${i.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {i.diff >= 0 ? '+' : '−'}
              {formatBahtCompact(Math.round(Math.abs(i.diff)))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CaseReport({ c, byDate, products }) {
  const why = useMemo(() => explainDay(byDate, c.date, products ?? []), [byDate, c.date, products])
  const change = c.sales / c.expected - 1
  const event = eventNear(c.date)
  return (
    <div className="case-report rounded-2xl border border-line bg-surface-2/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-ink">
          📁 รายงานคดี {formatThaiDate(c.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white`} style={{ background: c.kind === 'spike' ? SPIKE : DROP }}>
          z = {c.z.toFixed(1)}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-2">
        ขายได้ <b className="text-ink">{formatBaht(c.sales)}</b> ปกติวัน{formatThaiDate(c.date, { weekday: 'long' }).replace('วัน', '')}จะขายราว{' '}
        <b className="text-ink">{formatBaht(c.expected)}</b> ({formatPercent(change, 0, true)}) ห่างจากปกติ{' '}
        <b className="text-ink">{Math.abs(c.z).toFixed(1)} เท่า</b>ของความแกว่งปกติ (SD ±{formatBaht(c.sd)})
      </p>
      {event && <p className="mt-1 text-sm text-accent">💡 เบาะแส: ตรงกับ{event}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <DiffList title="สาขาที่ต่างจากปกติที่สุด" items={why.branches} />
        <DiffList title="เมนูที่ต่างจากปกติที่สุด" items={why.products} />
        <DiffList title="ชั่วโมงที่ต่างจากปกติที่สุด" items={why.hours} format={(h) => `${String(h).padStart(2, '0')}:00 น.`} />
      </div>
      <p className="mt-3 text-xs text-muted">เทียบกับวันเดียวกันของ {why.pastDays} สัปดาห์ก่อนหน้า</p>
    </div>
  )
}

function DetectivePanel({ rows, colors, show }) {
  const isMobile = useIsMobile()
  const products = useStatic(loadProducts)
  const lottery = useStatic(loadLottery)
  const [picked, setPicked] = useState(null)
  const [showLottery, setShowLottery] = useState(false)

  const daily = useMemo(() => dailySales(rows), [rows])
  const cases = useMemo(() => findAnomalies(daily).slice(0, MAX_CASES), [daily])
  const byDate = useMemo(() => rowsByDate(rows), [rows])
  const drawDates = useMemo(() => lottery?.draws.map((d) => d.date) ?? [], [lottery])
  const luck = useMemo(() => lotteryEffect(daily, drawDates), [daily, drawDates])
  const current = cases.find((c) => c.date === picked) ?? null

  const open = (date) => {
    playSound('select')
    setPicked((p) => (p === date ? null : date))
  }

  const axis = { fontSize: isMobile ? 11 : 12, fill: colors.muted }
  const ticks = daily.filter((d) => d.date.endsWith('-01')).map((d) => d.date)
  const verdict =
    Math.abs(luck.averageLift) < 0.05
      ? 'สรุป: วันหวยออกขายพอ ๆ กับวันปกติ หวยไม่ได้มีผลกับร้านกาแฟชัดเจน'
      : luck.averageLift > 0
      ? 'สรุป: วันหวยออกขายดีกว่าปกติจริง! (คนถูกหวยมาเลี้ยงกาแฟ?)'
      : 'สรุป: วันหวยออกขายแย่กว่าปกติ (ทุกคนไปลุ้นหวยกันหมด?)'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2 sm:text-sm">
        <span className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SPIKE }} /> ยอดพุ่ง
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: DROP }} /> ยอดดิ่ง
          </span>
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showLottery} onChange={(e) => setShowLottery(e.target.checked)} className="size-4 accent-[var(--accent)]" disabled={!lottery} />
          🎰 แสดงวันหวยออก
        </label>
      </div>

      <div role="img" aria-label={`กราฟยอดขายรายวัน พบวันผิดปกติ ${cases.length} วัน`}>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
          <ComposedChart data={daily} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis dataKey="date" ticks={ticks} tickFormatter={(d) => formatThaiDate(d, { month: 'short', year: '2-digit' })} tick={axis} tickLine={false} axisLine={{ stroke: colors.line }} minTickGap={16} />
            <YAxis tickFormatter={formatBahtCompact} tick={axis} tickLine={false} axisLine={false} width={isMobile ? 44 : 56} />
            <Tooltip content={<ChartTooltip series={{ sales: { name: 'ยอดขาย', color: colors.accentSoft } }} formatLabel={(d) => formatThaiDate(d, { weekday: 'short', ...SHORT })} />} />
            {showLottery && drawDates.map((d) => <ReferenceLine key={d} x={d} stroke="#eab308" strokeOpacity={0.55} strokeDasharray="2 3" />)}
            <Line type="linear" dataKey="sales" stroke={colors.accentSoft} strokeWidth={1.2} dot={false} isAnimationActive={show} />
            {cases.map((c) => (
              <ReferenceDot
                key={c.date}
                x={c.date}
                y={c.sales}
                r={c.date === picked ? 8 : 5.5}
                fill={c.kind === 'spike' ? SPIKE : DROP}
                stroke={colors.surface}
                strokeWidth={2}
                className="cursor-pointer"
                onClick={() => open(c.date)}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 mb-2 text-sm font-medium text-ink">🔎 แฟ้มคดี ({cases.length} วันที่แปลกที่สุด) · คลิกเพื่อเปิดรายงาน</p>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {cases.map((c, i) => {
          const event = eventNear(c.date)
          return (
            <button
              key={c.date}
              type="button"
              data-sound="none"
              onClick={() => open(c.date)}
              className={`case-card shrink-0 snap-start rounded-xl border px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 ${
                picked === c.date ? 'border-accent bg-accent/10' : 'border-line bg-surface'
              }`}
            >
              <span className="block text-xs text-muted">คดีที่ {i + 1}</span>
              <span className="block font-medium whitespace-nowrap text-ink">
                {c.kind === 'spike' ? '📈' : '📉'} {formatThaiDate(c.date, SHORT)}{' '}
                <span style={{ color: c.kind === 'spike' ? SPIKE : DROP }}>{formatPercent(c.sales / c.expected - 1, 0, true)}</span>
              </span>
              {event && <span className="block text-xs whitespace-nowrap text-accent">{event}</span>}
            </button>
          )
        })}
      </div>

      {current && (
        <div className="mt-3">
          <CaseReport c={current} byDate={byDate} products={products} />
        </div>
      )}

      {luck.total > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm">
          <p className="font-medium text-ink">🎰 คดีพิเศษ: วันหวยออกขายดีขึ้นไหม?</p>
          <p className="mt-1 text-ink-2">
            จาก {formatNumber(luck.total)} งวดที่อยู่ในช่วงข้อมูล ขายดีกว่าปกติ {formatNumber(luck.higher)} งวด · เฉลี่ย{' '}
            <b className="text-ink">{formatPercent(luck.averageLift, 1, true)}</b>
          </p>
          <p className="mt-1 text-accent">{verdict}</p>
          <p className="mt-2 text-xs text-muted">ผลสลาก: {lottery?.source}</p>
        </div>
      )}

      <details className="mt-4 text-sm text-ink-2">
        <summary className="cursor-pointer text-accent">นักสืบตัดสินว่า "แปลก" ยังไง? (z-score)</summary>
        <div className="mt-2 space-y-1 rounded-xl bg-surface-2 p-3">
          <p>1. เอายอดของวันเดียวกันใน 8 สัปดาห์ก่อนหน้ามาหาค่าเฉลี่ย (ศุกร์เทียบกับศุกร์ เพราะศุกร์ขายดีกว่าจันทร์อยู่แล้ว)</p>
          <p>2. หาส่วนเบี่ยงเบนมาตรฐาน (SD) = ปกติยอดแกว่งขึ้นลงประมาณเท่าไร</p>
          <p>
            3. <code className="rounded bg-surface px-1">z = (ยอดวันนั้น − ค่าเฉลี่ย) ÷ SD</code> · ถ้า |z| ≥ 2.5 ถือว่าแปลก (เกิดขึ้นเองตามปกติได้น้อยกว่า ~1%)
          </p>
        </div>
      </details>
    </div>
  )
}

export default DetectivePanel
