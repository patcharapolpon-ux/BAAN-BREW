import { describe, expect, it } from 'vitest'
import { storyFacts, thaiBahtText } from './metrics.js'

describe('thaiBahtText', () => {
  it.each([
    [0, 'ศูนย์บาทถ้วน'],
    [1, 'หนึ่งบาทถ้วน'],
    [11, 'สิบเอ็ดบาทถ้วน'],
    [21, 'ยี่สิบเอ็ดบาทถ้วน'],
    [101, 'หนึ่งร้อยเอ็ดบาทถ้วน'],
    [128.39, 'หนึ่งร้อยยี่สิบแปดบาทสามสิบเก้าสตางค์'],
    [0.5, 'ห้าสิบสตางค์'],
    [1000000, 'หนึ่งล้านบาทถ้วน'],
    [11000000, 'สิบเอ็ดล้านบาทถ้วน'],
    [4463443, 'สี่ล้านสี่แสนหกหมื่นสามพันสี่ร้อยสี่สิบสามบาทถ้วน'],
  ])('%s → %s', (value, text) => {
    expect(thaiBahtText(value)).toBe(text)
  })
})

describe('storyFacts', () => {
  const row = (order_id, datetime, branch, product_id, qty, unit_price) => ({ order_id, datetime, branch, product_id, qty, unit_price, payment_method: 'เงินสด' })
  const rows = [
    row('A', '2025-04-01T09:00:00+07:00', 'สยาม', 'P1', '2', '50'),
    row('A', '2025-04-01T09:00:00+07:00', 'สยาม', 'P2', '1', '200'),
    row('B', '2025-04-02T10:00:00+07:00', 'สีลม', 'P1', '1', '50'),
  ]
  const facts = storyFacts(rows, [{ product_id: 'P1', product_name: 'ลาเต้' }])

  it('counts cups and finds the biggest bill', () => {
    expect(facts.cups).toBe(4)
    expect(facts.biggestBill).toMatchObject({ order_id: 'A', total: 300, items: 3, branch: 'สยาม' })
  })

  it('finds the best day, top menu and top branch', () => {
    expect(facts.bestDay).toEqual({ date: '2025-04-01', sales: 300 })
    expect(facts.topMenu[0]).toMatchObject({ name: 'ลาเต้', qty: 3 })
    expect(facts.branches[0].branch).toBe('สยาม')
    expect(facts.first).toBe('2025-04-01')
    expect(facts.last).toBe('2025-04-02')
  })
})
