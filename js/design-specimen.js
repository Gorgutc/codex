/*
 * Codex Specimen OS
 * Optional design adapter loaded after the existing page runtime.
 * It never owns project data or visualization behavior: those stay in
 * cards-data.js, main.js, and free-assets.js.
 */
(function () {
  'use strict';

  var design = window.CodexDesign;
  var root = document.documentElement;
  if (!design || design.mode !== 'specimen' || root.getAttribute('data-design') !== 'specimen') return;

  var body = document.body;
  var isAssetsPage = !!document.getElementById('fa-grid');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i += 1) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function modeUrl(url) {
    if (design && typeof design.withMode === 'function') {
      try { return design.withMode(url); } catch (_) { /* use the safe relative URL */ }
    }
    return url;
  }

  function isModifiedActivation(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (typeof event.button === 'number' && event.button !== 0);
  }

  function dispatchRender(page, state, id) {
    document.dispatchEvent(new CustomEvent('codex:design-render', {
      detail: {
        mode: 'specimen',
        page: page,
        state: state,
        id: id || null
      }
    }));
  }

  function preserveModeLinks(scope) {
    Array.prototype.slice.call((scope || document).querySelectorAll('a[href]')).forEach(function (link) {
      var raw = link.getAttribute('href');
      if (!raw || raw.charAt(0) === '#' || /^(?:https?:|mailto:|tel:|javascript:)/i.test(raw)) return;
      if (raw.indexOf('index.html') === -1 && raw.indexOf('free-assets.html') === -1) return;
      link.setAttribute('href', modeUrl(raw));
    });
  }

  function localCopy() {
    var isRussian = String(root.getAttribute('lang') || '').toLowerCase().indexOf('ru') === 0;
    return isRussian ? {
      projectIndex: 'Индекс проектов',
      filterProjects: 'Фильтр проектов',
      selectedDossier: 'Досье выбранного проекта',
      projectIndexKicker: 'ИНДЕКС ПРОЕКТОВ',
      liveSpecimen: 'ЖИВОЙ ОБРАЗЕЦ',
      ready2d: 'ГОТОВО / 2D',
      inspectHint: 'НАВЕДИТЕ ИЛИ ПЕРЕЙДИТЕ ФОКУСОМ',
      year: 'ГОД',
      type: 'ТИП',
      tools: 'ИНСТРУМЕНТЫ',
      overview: 'ОБЗОР',
      all: 'ВСЕ',
      openDossier: 'ОТКРЫТЬ КЕЙС',
      openCaseAria: 'Открыть кейс: ',
      freeAssets: 'БЕСПЛАТНЫЕ АССЕТЫ',
      contact: 'КОНТАКТ',
      back: '← К ПРОЕКТАМ'
    } : {
      projectIndex: 'Project index',
      filterProjects: 'Filter project index',
      selectedDossier: 'Selected project dossier',
      projectIndexKicker: 'PROJECT INDEX',
      liveSpecimen: 'LIVE SPECIMEN',
      ready2d: 'READY / 2D',
      inspectHint: 'HOVER OR FOCUS TO INSPECT',
      year: 'YEAR',
      type: 'TYPE',
      tools: 'TOOLS',
      overview: 'OVERVIEW',
      all: 'ALL',
      openDossier: 'OPEN DOSSIER',
      openCaseAria: 'Open case study: ',
      freeAssets: 'FREE ASSETS',
      contact: 'CONTACT',
      back: '← PROJECT INDEX'
    };
  }

  preserveModeLinks(document);

  if (isAssetsPage) {
    body.classList.add('specimen-fa-page');
    var specimenAssetsScroll = document.querySelector('.fa-scroll');
    if (specimenAssetsScroll) specimenAssetsScroll.scrollTop = 0;
    window.scrollTo(0, 0);
    window.requestAnimationFrame(function () {
      if (specimenAssetsScroll) specimenAssetsScroll.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    dispatchRender('free-assets', 'catalog');
    window.addEventListener('i18n:changed', function () {
      window.requestAnimationFrame(function () {
        preserveModeLinks(document);
        dispatchRender('free-assets', 'catalog');
      });
    });
    return;
  }

  var main = document.getElementById('main');
  var caseView = document.getElementById('case-view');
  var sourceCards = Array.prototype.slice.call(document.querySelectorAll('.work-card[data-id]'));
  if (!main || !caseView || !sourceCards.length) return;

  body.classList.add('specimen-index-page');

  var cardsById = Object.create(null);
  sourceCards.forEach(function (card) {
    cardsById[card.getAttribute('data-id')] = card;
  });

  var home = el('section', 'specimen-home');
  home.setAttribute('data-design-home', 'specimen');
  home.setAttribute('aria-labelledby', 'specimen-home-title');

  var indexPanel = el('nav', 'specimen-index');
  indexPanel.setAttribute('aria-label', localCopy().projectIndex);
  var indexHead = el('div', 'specimen-index__head');
  var indexKicker = el('span', 'specimen-kicker');
  append(indexHead,
    indexKicker,
    el('span', 'specimen-index__count', String(sourceCards.length).padStart(2, '0'))
  );

  var filters = el('div', 'specimen-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', localCopy().filterProjects);
  var categories = [];
  sourceCards.forEach(function (card) {
    var category = card.getAttribute('data-category') || '';
    if (category && categories.indexOf(category) === -1) categories.push(category);
  });

  var projectList = el('div', 'specimen-projects');
  projectList.id = 'specimen-project-list';
  var projectLinks = [];
  var categoryFilterButtons = Object.create(null);
  var currentSelection = null;
  var routeFocus = '';
  var lastRouteCaseId = '';

  var stage = el('div', 'specimen-stage');
  var stageTop = el('div', 'specimen-stage__top');
  var stageKicker = el('span', 'specimen-kicker');
  var stageStatus = el('span', 'specimen-stage__status');
  append(stageTop,
    stageKicker,
    stageStatus
  );
  var stageMedia = el('div', 'specimen-stage__media');
  var stageImage = document.createElement('img');
  stageImage.className = 'specimen-stage__image';
  stageImage.loading = 'eager';
  stageImage.decoding = 'async';
  stageImage.width = 800;
  stageImage.height = 600;
  stageMedia.appendChild(stageImage);
  var stageFoot = el('div', 'specimen-stage__foot');
  var stageHint = el('span', 'specimen-stage__hint');
  append(stageFoot,
    el('span', 'specimen-stage__coordinate', 'X 00.000 / Y 00.000'),
    stageHint
  );
  append(stage, stageTop, stageMedia, stageFoot);

  var dossier = el('aside', 'specimen-dossier');
  dossier.setAttribute('aria-label', localCopy().selectedDossier);
  var dossierTop = el('div', 'specimen-dossier__top');
  var dossierNumber = el('span', 'specimen-dossier__number', '01');
  var dossierCategory = el('span', 'specimen-dossier__category');
  append(dossierTop, dossierNumber, dossierCategory);
  var dossierTitle = el('h1', 'specimen-dossier__title');
  dossierTitle.id = 'specimen-home-title';
  var dossierDescription = el('p', 'specimen-dossier__description');
  var dossierTable = el('dl', 'specimen-dossier__table');
  var dossierYearLabel = el('dt');
  var dossierYear = el('dd');
  var dossierRoleLabel = el('dt');
  var dossierRole = el('dd');
  var dossierToolsLabel = el('dt');
  var dossierTools = el('dd');
  append(dossierTable,
    dossierYearLabel, dossierYear,
    dossierRoleLabel, dossierRole,
    dossierToolsLabel, dossierTools
  );
  var openCase = el('a', 'specimen-dossier__open');
  var openCaseLabel = el('span', '', localCopy().openDossier);
  openCase.appendChild(openCaseLabel);
  openCase.appendChild(el('span', '', '↗'));
  var dossierLinks = el('div', 'specimen-dossier__links');
  var freeAssetsLink = el('a', '', localCopy().freeAssets);
  freeAssetsLink.href = modeUrl('./free-assets.html');
  var contactLink = el('a', '', localCopy().contact);
  contactLink.href = 'https://t.me/WhiteCatWeb';
  contactLink.target = '_blank';
  contactLink.rel = 'noopener noreferrer';
  append(dossierLinks, freeAssetsLink, contactLink);
  append(dossier,
    dossierTop,
    dossierTitle,
    dossierDescription,
    dossierTable,
    openCase,
    dossierLinks
  );

  function cardText(card, selector) {
    var node = card ? card.querySelector(selector) : null;
    return node ? node.textContent.trim() : '';
  }

  function selectProject(id) {
    var card = cardsById[id];
    if (!card) return;
    currentSelection = id;

    projectLinks.forEach(function (link) {
      link.classList.toggle('is-selected', link.getAttribute('data-id') === id);
    });

    var sourceImage = card.querySelector('.work-card__thumb img');
    if (sourceImage) {
      stageImage.src = sourceImage.currentSrc || sourceImage.getAttribute('src') || '';
      stageImage.alt = sourceImage.getAttribute('alt') || cardText(card, '.work-card__title');
    } else {
      stageImage.removeAttribute('src');
      stageImage.alt = '';
    }

    var index = sourceCards.indexOf(card);
    var data = window.CARDS_DATA && window.CARDS_DATA[id] ? window.CARDS_DATA[id] : null;
    dossierNumber.textContent = String(index + 1).padStart(2, '0');
    dossierCategory.textContent = cardText(card, '.work-card__cat');
    dossierTitle.textContent = cardText(card, '.work-card__title');
    dossierDescription.textContent = cardText(card, '.work-card__desc');
    dossierYear.textContent = cardText(card, '.work-card__year');
    dossierRole.textContent = data && data.role ? String(data.role) : '—';
    dossierTools.textContent = data && Array.isArray(data.tools) ? data.tools.join(' · ') : '—';
    openCase.href = '#' + id;
    openCase.setAttribute('aria-label', localCopy().openCaseAria + dossierTitle.textContent);
  }

  sourceCards.forEach(function (card, index) {
    var id = card.getAttribute('data-id');
    var link = el('a', 'specimen-project');
    link.href = '#' + id;
    link.setAttribute('data-id', id);
    link.setAttribute('data-design-project', id);
    link.setAttribute('data-category', card.getAttribute('data-category') || '');
    var number = el('span', 'specimen-project__number', String(index + 1).padStart(2, '0'));
    var name = el('span', 'specimen-project__name', cardText(card, '.work-card__title'));
    var year = el('span', 'specimen-project__year', cardText(card, '.work-card__year'));
    append(link, number, name, year);
    link.addEventListener('pointerenter', function () { selectProject(id); });
    link.addEventListener('focus', function () { selectProject(id); });
    link.addEventListener('click', function (event) {
      if (!isModifiedActivation(event)) routeFocus = 'case';
    });
    projectLinks.push(link);
    projectList.appendChild(link);
  });

  function applyFilter(filter) {
    var firstVisible = null;
    projectLinks.forEach(function (link) {
      var visible = filter === 'all' || link.getAttribute('data-category') === filter;
      link.hidden = !visible;
      var sourceCard = cardsById[link.getAttribute('data-id')];
      if (sourceCard) sourceCard.hidden = !visible;
      if (visible && !firstVisible) firstVisible = link;
    });
    Array.prototype.slice.call(filters.querySelectorAll('button')).forEach(function (button) {
      var active = button.getAttribute('data-filter') === filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var selectedLink = currentSelection ? projectList.querySelector('[data-id="' + currentSelection + '"]') : null;
    if ((!selectedLink || selectedLink.hidden) && firstVisible) selectProject(firstVisible.getAttribute('data-id'));
  }

  function addFilter(filter, label) {
    var button = el('button', 'specimen-filter', label);
    button.type = 'button';
    button.setAttribute('data-filter', filter);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', function () { applyFilter(filter); });
    filters.appendChild(button);
    return button;
  }

  var allFilterButton = addFilter('all', localCopy().all);
  categories.forEach(function (category) {
    var categoryCard = sourceCards.filter(function (card) {
      return card.getAttribute('data-category') === category;
    })[0];
    categoryFilterButtons[category] = addFilter(category, cardText(categoryCard, '.work-card__cat').toUpperCase());
  });

  var mobileIndexToggle = el('button', 'specimen-index__mobile-toggle');
  mobileIndexToggle.type = 'button';
  mobileIndexToggle.setAttribute('aria-expanded', 'false');
  mobileIndexToggle.setAttribute('aria-controls', projectList.id);
  var mobileIndexToggleLabel = el('span');
  var mobileIndexToggleCount = el('span', '', String(sourceCards.length).padStart(2, '0'));
  append(mobileIndexToggle, mobileIndexToggleLabel, mobileIndexToggleCount);
  mobileIndexToggle.addEventListener('click', function () {
    var expanded = !indexPanel.classList.contains('is-expanded');
    indexPanel.classList.toggle('is-expanded', expanded);
    mobileIndexToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });

  append(indexPanel, indexHead, mobileIndexToggle, filters, projectList);
  append(home, indexPanel, stage, dossier);
  main.insertBefore(home, caseView);
  applyFilter('all');
  selectProject(sourceCards[0].getAttribute('data-id'));

  openCase.addEventListener('click', function (event) {
    if (!isModifiedActivation(event)) routeFocus = 'case';
  });

  var caseDossier = el('div', 'specimen-case-dossier');
  var caseOverviewLabel = el('p', 'specimen-case-dossier__label');
  var caseDescription = el('p', 'specimen-case-dossier__description');
  var caseFacts = el('dl', 'specimen-case-dossier__facts');
  var caseTypeLabel = el('dt');
  var caseType = el('dd');
  var caseToolsLabel = el('dt');
  var caseTools = el('dd');
  append(caseFacts, caseTypeLabel, caseType, caseToolsLabel, caseTools);
  var caseHome = el('button', 'specimen-case-home');
  caseHome.type = 'button';
  caseHome.setAttribute('data-design-back', '');
  caseHome.textContent = localCopy().back;
  append(caseDossier, caseOverviewLabel, caseDescription, caseFacts, caseHome);

  var caseHeader = caseView.querySelector('.case-view__header');
  if (caseHeader) caseHeader.appendChild(caseDossier);

  function updateCaseDossier(id) {
    var card = cardsById[id];
    var data = window.CARDS_DATA && window.CARDS_DATA[id] ? window.CARDS_DATA[id] : null;
    if (!card) return;
    caseDescription.textContent = cardText(card, '.work-card__desc');
    caseType.textContent = data && data.role ? String(data.role) : '—';
    caseTools.textContent = data && Array.isArray(data.tools) ? data.tools.join(' · ') : '—';
  }

  function decorateCaseMedia() {
    var track = document.getElementById('case-scroll-track');
    if (!track) return;
    Array.prototype.slice.call(track.querySelectorAll('.specimen-case-hero')).forEach(function (row) {
      row.classList.remove('specimen-case-hero');
    });
    var rows = Array.prototype.slice.call(track.querySelectorAll(':scope > .case-row'));
    var firstMediaRow = rows.filter(function (row) {
      return !!row.querySelector('.case-item__media');
    })[0];
    if (firstMediaRow) {
      firstMediaRow.classList.add('specimen-case-hero');
      if (track.firstElementChild !== firstMediaRow) track.insertBefore(firstMediaRow, track.firstElementChild);
    }
  }

  function updateLocalCopy() {
    var copy = localCopy();
    indexPanel.setAttribute('aria-label', copy.projectIndex);
    filters.setAttribute('aria-label', copy.filterProjects);
    dossier.setAttribute('aria-label', copy.selectedDossier);
    indexKicker.textContent = copy.projectIndexKicker;
    mobileIndexToggleLabel.textContent = copy.projectIndexKicker;
    stageKicker.textContent = copy.liveSpecimen;
    stageStatus.textContent = copy.ready2d;
    stageHint.textContent = copy.inspectHint;
    dossierYearLabel.textContent = copy.year;
    dossierRoleLabel.textContent = copy.type;
    dossierToolsLabel.textContent = copy.tools;
    caseOverviewLabel.textContent = copy.overview;
    caseTypeLabel.textContent = copy.type;
    caseToolsLabel.textContent = copy.tools;
    allFilterButton.textContent = copy.all;
    categories.forEach(function (category) {
      var categoryCard = sourceCards.filter(function (card) {
        return card.getAttribute('data-category') === category;
      })[0];
      if (categoryFilterButtons[category]) {
        categoryFilterButtons[category].textContent = cardText(categoryCard, '.work-card__cat').toUpperCase();
      }
    });
    openCaseLabel.textContent = copy.openDossier;
    freeAssetsLink.textContent = copy.freeAssets;
    contactLink.textContent = copy.contact;
    caseHome.textContent = copy.back;
    if (currentSelection) selectProject(currentSelection);
  }

  function hashId() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  }

  function stopCaseMedia() {
    if (window.CodexCase && typeof window.CodexCase.leaveCase === 'function') {
      window.CodexCase.leaveCase();
      return;
    }
    var tab2d = document.getElementById('case-tab-2d');
    if (tab2d && tab2d.getAttribute('aria-selected') !== 'true') tab2d.click();
    Array.prototype.slice.call(document.querySelectorAll('.case-motion__video')).forEach(function (video) {
      if (typeof video.pause === 'function') video.pause();
    });
  }

  function goHome(options) {
    options = options || {};
    var isCase = body.classList.contains('specimen-case-active') || !!cardsById[hashId()];
    if (!isCase) {
      if (options.focus) {
        var currentLink = currentSelection && projectList.querySelector('[data-id="' + currentSelection + '"]');
        if (currentLink) currentLink.focus({ preventScroll: true });
      }
      return;
    }
    var cleanUrl = window.location.pathname + window.location.search;
    try {
      history.pushState(null, '', cleanUrl);
    } catch (_) {
      window.location.hash = '';
    }
    if (options.focus) routeFocus = 'home';
    renderRoute();
  }

  function renderRoute() {
    var id = hashId();
    var isCase = !!cardsById[id];
    var wasCase = body.classList.contains('specimen-case-active');
    var shouldResetCasePosition = isCase && (!wasCase || lastRouteCaseId !== id);
    var shouldResumeCase = isCase && !wasCase;
    if (!isCase) stopCaseMedia();
    home.hidden = isCase;
    body.classList.toggle('specimen-home-active', !isCase);
    body.classList.toggle('specimen-case-active', isCase);
    if (isCase) {
      var routedLink = projectList.querySelector('[data-id="' + id + '"]');
      if (routedLink && routedLink.hidden) applyFilter('all');
      selectProject(id);
      updateCaseDossier(id);
      decorateCaseMedia();
      if (shouldResetCasePosition) {
        var caseScroll = document.getElementById('case-scroll');
        if (caseScroll) caseScroll.scrollTop = 0;
        window.scrollTo(0, 0);
        window.requestAnimationFrame(function () {
          if (caseScroll) caseScroll.scrollTop = 0;
          window.scrollTo(0, 0);
        });
      }
    }
    lastRouteCaseId = isCase ? id : '';
    dispatchRender('index', isCase ? 'case' : 'home', isCase ? id : null);
    if (isCase && shouldResetCasePosition) {
      window.requestAnimationFrame(function () {
        document.dispatchEvent(new CustomEvent('codex:viz-change', {
          detail: { mode: '2d', caseId: id }
        }));
      });
    }
    if (shouldResumeCase && window.CodexCase && typeof window.CodexCase.resumeCase === 'function') {
      window.requestAnimationFrame(function () { window.CodexCase.resumeCase(); });
    }
    if (routeFocus) {
      var focusIntent = routeFocus;
      routeFocus = '';
      window.requestAnimationFrame(function () {
        if (focusIntent === 'case') {
          var caseTitle = document.getElementById('case-title');
          if (caseTitle) {
            caseTitle.setAttribute('tabindex', '-1');
            caseTitle.focus({ preventScroll: true });
          }
          return;
        }
        var selectedLink = currentSelection && projectList.querySelector('[data-id="' + currentSelection + '"]');
        if (selectedLink) selectedLink.focus({ preventScroll: true });
      });
    }
  }

  caseHome.addEventListener('click', function () { goHome({ focus: true }); });

  var logoLinks = Array.prototype.slice.call(document.querySelectorAll('#logo-home, .case-mobile-bar__logo'));
  logoLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (isModifiedActivation(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      goHome({ focus: true });
    }, true);
  });

  var caseBack = document.getElementById('case-back');
  if (caseBack) {
    caseBack.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      goHome({ focus: true });
    }, true);
  }

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('popstate', renderRoute);
  document.addEventListener('codex:case-open', function (event) {
    var id = event.detail && event.detail.id;
    var keepCaseRoute = body.classList.contains('specimen-case-active');
    if (id) {
      updateCaseDossier(id);
      // The legacy runtime canonicalizes the first case to an empty hash. In
      // Specimen OS an empty hash is Home, so keep the explicit first-case id
      // when navigation started from an already active Case (or a deep link).
      if (keepCaseRoute && !hashId()) {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search + '#' + id);
        } catch (_) { /* hashchange will still route correctly when available */ }
      }
    }
    renderRoute();
  });

  window.addEventListener('i18n:changed', function () {
    window.requestAnimationFrame(function () {
      projectLinks.forEach(function (link) {
        var card = cardsById[link.getAttribute('data-id')];
        var name = link.querySelector('.specimen-project__name');
        if (name) name.textContent = cardText(card, '.work-card__title');
      });
      updateLocalCopy();
      var activeId = hashId();
      if (cardsById[activeId]) updateCaseDossier(activeId);
      preserveModeLinks(document);
      renderRoute();
    });
  });

  var initialId = String(design.initialHash || '').replace(/^#/, '');
  try { initialId = decodeURIComponent(initialId); } catch (_) { /* keep raw safe id */ }
  if (cardsById[initialId] && !hashId()) {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search + '#' + initialId);
    } catch (_) { /* file previews may not expose History API */ }
  }
  updateLocalCopy();
  renderRoute();
  if (cardsById[initialId] && window.CodexCase && typeof window.CodexCase.openCase === 'function') {
    window.CodexCase.openCase(initialId);
  }
}());
