import { describe, it, expect } from 'vitest'
import { degToCardinal, travelDir, flyerInstruction, steadinessSegments, isCalm } from '../wind.js'

describe('degToCardinal', () => {
  it('maps the four cardinals', () => {
    expect(degToCardinal(0)).toBe('N')
    expect(degToCardinal(90)).toBe('E')
    expect(degToCardinal(180)).toBe('S')
    expect(degToCardinal(270)).toBe('W')
  })

  it('reads intercardinals', () => {
    expect(degToCardinal(290)).toBe('WNW')
    expect(degToCardinal(45)).toBe('NE')
  })

  it('wraps past 360 back to N', () => {
    expect(degToCardinal(348.75)).toBe('N')
    expect(degToCardinal(360)).toBe('N')
    expect(degToCardinal(-90)).toBe('W')
  })

  it('snaps on the ±11.25° boundary', () => {
    expect(degToCardinal(11.24)).toBe('N')
    expect(degToCardinal(11.26)).toBe('NNE')
  })
})

describe('travelDir', () => {
  it('is the opposite bearing', () => {
    expect(travelDir(270)).toBe(90)
    expect(travelDir(350)).toBe(170)
    expect(travelDir(0)).toBe(180)
  })
})

describe('flyerInstruction', () => {
  it('back is the source, faces is downwind', () => {
    expect(flyerInstruction(270)).toEqual({ back: 'W', faces: 'E' })
    expect(flyerInstruction(0)).toEqual({ back: 'N', faces: 'S' })
  })
})

describe('steadinessSegments', () => {
  it('fills all four for smooth air', () => {
    expect(steadinessSegments(1.1)).toBe(4)
  })
  it('steps down as it gets gustier', () => {
    expect(steadinessSegments(1.4)).toBe(3) // ≤ gustyGF
    expect(steadinessSegments(1.6)).toBe(2) // < turbGF
    expect(steadinessSegments(2.0)).toBe(1) // turbulent
  })
  it('returns 0 for a non-finite factor (calm base)', () => {
    expect(steadinessSegments(Infinity)).toBe(0)
  })
})

describe('isCalm', () => {
  it('is true below the dead-wind threshold', () => {
    expect(isCalm(3)).toBe(true)
    expect(isCalm(4)).toBe(false)
    expect(isCalm(12)).toBe(false)
  })
})
