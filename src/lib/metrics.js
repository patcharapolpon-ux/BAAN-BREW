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
