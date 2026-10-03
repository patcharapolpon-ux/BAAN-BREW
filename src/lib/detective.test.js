import { describe, expect, it } from 'vitest'
import { describeBranches, describeDaily, expectedFor, findAnomalies, lotteryEffect, meanStd } from './metrics.js'
import { eventNear } from './thaiEvents.js'

// 10 weeks of days with a weekly rhythm (day i sells 100 + 10 × weekday) and small noise,
// plus one huge day at index 63.
const daily = Array.from({ length: 70 }, (_, i) => ({ date: `d${i}`, sales: 100 + (i % 7) * 10 + (i % 3) }))
daily[63].sales = 400

describe('meanStd', () => {
  it('matches the textbook example', () => {
    expect(meanStd([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ mean: 5, sd: 2 })
  })
})

describe('expectedFor', () => {
  it('uses the same weekday of the previous 8 weeks', () => {
    const sameWeekday = [56, 49, 42, 35, 28, 21, 14, 7].map((i) => daily[i].sales)
    const e = expectedFor(daily, 63)
    expect(e.n).toBe(8)
    expect(e.mean).toBeCloseTo(sameWeekday.reduce((a, b) => a + b, 0) / 8)
  })

  it('needs at least 4 weeks of history', () => {
    expect(expectedFor(daily, 20)).toBeNull()
  })
})

describe('findAnomalies', () => {
  it('finds the huge day as a spike and nothing else', () => {
    const found = findAnomalies(daily)
    expect(found.map((f) => f.date)).toEqual(['d63'])
    expect(found[0].kind).toBe('spike')
    expect(found[0].z).toBeGreaterThan(2.5)
  })

  it('does not flag the normal weekly rhythm (Friday vs Monday)', () => {
    const calm = daily.map((d, i) => ({ ...d, sales: i === 63 ? 100 + (63 % 7) * 10 : d.sales }))
    expect(findAnomalies(calm)).toEqual([])
  })
})

describe('lotteryEffect', () => {
  it('compares draw days with their normal weekday and ignores dates outside the data', () => {
    const effect = lotteryEffect(daily, ['d63', 'd999'])
    expect(effect.total).toBe(1)
    expect(effect.higher).toBe(1)
    expect(effect.averageLift).toBeGreaterThan(1)
  })
})

describe('eventNear', () => {
  it('knows fixed festivals, moving ones, and the day after', () => {
    expect(eventNear('2026-02-14')).toBe('วันวาเลนไทน์')
    expect(eventNear('2025-11-05')).toBe('ลอยกระทง')
    expect(eventNear('2026-08-13')).toBe('หลังวันแม่')
    expect(eventNear('2026-03-03')).toBeNull()
  })
})

describe('chart descriptions (screen readers)', () => {
  it('describes a daily series in words', () => {
    const text = describeDaily([
      { date: '2026-01-05', sales: 100 },
      { date: '2026-01-06', sales: 300 },
      { date: '2026-01-07', sales: 200 },
      { date: '2026-01-08', sales: 400 },
    ])
    expect(text).toContain('4 วัน')
    expect(text).toContain('เฉลี่ยวันละ ฿250')
    expect(text).toContain('สูงสุด ฿400')
    expect(text).toContain('ต่ำสุด ฿100')
    expect(text).toContain('สูงขึ้น 50.0%') // halves: 200 → 300
  })

  it('reads the branch ranking in order', () => {
    const text = describeBranches([
      { branch: 'สยาม', sales: 300, share: 0.6 },
      { branch: 'สีลม', sales: 200, share: 0.4 },
    ])
    expect(text).toContain('อันดับ 1 สยาม ฿300 (60.0%), อันดับ 2 สีลม')
  })
})
