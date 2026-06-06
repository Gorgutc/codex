/* ═══════════════════════════════════════════════════════════════════════
   FREE ASSETS — page-specific logic (FA-only)
   ──────────────────────────────────────────────────────────────────────
   Theme / cards-toggle / dropdown / game-switch / sidebar animations
   handled by ./js/main.js (loaded earlier).
   This file: tag selection, asset grid render, download.
   v0.7.11 [P2 #27]: вынесено из inline <script> в free-assets.html.
═══════════════════════════════════════════════════════════════════════ */
(function() {
'use strict';

/* ─── TAG SELECTION ─── */
var activeTag = 'hard-surface';

function selectTag(tag, opts) {
  var noCollapse = opts && opts.noCollapse;
  activeTag = tag;
  document.querySelectorAll('.tag-card').forEach(function(c) {
    var isActive = c.dataset.tag === tag;
    c.classList.toggle('tag-card--active', isActive);
    // v0.5: aria-pressed запрещён на <a>. Используем aria-current="page" — корректно
    // отражает «активную страницу/секцию» через ARIA spec.
    if (isActive) c.setAttribute('aria-current', 'page');
    else c.removeAttribute('aria-current');
  });
  updateHeader(tag);
  renderGrid(tag);
  // Mobile: collapse sidebar to show grid only on explicit user click, not initial load
  if (!noCollapse && window.innerWidth < 768) {
    document.body.classList.add('cards-collapsed');
    var ct = document.getElementById('cards-toggle');
    if (ct) ct.setAttribute('aria-expanded', 'false');
  }
}

function updateHeader(tag) {
  var assets = FA_DATA[tag] || [];
  var catLabel = assets.length > 0 ? assets[0].cat : tag;
  var catEl  = document.getElementById('fa-view-cat');
  var cntEl  = document.getElementById('fa-view-count');
  var titEl  = document.getElementById('fa-view-title');
  if (catEl) catEl.textContent = catLabel;
  if (cntEl) cntEl.textContent = assets.length + ' asset' + (assets.length !== 1 ? 's' : '');
  if (titEl) titEl.textContent = catLabel;
}

function dlIcon() {
  return '<svg class="fa-card__dl-icon" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
    + '<path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

function el(tag, className, text) {
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

function resolveAssetMedia(asset) {
  var thumb = Object.prototype.hasOwnProperty.call(asset, 'thumb') ? asset.thumb : asset.id;
  var model = Object.prototype.hasOwnProperty.call(asset, 'model') ? asset.model : asset.id;
  return {
    thumb: thumb,
    model: model,
    previewState: model ? '3d' : (thumb ? 'poster' : 'fallback'),
    previewStateLabel: model ? '3D' : (thumb ? 'Poster' : 'Fallback'),
  };
}

function createPreviewThumb(asset, media, reducedMotion) {
  var thumb = el('div', 'fa-card__thumb');
  thumb.dataset.label = asset.title;
  thumb.dataset.previewState = media.previewState;
  thumb.style.background = asset.bg;

  if (media.thumb) {
    var img = el('img');
    img.src = './assets/cards/' + media.thumb + '.svg';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 800;
    img.height = 600;
    thumb.appendChild(img);
  }

  if (media.model) {
    var mv = document.createElement('model-viewer');
    mv.className = 'fa-card__thumb-mv';
    mv.dataset.codexPreviewSrc = './assets/models/free/' + media.model + '.glb';
    mv.setAttribute('alt', asset.title + ' — 3D preview');
    mv.setAttribute('loading', 'lazy');
    mv.setAttribute('reveal', 'auto');
    if (!reducedMotion) {
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('auto-rotate-delay', '0');
      mv.setAttribute('rotation-per-second', '20deg');
    }
    mv.setAttribute('shadow-intensity', '0');
    mv.setAttribute('exposure', '1.0');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('interaction-prompt', 'none');
    mv.addEventListener('load', function() {
      mv.classList.add('is-ready');
      thumb.classList.add('is-model-ready');
    });
    mv.addEventListener('error', function() {
      mv.classList.add('fa-card__thumb-mv--failed');
    });
    thumb.appendChild(mv);
  }

  if (media.thumb || media.model) {
    var previewButton = el('button', 'fa-card__preview-btn');
    previewButton.type = 'button';
    previewButton.setAttribute('aria-label', 'Open preview of ' + asset.title);
    previewButton.addEventListener('click', function() {
      openAssetPreview(thumb, previewButton);
    });
    thumb.appendChild(previewButton);
  }

  thumb.appendChild(el('span', 'fa-card__badge', asset.badge));
  var state = el('span', 'fa-card__state', media.previewStateLabel);
  state.setAttribute('aria-hidden', 'true');
  thumb.appendChild(state);

  return thumb;
}

function createAssetBody(asset) {
  var meta = append(el('div', 'fa-card__meta'),
    el('span', 'fa-card__cat', asset.cat),
    append(el('span', 'fa-card__meta-tail'),
      el('span', 'fa-card__license', 'CC0 — Free'),
      el('span', 'fa-card__hint', '↗')
    )
  );
  var hint = meta.querySelector('.fa-card__hint');
  if (hint) hint.setAttribute('aria-hidden', 'true');

  var contents = el('div', 'fa-card__contents');
  contents.appendChild(el('p', 'fa-card__contents-label', 'Archive includes'));
  var list = el('ul', 'fa-card__contents-list');
  (asset.contents || []).forEach(function(item) {
    list.appendChild(el('li', 'fa-card__contents-item', item));
  });
  contents.appendChild(list);

  var download = el('button', 'fa-card__download');
  download.type = 'button';
  download.dataset.file = asset.file;
  download.dataset.title = asset.title;
  download.dataset.size = asset.size;
  download.setAttribute('aria-label', 'Download ' + asset.title);
  download.innerHTML = dlIcon() + 'Download — ' + asset.size;
  download.addEventListener('click', handleDownload);

  return append(el('div', 'fa-card__body'),
    meta,
    el('h2', 'fa-card__title', asset.title),
    el('p', 'fa-card__desc', asset.desc),
    contents,
    download
  );
}

function createAssetCard(asset, reducedMotion) {
  var media = resolveAssetMedia(asset);
  var card = el('li', 'fa-card');
  if (asset.id) card.id = asset.id;
  return append(card,
    createPreviewThumb(asset, media, reducedMotion),
    createAssetBody(asset)
  );
}

function renderGrid(tag) {
  var grid = document.getElementById('fa-grid');
  if (!grid) return;
  var assets = FA_DATA[tag] || [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fragment = document.createDocumentFragment();

  assets.forEach(function(asset) {
    fragment.appendChild(createAssetCard(asset, reducedMotion));
  });
  grid.replaceChildren(fragment);
  applyGameFilter();

  // Entrance animation
  // v0.9.3 — заменили forEach + gsap.fromTo с individual delay на один
  // gsap.fromTo со stagger. GSAP batchит scheduling и читает getBoundingClientRect
  // один раз, а не на каждую карту → меньше forced reflow.
  if (!reducedMotion) {
    gsap.fromTo(grid.querySelectorAll('.fa-card'),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.045 }
    );
  }
  var scroll = document.getElementById('fa-scroll');
  // v0.9.3 — write scrollTop только если != 0 (write на scrollTop всегда
  // вызывает reflow, даже если значение не меняется).
  if (scroll && scroll.scrollTop !== 0) scroll.scrollTop = 0;
  observeModelViewers();
}

/* ─── PREVIEW FULLSCREEN ─── */
function buildFullscreenModelSource(mv) {
  var proxy = document.createElement('model-viewer');
  [
    'src',
    'alt',
    'poster',
    'environment-image',
    'exposure',
    'shadow-intensity',
    'interaction-prompt'
  ].forEach(function(name) {
    if (mv.hasAttribute(name)) proxy.setAttribute(name, mv.getAttribute(name));
  });
  if (!proxy.hasAttribute('src') && mv.dataset.codexPreviewSrc) {
    proxy.setAttribute('src', mv.dataset.codexPreviewSrc);
  }
  proxy.setAttribute('loading', 'eager');
  proxy.setAttribute('reveal', 'auto');
  proxy.setAttribute('camera-controls', '');
  proxy.setAttribute('touch-action', 'none');
  proxy.setAttribute('interaction-prompt', 'none');
  if (mv.hasAttribute('auto-rotate')) {
    proxy.setAttribute('auto-rotate', '');
    proxy.setAttribute('auto-rotate-delay', mv.getAttribute('auto-rotate-delay') || '0');
    proxy.setAttribute('rotation-per-second', mv.getAttribute('rotation-per-second') || '20deg');
  }
  return proxy;
}

function openFallbackPreview(thumb, triggerEl) {
  if (!thumb || !window.CodexMediaFullscreen ||
      typeof window.CodexMediaFullscreen.openElement !== 'function') {
    return;
  }
  var img = thumb.querySelector('img');
  if (img) window.CodexMediaFullscreen.openElement(img, 'img', triggerEl || thumb);
}

function openAssetPreview(thumb, triggerEl) {
  if (!thumb || !window.CodexMediaFullscreen ||
      typeof window.CodexMediaFullscreen.openElement !== 'function') {
    return;
  }
  var mv = thumb.querySelector('.fa-card__thumb-mv:not(.fa-card__thumb-mv--failed)');
  if (!mv) {
    openFallbackPreview(thumb, triggerEl);
    return;
  }
  enableModelPreview(mv);
  loadModelViewerScript()
    .then(function() {
      if (!window.customElements || !window.customElements.get('model-viewer')) {
        openFallbackPreview(thumb, triggerEl);
        return;
      }
      window.CodexMediaFullscreen.openElement(buildFullscreenModelSource(mv), 'model-viewer', triggerEl || thumb);
    })
    .catch(function() {
      openFallbackPreview(thumb, triggerEl);
    });
}

/* ─── DOWNLOAD ─── */
function handleDownload(e) {
  var btn = e.currentTarget;
  var file = btn.getAttribute('data-file');
  var title = btn.getAttribute('data-title') || file;
  if (!file) return;

  var origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = dlIcon() + 'Preparing…';

  fetch('./downloads/' + file, { method: 'GET' })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 500);
      btn.disabled = false;
      btn.innerHTML = dlIcon() + title + ' — downloaded ✓';
      btn.classList.add('fa-card__download--done');
      setTimeout(function() {
        btn.innerHTML = origHTML;
        btn.classList.remove('fa-card__download--done');
        /* v0.4 [M3]: убран лишний btn.addEventListener('click', handleDownload).
           Оригинальный обработчик не снимался — повторная подписка вызывала бы fetch дважды. */
      }, 3000);
    })
    .catch(function(err) {
      console.warn('Download failed:', err);
      btn.disabled = false;
      btn.innerHTML = dlIcon() + 'File not found — check ./downloads/';
      btn.classList.add('fa-card__download--error');
      setTimeout(function() {
        btn.innerHTML = origHTML;
        btn.classList.remove('fa-card__download--error');
        /* v0.4 [M3]: убран лишний btn.addEventListener — см. выше. */
      }, 3500);
    });
}

/* ─── BIND TAG CARDS ─── */
function bindTagCards() {
  document.querySelectorAll('.tag-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      // v0.5: tag-card теперь <a href="#X"> (HV5 fix). Перехватываем чтобы не было
      // hash-навигации браузером — selectTag сам обновит state.
      e.preventDefault();
      selectTag(card.dataset.tag);
    });
    // keydown больше не нужен: <a> сам активируется Enter.
  });
}

/* ─── GAME SWITCH (FA refactor — v0.4 [N4]) ───────────────────────────────────
   На index.html main.js фильтрует .work-card[data-game-asset="true"]. На FA
   tag-cards имеют двойной класс `.tag-card.work-card`, и main.js их прятал, что
   ломало UX (после клика оставалась одна категория из 6). На FA семантика свитча
   другая: «Game assets only» фильтрует grid каталога ассетов, не категории.

   v0.8.7 [M9]: main.js теперь сам пропускает game-switch при наличии #fa-grid
   (см. main.js: gameSwitch && !document.getElementById('fa-grid')). Clone-replace
   ниже остаётся как защита-страховка на случай будущих регрессий — снимает
   любые legacy listeners, идемпотентен.
   ─────────────────────────────────────────────────────────────────────────── */
function applyGameFilter() {
  var gs = document.getElementById('game-switch');
  var on = !!(gs && gs.checked);
  if (gs) gs.setAttribute('aria-checked', on ? 'true' : 'false');

  var grid = document.getElementById('fa-grid');
  if (!grid) return;
  var cards = grid.querySelectorAll('.fa-card');
  var visible = 0;
  cards.forEach(function(card) {
    var badge = card.querySelector('.fa-card__badge');
    var isGame = badge && /game\s*asset/i.test(badge.textContent || '');
    var show = !on || isGame;
    card.hidden = !show;
    if (show) visible++;
  });

  var cntEl = document.getElementById('fa-view-count');
  if (cntEl) {
    cntEl.textContent = visible + ' asset' + (visible !== 1 ? 's' : '') + (on ? ' (game-only)' : '');
  }
}

function rebindGameSwitch() {
  var gs = document.getElementById('game-switch');
  if (!gs) return;
  // Clone снимает все listeners (включая main.js), сохраняя DOM-расположение.
  var clone = gs.cloneNode(true);
  gs.parentNode.replaceChild(clone, gs);
  // На случай если main.js успел поставить body.filter-game / pressed state — снимаем.
  document.body.classList.remove('filter-game');
  // Восстановим визуально все tag-cards (если main.js успел кого-то скрыть до clone).
  document.querySelectorAll('.tag-card').forEach(function(c) { c.hidden = false; });

  clone.addEventListener('change', applyGameFilter);
}

/* ─── MINI MODEL PREVIEWS — lazy-load one viewer runtime ──────────────────
   Free-assets cards intentionally show small rotating models. The runtime is
   still loaded lazily: only when the first preview approaches the viewport. */
function loadModelViewerScript() {
  if (!window.CodexShared || typeof window.CodexShared.loadModelViewerScript !== 'function') {
    console.warn('[FA] shared model-viewer loader missing — cards keep SVG fallback');
    return Promise.resolve();
  }
  return window.CodexShared.loadModelViewerScript().catch(function(err) {
    console.warn('[FA] model-viewer load failed — cards keep SVG fallback', err);
    return null;
  });
}

var modelViewerObserver = null;
var modelViewerLoadScheduled = false;

function enableModelPreview(mv) {
  if (!mv || mv.dataset.codexPreviewEnabled === 'true') return;
  mv.dataset.codexPreviewEnabled = 'true';
  if (mv.dataset.codexPreviewSrc && !mv.getAttribute('src')) {
    mv.setAttribute('src', mv.dataset.codexPreviewSrc);
  }
}

function scheduleModelViewerLoad() {
  if (modelViewerLoadScheduled) return;
  modelViewerLoadScheduled = true;
  var run = function() { loadModelViewerScript(); };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1600 });
    return;
  }
  window.setTimeout(run, 240);
}

function ensureModelViewerObserver() {
  if (modelViewerObserver) return modelViewerObserver;
  if (typeof IntersectionObserver === 'undefined') return null;
  var scroll = document.getElementById('fa-scroll');
  var root = scroll && scroll.getClientRects && scroll.getClientRects().length ? scroll : null;
  modelViewerObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      enableModelPreview(entry.target);
      observer.unobserve(entry.target);
      if (!window.customElements || !window.customElements.get('model-viewer')) {
        scheduleModelViewerLoad();
      }
    });
  }, { root: root, rootMargin: '120px 0px' });
  return modelViewerObserver;
}

function observeModelViewers() {
  var previews = Array.prototype.slice.call(document.querySelectorAll('.fa-card__thumb-mv'));
  if (!previews.length) return;
  if (modelViewerObserver) {
    modelViewerObserver.disconnect();
    modelViewerObserver = null;
  }
  var obs = ensureModelViewerObserver();
  if (!obs) {
    previews.forEach(enableModelPreview);
    scheduleModelViewerLoad();
    return;
  }
  previews.forEach(function(mv) {
    obs.observe(mv);
  });
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', function() {
  bindTagCards();
  // Initial load: pre-select first category but DO NOT collapse sidebar on mobile.
  // User should land on the tag-cards overview, not inside a category.
  selectTag('hard-surface', { noCollapse: true });

  /* Phase 3 — re-render FA grid при смене языка. i18n.js overlayFA() уже
     мутировал window.FA_DATA для нового языка; renderGrid(activeTag) пере-
     соберёт DOM grid из переведённых данных. Мы не трогаем sidebar-state
     и не вызываем selectTag (он закрыл бы sidebar на mobile) — re-render
     только grid'а. */
  window.addEventListener('i18n:changed', function () {
    if (typeof renderGrid === 'function') renderGrid(activeTag);
  });

  // v0.4 [N4]: rebind game-switch ПОСЛЕ main.js (который тоже слушает DOMContentLoaded).
  // main.js регистрирует listener раньше нас, его init выполнится первым — успевает
  // повесить handler на оригинальный #game-switch. Clone-replace его убирает.
  rebindGameSwitch();

  // v0.8.8b — делегированный error-handler для thumbnail <img> внутри fa-grid.
  // Раньше каждая fa-card генерировалась с inline onerror="this.style.display='none'"
  // (нарушало build-rule B2). capture:true — error не bubble'ит.
  // Tag-cards в #cards-scroll покрыты main.js error-handler'ом из 0.8.8a
  // (.tag-card__thumb имеет двойной класс .work-card__thumb → ловится тем же
  // closest('.work-card__thumb') selector'ом).
  var faGrid = document.getElementById('fa-grid');
  if (faGrid) {
    faGrid.addEventListener('error', function (e) {
      var img = e.target;
      if (img && img.tagName === 'IMG' && img.closest && img.closest('.fa-card__thumb')) {
        img.style.display = 'none';
      }
    }, true);
  }
  /* Cursor + theme + collapse handled by main.js */
});

})();
