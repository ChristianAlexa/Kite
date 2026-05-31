import { useEffect, useRef, useState } from 'react'
import { buildWeekGrid } from '../lib/calendar.js'
import { labelColor } from '../lib/ui.js'
import { THRESHOLDS } from '../lib/scoring.js'
import HourDetail from './HourDetail.jsx'

const LEGEND = ['Excellent', 'Good', 'Marginal', 'Poor']

// 7-day heatmap: rows = days, columns = daylight clock hours. Each daytime hour is
// a color-tinted cell (deep green Excellent → red Poor). Tap a cell for detail.
export default function WeekHeatmap({ hours }) {
  const { columns, rows, nowHour } = buildWeekGrid(hours)
  const [selected, setSelected] = useState(null)
  const detailRef = useRef(null)

  // Bring the tapped-hour detail into view — on a tall grid it mounts below the
  // fold, so a tap on a top cell would otherwise look like nothing happened.
  useEffect(() => {
    if (!selected) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' })
  }, [selected])

  if (columns.length === 0) {
    return (
      <section>
        <Header />
        <p className="px-1 py-6 text-center text-sm text-slate-400">No daylight hours in range.</p>
      </section>
    )
  }

  return (
    <section>
      <Header />

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <div className="min-w-full">
          {/* Column headers — clock hours. */}
          <div className="flex gap-px">
            <div className="w-10 shrink-0" />
            {columns.map((c) => (
              <div
                key={c}
                className={`flex-1 text-center text-[9px] leading-none ${
                  c === nowHour ? 'font-bold text-sky-600' : 'text-slate-400'
                }`}
              >
                {hourLabel(c)}
              </div>
            ))}
          </div>

          {/* One row per day. */}
          {rows.map((row) => (
            <div key={row.key} className="mt-px flex items-center gap-px">
              <div
                className={`w-10 shrink-0 leading-none ${
                  row.isToday ? 'border-l-2 border-sky-400 pl-1' : ''
                }`}
              >
                <div
                  className={`text-[10px] font-bold ${row.isToday ? 'text-sky-600' : 'text-slate-700'}`}
                >
                  {row.label}
                </div>
                <div className="text-[9px] text-slate-400">{row.sub}</div>
              </div>
              {row.cells.map((cell, i) => {
                const isSel = cell && selected && selected.time === cell.time
                const isPerfect = cell && cell.score === 100
                // Blown out: wind past the strong ceiling — unflyable, already
                // red. Streaks blow across to read as dangerously windy.
                const isBlownOut = cell && cell.windSpeed >= THRESHOLDS.wind.strong
                const isNow = row.isToday && columns[i] === nowHour
                const ring = isSel
                  ? 'ring-1 ring-sky-500'
                  : isNow
                    ? 'ring-2 ring-inset ring-sky-500'
                    : ''
                // Perfect (100): steady wind streaks drift across the green —
                // marked by motion, the ideal-breeze counterpart to blown-out.
                const tone = !cell
                  ? 'bg-slate-100'
                  : isPerfect
                    ? 'ideal-tile'
                    : isBlownOut
                      ? 'windy-tile text-[10px] font-bold text-white'
                      : `${labelColor(cell.label).bg} text-[10px] font-bold text-white`
                return (
                  <button
                    key={i}
                    disabled={!cell}
                    onClick={() => setSelected(cell)}
                    title={
                      cell ? `${hourLabel(columns[i])} · ${cell.label} ${cell.score}` : undefined
                    }
                    aria-label={
                      cell
                        ? `${row.label} ${hourLabel(columns[i])}: ${cell.label} ${cell.score}`
                        : undefined
                    }
                    className={`flex aspect-square flex-1 items-center justify-center rounded-sm ${tone} ${ring}`}
                  >
                    {cell ? isPerfect ? <span aria-label="perfect">🪁</span> : cell.score : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend. */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span
            className="ideal-tile inline-flex h-4 w-4 items-center justify-center rounded-sm text-[11px] leading-none"
            aria-hidden
          >
            🪁
          </span>
          Perfect
        </span>
        {LEGEND.map((l) => (
          <span key={l} className="flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${labelColor(l).bg}`}
              aria-hidden
            />
            {l}
          </span>
        ))}
      </div>

      {selected && (
        <div ref={detailRef}>
          <HourDetail hour={selected} />
        </div>
      )}
    </section>
  )
}

function Header() {
  return (
    <div className="mb-1.5 flex items-baseline px-1">
      <h2 className="text-base font-bold text-slate-800">7-Day Outlook</h2>
    </div>
  )
}

// 0–23 → "12a", "9a", "12p", "3p".
function hourLabel(h) {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}
