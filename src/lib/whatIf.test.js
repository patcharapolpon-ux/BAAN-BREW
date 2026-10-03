import { describe, expect, it } from 'vitest'
import { WHAT_IF, whatIf, whatIfFacts } from './metrics.js'

// Two branches, two days. Monday 2026-01-05 and Tuesday 2026-01-06 (Thai time).
const row = (datetime, branch, qty, unit_price) => ({ order_id: datetime + branch, datetime, branch, product_id: 'P1', qty: String(qty), unit_price: String(unit_price) })
const rows = [
  row('2026-01-05T09:00:00+07:00', 'สยาม', 2, 100), // 200, Monday 09:00
  row('2026-01-05T20:30:00+07:00', 'สีลม', 1, 100), // 100, Monday 20:00 (last hour)
  row('2026-01-06T10:00:00+07:00', 'สยาม', 3, 100), // 300, Tuesday
]
const info = [
  { branch: 'สยาม', branch_type: 'ห้าง' },
  { branch: 'สีลม', branch_type: 'ออฟฟิศ' },
]
const facts = whatIfFacts(rows, info)

describe('whatIfFacts', () => {
  it('sums the year by weekday and finds the last trading hour', () => {
    expect(facts.base).toBe(600)
    expect(facts.byWeekday[1]).toBe(300) // Monday
    expect(facts.byWeekday[2]).toBe(300) // Tuesday
    expect(facts.lastHour).toBe(20)
    expect(facts.lastHourSales).toBe(100)
  })

  it('averages sales per open day for each branch type', () => {
    expect(facts.perDayByType['ห้าง']).toEqual({ perDay: 250, peers: ['สยาม'] }) // 500 over 2 days
  })
})

describe('whatIf', () => {
  it('changes nothing when nothing changes', () => {
    expect(whatIf(facts, {}).total).toBe(600)
  })

  it('price +10% with elasticity −1 keeps revenue flat (cups fall exactly as much as price rises)', () => {
    const r = whatIf(facts, { priceChange: 0.1, elasticity: -1 })
    expect(r.total).toBeCloseTo(600)
    expect(r.cupsChange).toBeCloseTo(1.1 ** -1 - 1)
  })

  it('price +10% with no reaction at all is +10% revenue', () => {
    expect(whatIf(facts, { priceChange: 0.1, elasticity: 0 }).change).toBeCloseTo(0.1)
  })

  it('closing Monday loses Monday, minus the customers who come another day', () => {
    expect(whatIf(facts, { closedWeekday: 1, shiftShare: 0.5 }).total).toBe(600 - 150)
  })

  it('an extra hour adds a share of the current last hour', () => {
    expect(whatIf(facts, { extraHour: true }).total).toBe(600 + 100 * WHAT_IF.EXTRA_HOUR_SHARE)
  })

  it('a new branch sells like its type, ramped and minus cannibalised sales', () => {
    const r = whatIf(facts, { newBranchType: 'ห้าง', cannibal: 0.2 })
    expect(r.steps.find((s) => s.key === 'newBranch').value).toBeCloseTo(250 * 365 * WHAT_IF.NEW_BRANCH_RAMP * 0.8)
  })
})
