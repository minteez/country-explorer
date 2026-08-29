/**
 * state.js
 * -----------------------------------------------------------------------
 * A small, framework-free state container. Holds the data the UI needs
 * to render and nothing else (DOM nodes, event listeners, etc. live in
 * ui.js). Subscribers are notified after every update so ui.js can
 * re-render just the pieces that changed.
 */

const State = (() => {
  const listeners = new Set();

  const state = {
    view: 'home', // 'home' | 'explore' | 'favorites' | 'about'
    query: '',
    results: [],
    resultsMeta: null,
    status: 'idle', // 'idle' | 'loading' | 'success' | 'error' | 'empty'
    errorMessage: '',
    selectedCountry: null, // full country record, or null
    detailOpen: false,
    favorites: Storage.getFavorites(),
    recentSearches: Storage.getRecentSearches(),
    theme: Storage.getTheme(),
    randomLoading: false,
  };

  function get() {
    return state;
  }

  function set(patch) {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
})();
