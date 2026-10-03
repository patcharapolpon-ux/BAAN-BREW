import { describe, expect, it } from 'vitest'
import { formatPercent } from './metrics.js'
import { buildPaper } from './newspaper.js'

const row = (date, sales) => ({ order_id: date, datetime: `${date}T10:00:00+07:00`, branch: 'สยาม', product_id: 'P1', qty: '1', unit_price: String(sales), payment_method: 'เงินสด' })
const rows = [row('2026-01-01', 1234), row('2026-01-16', 5678), row('2026-01-20', 9999)]
const products = [{ product_id: 'P1', product_name: 'ลาเต้เย็น', category: 'กาแฟ' }]
const lottery = {
  source: 'test',
  draws: [
    { date: '2026-01-01', first: '111111', last2: '34', last3f: [], last3b: [], near1: [] },
    { date: '2026-01-16', first: '222222', last2: '00', last3f: [], last3b: [], near1: [] },
  ],
}

describe('buildPaper back issues', () => {
  it('defaults to the latest draw', () => {
    expect(buildPaper(rows, products, lottery).lotto.latest.first).toBe('222222')
  })

  it('an old issue only knows sales up to its own date', () => {
    const paper = buildPaper(rows, products, lottery, '2026-01-01')
    expect(paper.date).toBe('2026-01-01')
    expect(paper.issue).toBe(1)
    expect(paper.stats[0][1]).toBe('฿1,234') // not the later days
  })

  it('"wins" when the draw day\'s sales end in the winning two digits', () => {
    const paper = buildPaper(rows, products, lottery, '2026-01-01')
    expect(paper.lotto).toMatchObject({ tail: '34', hit: true, isDrawDay: true })
    expect(buildPaper(rows, products, lottery, '2026-01-16').lotto).toMatchObject({ tail: '78', hit: false })
  })

  it('still prints without lottery data', () => {
    const paper = buildPaper(rows, products, null)
    expect(paper.lotto).toBeNull()
    expect(paper.headline.title).toBeTruthy()
  })
})

describe('formatPercent', () => {
  it('never shows "-0.0%"', () => {
    expect(formatPercent(-0.0004, 1)).toBe('0.0%')
    expect(formatPercent(-0.004, 0)).toBe('0%')
    expect(formatPercent(-0.05, 1)).toBe('-5.0%')
  })
})
