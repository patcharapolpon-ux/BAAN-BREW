// Lab 3.2 · Real-time sales dashboard from Firestore (Prompt 3.2B) with the sale form beside it (3.2C).
// Lab 3.3 · Only signed-in users see it (Prompt 3.3A); signed-out visitors get a Google sign-in card.
// Uses the dashboard's own metrics.js and components, so it follows the theme like the other tabs.
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, db, googleProvider } from './firebase.js'
import { addDays, todayBangkok } from './time.js'
import { BRANCHES } from './saleModel.js'
import SaleForm from './SaleForm.jsx'
import BranchFilter from '../components/BranchFilter'
import BranchSalesChart from '../components/BranchSalesChart'
import ChartTooltip from '../components/ChartTooltip'
import KpiCard from '../components/KpiCard'
import Panel from '../components/Panel'
import SegmentedControl from '../components/SegmentedControl'
import {
  dailySalesBetween,
  filterByBranch,
  formatBaht,
  formatBahtCompact,
  formatNumber,
  formatThaiDate,
  hourlySales,
  salesByBranch,
  summarize,
} from '../lib/metrics'
import { fireConfetti } from '../lib/confetti'
import { prefersReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'
import { showToast } from '../lib/toast'
import { useIsMobile } from '../lib/useIsMobile'

const RANGES = [
  { value: 1, label: 'วันนี้' },
  { value: 7, label: '7 วัน' },
  { value: 30, label: '30 วัน' },
]
const HIGHLIGHT_MS = 4000 // how long a sale that just arrived stays highlighted in the table

const ERROR_TEXT = {
  'permission-denied': 'Security Rules ไม่อนุญาตให้อ่านยอดขาย (ล็อกอินแล้วหรือยัง?)',
  'resource-exhausted': 'โควตาอ่านฟรีของวันนี้หมดแล้ว ลองเลือกช่วงที่สั้นลง หรือรอโควตารีเซ็ต',
  'failed-precondition': 'Firestore ต้องสร้าง index ก่อน เปิด console ของเบราว์เซอร์เพื่อดูลิงก์สร้าง index',
  unavailable: 'เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่',
}
const errorText = (e) => ERROR_TEXT[e.code] ?? `โหลดข้อมูลไม่สำเร็จ: ${e.message}`

const AUTH_ERRORS = {
  'auth/unauthorized-domain': 'เว็บนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน เพิ่มโดเมนใน Firebase console → Authentication → Settings → Authorized domains',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดล็อกอินด้วย Google ใน Firebase console → Authentication → Sign-in method',
  'auth/popup-blocked': 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่',
  'auth/popup-closed-by-user': 'หน้าต่างล็อกอินถูกปิดก่อนเสร็จ กดเข้าสู่ระบบอีกครั้งได้เลย',
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function SignInCard({ onSignIn, error }) {
  return (
    <div className="rise mx-auto max-w-md rounded-2xl border border-line bg-surface/85 p-6 text-center shadow-card backdrop-blur-sm sm:p-8">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-2xl" aria-hidden="true">
        🔒
      </div>
      <h2 className="mt-4 text-lg font-medium text-ink">เข้าสู่ระบบเพื่อดูยอดขายสด</h2>
      <p className="mt-1 text-sm text-muted">ยอดขายสดและการบันทึกยอดขายใช้ได้เฉพาะพนักงานที่ล็อกอินแล้ว</p>
      <button
        type="button"
        onClick={onSignIn}
        data-sound="select"
        className="mt-6 inline-flex h-11 items-center gap-3 rounded-xl border border-line bg-white px-5 font-medium text-stone-800 shadow-card transition hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <GoogleIcon />
        เข้าสู่ระบบด้วย Google
      </button>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-500">
          ❌ {error}
        </p>
      )}
    </div>
  )
}

function UserChip({ user, onSignOut }) {
  const name = user.displayName || user.email
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-1 pl-1 shadow-card">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-7 rounded-full" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-accent text-sm font-medium text-surface" aria-hidden="true">
          {name?.[0]?.toUpperCase()}
        </span>
      )}
      <span className="max-w-40 truncate text-sm text-ink">{name}</span>
      <button type="button" onClick={onSignOut} className="h-7 rounded-full px-3 text-xs text-muted transition hover:bg-surface-2 hover:text-ink">
        ออกจากระบบ
      </button>
    </div>
  )
}

// Shown for a moment right after signing in (not when the page opens already signed in).
const WELCOME_MS = 2400

function WelcomeSplash({ user }) {
  const name = user.displayName || user.email
  return (
    <div className="welcome-splash" role="status" aria-live="polite">
      <div className="flex flex-col items-center px-6 text-center">
        <div className="relative">
          <span className="welcome-ring" aria-hidden="true" />
          <span className="welcome-ring" aria-hidden="true" />
          <span className="welcome-ring" aria-hidden="true" />
          {user.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="welcome-avatar relative size-24 rounded-full shadow-card ring-4 ring-surface" />
          ) : (
            <span className="welcome-avatar relative grid size-24 place-items-center rounded-full bg-accent text-4xl font-medium text-surface shadow-card ring-4 ring-surface">
              {name?.[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <p className="welcome-text mt-6 text-2xl font-light text-ink sm:text-3xl">ยินดีต้อนรับ ☕</p>
        <p className="welcome-sub mt-1 text-lg text-accent">{name}</p>
      </div>
    </div>
  )
}

// Gate: the dashboard (and its onSnapshot) only mounts once someone is signed in.
function LiveTab({ colors }) {
  const [user, setUser] = useState(undefined) // undefined = still checking, null = signed out
  const [authError, setAuthError] = useState(null)
  const [welcome, setWelcome] = useState(false)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const signIn = () => {
    setAuthError(null)
    signInWithPopup(auth, googleProvider)
      .then(({ user: signedIn }) => {
        const first = (signedIn.displayName || signedIn.email).split(' ')[0]
        playSound('fanfare')
        showToast({ icon: '👋', title: `สวัสดี ${first}!`, text: 'เข้าสู่ระบบแล้ว ยอดขายสดพร้อมดู' })
        if (prefersReducedMotion()) return
        fireConfetti()
        setWelcome(true)
        setTimeout(() => setWelcome(false), WELCOME_MS)
      })
      .catch((e) => setAuthError(AUTH_ERRORS[e.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`))
  }

  if (user === undefined) return <p className="text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
  if (!user) return <SignInCard onSignIn={signIn} error={authError} />
  return (
    <>
      {welcome && <WelcomeSplash user={user} />}
      <div className="rise mb-4 flex justify-end sm:mb-6">
        <UserChip user={user} onSignOut={() => signOut(auth)} />
      </div>
      <LiveDashboard colors={colors} user={user} />
    </>
  )
}

function LiveDashboard({ colors, user }) {
  const isMobile = useIsMobile()
  const [days, setDays] = useState(7)
  const [branch, setBranch] = useState(null) // null = all branches (filtered in the browser, no extra query)
  // Results are tagged with the range they belong to, so switching range shows "loading" until new data arrives.
  const [loaded, setLoaded] = useState(null) // { range, docs }: every sale in the range, straight from Firestore
  const [failed, setFailed] = useState(null) // { range, text }
  const [productError, setProductError] = useState(null)
  const [reads, setReads] = useState(0) // documents read so far, summed over every snapshot
  const [fresh, setFresh] = useState(() => new Set()) // ids that just arrived, highlighted for a moment
  const [products, setProducts] = useState([])

  const today = todayBangkok()
  const start = addDays(today, -(days - 1))
  const range = `${start}..${today}`
  const sales = loaded?.range === range ? loaded.docs : null
  const error = (failed?.range === range ? failed.text : null) ?? productError

  // The menu barely changes, so it's read once (not listened to).
  useEffect(() => {
    getDocs(collection(db, 'products'))
      .then((snap) => setProducts(snap.docs.map((d) => d.data())))
      .catch((e) => setProductError(errorText(e)))
  }, [])

  useEffect(() => {
    let first = true
    const timers = []
    const q = query(collection(db, 'sales'), where('date', '>=', start), where('date', '<=', today), orderBy('date'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges()
        setReads((n) => n + changes.length)
        setLoaded({ range, docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })
        // The first snapshot is the whole range; only later "added" changes are new sales.
        if (first) {
          first = false
          return
        }
        const added = changes.filter((c) => c.type === 'added').map((c) => c.doc.id)
        if (added.length === 0) return
        setFresh((prev) => new Set([...prev, ...added]))
        timers.push(
          setTimeout(() => {
            setFresh((prev) => {
              const next = new Set(prev)
              for (const id of added) next.delete(id)
              return next
            })
          }, HIGHLIGHT_MS),
        )
      },
      (e) => setFailed({ range, text: errorText(e) }),
    )
    // Without this, every range change (and StrictMode's double effect) would leave a listener running.
    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [start, today, range])

  const picked = useMemo(() => (sales ? filterByBranch(sales, branch) : []), [sales, branch])
  const kpi = useMemo(() => summarize(picked), [picked])
  const branches = useMemo(() => (sales ? salesByBranch(sales) : []), [sales])
  const chart = useMemo(
    () => (days === 1 ? hourlySales(picked) : dailySalesBetween(picked, start, today)),
    [picked, days, start, today],
  )
  const recent = useMemo(() => [...picked].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, 8), [picked])
  const productName = useMemo(() => Object.fromEntries(products.map((p) => [p.product_id, p.product_name])), [products])

  const axis = { fontSize: isMobile ? 11 : 12, fill: colors.muted }
  const series = { sales: { name: 'ยอดขาย', color: colors.accent } }
  const rangeText =
    days === 1
      ? formatThaiDate(today, { weekday: 'long', day: 'numeric', month: 'short' })
      : `${formatThaiDate(start, { day: 'numeric', month: 'short' })} – ${formatThaiDate(today, { day: 'numeric', month: 'short' })}`

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0">
        <div className="rise mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
          <SegmentedControl
            label="ช่วงเวลา"
            options={RANGES}
            value={days}
            onChange={setDays}
            buttonClassName="h-9 px-4 text-sm whitespace-nowrap"
          />
          <p className="flex items-center gap-2 text-xs text-muted sm:text-sm">
            <span className="relative flex size-2.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            สด · อ่านเอกสารไปแล้ว <span className="font-medium text-ink tabular-nums">{formatNumber(reads)}</span>
          </p>
        </div>

        <div className="rise mb-4 sm:mb-6" style={{ animationDelay: '40ms' }}>
          <BranchFilter branches={BRANCHES} value={branch} onChange={setBranch} />
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-ink">
            ❌ {error}
          </p>
        )}

        {!sales && !error && <p className="text-muted">กำลังเชื่อมต่อ Firestore…</p>}

        {sales && (
          <>
            <section className="grid grid-cols-2 gap-3 sm:gap-4">
              <KpiCard icon="sales" label="ยอดขายรวม" value={kpi.totalSales} format={(v) => formatBaht(v)} hint={rangeText} />
              <KpiCard icon="bills" label="จำนวนบิล" value={kpi.orderCount} format={(v) => formatNumber(v)} delay={60} />
              <KpiCard icon="wallet" label="เฉลี่ยต่อบิล" value={kpi.averageOrderValue} format={(v) => formatBaht(v)} delay={120} />
              <KpiCard icon="members" label="สมาชิกที่ซื้อ" value={kpi.uniqueMembers} format={(v) => formatNumber(v)} delay={180} />
            </section>

            <Panel
              title={days === 1 ? 'ยอดขายรายชั่วโมง · วันนี้' : `ยอดขายรายวัน · ${days} วัน`}
              subtitle={days === 1 ? 'อัปเดตทันทีที่มีบิลใหม่' : 'จุดสุดท้ายคือวันนี้ ซึ่งยังขายไม่จบวัน'}
            >
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
                {days === 1 ? (
                  <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={axis} tickLine={false} axisLine={{ stroke: colors.line }} minTickGap={12} />
                    <YAxis tickFormatter={formatBahtCompact} tick={axis} tickLine={false} axisLine={false} width={isMobile ? 44 : 56} />
                    <Tooltip cursor={{ fill: colors.grid }} content={<ChartTooltip series={series} formatLabel={(h) => `${h}:00–${h}:59 น.`} />} />
                    <Bar dataKey="sales" fill={colors.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => formatThaiDate(d, { day: 'numeric', month: 'short' })}
                      tick={axis}
                      tickLine={false}
                      axisLine={{ stroke: colors.line }}
                      minTickGap={20}
                    />
                    <YAxis tickFormatter={formatBahtCompact} tick={axis} tickLine={false} axisLine={false} width={isMobile ? 44 : 56} />
                    <Tooltip
                      cursor={{ stroke: colors.accent, strokeOpacity: 0.5, strokeDasharray: '3 4' }}
                      content={<ChartTooltip series={series} formatLabel={(d) => formatThaiDate(d, { weekday: 'short', day: 'numeric', month: 'short' })} />}
                    />
                    <Line type="linear" dataKey="sales" stroke={colors.accent} strokeWidth={2.5} dot={{ r: days === 7 ? 3 : 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Panel>

            <Panel title="ยอดขายแยกสาขา" subtitle="ทุกสาขาในช่วงที่เลือก · คลิกแท่งเพื่อกรองสาขา">
              {(inView) => <BranchSalesChart data={branches} colors={colors} show={inView} selected={branch} onSelect={setBranch} />}
            </Panel>

            <Panel title="รายการล่าสุด" subtitle="8 รายการล่าสุด · แถวที่เพิ่งเข้ามาจะไฮไลต์ 4 วินาที">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">ยังไม่มียอดขายในช่วงนี้</p>
              ) : (
                <div className="-mx-4 overflow-x-auto sm:mx-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-4 py-2 font-normal sm:px-2">เวลา</th>
                        <th className="px-2 py-2 font-normal">สาขา</th>
                        <th className="px-2 py-2 font-normal">เมนู</th>
                        <th className="px-2 py-2 text-right font-normal">ยอด</th>
                        <th className="hidden px-2 py-2 font-normal sm:table-cell">ที่มา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((s) => (
                        <tr
                          key={s.id}
                          className={`border-b border-line/60 transition-colors duration-700 ${fresh.has(s.id) ? 'bg-accent/20' : ''}`}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-ink-2 tabular-nums sm:px-2">
                            {formatThaiDate(s.date, { day: 'numeric', month: 'short' })} {s.datetime.slice(11, 16)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{s.branch}</td>
                          <td className="px-2 py-2">
                            {productName[s.product_id] ?? s.product_id} <span className="text-muted">×{s.qty}</span>
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">{formatBaht(s.revenue)}</td>
                          <td className="hidden px-2 py-2 text-xs text-muted sm:table-cell">{s.source === 'web' ? '🌐 ฟอร์ม' : 'นำเข้า'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <SaleForm products={products} uid={user.uid} />
      </aside>
    </div>
  )
}

export default LiveTab
