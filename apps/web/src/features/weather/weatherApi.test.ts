import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchThreeDayForecast } from './weatherApi'

describe('fetchThreeDayForecast', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps current conditions separate from daily forecast conditions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          time: '2026-05-25T19:00',
          temperature_2m: 27.3,
          weather_code: 3,
        },
        daily: {
          time: ['2026-05-25', '2026-05-26', '2026-05-27'],
          weather_code: [81, 81, 3],
          temperature_2m_max: [33.3, 31.4, 30.2],
          temperature_2m_min: [24.1, 25.4, 24.5],
        },
      }),
    } as Response)

    const forecast = await fetchThreeDayForecast(
      { name: 'Hangzhou, China', latitude: 30.2936, longitude: 120.1614 },
      'celsius',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('current=temperature_2m,weather_code'),
      expect.any(Object),
    )
    expect(forecast.current).toMatchObject({
      weatherCode: 3,
      condition: 'Overcast',
      temperature: 27.3,
    })
    expect(forecast.days[0]).toMatchObject({
      weatherCode: 81,
      condition: 'Heavy showers',
      tempMax: 33.3,
      tempMin: 24.1,
    })
  })
})
