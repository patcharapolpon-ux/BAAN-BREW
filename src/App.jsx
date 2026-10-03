import Papa from 'papaparse'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import BaristaGame from './components/BaristaGame'
import BeanTrail from './components/BeanTrail'
import BranchFilter from './components/BranchFilter'
import BranchSalesChart from './components/BranchSalesChart'
import DailySalesChart from './components/DailySalesChart'
import DonutChart from './components/DonutChart'
import KpiCard from './components/KpiCard'
import PageTabs from './components/PageTabs'
import Panel from './components/Panel'
import SiteCredit from './components/SiteCredit'
import SalesHeatmap from './components/SalesHeatmap'
import ScrollCup from './components/ScrollCup'
import ShopCat from './components/ShopCat'
import ShopSign from './components/ShopSign'
import ShareButton from './components/ShareButton'
import SoundToggle from './components/SoundToggle'
import ThemeToggle from './components/ThemeToggle'
import ToyBoundary from './components/ToyBoundary'
import { TimeMachineButton } from './components/TimeMachine'
import Toaster from './components/Toaster'
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
import { fireConfetti } from './lib/confetti'
import { useDaypart } from './lib/daypart'
import { toggleQuake } from './lib/earthquake'
import { prefersReducedMotion, useScrolled, useScrollProgress } from './lib/motion'
import { countLogoTap, useNeonMode } from './lib/secret'
import { showToast } from './lib/toast'
import { installClickSounds, playSound, startBeat, stopBeat, useSound } from './lib/sound'
import { useChartColors, useTheme } from './lib/theme'

const SHORT_DATE = { day: 'numeric', month: 'short', year: '2-digit' }

// Night-sky stars for the time-of-day layer: [left %, top %, twinkle delay s]. Fixed, not random,
// so they don't jump around on re-render.
const STARS = [
  [8, 6, 0], [18, 14, 1.2], [27, 4, 2.1], [36, 11, 0.6], [47, 7, 1.8], [58, 13, 0.3],
  [66, 5, 2.6], [74, 12, 1], [83, 8, 1.6], [91, 15, 0.8], [13, 22, 2.3], [79, 20, 0.4],
]

// Easter egg: click the logo and coffee beans fly out in a ring.
// Each bean is a throwaway <span> with its own random direction in CSS variables;
// the CSS `burst` animation moves it, then we remove it.
function burstBeans(event) {
  countLogoTap()
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
      data-sound="beans"
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

// Floating "back to top" button: slides up once you've scrolled a bit, hides at the top.
function BackToTop() {
  const progress = useScrollProgress()
  const visible = progress > 0.15
  return (
    <button
      type="button"
      aria-label="กลับขึ้นด้านบน"
      data-sound="whoosh"
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
function Header({ subtitle, preference, onThemeChange, sign }) {
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
          <div className="flex items-center">
            <h1 className="shimmer font-display text-2xl leading-tight font-semibold whitespace-nowrap sm:text-3xl">บ้านบรู</h1>
            {sign}
          </div>
          <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SoundToggle />
        <ThemeToggle preference={preference} onChange={onThemeChange} />
      </div>
    </header>
  )
}

// Lab 3 tabs load the Firebase SDK only when opened, so the sales page stays light.
// Without a filled-in .env they show the course's setup guide instead.
const firebaseTab = (load) =>
  lazy(() => import('./lab3/firebase').then((m) => (m.isConfigured ? load() : import('./lab3/SetupGuide'))))
const LiveTab = firebaseTab(() => import('./lab3/LiveTab'))
const RulesTester = firebaseTab(() => import('./lab3/RulesTester'))

// The course pages (Lab 2.2, Lab 3) are styled for a light page (white cards, stone text),
// so they keep their own light panel even when the dashboard is in dark or neon mode.
function CoursePanel({ children }) {
  return (
    <main className="rise rounded-2xl bg-stone-100 p-4 text-stone-900 [color-scheme:light] sm:p-6">
      <Suspense fallback={<p>กำลังโหลด…</p>}>{children}</Suspense>
    </main>
  )
}

// Lab 2.2 tab (#lab2): bad charts vs fixed charts, side by side.
function Lab2Tab({ rows }) {
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
    <CoursePanel>
      {prepared && products ? <Lab2Page rows={prepared} products={products} /> : <p>กำลังโหลดข้อมูล…</p>}
    </CoursePanel>
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
  const neon = useNeonMode()
  // The key just tells the hooks to re-read the CSS colors; neon mode changes them too.
  const colorKey = neon ? 'neon' : resolved
  const colors = useChartColors(colorKey)
  const [soundOn] = useSound()
  const { hour } = useDaypart()
  const [gameSlot, setGameSlot] = useState(null) // heatmap cell the mini game is playing
  const closeGame = useCallback(() => setGameSlot(null), [])
  const [branch, setBranch] = useState(null) // null = all branches
  const hash = useHash()

  useEffect(installClickSounds, [])

  // Secret mode plays its lo-fi loop while it's on (and sound is on).
  useEffect(() => {
    if (!neon || !soundOn) return
    startBeat()
    return stopBeat
  }, [neon, soundOn])

  useEffect(() => {
    Papa.parse('/sales.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data),
      error: (err) => setError(err.message),
    })
  }, [])

  // Opening hours for the shop sign: first and last hour with any sale, over all branches.
  const shopHours = useMemo(() => (rows ? salesHeatmap(rows).hours : []), [rows])

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

  // Picking the #1 branch (by chip or by bar) gets confetti, a fanfare and a trophy toast.
  const topBranch = branches[0]
  useEffect(() => {
    if (!branch || branch !== topBranch?.branch) return
    fireConfetti()
    playSound('fanfare')
    showToast({ icon: '🏆', title: `สาขา${branch} ขายดีอันดับ 1!`, text: `ครองยอดขาย ${formatPercent(topBranch.share, 0)} ของทุกสาขา` })
  }, [branch, topBranch])

  const PAGE_BY_HASH = { '#customers': 'customers', '#lab2': 'lab2', '#live': 'live', '#rules': 'rules' }
  const page = PAGE_BY_HASH[hash] ?? 'sales'
  const usesCsv = page !== 'live' && page !== 'rules'
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
      <div className="daypart-sky" aria-hidden="true">
        {STARS.map(([x, y, d], i) => (
          <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-8 sm:pt-10 sm:pb-16">
        <Header
          preference={preference}
          onThemeChange={setPreference}
          sign={<ShopSign hour={hour} hours={shopHours} />}
          subtitle={
            page === 'customers'
              ? `ลูกค้าสมาชิก ${range}`
              : page === 'lab2'
              ? `ซ่อมกราฟแย่ · ข้อมูล ${range}`
              : page === 'live'
              ? 'ยอดขายสดจาก Firestore'
              : page === 'rules'
              ? 'ทดสอบ Security Rules'
              : `${branch ? `สาขา${branch} · ` : 'ภาพรวมยอดขาย '}${range}`
          }
        />

        <PageTabs value={page} />

        {error && usesCsv && (
          <p role="alert" className="rounded-2xl border border-line bg-surface p-5 text-ink">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </p>
        )}
        {!stats && !error && usesCsv && <Skeleton />}

        {stats && page === 'customers' && <CustomersPage rows={rows} colors={colors} />}

        {stats && page === 'lab2' && <Lab2Tab rows={rows} />}

        {page === 'live' && (
          <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
            <LiveTab colors={colors} />
          </Suspense>
        )}

        {page === 'rules' && <CoursePanel><RulesTester /></CoursePanel>}

        {stats && page === 'sales' && (
          <main>
            <div className="rise mb-4 sm:mb-6" style={{ animationDelay: '80ms' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <BranchFilter branches={branches.map((b) => b.branch)} value={branch} onChange={setBranch} />
                <div className="flex gap-2">
                  <TimeMachineButton rows={rows} colors={colors} />
                  <ShareButton branch={branch} range={range} kpi={stats.kpi} topBranch={topBranch} recentChange={stats.recent.change} />
                </div>
              </div>
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
              subtitle={`ยอดขายรวมตามวันในสัปดาห์และชั่วโมง${branch ? ` · สาขา${branch}` : ''} · ยิ่งเข้มยิ่งขายดี · คลิกช่องเพื่อเล่นเกมช่วงนั้น`}
            >
              {(inView) => <SalesHeatmap data={stats.heatmap} show={inView} onPlay={setGameSlot} />}
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
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                <span className="self-center text-muted">ของเล่น:</span>
                <button type="button" data-sound="none" onClick={toggleQuake} className="toy-btn">
                  🌍 แผ่นดินไหว
                </button>
                <button type="button" data-sound="select" onClick={() => setGameSlot({ ...stats.heatmap.peak, level: 1 })} className="toy-btn">
                  🎮 มินิเกมบาริสต้า
                </button>
              </div>
            </footer>
          </main>
        )}

        <SiteCredit />
      </div>

      <BackToTop />
      <ScrollCup />
      <ShopCat />
      {gameSlot && rows && (
        <ToyBoundary onError={closeGame}>
          <BaristaGame rows={rows} slot={gameSlot} onClose={closeGame} />
        </ToyBoundary>
      )}
      <Toaster />
      <BeanTrail theme={colorKey} />
    </div>
  )
}

export default App
