import { describe, it, expect } from 'vitest'
import { scoreHour, windScore, gustScore, precipScore, tempScore, labelFor } from '../scoring.js'

// Helper: a benign baseline daytime hour we mutate per-test.
const hour = (over = {}) => ({
  time: '2026-05-30T14:00',
  windSpeed: 12,
  gust: 14,
  precip: 0,
  precipProb: 0,
  temp: 70,
  isDay: true,
  ...over,
})

describe('windScore', () => {
  it('dead calm scores 0', () => expect(windScore(2)).toBe(0))
  it('ideal band (8–16) scores 100', () => {
    expect(windScore(8)).toBe(100)
    expect(windScore(12)).toBe(100)
    expect(windScore(16)).toBe(100)
  })
  it('ramps up between dead and ideal', () => {
    expect(windScore(3)).toBe(0)
    expect(windScore(5.5)).toBeGreaterThan(40)
    expect(windScore(5.5)).toBeLessThan(60)
  })
  it('ramps down to floor between ideal and strong', () => {
    expect(windScore(25)).toBeCloseTo(40, 0)
    expect(windScore(20)).toBeLessThan(100)
    expect(windScore(20)).toBeGreaterThan(40)
  })
  it('too strong scores 0', () => expect(windScore(30)).toBe(0))
})

describe('gustScore', () => {
  it('steady wind (small spread) scores 100', () => expect(gustScore(12, 15)).toBe(100))
  it('gusty downgraded', () => {
    expect(gustScore(12, 20)).toBeLessThan(100)
    expect(gustScore(12, 20)).toBeGreaterThan(0)
  })
  it('very gusty scores 0', () => expect(gustScore(12, 26)).toBe(0))
  it('reads gust factor, not raw spread — same 10 mph spread scores by ratio', () => {
    // GF 1.9 (violent) vs GF 1.4 (fine), identical absolute spread.
    expect(gustScore(11, 21)).toBeLessThan(5)
    expect(gustScore(25, 35)).toBeGreaterThan(gustScore(11, 21) + 30)
  })
})

describe('precipScore', () => {
  it('dry, low prob scores 100', () => expect(precipScore(0, 10)).toBe(100))
  it('measurable rain scores 0', () => expect(precipScore(0.5, 10)).toBe(0))
  it('high prob scores 0', () => expect(precipScore(0, 60)).toBe(0))
  it('mid prob between', () => {
    expect(precipScore(0, 35)).toBeGreaterThan(0)
    expect(precipScore(0, 35)).toBeLessThan(100)
  })
})

describe('tempScore', () => {
  it('comfortable scores 100', () => expect(tempScore(70)).toBe(100))
  it('freezing scores 0', () => expect(tempScore(30)).toBe(0))
  it('scorching scores 0', () => expect(tempScore(100)).toBe(0))
})

describe('labelFor', () => {
  it('maps score to label band', () => {
    expect(labelFor(92)).toBe('Excellent')
    expect(labelFor(80)).toBe('Excellent')
    expect(labelFor(74)).toBe('Good')
    expect(labelFor(52)).toBe('Marginal')
    expect(labelFor(20)).toBe('Poor')
  })
})

describe('scoreHour — known fixtures', () => {
  it('12 mph steady dry → Excellent', () => {
    const r = scoreHour(hour({ windSpeed: 12, gust: 14, precip: 0, precipProb: 0, temp: 72 }))
    expect(r.label).toBe('Excellent')
    expect(r.score).toBeGreaterThanOrEqual(80)
  })
  it('dead calm → Poor', () => {
    const r = scoreHour(hour({ windSpeed: 1, gust: 2 }))
    expect(r.label).toBe('Poor')
    expect(r.score).toBeLessThan(40)
  })
  it('30 mph gale → Poor', () => {
    const r = scoreHour(hour({ windSpeed: 30, gust: 38 }))
    expect(r.label).toBe('Poor')
  })
  it('gusty steady-ideal wind gets downgraded vs steady', () => {
    const steady = scoreHour(hour({ windSpeed: 12, gust: 14 })).score
    const gusty = scoreHour(hour({ windSpeed: 12, gust: 24 })).score
    expect(gusty).toBeLessThan(steady)
  })
  it('rain tanks an otherwise great hour', () => {
    const r = scoreHour(hour({ windSpeed: 12, gust: 14, precip: 1.2, precipProb: 80 }))
    expect(r.score).toBeLessThan(80)
  })
  it('returns parts for all four sub-scores', () => {
    const r = scoreHour(hour())
    expect(Object.keys(r.parts).sort()).toEqual(['gust', 'precip', 'temp', 'wind'])
  })

  // Steady wind vs gusts — the reliability fix.
  it('steady ideal wind → Excellent, ungated', () => {
    const r = scoreHour(hour({ windSpeed: 12, gust: 15 })) // spread 3, GF 1.25
    expect(r.label).toBe('Excellent')
    expect(r.gated).toBe(false)
  })
  it('gusty-windy day (11 mph base, gusts to 21) → Poor, gated', () => {
    const r = scoreHour(hour({ windSpeed: 11, gust: 21 })) // GF 1.9 — turbulent
    expect(r.label).toBe('Poor')
    expect(r.gated).toBe(true)
  })
  it('borderline-gusty day caps at Good, never Excellent', () => {
    const r = scoreHour(hour({ windSpeed: 14, gust: 22 })) // GF 1.57 — gusty
    expect(r.label).toBe('Good')
    expect(r.score).toBeLessThan(80)
  })
  it('dangerous absolute gusts gate even with a flyable mean', () => {
    const r = scoreHour(hour({ windSpeed: 18, gust: 30 })) // GF 1.67 < turb, gust > 28
    expect(r.label).toBe('Poor')
    expect(r.gated).toBe(true)
  })
})
