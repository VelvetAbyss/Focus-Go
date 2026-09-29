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
          is_day: 0,
          apparent_temperature: 29.1,
          relative_humidity_2m: 78,
          wind_speed_10m: 12.4,
        },
        daily: {
          time: ['2026-05-25', '2026-05-26', '2026-05-27'],
          weather_code: [81, 81, 3],
          temperature_2m_max: [33.3, 31.4, 30.2],
          temperature_2m_min: [24.1, 25.4, 24.5],
          sunrise: ['2026-05-25T05:01', '2026-05-26T05:00', '2026-05-27T05:00'],
          sunset: ['2026-05-25T18:48', '2026-05-26T18:49', '2026-05-27T18:49'],
          precipitation_probability_max: [80, 65, null],
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
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset'),
      expect.any(Object),
    )
    expect(forecast.current).toMatchObject({
      weatherCode: 3,
      condition: 'Overcast',
      temperature: 27.3,
      isDay: false,
      apparentTemperature: 29.1,
      humidity: 78,
      windSpeed: 12.4,
    })
    expect(forecast.days[0]).toMatchObject({
      weatherCode: 81,
      condition: 'Heavy showers',
      tempMax: 33.3,
      tempMin: 24.1,
      sunrise: '2026-05-25T05:01',
      sunset: '2026-05-25T18:48',
      precipitationProbability: 80,
    })
    expect(forecast.days[2].precipitationProbability).toBeUndefined()
  })
})
