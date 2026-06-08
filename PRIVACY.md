# Privacy Policy

_Last updated: 2026-06-08_

**Kite** ("the app") helps you find good kite-flying weather. This policy
explains what data the app uses and where it goes. In short: the app collects
no analytics, runs no trackers, and keeps your data on your device except for
the location coordinates needed to fetch a forecast.

## What the app accesses

### Location

- With your permission, the app reads your device's approximate location via
  the browser's Geolocation API to show local weather.
- You can also pick a location manually by searching for a city or ZIP code.
  Granting geolocation is optional.
- Your most recently chosen location is saved in your browser's `localStorage`
  (key `kite.location`), and any manual weather-station override you pick is
  saved alongside it (key `kite.station`), so you don't have to set them each
  visit. Both stay on your device. You can erase them at any time with the
  **Clear** button in the app, or by clearing your browser's site data.

### Network requests

To produce a forecast, the app sends your selected coordinates (latitude and
longitude) and, for manual search, the place name you type, to **Open-Meteo**:

- `https://api.open-meteo.com` — weather forecast
- `https://geocoding-api.open-meteo.com` — place name → coordinates

To show a live, measured wind reading from the nearest weather station, the app
also sends your selected coordinates to the **U.S. National Weather Service**
(NOAA), a U.S. government service:

- `https://api.weather.gov` — nearest observation station + its latest reading

Open-Meteo and the National Weather Service are third-party services with their
own privacy practices. See <https://open-meteo.com/en/terms> and
<https://www.weather.gov/privacy> for their terms and privacy information. The
app sends only what's needed for each lookup; it does not attach any account,
identifier, or profile to these requests.

## What the app does NOT do

- No analytics, telemetry, or usage tracking.
- No crash/error reporting SDKs.
- No advertising or third-party trackers.
- No account, sign-in, or server owned by the app — there is no backend that
  stores your data.

## Data retention

The only stored data is your chosen location and optional station override in
your browser's `localStorage` (keys `kite.location` and `kite.station`). The app
keeps no server-side records. Removing the app's site data (or pressing
**Clear**) deletes it.

## Contact

Questions about this policy: cjalexa@gmail.com
