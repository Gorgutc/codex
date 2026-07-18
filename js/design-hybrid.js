/* Codex Design Lab: approved R2 Hybrid adapter.
   Black Chamber owns the route shell and Home. This adapter adds the selected
   Specimen Case anatomy and enables the equal-card Free Assets presentation
   without starting a second route or media lifecycle owner. */
(function () {
  'use strict';

  var design = window.CodexDesign;
  var chamber = window.CodexChamber;
  if (!design || design.mode !== 'hybrid' || !chamber || typeof chamber.start !== 'function') return;

  var dossier = null;
  var dossierLabel = null;
  var dossierDescription = null;
  var dossierTypeLabel = null;
  var dossierType = null;
  var dossierToolsLabel = null;
  var dossierTools = null;
  var dossierBack = null;
  var caseFile = null;

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function isRussian() {
    return String(document.documentElement.lang || '').toLowerCase().indexOf('ru') === 0;
  }

  function localCopy() {
    return isRussian() ? {
      overview: 'ОБЗОР',
      type: 'ТИП',
      tools: 'ИНСТРУМЕНТЫ',
      back: '← ИНДЕКС ПРОЕКТОВ',
      dossier: 'Досье проекта'
    } : {
      overview: 'OVERVIEW',
      type: 'TYPE',
      tools: 'TOOLS',
      back: '← PROJECT INDEX',
      dossier: 'Project dossier'
    };
  }

  function ensureCasePresentation() {
    if (dossier && dossier.isConnected) return;
    var caseView = document.getElementById('case-view');
    var caseHeader = caseView && caseView.querySelector('.case-view__header');
    if (!caseView || !caseHeader) return;

    dossier = make('section', 'hybrid-case-dossier');
    dossierLabel = make('p', 'hybrid-case-dossier__label');
    dossierDescription = make('p', 'hybrid-case-dossier__description');
    var facts = make('dl', 'hybrid-case-dossier__facts');
    dossierTypeLabel = make('dt');
    dossierType = make('dd');
    dossierToolsLabel = make('dt');
    dossierTools = make('dd');
    append(facts, dossierTypeLabel, dossierType, dossierToolsLabel, dossierTools);
    dossierBack = make('button', 'hybrid-case-dossier__back');
    dossierBack.type = 'button';
    dossierBack.setAttribute('data-design-back', '');
    append(dossier, dossierLabel, dossierDescription, facts, dossierBack);
    caseHeader.appendChild(dossier);

    var headerTop = document.querySelector('.site-header .header-top');
    if (headerTop) {
      caseFile = make('p', 'hybrid-case-file');
      caseFile.setAttribute('aria-hidden', 'true');
      headerTop.appendChild(caseFile);
    }
  }

  function decorateCaseMedia() {
    var track = document.getElementById('case-scroll-track');
    if (!track) return;
    Array.prototype.slice.call(track.querySelectorAll('.hybrid-case-hero')).forEach(function (row) {
      row.classList.remove('hybrid-case-hero');
    });
    var rows = Array.prototype.slice.call(track.querySelectorAll(':scope > .case-row'));
    var firstMediaRow = rows.filter(function (row) {
      return !!row.querySelector('.case-item__media');
    })[0];
    if (!firstMediaRow) return;
    firstMediaRow.classList.add('hybrid-case-hero');
  }

  function updateCasePresentation(id, project) {
    ensureCasePresentation();
    if (!dossier) return;
    var copy = localCopy();
    var data = window.CARDS_DATA && window.CARDS_DATA[id] ? window.CARDS_DATA[id] : null;
    dossier.setAttribute('aria-label', copy.dossier);
    dossierLabel.textContent = copy.overview;
    dossierDescription.textContent = project && project.description ? project.description : '—';
    dossierTypeLabel.textContent = copy.type;
    dossierType.textContent = data && data.role ? String(data.role) : '—';
    dossierToolsLabel.textContent = copy.tools;
    dossierTools.textContent = data && Array.isArray(data.tools) ? data.tools.join(' · ') : '—';
    dossierBack.textContent = copy.back;
    if (caseFile) {
      var cards = Array.prototype.slice.call(document.querySelectorAll('.work-card[data-id]:not(.tag-card)'));
      var index = Math.max(0, cards.findIndex(function (card) { return card.dataset.id === id; }));
      caseFile.textContent = 'CODEX / CASE FILE ' + String(index + 1).padStart(2, '0');
    }
    decorateCaseMedia();
    var caseView = document.getElementById('case-view');
    if (caseView) caseView.setAttribute('data-hybrid-case-ready', id);
  }

  chamber.start({
    mode: 'hybrid',
    home: true,
    casePresentation: false,
    freeAssetsPresentation: true,
    stableMotion: true,
    caseAdapter: updateCasePresentation
  });
})();
