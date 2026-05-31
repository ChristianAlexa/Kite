import { describe, it, expect } from 'vitest'
import { normalizeHourly } from '../weather.js'

// A trimmed Open-Meteo hourly payload (parallel arrays keyed by field).
const sample = {
  time: ['2026-05-30T14:00', '2026-05-30T15:00'],
  wind_speed_10m: [12, 18],
  wind_gusts_10m: [15, 24],
  wind_direction_10m: [270, 280],
  precipitation: [0, 0.4],
  precipitation_probability: [10, 60],
  temperature_2m: [70, 68],
  is_day: [1, 0],
}

describe('normalizeHourly', () => {
  it('zips parallel arrays into row objects', () => {
    const rows = normalizeHourly(sample)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      time: '2026-05-30T14:00',
      windSpeed: 12,
      gust: 15,
      windDir: 270,
      precip: 0,
      precipProb: 10,
      temp: 70,
      isDay: true,
    })
  })

  it('maps is_day 0 to isDay false', () => {
    expect(normalizeHourly(sample)[1].isDay).toBe(false)
  })

  it('returns [] for missing or malformed hourly (e.g. an error body)', () => {
    expect(normalizeHourly(undefined)).toEqual([])
    expect(normalizeHourly({})).toEqual([])
    expect(normalizeHourly({ reason: 'quota' })).toEqual([])
  })

  it('defaults missing per-field values to 0 rather than throwing', () => {
    const rows = normalizeHourly({ time: ['2026-05-30T14:00'] })
    expect(rows[0]).toMatchObject({ windSpeed: 0, gust: 0, precipProb: 0, temp: 0, isDay: false })
  })
})
