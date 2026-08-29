/**
 * api.js
 * -----------------------------------------------------------------------
 * The only module that talks to the network. Every REST Countries call
 * in the app funnels through here, which means:
 *   - the Authorization header is set in exactly one place
 *   - error handling/shape-parsing is written once
 *   - swapping the base URL for a backend proxy later is a one-line change
 *
 * Every function returns a plain, already-unwrapped JS value (array or
 * object) or throws an ApiError with a user-safe `.friendlyMessage`.
 */

class ApiError extends Error {
  constructor(friendlyMessage, { status = null, cause = null } = {}) {
    super(friendlyMessage);
    this.name = 'ApiError';
    this.friendlyMessage = friendlyMessage;
    this.status = status;
    this.cause = cause;
  }
}

const Api = (() => {
  /** Builds request headers. The key never gets logged or stored. */
  function buildHeaders() {
    return {
      Authorization: `Bearer ${getActiveApiKey()}`,
    };
  }

  /** Converts REST Countries' `{ errors: [{message}] }` shape and raw
   *  network failures into one friendly, user-facing message. */
  function friendlyMessageFor(status, rawMessage) {
    if (status === 400) {
      return 'That search didn\u2019t look valid. Try a different term.';
    }
    if (status === 401) {
      return 'Country data is temporarily unavailable (invalid API key).';
    }
    if (status === 403) {
      return 'This request needs a higher-tier plan or the account has hit its monthly limit.';
    }
    if (status === 404) {
      return 'No matching country data was found.';
    }
    if (status === 429) {
      return 'Too many requests right now. Please wait a moment and try again.';
    }
    if (status && status >= 500) {
      return 'Country data is temporarily unavailable. Please try again later.';
    }
    return rawMessage || 'Something went wrong talking to the country data service.';
  }

  /** Shared fetch + response handling for every endpoint below. */
  async function request(path, { signal } = {}) {
    let response;
    try {
      response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        headers: buildHeaders(),
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err; // let callers ignore these
      throw new ApiError(
        'We couldn\u2019t connect to the country data service. Please check your connection and try again.',
        { cause: err }
      );
    }

    let body = null;
    try {
      body = await response.json();
    } catch (err) {
      if (!response.ok) {
        throw new ApiError(friendlyMessageFor(response.status), {
          status: response.status,
        });
      }
      throw new ApiError(
        'Country data came back in an unexpected format.',
        { cause: err }
      );
    }

    if (!response.ok) {
      const rawMessage = body?.errors?.[0]?.message;
      throw new ApiError(friendlyMessageFor(response.status, rawMessage), {
        status: response.status,
      });
    }

    return body?.data ?? { objects: [], meta: {} };
  }

  /**
   * Free-text search across every searchable property (name, capital,
   * ISO codes, etc). Returns { objects, meta }.
   */
  async function searchCountries(query, { signal, limit = CONFIG.SEARCH_LIMIT } = {}) {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new ApiError('Enter a country, capital, or ISO code.', {
        status: 400,
      });
    }
    const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
    return request(`?${params.toString()}`, { signal });
  }

  /**
   * Exact lookup by a known property, e.g. getByProperty('codes.alpha_3', 'CAN').
   * Used to fetch full detail for a card the user already has a code for,
   * and by the random-country feature.
   */
  async function getByProperty(property, value, { signal } = {}) {
    const data = await request(
      `/${encodeURIComponent(property)}/${encodeURIComponent(value)}`,
      { signal }
    );
    return data.objects?.[0] || null;
  }

  return { searchCountries, getByProperty, ApiError };
})();
