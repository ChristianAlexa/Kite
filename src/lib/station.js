// NWS (api.weather.gov) data access. CORS-enabled, no API key, callable from the
// browser — unlike aviationweather.gov, which sends no CORS header. Provides the
// *measured* counterpart to the modeled Open-Meteo forecast in weather.js: real
// observations from the nearest station, used as a live "now" anchor.

const NWS = 'https://api.weather.gov'

const KMH_TO_MPH = 0.621371
const kmhToMph = (kmh) => (kmh == null ? null : kmh * KMH_TO_MPH)
const cToF = (c) => (c == null ? null : (c * 9) / 5 + 32)

// Great-circle distance in miles between two lat/lon points.
export function haversineMi(lat1, lon1, lat2, lon2) {
  const R = 3958.8 // earth radius, miles
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// fetchNearestStations(lat, lon) → [{ id, name, lat, lon, distanceMi }]
// Two hops: /points resolves the grid + its observation-stations list URL, which
// returns stations nearest-first. We keep that order and attach a display distance.
export async function fetchNearestStations(lat, lon, limit = 5) {
  const pointRes = await fetch(`${NWS}/points/${lat},${lon}`)
  if (!pointRes.ok) throw new Error(`Station lookup failed (${pointRes.status})`)
  const point = await pointRes.json()
  const stationsUrl = point.properties?.observationStations
  if (!stationsUrl) throw new Error('No observation stations for this location')

  const listRes = await fetch(stationsUrl)
  if (!listRes.ok) throw new Error(`Station list failed (${listRes.status})`)
  const list = await listRes.json()

  return (list.features || []).slice(0, limit).map((f) => {
    const [sLon, sLat] = f.geometry?.coordinates ?? [null, null]
    return {
      id: f.properties.stationIdentifier,
      name: f.properties.name,
      lat: sLat,
      lon: sLon,
      distanceMi: sLat != null ? haversineMi(lat, lon, sLat, sLon) : null,
    }
  })
}

// fetchStationObservation(id) → normalized current reading in app units (mph/°F/mm).
// gust is null in the feed when calm — fall back to windSpeed so steadiness reads
// smooth instead of dividing by a missing value downstream.
export async function fetchStationObservation(id) {
  const res = await fetch(`${NWS}/stations/${id}/observations/latest`)
  if (!res.ok) throw new Error(`Observation failed (${res.status})`)
  const p = (await res.json()).properties
  const windSpeed = kmhToMph(p.windSpeed?.value) ?? 0
  const gust = kmhToMph(p.windGust?.value)
  return {
    time: p.timestamp,
    windSpeed,
    gust: gust ?? windSpeed,
    windDir: p.windDirection?.value ?? 0, // degrees wind comes FROM (meteorological)
    temp: cToF(p.temperature?.value) ?? 0,
    precip: p.precipitationLastHour?.value ?? 0, // mm in the last hour
    text: p.textDescription ?? '',
  }
}

// Shape a live observation into the hour object scoreHour() expects, so the
// measured reading gets the same rating as a forecast hour. precipProb is
// meaningless for an observation (rain is happening or it isn't) → 0; isDay is
// borrowed from the forecast hour that lines up with now.
export function observationToHour(obs, isDay = true) {
  return {
    time: obs.time,
    windSpeed: obs.windSpeed,
    gust: obs.gust,
    windDir: obs.windDir,
    precip: obs.precip,
    precipProb: 0,
    temp: obs.temp,
    isDay,
  }
}
