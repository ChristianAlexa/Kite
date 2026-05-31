// Pure scoring model. Single source of truth for the beginner-friendly profile.
// Easy to expose as user settings later — change WEIGHTS/THRESHOLDS, nothing else.

export const WEIGHTS = {
  wind: 0.45,
  gust: 0.35,
  precip: 0.15,
  temp: 0.05,
}

export const THRESHOLDS = {
  // Wind speed (mph) beginner band.
  wind: { dead: 3, idealLow: 8, idealHigh: 16, strong: 25, highScoreFloor: 40 },
  // Gust steadiness. Two views: absolute spread (gust - sustained, mph) and the
  // gust factor (gust / sustained, ratio) — the metric a pilot actually reads off
  // a windmeter. We score on whichever looks worse.
  gust: {
    calm: 4,
    rough: 10,
    dead: 12,
    roughFloor: 40, // spread (mph)
    smoothGF: 1.3,
    gustyGF: 1.5,
    turbGF: 1.7, // gust factor (ratio)
    absStrong: 28, // absolute gust ceiling (mph) — kite-breaker regardless of mean
  },
  // Precip probability (%) and any measurable precip (mm).
  precip: { probLow: 20, probHigh: 50 },
  // Comfort temp (°F).
  temp: { coldDead: 30, coolGood: 50, warmGood: 85, hotDead: 100 },
}

export const LABELS = {
  excellent: { name: 'Excellent', min: 80 },
  good: { name: 'Good', min: 60 },
  marginal: { name: 'Marginal', min: 40 },
  poor: { name: 'Poor', min: 0 },
}

// Hard gates: necessary conditions for any kite flight. A weighted sum alone
// can't enforce them (max non-wind contribution is 45 → "calm" would read
// Marginal, and a 15%-weighted precip term leaves rainy hours "Excellent").
// When a gate trips, the hour is forced into the Poor band regardless of the
// other sub-scores.
export const GATE_CAP = 35 // below LABELS.marginal.min (40) → always Poor

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

// Linear interpolation between two points, returns y for given x.
const ramp = (x, x0, y0, x1, y1) => {
  if (x1 === x0) return y0
  const t = (x - x0) / (x1 - x0)
  return y0 + t * (y1 - y0)
}

// --- Sub-scores (each 0–100) ---

export function windScore(windSpeed) {
  const { dead, idealLow, idealHigh, strong, highScoreFloor } = THRESHOLDS.wind
  if (windSpeed < dead) return 0
  if (windSpeed < idealLow) return clamp(ramp(windSpeed, dead, 0, idealLow, 100))
  if (windSpeed <= idealHigh) return 100
  if (windSpeed <= strong) return clamp(ramp(windSpeed, idealHigh, 100, strong, highScoreFloor))
  return 0 // too strong
}

// Gust factor = gust / sustained. The relative metric a pilot trusts: a 10 mph
// spread on an 11 mph base (GF 1.9, violent) is far worse than the same spread on
// a 25 mph base (GF 1.4, fine). Below ~1 mph sustained, treat as turbulent.
export function gustFactorOf(windSpeed, gust) {
  if (windSpeed < 1) return Infinity
  return gust / windSpeed
}

export function gustScore(windSpeed, gust) {
  const { calm, rough, dead, roughFloor, smoothGF, gustyGF, turbGF } = THRESHOLDS.gust

  const spread = Math.max(0, gust - windSpeed)
  let spreadScore
  if (spread <= calm) spreadScore = 100
  else if (spread <= rough) spreadScore = clamp(ramp(spread, calm, 100, rough, roughFloor))
  else if (spread < dead) spreadScore = clamp(ramp(spread, rough, roughFloor, dead, 0))
  else spreadScore = 0

  const gf = gustFactorOf(windSpeed, gust)
  let factorScore
  if (gf <= smoothGF) factorScore = 100
  else if (gf <= gustyGF) factorScore = clamp(ramp(gf, smoothGF, 100, gustyGF, 50))
  else if (gf < turbGF) factorScore = clamp(ramp(gf, gustyGF, 50, turbGF, 0))
  else factorScore = 0

  // Worse signal wins — a kite cares about whichever view is more turbulent.
  return Math.min(spreadScore, factorScore)
}

export function precipScore(precip, precipProb) {
  const { probLow, probHigh } = THRESHOLDS.precip
  if (precip > 0) return 0 // measurable rain falling — kite-killer
  if (precipProb >= probHigh) return 0
  if (precipProb < probLow) return 100
  return clamp(ramp(precipProb, probLow, 100, probHigh, 0))
}

export function tempScore(temp) {
  const { coldDead, coolGood, warmGood, hotDead } = THRESHOLDS.temp
  if (temp <= coldDead || temp >= hotDead) return 0
  if (temp >= coolGood && temp <= warmGood) return 100
  if (temp < coolGood) return clamp(ramp(temp, coldDead, 0, coolGood, 100))
  return clamp(ramp(temp, warmGood, 100, hotDead, 0))
}

export function labelFor(score) {
  if (score >= LABELS.excellent.min) return LABELS.excellent.name
  if (score >= LABELS.good.min) return LABELS.good.name
  if (score >= LABELS.marginal.min) return LABELS.marginal.name
  return LABELS.poor.name
}

// Score one normalized hour → { score, label, parts }.
export function scoreHour(hour) {
  const parts = {
    wind: windScore(hour.windSpeed),
    gust: gustScore(hour.windSpeed, hour.gust),
    precip: precipScore(hour.precip, hour.precipProb),
    temp: tempScore(hour.temp),
  }
  let score = Math.round(
    parts.wind * WEIGHTS.wind +
      parts.gust * WEIGHTS.gust +
      parts.precip * WEIGHTS.precip +
      parts.temp * WEIGHTS.temp
  )

  const { dead, turbGF, gustyGF, absStrong } = THRESHOLDS.gust
  const spread = Math.max(0, hour.gust - hour.windSpeed)
  const gustFactor = gustFactorOf(hour.windSpeed, hour.gust)

  // Hard gates — flyable wind, steady air, and dry air are non-negotiable.
  const unflyableWind = parts.wind === 0 // dead calm or dangerously strong
  const wetAir = hour.precip > 0 || hour.precipProb >= THRESHOLDS.precip.probHigh
  const unsteady = spread >= dead || gustFactor >= turbGF // turbulent — kite crashes
  const tooStrongGust = hour.gust > absStrong // gusts overpower the kite regardless of mean
  const gated = unflyableWind || wetAir || unsteady || tooStrongGust
  if (gated) score = Math.min(score, GATE_CAP)

  // Steady wind is the price of an Excellent rating: a noticeably gusty (but still
  // flyable) hour caps at Good, never Excellent.
  if (!gated && gustFactor >= gustyGF) score = Math.min(score, LABELS.good.min + 19) // 79

  return { score, label: labelFor(score), parts, gated, gustFactor }
}
