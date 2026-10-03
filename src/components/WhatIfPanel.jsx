import { useMemo, useState } from 'react'
import { formatBaht, formatPercent, THAI_WEEKDAYS, WHAT_IF, whatIf, whatIfFacts } from '../lib/metrics'
import { useCountUp } from '../lib/motion'
import { loadBranches, useStatic } from '../lib/staticData'
import SegmentedControl from './SegmentedControl'

// "What if…" simulator: move the levers, see next year's revenue change, and always see the
// assumptions behind it. The heavy part (whatIfFacts) runs once; every lever move is just
// arithmetic (whatIf), so dragging a slider stays smooth.

const ELASTICITY = [
  { value: -0.3, label: 'ไม่ค่อยสน' },
  { value: -0.8, label: 'ปานกลาง' },
  { value: -1.5, label: 'อ่อนไหวมาก' },
]
const START = { priceChange: 0, elasticity: -0.8, closedWeekday: null, shiftShare: 0.3, extraHour: false, newBranchType: null, cannibal: 0.15 }
const STEP_LABEL = {
  closed: (s) => `ปิดทุกวัน${THAI_WEEKDAYS[s.closedWeekday]}`,
  extraHour: (_, f) => `เปิดถึง ${String(f.lastHour + 2).padStart(2, '0')}:00 (+1 ชม.)`,
  newBranch: (s) => `สาขาใหม่ (${s.newBranchType})`,
  price: (s) => `ราคา ${formatPercent(s.priceChange, 0, true)}`,
}
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

function pugSays(change) {
  if (change > 0.15) return '🐶 โฮ่ง!! ปังมาก ขอโบนัสเป็นขนมนะ'
  if (change > 0.03) return '🐶 ดีขึ้นนะ น่าลอง'
  if (change > -0.03) return '🐶 ก็… เหมือนเดิมแหละ'
  if (change > -0.1) return '🐶 อืม… ยอดหายนะ คิดดี ๆ'
  return '🐶 อย่าทำเลย ขนมผมจะหมด 😱'
}

function Lever({ label, children, hint }) {
  return (
    <div className="border-b border-line/70 py-3 last:border-0">
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function Slider({ value, min, max, step, onChange, format, label }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="flex-1 accent-[var(--accent)]" />
      <span className="w-14 text-right text-sm text-ink tabular-nums">{format(value)}</span>
    </div>
  )
}

function WhatIfPanel({ rows }) {
  const branchInfo = useStatic(loadBranches)
  const facts = useMemo(() => (branchInfo ? whatIfFacts(rows, branchInfo) : null), [rows, branchInfo])
  const [s, setS] = useState(START)
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }))
  const result = useMemo(() => (facts ? whatIf(facts, s) : null), [facts, s])
  const shown = useCountUp(result?.total ?? 0, { duration: 700 })

  if (!facts || !result) return <div className="skeleton h-72 rounded-xl" aria-busy="true" />

  const types = Object.keys(facts.perDayByType)
  const maxStep = Math.max(1, ...result.steps.map((x) => Math.abs(x.value)))
  const active = result.steps.filter((x) => Math.abs(x.value) > 0.5)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <Lever label="💸 ปรับราคาทุกเมนู">
          <Slider label="เปลี่ยนราคา" value={s.priceChange} min={-0.2} max={0.3} step={0.05} onChange={(v) => set({ priceChange: v })} format={(v) => formatPercent(v, 0, true)} />
          <p className="mt-3 mb-1.5 text-xs text-muted">ลูกค้าไวต่อราคาแค่ไหน</p>
          <SegmentedControl label="ความไวต่อราคา" options={ELASTICITY} value={s.elasticity} onChange={(v) => set({ elasticity: v })} buttonClassName="h-8 px-3 text-xs whitespace-nowrap" />
        </Lever>

        <Lever label="📅 ปิดร้านหนึ่งวันต่อสัปดาห์">
          <div className="flex flex-wrap gap-1.5">
            {[null, ...MONDAY_FIRST].map((d) => (
              <button
                key={d ?? 'none'}
                type="button"
                onClick={() => set({ closedWeekday: d })}
                className={`h-8 rounded-full border px-3 text-xs transition ${s.closedWeekday === d ? 'border-accent bg-accent text-surface' : 'border-line text-ink-2 hover:text-accent'}`}
              >
                {d == null ? 'ไม่ปิด' : THAI_WEEKDAYS[d]}
              </button>
            ))}
          </div>
          {s.closedWeekday != null && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">ลูกค้าวันนั้นย้ายไปซื้อวันอื่น</p>
              <Slider label="ลูกค้าที่ย้ายวัน" value={s.shiftShare} min={0} max={0.6} step={0.05} onChange={(v) => set({ shiftShare: v })} format={(v) => formatPercent(v, 0)} />
            </div>
          )}
        </Lever>

        <Lever label="🌙 เปิดดึกขึ้นอีก 1 ชั่วโมง" hint={`คิดว่าชั่วโมงที่เพิ่มขายได้ ${formatPercent(WHAT_IF.EXTRA_HOUR_SHARE, 0)} ของชั่วโมงสุดท้ายตอนนี้ (${facts.lastHour}:00–${facts.lastHour + 1}:00)`}>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={s.extraHour} onChange={(e) => set({ extraHour: e.target.checked })} className="size-4 accent-[var(--accent)]" />
            เปิดถึง {String(facts.lastHour + 2).padStart(2, '0')}:00
          </label>
        </Lever>

        <Lever
          label="🏪 เปิดสาขาใหม่"
          hint={
            s.newBranchType &&
            `อ้างอิง${facts.perDayByType[s.newBranchType].peers.join(' + ')}: เฉลี่ยวันละ ${formatBaht(facts.perDayByType[s.newBranchType].perDay)} · ปีแรกคิด ${formatPercent(WHAT_IF.NEW_BRANCH_RAMP, 0)}`
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {[null, ...types].map((t) => (
              <button
                key={t ?? 'none'}
                type="button"
                onClick={() => set({ newBranchType: t })}
                className={`h-8 rounded-full border px-3 text-xs transition ${s.newBranchType === t ? 'border-accent bg-accent text-surface' : 'border-line text-ink-2 hover:text-accent'}`}
              >
                {t ?? 'ไม่เปิด'}
              </button>
            ))}
          </div>
          {s.newBranchType && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted">ยอดที่แค่ย้ายมาจากสาขาเดิม (ไม่ใช่ลูกค้าใหม่)</p>
              <Slider label="แย่งลูกค้าสาขาเดิม" value={s.cannibal} min={0} max={0.5} step={0.05} onChange={(v) => set({ cannibal: v })} format={(v) => formatPercent(v, 0)} />
            </div>
          )}
        </Lever>
        <button type="button" onClick={() => setS(START)} className="toy-btn mt-2">
          ↺ เริ่มใหม่
        </button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-surface-2 p-5">
          <p className="text-sm text-muted">ยอดขาย 1 ปีถ้าทำตามนี้</p>
          <p className="mt-1 text-4xl font-light text-ink tabular-nums">{formatBaht(shown)}</p>
          <p className={`mt-1 text-sm font-medium ${result.change > 0.0005 ? 'text-emerald-600 dark:text-emerald-400' : result.change < -0.0005 ? 'text-red-500' : 'text-muted'}`}>
            {formatPercent(result.change, 1, true)} จากเดิม {formatBaht(result.base)} (365 วันล่าสุด)
          </p>
          {s.priceChange !== 0 && <p className="mt-1 text-xs text-muted">จำนวนแก้วที่ขายได้ {formatPercent(result.cupsChange, 1, true)}</p>}

          <ul className="mt-5 space-y-2">
            {active.length === 0 && <li className="text-sm text-muted">ลองขยับตัวเลือกทางซ้ายดูสิ</li>}
            {active.map((x) => (
              <li key={x.key} className="grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-2 text-sm">
                <span className="truncate text-ink-2">{STEP_LABEL[x.key](s, facts)}</span>
                <span className="relative h-3 rounded-full bg-surface">
                  <span
                    className="absolute inset-y-0 rounded-full transition-all duration-500"
                    style={{ background: x.value >= 0 ? '#16a34a' : '#dc2626', width: `${(Math.abs(x.value) / maxStep) * 50}%`, [x.value >= 0 ? 'left' : 'right']: '50%' }}
                  />
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
                </span>
                <span className={`text-right tabular-nums ${x.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {x.value >= 0 ? '+' : '−'}
                  {formatBaht(Math.abs(x.value))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink">{pugSays(result.change)}</p>
        </div>

        <details className="mt-3 text-xs text-ink-2">
          <summary className="cursor-pointer text-muted hover:text-accent">⚠️ สมมติฐานที่ใช้ (แบบจำลอง ไม่ใช่คำทำนาย)</summary>
          <ul className="mt-2 list-disc space-y-1 rounded-xl bg-surface-2 py-3 pr-3 pl-7">
            <li>ฐานคือยอด 365 วันล่าสุดในข้อมูล และคิดว่าปีหน้าลูกค้าพฤติกรรมเหมือนเดิม</li>
            <li>
              ราคา: จำนวนแก้ว × (1 + %ราคา)<sup>ε</sup> โดย ε = {s.elasticity} ({ELASTICITY.find((e) => e.value === s.elasticity)?.label}) · ถ้า ε = −1 ยอดเงินเท่าเดิมพอดี
            </li>
            <li>ราคาเปลี่ยนเท่ากันทุกเมนู ทุกสาขา และคู่แข่งไม่เปลี่ยนราคาตาม</li>
            <li>ปิดร้าน: ยอดวันนั้นหายไป ยกเว้นส่วนที่ย้ายไปซื้อวันอื่น</li>
            <li>สาขาใหม่: ขายเหมือนสาขาประเภทเดียวกันโดยเฉลี่ย ไม่คิดค่าเช่า ค่าแรง หรือต้นทุน (นี่คือยอดขาย ไม่ใช่กำไร)</li>
          </ul>
        </details>
      </div>
    </div>
  )
}

export default WhatIfPanel
