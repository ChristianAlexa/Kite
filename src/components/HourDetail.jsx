import { format } from 'date-fns'
import WindCompass from './WindCompass.jsx'

// Tap detail for one scored hour: day/time + a wind-direction compass (wind +
// gust live there), plus rain/temp. Used by the WeekHeatmap grid.
export default function HourDetail({ hour }) {
  return (
    <div className="mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <div className="mb-1.5 text-sm font-semibold text-slate-800">
        {format(new Date(hour.time), 'EEEE h a')}
      </div>
      <WindCompass hour={hour} />
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <Stat icon="🌧️" label="Rain" value={`${hour.precipProb}%`} />
        <Stat icon="🌡️" label="Temp" value={`${Math.round(hour.temp)}°F`} />
      </div>
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div>
      <div className="text-sm" aria-hidden>
        {icon}
      </div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}
