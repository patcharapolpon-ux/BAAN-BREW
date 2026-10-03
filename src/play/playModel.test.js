import { describe, expect, it } from 'vitest'
import { activePeers, BOT_CAP, feed, hungerAfter, makePlayOrder, pugLevel, pugMood, raceStandings } from './playModel.js'

const PRODUCTS = [
  { product_name: 'ลาเต้เย็น', price: '75' },
  { product_name: 'อเมริกาโน่ร้อน', price: '55' },
]

describe('makePlayOrder', () => {
  it('builds an order whose revenue is price × qty', () => {
    const order = makePlayOrder(PRODUCTS, { day: '2026-10-03', uid: 'u1', name: 'Net', bot: true, rand: () => 0.1 })
    expect(order.product_name).toBe('ลาเต้เย็น')
    expect(order.revenue).toBe(75 * order.qty)
    expect(order).toMatchObject({ day: '2026-10-03', created_by: 'u1', by_name: 'Net', bot: true })
  })

  it('always picks a real branch and qty 1–3', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) {
      const o = makePlayOrder(PRODUCTS, { day: 'd', uid: 'u', name: 'n', bot: true, rand })
      expect(['สยาม', 'สีลม', 'อารีย์', 'บางนา', 'มหาวิทยาลัย']).toContain(o.branch)
      expect(o.qty).toBeGreaterThanOrEqual(1)
      expect(o.qty).toBeLessThanOrEqual(3)
    }
  })
})

describe('raceStandings', () => {
  it('lists all 5 branches even with no orders', () => {
    expect(raceStandings([])).toHaveLength(5)
  })

  it('sorts by revenue, highest first', () => {
    const rows = raceStandings([
      { branch: 'สีลม', revenue: 100 },
      { branch: 'อารีย์', revenue: 300 },
      { branch: 'สีลม', revenue: 150 },
    ])
    expect(rows[0]).toMatchObject({ branch: 'อารีย์', revenue: 300, orders: 1 })
    expect(rows[1]).toMatchObject({ branch: 'สีลม', revenue: 250, orders: 2 })
  })
})

describe('pug hunger', () => {
  it('gets hungrier over time but never below 0', () => {
    expect(hungerAfter(50, 10)).toBeLessThan(50)
    expect(hungerAfter(5, 1000)).toBe(0)
  })

  it('is fed by orders but never above 100', () => {
    expect(feed(50, 75)).toBeGreaterThan(50)
    expect(feed(95, 10000)).toBe(100)
  })

  it('changes mood as it gets hungry', () => {
    expect(pugMood(90).key).toBe('happy')
    expect(pugMood(50).key).toBe('ok')
    expect(pugMood(20).key).toBe('hungry')
    expect(pugMood(0).key).toBe('sulk')
  })

  it('levels up every ฿2,000', () => {
    expect(pugLevel(0)).toBe(1)
    expect(pugLevel(4100)).toBe(3)
  })
})

describe('activePeers', () => {
  it('drops myself and anyone silent for too long', () => {
    const now = 100000
    const peers = [
      { uid: 'me', updatedAt: now },
      { uid: 'a', updatedAt: now - 1000 },
      { uid: 'b', updatedAt: now - 60000 },
      { uid: 'c', updatedAt: null },
    ]
    expect(activePeers(peers, { now, selfUid: 'me' }).map((p) => p.uid)).toEqual(['a'])
  })
})

it('keeps a bot run well inside the free write quota', () => {
  expect(BOT_CAP).toBeLessThanOrEqual(500)
})
