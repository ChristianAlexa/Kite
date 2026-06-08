// Location helpers: browser geolocation + localStorage persistence.

const STORAGE_KEY = 'kite.location'
const STATION_KEY = 'kite.station'

// getBrowserLocation() → Promise<{ latitude, longitude, label }>
export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: 'Using your location',
          source: 'geo',
        })
      },
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  })
}

function geoErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied'
    case err.POSITION_UNAVAILABLE:
      return 'Location unavailable'
    case err.TIMEOUT:
      return 'Location request timed out'
    default:
      return 'Could not get location'
  }
}

export function saveLocation(loc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearLocation() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// Persist a manual station override (e.g. KIAD) so it survives reloads. Ignored
// at load time when the saved id isn't among the new location's nearest stations.
export function saveStation(id) {
  try {
    localStorage.setItem(STATION_KEY, id)
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadStation() {
  try {
    return localStorage.getItem(STATION_KEY) || null
  } catch {
    return null
  }
}
