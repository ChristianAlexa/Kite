// Pure wind-direction helpers. No React, no presentation. Open-Meteo reports
// wind_direction_10m as the meteorological bearing the wind comes FROM, in
// degrees clockwise from true north (0 = from N, 90 = from E, 270 = from W).

import { THRESHOLDS } from './scoring.js'

// 16-point compass, clockwise from north. Each point spans 22.5°.
const POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

// degToCardinal(290) → 'WNW'. Wraps 360 and snaps on ±11.25° boundaries.
export function degToCardinal(deg) {
  const norm = ((deg % 360) + 360) % 360
  const i = Math.round(norm / 22.5) % 16
  return POINTS[i]
}

// Where the kite flies — directly downwind of the source.
export function travelDir(deg) {
  return ((((deg % 360) + 360) % 360) + 180) % 360
}

// Turn a bearing into a stance: the flyer keeps the wind at their back, so they
// stand facing downwind and the kite flies out ahead of them.
// flyerInstruction(270) → { back: 'W', faces: 'E' }
export function flyerInstruction(deg) {
  return {
    back: degToCardinal(deg),
    faces: degToCardinal(travelDir(deg)),
  }
}

// 0–4 filled segments for the steadiness bar, from the gust factor the scorer
// already computed. Bands mirror THRESHOLDS.gust so the bar agrees with the
// score: smooth (≤smoothGF) = 4, then step down through gusty/turbulent.
export function steadinessSegments(gustFactor) {
  const { smoothGF, gustyGF, turbGF } = THRESHOLDS.gust
  if (!Number.isFinite(gustFactor)) return 0
  if (gustFactor <= smoothGF) return 4
  if (gustFactor <= gustyGF) return 3
  if (gustFactor < turbGF) return 2
  return 1
}

// Below steady wind, a reported direction is noise — don't draw an arrow for it.
export function isCalm(windSpeed) {
  return windSpeed < THRESHOLDS.wind.dead
}
