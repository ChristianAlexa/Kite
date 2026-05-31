import { format } from 'date-fns'
import {
  nextGreatWindow,
  clipWindowToNow,
  formatWindowHeadline,
  bestDaytimeHour,
} from '../lib/windows.js'
import { labelColor } from '../lib/ui.js'

// Big plain-language verdict — the first thing the user reads. Shows the next
// Good+ window (peak score + headline sentence), clipped to now if in progress.
// When the week has no Good+ window, falls back to the best sub-Good hour as a
// consolation ("No great kite windows this week — best is Marginal Sat 2 PM").
export default function HeadlineCard({ windows, hours }) {
  const next = clipWindowToNow(nextGreatWindow(windows))

  if (next) {
    const c = labelColor(next.label)
    return (
      <section className={`flex items-center gap-3 rounded-3xl p-4 ${c.soft}`}>
        <span className={`text-4xl font-black tabular-nums ${c.text}`}>{next.peakScore}</span>
        <div className="min-w-0">
          <div className={`text-[11px] font-bold uppercase tracking-wide ${c.text}`}>
            Next window
          </div>
          <div className="text-sm font-semibold leading-snug text-slate-800">
            {formatWindowHeadline(next)}
          </div>
        </div>
      </section>
    )
  }

  const best = bestDaytimeHour(hours)
  return (
    <section className="rounded-3xl bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-700">No great kite windows this week.</div>
      {best && (
        <div className="mt-1 text-xs text-slate-500">
          Best is {best.label} {format(new Date(best.time), 'EEE h a')} — score {best.score}.
        </div>
      )}
    </section>
  )
}
