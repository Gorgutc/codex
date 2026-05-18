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
  grid.innerHTML = assets.map(function(a) {
    /* v0.7.5 [model-viewer]: SVG-poster становится декоративным fallback'ом
       (alt="", aria-hidden), accessible name переходит на <model-viewer>.
       Если .glb 404/CORS — error handler ниже добавляет .--failed → CSS hide → SVG виден. */
    return '<li class="fa-card">'
      + '<div class="fa-card__thumb" data-label="' + a.title + '" style="background:' + a.bg + '">'
      + '<img src="./assets/cards/' + a.id + '.svg" alt="" aria-hidden="true" loading="lazy" width="800" height="600">'
      + '<model-viewer class="fa-card__thumb-mv"'
      +   ' src="./assets/models/free/' + a.id + '.glb"'
      +   ' alt="' + a.title + ' — 3D preview"'
      +   ' loading="lazy" reveal="auto"'
      +   ' auto-rotate auto-rotate-delay="0" rotation-per-second="20deg"'
      +   ' shadow-intensity="0" exposure="1.0" environment-image="neutral"'
      +   '></model-viewer>'
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

  /* v0.7.5 [model-viewer]: если .glb fails (404/CORS/malformed) — помечаем класс,
     CSS скрывает <model-viewer>, SVG-fallback под ним становится виден.
     Связано с DIFF 2.2 в free-assets.css (.fa-card__thumb-mv--failed). */
  grid.querySelectorAll('.fa-card__thumb-mv').forEach(function(mv) {
    mv.addEventListener('error', function(e) {
      if (e.detail && e.detail.type === 'loadfailure') {
        mv.classList.add('fa-card__thumb-mv--failed');
      }
    });
  });

  // Entrance animation
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    grid.querySelectorAll('.fa-card').forEach(function(card, i) {
      gsap.fromTo(card,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', delay: i * 0.045 }
      );
    });
  }
  var scroll = document.getElementById('fa-scroll');
  if (scroll) scroll.scrollTop = 0;

  // v0.9.2 — после каждого renderGrid (включая switch tag) подписываем
  // новые .fa-card__thumb-mv на observer. Если script уже загружен —
  // ensureModelViewerObserver вернёт null и observe-loop станет no-op.
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

/* ─── MODEL-VIEWER SCRIPT — lazy-load один раз ────────────────────────────
   v0.7.5 [model-viewer]: идентичный паттерн используется в js/main.js:1683
   для 3D-таба кейсов на index.html. Дублируем здесь — main.js живёт в своей
   IIFE, функция оттуда не доступна. type="module" = deferred-by-default,
   первый рендер страницы не блокируется.
   CDN тот же что на index.html (Google Hosted Libraries) → браузер кэширует
   один раз для обеих страниц.

   v0.9.2: ленивая инициализация через IntersectionObserver.
   Раньше loadModelViewerScript() стартовала на DOMContentLoaded —
   модуль 252 KiB начинал тянуться параллельно с первым render, удлинял
   FCP/LCP даже когда первая fa-card-thumb-mv ещё была за viewport'ом.
   Теперь script инжектится только когда первая .fa-card__thumb-mv реально
   входит в viewport (или близко к нему через rootMargin). После загрузки
   model-viewer custom-element upgrade'ит ВСЕ инстансы автоматически.
   ─────────────────────────────────────────────────────────────────────── */
var modelViewerLoading = null;
function loadModelViewerScript() {
  if (modelViewerLoading) return modelViewerLoading;
  modelViewerLoading = new Promise(function(resolve, reject) {
    if (window.customElements && window.customElements.get('model-viewer')) {
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
    s.onload = function() { resolve(); };
    s.onerror = function() {
      console.warn('[FA] model-viewer load failed — карточки покажут SVG fallback');
      reject(new Error('model-viewer load failed'));
    };
    document.head.appendChild(s);
  });
  return modelViewerLoading;
}

// v0.9.2 — observer для отложенной инициализации model-viewer.
// rootMargin 200px — успеваем подкачать скрипт пока пользователь скроллит
// к 3D-preview. Idempotent: после первого triggered loadModelViewerScript
// возвращает same Promise.
var modelViewerObserver = null;
function ensureModelViewerObserver() {
  if (modelViewerObserver) return modelViewerObserver;
  if (typeof IntersectionObserver === 'undefined') {
    // Старый браузер — fallback на немедленную загрузку (как было до v0.9.2).
    loadModelViewerScript();
    return null;
  }
  modelViewerObserver = new IntersectionObserver(function (entries) {
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
  if (!obs) return; // fallback path или уже загружено
  document.querySelectorAll('.fa-card__thumb-mv').forEach(function (mv) {
    obs.observe(mv);
  });
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', function() {
  // v0.9.2: убран немедленный loadModelViewerScript(). Скрипт теперь
  // инжектится через IntersectionObserver когда первая .fa-card__thumb-mv
  // приближается к viewport (см. observeModelViewers в renderGrid).
  bindTagCards();
  // Initial load: pre-select first category but DO NOT collapse sidebar on mobile.
  // User should land on the tag-cards overview, not inside a category.
  selectTag('hard-surface', { noCollapse: true });
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
