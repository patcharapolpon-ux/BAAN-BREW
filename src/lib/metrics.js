// Sales metrics for the BaanBrew dashboard.
// Every row of sales.csv is one line item; one bill (order_id) can span many rows.

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Sales amount of one line item: qty × unit_price. */
export function lineTotal(row) {
  return Number(row.qty) * Number(row.unit_price)
}

/**
 * Calendar date in Thai time ("YYYY-MM-DD") for an ISO datetime.
 * Parses the timestamp (honouring whatever offset it carries), shifts to UTC+7,
 * and takes the date part — so a sale at 00:30 Bangkok time lands on the right day.
 */
export function toThaiDate(datetime) {
  return new Date(Date.parse(datetime) + THAI_OFFSET_MS).toISOString().slice(0, 10)
}

/** Total sales: sum of qty × unit_price over every row. */
export function totalSales(rows) {
  return rows.reduce((sum, row) => sum + lineTotal(row), 0)
}

/** Number of bills: count of distinct order_id (not rows). */
export function orderCount(rows) {
  return new Set(rows.map((row) => row.order_id)).size
}

/** Average bill value: total sales ÷ number of bills (0 when there are no bills). */
export function averageOrderValue(rows) {
  const orders = orderCount(rows)
  return orders === 0 ? 0 : totalSales(rows) / orders
}

/** Distinct members: count of distinct non-blank customer_id. Blank = walk-in, not a member. */
export function uniqueMembers(rows) {
  const ids = new Set()
  for (const row of rows) {
    const id = (row.customer_id ?? '').trim()
    if (id) ids.add(id)
  }
  return ids.size
}

/**
 * Share of bills (0–1) placed by a member: bills with a non-blank customer_id on
 * any of their rows ÷ all bills.
 */
export function memberOrderShare(rows) {
  const all = new Set()
  const members = new Set()
  for (const row of rows) {
    all.add(row.order_id)
    if ((row.customer_id ?? '').trim()) members.add(row.order_id)
  }
  return all.size === 0 ? 0 : members.size / all.size
}

/** Days covered: first to last Thai sale date, inclusive (days without sales still count). */
export function dayCount(rows) {
  if (rows.length === 0) return 0
  let first = null
  let last = null
  for (const row of rows) {
    const date = toThaiDate(row.datetime)
    if (first === null || date < first) first = date
    if (last === null || date > last) last = date
  }
  return (Date.parse(last) - Date.parse(first)) / DAY_MS + 1
}

/**
 * Sales per Thai calendar day, oldest first: [{ date, sales }].
 * Days between the first and last sale with no sales are filled with 0
 * so the line doesn't silently bridge gaps.
 */
export function dailySales(rows) {
  const byDate = new Map()
  for (const row of rows) {
    const date = toThaiDate(row.datetime)
    byDate.set(date, (byDate.get(date) ?? 0) + lineTotal(row))
  }
  if (byDate.size === 0) return []

  const dates = [...byDate.keys()].sort()
  const result = []
  const end = Date.parse(dates.at(-1))
  for (let t = Date.parse(dates[0]); t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10)
    result.push({ date, sales: byDate.get(date) ?? 0 })
  }
  return result
}

/**
 * Adds a trailing moving average of `sales` to each day: [{ date, sales, salesAvg }].
 * salesAvg = mean of this day and the (window − 1) days before it. The first
 * (window − 1) days get null because a full window isn't available yet.
 * Expects consecutive days with no gaps — which dailySales() guarantees.
 */
export function movingAverage(series, window = 7) {
  let sum = 0
  return series.map((day, i) => {
    sum += day.sales
    if (i >= window) sum -= series[i - window].sales
    return { ...day, salesAvg: i >= window - 1 ? sum / window : null }
  })
}

/**
 * The last `days` entries of a daily series (for the chart's time-range buttons).
 * `days` null/undefined = the whole series.
 */
export function lastDays(series, days) {
  return days ? series.slice(-days) : series
}

/**
 * Sales per Thai calendar day for every date from `start` to `end` (YYYY-MM-DD, inclusive):
 * [{ date, sales }]. Unlike dailySales() the range is fixed, so a day with no sales yet
 * (e.g. today, early in the morning) still shows up as 0 at the end of the line.
 */
export function dailySalesBetween(rows, start, end) {
  const byDate = new Map(dailySales(rows).map((d) => [d.date, d.sales]))
  const result = []
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10)
    result.push({ date, sales: byDate.get(date) ?? 0 })
  }
  return result
}

/** Sales per Thai hour of day (0–23), every hour included: [{ hour, sales }]. */
export function hourlySales(rows) {
  const sales = Array(24).fill(0)
  for (const row of rows) sales[new Date(Date.parse(row.datetime) + THAI_OFFSET_MS).getUTCHours()] += lineTotal(row)
  return sales.map((amount, hour) => ({ hour, sales: amount }))
}

/**
 * Last `days` days vs the `days` before them, from a dailySales() series:
 * { current, previous, change }. change = (current − previous) ÷ previous,
 * or null when there isn't a full previous period (or it summed to 0).
 */
export function comparePeriods(daily, days = 30) {
  const sum = (list) => list.reduce((total, day) => total + day.sales, 0)
  const current = sum(daily.slice(-days))
  if (daily.length < days * 2) return { current, previous: null, change: null }
  const previous = sum(daily.slice(-days * 2, -days))
  return { current, previous, change: previous === 0 ? null : (current - previous) / previous }
}

/** Sales per branch, largest first: [{ branch, sales, share }]; share = branch ÷ all branches (0–1). */
export function salesByBranch(rows) {
  const byBranch = new Map()
  let total = 0
  for (const row of rows) {
    const amount = lineTotal(row)
    byBranch.set(row.branch, (byBranch.get(row.branch) ?? 0) + amount)
    total += amount
  }
  return [...byBranch]
    .map(([branch, sales]) => ({ branch, sales, share: total === 0 ? 0 : sales / total }))
    .sort((a, b) => b.sales - a.sales)
}

/** Rows of one branch; branch null = every row (no filter). */
export function filterByBranch(rows, branch) {
  return branch ? rows.filter((row) => row.branch === branch) : rows
}

/**
 * Sales grouped by any column (e.g. 'payment_method', 'channel'), largest first:
 * [{ name, sales, share }]; share = group ÷ total (0–1). Blank values become 'ไม่ระบุ'.
 */
export function salesByField(rows, field) {
  const byName = new Map()
  let total = 0
  for (const row of rows) {
    const name = (row[field] ?? '').trim() || 'ไม่ระบุ'
    const amount = lineTotal(row)
    byName.set(name, (byName.get(name) ?? 0) + amount)
    total += amount
  }
  return [...byName]
    .map(([name, sales]) => ({ name, sales, share: total === 0 ? 0 : sales / total }))
    .sort((a, b) => b.sales - a.sales)
}

export const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์']

/**
 * Sales by weekday × hour of day, in Thai time, for the heatmap.
 * Returns { hours: [7, 8, …], days: [{ weekday: 1..0, name, cells: [{ hour, sales }] }], max, peak }.
 * Rows run Monday → Sunday; hours span the earliest to latest hour with any sale.
 * peak = the single busiest { weekday, name, hour, sales } cell.
 */
export function salesHeatmap(rows) {
  const grid = Array.from({ length: 7 }, () => new Map())
  let minHour = 23
  let maxHour = 0
  for (const row of rows) {
    const t = new Date(Date.parse(row.datetime) + THAI_OFFSET_MS)
    const day = t.getUTCDay()
    const hour = t.getUTCHours()
    grid[day].set(hour, (grid[day].get(hour) ?? 0) + lineTotal(row))
    if (hour < minHour) minHour = hour
    if (hour > maxHour) maxHour = hour
  }
  if (rows.length === 0) return { hours: [], days: [], max: 0, peak: null }

  const hours = []
  for (let h = minHour; h <= maxHour; h++) hours.push(h)
  let max = 0
  let peak = null
  const days = [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const cells = hours.map((hour) => {
      const sales = grid[weekday].get(hour) ?? 0
      if (sales > max) {
        max = sales
        peak = { weekday, name: THAI_WEEKDAYS[weekday], hour, sales }
      }
      return { hour, sales }
    })
    return { weekday, name: THAI_WEEKDAYS[weekday], cells }
  })
  return { hours, days, max, peak }
}

/**
 * All KPI card values in one object. Per-day figures divide by dayCount()
 * (calendar days in range), so quiet days pull the average down as they should.
 */
export function summarize(rows) {
  const sales = totalSales(rows)
  const orders = orderCount(rows)
  const days = dayCount(rows)
  return {
    totalSales: sales,
    orderCount: orders,
    averageOrderValue: orders === 0 ? 0 : sales / orders,
    uniqueMembers: uniqueMembers(rows),
    memberOrderShare: memberOrderShare(rows),
    dayCount: days,
    salesPerDay: days === 0 ? 0 : sales / days,
    ordersPerDay: days === 0 ? 0 : orders / days,
  }
}

/**
 * Running totals per day for the "time machine" replay (a bar chart race of branches).
 * Returns { branches: [names, final ranking], frames: [{ date, daySales, sales, bills, byBranch: [cum per branch] }] }.
 * Every calendar day from first to last sale gets a frame (quiet days repeat the totals),
 * byBranch is in the same order as `branches`, and bills counts each order_id once, on its first row.
 */
export function branchRace(rows) {
  const branches = salesByBranch(rows).map((b) => b.branch)
  const index = new Map(branches.map((b, i) => [b, i]))
  const days = new Map() // date → { sales, bills, byBranch }
  const seen = new Set()
  for (const row of rows) {
    const date = toThaiDate(row.datetime)
    let day = days.get(date)
    if (!day) days.set(date, (day = { sales: 0, bills: 0, byBranch: branches.map(() => 0) }))
    const amount = lineTotal(row)
    day.sales += amount
    day.byBranch[index.get(row.branch)] += amount
    if (!seen.has(row.order_id)) {
      seen.add(row.order_id)
      day.bills++
    }
  }
  if (days.size === 0) return { branches, frames: [] }

  const dates = [...days.keys()].sort()
  const frames = []
  const cum = branches.map(() => 0)
  let sales = 0
  let bills = 0
  const end = Date.parse(dates.at(-1))
  for (let t = Date.parse(dates[0]); t <= end; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10)
    const day = days.get(date)
    if (day) {
      day.byBranch.forEach((v, i) => (cum[i] += v))
      sales += day.sales
      bills += day.bills
    }
    frames.push({ date, daySales: day?.sales ?? 0, sales, bills, byBranch: [...cum] })
  }
  return { branches, frames }
}

/**
 * Best-selling products by quantity: [{ product_id, name, category, qty }], largest first.
 * `products` = rows of products.csv; ids missing from it fall back to the id as the name.
 */
export function topProducts(rows, products, n = 4) {
  const qty = new Map()
  for (const row of rows) qty.set(row.product_id, (qty.get(row.product_id) ?? 0) + Number(row.qty))
  const info = new Map(products.map((p) => [p.product_id, p]))
  return [...qty]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, q]) => ({ product_id: id, name: info.get(id)?.product_name ?? id, category: info.get(id)?.category ?? '', qty: q }))
}

/**
 * Everything the "Stories" recap needs, in one pass over the data:
 * { kpi, first, last, cups, bestDay, topMenu, peak, weekdays, branches, biggestBill, topPayment }.
 * cups = Σ qty (one cup per item); bestDay = { date, sales }; topMenu = top 3 by qty;
 * weekdays = sales per weekday, best first; biggestBill = { order_id, total, items, branch, date }.
 */
export function storyFacts(rows, products) {
  const daily = dailySales(rows)
  const heat = salesHeatmap(rows)
  const bills = new Map()
  let cups = 0
  for (const row of rows) {
    cups += Number(row.qty)
    let bill = bills.get(row.order_id)
    if (!bill) bills.set(row.order_id, (bill = { order_id: row.order_id, total: 0, items: 0, branch: row.branch, date: toThaiDate(row.datetime) }))
    bill.total += lineTotal(row)
    bill.items += Number(row.qty)
  }
  const biggestBill = [...bills.values()].reduce((a, b) => (b.total > a.total ? b : a), { total: 0 })
  const weekdays = heat.days
    .map((d) => ({ weekday: d.weekday, name: d.name, sales: d.cells.reduce((sum, c) => sum + c.sales, 0) }))
    .sort((a, b) => b.sales - a.sales)
  return {
    kpi: summarize(rows),
    first: daily[0]?.date ?? null,
    last: daily.at(-1)?.date ?? null,
    cups,
    bestDay: daily.reduce((a, b) => (b.sales > a.sales ? b : a), { date: null, sales: 0 }),
    topMenu: topProducts(rows, products, 3),
    peak: heat.peak,
    weekdays,
    branches: salesByBranch(rows),
    biggestBill,
    topPayment: salesByField(rows, 'payment_method')[0] ?? null,
  }
}

// ---- data detective: unusual days ----

/** Mean and (population) standard deviation of a list of numbers: { mean, sd }. */
export function meanStd(values) {
  if (values.length === 0) return { mean: 0, sd: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return { mean, sd: Math.sqrt(variance) }
}

/**
 * What a day "should" have sold: the same weekday over the previous `weeks` weeks.
 * Comparing Friday with past Fridays (not with Mondays) keeps the normal weekly rhythm
 * from looking unusual. Returns { mean, sd, n } or null when there isn't enough history.
 * `daily` = dailySales() output (consecutive days, so 7 steps back = same weekday).
 */
export function expectedFor(daily, index, weeks = 8) {
  const past = []
  for (let i = index - 7; i >= 0 && past.length < weeks; i -= 7) past.push(daily[i].sales)
  if (past.length < 4) return null
  return { ...meanStd(past), n: past.length }
}

/**
 * Days whose sales are far from normal, as z-scores:
 *   z = (sales − expected mean) ÷ standard deviation of those past days.
 * |z| ≥ threshold → unusual. Returns [{ date, sales, expected, sd, z, kind: 'spike' | 'drop' }],
 * most unusual first.
 */
export function findAnomalies(daily, { weeks = 8, threshold = 2.5 } = {}) {
  const found = []
  daily.forEach((day, i) => {
    const e = expectedFor(daily, i, weeks)
    if (!e || e.sd === 0) return
    const z = (day.sales - e.mean) / e.sd
    if (Math.abs(z) >= threshold) found.push({ date: day.date, sales: day.sales, expected: e.mean, sd: e.sd, z, kind: z > 0 ? 'spike' : 'drop' })
  })
  return found.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
}

/** Sales rows grouped by Thai date: Map('YYYY-MM-DD' → rows). Build once, look days up fast. */
export function rowsByDate(rows) {
  const map = new Map()
  for (const row of rows) {
    const date = toThaiDate(row.datetime)
    if (!map.has(date)) map.set(date, [])
    map.get(date).push(row)
  }
  return map
}

/**
 * Why was this day different? Compares the day with the same weekday of the previous `weeks`
 * weeks, split by branch, product and hour. Each list: [{ key, actual, expected, diff }],
 * biggest absolute difference first. `products` (products.csv rows) turns ids into names.
 */
export function explainDay(byDate, date, products = [], weeks = 8) {
  const names = new Map(products.map((p) => [p.product_id, p.product_name]))
  const pastDates = []
  for (let k = 1; k <= weeks; k++) {
    const d = new Date(Date.parse(date) - k * 7 * DAY_MS).toISOString().slice(0, 10)
    if (byDate.has(d)) pastDates.push(d)
  }
  const split = (field, label = (v) => v) => {
    const sumBy = (rows) => {
      const m = new Map()
      for (const r of rows) {
        const key = field === 'hour' ? new Date(Date.parse(r.datetime) + THAI_OFFSET_MS).getUTCHours() : r[field]
        m.set(key, (m.get(key) ?? 0) + lineTotal(r))
      }
      return m
    }
    const today = sumBy(byDate.get(date) ?? [])
    const past = pastDates.map((d) => sumBy(byDate.get(d)))
    const keys = new Set([...today.keys(), ...past.flatMap((m) => [...m.keys()])])
    return [...keys]
      .map((key) => {
        const actual = today.get(key) ?? 0
        const expected = past.length ? past.reduce((s, m) => s + (m.get(key) ?? 0), 0) / past.length : 0
        return { key: label(key), actual, expected, diff: actual - expected }
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  }
  return {
    pastDays: pastDates.length,
    branches: split('branch'),
    products: split('product_id', (id) => names.get(id) ?? id),
    hours: split('hour'),
  }
}

/**
 * Do lottery draw days sell differently? For every draw date inside the data, its sales vs the
 * same-weekday expectation. lift = sales ÷ expected − 1. Returns
 * { days: [{ date, sales, expected, lift }], averageLift, higher, total }.
 */
export function lotteryEffect(daily, drawDates) {
  const index = new Map(daily.map((d, i) => [d.date, i]))
  const days = []
  for (const date of drawDates) {
    const i = index.get(date)
    if (i === undefined) continue
    const e = expectedFor(daily, i)
    if (!e || e.mean === 0) continue
    days.push({ date, sales: daily[i].sales, expected: e.mean, lift: daily[i].sales / e.mean - 1 })
  }
  const averageLift = days.length ? days.reduce((s, d) => s + d.lift, 0) / days.length : 0
  return { days, averageLift, higher: days.filter((d) => d.lift > 0).length, total: days.length }
}

// ---- what-if simulator ----

// Fixed assumptions, shown to the user next to the result (a model is only as honest as these).
export const WHAT_IF = {
  EXTRA_HOUR_SHARE: 0.6, // an extra evening hour sells 60% of what the current last hour sells
  NEW_BRANCH_RAMP: 0.7, // a new branch's first year sells 70% of a mature branch of the same type
}

/**
 * Step 1 of the simulator (slow, run once): the facts every scenario needs, from the last
 * 365 days of data. branchInfo = branches.csv rows ({ branch, branch_type }).
 * Returns { base, byWeekday[0–6], lastHour, lastHourSales, perDayByType: { type: { perDay, peers } } }.
 */
export function whatIfFacts(rows, branchInfo) {
  const lastMs = rows.reduce((max, r) => Math.max(max, Date.parse(r.datetime)), 0)
  const cutoff = lastMs - 365 * DAY_MS
  const byWeekday = Array(7).fill(0)
  const byHour = Array(24).fill(0)
  let base = 0
  for (const r of rows) {
    const ms = Date.parse(r.datetime)
    if (ms <= cutoff) continue
    const t = new Date(ms + THAI_OFFSET_MS)
    const amount = lineTotal(r)
    base += amount
    byWeekday[t.getUTCDay()] += amount
    byHour[t.getUTCHours()] += amount
  }
  const lastHour = byHour.findLastIndex((v) => v > 0)

  // Per open day, each branch over all the data, then averaged per branch type.
  const type = new Map(branchInfo.map((b) => [b.branch, b.branch_type]))
  const perDayByType = {}
  for (const b of salesByBranch(rows)) {
    const own = rows.filter((r) => r.branch === b.branch)
    const t = type.get(b.branch) ?? 'อื่น ๆ'
    perDayByType[t] ??= { perDay: 0, peers: [] }
    perDayByType[t].peers.push(b.branch)
    perDayByType[t].perDay += (b.sales / dayCount(own) - perDayByType[t].perDay) / perDayByType[t].peers.length // running mean
  }
  return { base, byWeekday, lastHour, lastHourSales: byHour[lastHour] ?? 0, perDayByType }
}

/**
 * Step 2 (instant, run on every slider move): one scenario = {
 *   priceChange: −0.2…0.3 (every menu price), elasticity: e.g. −0.8 (how strongly cups sold react),
 *   closedWeekday: null | 0–6 (0 = Sunday), shiftShare: 0–1 (closed-day customers who come another day),
 *   extraHour: bool (open one hour later), newBranchType: null | branch_type, cannibal: 0–1 }
 * Returns { base, steps: [{ key, value }], total, change, cupsChange }.
 *
 * Price uses constant elasticity: cups × (1 + p)^ε, so revenue × (1 + p)^(1 + ε).
 * The other levers add or remove baht first; the price factor then applies to the new total.
 */
export function whatIf(facts, scenario) {
  const { base } = facts
  const closed = scenario.closedWeekday != null ? -facts.byWeekday[scenario.closedWeekday] * (1 - (scenario.shiftShare ?? 0)) : 0
  const extra = scenario.extraHour ? facts.lastHourSales * WHAT_IF.EXTRA_HOUR_SHARE : 0
  const peer = facts.perDayByType[scenario.newBranchType]
  const newBranch = peer ? peer.perDay * 365 * WHAT_IF.NEW_BRANCH_RAMP * (1 - (scenario.cannibal ?? 0)) : 0

  const p = scenario.priceChange ?? 0
  const e = scenario.elasticity ?? -0.8
  const subtotal = base + closed + extra + newBranch
  const price = subtotal * ((1 + p) ** (1 + e) - 1)
  const total = subtotal + price
  return {
    base,
    steps: [
      { key: 'closed', value: closed },
      { key: 'extraHour', value: extra },
      { key: 'newBranch', value: newBranch },
      { key: 'price', value: price },
    ],
    total,
    change: base === 0 ? 0 : total / base - 1,
    cupsChange: (1 + p) ** e - 1,
  }
}

// ---- describing charts in words (for screen readers, and for anyone who'd rather read) ----

const SR_DATE = { day: 'numeric', month: 'long', year: 'numeric' }

/**
 * A daily series ([{ date, sales }]) as a few Thai sentences: range, average, highest and
 * lowest day, and whether the second half sold more or less than the first.
 */
export function describeDaily(series) {
  if (series.length === 0) return 'ยังไม่มีข้อมูลยอดขาย'
  const total = series.reduce((s, d) => s + d.sales, 0)
  const high = series.reduce((a, b) => (b.sales > a.sales ? b : a))
  const low = series.reduce((a, b) => (b.sales < a.sales ? b : a))
  const half = Math.floor(series.length / 2)
  const avg = (list) => list.reduce((s, d) => s + d.sales, 0) / Math.max(1, list.length)
  const firstHalf = avg(series.slice(0, half))
  const change = firstHalf === 0 ? 0 : avg(series.slice(half)) / firstHalf - 1
  const trend =
    Math.abs(change) < 0.02
      ? 'ครึ่งหลังขายได้พอ ๆ กับครึ่งแรก'
      : `ครึ่งหลังยอดเฉลี่ย${change > 0 ? 'สูงขึ้น' : 'ลดลง'} ${formatPercent(Math.abs(change), 1)} เมื่อเทียบกับครึ่งแรก`
  return [
    `กราฟยอดขายรายวัน ${formatNumber(series.length)} วัน ตั้งแต่ ${formatThaiDate(series[0].date, SR_DATE)} ถึง ${formatThaiDate(series.at(-1).date, SR_DATE)}`,
    `เฉลี่ยวันละ ${formatBaht(total / series.length)}`,
    `สูงสุด ${formatBaht(high.sales)} เมื่อ${formatThaiDate(high.date, { weekday: 'long', ...SR_DATE })}`,
    `ต่ำสุด ${formatBaht(low.sales)} เมื่อ${formatThaiDate(low.date, { weekday: 'long', ...SR_DATE })}`,
    trend,
  ].join(' · ')
}

/** Branch ranking ([{ branch, sales, share }]) as one Thai sentence. */
export function describeBranches(branches) {
  if (branches.length === 0) return 'ยังไม่มีข้อมูลสาขา'
  return `ยอดขายแยกสาขา ${branches.length} สาขา เรียงจากมากไปน้อย: ${branches
    .map((b, i) => `อันดับ ${i + 1} ${b.branch} ${formatBaht(b.sales)} (${formatPercent(b.share, 1)})`)
    .join(', ')}`
}

// ---- customers (public/customers.csv: 1 row = 1 member) ----

/** Whole days from date a to date b ('YYYY-MM-DD'); positive when b is later. */
export function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS)
}

/**
 * Each member joined with what they bought: { ...customer, orders, spend, first, last }.
 * orders = distinct bills, spend = Σ qty × unit_price, first/last = Thai purchase dates
 * (null when the member never bought). Sales rows with a blank customer_id are walk-ins and skipped.
 */
export function customerProfiles(customers, rows) {
  const byId = new Map()
  for (const row of rows) {
    const id = (row.customer_id ?? '').trim()
    if (!id) continue
    const date = toThaiDate(row.datetime)
    const cur = byId.get(id) ?? { bills: new Set(), spend: 0, first: date, last: date }
    cur.bills.add(row.order_id)
    cur.spend += lineTotal(row)
    if (date < cur.first) cur.first = date
    if (date > cur.last) cur.last = date
    byId.set(id, cur)
  }
  return customers.map((c) => {
    const a = byId.get(c.customer_id)
    return { ...c, orders: a ? a.bills.size : 0, spend: a ? a.spend : 0, first: a?.first ?? null, last: a?.last ?? null }
  })
}

function median(values) {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Member KPI values as of `asOf` (the last sales date — the data is historical, so "today"
 * would make everyone look inactive). Spend figures count only members who bought.
 * New members compare the last two *complete* months: sign-ups stop a few days before
 * sales do, so a trailing 30-day window would show a fake drop.
 */
export function summarizeCustomers(profiles, asOf) {
  const buyers = profiles.filter((p) => p.orders > 0)
  const fullMonths = joinsByMonth(profiles, asOf).filter((m) => !m.partial)
  const newMonth = fullMonths.at(-1) ?? null
  const prevMonth = fullMonths.at(-2) ?? null
  const active30 = buyers.filter((p) => daysBetween(p.last, asOf) < 30).length
  const spend = buyers.map((p) => p.spend)
  return {
    total: profiles.length,
    buyers: buyers.length,
    buyerShare: profiles.length === 0 ? 0 : buyers.length / profiles.length,
    newMonth, // { month, count } of the latest complete month
    newChange: newMonth && prevMonth?.count ? (newMonth.count - prevMonth.count) / prevMonth.count : null,
    avgSpend: buyers.length === 0 ? 0 : spend.reduce((a, b) => a + b, 0) / buyers.length,
    medianSpend: median(spend),
    active30,
    active30Share: buyers.length === 0 ? 0 : active30 / buyers.length,
  }
}

/**
 * New members per calendar month, oldest first: [{ month: 'YYYY-MM', count, partial }].
 * partial = the month isn't over yet at `asOf`, so its count isn't comparable.
 */
export function joinsByMonth(profiles, asOf) {
  const byMonth = new Map()
  for (const p of profiles) {
    const m = p.joined_date.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1)
  }
  const [y, mo, d] = asOf.split('-').map(Number)
  const monthOver = d === new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return [...byMonth]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count, partial: month === asOf.slice(0, 7) && !monthOver }))
}

/** Recency buckets, most recent first. maxDays is exclusive; the last bucket is "never bought". */
export const RECENCY_BUCKETS = [
  { key: 'd30', label: 'ซื้อใน 30 วัน', maxDays: 30 },
  { key: 'd90', label: '31–90 วันก่อน', maxDays: 90 },
  { key: 'd180', label: '91–180 วันก่อน', maxDays: 180 },
  { key: 'older', label: 'เกิน 180 วัน', maxDays: Infinity },
  { key: 'never', label: 'ยังไม่เคยซื้อ', maxDays: null },
]

/** Members per recency bucket (days since last purchase, as of asOf): [{ key, label, count, share }]. */
export function recencySegments(profiles, asOf) {
  const counts = Object.fromEntries(RECENCY_BUCKETS.map((b) => [b.key, 0]))
  for (const p of profiles) {
    if (!p.last) {
      counts.never++
      continue
    }
    const days = daysBetween(p.last, asOf)
    counts[RECENCY_BUCKETS.find((b) => b.maxDays != null && days < b.maxDays).key]++
  }
  return RECENCY_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    count: counts[b.key],
    share: profiles.length === 0 ? 0 : counts[b.key] / profiles.length,
  }))
}

export const AGE_ORDER = ['ต่ำกว่า 18', '18-24', '25-34', '35-44', '45-54', '55+']

/**
 * Members grouped by a column (e.g. 'age_group', 'gender', 'home_branch'):
 * [{ name, members, share, buyers, buyerShare, spend, spendPerBuyer }].
 * `order` = fixed category order (e.g. AGE_ORDER); without it, largest group first.
 */
export function customersByGroup(profiles, field, order) {
  const byName = new Map()
  for (const p of profiles) {
    const name = (p[field] ?? '').trim() || 'ไม่ระบุ'
    const cur = byName.get(name) ?? { name, members: 0, buyers: 0, spend: 0 }
    cur.members++
    if (p.orders > 0) cur.buyers++
    cur.spend += p.spend
    byName.set(name, cur)
  }
  const list = [...byName.values()].map((g) => ({
    ...g,
    share: profiles.length === 0 ? 0 : g.members / profiles.length,
    buyerShare: g.members === 0 ? 0 : g.buyers / g.members,
    spendPerBuyer: g.buyers === 0 ? 0 : g.spend / g.buyers,
  }))
  if (!order) return list.sort((a, b) => b.members - a.members)
  const rank = (name) => (order.includes(name) ? order.indexOf(name) : order.length)
  return list.sort((a, b) => rank(a.name) - rank(b.name))
}

/** The n members who spent the most, highest first (ties: more bills first). */
export function topCustomers(profiles, n = 10) {
  return profiles
    .filter((p) => p.orders > 0)
    .sort((a, b) => b.spend - a.spend || b.orders - a.orders)
    .slice(0, n)
}

// ---- formatting ----

/** "฿1,234,567" — thousands separators, fixed decimals (default 0). */
export function formatBaht(value, decimals = 0) {
  return `฿${formatNumber(value, decimals)}`
}

/** "1,234,567" — thousands separators, fixed decimals (default 0). */
export function formatNumber(value, decimals = 0) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** "฿45K" / "฿1.2M" — short form for chart axes. */
export function formatBahtCompact(value) {
  return `฿${value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

/** "27.6%" — share (0–1) as a percentage. signed adds "+" to positives: "+4.2%". */
export function formatPercent(value, decimals = 1, signed = false) {
  // toFixed turns −0.0004 into "-0.0"; a value that rounds to zero shouldn't carry a sign.
  const text = `${(value * 100).toFixed(decimals).replace(/^-(?=0(\.0+)?$)/, '')}%`
  return signed && value > 0 ? `+${text}` : text
}

/** Thai-locale date for a "YYYY-MM-DD" Thai calendar date, e.g. { day, month: 'short', year: '2-digit' } → "1 เม.ย. 68". */
export function formatThaiDate(date, options) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', ...options })
}

const THAI_DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const THAI_PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

// 0–999,999 in Thai words. Special cases: 1 in the tens is "สิบ" (not หนึ่งสิบ), 2 in the
// tens is "ยี่สิบ", and 1 in the units after anything else is "เอ็ด" (สิบเอ็ด, หนึ่งร้อยเอ็ด).
function thaiUnderMillion(n) {
  const digits = String(n).split('').map(Number).reverse()
  let text = ''
  digits.forEach((d, place) => {
    if (d === 0) return
    let word = THAI_DIGITS[d]
    if (place === 1 && d === 1) word = ''
    else if (place === 1 && d === 2) word = 'ยี่'
    else if (place === 0 && d === 1 && n > 9) word = 'เอ็ด'
    text = word + THAI_PLACES[place] + text
  })
  return text
}

function thaiNumberText(n) {
  if (n === 0) return 'ศูนย์'
  if (n < 1e6) return thaiUnderMillion(n)
  const rest = n % 1e6
  return thaiNumberText(Math.floor(n / 1e6)) + 'ล้าน' + (rest ? thaiUnderMillion(rest) : '')
}

/** Amount as it's written on a Thai cheque: 4463443 → "สี่ล้านสี่แสนหกหมื่นสามพันสี่ร้อยสี่สิบสามบาทถ้วน". */
export function thaiBahtText(value) {
  const satang = Math.round(Math.abs(value) * 100)
  const baht = Math.floor(satang / 100)
  const rest = satang % 100
  const sign = value < 0 ? 'ลบ' : ''
  if (rest === 0) return `${sign}${thaiNumberText(baht)}บาทถ้วน`
  return `${sign}${baht ? thaiNumberText(baht) + 'บาท' : ''}${thaiNumberText(rest)}สตางค์`
}

// ---- Lab 2.2 (src/lab2) ----
// The Lab 2 files expect pre-computed revenue/date/hour on each row and a few older helper names.

/** Adds revenue (qty × unit_price), Thai date "YYYY-MM-DD" and Thai hour to every row. */
export function prepareRows(rows) {
  return rows.map((row) => {
    const t = new Date(Date.parse(row.datetime) + THAI_OFFSET_MS)
    return { ...row, revenue: lineTotal(row), date: t.toISOString().slice(0, 10), hour: t.getUTCHours() }
  })
}

/** Sales per day as [{ date, revenue }] — dailySales() with the field name Lab 2 uses. */
export function dailyRevenue(rows) {
  return dailySales(rows).map((d) => ({ date: d.date, revenue: d.sales }))
}

export const fmtBaht = (value) => formatBaht(value)
export const fmtShortBaht = (value) => formatBahtCompact(value)
