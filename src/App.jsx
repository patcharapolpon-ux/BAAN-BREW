import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import BranchFilter from './components/BranchFilter'
import BranchSalesChart from './components/BranchSalesChart'
import DailySalesChart from './components/DailySalesChart'
import DonutChart from './components/DonutChart'
import KpiCard from './components/KpiCard'
import PageTabs from './components/PageTabs'
import Panel from './components/Panel'
import SalesHeatmap from './components/SalesHeatmap'
import ThemeToggle from './components/ThemeToggle'
import Lab2Page from './lab2/Lab2Page'
import CustomersPage from './pages/CustomersPage'
import {
  comparePeriods,
  dailySales,
  filterByBranch,
  formatBaht,
  formatNumber,
  formatPercent,
  formatThaiDate,
  movingAverage,
  prepareRows,
  salesByBranch,
  salesByField,
  salesHeatmap,
  summarize,
} from './lib/metrics'
import { prefersReducedMotion, useScrolled, useScrollProgress } from './lib/motion'
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

// Sticky header: transparent at the top, frosted glass once you scroll (see .site-header).
// Its own component so the scroll state only re-renders the header, not every chart.
function Header({ subtitle, preference, onThemeChange }) {
  const scrolled = useScrolled()
  return (
    <header
      className={`site-header rise sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-4 px-4 py-3 sm:-mx-8 sm:mb-8 sm:rounded-b-2xl sm:px-8 sm:py-4 ${
        scrolled ? 'is-scrolled' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <BeanMark />
        <div className="min-w-0">
          <h1 className="shimmer font-display text-2xl leading-tight font-semibold sm:text-3xl">บ้านบรู</h1>
          <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <ThemeToggle preference={preference} onChange={onThemeChange} />
    </header>
  )
}

// Lab 2.2 page (open with #lab2): bad charts vs fixed charts, side by side.
function Lab2Screen({ rows }) {
  const [products, setProducts] = useState(null)
  useEffect(() => {
    Papa.parse('/products.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setProducts(result.data),
    })
  }, [])
  const prepared = useMemo(() => (rows ? prepareRows(rows) : null), [rows])

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <a href="#" className="mb-4 inline-block text-sm text-stone-600 underline">← กลับไปแดชบอร์ด</a>
        {prepared && products ? <Lab2Page rows={prepared} products={products} /> : <p>กำลังโหลดข้อมูล…</p>}
      </div>
    </div>
  )
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const { preference, resolved, setPreference } = useTheme()
  const colors = useChartColors(resolved)
  const [branch, setBranch] = useState(null) // null = all branches
  const hash = useHash()

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data),
      error: (err) => setError(err.message),
    })
  }, [])

  // Branch ranking always uses every row, so the bar chart can still show (and switch) all branches.
  const branches = useMemo(() => (rows ? salesByBranch(rows) : []), [rows])

  // Everything else follows the branch filter.
  const stats = useMemo(() => {
    if (!rows) return null
    const picked = filterByBranch(rows, branch)
    const daily = dailySales(picked)
    return {
      kpi: summarize(picked),
      daily: movingAverage(daily, 7),
      recent: comparePeriods(daily, 30),
      heatmap: salesHeatmap(picked),
      payments: salesByField(picked, 'payment_method'),
      channels: salesByField(picked, 'channel'),
    }
  }, [rows, branch])

  if (hash === '#lab2') return <Lab2Screen rows={rows} />
  const page = hash === '#customers' ? 'customers' : 'sales'
  const range =
    stats?.daily.length > 0
      ? `${formatThaiDate(stats.daily[0].date, SHORT_DATE)} – ${formatThaiDate(stats.daily.at(-1).date, SHORT_DATE)}`
      : ''

  return (
    <div className="min-h-screen">
      <div className="ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <ScrollProgress />

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-8 sm:pt-10 sm:pb-16">
        <Header
          preference={preference}
          onThemeChange={setPreference}
          subtitle={
            page === 'customers'
              ? `ลูกค้าสมาชิก ${range}`
              : `${branch ? `สาขา${branch} · ` : 'ภาพรวมยอดขาย '}${range}`
          }
        />

        <PageTabs value={page} />

        {error && (
          <p role="alert" className="rounded-2xl border border-line bg-surface p-5 text-ink">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </p>
        )}
        {!stats && !error && <Skeleton />}

        {stats && page === 'customers' && <CustomersPage rows={rows} colors={colors} />}

        {stats && page === 'sales' && (
          <main>
            <div className="rise mb-4 sm:mb-6" style={{ animationDelay: '80ms' }}>
              <BranchFilter branches={branches.map((b) => b.branch)} value={branch} onChange={setBranch} />
            </div>

            <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <KpiCard
                icon="sales"
                label="ยอดขายรวม"
                value={stats.kpi.totalSales}
                format={(v) => formatBaht(v)}
                hint={`เฉลี่ย ${formatBaht(stats.kpi.salesPerDay)} / วัน`}
                spark={stats.daily.slice(-30).map((d) => d.salesAvg ?? d.sales)}
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

            <Panel title="ยอดขายแยกสาขา" subtitle="เรียงจากมากไปน้อย พร้อมสัดส่วนจากยอดขายรวม · คลิกแท่งเพื่อกรองทั้งหน้าตามสาขา">
              {(inView) => (
                <BranchSalesChart data={branches} colors={colors} show={inView} selected={branch} onSelect={setBranch} />
              )}
            </Panel>

            <Panel
              title="ช่วงเวลาขายดี"
              subtitle={`ยอดขายรวมตามวันในสัปดาห์และชั่วโมง${branch ? ` · สาขา${branch}` : ''} · ยิ่งเข้มยิ่งขายดี`}
            >
              {(inView) => <SalesHeatmap data={stats.heatmap} show={inView} />}
            </Panel>

            <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
              <Panel title="ช่องทางชำระเงิน" subtitle="สัดส่วนจากยอดขาย · ชี้ที่ชิ้นหรือรายการ" className="">
                {(inView) => <DonutChart data={stats.payments} colors={colors} show={inView} />}
              </Panel>
              <Panel title="ช่องทางการขาย" subtitle="หน้าร้านเทียบเดลิเวอรี" delay={100} className="">
                {(inView) => <DonutChart data={stats.channels} colors={colors} show={inView} />}
              </Panel>
            </div>

            <footer className="mt-8 text-center text-xs text-muted sm:mt-10">
              ข้อมูล {formatNumber(rows.length)} รายการ · {branches.length} สาขา · {formatNumber(stats.kpi.dayCount)} วัน ·{' '}
              <a href="#lab2" className="underline">Lab 2.2 ซ่อมกราฟแย่</a>
            </footer>
          </main>
        )}
      </div>

      <BackToTop />
    </div>
  )
}

export default App
