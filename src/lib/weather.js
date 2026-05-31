// Open-Meteo data access. CORS-enabled, no API key, callable from browser.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const HOURLY_FIELDS = [
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'precipitation',
  'precipitation_probability',
  'temperature_2m',
  'is_day',
].join(',')

// fetchForecast(lat, lon) → { timezone, hours: [{time, windSpeed, gust, precip, precipProb, temp, isDay}] }
export async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    forecast_days: '7',
    timezone: 'auto',
    wind_speed_unit: 'mph',
    temperature_unit: 'fahrenheit',
    hourly: HOURLY_FIELDS,
  })
  const res = await fetch(`${FORECAST_URL}?${params}`)
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`)
  const data = await res.json()
  return {
    timezone: data.timezone,
    hours: normalizeHourly(data.hourly),
  }
}

// Zip parallel Open-Meteo hourly arrays into row objects.
export function normalizeHourly(hourly) {
  if (!hourly || !hourly.time) return []
  return hourly.time.map((time, i) => ({
    time, // ISO local string, e.g. "2026-05-30T14:00"
    windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
    gust: hourly.wind_gusts_10m?.[i] ?? 0,
    windDir: hourly.wind_direction_10m?.[i] ?? 0, // degrees wind comes FROM (meteorological)
    precip: hourly.precipitation?.[i] ?? 0,
    precipProb: hourly.precipitation_probability?.[i] ?? 0,
    temp: hourly.temperature_2m?.[i] ?? 0,
    isDay: (hourly.is_day?.[i] ?? 0) === 1,
  }))
}

// geocode(query) → [{ id, name, label, latitude, longitude }]
export async function geocode(query) {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({ name: q, count: '5', language: 'en', format: 'json' })
  const res = await fetch(`${GEOCODE_URL}?${params}`)
  if (!res.ok) throw new Error(`Geocoding request failed (${res.status})`)
  const data = await res.json()
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    label: [r.name, r.admin1].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }))
}

// Reverse-ish: pretty label from coords is not provided by Open-Meteo geocoding,
// so callers supply their own ("Using your location") for geolocated points.
