/**
 * ui.js
 * -----------------------------------------------------------------------
 * Everything that touches the DOM lives here: building markup from view
 * models, opening/closing the detail panel, toasts, theme application,
 * and swapping between the four top-level views. app.js wires user
 * interaction to these functions and to State/Api; ui.js never calls
 * fetch() or reads localStorage directly.
 */

const UI = (() => {
  const els = {
    body: document.body,
    header: document.querySelector('.site-header'),
    mainNav: document.getElementById('main-nav'),
    mobileNavToggle: document.getElementById('mobile-nav-toggle'),
    themeToggle: document.getElementById('theme-toggle'),
    favoritesCount: document.getElementById('favorites-count'),

    views: {
      home: document.getElementById('view-home'),
      explore: document.getElementById('view-explore'),
      favorites: document.getElementById('view-favorites'),
      about: document.getElementById('view-about'),
    },

    exploreContent: document.getElementById('explore-content'),
    resultsSummary: document.getElementById('results-summary'),
    recentSearchesWrap: document.getElementById('recent-searches'),
    recentSearchesList: document.getElementById('recent-searches-list'),

    favoritesContent: document.getElementById('favorites-content'),

    detailScrim: document.getElementById('detail-scrim'),
    detailPanel: document.getElementById('detail-panel'),
    detailBody: document.getElementById('detail-panel-body'),

    toast: document.getElementById('toast'),
  };

  let toastTimer = null;

  // ---------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------

  function applyTheme(theme) {
    els.body.setAttribute('data-theme', theme);
    els.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    els.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  // ---------------------------------------------------------------------
  // Navigation / view switching
  // ---------------------------------------------------------------------

  function setActiveView(view) {
    Object.entries(els.views).forEach(([name, el]) => {
      el.hidden = name !== view;
    });
    document.querySelectorAll('.nav-link[data-nav]').forEach((btn) => {
      if (btn.dataset.nav === view) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
    closeMobileNav();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function toggleMobileNav(forceOpen) {
    const isOpen = els.mainNav.classList.contains('is-open');
    const next = forceOpen !== undefined ? forceOpen : !isOpen;
    els.mainNav.classList.toggle('is-open', next);
    els.mobileNavToggle.setAttribute('aria-expanded', String(next));
  }

  function closeMobileNav() {
    toggleMobileNav(false);
  }

  // ---------------------------------------------------------------------
  // Favorites badge
  // ---------------------------------------------------------------------

  function updateFavoritesCount(count) {
    if (count > 0) {
      els.favoritesCount.hidden = false;
      els.favoritesCount.textContent = String(count);
    } else {
      els.favoritesCount.hidden = true;
    }
  }

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 2200);
  }

  // ---------------------------------------------------------------------
  // Flag element (shared by cards + detail header)
  // ---------------------------------------------------------------------

  function buildFlagImg(vm, className) {
    const img = document.createElement('img');
    img.className = className;
    img.loading = 'lazy';
    img.alt = 'Flag of ' + vm.commonName;
    img.src = vm.flagPng || vm.flagSvg || '';
    img.width = 92;
    img.height = 68;
    img.addEventListener(
      'error',
      () => {
        const span = document.createElement('span');
        span.className = className.indexOf('card') !== -1
          ? 'country-card__flag-emoji'
          : 'detail-header__emoji';
        span.textContent = vm.flagEmoji || String.fromCodePoint(0x1f3f3);
        span.setAttribute('role', 'img');
        span.setAttribute('aria-label', 'Flag of ' + vm.commonName);
        img.replaceWith(span);
      },
      { once: true }
    );
    if (!vm.flagPng && !vm.flagSvg) {
      queueMicrotask(() => img.dispatchEvent(new Event('error')));
    }
    return img;
  }

  // ---------------------------------------------------------------------
  // Country card
  // ---------------------------------------------------------------------

  function buildCountryCard(vm, isFav) {
    const card = document.createElement('article');
    card.className = 'country-card bracket-frame';
    card.dataset.code = vm.code;

    const top = document.createElement('div');
    top.className = 'country-card__top';
    top.appendChild(buildFlagImg(vm, 'country-card__flag'));

    const names = document.createElement('div');
    names.className = 'country-card__names';
    names.innerHTML =
      '<div class="country-card__common">' + escapeHtml(vm.commonName) + '</div>' +
      '<div class="country-card__official">' + escapeHtml(orFallback(vm.officialName, '')) + '</div>';
    top.appendChild(names);
    card.appendChild(top);

    const stats = document.createElement('dl');
    stats.className = 'country-card__stats';
    const capitalText = vm.primaryCapital && vm.primaryCapital.name
      ? orFallback(vm.primaryCapital.name)
      : 'No capital';
    const currency = vm.currencies[0]
      ? (vm.currencies[0].code || orFallback(vm.currencies[0].name))
      : FALLBACK_TEXT;
    stats.innerHTML =
      '<div class="country-card__stat"><dt>Capital</dt><dd>' + escapeHtml(capitalText) + '</dd></div>' +
      '<div class="country-card__stat"><dt>Region</dt><dd>' + escapeHtml(orFallback(vm.region)) + '</dd></div>' +
      '<div class="country-card__stat"><dt>Population</dt><dd>' + escapeHtml(formatPopulation(vm.population)) + '</dd></div>' +
      '<div class="country-card__stat"><dt>Currency</dt><dd>' + escapeHtml(currency) + '</dd></div>';
    card.appendChild(stats);

    const langs = document.createElement('div');
    langs.className = 'country-card__langs';
    langs.textContent = vm.languages.length
      ? vm.languages.map((l) => l.name).join(', ')
      : 'Languages: ' + FALLBACK_TEXT;
    card.appendChild(langs);

    const footer = document.createElement('div');
    footer.className = 'country-card__footer';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'country-card__view';
    viewBtn.dataset.action = 'view-details';
    viewBtn.dataset.code = vm.code;
    viewBtn.innerHTML = 'View Details <span aria-hidden="true">\u2192</span>';
    footer.appendChild(viewBtn);

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'favorite-toggle';
    favBtn.dataset.action = 'toggle-favorite';
    favBtn.dataset.code = vm.code;
    favBtn.setAttribute('aria-pressed', String(!!isFav));
    favBtn.setAttribute(
      'aria-label',
      (isFav ? 'Remove ' : 'Add ') + vm.commonName + (isFav ? ' from favorites' : ' to favorites')
    );
    favBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.2-4.6-9.8-9C.6 8.4 2 4.8 5.4 4a5 5 0 0 1 6.6 2 5 5 0 0 1 6.6-2c3.4.8 4.8 4.4 3.2 8-2.6 4.4-9.8 9-9.8 9z"/></svg>';
    footer.appendChild(favBtn);

    card.appendChild(footer);

    const bl = document.createElement('span');
    bl.className = 'bracket-frame__bl';
    bl.setAttribute('aria-hidden', 'true');
    const br = document.createElement('span');
    br.className = 'bracket-frame__br';
    br.setAttribute('aria-hidden', 'true');
    card.appendChild(bl);
    card.appendChild(br);

    return card;
  }

  function renderResultsGrid(viewModels, favorites) {
    const favSet = new Set(favorites.map((f) => f.code));
    const grid = document.createElement('div');
    grid.className = 'results-grid';
    viewModels.forEach((vm) => {
      grid.appendChild(buildCountryCard(vm, favSet.has(vm.code)));
    });
    els.exploreContent.replaceChildren(grid);
  }

  function renderSkeletons(count) {
    count = count || 6;
    const grid = document.createElement('div');
    grid.className = 'skeleton-grid';
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton-card';
      grid.appendChild(sk);
    }
    els.exploreContent.replaceChildren(grid);
  }

  function renderStatePanel(opts) {
    const wrap = document.createElement('div');
    wrap.className = ('state-panel ' + (opts.variant ? 'state-panel--' + opts.variant : '')).trim();
    wrap.innerHTML =
      '<div class="state-panel__icon" aria-hidden="true">' + opts.icon + '</div>' +
      '<div class="state-panel__title">' + escapeHtml(opts.title) + '</div>' +
      '<p class="state-panel__desc">' + escapeHtml(opts.desc) + '</p>';
    els.exploreContent.replaceChildren(wrap);
  }

  function renderExploreEmptyState() {
    renderStatePanel({
      icon: '\u{1F9ED}',
      title: 'Explore the world',
      desc: 'Search for a country, capital, or ISO code to begin.',
    });
  }

  function renderNoResults(query) {
    renderStatePanel({
      icon: '\u{1F50D}',
      title: 'No countries found for "' + query + '"',
      desc: 'Try another country name, capital, or ISO code.',
    });
  }

  function renderExploreError(message) {
    renderStatePanel({
      icon: '\u26A0\uFE0F',
      title: 'Something went wrong',
      desc: message,
      variant: 'error',
    });
  }

  function renderResultsSummary(count, query) {
    if (count === null) {
      els.resultsSummary.textContent = '';
      return;
    }
    const demoNote = isDemoMode() ? ' \u00b7 demo data' : '';
    els.resultsSummary.textContent = query
      ? count + ' result' + (count === 1 ? '' : 's') + ' for "' + query + '"' + demoNote
      : '';
  }

  // ---------------------------------------------------------------------
  // Recent searches
  // ---------------------------------------------------------------------

  function renderRecentSearches(terms) {
    if (!terms.length) {
      els.recentSearchesWrap.hidden = true;
      return;
    }
    els.recentSearchesWrap.hidden = false;
    els.recentSearchesList.replaceChildren();
    terms.forEach((term) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.action = 'repeat-search';
      chip.dataset.term = term;
      chip.textContent = term;
      els.recentSearchesList.appendChild(chip);
    });
  }

  // ---------------------------------------------------------------------
  // Favorites view
  // ---------------------------------------------------------------------

  function renderFavoritesView(favorites) {
    if (!favorites.length) {
      els.favoritesContent.innerHTML =
        '<div class="state-panel">' +
        '<div class="state-panel__icon" aria-hidden="true">\u2606</div>' +
        '<div class="state-panel__title">You haven\u2019t saved any countries yet.</div>' +
        '<p class="state-panel__desc">Tap the heart icon on any country card to save it here.</p>' +
        '</div>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'favorites-grid';
    favorites.forEach((fav) => {
      const row = document.createElement('div');
      row.className = 'favorite-row bracket-frame';
      row.innerHTML =
        '<span class="favorite-row__flag" aria-hidden="true">' + (fav.flagEmoji || '\ud83c\udff3\ufe0f') + '</span>' +
        '<button type="button" class="favorite-row__name" data-action="view-details" data-code="' + escapeHtml(fav.code) + '">' +
        escapeHtml(fav.name) +
        '</button>' +
        '<button type="button" class="favorite-row__remove" data-action="toggle-favorite" data-code="' + escapeHtml(fav.code) + '" aria-label="Remove ' + escapeHtml(fav.name) + ' from favorites">\u00d7</button>';
      grid.appendChild(row);
    });
    els.favoritesContent.replaceChildren(grid);
  }

  // ---------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------

  function buildStatCard(value, label) {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = '<span class="stat-card__value">' + escapeHtml(value) + '</span><span class="stat-card__label">' + escapeHtml(label) + '</span>';
    return div;
  }

  function buildSection(title, buildBody) {
    const section = document.createElement('section');
    section.className = 'detail-section';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    section.appendChild(h3);
    section.appendChild(buildBody());
    return section;
  }

  function buildDetailMarkup(vm, isFav) {
    const container = document.createElement('div');

    const header = document.createElement('div');
    header.className = 'detail-header';
    header.appendChild(buildFlagImg(vm, 'detail-header__flag'));
    const names = document.createElement('div');
    const codePills = [
      vm.alpha2 ? '<span class="code-pill">' + escapeHtml(vm.alpha2) + '</span>' : '',
      vm.alpha3 ? '<span class="code-pill">' + escapeHtml(vm.alpha3) + '</span>' : '',
    ].join('');
    names.innerHTML =
      '<h2 id="detail-country-name" class="detail-header__common">' + escapeHtml(vm.commonName) + '</h2>' +
      '<div class="detail-header__official">' + escapeHtml(orFallback(vm.officialName, '')) + '</div>' +
      '<div class="detail-header__codes">' + codePills + '</div>';
    header.appendChild(names);
    container.appendChild(header);

    const statGrid = document.createElement('div');
    statGrid.className = 'stat-grid';
    statGrid.appendChild(buildStatCard(formatPopulation(vm.population), 'Population'));
    statGrid.appendChild(buildStatCard(vm.area ? formatArea(vm.area.kilometers, 'km\u00b2') : FALLBACK_TEXT, 'Area'));
    statGrid.appendChild(buildStatCard(orFallback(vm.primaryCapital && vm.primaryCapital.name), 'Capital'));
    statGrid.appendChild(buildStatCard(String(vm.borders.length), 'Bordering countries'));
    statGrid.appendChild(buildStatCard(String(vm.timezones.length), 'Time zones'));
    statGrid.appendChild(buildStatCard(String(vm.languages.length), 'Languages'));
    statGrid.appendChild(buildStatCard(String(vm.currencies.length), 'Currencies'));
    statGrid.appendChild(buildStatCard(orFallback(vm.region), 'Region'));
    container.appendChild(statGrid);

    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    actions.innerHTML =
      '<button type="button" class="btn btn--ghost" data-action="toggle-favorite" data-code="' + escapeHtml(vm.code) + '" aria-pressed="' + isFav + '">' +
      (isFav ? '\u2605 Saved to Favorites' : '\u2606 Add to Favorites') +
      '</button>' +
      '<button type="button" class="btn btn--ghost" data-action="copy-name" data-code="' + escapeHtml(vm.code) + '">Copy Country Name</button>';
    container.appendChild(actions);

    container.appendChild(
      buildSection('Geography', function () {
        const dl = document.createElement('dl');
        dl.className = 'kv-grid';
        const coordText = vm.coordinates
          ? formatCoordinatePair(vm.coordinates.lat, vm.coordinates.lng)
          : null;
        const capitalCoordText = vm.primaryCapital && vm.primaryCapital.coordinates
          ? formatCoordinatePair(vm.primaryCapital.coordinates.lat, vm.primaryCapital.coordinates.lng)
          : null;
        dl.innerHTML =
          '<dt>Region</dt><dd>' + escapeHtml(orFallback(vm.region)) + '</dd>' +
          '<dt>Subregion</dt><dd>' + escapeHtml(orFallback(vm.subregion)) + '</dd>' +
          '<dt>Area (km\u00b2)</dt><dd>' + escapeHtml(vm.area ? formatArea(vm.area.kilometers, 'km\u00b2') : FALLBACK_TEXT) + '</dd>' +
          '<dt>Area (mi\u00b2)</dt><dd>' + escapeHtml(vm.area ? formatArea(vm.area.miles, 'mi\u00b2') : FALLBACK_TEXT) + '</dd>' +
          '<dt>Capital coordinates</dt><dd>' + escapeHtml(capitalCoordText || 'Coordinates unavailable') + '</dd>' +
          '<dt>Country coordinates</dt><dd>' + escapeHtml(coordText || 'Coordinates unavailable') + '</dd>';
        const wrap = document.createElement('div');
        wrap.appendChild(dl);

        const borderList = document.createElement('div');
        borderList.className = 'pill-list pill-list--spaced';
        if (vm.borders.length) {
          vm.borders.forEach((code) => {
            const pill = document.createElement('span');
            pill.className = 'pill pill--mono';
            pill.textContent = code;
            borderList.appendChild(pill);
          });
        } else {
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = 'No land borders';
          borderList.appendChild(pill);
        }
        wrap.appendChild(borderList);

        if (vm.timezones.length) {
          const tzList = document.createElement('div');
          tzList.className = 'pill-list pill-list--spaced-lg';
          vm.timezones.forEach((tz) => {
            const pill = document.createElement('span');
            pill.className = 'pill pill--mono';
            pill.textContent = tz;
            tzList.appendChild(pill);
          });
          wrap.appendChild(tzList);
        }
        return wrap;
      })
    );

    container.appendChild(
      buildSection('Economy', function () {
        const wrap = document.createElement('div');
        if (!vm.currencies.length) {
          wrap.innerHTML = '<p>' + FALLBACK_TEXT + '</p>';
          return wrap;
        }
        wrap.className = 'pill-list';
        vm.currencies.forEach((c) => {
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = [c.name, c.code, c.symbol].filter(Boolean).join(' \u00b7 ') || FALLBACK_TEXT;
          wrap.appendChild(pill);
        });
        return wrap;
      })
    );

    container.appendChild(
      buildSection('Languages', function () {
        const wrap = document.createElement('div');
        if (!vm.languages.length) {
          wrap.innerHTML = '<p>' + FALLBACK_TEXT + '</p>';
          return wrap;
        }
        wrap.className = 'pill-list';
        vm.languages.forEach((l) => {
          const pill = document.createElement('span');
          pill.className = 'pill';
          pill.textContent = l.bcp47 ? l.name + ' \u00b7 ' + l.bcp47 : l.name;
          wrap.appendChild(pill);
        });
        return wrap;
      })
    );

    container.appendChild(
      buildSection('Political Information', function () {
        const wrap = document.createElement('div');
        if (vm.leadersInfo.locked) {
          wrap.innerHTML = '<p>Leadership data requires a higher-tier API plan and isn\u2019t available in this view.</p>';
        } else if (!vm.leadersInfo.available) {
          wrap.innerHTML = '<p>' + FALLBACK_TEXT + '</p>';
        } else {
          vm.leadersInfo.leaders.forEach((leader) => {
            const row = document.createElement('div');
            row.className = 'leader-card';
            row.innerHTML =
              '<span class="leader-card__name">' + escapeHtml(leader.name) + '</span>' +
              '<span class="leader-card__title">' + escapeHtml(orFallback(leader.title, '')) + '</span>';
            wrap.appendChild(row);
          });
        }
        return wrap;
      })
    );

    container.appendChild(
      buildSection('International Memberships', function () {
        const wrap = document.createElement('div');
        if (!vm.memberships.length) {
          wrap.innerHTML = '<p>' + FALLBACK_TEXT + '</p>';
          return wrap;
        }
        wrap.className = 'badge-list';
        vm.memberships.forEach((m) => {
          const badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = m.label;
          wrap.appendChild(badge);
        });
        return wrap;
      })
    );

    container.appendChild(
      buildSection('Communications', function () {
        const dl = document.createElement('dl');
        dl.className = 'kv-grid';
        dl.innerHTML =
          '<dt>Calling codes</dt><dd>' + escapeHtml(vm.callingCodes.length ? vm.callingCodes.map((c) => '+' + c).join(', ') : FALLBACK_TEXT) + '</dd>' +
          '<dt>Internet TLDs</dt><dd>' + escapeHtml(vm.tlds.length ? vm.tlds.join(', ') : FALLBACK_TEXT) + '</dd>';
        return dl;
      })
    );

    container.appendChild(
      buildSection('Country Codes', function () {
        const dl = document.createElement('dl');
        dl.className = 'kv-grid';
        const rows = [
          ['Alpha-2', vm.alpha2],
          ['Alpha-3', vm.alpha3],
          ['CCN3', vm.ccn3],
          ['FIFA', vm.fifa],
          ['CIOC', vm.cioc],
        ].filter((pair) => !isEmpty(pair[1]));
        dl.innerHTML = rows
          .map((pair) => '<dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + '</dd>')
          .join('');
        return dl;
      })
    );

    const details = document.createElement('details');
    details.className = 'json-viewer';
    const summary = document.createElement('summary');
    summary.textContent = 'View API Data';
    details.appendChild(summary);
    const toolbar = document.createElement('div');
    toolbar.className = 'json-viewer__toolbar';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'text-button';
    copyBtn.dataset.action = 'copy-json';
    copyBtn.dataset.code = vm.code;
    copyBtn.textContent = 'Copy JSON';
    toolbar.appendChild(copyBtn);
    details.appendChild(toolbar);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(vm.raw, null, 2);
    details.appendChild(pre);
    container.appendChild(details);

    return container;
  }

  function openDetailPanel(vm, isFav) {
    els.detailBody.replaceChildren(buildDetailMarkup(vm, isFav));
    els.detailScrim.hidden = false;
    els.detailPanel.hidden = false;
    void els.detailPanel.offsetWidth;
    els.detailScrim.classList.add('is-visible');
    els.detailPanel.classList.add('is-open');
    els.detailPanel.setAttribute('aria-hidden', 'false');
    els.detailBody.focus();
    els.body.style.overflow = 'hidden';
  }

  function closeDetailPanel() {
    els.detailScrim.classList.remove('is-visible');
    els.detailPanel.classList.remove('is-open');
    els.detailPanel.setAttribute('aria-hidden', 'true');
    els.body.style.overflow = '';
    setTimeout(() => {
      if (!els.detailPanel.classList.contains('is-open')) {
        els.detailScrim.hidden = true;
        els.detailPanel.hidden = true;
      }
    }, 220);
  }

  function updateDetailFavoriteButton(isFav) {
    const btn = els.detailBody.querySelector('[data-action="toggle-favorite"]');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(isFav));
    btn.textContent = isFav ? '\u2605 Saved to Favorites' : '\u2606 Add to Favorites';
  }

  return {
    els: els,
    applyTheme: applyTheme,
    setActiveView: setActiveView,
    toggleMobileNav: toggleMobileNav,
    closeMobileNav: closeMobileNav,
    updateFavoritesCount: updateFavoritesCount,
    showToast: showToast,
    renderResultsGrid: renderResultsGrid,
    renderSkeletons: renderSkeletons,
    renderExploreEmptyState: renderExploreEmptyState,
    renderNoResults: renderNoResults,
    renderExploreError: renderExploreError,
    renderResultsSummary: renderResultsSummary,
    renderRecentSearches: renderRecentSearches,
    renderFavoritesView: renderFavoritesView,
    openDetailPanel: openDetailPanel,
    closeDetailPanel: closeDetailPanel,
    updateDetailFavoriteButton: updateDetailFavoriteButton,
  };
})();
