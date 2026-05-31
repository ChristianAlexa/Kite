# Kite — "When can I fly?"

A web app that tells casual kite flyers when the wind is actually good.

## Context

Casual kite flyers can't read raw weather data and decide if it's worth going out.
Existing weather apps show wind/gust/rain numbers but force the user to interpret
them. This app does the interpretation: it pulls the local hourly forecast, scores
each daytime hour for kite-flying quality, and surfaces the next good window in
plain language — e.g. _"Excellent conditions Tuesday 3–6 PM."_

**Status:** v1 implemented and unit-tested. This doc is the design source of truth;
[`src/lib/scoring.js`](../src/lib/scoring.js) is the source of truth for the scoring
numbers.

## Locked decisions

- **Platform:** web app, installable PWA.
- **Stack:** React + Vite + Tailwind. Deploy to Vercel/Netlify (static, no backend).
- **Location:** browser geolocation by default, manual city/ZIP override.
- **Weather source:** Open-Meteo (free, no API key).
- **Horizon:** next 7 days, hourly.
- **Scope (v1):** read-only. Score + next best window + hourly breakdown. No accounts,
  no alerts.
- **Scoring:** fixed sensible defaults (one built-in beginner-friendly profile). No
  user tuning in v1.

## Data sources (Open-Meteo, no key)

**Forecast** — `https://api.open-meteo.com/v1/forecast`

```
latitude, longitude, forecast_days=7, timezone=auto,
wind_speed_unit=mph, temperature_unit=fahrenheit,
hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,
       precipitation_probability,temperature_2m,is_day
```

**Geocoding** (manual location) —
`https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5`
Returns lat/lon + name for city/ZIP text. Used for the manual override box.

Both are CORS-enabled and callable directly from the browser — no server needed.

## Scoring model

Score each daytime hour (`is_day === 1`) 0–100 as a weighted sum of sub-scores.

> **Note:** shipped weights are wind 0.45 / gust 0.35 (see `WEIGHTS` in
> `src/lib/scoring.js`), raised from the 0.55 / 0.25 first sketched here. The gust
> model scores a dual metric — absolute spread **and** gust factor, worse wins — so
> turbulence earns more of the budget. `scoring.js` is the source of truth.

| Sub-score | Weight | Behavior |
|---|---|---|
| Wind speed | 0.45 | Beginner band. Ideal 8–16 mph → 100. `<3` = 0, 3–8 ramps 0→100, 8–16 = 100, 16–25 ramps 100→40, `>25` = 0 (too strong). |
| Gustiness | 0.35 | Penalize gust − sustained spread. ≤4 mph = 100, 4–10 ramps 100→40, `>12` = 0. Steady wind flies kites; gusts crash them. |
| Precipitation | 0.15 | `precip > 0` or `precip_prob ≥ 50%` heavily penalized; `prob < 20%` = 100, ramps down between. |
| Comfort/temp | 0.05 | Minor. 50–85°F = 100, ramps to 0 outside ~30–100°F. |

Overall hour score → label: **Excellent** ≥80, **Good** 60–79, **Marginal** 40–59,
**Poor** <40.

Implemented as pure functions in `src/lib/scoring.js`: `scoreHour(hour) → {score,
label, parts}` plus a `WEIGHTS`/`THRESHOLDS` config object, so the profile is a
single source of truth (easy to expose as a user setting later).

## Window detection

In `src/lib/windows.js`:

- Walk scored daytime hours, group consecutive hours with score ≥ 60 (Good+) into
  windows.
- For each window compute `{start, end, avgScore, peakScore, label}` (label from
  `avgScore`).
- Sort by `avgScore` desc; tie-break earliest start.
- **Next great window** = first window (chronological) with `avgScore ≥ 60`; headline
  its label, day-of-week, and time range → _"Excellent conditions Tuesday 3–6 PM."_
- Format range with date-fns (e.g. `EEEE h–h a`).

## UI (single page)

`src/App.jsx` composes:

1. **LocationBar** — current resolved place name; geolocate button; manual search
   input (debounced call to the geocoding API, dropdown of matches).
2. **HeadlineCard** — big score + plain-language next-window sentence. If no good
   window in 7 days: _"No great kite windows this week — best is Marginal Sat 2 PM."_
3. **WeekHeatmap** — 7-day grid: rows = days, columns = daylight clock hours. Each
   hour is a color-tinted cell (Excellent→Poor) showing its score; today's row and
   the current hour are anchored. Tap a cell → **HourDetail**: a wind-direction
   compass (**WindCompass**) with gust + steadiness, rain, temp, and a "stand with
   your back to…" stance hint.

**Potential future features (not in v1):**

- **WindowsList** — all Good+ windows as cards (day, time range, avg score badge,
  wind/gust summary). Cut from v1 as redundant with the headline (next window) and
  the 7-day heatmap (full week). Revisit if users want every good window enumerated
  with numbers at a glance, or fold a "+N more windows" hint into the headline.

Components live under `src/components/`. Keep scoring/windows logic out of components.

**State:** plain React hooks. Persist last location in `localStorage`. No router
(single view).

## Project structure

```
index.html
package.json                 # vite + react + tailwind + date-fns
vite.config.js
tailwind.config.js / postcss.config.js
public/manifest.webmanifest  # PWA: name, icons, theme (generated by vite-plugin-pwa)
src/main.jsx
src/App.jsx
src/lib/weather.js           # fetchForecast(lat,lon), geocode(query), normalizeHourly
src/lib/scoring.js           # scoreHour + WEIGHTS/THRESHOLDS config (pure, unit-tested)
src/lib/windows.js           # detectWindows, nextGreatWindow, formatRange (pure, unit-tested)
src/lib/calendar.js          # buildWeekGrid — day × hour grid for the heatmap (pure)
src/lib/wind.js              # compass/cardinal + steadiness helpers (pure)
src/lib/ui.js                # label → color/glyph presentation map
src/lib/location.js          # getBrowserLocation(), localStorage helpers
src/components/LocationBar.jsx
src/components/HeadlineCard.jsx
src/components/WeekHeatmap.jsx
src/components/HourDetail.jsx
src/components/WindCompass.jsx
src/lib/__tests__/{scoring,windows,calendar,wind,weather}.test.js
```

PWA via vite-plugin-pwa so it's installable and the last fetch is cached for an
offline glance.

## Build order

0. Write this spec (committed source of truth) before any code.
1. Scaffold Vite + React + Tailwind; confirm dev server runs.
2. `weather.js` — fetch + normalize Open-Meteo hourly arrays into `[{time, windSpeed,
   gust, precip, precipProb, temp, isDay}]`.
3. `scoring.js` + tests — lock the model with fixture hours before wiring UI.
4. `windows.js` + tests — window grouping + next-great selection.
5. UI components top-down: HeadlineCard → WeekHeatmap (+ HourDetail/WindCompass) →
   LocationBar.
6. Location: geolocation + manual geocode override + localStorage.
7. PWA manifest + icons; verify installable.

## Verification

- **Unit tests (Vitest):** `scoring.test.js` asserts known hours map to expected
  labels (calm→Poor, 12 mph steady dry→Excellent, 30 mph→Poor, gusty→downgraded);
  `windows.test.js` asserts consecutive Good hours merge and the right headline is
  picked. Run: `bash -c 'source ~/.nvm/nvm.sh && npm test'`.
- **Manual run:** `npm run dev`, load app, allow location → headline + heatmap render.
  Type a city → location switches, data refreshes. Cross-check a couple hours against
  open-meteo.com to confirm numbers and labels are sane.
- **PWA:** build, serve, confirm install prompt + manifest in DevTools Application tab.

## Out of scope (v1)

Accounts, push/email alerts, saved favorite spots, kite-type/skill presets, custom
thresholds, multi-location compare. Scoring config is centralized so presets/sliders
drop in later without restructuring.
