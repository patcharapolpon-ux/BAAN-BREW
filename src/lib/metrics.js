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
  const text = `${(value * 100).toFixed(decimals)}%`
  return signed && value > 0 ? `+${text}` : text
}

/** Thai-locale date for a "YYYY-MM-DD" Thai calendar date, e.g. { day, month: 'short', year: '2-digit' } → "1 เม.ย. 68". */
export function formatThaiDate(date, options) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', ...options })
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
