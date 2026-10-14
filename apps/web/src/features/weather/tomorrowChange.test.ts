import { describe, expect, it } from 'vitest'
import type { WeatherDay } from './weatherApi'
import { tomorrowChange } from './tomorrowChange'

const day = (tempMax: number, precipitationProbability?: number): WeatherDay => ({
  date: '2026-10-10', weatherCode: 0, condition: 'clear', tempMax, tempMin: tempMax - 8, precipitationProbability,
})

describe('tomorrowChange', () => {
  it('says nothing about an ordinary tomorrow', () => {
    expect(tomorrowChange([day(27, 10), day(24, 30)])).toBeNull()
  })

  it('notes a drop or rise of 6°C or more', () => {
    expect(tomorrowChange([day(27), day(19)])).toEqual({ delta: -8, rain: false })
    expect(tomorrowChange([day(12), day(18.4)])).toEqual({ delta: 6, rain: false })
  })

  it('uses a 10° step in Fahrenheit', () => {
    expect(tomorrowChange([day(80), day(72)], 'fahrenheit')).toBeNull()
    expect(tomorrowChange([day(80), day(68)], 'fahrenheit')).toEqual({ delta: -12, rain: false })
  })

  it('notes likely rain, alone or with a swing', () => {
    expect(tomorrowChange([day(27, 0), day(26, 70)])).toEqual({ delta: 0, rain: true })
    expect(tomorrowChange([day(27, 0), day(18, 80)])).toEqual({ delta: -9, rain: true })
  })

  it('needs both days', () => {
    expect(tomorrowChange([day(27)])).toBeNull()
  })
})
