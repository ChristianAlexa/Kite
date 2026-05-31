import { useEffect, useRef, useState } from 'react'
import { geocode } from '../lib/weather.js'

// Compact location control: pin + place name with a search button, both opening
// a right-anchored dropdown (manual search + geolocate + clear).
export default function LocationBar({ location, onPick, onGeolocate, onClear, geoBusy }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const boxRef = useRef(null)

  const isGeo = location?.label === 'Using your location'
  const labelText = isGeo ? 'Current location' : location?.label || 'Pick a location'

  // Debounced geocode as the user types.
  useEffect(() => {
    const q = query.trim()
    if (!open) return
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    setError(null)
    const id = setTimeout(async () => {
      try {
        setResults(await geocode(q))
      } catch (e) {
        setError(e.message)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(id)
  }, [query, open])

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (r) => {
    onPick({ latitude: r.latitude, longitude: r.longitude, label: r.label, source: 'manual' })
    close()
  }

  const close = () => {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <div ref={boxRef} className="relative flex items-center justify-end gap-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[40px] min-w-0 items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100"
        title="Change location"
      >
        <span aria-hidden>📍</span>
        <span className="truncate text-sm font-semibold text-slate-800">{labelText}</span>
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        title="Search a place"
        aria-label="Search a place"
      >
        🔍
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City or ZIP…"
            className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
          />
          <div className="mt-2 max-h-64 overflow-auto">
            {searching && <div className="px-3 py-2 text-sm text-slate-400">Searching…</div>}
            {error && <div className="px-3 py-2 text-sm text-kite-poor">{error}</div>}
            {!searching && !error && query.trim().length >= 2 && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => pick(r)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sky-50"
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <button
              onClick={() => {
                onGeolocate()
                close()
              }}
              disabled={geoBusy}
              className="rounded-lg px-2 py-2 font-semibold text-sky-500 hover:bg-sky-50 disabled:opacity-40"
            >
              {geoBusy ? 'Locating…' : '🎯 Use my location'}
            </button>
            {location && (
              <button
                onClick={() => {
                  onClear()
                  close()
                }}
                className="rounded-lg px-2 py-2 font-semibold text-slate-400 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
