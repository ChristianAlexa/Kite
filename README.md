# 🪁 Kite — "When can I fly?"

A small installable web app that answers one question for casual kite flyers:
**when is the wind actually good?**

Most weather apps show you raw wind, gust, and rain numbers and leave you to
interpret them. Kite does the interpreting. It pulls the local hourly forecast,
scores every daytime hour 0–100 for kite-flying quality, and surfaces the next
good window in plain language — e.g. _"Excellent conditions Tuesday 3–6 PM."_

<p align="center">
  <img src="docs/screenshot.png" alt="Kite — headline window and 7-day kite-flying heatmap" width="320" />
</p>

## What it shows

- **Headline** — the next Good+ window as a sentence, with its peak score. No
  good window in the next 7 days? It tells you the week's best hour instead.
- **Upcoming windows** — every Good+ stretch as a card: day, time range, average
  score, and wind / gust / rain summary.
- **7-day heatmap** — a color grid of daylight hours (deep green Excellent → red
  Poor). Tap any cell for that hour's wind direction, gust, rain, and temp.

## How it scores

Each daytime hour is a weighted sum of four sub-scores — wind speed (0.45), gust
steadiness (0.35), precipitation (0.15), and comfort temp (0.05) — with hard
gates that force calm, soaked, or turbulent hours into the Poor band regardless
of the rest. Gustiness is judged on both absolute spread _and_ gust factor
(gust ÷ sustained), and the worse of the two wins. The full model lives in
[`src/lib/scoring.js`](src/lib/scoring.js); the design notes are in
[`docs/SPEC.md`](docs/SPEC.md).

It's tuned for a beginner-friendly profile (ideal 8–16 mph). No user tuning in
v1 — change `WEIGHTS` / `THRESHOLDS` and everything else follows.

## Tech

React + Vite + Tailwind, deployed as a static PWA — no backend, no accounts, no
API keys. Weather comes from the free, CORS-enabled
[Open-Meteo](https://open-meteo.com/) API directly from the browser.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm test           # Vitest — scoring, windows, weather, calendar (63 tests)
npm run build      # production bundle + service worker into dist/
npm run preview    # serve the production build
npm run lint       # ESLint
npm run format     # Prettier (write)
```

## Deploy

Static — any host works. Build with `npm run build` and serve `dist/`. On
Vercel or Netlify, point the project at this repo with build command
`npm run build` and output directory `dist`; their default Node build handles
the rest.

## Privacy

Kite stores your last location in `localStorage` and talks only to Open-Meteo.
No analytics, no tracking, no account. See [PRIVACY.md](PRIVACY.md).

## Security note

`npm audit` reports moderate advisories in the **dev-only** esbuild/Vite
toolchain (the dev server, not the shipped bundle). They do not affect the
static production build that users load. Tracked for resolution when Vite's
toolchain ships a non-breaking patch.

## License

[MIT](LICENSE) © 2026 Christian Alexa
