// Fixed-date Thai holidays and festivals, used as hints for unusual sales days ("may be related to…").
// Moving festivals (Chinese New Year, Loy Krathong) are listed for the years in the data only.

const EVERY_YEAR = {
  '01-01': 'วันขึ้นปีใหม่',
  '02-14': 'วันวาเลนไทน์',
  '04-13': 'สงกรานต์',
  '04-14': 'สงกรานต์',
  '04-15': 'สงกรานต์',
  '05-01': 'วันแรงงาน',
  '07-28': 'วันเฉลิมพระชนมพรรษา ร.10',
  '08-12': 'วันแม่',
  '10-13': 'วันนวมินทรมหาราช',
  '10-23': 'วันปิยมหาราช',
  '10-31': 'ฮาโลวีน',
  '12-05': 'วันพ่อ',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-25': 'คริสต์มาส',
  '12-31': 'วันสิ้นปี',
}

const BY_DATE = {
  '2025-11-05': 'ลอยกระทง',
  '2026-02-17': 'ตรุษจีน',
  '2026-02-18': 'หลังตรุษจีน',
}

/** Festival on this date or the day before ("หลังวันแม่"), or null. */
export function eventNear(date) {
  if (BY_DATE[date]) return BY_DATE[date]
  if (EVERY_YEAR[date.slice(5)]) return EVERY_YEAR[date.slice(5)]
  const before = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10)
  const prev = BY_DATE[before] ?? EVERY_YEAR[before.slice(5)]
  return prev ? `หลัง${prev}` : null
}
