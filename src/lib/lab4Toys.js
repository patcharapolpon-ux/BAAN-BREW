// Pure logic behind the Lab 4 toys (fortune teller, ghost hunt, sales quake), kept apart from
// the components so the numbers they show can be tested. Randomness comes in as `rng`.

const OMENS = [
  'ดาวพฤหัสโคจรผ่านเครื่องชง',
  'ไอน้ำจากสตีมนมก่อตัวเป็นรูปหัวใจ',
  'เมล็ดกาแฟเรียงตัวเป็นเลขมงคล',
  'ฟองนมบนลาเต้แก้วแรกหมุนตามเข็มนาฬิกา',
  'น้องหมาหน้าร้านกระดิกหางสามครั้ง',
  'แก้วใบสุดท้ายของเมื่อวานยังอุ่นอยู่',
]
const ADVICE = [
  'ตั้งน้ำแข็งเผื่อไว้อีกถัง',
  'ยิ้มให้ลูกค้าคนแรกของวัน',
  'อย่าลืมชาร์จเครื่องรูดบัตร',
  'บดเมล็ดก่อนเปิดร้านสิบนาที',
  'ล้างหัวชงให้สะอาด โชคจะไหลลื่น',
]
const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length]

/**
 * A fortune for tomorrow. Every number is real: `branches` are next-day forecasts with their
 * backtest band, `menus` are the class-A menus. Only the wording is random.
 * @param branches [{ branch, forecast, band }]
 * @param menus    menu names, best seller first
 * @param date     the day being foretold, YYYY-MM-DD
 */
export function fortune({ branches, menus, date, rng = Math.random }) {
  if (!branches.length) throw new Error('ไม่มีผลพยากรณ์ให้ดูดวง')
  const b = pick(branches, rng)
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]
  return {
    branch: b.branch,
    date,
    weekday,
    forecast: b.forecast,
    low: b.forecast * (1 - b.band),
    high: b.forecast * (1 + b.band),
    band: b.band,
    menu: menus.length ? pick(menus.slice(0, 5), rng) : null,
    lucky: Math.floor(rng() * 100),
    omen: pick(OMENS, rng),
    advice: pick(ADVICE, rng),
  }
}

/**
 * "Richter" magnitude for an anomaly: grows with the log of how far the day was from normal,
 * so −97% and +350% both feel big without the scale exploding. 0% → 4.0, capped at 9.9.
 */
export function richter(change) {
  return Math.min(9.9, 4 + 2.5 * Math.log2(1 + Math.abs(change)))
}

/** Shake amplitude in px for a magnitude: barely moves at 4, about 16px at 9.9. */
export function shakePx(magnitude) {
  return Math.round(Math.max(2, (magnitude - 4) * 2.7))
}

/** How many ghosts to release for a group of lost customers (one ghost ≈ a slice of them). */
export function ghostCount(customers) {
  return Math.max(5, Math.min(12, Math.round(customers / 50)))
}

/** Customers "won back" after catching `caught` of `ghosts`; the last ghost brings the rest. */
export function wonBack(caught, ghosts, customers) {
  return caught >= ghosts ? customers : Math.round((caught * customers) / ghosts)
}
