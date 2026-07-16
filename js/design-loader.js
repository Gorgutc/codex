/* Codex Design Lab: load one opt-in direction (including its ordered shared
   foundation assets) and keep that mode on same-origin page links. Original
   mode requests no variant CSS or JS. */
(function () {
  'use strict';

  var Design = window.CodexDesign;
  var assets = {
    specimen: {
      css: ['./css/design-specimen.css'],
      js: ['./js/design-specimen.js']
    },
    chamber: {
      css: ['./css/design-chamber.css'],
      js: ['./js/design-chamber.js']
    },
    hybrid: {
      css: ['./css/design-chamber.css', './css/design-hybrid.css'],
      js: ['./js/design-chamber.js', './js/design-hybrid.js']
    }
  };
  var selected = Design && Object.prototype.hasOwnProperty.call(assets, Design.mode)
    ? assets[Design.mode]
    : null;
  if (!selected) return;

  var hybridPendingStyles = Design.mode === 'hybrid' ? selected.css.length : 0;
  var hybridRuntimeReady = false;
  var hybridBooted = false;
  var hybridRuntimeStarted = false;
  var failOpenTimer = 0;
  var hybridGate = null;

  if (Design.mode === 'hybrid') {
    document.documentElement.setAttribute('data-design-runtime-state', 'pending');
    document.addEventListener('codex:preloader-done', function () {
      createHybridGate();
      revealHybridGate();
      armFailOpenTimer();
    }, { once: true });
    document.addEventListener('codex:design-runtime-ready', markHybridReady);
  }

  function removeHybridGate() {
    if (!hybridGate) return;
    hybridGate.remove();
    hybridGate = null;
  }

  function updateHybridGateLanguage(language) {
    if (!hybridGate) return;
    var russian = String(language || '').toLowerCase().indexOf('ru') === 0;
    hybridGate.setAttribute(
      'aria-label',
      russian ? 'Загрузка варианта Hybrid' : 'Loading Hybrid design preview'
    );
    hybridGate.querySelector('.design-runtime-gate__status').textContent = russian
      ? 'ИНИЦИАЛИЗАЦИЯ HYBRID'
      : 'INITIALIZING HYBRID PREVIEW';
  }

  function revealHybridGate() {
    if (!hybridGate ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending') return;
    hybridGate.hidden = false;
  }

  function createHybridGate() {
    if (Design.mode !== 'hybrid' || hybridGate ||
        !document.body ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending') return;
    hybridGate = document.createElement('div');
    hybridGate.className = 'design-runtime-gate';
    hybridGate.setAttribute('role', 'status');
    hybridGate.setAttribute('aria-live', 'polite');
    hybridGate.setAttribute('aria-atomic', 'true');
    hybridGate.hidden = document.documentElement.classList.contains('is-loading');
    var wordmark = document.createElement('strong');
    wordmark.className = 'design-runtime-gate__wordmark';
    wordmark.textContent = 'CODEX';
    var status = document.createElement('span');
    status.className = 'design-runtime-gate__status';
    hybridGate.append(wordmark, status);
    document.body.insertBefore(hybridGate, document.body.firstChild);
    var requestedLanguage;
    try { requestedLanguage = new URLSearchParams(window.location.search).get('lang') || ''; }
    catch (_error) { requestedLanguage = ''; }
    updateHybridGateLanguage(requestedLanguage || document.documentElement.lang);
    window.addEventListener('i18n:changed', function (event) {
      updateHybridGateLanguage(event.detail && event.detail.lang);
    });
    if (!hybridGate.hidden) revealHybridGate();
  }

  function failOpenHybrid() {
    if (Design.mode !== 'hybrid' ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending') return;
    document.documentElement.setAttribute('data-design-runtime-state', 'fallback');
    removeHybridGate();
  }

  function armFailOpenTimer() {
    if (failOpenTimer || Design.mode !== 'hybrid' ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending') return;
    failOpenTimer = window.setTimeout(failOpenHybrid, 4000);
  }

  function markHybridReady() {
    if (Design.mode !== 'hybrid' || hybridPendingStyles !== 0 || !hybridRuntimeReady ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending' ||
        document.documentElement.getAttribute('data-design-runtime-ready') !== 'hybrid') return;
    if (failOpenTimer) window.clearTimeout(failOpenTimer);
    document.documentElement.setAttribute('data-design-runtime-state', 'ready');
    removeHybridGate();
  }

  selected.css.forEach(function (href, index) {
    var stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = href;
    stylesheet.setAttribute('data-codex-design-asset', 'style');
    stylesheet.setAttribute('data-codex-design-order', String(index));
    stylesheet.addEventListener('load', function () {
      if (Design.mode !== 'hybrid') return;
      hybridPendingStyles = Math.max(0, hybridPendingStyles - 1);
      startHybridRuntimeWhenReady();
      markHybridReady();
    }, { once: true });
    stylesheet.addEventListener('error', failOpenHybrid, { once: true });
    document.head.appendChild(stylesheet);
  });

  function decorateAnchor(anchor) {
    if (!anchor || anchor.nodeType !== 1 || anchor.tagName !== 'A') return;
    var raw = anchor.getAttribute('href');
    var next = Design.withMode(raw);
    if (next && next !== raw) anchor.setAttribute('href', next);
  }

  function decorateLinks(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === 'A') decorateAnchor(root);
    var anchors = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    for (var i = 0; i < anchors.length; i++) decorateAnchor(anchors[i]);
  }

  function loadRuntime(index) {
    if (index >= selected.js.length) {
      hybridRuntimeReady = true;
      markHybridReady();
      return;
    }
    var runtime = document.createElement('script');
    runtime.src = selected.js[index];
    runtime.async = false;
    runtime.setAttribute('data-codex-design-asset', 'runtime');
    runtime.setAttribute('data-codex-design-order', String(index));
    runtime.addEventListener('load', function () { loadRuntime(index + 1); }, { once: true });
    runtime.addEventListener('error', function () {
      if (failOpenTimer) window.clearTimeout(failOpenTimer);
      failOpenHybrid();
    }, { once: true });
    document.body.appendChild(runtime);
  }

  function startHybridRuntimeWhenReady() {
    if (Design.mode !== 'hybrid' || !hybridBooted || hybridRuntimeStarted ||
        hybridPendingStyles !== 0 ||
        document.documentElement.getAttribute('data-design-runtime-state') !== 'pending') return;
    hybridRuntimeStarted = true;
    loadRuntime(0);
  }

  function boot() {
    decorateLinks(document);

    if (Design.mode === 'hybrid' &&
        document.documentElement.getAttribute('data-design-runtime-state') === 'pending') {
      /* The early loader gate hides only the interactive layout. If either
         optional runtime stalls, reveal the fully functional Original surface
         after a bounded wait instead of leaving a blank page. */
      createHybridGate();
    }

    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var record = records[i];
          if (record.type === 'attributes') {
            decorateAnchor(record.target);
            continue;
          }
          for (var j = 0; j < record.addedNodes.length; j++) decorateLinks(record.addedNodes[j]);
        }
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['href']
      });
    }

    if (Design.mode === 'hybrid') {
      hybridBooted = true;
      startHybridRuntimeWhenReady();
    } else {
      loadRuntime(0);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
