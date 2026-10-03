// Pure logic for the play shop (#play): no Firebase, no React, so it can be unit-tested.
// The play shop writes to its own `playground` collection and never touches `sales`.
import { BRANCHES } from '../lab3/saleModel.js'

// Safety limits that keep a fun session far inside Firestore's free daily quota
// (20,000 writes / 50,000 reads per day on the Spark plan).
export const BOT_CAP = 300 // orders per bot run, then it stops by itself
export const BOT_EVERY_MS = 2500
export const CURSOR_EVERY_MS = 400 // at most one cursor write per this many ms
export const CURSOR_CAP = 1500 // cursor writes per visit, then sharing switches off
export const ORDER_LIMIT = 600 // most orders the listener will ever load for one day

// Siam sells the most in the real data, so the bot sends it a bit more often.
const BRANCH_WEIGHTS = { สยาม: 28, สีลม: 23, บางนา: 20, มหาวิทยาลัย: 18, อารีย์: 11 }

function pickWeighted(weights, rand) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let r = rand() * total
  for (const [key, w] of Object.entries(weights)) {
    r -= w
    if (r < 0) return key
  }
  return Object.keys(weights).at(-1)
}

/** One random order, shaped exactly like the `playground` rule in firestore.rules expects (minus server fields). */
export function makePlayOrder(products, { day, uid, name, bot, rand = Math.random }) {
  const product = products[Math.floor(rand() * products.length)]
  const qty = 1 + Math.floor(rand() * rand() * 3) // mostly 1, sometimes 2–3
  return {
    day,
    branch: pickWeighted(BRANCH_WEIGHTS, rand),
    product_name: product.product_name,
    qty,
    revenue: Number(product.price) * qty,
    bot,
    by_name: name,
    created_by: uid,
  }
}

/** Today's revenue per branch, every branch present (0 if no orders yet), highest first. */
export function raceStandings(orders) {
  const totals = Object.fromEntries(BRANCHES.map((b) => [b, { branch: b, revenue: 0, orders: 0 }]))
  for (const o of orders) {
    const row = totals[o.branch]
    if (!row) continue
    row.revenue += o.revenue
    row.orders += 1
  }
  // Ties keep the fixed BRANCHES order so rows don't flicker between equal places.
  return Object.values(totals).sort((a, b) => b.revenue - a.revenue || BRANCHES.indexOf(a.branch) - BRANCHES.indexOf(b.branch))
}

// ─── The pug's hunger: 100 = full, 0 = starving ───
export const HUNGER_START = 55
const HUNGER_PER_SEC = 0.8 // empty in about 2 minutes without any order

export const hungerAfter = (hunger, seconds) => Math.max(0, hunger - seconds * HUNGER_PER_SEC)

/** Every order feeds the pug; bigger orders fill it more, capped so one order can't max it out. */
export const feedAmount = (revenue) => Math.min(30, 6 + revenue / 10)

export const feed = (hunger, revenue) => Math.min(100, hunger + feedAmount(revenue))

export function pugMood(hunger) {
  if (hunger >= 75) return { key: 'happy', text: 'อิ่มแปล้ มีความสุขมาก', emoji: '😍' }
  if (hunger >= 40) return { key: 'ok', text: 'สบายดี รอขนมอยู่', emoji: '🙂' }
  if (hunger >= 12) return { key: 'hungry', text: 'หิวแล้ว… ขายอะไรหน่อยสิ', emoji: '🥺' }
  return { key: 'sulk', text: 'งอนแล้ว! ไม่มีออเดอร์เลย', emoji: '😤' }
}

/** Pug level grows with today's total sales: level 1 at ฿0, +1 every ฿2,000. */
export const pugLevel = (revenue) => 1 + Math.floor(revenue / 2000)

/** Cursor docs older than this are treated as "left" (closed the tab without cleaning up). */
export const PRESENCE_STALE_MS = 45000

export function activePeers(peers, { now, selfUid }) {
  return peers.filter((p) => p.uid !== selfUid && p.updatedAt && now - p.updatedAt < PRESENCE_STALE_MS)
}
