// Downloads Thai Government Lottery results for every draw in a date range and saves them to
// public/lottery.json, so the dashboard can read them like sales.csv (no live API calls, no CORS).
//
//   npm run lottery                      → from the first sales date to today
//   npm run lottery -- 2025-04-01 2026-09-30
//
// Source: สำนักงานสลากกินแบ่งรัฐบาล (glo.or.th), open data, CC non-commercial.
// Draws are usually on the 1st and 16th, but move for holidays (17 Jan, 2 May, 30 Dec…),
// so for each 1st/16th we also try a couple of days either side until a draw turns up.
import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://www.glo.or.th/api/lottery/getLotteryResult'
const OUT = new URL('../public/lottery.json', import.meta.url)
const OFFSETS = [0, 1, -1, 2, -2]
const PAUSE_MS = 700 // be polite to a government server
const DAY_MS = 86400000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ymd = (t) => new Date(t).toISOString().slice(0, 10)

function firstSalesDate() {
  const csv = readFileSync(new URL('../public/sales.csv', import.meta.url), 'utf8')
  const dates = csv.match(/\d{4}-\d{2}-\d{2}T/g)?.map((d) => d.slice(0, 10)) ?? []
  return dates.reduce((a, b) => (b < a ? b : a))
}

async function drawOn(date) {
  const [year, month, day] = date.split('-')
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: day, month, year }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${date}`)
  const json = await res.json()
  return json.response // null when there was no draw that day
}

// Only the fields the dashboard uses, flattened.
function slim(r) {
  const values = (prize) => r.data[prize]?.number.map((n) => n.value) ?? []
  return {
    date: r.date,
    first: values('first')[0],
    last2: values('last2')[0],
    last3f: values('last3f'),
    last3b: values('last3b'),
    near1: values('near1'),
  }
}

const [from = firstSalesDate(), to = ymd(Date.now())] = process.argv.slice(2)
console.log(`ดึงผลสลากตั้งแต่ ${from} ถึง ${to}`)

// Every 1st and 16th in the range.
const targets = []
for (let t = Date.parse(from.slice(0, 8) + '01'); t <= Date.parse(to); t += DAY_MS) {
  const d = ymd(t)
  if ((d.endsWith('-01') || d.endsWith('-16')) && d >= from) targets.push(d)
}

const draws = []
for (const target of targets) {
  let found = null
  for (const off of OFFSETS) {
    const date = ymd(Date.parse(target) + off * DAY_MS)
    if (date > to) continue
    found = await drawOn(date)
    await sleep(PAUSE_MS)
    if (found) break
  }
  if (found) {
    draws.push(slim(found))
    console.log(`  ✓ ${found.date}  รางวัลที่ 1 ${draws.at(-1).first}  เลขท้าย 2 ตัว ${draws.at(-1).last2}`)
  } else console.log(`  · ${target}  ไม่พบงวด (อาจยังไม่ออก)`)
}

writeFileSync(OUT, JSON.stringify({ source: 'สำนักงานสลากกินแบ่งรัฐบาล (glo.or.th) · CC BY-NC', fetched: new Date().toISOString(), draws }, null, 1) + '\n')
console.log(`บันทึก ${draws.length} งวด → public/lottery.json`)
