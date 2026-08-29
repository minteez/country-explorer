/**
 * storage.js
 * -----------------------------------------------------------------------
 * The only module that touches localStorage. Everything else asks this
 * module for data instead of reading/writing storage directly, which
 * keeps persistence logic in one place and easy to audit.
 *
 * We only ever store: favorite country codes/names, recent search terms,
 * and the theme preference. Never API credentials.
 */

const Storage = (() => {
  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Storage: failed to read "${key}"`, err);
      return fallback;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`Storage: failed to write "${key}"`, err);
      return false;
    }
  }

  // ---- Favorites --------------------------------------------------------
  // Stored as an array of { code, name, flagEmoji } — the minimum needed
  // to render the favorites list without another API call.

  function getFavorites() {
    return safeRead(CONFIG.STORAGE_KEYS.FAVORITES, []);
  }

  function isFavorite(code) {
    return getFavorites().some((f) => f.code === code);
  }

  function addFavorite(country) {
    const favorites = getFavorites();
    if (favorites.some((f) => f.code === country.code)) return favorites;
    const updated = [...favorites, country];
    safeWrite(CONFIG.STORAGE_KEYS.FAVORITES, updated);
    return updated;
  }

  function removeFavorite(code) {
    const updated = getFavorites().filter((f) => f.code !== code);
    safeWrite(CONFIG.STORAGE_KEYS.FAVORITES, updated);
    return updated;
  }

  function toggleFavorite(country) {
    return isFavorite(country.code)
      ? removeFavorite(country.code)
      : addFavorite(country);
  }

  // ---- Recent searches ----------------------------------------------------

  function getRecentSearches() {
    return safeRead(CONFIG.STORAGE_KEYS.RECENT_SEARCHES, []);
  }

  function addRecentSearch(term) {
    const trimmed = term.trim();
    if (!trimmed) return getRecentSearches();
    const existing = getRecentSearches().filter(
      (t) => t.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...existing].slice(
      0,
      CONFIG.RECENT_SEARCHES_MAX
    );
    safeWrite(CONFIG.STORAGE_KEYS.RECENT_SEARCHES, updated);
    return updated;
  }

  function clearRecentSearches() {
    safeWrite(CONFIG.STORAGE_KEYS.RECENT_SEARCHES, []);
    return [];
  }

  // ---- Theme --------------------------------------------------------------

  function getTheme() {
    return safeRead(CONFIG.STORAGE_KEYS.THEME, null);
  }

  function setTheme(theme) {
    safeWrite(CONFIG.STORAGE_KEYS.THEME, theme);
  }

  return {
    getFavorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    getRecentSearches,
    addRecentSearch,
    clearRecentSearches,
    getTheme,
    setTheme,
  };
})();
