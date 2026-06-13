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

/* ─── TAG SELECTION ───
   Итерация H + XSS/visibility batch: каталог редактируется через админку
   (content/free-assets.json), категории и ассеты можно выключать. Tag-карточки
   обзорной сетки теперь ГЕНЕРИРУЮТСЯ из видимых категорий (GEN-регион
   fa-tag-cards в free-assets.html, порядок = авторский порядок content), то
   есть выключенная категория ОТСУТСТВУЕТ в DOM ещё на этапе сборки — рантайму
   больше не нужно её прятать. Поэтому стартовый тег = data-tag первой
   отрисованной .tag-card (детерминированно следует порядку content; при полном
   каталоге это hard-surface, поведение не меняется), а счётчик #cards-count
   main.js считает по уже видимо-корректному NodeList без патчей. */
// v0.x [A2-10]: единая точка доступа к каталогу. Если fa-data.js не загрузился,
// window.FA_DATA === undefined и голое чтение FA_DATA бросает ReferenceError,
// каскадно убивая init. Геттер возвращает {} → init деградирует мягко.
function faData() {
  return (typeof FA_DATA !== 'undefined' && FA_DATA) ? FA_DATA : {};
}

function firstAvailableTag() {
  var firstCard = document.querySelector('.tag-card[data-tag]');
  if (firstCard && firstCard.dataset.tag) return firstCard.dataset.tag;
  // Фоллбек (DOM без tag-карточек, напр. в тестах): первая видимая категория
  // FA_DATA. Порядок ключей FA_DATA = авторский порядок content.
  var keys = Object.keys(faData());
  for (var i = 0; i < keys.length; i++) {
    if ((faData()[keys[i]] || []).length) return keys[i];
  }
  return null;
}

// v0.x [A2-04]: маппинг #<asset-id> (из JSON-LD itemList / расшаренных ссылок)
// в категорию, содержащую этот ассет. null — если hash пуст или id не найден.
function tagForHash(hash) {
  var id = (hash || '').replace(/^#/, '');
  if (!id) return null;
  var data = faData();
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var list = data[keys[i]] || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j] && list[j].id === id) return keys[i];
    }
  }
  return null;
}

// v0.x [A2-04]: после рендера категории доводим карточку дип-линка до вида.
function scrollHashCardIntoView(hash) {
  var id = (hash || '').replace(/^#/, '');
  if (!id) return;
  var card = document.getElementById(id);
  if (card && typeof card.scrollIntoView === 'function') {
    try { card.scrollIntoView({ block: 'center' }); } catch (_) { card.scrollIntoView(); }
  }
}

var activeTag = firstAvailableTag();

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
  // v0.x [A2-14]: раньше вручную ставили cards-collapsed + aria-expanded, минуя
  // main.js setCollapsed() — label кнопки оставался «Hide categories» (стейл), не
  // летел codex:toggle и не пересчитывался Lenis. Роутим через клик по
  // #cards-toggle (его handler зовёт setCollapsed со всем побочным эффектом),
  // но только когда панель ещё развёрнута — без двойного тоггла.
  if (!noCollapse && window.innerWidth < 768) {
    var ct = document.getElementById('cards-toggle');
    if (ct && ct.getAttribute('aria-expanded') !== 'false') {
      ct.click();
    } else if (!ct) {
      document.body.classList.add('cards-collapsed');
    }
  }
}

function catLabelForTag(tag) {
  var assets = faData()[tag] || [];
  if (assets.length > 0 && assets[0].cat) return assets[0].cat;
  // v0.x [A2-09]: пустая категория — не показываем сырой slug в H1; берём
  // человекочитаемый label из tag-карточки (генерится из content), иначе tag.
  var tagCard = document.querySelector('.tag-card[data-tag="' + (window.CSS && window.CSS.escape ? window.CSS.escape(tag) : tag) + '"]');
  var label = tagCard && tagCard.querySelector('.tag-card__title');
  return (label && label.textContent.trim()) || tag;
}

// E-12/A2-02 — pluralised, i18n-driven asset count for the FA view. EN output is
// byte-identical to the previous literal ('N assets' [+ ' (game-only)' when the
// game filter is on]); RU follows plural rules via I18N.tCount. The inline
// fallback covers the pre-i18n window before window.I18N is ready.
function faCountText(n, gameOnly) {
  var I18N = window.I18N;
  var base = (I18N && I18N.tCount)
    ? I18N.tCount('count.assets', n)
    : n + ' asset' + (n !== 1 ? 's' : '');
  var suffix = gameOnly
    ? ((I18N && I18N.t) ? I18N.t('count.assetsGameSuffix') : ' (game-only)')
    : '';
  return base + suffix;
}

function updateHeader(tag) {
  var assets = faData()[tag] || [];
  var catLabel = catLabelForTag(tag);
  var catEl  = document.getElementById('fa-view-cat');
  var cntEl  = document.getElementById('fa-view-count');
  var titEl  = document.getElementById('fa-view-title');
  if (catEl) catEl.textContent = catLabel;
  if (cntEl) cntEl.textContent = faCountText(assets.length, false);
  if (titEl) titEl.textContent = catLabel;
}

function dlIcon() {
  return '<svg class="fa-card__dl-icon" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
    + '<path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

/* Security boundary (iteration H): asset.title/size are free-text admin fields
   (validated only as non-empty), so they must NEVER be concatenated into
   innerHTML. setDownloadLabel renders the fixed icon markup, then appends the
   owner-controlled label as a textContent node — no HTML parsing of user text.
   The icon SVG is a hardcoded literal and safe to set via innerHTML. */
function setDownloadLabel(btn, label) {
  btn.innerHTML = dlIcon();
  btn.appendChild(document.createTextNode(label));
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

// v0.x [A2-11]: asset.bg — admin free-text. url()/image-set() инициировали бы
// кросс-доменный fetch при рендере (CSS-injection surface); цвета и градиенты
// безопасны. Не применяем значения, тянущие внешний ресурс.
function setSafeBackground(node, bg) {
  if (!bg) return;
  if (/url\s*\(|image-set\s*\(/i.test(bg)) return;
  node.style.background = bg;
}

function createPreviewThumb(asset, media, reducedMotion) {
  var thumb = el('div', 'fa-card__thumb');
  thumb.dataset.label = asset.title;
  thumb.dataset.previewState = media.previewState;
  setSafeBackground(thumb, asset.bg);

  if (media.thumb) {
    var img = el('img');
    // v0.x [A2-11]: encode admin-имени файла, чтобы ? # .. или пробелы не
    // переформировали URL.
    img.src = './assets/cards/' + encodeURIComponent(media.thumb) + '.svg';
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
    // v0.x [A2-11]: encode admin-имени GLB (идентично для текущих [a-z0-9-] имён).
    mv.dataset.codexPreviewSrc = './assets/models/free/' + encodeURIComponent(media.model) + '.glb';
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

  var body = append(el('div', 'fa-card__body'),
    meta,
    el('h2', 'fa-card__title', asset.title),
    el('p', 'fa-card__desc', asset.desc),
    contents
  );

  // A2-01/E-02/F-03: Download-кнопку рендерим только если архив реально лежит в
  // downloads/ (генератор кладёт asset.hasFile). У 21/25 ассетов файла нет —
  // кнопка раньше 404'ила; теперь её просто нет (auto-enable при появлении архива).
  if (asset.hasFile) {
    var download = el('button', 'fa-card__download');
    download.type = 'button';
    download.dataset.file = asset.file;
    download.dataset.title = asset.title;
    download.dataset.size = asset.size;
    download.setAttribute('aria-label', 'Download ' + asset.title);
    setDownloadLabel(download, 'Download — ' + asset.size);
    download.addEventListener('click', handleDownload);
    body.appendChild(download);
  }

  return body;
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
  var assets = faData()[tag] || [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fragment = document.createDocumentFragment();

  // v0.x [A2-03]: game-ность категории берём из tag-card (генератор ставит
  // data-game-asset="true" только на game-категорию) и штампуем на каждую
  // .fa-card — game-фильтр читает стабильный атрибут, а не текст бейджа.
  var tagCardEl = document.querySelector('.tag-card[data-tag="' + (window.CSS && window.CSS.escape ? window.CSS.escape(tag) : tag) + '"]');
  var isGameCat = !!(tagCardEl && tagCardEl.dataset.gameAsset === 'true');

  assets.forEach(function(asset) {
    var card = createAssetCard(asset, reducedMotion);
    card.dataset.gameAsset = isGameCat ? 'true' : 'false';
    fragment.appendChild(card);
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

  // Re-render the resting label from the asset's size (textContent node) so the
  // restore path never re-parses owner text as HTML — defense in depth.
  var size = btn.getAttribute('data-size') || '';
  var origLabel = 'Download — ' + size;
  btn.disabled = true;
  setDownloadLabel(btn, 'Preparing…');

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
      setDownloadLabel(btn, title + ' — downloaded ✓');
      btn.classList.add('fa-card__download--done');
      setTimeout(function() {
        setDownloadLabel(btn, origLabel);
        btn.classList.remove('fa-card__download--done');
        /* v0.4 [M3]: убран лишний btn.addEventListener('click', handleDownload).
           Оригинальный обработчик не снимался — повторная подписка вызывала бы fetch дважды. */
      }, 3000);
    })
    .catch(function(err) {
      console.warn('Download failed:', err);
      btn.disabled = false;
      setDownloadLabel(btn, 'File not found — check ./downloads/');
      btn.classList.add('fa-card__download--error');
      setTimeout(function() {
        setDownloadLabel(btn, origLabel);
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
    // v0.x [A2-03]: game-детекция по data-атрибуту (штампуется в renderGrid из
    // game-флага категории, который генератор кладёт на tag-card), а НЕ по тексту
    // бейджа — переименование бейджа в админке больше не ломает фильтр.
    var isGame = card.dataset.gameAsset === 'true';
    var show = !on || isGame;
    card.hidden = !show;
    if (show) visible++;
  });

  setGridEmptyState(grid, visible === 0, on);

  var cntEl = document.getElementById('fa-view-count');
  if (cntEl) {
    cntEl.textContent = faCountText(visible, on);
  }
}

// v0.x [A2-03/A2-09]: общий empty-state грида. Рендерит доступное сообщение <li>
// (без класса .fa-card → не влияет на счётчики .fa-card в verify-frozen), когда
// активная категория или game-only-фильтр дают ноль карточек.
function setGridEmptyState(grid, isEmpty, gameOnly) {
  var node = grid.querySelector('.fa-grid__empty');
  if (!isEmpty) {
    if (node) node.remove();
    return;
  }
  if (!node) {
    node = el('li', 'fa-grid__empty');
    node.setAttribute('role', 'status');
    grid.appendChild(node);
  }
  // A2-03/A2-09 — empty-state message routed through i18n (RU follows the active
  // language); EN fallback stays byte-identical for the pre-i18n window.
  var I18N = window.I18N;
  node.textContent = gameOnly
    ? ((I18N && I18N.t) ? I18N.t('empty.assetsGame') : 'No game-ready assets in this category yet.')
    : ((I18N && I18N.t) ? I18N.t('empty.assets') : 'No assets in this category yet.');
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
  // XSS/visibility batch: tag-карточки выключенных категорий теперь
  // отсутствуют в DOM уже на этапе сборки (GEN-регион fa-tag-cards), поэтому
  // прежний runtime-прунинг (pruneHiddenTagCards) и патч счётчика больше не
  // нужны — main.js считает #cards-count по видимо-корректному NodeList сам.
  bindTagCards();
  // Initial load: honor a deep-link hash (#<asset-id> из JSON-LD itemList /
  // расшаренных ссылок). Если hash указывает на известный ассет — открываем его
  // категорию и доводим карточку до вида; иначе — первая категория. DO NOT
  // collapse sidebar on mobile — пользователь приземляется на обзор категорий.
  var deepLinkTag = tagForHash(window.location.hash);
  var initialTag = deepLinkTag || activeTag;
  if (initialTag) {
    selectTag(initialTag, { noCollapse: true });
    if (deepLinkTag) scrollHashCardIntoView(window.location.hash);
  }

  /* Phase 3 — re-render FA grid при смене языка. i18n.js overlayFA() уже
     мутировал window.FA_DATA для нового языка; renderGrid(activeTag) пере-
     соберёт DOM grid из переведённых данных. Мы не трогаем sidebar-state
     и не вызываем selectTag (он закрыл бы sidebar на mobile) — re-render
     только grid'а. */
  window.addEventListener('i18n:changed', function () {
    // v0.x [A2-07]: на смене языка переводим только asset.desc (overlayFA в
    // i18n.js уже обновил window.FA_DATA). Полный renderGrid пересобирал весь
    // grid — сбрасывал scroll и пересоздавал GLB-превью. Обновляем desc in-place,
    // сохраняя DOM, scroll и превью.
    var grid = document.getElementById('fa-grid');
    if (!grid) return;
    var assets = faData()[activeTag] || [];
    var cards = grid.querySelectorAll('.fa-card');
    // renderGrid строит .fa-card в порядке FA_DATA[activeTag] → индексы совпадают.
    for (var i = 0; i < cards.length && i < assets.length; i++) {
      var descEl = cards[i].querySelector('.fa-card__desc');
      if (descEl && assets[i] && typeof assets[i].desc === 'string') {
        descEl.textContent = assets[i].desc;
      }
    }
    // E-12/A2-02/A2-03 — refresh the asset count and any grid empty-state in the
    // new language. applyGameFilter recomputes the visible count and re-sets
    // #fa-view-count + the empty-state from i18n; it is idempotent on the current
    // filter/hidden state, so DOM, scroll and GLB previews are preserved.
    if (typeof applyGameFilter === 'function') applyGameFilter();
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
