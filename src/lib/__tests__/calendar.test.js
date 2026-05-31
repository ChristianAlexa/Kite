import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import { buildWeekGrid } from '../calendar.js'

// Helper: a scored daytime hour at a given ISO time.
const h = (time, over = {}) => ({ time, isDay: true, score: 80, label: 'Excellent', ...over })

describe('buildWeekGrid', () => {
  it('empty input → empty grid', () => {
    expect(buildWeekGrid([])).toEqual({ columns: [], rows: [], nowHour: null })
    expect(buildWeekGrid(null)).toEqual({ columns: [], rows: [], nowHour: null })
  })

  it('excludes night hours and spans columns min..max daylight hour', () => {
    const grid = buildWeekGrid([
      h('2026-06-01T03:00', { isDay: false }), // night, ignored
      h('2026-06-01T09:00'),
      h('2026-06-01T11:00'),
      h('2026-06-01T22:00', { isDay: false }), // night, ignored
    ])
    expect(grid.columns).toEqual([9, 10, 11]) // contiguous min..max
    expect(grid.rows).toHaveLength(1)
  })

  it('aligns two days to the same columns; missing hours become null cells', () => {
    const grid = buildWeekGrid([
      h('2026-06-01T09:00'),
      h('2026-06-01T10:00'),
      h('2026-06-02T10:00'), // day 2 has no 9:00 hour
    ])
    expect(grid.columns).toEqual([9, 10])
    expect(grid.rows).toHaveLength(2)

    const [day1, day2] = grid.rows
    expect(day1.cells.map((c) => (c ? c.time : null))).toEqual([
      '2026-06-01T09:00',
      '2026-06-01T10:00',
    ])
    // Day 2 is missing the 9:00 column → null in that slot.
    expect(day2.cells[0]).toBeNull()
    expect(day2.cells[1].time).toBe('2026-06-02T10:00')
  })

  it('sorts rows chronologically and labels them', () => {
    const grid = buildWeekGrid([h('2026-06-02T12:00'), h('2026-06-01T12:00')])
    expect(grid.rows.map((r) => r.sub)).toEqual(['6/1', '6/2'])
    expect(grid.rows[0].label).toBe(format(new Date('2026-06-01T12:00'), 'EEE'))
  })

  it('flags the row matching `now` as today', () => {
    const now = new Date('2026-06-02T14:00')
    const grid = buildWeekGrid([h('2026-06-01T12:00'), h('2026-06-02T12:00')], now)
    expect(grid.rows.map((r) => r.isToday)).toEqual([false, true])
  })

  it('returns nowHour when the current hour is within the daylight columns', () => {
    const now = new Date('2026-06-01T10:30') // 10 AM, inside 9–11
    const grid = buildWeekGrid([h('2026-06-01T09:00'), h('2026-06-01T11:00')], now)
    expect(grid.columns).toEqual([9, 10, 11])
    expect(grid.nowHour).toBe(10)
  })

  it('returns null nowHour when the current hour is outside the columns (e.g. night)', () => {
    const now = new Date('2026-06-01T22:00') // past the last daylight column
    const grid = buildWeekGrid([h('2026-06-01T09:00'), h('2026-06-01T11:00')], now)
    expect(grid.nowHour).toBeNull()
  })
})
