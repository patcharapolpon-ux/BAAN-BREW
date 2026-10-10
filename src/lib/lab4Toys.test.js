import { describe, expect, it } from 'vitest'
import { fortune, ghostCount, richter, shakePx, wonBack } from './lab4Toys'

const branches = [
  { branch: 'สยาม', forecast: 12000, band: 0.15 },
  { branch: 'สีลม', forecast: 9000, band: 0.2 },
]

describe('fortune', () => {
  it('uses the picked branch forecast and band for the range', () => {
    const f = fortune({ branches, menus: ['ลาเต้เย็น'], date: '2026-10-05', rng: () => 0 })
    expect(f.branch).toBe('สยาม')
    expect(f.forecast).toBe(12000)
    expect(f.low).toBeCloseTo(10200)
    expect(f.high).toBeCloseTo(13800)
    expect(f.menu).toBe('ลาเต้เย็น')
  })

  it('names the Thai weekday of the foretold date', () => {
    expect(fortune({ branches, menus: [], date: '2026-10-05', rng: () => 0 }).weekday).toBe('จันทร์')
  })

  it('never indexes past the list even when rng returns 1', () => {
    const f = fortune({ branches, menus: ['a', 'b'], date: '2026-10-05', rng: () => 0.9999999 })
    expect(f.branch).toBe('สีลม')
    expect(f.lucky).toBe(99)
  })

  it('throws when there is nothing to foretell', () => {
    expect(() => fortune({ branches: [], menus: [], date: '2026-10-05' })).toThrow()
  })
})

describe('richter / shake', () => {
  it('is 4.0 for a normal day and grows with the size of the change either way', () => {
    expect(richter(0)).toBe(4)
    expect(richter(-0.97)).toBeGreaterThan(6)
    expect(richter(3.5)).toBeGreaterThan(richter(1))
  })
  it('caps at 9.9', () => {
    expect(richter(1000)).toBe(9.9)
  })
  it('shakes at least 2px and more for bigger quakes', () => {
    expect(shakePx(4)).toBe(2)
    expect(shakePx(9.9)).toBeGreaterThan(shakePx(7))
  })
})

describe('ghost hunt', () => {
  it('releases between 5 and 12 ghosts', () => {
    expect(ghostCount(10)).toBe(5)
    expect(ghostCount(488)).toBe(10)
    expect(ghostCount(5000)).toBe(12)
  })
  it('counts customers won back, the last ghost bringing the remainder', () => {
    expect(wonBack(0, 10, 488)).toBe(0)
    expect(wonBack(5, 10, 488)).toBe(244)
    expect(wonBack(10, 10, 488)).toBe(488)
  })
})
