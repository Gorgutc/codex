/* ═══════════════════════════════════════════════════════════════════════
   preview.js — предпросмотр «как будет» (итерация G).

   Идея: берём НАСТОЯЩИЙ index.html сайта (fetch → DOMParser), накладываем
   черновик и рендерим в same-origin iframe через srcdoc:
     • <base> в head — относительные пути резолвятся в реальные файлы сайта,
       всё работает same-origin (в т.ч. на статике без сервера сборки);
     • грид: тексты/alt черновика, порядок карточек по cardOrder, скрытые
       кейсы и категории удалены, чекбоксы фильтров пересобраны;
     • <script src=".../cards-data.js"> и <script src=".../i18n-data.js">
       заменяются inline-скриптами с данными черновика: js/main.js и i18n.js
       сайта потребляют черновик так же, как потребляли бы сгенерированные
       файлы после публикации;
     • pending-медиа (файлы, загруженные, но ещё не опубликованные) видны
       через blob object-URL — previewDraft() в state.js подставляет их
       вместо новых cache-bust-путей, которых на сервере ещё нет.

   Источники данных:
     window.CARDS_DATA / window.I18N_DATA — опубликованные данные сайта
     (admin/index.html подключает ../js/cards-data.js и ../js/i18n-data.js);
     кейсы без черновика идут в превью из них байт-в-байт. Кейсы с черновиком
     пересобираются из content-JSON зеркалом логики generate-content.mjs
     (buildRuntimeEntry / build*Locale ниже).

   Сайтовые файлы НЕ изменяются; GSAP/Lenis/3D внутри iframe работают как
   на проде (3D-вкладка лениво грузит ../js/model-data.js через <base>).

   Зависимости: window.AdminState (state.js). Подключается ПОСЛЕ state.js,
   ПЕРЕД ui.js. API: window.AdminPreview = { open, close } (используется
   тестами).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const State = window.AdminState;
  const SETTINGS_PATH = 'content/settings.json';
  // Зеркало generate-content.mjs: формат слота задан позицией (2 wide + 3 tall),
  // в runtime-запись motion-блока попадают только эти ключи.
  const MEDIA_FORMATS = ['wide', 'tall', 'tall', 'wide', 'tall'];
  const MOTION_KEYS = ['source', 'layout', 'playback', 'src', 'vimeoId', 'poster', 'title'];

  const els = {
    openBtn: document.getElementById('preview-btn'),
    overlay: document.getElementById('preview-overlay'),
    frame: document.getElementById('preview-frame'),
    frameWrap: document.getElementById('preview-frame-wrap'),
    loading: document.getElementById('preview-loading'),
    langEn: document.getElementById('preview-lang-en'),
    langRu: document.getElementById('preview-lang-ru'),
    vpDesktop: document.getElementById('preview-vp-desktop'),
    vpMobile: document.getElementById('preview-vp-mobile'),
    close: document.getElementById('preview-close')
  };

  let desiredLang = 'en';

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Зеркало applySparse из generate-content.mjs: точечные i18nOverrides
  // кейса (например caseEn.inline.body у cad-strut) поверх собранной записи.
  function applySparse(target, diff) {
    if (diff === undefined) return target;
    if (diff !== null && typeof diff === 'object' && '__replace' in diff) return diff.__replace;
    if (diff === null || typeof diff !== 'object') return diff;
    const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    for (const key of Object.keys(diff)) out[key] = applySparse(out[key], diff[key]);
    return out;
  }

  /* ── зеркала генератора: content-JSON → runtime-структуры ──────────── */

  // content/cases/{id}.json → запись window.CARDS_DATA[id]
  // (зеркало buildCaseEntry из generate-content.mjs).
  function buildRuntimeEntry(id, c) {
    const cs = c.case;
    const media = MEDIA_FORMATS.map((format, i) => ({
      type: 'image',
      format,
      src: (cs.srcs && cs.srcs[i]) || './assets/cases/' + id + '/0' + (i + 1) + '.svg',
      bg: cs.palette[i],
      label: cs.captions[i].label.en,
      desc: cs.captions[i].desc.en,
      enabled: true
    }));
    let motionBlocks = null;
    if (Array.isArray(cs.motionBlocks)) {
      motionBlocks = cs.motionBlocks.map((block) => {
        const out = {};
        for (const key of MOTION_KEYS) {
          if (key in block) out[key] = block[key];
        }
        out.label = block.label.en;
        out.desc = block.desc.en;
        return out;
      });
    }
    const entry = { role: cs.role.en, tools: cs.tools, modelSrc: cs.modelSrc };
    if (c.layoutMode === 'manual') entry.layoutMode = 'manual';
    if ('modelEnvironment' in cs) entry.modelEnvironment = cs.modelEnvironment;
    if ('modelExposure' in cs) entry.modelExposure = cs.modelExposure;
    entry.modelStats = cs.modelStats;
    entry.items = {
      media,
      text: cs.text ? { title: cs.text.title.en, body: cs.text.body.en } : null,
      inline: cs.inline ? { title: cs.inline.title.en, body: cs.inline.body.en } : null,
      motionBlocks
    };
    return entry;
  }

  // content-JSON → CARDS_LOCALES[lang][id] (en получает i18nOverrides.cardsEn).
  function buildCardLocale(c, lang) {
    const entry = { title: c.card.title[lang], desc: c.card.desc[lang], alt: c.card.alt[lang] };
    if (lang === 'en') return applySparse(entry, c.i18nOverrides && c.i18nOverrides.cardsEn);
    return entry;
  }

  // content-JSON → CASE_LOCALES[lang][id] (en получает i18nOverrides.caseEn).
  function buildCaseLocale(c, lang) {
    const cs = c.case;
    const entry = {
      role: cs.role[lang],
      captions: cs.captions.map((cap) => ({ label: cap.label[lang], desc: cap.desc[lang] })),
      text: { title: cs.text.title[lang], body: cs.text.body[lang] },
      inline: { title: cs.inline.title[lang], body: cs.inline.body[lang] }
    };
    if (Array.isArray(cs.motionBlocks)) {
      entry.motionBlocks = cs.motionBlocks.map((b) => ({ label: b.label[lang], desc: b.desc[lang] }));
    }
    if (lang === 'en') return applySparse(entry, c.i18nOverrides && c.i18nOverrides.caseEn);
    return entry;
  }

  /* ── модель превью: каталог + черновики ────────────────────────────── */

  function casePathOf(id) {
    return 'content/cases/' + id + '.json';
  }

  // Эффективное состояние контента: опубликованный каталог (same-origin
  // content/*.json) с наложенными черновиками и pending-медиа (blob-URL).
  async function collectModel() {
    const catalog = await State.loadCatalog();
    const published = new Map(catalog.cases.map((item) => [item.id, item.data]));
    const settings = State.previewDraft(SETTINGS_PATH) || catalog.settings;
    const filters = Array.isArray(settings.filters) ? settings.filters : [];
    const enabledKeys = new Set(filters.filter((f) => f && f.enabled !== false).map((f) => f.key));
    const labels = {};
    for (const filter of filters) labels[filter.key] = filter.label;
    const cases = [];
    for (const id of settings.cardOrder || []) {
      const path = casePathOf(id);
      const drafted = State.hasDraft(path);
      const data = (drafted && State.previewDraft(path)) || published.get(id);
      if (!data) continue;
      const visible = data.enabled !== false && enabledKeys.has(data.category);
      cases.push({ id, data, drafted, visible });
    }
    return { filters, labels, cases };
  }

  // window.CARDS_DATA для превью: кейсы без черновика — опубликованная
  // запись байт-в-байт, кейсы с черновиком (или вновь включённые) —
  // пересборка из content-JSON.
  function buildCardsData(model) {
    const publishedData = window.CARDS_DATA || {};
    const out = {};
    for (const c of model.cases) {
      if (!c.visible) continue;
      out[c.id] = !c.drafted && publishedData[c.id] ? deepClone(publishedData[c.id]) : buildRuntimeEntry(c.id, c.data);
    }
    return out;
  }

  // window.I18N_DATA для превью: словари UI/меты — из черновиков целиком,
  // карточные и кейсовые локали — по той же гибридной схеме, что CARDS_DATA.
  function buildI18nData(model) {
    const src = window.I18N_DATA || {};
    const out = deepClone(src);
    const uiDraft = State.previewDraft('content/i18n-ui.json');
    if (uiDraft) out.UI_STRINGS = uiDraft;
    const metaDraft = State.previewDraft('content/meta.json');
    if (metaDraft) out.META_STRINGS = { en: metaDraft.en, ru: metaDraft.ru };
    out.CARDS_LOCALES = { en: {}, ru: {} };
    out.CASE_LOCALES = { en: {}, ru: {} };
    for (const c of model.cases) {
      if (!c.visible) continue;
      for (const lang of ['en', 'ru']) {
        const cards = src.CARDS_LOCALES && src.CARDS_LOCALES[lang] ? src.CARDS_LOCALES[lang][c.id] : undefined;
        out.CARDS_LOCALES[lang][c.id] = !c.drafted && cards ? deepClone(cards) : buildCardLocale(c.data, lang);
        const cse = src.CASE_LOCALES && src.CASE_LOCALES[lang] ? src.CASE_LOCALES[lang][c.id] : undefined;
        out.CASE_LOCALES[lang][c.id] = !c.drafted && cse ? deepClone(cse) : buildCaseLocale(c.data, lang);
      }
    }
    return out;
  }

  /* ── мутации документа сайта под черновик ──────────────────────────── */

  // 'hard-surface' → 'filter.hardSurface' (зеркало filterI18nKey генератора).
  function filterI18nKey(key) {
    return 'filter.' + String(key).replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase());
  }

  // Чекбоксы фильтров пересобираются целиком: выключенная категория
  // исчезает, включённая обратно — появляется (в порядке settings.filters).
  function rebuildFilters(doc, model) {
    const panel = doc.getElementById('tags-dropdown-panel');
    if (!panel) return;
    for (const label of Array.from(panel.querySelectorAll('label.tags-dropdown__option'))) label.remove();
    for (const filter of model.filters) {
      if (!filter || filter.enabled === false) continue;
      const label = doc.createElement('label');
      label.className = 'tags-dropdown__option';
      label.setAttribute('role', 'option');
      const input = doc.createElement('input');
      input.setAttribute('type', 'checkbox');
      input.className = 'tags-dropdown__checkbox';
      input.setAttribute('data-filter', filter.key);
      input.setAttribute('data-i18n-attr', 'aria-label:' + filterI18nKey(filter.key));
      input.setAttribute('aria-label', filter.label);
      const span = doc.createElement('span');
      span.className = 'tags-dropdown__label';
      span.setAttribute('data-i18n', filterI18nKey(filter.key));
      span.textContent = filter.label;
      label.appendChild(input);
      label.appendChild(span);
      panel.appendChild(label);
    }
  }

  // Карточка для кейса, которого нет в опубликованном HTML (включён обратно
  // черновиком) — структура повторяет buildCardHtml генератора.
  function buildCardElement(doc, id, data, catLabel) {
    const a = doc.createElement('a');
    a.className = 'work-card';
    a.setAttribute('data-id', id);
    a.setAttribute('data-category', data.category);
    if (data.gameAsset) a.setAttribute('data-game-asset', 'true');
    if (data.cadPlaceholder) a.setAttribute('data-cad-placeholder', 'true');
    a.setAttribute('href', '#' + id);
    const thumb = doc.createElement('div');
    thumb.className = 'work-card__thumb';
    thumb.setAttribute('data-label', data.card.thumbLabel);
    const img = doc.createElement('img');
    img.setAttribute('src', data.card.thumb);
    img.setAttribute('data-i18n-attr', 'alt:card.' + id + '.alt');
    img.setAttribute('alt', data.card.alt.en);
    img.setAttribute('loading', data.card.imgLoading || 'lazy');
    if (data.card.imgFetchPriority) img.setAttribute('fetchpriority', data.card.imgFetchPriority);
    img.setAttribute('decoding', 'async');
    img.setAttribute('width', '800');
    img.setAttribute('height', '600');
    thumb.appendChild(img);
    if (data.card.badge) {
      const badge = doc.createElement('span');
      badge.className = 'work-card__badge';
      badge.textContent = data.card.badge;
      thumb.appendChild(badge);
    }
    const info = doc.createElement('div');
    info.className = 'work-card__info';
    const meta = doc.createElement('div');
    meta.className = 'work-card__meta';
    const cat = doc.createElement('span');
    cat.className = 'work-card__cat';
    cat.textContent = catLabel;
    const tail = doc.createElement('span');
    tail.className = 'work-card__meta-tail';
    const year = doc.createElement('span');
    year.className = 'work-card__year';
    year.textContent = data.year;
    const hint = doc.createElement('span');
    hint.className = 'work-card__hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '↗';
    tail.appendChild(year);
    tail.appendChild(hint);
    meta.appendChild(cat);
    meta.appendChild(tail);
    const title = doc.createElement('h2');
    title.className = 'work-card__title';
    title.setAttribute('data-i18n', 'card.' + id + '.title');
    title.textContent = data.card.title.en;
    const desc = doc.createElement('p');
    desc.className = 'work-card__desc';
    desc.setAttribute('data-i18n', 'card.' + id + '.desc');
    desc.textContent = data.card.desc.en;
    info.appendChild(meta);
    info.appendChild(title);
    info.appendChild(desc);
    a.appendChild(thumb);
    a.appendChild(info);
    return a;
  }

  // Точечные правки существующей карточки под черновик (EN-тексты — как в
  // генерируемом гриде; RU придёт из словарей при переключении языка).
  function updateCardElement(card, id, data) {
    const title = card.querySelector('[data-i18n="card.' + id + '.title"]');
    if (title) title.textContent = data.card.title.en;
    const desc = card.querySelector('[data-i18n="card.' + id + '.desc"]');
    if (desc) desc.textContent = data.card.desc.en;
    const img = card.querySelector('img');
    if (img) {
      img.setAttribute('src', data.card.thumb);
      img.setAttribute('alt', data.card.alt.en);
    }
    const thumb = card.querySelector('.work-card__thumb');
    if (thumb) thumb.setAttribute('data-label', data.card.thumbLabel);
  }

  // Грид: скрытые кейсы выпадают, видимые идут в порядке cardOrder черновика,
  // карточки с черновиком получают новые тексты/медиа.
  function applyGrid(doc, model) {
    const list = doc.getElementById('cards-list');
    if (!list) return;
    const existing = new Map();
    for (const card of Array.from(doc.querySelectorAll('a.work-card[data-id]'))) {
      existing.set(card.getAttribute('data-id'), card);
      card.remove();
    }
    for (const c of model.cases) {
      if (!c.visible) continue;
      let card = existing.get(c.id);
      if (!card) card = buildCardElement(doc, c.id, c.data, model.labels[c.data.category] || c.data.category);
      else if (c.drafted) updateCardElement(card, c.id, c.data);
      list.appendChild(card);
    }
  }

  // Скрипт с данными черновика (CARDS_DATA/I18N_DATA текущего черновика).
  function inlineDataScript(doc, globalName, value) {
    // Blob-URL вместо inline-script: строгий admin-CSP (script-src без
    // 'unsafe-inline') блокировал inline-данные внутри srcdoc-превью
    // (кросс-ревью F2); blob: разрешён в admin/.htaccess. Эскейп '<'
    // сохранён — данные не должны рвать сериализацию srcdoc.
    const code = 'window.' + globalName + ' = ' + JSON.stringify(value).replace(/</g, '\\u003c') + ';';
    const script = doc.createElement('script');
    script.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    return script;
  }

  function replaceDataScript(doc, srcSuffix, inline) {
    for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
      const src = script.getAttribute('src') || '';
      if (src.endsWith(srcSuffix)) {
        script.replaceWith(inline);
        return;
      }
    }
    throw new Error('В index.html не найден <script src="…' + srcSuffix + '">');
  }

  async function buildPreviewHtml() {
    const model = await collectModel();
    const res = await fetch('../index.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Не удалось загрузить index.html (' + res.status + ')');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    // <base> первым узлом head: все относительные пути документа (css, js,
    // assets, lazy model-data.js) резолвятся в реальные файлы сайта.
    const baseEl = doc.createElement('base');
    baseEl.setAttribute('href', new URL('../', window.location.href).href);
    doc.head.insertBefore(baseEl, doc.head.firstChild);

    rebuildFilters(doc, model);
    applyGrid(doc, model);
    replaceDataScript(doc, '/cards-data.js', inlineDataScript(doc, 'CARDS_DATA', buildCardsData(model)));
    replaceDataScript(doc, '/i18n-data.js', inlineDataScript(doc, 'I18N_DATA', buildI18nData(model)));

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /* ── оверлей: открытие/закрытие, язык, ширина экрана ───────────────── */

  function applyLangInFrame() {
    try {
      const win = els.frame.contentWindow;
      if (win && win.I18N && typeof win.I18N.applyLang === 'function') win.I18N.applyLang(desiredLang);
    } catch (_e) {
      /* iframe ещё не готов — язык применится по событию load */
    }
  }

  function setLang(lang) {
    desiredLang = lang;
    els.langEn.classList.toggle('is-active', lang === 'en');
    els.langRu.classList.toggle('is-active', lang === 'ru');
    applyLangInFrame();
  }

  function setViewport(mode) {
    els.frameWrap.classList.toggle('preview-overlay__frame-wrap--mobile', mode === 'mobile');
    els.vpDesktop.classList.toggle('is-active', mode !== 'mobile');
    els.vpMobile.classList.toggle('is-active', mode === 'mobile');
  }

  async function open() {
    els.overlay.hidden = false;
    document.body.classList.add('preview-open');
    els.loading.textContent = 'Собираем предпросмотр…';
    els.loading.hidden = false;
    els.close.focus();
    try {
      els.frame.srcdoc = await buildPreviewHtml();
    } catch (error) {
      els.loading.textContent = 'Не удалось собрать предпросмотр: ' + (error && error.message ? error.message : error);
    }
  }

  function close() {
    els.overlay.hidden = true;
    document.body.classList.remove('preview-open');
    // Остановить GSAP/Lenis/видео внутри iframe — пустой документ.
    els.frame.removeAttribute('srcdoc');
    els.frame.setAttribute('src', 'about:blank');
    els.frame.removeAttribute('src');
    if (els.openBtn) els.openBtn.focus();
  }

  els.frame.addEventListener('load', () => {
    if (!els.overlay.hidden && els.frame.srcdoc) {
      els.loading.hidden = true;
      if (desiredLang !== 'en') applyLangInFrame();
    }
  });

  els.openBtn.addEventListener('click', open);
  els.close.addEventListener('click', close);
  els.langEn.addEventListener('click', () => setLang('en'));
  els.langRu.addEventListener('click', () => setLang('ru'));
  els.vpDesktop.addEventListener('click', () => setViewport('desktop'));
  els.vpMobile.addEventListener('click', () => setViewport('mobile'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.overlay.hidden) close();
  });

  window.AdminPreview = { open, close };
})();
