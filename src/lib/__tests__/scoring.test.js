import { describe, it, expect } from 'vitest'
import {
  scoreHour,
  windScore,
  gustScore,
  precipScore,
  tempScore,
  labelFor,
  limiterFor,
} from '../scoring.js'

// Helper: a benign baseline daytime hour we mutate per-test.
const hour = (over = {}) => ({
  time: '2026-05-30T14:00',
  windSpeed: 16,
  gust: 18,
  precip: 0,
  precipProb: 0,
  temp: 70,
  isDay: true,
  ...over,
})

describe('windScore', () => {
  it('dead calm scores 0', () => expect(windScore(2)).toBe(0))
  it('reliable band (14–20) scores 100', () => {
    expect(windScore(14)).toBe(100)
    expect(windScore(17)).toBe(100)
    expect(windScore(20)).toBe(100)
  })
  it('just-flyable wind reads only Marginal, not full marks', () => {
    expect(windScore(9)).toBe(40) // flyable floor = Marginal band minimum
    expect(windScore(8)).toBeGreaterThan(0)
    expect(windScore(8)).toBeLessThan(40)
  })
  it('light-but-present wind earns partial credit, never 100', () => {
    expect(windScore(11)).toBeGreaterThan(55) // ~64 — flyable, not prime
    expect(windScore(11)).toBeLessThan(75)
  })
  it('ramps up below the reliable band', () => {
    expect(windScore(4)).toBe(0)
    expect(windScore(13)).toBeGreaterThan(80)
    expect(windScore(13)).toBeLessThan(100)
  })
  it('ramps down to 0 between ideal and blow-out', () => {
    expect(windScore(24)).toBeLessThan(100)
    expect(windScore(24)).toBeGreaterThan(0)
  })
  it('too strong scores 0', () => expect(windScore(28)).toBe(0))
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

describe('limiterFor (via scoreHour.limiter)', () => {
  const lim = (over) => scoreHour(hour(over)).limiter

  it('light-but-flyable wind → "Wind a touch light"', () => {
    expect(lim({ windSpeed: 11, gust: 13 })).toBe('Wind a touch light')
  })
  it('clean reliable wind → no caveat', () => {
    expect(lim({ windSpeed: 16, gust: 18, temp: 70, precipProb: 0 })).toBeNull()
  })
  it('dead calm → "Wind too calm"', () => {
    expect(lim({ windSpeed: 1, gust: 2 })).toBe('Wind too calm')
  })
  it('gale → "Wind too strong"', () => {
    expect(lim({ windSpeed: 30, gust: 38 })).toBe('Wind too strong')
  })
  it('turbulent air → "Too gusty"', () => {
    expect(lim({ windSpeed: 11, gust: 21 })).toBe('Too gusty') // GF 1.9, gated
  })
  it('rain → "Rain likely"', () => {
    expect(lim({ windSpeed: 16, gust: 18, precip: 1.2, precipProb: 80 })).toBe('Rain likely')
  })
  it('borderline-gusty (ungated) → "A bit gusty"', () => {
    expect(lim({ windSpeed: 14, gust: 22 })).toBe('A bit gusty') // GF 1.57, not gated
  })
  it('is null-safe and pure for an already-scored result', () => {
    const h = hour({ windSpeed: 16, gust: 18 })
    expect(limiterFor(h, scoreHour(h))).toBeNull()
  })
})

describe('scoreHour — known fixtures', () => {
  it('16 mph steady dry → Excellent', () => {
    const r = scoreHour(hour({ windSpeed: 16, gust: 18, precip: 0, precipProb: 0, temp: 72 }))
    expect(r.label).toBe('Excellent')
    expect(r.score).toBeGreaterThanOrEqual(80)
  })
  it('light-but-clear day reads Good, not a lying Excellent', () => {
    // Regression: 11 mph steady, smooth, dry, mild used to score 100 because
    // gust+precip+temp maxed and wind was only 45% of the sum. Wind is now the
    // ceiling, so the headline tracks the actual flyability.
    const r = scoreHour(hour({ windSpeed: 11, gust: 13, precip: 0, precipProb: 0, temp: 72 }))
    expect(r.label).toBe('Good')
    expect(r.score).toBeLessThan(80)
    expect(r.score).toBe(Math.round(r.parts.wind)) // capped by wind, not inflated by the calm day
  })
  it('a wind-capped score is still an integer', () => {
    // 11.4 mph gives a fractional windScore; the ceiling must not leak the float.
    const r = scoreHour(hour({ windSpeed: 11.4, gust: 11.4, precip: 0, precipProb: 0, temp: 77 }))
    expect(Number.isInteger(r.score)).toBe(true)
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
  it('steady reliable wind → Excellent, ungated', () => {
    const r = scoreHour(hour({ windSpeed: 16, gust: 19 })) // spread 3, GF 1.19
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
