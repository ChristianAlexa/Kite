import { labelColor } from '../lib/ui.js'
import { THRESHOLDS } from '../lib/scoring.js'
import { degToCardinal, flyerInstruction, steadinessSegments, isCalm } from '../lib/wind.js'

// Hero wind-direction visual for HourDetail. A compass rose with an arrow drawn
// from the source bearing through the kite at center — wind flows in, kite flies
// out the far side. Arrow color tracks the hour's label; a gusty hour twitches.
export default function WindCompass({ hour }) {
  const { windDir, windSpeed, gust, label, gustFactor } = hour
  const calm = isCalm(windSpeed)
  const colorText = labelColor(label).text // text-kite-* → drives stroke via currentColor
  const segments = steadinessSegments(gustFactor)
  const gusty = !calm && gustFactor >= THRESHOLDS.gust.gustyGF
  const stance = flyerInstruction(windDir)

  return (
    <div>
      <div className="flex items-center gap-3">
        <Dial deg={windDir} calm={calm} colorText={colorText} gusty={gusty} />

        <div className="min-w-0 flex-1">
          {calm ? (
            <div className="text-sm font-semibold text-slate-500">Calm — no steady wind</div>
          ) : (
            <>
              <div className="text-sm">
                <span className="font-semibold text-slate-800">from {degToCardinal(windDir)}</span>
                <span className="text-slate-400"> · {Math.round(windDir)}°</span>
              </div>
              <div className="mt-0.5 text-xl font-black leading-none text-slate-800">
                {Math.round(windSpeed)}
                <span className="text-sm font-bold text-slate-400"> mph</span>
              </div>
              <div className="text-xs text-slate-500">gusts {Math.round(gust)} mph</div>
              <Steadiness segments={segments} colorText={colorText} />
            </>
          )}
        </div>
      </div>

      {!calm && (
        <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
          Stand with your back to the <b className="text-slate-800">{stance.back}</b> — kite flies
          toward <b className="text-slate-800">{stance.faces}</b>.
        </div>
      )}
    </div>
  )
}

// 100×100 SVG compass. N up. The arrow group is rotated by the source bearing so
// the tail sits on the windward rim and the head points downwind through center.
function Dial({ deg, calm, colorText, gusty }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-24 w-24 shrink-0 ${colorText}`} aria-hidden>
      {/* ring */}
      <circle cx="50" cy="50" r="46" fill="white" stroke="#e2e8f0" strokeWidth="2" />
      {/* cardinal ticks */}
      {[0, 90, 180, 270].map((a) => (
        <line
          key={a}
          x1="50"
          y1="6"
          x2="50"
          y2="12"
          stroke="#cbd5e1"
          strokeWidth="2"
          transform={`rotate(${a} 50 50)`}
        />
      ))}
      {/* cardinal labels */}
      <CardinalText x="50" y="17" label="N" />
      <CardinalText x="86" y="53" label="E" />
      <CardinalText x="50" y="90" label="S" />
      <CardinalText x="14" y="53" label="W" />

      {calm ? (
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="22">
          🪁
        </text>
      ) : (
        <g transform={`rotate(${deg} 50 50)`}>
          <g className={gusty ? 'animate-wind-jitter' : undefined}>
            {/* shaft: source rim → past center (downwind) */}
            <line
              x1="50"
              y1="14"
              x2="50"
              y2="64"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* arrowhead at downwind end, pointing out */}
            <path d="M50 70 L45 60 L55 60 Z" fill="currentColor" />
          </g>
          {/* kite sits at center, above the shaft */}
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="20">
            🪁
          </text>
        </g>
      )}
    </svg>
  )
}

function CardinalText({ x, y, label }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11"
      fontWeight="700"
      fill="#94a3b8"
    >
      {label}
    </text>
  )
}

// Four-segment steadiness bar. Filled segments use the label color; a steady
// wind fills all four, a turbulent one only the first.
function Steadiness({ segments, colorText }) {
  return (
    <div className="mt-1.5 flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-5 rounded-full ${i < segments ? `bg-current ${colorText}` : 'bg-slate-200'}`}
        />
      ))}
      <span className="ml-1 text-[10px] text-slate-400">
        {segments >= 4
          ? 'steady'
          : segments >= 3
            ? 'mild gusts'
            : segments >= 2
              ? 'gusty'
              : 'turbulent'}
      </span>
    </div>
  )
}
