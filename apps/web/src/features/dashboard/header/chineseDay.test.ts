import { describe, expect, it } from 'vitest'
import { lunarDateLabel, lunarFestivalOn, solarTermOn } from './chineseDay'

const on = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)

describe('chineseDay', () => {
  it('labels the lunar day', () => {
    expect(lunarDateLabel(on(2026, 9, 28))).toBe('八月十八')
    expect(lunarDateLabel(on(2026, 2, 17))).toBe('正月初一')
  })

  it('finds the traditional festivals, including New Year’s Eve', () => {
    expect(lunarFestivalOn(on(2026, 9, 25))).toBe('中秋节')
    expect(lunarFestivalOn(on(2026, 2, 17))).toBe('春节')
    expect(lunarFestivalOn(on(2026, 2, 16))).toBe('除夕')
    expect(lunarFestivalOn(on(2026, 9, 28))).toBeNull()
  })

  it('dates solar terms by Beijing time', () => {
    expect(solarTermOn(on(2024, 2, 4))).toBe('立春')
    expect(solarTermOn(on(2024, 9, 22))).toBe('秋分')
    expect(solarTermOn(on(2024, 12, 21))).toBe('冬至')
    expect(solarTermOn(on(2025, 4, 4))).toBe('清明')
    expect(solarTermOn(on(2025, 6, 21))).toBe('夏至')
  })

  it('returns nothing on ordinary days', () => {
    expect(solarTermOn(on(2026, 9, 28))).toBeNull()
    expect(solarTermOn(on(2024, 12, 20))).toBeNull()
    expect(solarTermOn(on(2024, 12, 22))).toBeNull()
  })
})
