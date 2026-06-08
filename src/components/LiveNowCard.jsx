import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { scoreHour } from '../lib/scoring.js'
import { observationToHour } from '../lib/station.js'
import { degToCardinal } from '../lib/wind.js'
import { labelColor } from '../lib/ui.js'

// Live measured wind from the nearest NWS station — the real-world counterpart to
// the modeled forecast. Re-scores the observation with the same scoreHour() the
// forecast uses, and shows how the measurement differs from the forecast for the
// current hour, exposing the model's offset at the user's actual spot.
//
// Degrades quietly: while loading it shows a slim skeleton; on error or no nearby
// station it renders nothing, so the forecast view below is never blocked.
export default function LiveNowCard({
  status,
  obs,
  forecastNow,
  stations = [],
  stationId,
  onPickStation,
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (status === 'loading') {
    return <div className="h-20 animate-pulse rounded-3xl bg-slate-100" />
  }
  if (status !== 'ready' || !obs) return null

  const station = stations.find((s) => s.id === stationId)
  const { score, label, limiter } = scoreHour(observationToHour(obs, forecastNow?.isDay ?? true))
  const c = labelColor(label)

  const mph = Math.round(obs.windSpeed)
  const gust = Math.round(obs.gust)
  const from = degToCardinal(obs.windDir)
  const delta = forecastNow ? Math.round(obs.windSpeed - forecastNow.windSpeed) : null

  return (
    <section className={`rounded-3xl p-4 ${c.soft}`} ref={boxRef}>
      <div className="flex items-center gap-3">
        <span className={`text-4xl font-black tabular-nums ${c.text}`}>{score}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-bold uppercase tracking-wide ${c.text}`}>
            Live now · {label}
            {limiter && <span className="font-semibold text-slate-400"> · {limiter}</span>}
          </div>
          <div className="text-sm font-semibold leading-snug text-slate-800">
            {mph} mph{gust > mph ? `, gusts ${gust}` : ''} from {from}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {forecastNow && (
              <>
                Forecast said {Math.round(forecastNow.windSpeed)}
                {delta !== 0 && (
                  <span className="font-medium">
                    {' '}
                    ({delta > 0 ? '+' : ''}
                    {delta})
                  </span>
                )}
                {' · '}
              </>
            )}
            {obs.time && formatDistanceToNow(new Date(obs.time), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Station selector — nearest by default, override persists. */}
      <div className="relative mt-2 border-t border-black/5 pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left text-xs text-slate-500 hover:text-slate-700"
        >
          <span className="truncate">
            📡 {station?.name || stationId}
            {station?.distanceMi != null && (
              <span className="text-slate-400"> · {station.distanceMi.toFixed(1)} mi</span>
            )}
          </span>
          <span className="ml-2 shrink-0 font-semibold underline">Change</span>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {stations.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onPickStation(s.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sky-50 ${
                  s.id === stationId ? 'font-semibold text-sky-600' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{s.name || s.id}</span>
                {s.distanceMi != null && (
                  <span className="ml-2 shrink-0 text-xs text-slate-400">
                    {s.distanceMi.toFixed(1)} mi
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
