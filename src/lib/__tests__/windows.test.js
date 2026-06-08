import { describe, it, expect } from 'vitest'
import {
  scoreHours,
  detectWindows,
  rankWindows,
  nextGreatWindow,
  clipWindowToNow,
  formatWindowHeadline,
  formatRange,
  bestDaytimeHour,
} from '../windows.js'

// Build a normalized hour at a given local ISO time with chosen quality.
const at = (iso, over = {}) => ({
  time: iso,
  windSpeed: 16,
  gust: 18,
  precip: 0,
  precipProb: 0,
  temp: 70,
  isDay: true,
  ...over,
})

// A calm (Poor) hour to break runs.
const calm = (iso) => at(iso, { windSpeed: 1, gust: 2 })
// A night hour (not daytime).
const night = (iso) => at(iso, { isDay: false })

describe('detectWindows', () => {
  it('merges consecutive Good+ daytime hours into one window', () => {
    const hours = scoreHours([
      at('2026-06-02T15:00'),
      at('2026-06-02T16:00'),
      at('2026-06-02T17:00'),
    ])
    const w = detectWindows(hours)
    expect(w).toHaveLength(1)
    expect(w[0].hours).toHaveLength(3)
    // start 15:00, end = last hour start (17:00) + 1h = 18:00
    expect(w[0].start.getHours()).toBe(15)
    expect(w[0].end.getHours()).toBe(18)
  })

  it('a calm hour splits a run into two windows', () => {
    const hours = scoreHours([
      at('2026-06-02T10:00'),
      at('2026-06-02T11:00'),
      calm('2026-06-02T12:00'),
      at('2026-06-02T13:00'),
      at('2026-06-02T14:00'),
    ])
    const w = detectWindows(hours)
    expect(w).toHaveLength(2)
  })

  it('night hours break a run even if scoreable', () => {
    const hours = scoreHours([
      at('2026-06-02T19:00'),
      night('2026-06-02T20:00'),
      at('2026-06-02T21:00'),
    ])
    const w = detectWindows(hours)
    expect(w).toHaveLength(2)
  })

  it('ignores sub-60 daytime hours', () => {
    const hours = scoreHours([calm('2026-06-02T10:00'), calm('2026-06-02T11:00')])
    expect(detectWindows(hours)).toHaveLength(0)
  })
})

describe('rankWindows', () => {
  it('sorts by avgScore desc, tie-break earliest start', () => {
    const hours = scoreHours([
      // Window A — strong (Tue afternoon)
      at('2026-06-02T15:00'),
      at('2026-06-02T16:00'),
      calm('2026-06-02T17:00'),
      // Window B — weaker (Wed morning), windier-than-ideal so lower score
      at('2026-06-03T10:00', { windSpeed: 22, gust: 26 }),
      at('2026-06-03T11:00', { windSpeed: 22, gust: 26 }),
    ])
    const ranked = rankWindows(detectWindows(hours))
    expect(ranked[0].avgScore).toBeGreaterThanOrEqual(ranked[1].avgScore)
  })
})

describe('nextGreatWindow', () => {
  const before = new Date('2026-06-01T00:00') // a fixed "now" before all fixtures

  it('picks the earliest upcoming Good+ window, not the highest-scoring', () => {
    const hours = scoreHours([
      // Earlier, merely Good window (light, wind-capped)
      at('2026-06-02T09:00', { windSpeed: 11, gust: 13 }),
      at('2026-06-02T10:00', { windSpeed: 11, gust: 13 }),
      calm('2026-06-02T11:00'),
      // Later, Excellent window
      at('2026-06-04T15:00'),
      at('2026-06-04T16:00'),
    ])
    const next = nextGreatWindow(detectWindows(hours), before)
    expect(next.start.getDate()).toBe(2) // earlier one wins
  })

  it('skips windows that have already ended relative to now', () => {
    const hours = scoreHours([
      // Morning window — already over by evening
      at('2026-06-02T08:00'),
      at('2026-06-02T09:00'),
      calm('2026-06-02T12:00'),
      // Afternoon window — still ahead
      at('2026-06-02T16:00'),
      at('2026-06-02T17:00'),
    ])
    const windows = detectWindows(hours)
    const now = new Date('2026-06-02T12:00') // noon — past the morning slot (ended 10 AM)
    const next = nextGreatWindow(windows, now)
    expect(next).not.toBeNull()
    expect(next.start.getHours()).toBe(16) // afternoon, not 8 AM
  })

  it('still surfaces a window that is in progress right now', () => {
    const hours = scoreHours([at('2026-06-02T16:00'), at('2026-06-02T17:00')])
    const windows = detectWindows(hours)
    const now = new Date('2026-06-02T16:30') // mid-window
    expect(nextGreatWindow(windows, now).start.getHours()).toBe(16)
  })

  it('returns null when no upcoming Good+ window exists', () => {
    const hours = scoreHours([calm('2026-06-02T10:00')])
    expect(nextGreatWindow(detectWindows(hours), before)).toBeNull()
  })
})

describe('clipWindowToNow', () => {
  const w = {
    start: new Date('2026-06-02T11:00'),
    end: new Date('2026-06-02T20:00'),
    label: 'Good',
  }

  it('clips an in-progress window start to the top of the current hour', () => {
    const clipped = clipWindowToNow(w, new Date('2026-06-02T18:29'))
    expect(clipped.start.getHours()).toBe(18)
    expect(clipped.start.getMinutes()).toBe(0)
    expect(clipped.end).toBe(w.end) // end untouched
  })

  it('leaves a fully-future window unchanged', () => {
    const clipped = clipWindowToNow(w, new Date('2026-06-02T09:00'))
    expect(clipped).toBe(w)
  })

  it('passes through null', () => {
    expect(clipWindowToNow(null, new Date())).toBeNull()
  })
})

describe('bestDaytimeHour', () => {
  it('returns the highest-scoring daytime hour', () => {
    const hours = scoreHours([
      calm('2026-06-02T09:00'),
      at('2026-06-02T12:00', { windSpeed: 11, gust: 13 }), // Good (light, wind-capped)
      at('2026-06-02T15:00'), // Excellent (16 mph steady)
    ])
    expect(bestDaytimeHour(hours).time).toBe('2026-06-02T15:00')
  })

  it('ignores night hours', () => {
    const hours = scoreHours([night('2026-06-02T20:00'), calm('2026-06-02T10:00')])
    expect(bestDaytimeHour(hours).time).toBe('2026-06-02T10:00')
  })

  it('returns null when there are no daytime hours', () => {
    expect(bestDaytimeHour(scoreHours([night('2026-06-02T20:00')]))).toBeNull()
  })
})

describe('formatRange / headline', () => {
  it('formats same-meridiem range compactly', () => {
    const start = new Date('2026-06-02T15:00')
    const end = new Date('2026-06-02T18:00')
    expect(formatRange(start, end)).toBe('Tuesday 6/02 3–6 PM')
  })

  it('formats cross-meridiem range with both meridiems', () => {
    const start = new Date('2026-06-03T10:00')
    const end = new Date('2026-06-03T13:00')
    expect(formatRange(start, end)).toBe('Wednesday 6/03 10 AM–1 PM')
  })

  it('builds the full headline sentence', () => {
    const hours = scoreHours([
      at('2026-06-02T15:00'),
      at('2026-06-02T16:00'),
      at('2026-06-02T17:00'),
    ])
    const next = nextGreatWindow(detectWindows(hours), new Date('2026-06-01T00:00'))
    expect(formatWindowHeadline(next)).toBe('Excellent conditions Tuesday 6/02 3–6 PM')
  })
})
