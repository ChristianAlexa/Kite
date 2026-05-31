import { useEffect, useRef } from 'react'
import { labelColor } from '../lib/ui.js'
import { THRESHOLDS } from '../lib/scoring.js'
import { degToCardinal, flyerInstruction, steadinessSegments, isCalm, travelDir } from '../lib/wind.js'
import { angleDelta, isAligned } from '../lib/compass.js'
import useCompassHeading from '../hooks/useCompassHeading.js'

// Hero wind-direction visual for HourDetail. A compass rose with an arrow drawn
// from the source bearing through the kite at center — wind flows in, kite flies
// out the far side. Arrow color tracks the hour's label; a gusty hour twitches.
//
// Opt-in live compass: tap "Align with compass" to feed the device heading in.
// The whole rose then rotates to true north, so the arrow holds its real-world
// bearing — turn your body until the arrowhead points up and you're facing
// downwind with the wind at your back.
export default function WindCompass({ hour }) {
  const { windDir, windSpeed, gust, label, gustFactor } = hour
  const calm = isCalm(windSpeed)
  const colorText = labelColor(label).text // text-kite-* → drives stroke via currentColor
  const segments = steadinessSegments(gustFactor)
  const gusty = !calm && gustFactor >= THRESHOLDS.gust.gustyGF
  const stance = flyerInstruction(windDir)

  const { heading, status, request } = useCompassHeading()
  const live = !calm && heading != null
  const target = travelDir(windDir) // where the kite flies — the way to face
  const aligned = live && isAligned(heading, target)

  // Double-buzz once on the rising edge of alignment — a distinct "locked" feel,
  // not a repeat every frame.
  const wasAligned = useRef(false)
  useEffect(() => {
    if (aligned && !wasAligned.current) navigator.vibrate?.([20, 30, 60])
    wasAligned.current = aligned
  }, [aligned])

  return (
    <div>
      <div className="flex items-center gap-3">
        <Dial deg={windDir} calm={calm} colorText={colorText} gusty={gusty} heading={live ? heading : null} aligned={aligned} />

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
              <CompassControl status={status} request={request} />
            </>
          )}
        </div>
      </div>

      {!calm && <Guidance live={live} aligned={aligned} heading={heading} target={target} stance={stance} />}
    </div>
  )
}

// The opt-in button (and its denied/live states) under the wind stats.
function CompassControl({ status, request }) {
  if (status === 'unsupported') return null
  if (status === 'granted') {
    return <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-kite-good">● Live compass</div>
  }
  if (status === 'denied') {
    return (
      <div className="mt-1.5 text-[10px] text-slate-400">Compass blocked — enable motion access in settings</div>
    )
  }
  return (
    <button
      type="button"
      onClick={request}
      className="mt-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-200"
    >
      🧭 Align with compass
    </button>
  )
}

// The instruction box below the dial. Static stance when not live; a live turn
// cue (or an "aligned" confirmation) once the compass is feeding headings.
function Guidance({ live, aligned, heading, target, stance }) {
  if (!live) {
    return (
      <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
        Stand with your back to the <b className="text-slate-800">{stance.back}</b> — kite flies
        toward <b className="text-slate-800">{stance.faces}</b>.
      </div>
    )
  }
  if (aligned) {
    return (
      <div className="mt-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-[11px] font-semibold text-kite-excellent">
        ✓ Aligned — wind at your back, kite flies straight ahead. 🪁
      </div>
    )
  }
  const delta = angleDelta(heading, target)
  const dir = delta > 0 ? 'right' : 'left'
  const glyph = delta > 0 ? '↻' : '↺'
  return (
    <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
      Turn <b className="text-slate-800">{glyph} {dir} {Math.round(Math.abs(delta))}°</b> — line the
      🪁 up with the ▲.
    </div>
  )
}

// 100×100 SVG compass. N up by default; when a live heading is supplied the whole
// rose rotates by -heading so N tracks true north and the arrow (rotated by the
// source bearing within) ends up at its real-world position. A fixed lubber mark
// at 12 o'clock (the way you're facing) gives a target: turn until the kite arrow
// reaches it.
function Dial({ deg, calm, colorText, gusty, heading, aligned }) {
  const live = heading != null
  const ringStroke = aligned ? '#10a34a' : '#e2e8f0' // kite-excellent green when aligned
  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-24 w-24 shrink-0 ${colorText} ${aligned ? 'compass-locked' : ''}`}
      aria-hidden
    >
      <g
        className={heading == null ? undefined : 'compass-rose'}
        transform={heading == null ? undefined : `rotate(${-heading} 50 50)`}
      >
        {/* ring */}
        <circle cx="50" cy="50" r="46" fill="white" stroke={ringStroke} strokeWidth={aligned ? 3 : 2} />
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
      </g>

      {/* Fixed lubber overlay — does NOT rotate. The triangle marks the way you're
          facing; the faint ticks bracket the catch zone the arrow must enter. */}
      {live && !calm && (
        <>
          {[-8, 8].map((a) => (
            <line
              key={a}
              x1="50"
              y1="4"
              x2="50"
              y2="11"
              stroke={aligned ? '#86efac' : '#cbd5e1'}
              strokeWidth="1.5"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          <path
            d="M50 2 L45 11 L55 11 Z"
            fill={aligned ? '#10a34a' : '#94a3b8'}
            stroke="white"
            strokeWidth="0.75"
          />
        </>
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
