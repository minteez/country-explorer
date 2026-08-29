/**
 * config.js
 * -----------------------------------------------------------------------
 * Central place for API configuration.
 *
 * SECURITY NOTE (read this before deploying):
 * This is a fully static, client-side app. Any value written into this
 * file ships inside the JavaScript bundle the browser downloads, which
 * means ANY key placed here is technically visible to anyone who opens
 * dev tools or views source. There is no way to truly "hide" a secret
 * in a static frontend.
 *
 * REST Countries scopes browser requests by allowed origin (see their
 * CORS docs), which limits — but does not eliminate — the blast radius
 * of a leaked key. For a production deployment you should move the
 * Authorization header behind a small backend or serverless proxy
 * (e.g. a single `/api/countries` function that injects the real key
 * server-side) so the key never reaches the browser at all. Every call
 * in this app already goes through api.js, so swapping the fetch target
 * from the public API to your own proxy later is a one-line change.
 *
 * For local development and demos, REST Countries publishes a public
 * demo key (`rc_live_demo`) that works with no signup and no quota.
 * Responses made with it are flagged with a `data._demo` notice. We
 * fall back to it automatically whenever API_KEY is left as the
 * placeholder below, so the app works out of the box.
 */

const CONFIG = Object.freeze({
  // Replace this with your own REST Countries API key for production use.
  // Get one at https://restcountries.com/sign-up
  // Leave it untouched to run in demo mode.
  API_KEY: 'rc_live_a26b0e916f214b1ba788be94a12bf4f1',

  // Public, unlimited demo key published by REST Countries. Never treat
  // this as a secret — it's meant to be shared.
  DEMO_API_KEY: 'rc_live_demo',

  API_BASE_URL: 'https://api.restcountries.com/countries/v5',

  FLAG_CDN_BASE: 'https://flags.restcountries.com/v5',

  // How many result cards to request per search.
  SEARCH_LIMIT: 24,

  // localStorage keys, namespaced so we never collide with other sites.
  STORAGE_KEYS: {
    FAVORITES: 'countryExplorer.favorites',
    RECENT_SEARCHES: 'countryExplorer.recentSearches',
    THEME: 'countryExplorer.theme',
  },

  RECENT_SEARCHES_MAX: 8,
});

/**
 * True when the developer has not supplied their own key, meaning we're
 * running against the public demo key.
 */
function isDemoMode() {
  return !CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY';
}

/**
 * Resolves the key that should be sent with requests. Never logged,
 * never rendered, never written to localStorage.
 */
function getActiveApiKey() {
  return isDemoMode() ? CONFIG.DEMO_API_KEY : CONFIG.API_KEY;
}
