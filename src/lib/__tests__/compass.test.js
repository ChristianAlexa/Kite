import { describe, it, expect } from 'vitest'
import { headingFromEvent, angleDelta, isAligned, smoothHeading } from '../compass.js'

describe('headingFromEvent', () => {
  it('reads iOS webkitCompassHeading as a true-north heading', () => {
    expect(headingFromEvent({ webkitCompassHeading: 90 })).toBe(90)
    expect(headingFromEvent({ webkitCompassHeading: 0 })).toBe(0)
  })

  it('converts Android absolute alpha (CCW) to a CW heading', () => {
    expect(headingFromEvent({ absolute: true, alpha: 90 })).toBe(270)
    expect(headingFromEvent({ absolute: true, alpha: 0 })).toBe(0)
    expect(headingFromEvent({ absolute: true, alpha: 270 })).toBe(90)
  })

  it('returns null when there is no usable absolute heading', () => {
    expect(headingFromEvent({ absolute: false, alpha: 90 })).toBeNull()
    expect(headingFromEvent({ alpha: 90 })).toBeNull()
    expect(headingFromEvent({})).toBeNull()
    expect(headingFromEvent(null)).toBeNull()
  })
})

describe('angleDelta', () => {
  it('is the shortest signed turn', () => {
    expect(angleDelta(0, 20)).toBe(20)
    expect(angleDelta(20, 0)).toBe(-20)
  })

  it('takes the short way across the 0/360 seam', () => {
    expect(angleDelta(350, 10)).toBe(20)
    expect(angleDelta(10, 350)).toBe(-20)
  })

  it('returns 180 for the antipode', () => {
    expect(angleDelta(0, 180)).toBe(180)
  })
})

describe('isAligned', () => {
  it('is true inside the tolerance and false outside', () => {
    expect(isAligned(100, 95)).toBe(true)
    expect(isAligned(100, 80)).toBe(false)
  })

  it('works across the 0/360 seam', () => {
    expect(isAligned(2, 358)).toBe(true)
    expect(isAligned(2, 340)).toBe(false)
  })

  it('is false for non-finite inputs', () => {
    expect(isAligned(NaN, 10)).toBe(false)
    expect(isAligned(10, undefined)).toBe(false)
  })
})

describe('smoothHeading', () => {
  it('returns the next heading when there is no previous', () => {
    expect(smoothHeading(null, 90)).toBe(90)
    expect(smoothHeading(undefined, 90)).toBe(90)
  })

  it('steps part-way toward the next heading', () => {
    expect(smoothHeading(0, 100, 0.25)).toBe(25)
  })

  it('takes the short arc across the seam', () => {
    expect(smoothHeading(350, 10, 0.5)).toBe(0)
  })
})
