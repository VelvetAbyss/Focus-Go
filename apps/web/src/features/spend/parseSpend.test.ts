import { describe, expect, it } from 'vitest'
import { matchSpendCategory, parseSpendInput } from './parseSpend'

describe('parseSpendInput', () => {
  it('reads the amount on either side of the words', () => {
    expect(parseSpendInput('午饭 28')).toEqual({ amount: 28, currency: undefined, note: '午饭' })
    expect(parseSpendInput('35.5 打车')).toEqual({ amount: 35.5, currency: undefined, note: '打车' })
    expect(parseSpendInput('28')).toEqual({ amount: 28, currency: undefined, note: '' })
  })

  it('reads a currency mark', () => {
    expect(parseSpendInput('$12 coffee')).toEqual({ amount: 12, currency: 'USD', note: 'coffee' })
    expect(parseSpendInput('奶茶 ¥18')).toEqual({ amount: 18, currency: 'CNY', note: '奶茶' })
    expect(parseSpendInput('打车 30元')).toEqual({ amount: 30, currency: 'CNY', note: '打车' })
  })

  it('needs a positive amount', () => {
    expect(parseSpendInput('午饭')).toBeNull()
    expect(parseSpendInput('0')).toBeNull()
    expect(parseSpendInput('咖啡 -18')).toBeNull()
    expect(parseSpendInput('$−18 coffee')).toBeNull()
  })

  it('reads grouped amounts without silently truncating precision', () => {
    expect(parseSpendInput('房租 1,200.50')).toEqual({ amount: 1200.5, currency: undefined, note: '房租' })
    expect(parseSpendInput('coffee 4,50')).toEqual({ amount: 4.5, currency: undefined, note: 'coffee' })
    expect(parseSpendInput('咖啡 18.123')).toBeNull()
  })
})

describe('matchSpendCategory', () => {
  const categories = [
    { id: 'life', name: '生活' },
    { id: 'food', name: '餐饮' },
    { id: 'go', name: '交通' },
  ]

  it('prefers a category named outright, then one that fits the thing bought', () => {
    expect(matchSpendCategory('交通 补贴', categories)?.id).toBe('go')
    expect(matchSpendCategory('午饭', categories)?.id).toBe('food')
    expect(matchSpendCategory('滴滴', categories)?.id).toBe('go')
    expect(matchSpendCategory('超市', categories)?.id).toBe('life')
  })

  it('returns null when nothing fits', () => {
    expect(matchSpendCategory('', categories)).toBeNull()
    expect(matchSpendCategory('礼物', categories)).toBeNull()
  })
})
