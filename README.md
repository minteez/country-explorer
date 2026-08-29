# Country Explorer

**Discover countries. Explore the data.**

A single-page country data explorer built with plain HTML5, CSS3, and
vanilla JavaScript, powered live by the [REST Countries API](https://restcountries.com) (v5).

---

## Overview

Country Explorer lets you search for any country by name, capital, or ISO
code and dive into a detailed profile — geography, economy, languages,
political leadership, international memberships, communications, and the
raw API JSON behind it all. No framework, no build step: open it in a
local server and it runs.

## Features

- **Full-text search** across country name, capital, and ISO codes, with
  loading, empty, error, and no-results states
- **Responsive result cards** (1–3 column grid depending on viewport)
  with flag, capital, region, population, currency, and languages
- **Detailed country profile** in a slide-over panel: quick stats,
  geography (with lat/long formatting), economy, languages, political
  leadership, international membership badges, communications, and full
  country-code list
- **Raw API data viewer** — collapsible, pretty-printed JSON with a
  one-click copy button, so you can see exactly what the API returned
- **Random Country** button
- **Favorites**, persisted in `localStorage`
- **Recent searches**, persisted in `localStorage`, clickable to repeat
- **Dark / light theme**, persisted, respects system preference on first
  visit
- Debounced-safe, cancellable requests (`AbortController`) so a fast
  typer never sees a stale response overwrite a newer one
- Lazy-loaded flag images with emoji fallback on load failure
- Accessible by default: semantic landmarks, labeled form controls,
  visible focus states, `Escape`-to-close detail panel, keyboard-operable
  everything

## Technologies

- HTML5
- CSS3 (custom properties for theming — no framework)
- Vanilla JavaScript (no React/Vue/Angular, no jQuery)
- [REST Countries API v5](https://restcountries.com)

## API Architecture

The app is layered so each file has exactly one job:

```
js/config.js    → API key + endpoint constants
js/utils.js     → pure data formatting/normalizing (no DOM, no network)
js/storage.js   → the only module that touches localStorage
js/api.js       → the only module that calls fetch()
js/state.js     → a tiny observable state container
js/ui.js        → the only module that touches the DOM
js/app.js       → wires user events → api.js/state.js → ui.js
```

All requests go through `Api.searchCountries()` or `Api.getByProperty()`
in `js/api.js`. Nothing else in the app calls `fetch()`. That means:

- the `Authorization` header is set in exactly one place
- error handling and response-shape parsing is written once
- moving to a backend proxy later (see below) is a one-line change to
  `CONFIG.API_BASE_URL`

Request flow:

```
Search box → app.js → api.js (fetch + auth header)
           → REST Countries API → JSON
           → utils.js (normalize into a view model)
           → ui.js (render cards / detail panel)
```

## Data Model

Each country record can carry 90+ fields; the app selects the ones most
useful for browsing and reading, and normalizes a few fields that the API
may return in more than one shape (e.g. `currencies` as either an array
or an object keyed by currency code, `languages` as either an array or
object). See `toCountryViewModel()` in `js/utils.js` for the single place
this shaping happens. Missing/null/empty values are never shown as
`undefined`, `null`, or `NaN` — they render as "Not available" or a
field-appropriate fallback ("No land borders", "Coordinates unavailable").

## Project Structure

```
country-explorer/
├── index.html            Single HTML shell; all four views live here
├── README.md
├── css/
│   ├── styles.css        Design tokens, layout, components
│   └── responsive.css    Breakpoints
└── js/
    ├── config.js
    ├── utils.js
    ├── storage.js
    ├── api.js
    ├── state.js
    ├── ui.js
    └── app.js
```

## Running Locally

This app makes real cross-origin `fetch()` calls and uses `<script>` tags
that expect to be served over HTTP, so **don't open `index.html` directly
from disk** (`file://` URLs will hit CORS restrictions and some browsers
block features the app relies on). Instead, serve the folder:

```bash
# Option 1 — Python (built in on macOS/Linux, or via python.org on Windows)
cd country-explorer
python3 -m http.server 5500

# Option 2 — Node
npx serve .

# Option 3 — VS Code
# Install the "Live Server" extension, right-click index.html → "Open with Live Server"
```

Then visit `http://localhost:5500` (or whatever port your tool prints).

## API Key Configuration

REST Countries v5 requires a Bearer token on every request. **This is a
fully static frontend, so any key placed in `js/config.js` ships to the
browser and is technically visible to anyone who opens dev tools.** There
is no way to truly hide a secret in client-side-only code.

By default, `CONFIG.API_KEY` in `js/config.js` is left as the placeholder
`'YOUR_API_KEY'`. When that's the case, the app automatically falls back
to REST Countries' public **demo key** (`rc_live_demo`), which needs no
signup and works immediately — you'll see a small "· demo data" note
next to search results while it's active.

To use your own account:

1. Get a free key at <https://restcountries.com/sign-up>.
2. In the REST Countries dashboard, add the origin you'll be serving
   the app from to that key's **allowed origins** (e.g.
   `http://localhost:5500` for local dev, or your production domain).
   Requests from origins not on that list will be rejected by CORS.
3. Replace `'YOUR_API_KEY'` in `js/config.js` with your key.

**For a real production deployment**, don't ship your own key to the
browser at all — proxy it. Stand up a minimal backend or serverless
function (e.g. a single endpoint that forwards `?q=` to REST Countries
with the real key attached server-side), then point
`CONFIG.API_BASE_URL` in `js/config.js` at your proxy instead of
`api.restcountries.com`. Because every request already funnels through
`js/api.js`, nothing else in the app needs to change.

The key is never logged, never rendered in the UI, never written to
`localStorage`, and is stripped out of the "View API Data" JSON panel.

## Future Roadmap

Deliberately **not** built in this first version, but the architecture
(a single `api.js`, a normalizing view-model layer, and delegated UI
event handling) is meant to make these additive rather than rewrites:

- Region / subregion filtering
- Currency and language-based search
- Direct ISO-code lookup shortcut
- EU / G7 / G20 / NATO membership filters
- Side-by-side country comparison
- Pagination for large result sets
- Advanced multi-field filtering
- More opportunistic fields from the 90+ available (continents,
  landlocked status, demonyms, postal code format, etc.)
- A lightweight geographic visualization for capital/country coordinates

## Testing Notes

This build was checked against: mixed-case and partial queries; empty
search; countries with multiple currencies/languages/capitals; countries
with no land borders; missing optional fields (leaders, memberships);
flag load failures (emoji fallback); favorites and recent-search
persistence across reloads; theme persistence; keyboard-only navigation
of search, cards, and the detail panel (including `Escape` to close); and
mobile layout down to ~360px width.
