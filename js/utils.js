/**
 * utils.js
 * -----------------------------------------------------------------------
 * Small, pure, reusable helpers. No DOM access, no state, no fetches —
 * just data shaping and formatting so the rest of the app stays simple.
 */

const FALLBACK_TEXT = 'Not available';

/** Returns true for null, undefined, empty string, or empty array. */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Safely returns a value, or a fallback string if it's missing. */
function orFallback(value, fallback = FALLBACK_TEXT) {
  return isEmpty(value) ? fallback : value;
}

/** Escapes text before it's placed into innerHTML templates. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 38005238 -> "38.0M" / "38,005,238" depending on `compact`. */
function formatPopulation(population, compact = true) {
  if (typeof population !== 'number' || Number.isNaN(population)) {
    return FALLBACK_TEXT;
  }
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(population);
  }
  return new Intl.NumberFormat('en-US').format(population);
}

/** Formats a km²/mi² figure with locale-aware separators. */
function formatArea(value, unit) {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_TEXT;
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value);
  return `${formatted} ${unit}`;
}

/** 45.42 -> "45.42° N" (works for both lat and lng). */
function formatCoordinate(value, kind) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const direction =
    kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(2)}° ${direction}`;
}

/** Builds a "45.42° N, 75.70° W" style pair, or null if both are missing. */
function formatCoordinatePair(lat, lng) {
  const latText = formatCoordinate(lat, 'lat');
  const lngText = formatCoordinate(lng, 'lng');
  if (!latText || !lngText) return null;
  return `${latText}, ${lngText}`;
}

/** Normalizes the `currencies` field, which the API may return as either
 *  an array of {code, name, symbol} or an object keyed by currency code. */
function normalizeCurrencies(currencies) {
  if (!currencies) return [];
  if (Array.isArray(currencies)) {
    return currencies
      .filter(Boolean)
      .map((c) => ({
        code: c.code || c.id || '',
        name: c.name || '',
        symbol: c.symbol || '',
      }));
  }
  if (typeof currencies === 'object') {
    return Object.entries(currencies)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([code, v]) => ({
        code,
        name: v.name || '',
        symbol: v.symbol || '',
      }));
  }
  return [];
}

/** Normalizes the `languages` field into a flat {name, bcp47} list. */
function normalizeLanguages(languages) {
  if (!languages) return [];
  if (Array.isArray(languages)) {
    return languages
      .filter(Boolean)
      .map((l) => ({
        name: l.name || l.common || l.english || '',
        bcp47: l.bcp47 || l.bcp_47 || l.code || '',
      }))
      .filter((l) => l.name);
  }
  if (typeof languages === 'object') {
    return Object.entries(languages)
      .filter(([, v]) => v)
      .map(([code, v]) => ({
        name: typeof v === 'string' ? v : v.name || v.common || code,
        bcp47: typeof v === 'object' ? v.bcp47 || '' : '',
      }));
  }
  return [];
}

/** Normalizes `capitals`, which is always documented as an object array,
 *  but we guard against a bare string just in case. */
function normalizeCapitals(capitals) {
  if (!capitals) return [];
  if (typeof capitals === 'string') return [{ name: capitals }];
  if (!Array.isArray(capitals)) return [];
  return capitals.filter(Boolean).map((c) => ({
    name: c.name || '',
    coordinates: c.coordinates || null,
    primary: !!(c.attributes && c.attributes.primary),
  }));
}

/** Leaders come back as an upgrade-notice object on free plans instead
 *  of real leader records. Detect and separate that case. */
function normalizeLeaders(leaders) {
  if (!Array.isArray(leaders) || leaders.length === 0) {
    return { available: false, locked: false, leaders: [] };
  }
  const isLockedNotice = leaders.every(
    (l) => l && typeof l === 'object' && l.message && !l.name
  );
  if (isLockedNotice) {
    return { available: false, locked: true, leaders: [] };
  }
  return {
    available: true,
    locked: false,
    leaders: leaders.filter((l) => l && l.name),
  };
}

/** Known membership keys, in the display order we want, with friendly
 *  labels. Any other true membership flag is still shown, title-cased. */
const MEMBERSHIP_LABELS = {
  un: 'United Nations',
  nato: 'NATO',
  g7: 'G7',
  g20: 'G20',
  commonwealth: 'Commonwealth',
  eu: 'European Union',
  eurozone: 'Eurozone',
  schengen: 'Schengen Area',
  oecd: 'OECD',
  brics: 'BRICS',
  opec: 'OPEC',
  african_union: 'African Union',
  asean: 'ASEAN',
  arab_league: 'Arab League',
};

function normalizeMemberships(memberships) {
  if (!memberships || typeof memberships !== 'object') return [];
  return Object.entries(memberships)
    .filter(([, isMember]) => isMember === true)
    .map(([key]) => ({
      key,
      label:
        MEMBERSHIP_LABELS[key] ||
        key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
}

/** Debounce helper for live-search style input handling. */
function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Reads a nested path like "names.common" out of an object safely. */
function getPath(obj, path, fallback = undefined) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    current = current[part];
  }
  return current === undefined ? fallback : current;
}

/**
 * Shapes one raw REST Countries record into the flat, defensively-
 * normalized view model every rendering function in ui.js relies on.
 * This is the single seam between "whatever the API sent us" and
 * "what the UI is allowed to assume exists."
 */
function toCountryViewModel(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const codes = raw.codes || {};
  const capitals = normalizeCapitals(raw.capitals);
  const primaryCapital = capitals.find((c) => c.primary) || capitals[0] || null;

  return {
    code: codes.alpha_3 || codes.alpha_2 || getPath(raw, 'names.common', 'unknown'),
    alpha2: codes.alpha_2 || null,
    alpha3: codes.alpha_3 || null,
    ccn3: codes.ccn3 || null,
    fifa: codes.fifa || null,
    cioc: codes.cioc || null,

    commonName: getPath(raw, 'names.common', 'Unknown country'),
    officialName: getPath(raw, 'names.official', null),

    region: raw.region || null,
    subregion: raw.subregion || null,

    capitals,
    primaryCapital,

    population: typeof raw.population === 'number' ? raw.population : null,
    area: raw.area || null,
    coordinates: raw.coordinates || null,

    flagEmoji: getPath(raw, 'flag.emoji', null),
    flagSvg: getPath(raw, 'flag.url_svg', null),
    flagPng: getPath(raw, 'flag.url_png', null),

    currencies: normalizeCurrencies(raw.currencies),
    languages: normalizeLanguages(raw.languages),

    borders: Array.isArray(raw.borders) ? raw.borders : [],
    timezones: Array.isArray(raw.timezones) ? raw.timezones : [],
    callingCodes: Array.isArray(raw.calling_codes)
      ? raw.calling_codes
      : Array.isArray(raw.callingCodes)
      ? raw.callingCodes
      : [],
    tlds: Array.isArray(raw.tlds) ? raw.tlds : [],

    memberships: normalizeMemberships(raw.memberships),
    leadersInfo: normalizeLeaders(raw.leaders),

    raw,
  };
}
