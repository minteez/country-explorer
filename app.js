/**
 * app.js
 * -----------------------------------------------------------------------
 * Wires everything together: reads user interaction, calls Api, updates
 * State, and asks UI to re-render. This is intentionally the only file
 * that listens for DOM events at the top level (event delegation on
 * document.body handles most clicks via data-action attributes).
 */

(function () {
  // A small, curated set of ISO alpha-3 codes used for the "Random
  // Country" feature. REST Countries doesn't expose a dedicated random
  // endpoint, so we pick a code client-side and look up that one record
  // via the exact-match endpoint — a single lightweight request rather
  // than downloading the entire country list just to sample from it.
  const RANDOM_COUNTRY_POOL = [
    'ARG', 'AUS', 'BRA', 'CAN', 'CHL', 'CHN', 'COL', 'EGY', 'ESP', 'ETH',
    'FIN', 'FRA', 'DEU', 'GHA', 'GRC', 'IND', 'IDN', 'IRL', 'ISL', 'ISR',
    'ITA', 'JPN', 'KEN', 'KOR', 'MEX', 'MAR', 'NLD', 'NZL', 'NGA', 'NOR',
    'PER', 'PHL', 'POL', 'PRT', 'ROU', 'RUS', 'SAU', 'SGP', 'ZAF', 'SWE',
    'CHE', 'THA', 'TUR', 'UKR', 'GBR', 'USA', 'VNM', 'ARE', 'URY', 'JAM',
  ];

  let activeSearchController = null;

  // -----------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------

  async function runSearch(query, opts) {
    opts = opts || {};
    const trimmed = query.trim();
    UI.setActiveView('explore');
    State.set({ view: 'explore', query: trimmed });
    syncSearchInputs(trimmed);

    if (!trimmed) {
      State.set({ status: 'idle', results: [] });
      UI.renderExploreEmptyState();
      UI.renderResultsSummary(null);
      return;
    }

    if (activeSearchController) activeSearchController.abort();
    activeSearchController = new AbortController();

    State.set({ status: 'loading' });
    UI.renderSkeletons();
    UI.renderResultsSummary(null);

    try {
      const data = await Api.searchCountries(trimmed, {
        signal: activeSearchController.signal,
      });
      const objects = Array.isArray(data.objects) ? data.objects : [];
      const viewModels = objects.map(toCountryViewModel).filter(Boolean);

      if (!viewModels.length) {
        State.set({ status: 'empty', results: [] });
        UI.renderNoResults(trimmed);
        UI.renderResultsSummary(0, trimmed);
        return;
      }

      State.set({ status: 'success', results: viewModels });
      UI.renderResultsGrid(viewModels, State.get().favorites);
      UI.renderResultsSummary(viewModels.length, trimmed, data.meta);

      if (!opts.silent) {
        const updated = Storage.addRecentSearch(trimmed);
        State.set({ recentSearches: updated });
        UI.renderRecentSearches(updated);
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // superseded by a newer search
      const message =
        err instanceof Api.ApiError
          ? err.friendlyMessage
          : 'Country data is temporarily unavailable. Please try again later.';
      State.set({ status: 'error', errorMessage: message, results: [] });
      UI.renderExploreError(message);
      UI.renderResultsSummary(null);
    }
  }

  function syncSearchInputs(value) {
    UI.els.body.querySelectorAll('#search-input-home, #search-input-explore').forEach((input) => {
      if (input.value !== value) input.value = value;
      toggleClearButton(input);
    });
  }

  function toggleClearButton(input) {
    const field = input.closest('.search-form__field');
    const clearBtn = field && field.querySelector('[data-clear-search]');
    if (clearBtn) clearBtn.hidden = !input.value;
  }

  // -----------------------------------------------------------------
  // Random country
  // -----------------------------------------------------------------

  async function runRandomCountry(button) {
    const code = RANDOM_COUNTRY_POOL[Math.floor(Math.random() * RANDOM_COUNTRY_POOL.length)];
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Loading…';
    try {
      const raw = await Api.getByProperty('codes.alpha_3', code);
      if (!raw) {
        UI.showToast('Couldn\u2019t load a random country. Try again.');
        return;
      }
      const vm = toCountryViewModel(raw);
      State.set({ selectedCountry: vm });
      UI.openDetailPanel(vm, Storage.isFavorite(vm.code));
    } catch (err) {
      const message =
        err instanceof Api.ApiError
          ? err.friendlyMessage
          : 'Country data is temporarily unavailable. Please try again later.';
      UI.showToast(message);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  // -----------------------------------------------------------------
  // Country detail (from a card / favorite / recent list)
  // -----------------------------------------------------------------

  function findViewModelByCode(code) {
    return State.get().results.find((r) => r.code === code) || null;
  }

  async function openDetailsForCode(code) {
    const cached = findViewModelByCode(code);
    if (cached) {
      State.set({ selectedCountry: cached });
      UI.openDetailPanel(cached, Storage.isFavorite(cached.code));
      return;
    }
    // Came from favorites/recents without a cached record — look it up.
    try {
      const raw = await Api.getByProperty('codes.alpha_3', code);
      if (!raw) {
        UI.showToast('That country couldn\u2019t be found.');
        return;
      }
      const vm = toCountryViewModel(raw);
      State.set({ selectedCountry: vm });
      UI.openDetailPanel(vm, Storage.isFavorite(vm.code));
    } catch (err) {
      const message =
        err instanceof Api.ApiError ? err.friendlyMessage : 'Couldn\u2019t load that country.';
      UI.showToast(message);
    }
  }

  // -----------------------------------------------------------------
  // Favorites
  // -----------------------------------------------------------------

  function handleToggleFavorite(code) {
    let vm = findViewModelByCode(code);
    if (!vm && State.get().selectedCountry && State.get().selectedCountry.code === code) {
      vm = State.get().selectedCountry;
    }
    if (!vm) return;

    const record = {
      code: vm.code,
      name: vm.commonName,
      flagEmoji: vm.flagEmoji || '',
    };
    const updated = Storage.toggleFavorite(record);
    const nowFav = updated.some((f) => f.code === code);
    State.set({ favorites: updated });

    UI.updateFavoritesCount(updated.length);
    UI.showToast(nowFav ? vm.commonName + ' added to favorites' : vm.commonName + ' removed from favorites');

    // Refresh any visible favorite toggle buttons for this code.
    document.querySelectorAll('[data-action="toggle-favorite"][data-code="' + cssEscape(code) + '"]').forEach((btn) => {
      if (btn.classList.contains('favorite-toggle')) {
        btn.setAttribute('aria-pressed', String(nowFav));
      }
    });
    if (State.get().selectedCountry && State.get().selectedCountry.code === code) {
      UI.updateDetailFavoriteButton(nowFav);
    }
    if (State.get().view === 'favorites') {
      UI.renderFavoritesView(State.get().favorites);
    }
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
  }

  // -----------------------------------------------------------------
  // Copy actions
  // -----------------------------------------------------------------

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      UI.showToast(successMessage);
    } catch (err) {
      UI.showToast('Couldn\u2019t copy — your browser blocked clipboard access.');
    }
  }

  // -----------------------------------------------------------------
  // Theme
  // -----------------------------------------------------------------

  function initTheme() {
    const stored = Storage.getTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    State.set({ theme });
    UI.applyTheme(theme);
  }

  function toggleTheme() {
    const next = State.get().theme === 'dark' ? 'light' : 'dark';
    State.set({ theme: next });
    Storage.setTheme(next);
    UI.applyTheme(next);
  }

  // -----------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------

  function goToView(view) {
    State.set({ view });
    UI.setActiveView(view);
    if (view === 'favorites') {
      UI.renderFavoritesView(State.get().favorites);
    }
    if (view === 'explore' && State.get().status === 'idle') {
      UI.renderExploreEmptyState();
    }
  }

  // -----------------------------------------------------------------
  // Event wiring
  // -----------------------------------------------------------------

  function wireSearchForms() {
    ['search-form-home', 'search-form-explore'].forEach((formId) => {
      const form = document.getElementById(formId);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="search"]');
        runSearch(input.value);
      });
    });

    ['search-input-home', 'search-input-explore'].forEach((inputId) => {
      const input = document.getElementById(inputId);
      input.addEventListener('input', () => toggleClearButton(input));
    });

    document.getElementById('random-country-btn-home').addEventListener('click', function () {
      runRandomCountry(this);
    });
    document.getElementById('random-country-btn-explore').addEventListener('click', function () {
      runRandomCountry(this);
    });
  }

  function wireNav() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => goToView(btn.dataset.nav));
    });
    UI.els.mobileNavToggle.addEventListener('click', () => UI.toggleMobileNav());
  }

  function wireTheme() {
    UI.els.themeToggle.addEventListener('click', toggleTheme);
  }

  function wireDetailPanel() {
    document.querySelectorAll('[data-close-detail]').forEach((el) => {
      el.addEventListener('click', UI.closeDetailPanel);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && UI.els.detailPanel.classList.contains('is-open')) {
        UI.closeDetailPanel();
      }
    });
  }

  function wireGlobalDelegatedClicks() {
    document.body.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('[data-clear-search]');
      if (clearBtn) {
        const input = clearBtn.closest('.search-form__field').querySelector('input');
        input.value = '';
        toggleClearButton(input);
        input.focus();
        return;
      }

      const exampleChip = e.target.closest('[data-example]');
      if (exampleChip) {
        runSearch(exampleChip.dataset.example);
        return;
      }

      const repeatChip = e.target.closest('[data-action="repeat-search"]');
      if (repeatChip) {
        runSearch(repeatChip.dataset.term);
        return;
      }

      const clearRecent = e.target.closest('#clear-recent-searches');
      if (clearRecent) {
        const updated = Storage.clearRecentSearches();
        State.set({ recentSearches: updated });
        UI.renderRecentSearches(updated);
        return;
      }

      const viewBtn = e.target.closest('[data-action="view-details"]');
      if (viewBtn) {
        openDetailsForCode(viewBtn.dataset.code);
        return;
      }

      const favBtn = e.target.closest('[data-action="toggle-favorite"]');
      if (favBtn) {
        handleToggleFavorite(favBtn.dataset.code);
        return;
      }

      const copyJsonBtn = e.target.closest('[data-action="copy-json"]');
      if (copyJsonBtn) {
        const vm = State.get().selectedCountry;
        if (vm) copyText(JSON.stringify(vm.raw, null, 2), 'Copied!');
        return;
      }

      const copyNameBtn = e.target.closest('[data-action="copy-name"]');
      if (copyNameBtn) {
        const vm = State.get().selectedCountry;
        if (vm) copyText(vm.commonName, 'Copied!');
        return;
      }
    });
  }

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------

  function init() {
    initTheme();
    wireSearchForms();
    wireNav();
    wireTheme();
    wireDetailPanel();
    wireGlobalDelegatedClicks();

    UI.updateFavoritesCount(State.get().favorites.length);
    UI.renderRecentSearches(State.get().recentSearches);
    UI.setActiveView('home');

    if (isDemoMode()) {
      // Purely informational — never logs the key itself.
      console.info(
        'Country Explorer is running in demo mode (using the public REST Countries demo key). ' +
          'Set CONFIG.API_KEY in js/config.js to use your own account.'
      );
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
