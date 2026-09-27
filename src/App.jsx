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
import { prefersReducedMotion, useInView, useScrollProgress } from './lib/motion'
import { useChartColors, useTheme } from './lib/theme'

const SHORT_DATE = { day: 'numeric', month: 'short', year: '2-digit' }

// Easter egg: click the logo and coffee beans fly out in a ring.
// Each bean is a throwaway <span> with its own random direction in CSS variables;
// the CSS `burst` animation moves it, then we remove it.
function burstBeans(event) {
  if (prefersReducedMotion()) return
  const r = event.currentTarget.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4
    const distance = 50 + Math.random() * 60
    const bean = document.createElement('span')
    bean.className = 'bean-burst'
    bean.style.left = `${cx}px`
    bean.style.top = `${cy}px`
    bean.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
    bean.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
    bean.style.setProperty('--rot', `${Math.random() * 540 - 270}deg`)
    document.body.append(bean)
    bean.addEventListener('animationend', () => bean.remove())
  }
}

function BeanMark() {
  return (
    <button
      type="button"
      onClick={burstBeans}
      aria-label="บ้านบรู (กดเล่นได้)"
      className="group shrink-0 rounded-xl transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-110 hover:-rotate-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-90"
    >
      <svg viewBox="0 0 32 40" className="h-11 w-9" aria-hidden="true">
        {/* steam */}
        <g className="steam stroke-accent" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M11 7c-1.5-1.5 1.5-3 0-5" />
          <path d="M16 7c-1.5-1.5 1.5-3 0-5" />
          <path d="M21 7c-1.5-1.5 1.5-3 0-5" />
        </g>
        <rect y="8" width="32" height="32" rx="10" className="fill-accent" />
        <g className="origin-center transition-transform duration-500 group-hover:rotate-[20deg]" style={{ transformBox: 'fill-box' }}>
          <ellipse cx="16" cy="24" rx="6.5" ry="9" transform="rotate(35 16 24)" className="fill-surface" />
          <path d="M12.6 30.4c2.6-1.6 3.4-4.2 2.6-6.6s-.4-5 2.2-6.6" className="stroke-accent" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </button>
  )
}

// Section card that animates in when it scrolls into view. `children` may be a function
// that receives `inView`, so a chart can wait and play its own animation on arrival.
function Panel({ title, subtitle, delay = 0, children }) {
  const [ref, inView] = useInView()
  return (
    <section
      ref={ref}
      className={`reveal mt-4 rounded-2xl border border-line bg-surface/85 p-4 shadow-card backdrop-blur-sm transition-shadow duration-300 hover:shadow-lg sm:mt-6 sm:p-7 ${inView ? 'is-visible' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 sm:mb-5">
        <h2 className="flex items-center gap-2 font-medium text-ink">
          <span className="inline-block h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>}
      </div>
      {typeof children === 'function' ? children(inView) : children}
    </section>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-2xl sm:h-40" />
        ))}
      </div>
      <div className="skeleton mt-4 h-80 rounded-2xl sm:mt-6 sm:h-[26rem]" />
    </div>
  )
}

function ScrollProgress() {
  const progress = useScrollProgress()
  return (
    <div
      aria-hidden="true"
      className="progress fixed inset-x-0 top-0 z-40 h-[3px] bg-gradient-to-r from-accent-soft to-accent"
      style={{ transform: `scaleX(${progress})` }}
    />
  )
}

// Floating "back to top" button: slides up once you've scrolled a bit, hides at the top.
function BackToTop() {
  const progress = useScrollProgress()
  const visible = progress > 0.15
  return (
    <button
      type="button"
      aria-label="กลับขึ้นด้านบน"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
      className={`fixed right-4 bottom-4 z-40 grid size-12 place-items-center rounded-full border border-line bg-surface text-accent shadow-card transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-90 sm:right-8 sm:bottom-8 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
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
      <div className="ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <ScrollProgress />

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-8 sm:pt-10 sm:pb-16">
        <header className="rise mb-6 flex items-start justify-between gap-4 sm:mb-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <BeanMark />
            <div>
              <h1 className="shimmer font-display text-2xl leading-tight font-semibold sm:text-3xl">บ้านบรู</h1>
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
                icon="sales"
                label="ยอดขายรวม"
                value={stats.kpi.totalSales}
                format={(v) => formatBaht(v)}
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
                icon="bills"
                label="จำนวนบิล"
                value={stats.kpi.orderCount}
                format={(v) => formatNumber(v)}
                hint={`เฉลี่ย ${formatNumber(stats.kpi.ordersPerDay)} บิล / วัน`}
                delay={60}
              />
              <KpiCard
                icon="cup"
                label="ยอดเฉลี่ยต่อบิล"
                value={stats.kpi.averageOrderValue}
                format={(v) => formatBaht(v, 2)}
                hint="ยอดขายรวม ÷ จำนวนบิล"
                delay={120}
              />
              <KpiCard
                icon="members"
                label="ลูกค้าสมาชิก (ไม่ซ้ำ)"
                value={stats.kpi.uniqueMembers}
                format={(v) => formatNumber(v)}
                hint={`${formatPercent(stats.kpi.memberOrderShare, 0)} ของบิลมาจากสมาชิก`}
                delay={180}
              />
            </section>

            <Panel title="ยอดขายรายวัน" subtitle="เส้นหลักคือค่าเฉลี่ยเคลื่อนที่ 7 วัน ช่วยให้เห็นแนวโน้มชัดขึ้น" delay={120}>
              <DailySalesChart data={stats.daily} colors={colors} />
            </Panel>

            <Panel title="ยอดขายแยกสาขา" subtitle="เรียงจากมากไปน้อย พร้อมสัดส่วนจากยอดขายรวม · ชี้ที่แท่งเพื่อดูรายละเอียด">
              {(inView) => <BranchSalesChart data={stats.branches} colors={colors} show={inView} />}
            </Panel>

            <footer className="mt-8 text-center text-xs text-muted sm:mt-10">
              ข้อมูล {formatNumber(rows.length)} รายการ · {stats.branches.length} สาขา · {formatNumber(stats.kpi.dayCount)} วัน
            </footer>
          </main>
        )}
      </div>

      <BackToTop />
    </div>
  )
}

export default App
