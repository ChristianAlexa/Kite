import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { fetchForecast } from './lib/weather.js'
import { fetchNearestStations, fetchStationObservation, reverseGeocode } from './lib/station.js'
import { scoreHours, detectWindows } from './lib/windows.js'
import {
  getBrowserLocation,
  saveLocation,
  loadLocation,
  clearLocation,
  saveStation,
  loadStation,
} from './lib/location.js'
import LocationBar from './components/LocationBar.jsx'
import LiveNowCard from './components/LiveNowCard.jsx'
import HeadlineCard from './components/HeadlineCard.jsx'
import WeekHeatmap from './components/WeekHeatmap.jsx'

// Fallback when there's no stored location and geolocation is unavailable/denied.
const DEFAULT_LOCATION = {
  latitude: 38.9072,
  longitude: -77.0369,
  label: 'Washington, D.C.',
  source: 'default',
}

export default function App() {
  const [location, setLocation] = useState(() => loadLocation())
  const [forecast, setForecast] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [error, setError] = useState(null)
  const [geoError, setGeoError] = useState(null) // manual geolocate failure — non-destructive
  const [geoBusy, setGeoBusy] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const reqIdRef = useRef(0) // guards against out-of-order/stale responses

  // Live nearest-station observation — the measured anchor beside the forecast.
  const [stations, setStations] = useState([])
  const [stationId, setStationId] = useState(null)
  const [liveObs, setLiveObs] = useState(null)
  const [liveStatus, setLiveStatus] = useState('idle') // idle | loading | ready | error
  const stationReqRef = useRef(0)
  const obsReqRef = useRef(0)

  // Geolocate, then swap the placeholder label for the nearest named place so the
  // header reads "Leesburg, VA" instead of "Current location". Label is resolved
  // before setLocation so the lat/lon-keyed effects don't fire twice. Reverse
  // geocode is best-effort — on failure we keep the generic label.
  const resolveGeo = useCallback(async () => {
    const loc = await getBrowserLocation()
    const place = await reverseGeocode(loc.latitude, loc.longitude).catch(() => null)
    return place ? { ...loc, label: place } : loc
  }, [])

  // On first mount: stored location → else try geolocation → else default.
  useEffect(() => {
    if (location) return
    let cancelled = false
    setGeoBusy(true)
    resolveGeo()
      .then((loc) => !cancelled && setLocation(loc))
      .catch(() => !cancelled && setLocation(DEFAULT_LOCATION))
      .finally(() => !cancelled && setGeoBusy(false))
    return () => {
      cancelled = true
    }
  }, [location, resolveGeo])

  // Fetch the current location's forecast. Reused by the location effect, the
  // error-retry button, and the manual refresh control. A request id discards any
  // response that's been superseded (rapid location switches / double taps).
  const refresh = useCallback(() => {
    if (!location) return
    const myId = ++reqIdRef.current
    setStatus('loading')
    setError(null)
    fetchForecast(location.latitude, location.longitude)
      .then((data) => {
        if (myId !== reqIdRef.current) return
        setForecast(data)
        setStatus('ready')
        setFetchedAt(Date.now())
      })
      .catch((e) => {
        if (myId !== reqIdRef.current) return
        setError(e.message)
        setStatus('error')
      })
  }, [location])

  // Persist + fetch whenever location changes.
  useEffect(() => {
    if (!location) return
    saveLocation(location)
    refresh()
  }, [location, refresh])

  // Fetch a station's latest observation. Called explicitly (not via a stationId
  // effect) so it always runs even when the picked station is unchanged — e.g.
  // geolocating to the same place you already had resolves to the same station,
  // which a [stationId] effect would skip, leaving liveStatus stuck on 'loading'.
  const loadObservation = useCallback((id) => {
    if (!id) return
    const myId = ++obsReqRef.current
    setLiveStatus('loading')
    fetchStationObservation(id)
      .then((obs) => {
        if (myId !== obsReqRef.current) return
        setLiveObs(obs)
        setLiveStatus('ready')
      })
      .catch(() => {
        if (myId !== obsReqRef.current) return
        setLiveStatus('error')
      })
  }, [])

  // Resolve the nearest stations for the location, then pick the active one:
  // a saved override if it's still nearby, otherwise the closest station.
  useEffect(() => {
    if (!location) return
    const myId = ++stationReqRef.current
    setLiveStatus('loading')
    fetchNearestStations(location.latitude, location.longitude)
      .then((list) => {
        if (myId !== stationReqRef.current) return
        setStations(list)
        const saved = loadStation()
        const pick = list.find((s) => s.id === saved)?.id ?? list[0]?.id ?? null
        setStationId(pick)
        if (pick) loadObservation(pick)
        else setLiveStatus('error')
      })
      .catch(() => {
        if (myId !== stationReqRef.current) return
        setStations([])
        setStationId(null)
        setLiveStatus('error')
      })
  }, [location, loadObservation])

  // User override from the LiveNowCard dropdown — persist and refetch.
  const handlePickStation = useCallback(
    (id) => {
      saveStation(id)
      setStationId(id)
      loadObservation(id)
    },
    [loadObservation]
  )

  // Re-render every minute so the "Updated Xm ago" label stays honest while idle.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  // Derive scored hours + windows once per forecast. forecastNow is the forecast
  // hour aligned with the current local hour — the baseline the live reading is
  // compared against (and the source of is-day for scoring the observation).
  const derived = useMemo(() => {
    if (!forecast) return null
    const scored = scoreHours(forecast.hours)
    const windows = detectWindows(scored)
    const nowKey = format(new Date(), "yyyy-MM-dd'T'HH")
    const forecastNow = forecast.hours.find((h) => h.time.startsWith(nowKey)) ?? null
    return { scored, windows, forecastNow }
  }, [forecast])

  const handleGeolocate = () => {
    setGeoBusy(true)
    setGeoError(null)
    resolveGeo()
      .then(setLocation)
      // Surface the failure inline without tearing down the current view (any
      // forecast already on screen stays). Distinct from the fetch-error card.
      .catch((e) => setGeoError(e.message))
      .finally(() => setGeoBusy(false))
  }

  // Auto-dismiss the geolocation error after a few seconds.
  useEffect(() => {
    if (!geoError) return
    const id = setTimeout(() => setGeoError(null), 5000)
    return () => clearTimeout(id)
  }, [geoError])

  // Forget the saved location and re-detect (geolocation → default).
  const handleClear = () => {
    clearLocation()
    setLocation(null)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 w-full border-b border-slate-100 bg-white/90 pt-[max(0.375rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-1.5">
          <span className="text-lg" aria-hidden>
            🪁
          </span>
          <h1 className="shrink-0 text-base font-black leading-none text-slate-800">
            Go Fly a Kite
          </h1>
          <div className="ml-auto min-w-0">
            <LocationBar
              location={location}
              onPick={setLocation}
              onGeolocate={handleGeolocate}
              onClear={handleClear}
              geoBusy={geoBusy}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <main className="flex-1 space-y-4 px-4 py-3">
          {geoError && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>{geoError}</span>
              <button
                type="button"
                onClick={() => setGeoError(null)}
                aria-label="Dismiss"
                className="shrink-0 font-bold text-amber-500 hover:text-amber-700"
              >
                ✕
              </button>
            </div>
          )}

          {(status === 'idle' || status === 'loading') && <Skeleton />}

          {status === 'error' && (
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-kite-poor">
              <p className="font-semibold">Couldn’t load forecast</p>
              <p className="mt-1 text-red-500">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="mt-3 rounded-lg bg-kite-poor px-3 py-1.5 text-xs font-semibold text-white"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ready' && derived && (
            <>
              {location?.source === 'default' && (
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoBusy}
                  className="w-full rounded-xl bg-sky-50 px-3 py-2 text-left text-xs text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                >
                  📍 Showing {location.label} (default).{' '}
                  <span className="font-semibold underline">
                    {geoBusy ? 'Locating…' : 'Tap to use your location'}
                  </span>
                </button>
              )}
              <LiveNowCard
                status={liveStatus}
                obs={liveObs}
                forecastNow={derived.forecastNow}
                stations={stations}
                stationId={stationId}
                onPickStation={handlePickStation}
              />
              <HeadlineCard windows={derived.windows} hours={derived.scored} />
              <WeekHeatmap hours={derived.scored} />
            </>
          )}
        </main>

        <footer className="space-y-1 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-slate-400">
          <div>
            {fetchedAt
              ? `Updated ${formatDistanceToNow(fetchedAt, { addSuffix: true })}`
              : 'Loading…'}
            {' · '}
            <button
              type="button"
              onClick={refresh}
              disabled={status === 'loading'}
              className="font-semibold text-sky-500 disabled:opacity-40"
            >
              {status === 'loading' ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>
          <div>All times local · Daylight hours only · Data: Open-Meteo · NWS</div>
        </footer>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  )
}
