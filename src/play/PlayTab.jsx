// ร้านจำลอง (#play): a toy shop that runs on Firestore in real time.
// - A bot (or the big button) writes fake orders into the `playground` collection, never `sales`.
// - Every open screen hears the till, sees the cup fly, the branch race reorder and the pug eat.
// - Everyone's cursor shows up on everyone else's screen (Cursors.jsx).
import Papa from 'papaparse'
import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, limit, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, db, googleProvider } from '../lab3/firebase.js'
import { AUTH_ERRORS, SignInCard, UserChip } from '../lab3/LiveTab.jsx'
import { todayBangkok } from '../lab3/time.js'
import KpiCard from '../components/KpiCard'
import Panel from '../components/Panel'
import { fireConfetti } from '../lib/confetti'
import { formatBaht, formatNumber } from '../lib/metrics'
import { prefersReducedMotion } from '../lib/motion'
import { playSound } from '../lib/sound'
import { showToast } from '../lib/toast'
import { CursorLayer, usePresence } from './Cursors.jsx'
import LiveRace from './LiveRace.jsx'
import PugPet from './PugPet.jsx'
import { BOT_CAP, BOT_EVERY_MS, makePlayOrder, ORDER_LIMIT, raceStandings } from './playModel.js'

const ERROR_TEXT = {
  'permission-denied': 'Rules ยังไม่อนุญาตร้านจำลอง (ต้อง deploy firestore.rules เวอร์ชันใหม่ก่อน)',
  'resource-exhausted': 'โควตาฟรีของวันนี้หมดแล้ว พักก่อน พรุ่งนี้บ่ายสองโมงโควตารีเซ็ต',
}
const errorText = (e) => ERROR_TEXT[e.code] ?? `ร้านจำลองมีปัญหา: ${e.message}`

const MAX_FLYING = 8
let flying = 0

// A cup with "+฿130 · สยาม" arcs across the screen. Plain DOM (like the logo's bean burst):
// it's a fire-and-forget effect, React doesn't need to know about it.
function flyCup(order) {
  if (prefersReducedMotion() || flying >= MAX_FLYING) return
  flying++
  const el = document.createElement('div')
  el.className = 'fly-cup'
  el.style.setProperty('--y', `${18 + Math.random() * 55}vh`)
  el.style.setProperty('--arc', `${-40 - Math.random() * 80}px`)
  el.innerHTML = '<span class="fly-cup-icon">☕</span><span class="fly-cup-tag"></span>'
  el.lastChild.textContent = `+${formatBaht(order.revenue)} · ${order.branch}`
  document.body.append(el)
  el.addEventListener('animationend', () => {
    el.remove()
    flying--
  })
}

function PlayTab({ colors }) {
  const [user, setUser] = useState(undefined)
  const [authError, setAuthError] = useState(null)
  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const signIn = () => {
    setAuthError(null)
    signInWithPopup(auth, googleProvider).catch((e) => setAuthError(AUTH_ERRORS[e.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e.message}`))
  }

  if (user === undefined) return <p className="text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
  if (!user) return <SignInCard onSignIn={signIn} error={authError} />
  return <PlayShop user={user} colors={colors} />
}

function PlayShop({ user, colors }) {
  const day = todayBangkok()
  const firstName = (user.displayName || user.email).split(' ')[0]
  const area = useRef(null)
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])
  const [meal, setMeal] = useState({ n: 0, revenue: 0 })
  const [botOn, setBotOn] = useState(false)
  const [botCount, setBotCount] = useState(0)
  const [sharing, setSharing] = useState(true)
  const { peers, bark } = usePresence({
    user,
    area,
    sharing,
    onCapReached: () => {
      setSharing(false)
      showToast({ icon: '🛑', title: 'ปิดแชร์เคอร์เซอร์แล้ว', text: 'ขยับครบโควตาที่ตั้งไว้ของรอบนี้ (กันโควตาฟรีหมด)' })
    },
  })

  // The menu comes from the CSV (free), not from Firestore (costs reads).
  useEffect(() => {
    Papa.parse('/products.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (r) => setProducts(r.data.filter((p) => p.product_name && Number(p.price) > 0)),
    })
  }, [])

  // Today's play orders, live. `where day ==` uses Firestore's automatic single-field index,
  // so no composite index to create; sorting happens here in the browser.
  useEffect(() => {
    let first = true
    const q = query(collection(db, 'playground'), where('day', '==', day), limit(ORDER_LIMIT))
    return onSnapshot(
      q,
      (snap) => {
        setError(null)
        setOrders(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' })
            return { id: d.id, ...data, at: data.created_at?.toMillis() ?? Date.now() }
          }),
        )
        if (first) {
          first = false
          return
        }
        const added = snap.docChanges().filter((c) => c.type === 'added').map((c) => c.doc.data())
        if (added.length === 0) return
        playSound('kaching')
        added.forEach(flyCup)
        setMeal((m) => ({ n: m.n + 1, revenue: added.reduce((s, o) => s + o.revenue, 0) }))
      },
      (e) => setError(errorText(e)),
    )
  }, [day])

  const sell = (bot) =>
    addDoc(collection(db, 'playground'), {
      ...makePlayOrder(products, { day, uid: user.uid, name: bot ? `บอทของ${firstName}` : firstName, bot }),
      created_at: serverTimestamp(),
    })

  // The bot: one order every BOT_EVERY_MS, paused while the tab is hidden, stops itself at BOT_CAP.
  const botCountRef = useRef(0)
  useEffect(() => {
    if (!botOn || products.length === 0) return
    const t = setInterval(() => {
      if (document.hidden) return
      if (botCountRef.current >= BOT_CAP) {
        setBotOn(false)
        showToast({ icon: '🤖', title: 'บอทพักแล้ว', text: `ขายครบ ${BOT_CAP} ออเดอร์ของรอบนี้` })
        return
      }
      botCountRef.current++
      setBotCount(botCountRef.current)
      sell(true).catch((e) => {
        setBotOn(false)
        setError(errorText(e))
      })
    }, BOT_EVERY_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botOn, products])

  const startBot = () => {
    botCountRef.current = 0
    setBotCount(0)
    setBotOn(true)
  }

  const mine = useMemo(() => (orders ?? []).filter((o) => o.created_by === user.uid), [orders, user.uid])
  const clearMine = async () => {
    setBotOn(false)
    // A batch holds up to 500 writes; the ids are already loaded, so this costs no extra reads.
    for (let i = 0; i < mine.length; i += 450) {
      const batch = writeBatch(db)
      mine.slice(i, i + 450).forEach((o) => batch.delete(doc(db, 'playground', o.id)))
      await batch.commit()
    }
    showToast({ icon: '🧹', title: 'ล้างออเดอร์ของคุณแล้ว', text: `ลบไป ${formatNumber(mine.length)} รายการ` })
  }

  const standings = useMemo(() => raceStandings(orders ?? []), [orders])
  const total = standings.reduce((s, r) => s + r.revenue, 0)
  const count = orders?.length ?? 0
  const recent = useMemo(() => [...(orders ?? [])].sort((a, b) => b.at - a.at).slice(0, 12), [orders])

  // A new leader takes the crown → fanfare + confetti (not on the first load).
  const leader = standings[0]?.revenue > 0 ? standings[0].branch : null
  const lastLeader = useRef(undefined)
  useEffect(() => {
    if (orders === null) return
    if (lastLeader.current !== undefined && leader && leader !== lastLeader.current) {
      playSound('fanfare')
      fireConfetti()
      showToast({ icon: '👑', title: `สาขา${leader} แซงขึ้นนำ!`, text: 'ศึกชิงยอดขายวันนี้ยังไม่จบ' })
    }
    lastLeader.current = leader
  }, [leader, orders])

  return (
    <div ref={area} className="relative">
      <CursorLayer peers={peers} />

      <div className="rise mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <p className="text-sm text-muted">
          🎮 ร้านจำลอง · ออเดอร์ปลอมแยกจากยอดจริง ไม่ปนการบ้าน
        </p>
        <UserChip user={user} onSignOut={() => signOut(auth)} />
      </div>

      {recent.length > 0 && (
        <div className="ticker rise mb-4 overflow-hidden rounded-xl border border-line bg-surface/80 py-2 text-sm sm:mb-6" aria-hidden="true">
          <div className="ticker-track flex w-max gap-8 whitespace-nowrap">
            {[0, 1].map((copy) =>
              recent.map((o) => (
                <span key={`${copy}-${o.id}`} className="text-ink-2">
                  {o.bot ? '🤖' : '🙋'} {o.product_name} ×{o.qty} · <b className="font-medium text-accent">{o.branch}</b> · {formatBaht(o.revenue)}{' '}
                  <span className="text-muted">โดย {o.by_name}</span>
                </span>
              )),
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-ink">
          ❌ {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard icon="sales" label="ยอดร้านจำลองวันนี้" value={total} format={(v) => formatBaht(v)} />
        <KpiCard icon="bills" label="ออเดอร์" value={count} format={(v) => formatNumber(v)} delay={60} />
        <KpiCard icon="cup" label="เฉลี่ยต่อออเดอร์" value={count ? total / count : 0} format={(v) => formatBaht(v)} delay={120} />
        <KpiCard icon="members" label="คนในร้านตอนนี้" value={peers.length + 1} format={(v) => formatNumber(v)} hint="รวมคุณ" delay={180} />
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Panel title="ศึกชิงยอดขายวันนี้" subtitle="อัปเดตสดทุกออเดอร์ · ใครแซงขึ้นนำได้มงกุฎ" className="">
            {orders === null && !error ? <p className="text-sm text-muted">กำลังเชื่อมต่อ…</p> : <LiveRace standings={standings} colors={colors} />}
          </Panel>

          <Panel title="หน้าเคาน์เตอร์" subtitle="กดขายเอง หรือปล่อยให้บอทขายแทน · เปิดอีกหน้าต่างแล้วดูทุกอย่างขยับพร้อมกัน">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-sound="none"
                disabled={products.length === 0}
                onClick={() => sell(false).catch((e) => setError(errorText(e)))}
                className="sell-btn h-14 rounded-2xl bg-accent px-6 text-lg font-medium text-surface shadow-card transition [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
              >
                ☕ ขายแก้วนี้!
              </button>
              {botOn ? (
                <button type="button" onClick={() => setBotOn(false)} className="toy-btn">
                  ⏸ หยุดบอท ({formatNumber(botCount)}/{BOT_CAP})
                </button>
              ) : (
                <button type="button" onClick={startBot} disabled={products.length === 0} className="toy-btn">
                  🤖 ปล่อยบอทขาย
                </button>
              )}
              {botOn && <span className="bot-dot text-xs text-muted">บอทกำลังขาย ทุก {BOT_EVERY_MS / 1000} วินาที…</span>}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-ink-2">
                <input type="checkbox" checked={sharing} onChange={(e) => setSharing(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                แชร์เคอร์เซอร์ของฉัน
              </label>
              <button type="button" data-sound="none" onClick={bark} disabled={!sharing} className="toy-btn">
                🐶 เห่าทักเพื่อน
              </button>
              <button type="button" onClick={clearMine} disabled={mine.length === 0} className="toy-btn ml-auto">
                🧹 ล้างออเดอร์ของฉัน ({formatNumber(mine.length)})
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              กันโควตาฟรีหมด: บอทหยุดเองที่ {BOT_CAP} ออเดอร์ และหยุดชั่วคราวเมื่อสลับไปแท็บอื่น · เคอร์เซอร์ส่งไม่เกิน 2–3 ครั้งต่อวินาที
            </p>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel title="น้องปั๊กหิวแล้ว" subtitle="เลี้ยงด้วยยอดขาย" className="">
            <PugPet meal={meal} todayRevenue={total} />
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export default PlayTab
