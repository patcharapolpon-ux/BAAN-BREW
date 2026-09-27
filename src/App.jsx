import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import BranchSalesChart from './components/BranchSalesChart'
import DailySalesChart from './components/DailySalesChart'
import KpiCard from './components/KpiCard'
import ThemeToggle from './components/ThemeToggle'
import {
  comparePeriods,
  dailySales,
  formatBaht,
  formatNumber,
  formatPercent,
  formatThaiDate,
  movingAverage,
  salesByBranch,
  summarize,
} from './lib/metrics'
import { useChartColors, useTheme } from './lib/theme'

const SHORT_DATE = { day: 'numeric', month: 'short', year: '2-digit' }

function BeanMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="10" className="fill-accent" />
      <ellipse cx="16" cy="16" rx="6.5" ry="9" transform="rotate(35 16 16)" className="fill-surface" />
      <path d="M12.6 22.4c2.6-1.6 3.4-4.2 2.6-6.6s-.4-5 2.2-6.6" className="stroke-accent" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Panel({ title, subtitle, delay = 0, children }) {
  return (
    <section
      className="rise mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:mt-6 sm:p-7"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 sm:mb-5">
        <h2 className="font-medium text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2 sm:h-40" />
        ))}
      </div>
      <div className="mt-4 h-80 animate-pulse rounded-2xl bg-surface-2 sm:mt-6 sm:h-[26rem]" />
    </div>
  )
}

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const { preference, resolved, setPreference } = useTheme()
  const colors = useChartColors(resolved)

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data),
      error: (err) => setError(err.message),
    })
  }, [])

  const stats = useMemo(() => {
    if (!rows) return null
    const daily = dailySales(rows)
    return {
      kpi: summarize(rows),
      daily: movingAverage(daily, 7),
      recent: comparePeriods(daily, 30),
      branches: salesByBranch(rows),
    }
  }, [rows])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-8 sm:pt-10 sm:pb-16">
        <header className="mb-6 flex items-start justify-between gap-4 sm:mb-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <BeanMark />
            <div>
              <h1 className="font-display text-2xl leading-tight font-semibold text-ink sm:text-3xl">บ้านบรู</h1>
              <p className="text-xs text-muted sm:text-sm">
                {stats?.daily.length > 0
                  ? `ภาพรวมยอดขาย ${formatThaiDate(stats.daily[0].date, SHORT_DATE)} – ${formatThaiDate(stats.daily.at(-1).date, SHORT_DATE)}`
                  : 'ภาพรวมยอดขาย'}
              </p>
            </div>
          </div>
          <ThemeToggle preference={preference} onChange={setPreference} />
        </header>

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-surface p-5 text-ink">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </p>
        )}
        {!stats && !error && <Skeleton />}

        {stats && (
          <main>
            <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <KpiCard
                label="ยอดขายรวม"
                value={formatBaht(stats.kpi.totalSales)}
                hint={`เฉลี่ย ${formatBaht(stats.kpi.salesPerDay)} / วัน`}
                trend={
                  stats.recent.change != null && {
                    value: stats.recent.change,
                    text: formatPercent(stats.recent.change, 1, true),
                    label: (
                      <>
                        30 วัน<span className="hidden sm:inline">ล่าสุด</span>
                      </>
                    ),
                  }
                }
              />
              <KpiCard
                label="จำนวนบิล"
                value={formatNumber(stats.kpi.orderCount)}
                hint={`เฉลี่ย ${formatNumber(stats.kpi.ordersPerDay)} บิล / วัน`}
                delay={60}
              />
              <KpiCard
                label="ยอดเฉลี่ยต่อบิล"
                value={formatBaht(stats.kpi.averageOrderValue, 2)}
                hint="ยอดขายรวม ÷ จำนวนบิล"
                delay={120}
              />
              <KpiCard
                label="ลูกค้าสมาชิก (ไม่ซ้ำ)"
                value={formatNumber(stats.kpi.uniqueMembers)}
                hint={`${formatPercent(stats.kpi.memberOrderShare, 0)} ของบิลมาจากสมาชิก`}
                delay={180}
              />
            </section>

            <Panel title="ยอดขายรายวัน" subtitle="เส้นหลักคือค่าเฉลี่ยเคลื่อนที่ 7 วัน ช่วยให้เห็นแนวโน้มชัดขึ้น" delay={240}>
              <DailySalesChart data={stats.daily} colors={colors} />
            </Panel>

            <Panel title="ยอดขายแยกสาขา" subtitle="เรียงจากมากไปน้อย พร้อมสัดส่วนจากยอดขายรวม" delay={300}>
              <BranchSalesChart data={stats.branches} colors={colors} />
            </Panel>

            <footer className="mt-8 text-center text-xs text-muted sm:mt-10">
              ข้อมูล {formatNumber(rows.length)} รายการ · {stats.branches.length} สาขา · {formatNumber(stats.kpi.dayCount)} วัน
            </footer>
          </main>
        )}
      </div>
    </div>
  )
}

export default App
