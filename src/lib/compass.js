// Pure device-compass helpers. No React, no DOM listeners — those live in
// useCompassHeading. Headings are degrees clockwise from TRUE north (same frame
// as Open-Meteo's wind_direction_10m), so they compose directly with the wind
// bearings in wind.js.

// Pull a true-north heading out of a DeviceOrientationEvent, or null when the
// event carries no usable absolute heading.
//   - iOS exposes webkitCompassHeading: already true-north, clockwise.
//   - Android exposes alpha on an absolute event, counterclockwise from north,
//     so the heading is (360 - alpha).
export function headingFromEvent(event) {
  if (!event) return null
  if (Number.isFinite(event.webkitCompassHeading)) {
    return ((event.webkitCompassHeading % 360) + 360) % 360
  }
  if (event.absolute === true && Number.isFinite(event.alpha)) {
    return ((360 - event.alpha) % 360 + 360) % 360
  }
  return null
}

// Shortest signed turn from a to b, in degrees, in the range (-180, 180].
// Positive = turn clockwise (right) to get from a to b.
export function angleDelta(a, b) {
  let d = ((b - a) % 360 + 360) % 360
  if (d > 180) d -= 360
  return d
}

// Is the live heading pointing close enough at the target bearing?
export function isAligned(heading, target, tol = 8) {
  if (!Number.isFinite(heading) || !Number.isFinite(target)) return false
  return Math.abs(angleDelta(heading, target)) <= tol
}

// Circular low-pass filter: step prev toward next by `factor` of the shortest
// arc between them, so the rose glides instead of twitching on sensor noise.
// Returns next verbatim when there is no previous heading yet.
export function smoothHeading(prev, next, factor = 0.25) {
  if (!Number.isFinite(next)) return prev
  if (!Number.isFinite(prev)) return ((next % 360) + 360) % 360
  const stepped = prev + angleDelta(prev, next) * factor
  return ((stepped % 360) + 360) % 360
}
