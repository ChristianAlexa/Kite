import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  haversineMi,
  observationToHour,
  fetchNearestStations,
  fetchStationObservation,
} from '../station.js'
import { scoreHour } from '../scoring.js'

// Minimal Response stub for stubbed fetch.
const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status) => ({ ok: false, status, json: async () => ({}) })

afterEach(() => vi.unstubAllGlobals())

describe('haversineMi', () => {
  it('is ~0 for the same point', () => {
    expect(haversineMi(39.04, -77.49, 39.04, -77.49)).toBeCloseTo(0, 5)
  })
  it('Ashburn → KJYO (Leesburg) is a few miles', () => {
    const d = haversineMi(39.0438, -77.4874, 39.08333, -77.56667)
    expect(d).toBeGreaterThan(2)
    expect(d).toBeLessThan(8)
  })
})

describe('observationToHour', () => {
  it('shapes an observation into a scoreHour-ready hour', () => {
    const obs = { time: 't', windSpeed: 11.5, gust: 14, windDir: 140, temp: 77, precip: 0 }
    expect(observationToHour(obs, true)).toEqual({
      time: 't',
      windSpeed: 11.5,
      gust: 14,
      windDir: 140,
      precip: 0,
      precipProb: 0, // meaningless for an observation
      temp: 77,
      isDay: true,
    })
  })
  it('produces an hour scoreHour rates sanely — 11.5 mph steady → Good', () => {
    const obs = { time: 't', windSpeed: 11.5, gust: 13, windDir: 140, temp: 72, precip: 0 }
    const { label } = scoreHour(observationToHour(obs, true))
    expect(label).toBe('Good') // matches the wind-as-ceiling model
  })
})

describe('fetchNearestStations', () => {
  const points = {
    properties: { observationStations: 'https://api.weather.gov/gridpoints/LWX/80,76/stations' },
  }
  const stationList = {
    features: [
      {
        properties: { stationIdentifier: 'KJYO', name: 'Leesburg / Godfrey' },
        geometry: { coordinates: [-77.56667, 39.08333] },
      },
      {
        properties: { stationIdentifier: 'KIAD', name: 'Washington Dulles Intl' },
        geometry: { coordinates: [-77.4473, 38.9348] },
      },
    ],
  }

  it('resolves nearest-first stations with display distance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => Promise.resolve(ok(url.includes('/points/') ? points : stationList)))
    )
    const list = await fetchNearestStations(39.0438, -77.4874)
    expect(list[0].id).toBe('KJYO')
    expect(list[0].name).toBe('Leesburg / Godfrey')
    expect(list[0].distanceMi).toBeGreaterThan(0)
    expect(list).toHaveLength(2)
  })

  it('throws when the points lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fail(404))))
    await expect(fetchNearestStations(0, 0)).rejects.toThrow(/Station lookup failed/)
  })
})

describe('fetchStationObservation', () => {
  const obsBody = (over = {}) => ({
    properties: {
      timestamp: '2026-06-08T18:50:00+00:00',
      windSpeed: { value: 18.504 }, // km/h → ~11.5 mph
      windGust: { value: null }, // calm — no gust reported
      windDirection: { value: 140 },
      temperature: { value: 25 }, // °C → 77 °F
      precipitationLastHour: { value: null },
      textDescription: 'Mostly Cloudy',
      ...over,
    },
  })

  it('converts km/h→mph, °C→°F and reads direction', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(obsBody()))))
    const o = await fetchStationObservation('KJYO')
    expect(o.windSpeed).toBeCloseTo(11.5, 1)
    expect(o.windDir).toBe(140)
    expect(o.temp).toBeCloseTo(77, 1)
    expect(o.text).toBe('Mostly Cloudy')
  })

  it('falls back to windSpeed when gust is null (calm)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(ok(obsBody()))))
    const o = await fetchStationObservation('KJYO')
    expect(o.gust).toBeCloseTo(o.windSpeed, 5)
  })

  it('uses a real reported gust when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok(obsBody({ windGust: { value: 40 } }))))
    )
    const o = await fetchStationObservation('KJYO')
    expect(o.gust).toBeCloseTo(40 * 0.621371, 1)
  })

  it('throws on a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(fail(503))))
    await expect(fetchStationObservation('KJYO')).rejects.toThrow(/Observation failed/)
  })
})
