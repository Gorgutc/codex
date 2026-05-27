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
  renderGrid(tag);
  updateHeader(tag);
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

function renderGrid(tag) {
  var grid = document.getElementById('fa-grid');
  if (!grid) return;
  var assets = FA_DATA[tag] || [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  grid.innerHTML = assets.map(function(a) {
    var thumb = Object.prototype.hasOwnProperty.call(a, 'thumb') ? a.thumb : a.id;
    var model = Object.prototype.hasOwnProperty.call(a, 'model') ? a.model : a.id;
    var thumbHTML = thumb
      ? '<img src="./assets/cards/' + thumb + '.svg" alt="" aria-hidden="true" loading="lazy" decoding="async" width="800" height="600">'
      : '';
    var rotateAttrs = reducedMotion ? '' : ' auto-rotate auto-rotate-delay="0" rotation-per-second="20deg"';
    var modelHTML = model
      ? '<model-viewer class="fa-card__thumb-mv"'
        + ' src="./assets/models/free/' + model + '.glb"'
        + ' alt="' + a.title + ' — 3D preview"'
        + ' loading="lazy" reveal="auto"'
        + rotateAttrs
        + ' shadow-intensity="0" exposure="1.0" environment-image="neutral"'
        + ' interaction-prompt="none"'
        + '></model-viewer>'
      : '';
    return '<li class="fa-card">'
      + '<div class="fa-card__thumb" data-label="' + a.title + '" style="background:' + a.bg + '">'
      + thumbHTML
      + modelHTML
      + '<span class="fa-card__badge">' + a.badge + '</span>'
      + '</div>'
      + '<div class="fa-card__body">'
      + '<div class="fa-card__meta">'
      + '<span class="fa-card__cat">' + a.cat + '</span>'
      + '<span class="fa-card__license">CC0 — Free</span>'
      + '</div>'
      + '<h2 class="fa-card__title">' + a.title + '</h2>'
      + '<p class="fa-card__desc">' + a.desc + '</p>'
      + '<div class="fa-card__contents">'
      + '<p class="fa-card__contents-label">Archive includes</p>'
      + '<ul class="fa-card__contents-list">'
      + a.contents.map(function(c) { return '<li class="fa-card__contents-item">' + c + '</li>'; }).join('')
      + '</ul>'
      + '</div>'
      + '<button class="fa-card__download" type="button"'
      + ' data-file="' + a.file + '" data-title="' + a.title + '" data-size="' + a.size + '"'
      + ' aria-label="Download ' + a.title + '">'
      + dlIcon()
      + 'Download — ' + a.size
      + '</button>'
      + '</div>'
      + '</li>';
  }).join('');

  grid.querySelectorAll('.fa-card__download').forEach(function(btn) {
    btn.addEventListener('click', handleDownload);
  });

  grid.querySelectorAll('.fa-card__thumb-mv').forEach(function(mv) {
    mv.addEventListener('load', function() {
      mv.classList.add('is-ready');
      var thumbEl = mv.closest && mv.closest('.fa-card__thumb');
      if (thumbEl) thumbEl.classList.add('is-model-ready');
    });
    mv.addEventListener('error', function() {
      mv.classList.add('fa-card__thumb-mv--failed');
    });
  });

  // Entrance animation
  // v0.9.3 — заменили forEach + gsap.fromTo с individual delay на один
  // gsap.fromTo со stagger. GSAP batchит scheduling и читает getBoundingClientRect
  // один раз, а не на каждую карту → меньше forced reflow.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  clone.addEventListener('change', function() {
    var on = clone.checked;
    clone.setAttribute('aria-checked', on ? 'true' : 'false');
    // Фильтруем текущий grid: показываем только карточки с badge='Game Asset'.
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
    // Обновим счётчик в header
    var cntEl = document.getElementById('fa-view-count');
    if (cntEl) {
      cntEl.textContent = visible + ' asset' + (visible !== 1 ? 's' : '') + (on ? ' (game-only)' : '');
    }
  });
}

/* ─── MINI MODEL PREVIEWS — lazy-load one viewer runtime ──────────────────
   Free-assets cards intentionally show small rotating models. The runtime is
   still loaded lazily: only when the first preview approaches the viewport. */
var modelViewerLoading = null;
function loadModelViewerScript() {
  if (modelViewerLoading) return modelViewerLoading;
  modelViewerLoading = new Promise(function(resolve) {
    if (window.customElements && window.customElements.get('model-viewer')) {
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
    s.onload = function() { resolve(); };
    s.onerror = function() {
      console.warn('[FA] model-viewer load failed — cards keep SVG fallback');
      modelViewerLoading = null;
      resolve();
    };
    document.head.appendChild(s);
  });
  return modelViewerLoading;
}

var modelViewerObserver = null;
function ensureModelViewerObserver() {
  if (window.customElements && window.customElements.get('model-viewer')) return null;
  if (modelViewerObserver) return modelViewerObserver;
  if (typeof IntersectionObserver === 'undefined') {
    loadModelViewerScript();
    return null;
  }
  modelViewerObserver = new IntersectionObserver(function(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        loadModelViewerScript();
        modelViewerObserver.disconnect();
        modelViewerObserver = null;
        return;
      }
    }
  }, { rootMargin: '200px' });
  return modelViewerObserver;
}

function observeModelViewers() {
  var obs = ensureModelViewerObserver();
  if (!obs) return;
  document.querySelectorAll('.fa-card__thumb-mv').forEach(function(mv) {
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
