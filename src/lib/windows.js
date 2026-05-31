import { format } from 'date-fns'
import { scoreHour, labelFor } from './scoring.js'

const GOOD_MIN = 60 // Good+ threshold for grouping

// Attach score to each normalized hour. Returns new array.
export function scoreHours(hours) {
  return hours.map((h) => ({ ...h, ...scoreHour(h) }))
}

// Walk daytime hours, group consecutive Good+ (score >= 60) hours into windows.
// `hours` may include night hours; only is_day === 1 ones are considered, and a
// night gap breaks a run.
export function detectWindows(scoredHours) {
  const windows = []
  let run = []

  const flush = () => {
    if (run.length === 0) return
    windows.push(buildWindow(run))
    run = []
  }

  for (const h of scoredHours) {
    if (h.isDay && h.score >= GOOD_MIN) {
      run.push(h)
    } else {
      flush()
    }
  }
  flush()
  return windows
}

function buildWindow(run) {
  const start = new Date(run[0].time)
  // End = start of last hour + 1h (windows are inclusive of the final hour).
  const last = new Date(run[run.length - 1].time)
  const end = new Date(last.getTime() + 60 * 60 * 1000)

  const avgScore = Math.round(run.reduce((s, h) => s + h.score, 0) / run.length)
  const peakScore = Math.max(...run.map((h) => h.score))
  const avgWind = Math.round(run.reduce((s, h) => s + h.windSpeed, 0) / run.length)
  const avgGust = Math.round(run.reduce((s, h) => s + h.gust, 0) / run.length)
  const maxPrecipProb = Math.max(...run.map((h) => h.precipProb))

  return {
    start,
    end,
    avgScore,
    peakScore,
    label: labelFor(avgScore),
    avgWind,
    avgGust,
    maxPrecipProb,
    hours: run,
  }
}

// Highest-scoring daytime hour in range — the consolation pick when no Good+
// window exists ("best is Marginal Sat 2 PM"). Null if there are no daytime hours.
export function bestDaytimeHour(scoredHours) {
  let best = null
  for (const h of scoredHours) {
    if (!h.isDay) continue
    if (!best || h.score > best.score) best = h
  }
  return best
}

// All Good+ windows, sorted by avgScore desc, tie-break earliest start.
export function rankWindows(windows) {
  return [...windows].sort((a, b) => {
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore
    return a.start - b.start
  })
}

// First *upcoming* window with avgScore >= 60. A window still counts if it's in
// progress now (end in the future); windows that already ended are skipped, so at
// 6 PM we don't surface this morning's slot.
export function nextGreatWindow(windows, now = new Date()) {
  const chrono = [...windows].sort((a, b) => a.start - b.start)
  return chrono.find((w) => w.avgScore >= GOOD_MIN && w.end > now) || null
}

// If a window is already in progress, clip its start to the current hour so we
// surface only the time that's still ahead (e.g. an 11 AM–7 PM window seen at
// 6:29 PM becomes 6–7 PM). Windows entirely in the future are returned unchanged.
export function clipWindowToNow(window, now = new Date()) {
  if (!window || now <= window.start || now >= window.end) return window
  const start = new Date(now)
  start.setMinutes(0, 0, 0) // floor to the top of the current hour
  return { ...window, start }
}

// "Excellent conditions Tuesday 3–6 PM"
export function formatWindowHeadline(window) {
  if (!window) return null
  return `${window.label} conditions ${formatRange(window.start, window.end)}`
}

// "Tuesday 3–6 PM" — collapse same meridiem/day where natural.
export function formatRange(start, end) {
  const day = format(start, 'EEEE M/dd')
  const startH = format(start, 'h')
  const startMer = format(start, 'a')
  const endH = format(end, 'h')
  const endMer = format(end, 'a')
  if (startMer === endMer) {
    return `${day} ${startH}–${endH} ${endMer}`
  }
  return `${day} ${startH} ${startMer}–${endH} ${endMer}`
}
