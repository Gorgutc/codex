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
  const FA_PATH = 'content/free-assets.json';
  // Зеркало generate-content.mjs: формат слота задан позицией (2 wide + 3 tall),
  // в runtime-запись motion-блока попадают только эти ключи.
  const MEDIA_FORMATS = ['wide', 'tall', 'tall', 'wide', 'tall'];
  const MOTION_KEYS = ['source', 'layout', 'playback', 'src', 'vimeoId', 'vimeoHash', 'poster', 'title'];

  const els = {
    openBtn: document.getElementById('preview-btn'),
    overlay: document.getElementById('preview-overlay'),
    frame: document.getElementById('preview-frame'),
    frameWrap: document.getElementById('preview-frame-wrap'),
    loading: document.getElementById('preview-loading'),
    designOriginal: document.getElementById('preview-design-original'),
    designSpecimen: document.getElementById('preview-design-specimen'),
    designChamber: document.getElementById('preview-design-chamber'),
    langEn: document.getElementById('preview-lang-en'),
    langRu: document.getElementById('preview-lang-ru'),
    vpDesktop: document.getElementById('preview-vp-desktop'),
    vpMobile: document.getElementById('preview-vp-mobile'),
    close: document.getElementById('preview-close'),
    banner: document.getElementById('preview-banner')
  };

  let desiredLang = 'en';
  let desiredDesign = 'original';
  let rebuildGeneration = 0;
  let activeBlobUrls = [];
  const defaultBanner = els.banner ? els.banner.textContent : '';

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

  // Один <label>-option tags-dropdown (зеркало filterOptionLine генератора;
  // E-15: без role="option" — option не должен оборачивать интерактив). Общий
  // для index-фильтров и FA-фильтров (последние добавляют счётчик-span).
  function tagsDropdownOption(doc, key, i18nKey, label) {
    const labelEl = doc.createElement('label');
    labelEl.className = 'tags-dropdown__option';
    const input = doc.createElement('input');
    input.setAttribute('type', 'checkbox');
    input.className = 'tags-dropdown__checkbox';
    input.setAttribute('data-filter', key);
    input.setAttribute('data-i18n-attr', 'aria-label:' + i18nKey);
    input.setAttribute('aria-label', label || '');
    const span = doc.createElement('span');
    span.className = 'tags-dropdown__label';
    span.setAttribute('data-i18n', i18nKey);
    span.textContent = label || '';
    labelEl.appendChild(input);
    labelEl.appendChild(span);
    return labelEl;
  }

  // Чекбоксы фильтров пересобираются целиком: выключенная категория
  // исчезает, включённая обратно — появляется (в порядке settings.filters).
  function rebuildFilters(doc, model) {
    const panel = doc.getElementById('tags-dropdown-panel');
    if (!panel) return;
    for (const label of Array.from(panel.querySelectorAll('label.tags-dropdown__option'))) label.remove();
    for (const filter of model.filters) {
      if (!filter || filter.enabled === false) continue;
      panel.appendChild(tagsDropdownOption(doc, filter.key, filterI18nKey(filter.key), filter.label));
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

  // Логотип в шапке (зеркало buildHeaderLogoRegion): задан headerLogo.src → <img
  // class="logo__img">, пусто → текст «CODEX». previewDraft подставляет blob: вместо ещё
  // не загруженного cache-bust-пути, поэтому стейдж-загрузка видна в превью. Применяем
  // ТОЛЬКО когда meta-черновик загружен — иначе оставляем опубликованный HTML как есть.
  function applyHeaderLogo(doc, metaDraft) {
    if (!metaDraft) return;
    const src = metaDraft.headerLogo && metaDraft.headerLogo.src;
    for (const link of Array.from(doc.querySelectorAll('a.logo'))) {
      if (src) {
        const img = doc.createElement('img');
        img.className = 'logo__img';
        img.setAttribute('src', src);
        img.setAttribute('alt', 'CODEX');
        img.setAttribute('width', '120');
        img.setAttribute('height', '24');
        img.setAttribute('loading', 'eager');
        img.setAttribute('decoding', 'async');
        link.replaceChildren(img);
      } else {
        const span = doc.createElement('span');
        span.className = 'logo__text';
        span.textContent = 'CODEX';
        link.replaceChildren(span);
      }
    }
  }

  // Скрипт с данными черновика (CARDS_DATA/I18N_DATA текущего черновика).
  function inlineDataScript(doc, globalName, value, blobUrls) {
    // Blob-URL вместо inline-script: строгий admin-CSP (script-src без
    // 'unsafe-inline') блокировал inline-данные внутри srcdoc-превью
    // (кросс-ревью F2); blob: разрешён в admin/.htaccess. Эскейп '<'
    // сохранён — данные не должны рвать сериализацию srcdoc.
    const code = 'window.' + globalName + ' = ' + JSON.stringify(value).replace(/</g, '\\u003c') + ';';
    const script = doc.createElement('script');
    script.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    blobUrls.push(script.src);
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

  function applyDesignPreview(doc, design, generation) {
    doc.documentElement.setAttribute('data-design-preview', design);
    doc.documentElement.setAttribute('data-preview-generation', String(generation));
  }

  async function buildPreviewHtml(design, blobUrls, generation) {
    const model = await collectModel();
    const res = await fetch('../index.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Не удалось загрузить index.html (' + res.status + ')');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    applyDesignPreview(doc, design, generation);

    // <base> первым узлом head: все относительные пути документа (css, js,
    // assets, lazy model-data.js) резолвятся в реальные файлы сайта.
    const baseEl = doc.createElement('base');
    baseEl.setAttribute('href', new URL('../', window.location.href).href);
    doc.head.insertBefore(baseEl, doc.head.firstChild);

    rebuildFilters(doc, model);
    applyGrid(doc, model);
    applyHeaderLogo(doc, State.previewDraft('content/meta.json'));
    replaceDataScript(doc, '/cards-data.js', inlineDataScript(doc, 'CARDS_DATA', buildCardsData(model), blobUrls));
    replaceDataScript(doc, '/i18n-data.js', inlineDataScript(doc, 'I18N_DATA', buildI18nData(model), blobUrls));

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /* ═══ FREE ASSETS preview (F5) ══════════════════════════════════════════
     Та же стратегия, что и у index-превью, но для free-assets.html: грид
     ассетов рендерит js/free-assets.js из window.FA_DATA, поэтому подмена
     fa-data.js + i18n-data.js черновиком пересобирает каталог; статичный
     dropdown fa-filters и обзор fa-tag-cards пересобираются из черновика
     (видимость + порядок). Медиа (thumb/model) берём из ОПУБЛИКОВАННОГО
     FA_DATA — закоммиченные cache-bust-файлы резолвятся, а pending-загрузка
     (ещё не на сервере) в превью НЕ видна (об этом говорит баннер). */

  function isFaRoute() {
    return /^#\/free-assets/.test(window.location.hash || '');
  }

  // Зеркала generate-content.mjs: faEffectiveBase / faTagKey / faFilterI18nKey.
  function faTagKey(key) {
    return 'faTag.' + String(key).replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase());
  }
  const FA_FILTER_I18N_SUFFIX = { product: 'productViz', game: 'gameAssets' };
  function faFilterI18nKey(key) {
    if (FA_FILTER_I18N_SUFFIX[key]) return 'filter.' + FA_FILTER_I18N_SUFFIX[key];
    return filterI18nKey(key);
  }

  // content/free-assets.json (черновик, иначе опубликованный) → видимые
  // категории с видимыми ассетами (зеркало visibleFaCategories генератора).
  async function collectFaModel() {
    let content = State.hasDraft(FA_PATH) ? State.previewDraft(FA_PATH) : null;
    if (!content) {
      const res = await fetch('../content/free-assets.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Не удалось загрузить free-assets.json (' + res.status + ')');
      content = await res.json();
    }
    const categories = Array.isArray(content.categories) ? content.categories : [];
    return categories
      .filter((c) => c !== null && typeof c === 'object' && c.enabled !== false)
      .map((c) => ({
        key: c.key,
        tagCard: c.tagCard,
        items: (Array.isArray(c.items) ? c.items : []).filter(
          (it) => it !== null && typeof it === 'object' && it.enabled !== false
        )
      }))
      .filter((c) => c.items.length > 0);
  }

  // id → опубликованная запись FA_DATA (плоско по категориям). Опубликованное
  // медиа указывает на закоммиченные cache-bust-файлы; базовое имя pending-
  // загрузки 404'ило бы, поэтому медиа превью всегда отсюда.
  function publishedFaById() {
    const map = {};
    const pub = window.FA_DATA || {};
    for (const key of Object.keys(pub)) {
      for (const item of pub[key] || []) map[item.id] = item;
    }
    return map;
  }

  // Медиа FA-ассета в превью. Черновик — главный (точно как генератор: thumb/model
  // эмитятся `if (key in item)` его значением): явное base-имя honored, null
  // выключает превью, отсутствие ключа → runtime берёт id-default. ИСКЛЮЧЕНИЕ:
  // pending-загрузка (previewDraft подставляет blob: вместо ещё не существующего
  // на сервере cache-bust-файла) — показываем СТАРОЕ закоммиченное медиа (pub),
  // иначе ./assets/cards/blob:….svg сломался бы (баннер про это предупреждает).
  function assignFaMedia(entry, key, item, pub) {
    if (key in item && item[key] === null) { entry[key] = null; return; }  // черновик выключил превью
    if (key in item && typeof item[key] === 'string') {
      if (/^blob:/i.test(item[key])) {                                     // pending-загрузка (нет на сервере)
        if (pub && key in pub) entry[key] = pub[key];                      // → старый закоммиченный файл
        // иначе ключа нет → runtime id-default
      } else {
        entry[key] = item[key];                                           // закоммиченное base-имя — верно черновику
      }
      return;
    }
    // черновик опустил ключ → runtime id-default (точно как генератор)
  }

  // видимая модель → window.FA_DATA для превью (зеркало buildFaDataJs). hasFile/
  // size берём из ОПУБЛИКОВАННОЙ записи: их даёт fs.existsSync(downloads/<file>) на
  // генерации, что браузер синхронно не повторит. Поэтому правка имени архива
  // (`file`) и состояние кнопки Download в превью отражают опубликованный каталог —
  // баннер про это предупреждает. Остальные поля — из черновика.
  function buildFaDataForPreview(visible) {
    const pubById = publishedFaById();
    const out = {};
    for (const cat of visible) {
      out[cat.key] = cat.items.map((item) => {
        const pub = pubById[item.id];
        const entry = { id: item.id };
        assignFaMedia(entry, 'thumb', item, pub);
        assignFaMedia(entry, 'model', item, pub);
        entry.cat = item.cat;
        entry.title = item.title;
        entry.desc = (item.desc && item.desc.en) || '';
        entry.badge = item.badge;
        entry.contents = item.contents;
        entry.file = item.file;
        entry.hasFile = pub ? !!pub.hasFile : false;
        entry.size = pub ? pub.size : item.size;
        entry.bg = item.bg;
        return entry;
      });
    }
    return out;
  }

  function buildFaLocalesForPreview(visible) {
    const en = {};
    const ru = {};
    for (const cat of visible) {
      for (const item of cat.items) {
        en[item.id] = { desc: (item.desc && item.desc.en) || '' };
        ru[item.id] = { desc: (item.desc && item.desc.ru) || '' };
      }
    }
    return { en, ru };
  }

  // Бейджи faTag.<camel>.count управляются i18n (data-i18n) — пересчитываем их
  // из видимых счётчиков черновика, ровно как uiStringsWithCounts на генерации,
  // чтобы счётчики обзора совпали с показанным каталогом.
  function applyFaCounts(uiStrings, visible) {
    for (const lang of ['en', 'ru']) {
      const faTag = uiStrings[lang] && uiStrings[lang].faTag;
      if (!faTag || typeof faTag !== 'object') continue;
      for (const cat of visible) {
        const camel = faTagKey(cat.key).slice('faTag.'.length);
        if (faTag[camel] && typeof faTag[camel] === 'object') faTag[camel].count = cat.items.length + ' assets';
      }
    }
  }

  // window.I18N_DATA для FA-превью: словари UI/меты из черновиков, FA-описания из
  // черновика, пересчитанные FA-счётчики. CARDS/CASE-локали переносятся из
  // опубликованного payload (FA-страница их не использует).
  function buildFaI18nData(visible) {
    const out = deepClone(window.I18N_DATA || {});
    const uiDraft = State.previewDraft('content/i18n-ui.json');
    const ui = uiDraft ? deepClone(uiDraft) : deepClone(out.UI_STRINGS || {});
    applyFaCounts(ui, visible);
    out.UI_STRINGS = ui;
    const metaDraft = State.previewDraft('content/meta.json');
    if (metaDraft) out.META_STRINGS = { en: metaDraft.en, ru: metaDraft.ru };
    out.FA_LOCALES = buildFaLocalesForPreview(visible);
    return out;
  }

  // FA-option = базовый tags-dropdown option (общий хелпер) + счётчик видимых.
  function faFilterOption(doc, key, i18nKey, label, count) {
    const labelEl = tagsDropdownOption(doc, key, i18nKey, label);
    const countEl = doc.createElement('span');
    countEl.className = 'tags-dropdown__option-count';
    countEl.id = 'opt-count-' + key;
    countEl.textContent = String(count);
    labelEl.appendChild(countEl);
    return labelEl;
  }

  function rebuildFaFilters(doc, visible, enFilter) {
    const panel = doc.getElementById('tags-dropdown-panel');
    if (!panel) return;
    for (const label of Array.from(panel.querySelectorAll('label.tags-dropdown__option'))) label.remove();
    panel.appendChild(faFilterOption(doc, 'all', 'filter.all', enFilter.all, visible.length));
    for (const cat of visible) {
      const i18nKey = faFilterI18nKey(cat.key);
      panel.appendChild(faFilterOption(doc, cat.key, i18nKey, enFilter[i18nKey.slice('filter.'.length)], cat.items.length));
    }
  }

  // Tag-card с нуля (зеркало buildFaTagCardsRegion) — для вновь включённой
  // категории, которой опубликованная страница никогда не рендерила. Текстовые
  // узлы несут data-i18n-ключи; in-frame i18n-walker заполнит их на load.
  function buildTagCard(doc, cat, index, enFilter) {
    const key = cat.key;
    const camel = faTagKey(key).slice('faTag.'.length);
    const tag = cat.tagCard || {};
    const gameAsset = tag.gameAsset === true;
    const label = enFilter[faFilterI18nKey(key).slice('filter.'.length)] || '';
    const a = doc.createElement('a');
    a.className = index === 0 ? 'tag-card tag-card--active work-card' : 'tag-card work-card';
    a.id = 'tag-' + key;
    a.setAttribute('href', '#' + key);
    a.setAttribute('data-tag', key);
    a.setAttribute('data-category', key);
    a.setAttribute('data-game-asset', gameAsset ? 'true' : 'false');
    const thumb = doc.createElement('div');
    thumb.className = 'tag-card__thumb work-card__thumb';
    thumb.setAttribute('data-label', label);
    const img = doc.createElement('img');
    img.setAttribute('src', './assets/cards/' + (tag.thumb || key) + '.svg');
    img.setAttribute('data-i18n-attr', 'alt:faTag.' + camel + '.alt');
    img.setAttribute('alt', '');
    img.setAttribute('loading', index === 0 ? 'eager' : 'lazy');
    if (index === 0) img.setAttribute('fetchpriority', 'high');
    img.setAttribute('decoding', 'async');
    img.setAttribute('width', '800');
    img.setAttribute('height', '600');
    thumb.appendChild(img);
    if (gameAsset) {
      const badge = doc.createElement('span');
      badge.className = 'work-card__badge';
      badge.setAttribute('data-i18n', 'faTag.' + camel + '.badge');
      thumb.appendChild(badge);
    }
    const count = doc.createElement('span');
    count.className = 'tag-card__count-badge';
    count.setAttribute('data-i18n', 'faTag.' + camel + '.count');
    count.textContent = cat.items.length + ' assets';
    thumb.appendChild(count);
    const info = doc.createElement('div');
    info.className = 'tag-card__info work-card__info';
    const meta = doc.createElement('div');
    meta.className = 'tag-card__meta work-card__meta';
    const catSpan = doc.createElement('span');
    catSpan.className = 'tag-card__cat work-card__cat';
    catSpan.setAttribute('data-i18n', 'faTag.' + camel + '.cat');
    const tail = doc.createElement('span');
    tail.className = 'tag-card__meta-tail work-card__meta-tail';
    const format = doc.createElement('span');
    format.className = 'tag-card__format work-card__year';
    format.setAttribute('data-i18n', 'faTag.' + camel + '.format');
    const hint = doc.createElement('span');
    hint.className = 'tag-card__hint work-card__hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = '↗';
    tail.appendChild(format);
    tail.appendChild(hint);
    meta.appendChild(catSpan);
    meta.appendChild(tail);
    const title = doc.createElement('h2');
    title.className = 'tag-card__title work-card__title';
    title.setAttribute('data-i18n', 'faTag.' + camel + '.title');
    const desc = doc.createElement('p');
    desc.className = 'tag-card__desc work-card__desc';
    desc.setAttribute('data-i18n', 'faTag.' + camel + '.desc');
    info.appendChild(meta);
    info.appendChild(title);
    info.appendChild(desc);
    a.appendChild(thumb);
    a.appendChild(info);
    return a;
  }

  // Обзор fa-tag-cards: переиспользуем карточки опубликованной страницы (полная
  // i18n-fidelity), переупорядоченные под черновик и обрезанные до видимых
  // категорий; свежую карточку строим только для категории, которой
  // опубликованная страница не рендерила.
  function rebuildFaTagCards(doc, visible, enFilter) {
    const list = doc.getElementById('cards-list');
    if (!list) return;
    const existing = new Map();
    for (const card of Array.from(list.querySelectorAll('a.tag-card[data-tag]'))) {
      existing.set(card.getAttribute('data-tag'), card);
      card.remove();
    }
    visible.forEach((cat, index) => {
      let card = existing.get(cat.key);
      if (!card) card = buildTagCard(doc, cat, index, enFilter);
      card.classList.toggle('tag-card--active', index === 0);
      list.appendChild(card);
    });
  }

  async function buildFreeAssetsPreviewHtml(design, blobUrls, generation) {
    const visible = await collectFaModel();
    const i18nData = buildFaI18nData(visible);
    const enUi = (i18nData.UI_STRINGS && i18nData.UI_STRINGS.en) || {};
    const enFilter = (enUi.filter && typeof enUi.filter === 'object' && enUi.filter) || {};
    const res = await fetch('../free-assets.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Не удалось загрузить free-assets.html (' + res.status + ')');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    applyDesignPreview(doc, design, generation);

    const baseEl = doc.createElement('base');
    baseEl.setAttribute('href', new URL('../', window.location.href).href);
    doc.head.insertBefore(baseEl, doc.head.firstChild);

    rebuildFaFilters(doc, visible, enFilter);
    rebuildFaTagCards(doc, visible, enFilter);
    applyHeaderLogo(doc, State.previewDraft('content/meta.json'));
    replaceDataScript(doc, '/fa-data.js', inlineDataScript(doc, 'FA_DATA', buildFaDataForPreview(visible), blobUrls));
    replaceDataScript(doc, '/i18n-data.js', inlineDataScript(doc, 'I18N_DATA', i18nData, blobUrls));

    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /* ── оверлей: открытие/закрытие, язык, ширина экрана ───────────────── */

  function applyLangInFrame() {
    try {
      const win = els.frame.contentWindow;
      if (!win || !win.I18N) return;
      if (typeof win.I18N.setLang === 'function') win.I18N.setLang(desiredLang);
      else if (typeof win.I18N.applyLang === 'function') win.I18N.applyLang(desiredLang);
    } catch (_e) {
      /* iframe ещё не готов — язык применится по событию load */
    }
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'ru') return;
    desiredLang = lang;
    els.langEn.classList.toggle('is-active', lang === 'en');
    els.langRu.classList.toggle('is-active', lang === 'ru');
    els.langEn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
    els.langRu.setAttribute('aria-pressed', lang === 'ru' ? 'true' : 'false');
    applyLangInFrame();
  }

  function setViewport(mode) {
    els.frameWrap.classList.toggle('preview-overlay__frame-wrap--mobile', mode === 'mobile');
    els.vpDesktop.classList.toggle('is-active', mode !== 'mobile');
    els.vpMobile.classList.toggle('is-active', mode === 'mobile');
  }

  function updateDesignButtons() {
    const buttons = [
      [els.designOriginal, 'original'],
      [els.designSpecimen, 'specimen'],
      [els.designChamber, 'chamber']
    ];
    for (const [button, design] of buttons) {
      if (!button) continue;
      const active = design === desiredDesign;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function revokeBlobUrls(urls) {
    for (const url of urls) URL.revokeObjectURL(url);
  }

  function clearFrame() {
    els.frame.removeAttribute('srcdoc');
    els.frame.setAttribute('src', 'about:blank');
    revokeBlobUrls(activeBlobUrls);
    activeBlobUrls = [];
  }

  function setBanner(isFa) {
    if (!els.banner) return;
    els.banner.textContent = isFa
      ? 'Предпросмотр черновика каталога Free Assets: видимость, порядок, тексты и base-имена медиа — из черновика. Загрузка новых файлов (3D-превью, постеры) и состояние Download/размер архива отражают ОПУБЛИКОВАННЫЙ каталог — проверяйте их после публикации.'
      : defaultBanner;
  }

  async function rebuildPreview() {
    const generation = ++rebuildGeneration;
    const fa = isFaRoute();
    const blobUrls = [];
    setBanner(fa);
    els.loading.textContent = 'Собираем предпросмотр…';
    els.loading.hidden = false;
    try {
      const html = fa
        ? await buildFreeAssetsPreviewHtml(desiredDesign, blobUrls, generation)
        : await buildPreviewHtml(desiredDesign, blobUrls, generation);
      if (generation !== rebuildGeneration || els.overlay.hidden) {
        revokeBlobUrls(blobUrls);
        return;
      }

      const previousBlobUrls = activeBlobUrls;
      els.frame.dataset.previewGeneration = String(generation);
      els.frame.srcdoc = html;
      activeBlobUrls = blobUrls;
      revokeBlobUrls(previousBlobUrls);
    } catch (error) {
      revokeBlobUrls(blobUrls);
      if (generation !== rebuildGeneration || els.overlay.hidden) return;
      els.loading.textContent = 'Не удалось собрать предпросмотр: ' + (error && error.message ? error.message : error);
    }
  }

  function setDesign(design) {
    if (!['original', 'specimen', 'chamber'].includes(design) || design === desiredDesign) return;
    desiredDesign = design;
    updateDesignButtons();
    if (!els.overlay.hidden) rebuildPreview();
  }

  async function open() {
    els.overlay.hidden = false;
    document.body.classList.add('preview-open');
    updateDesignButtons();
    els.close.focus();
    return rebuildPreview();
  }

  function close() {
    rebuildGeneration += 1;
    els.overlay.hidden = true;
    document.body.classList.remove('preview-open');
    // Остановить GSAP/Lenis/видео внутри iframe — пустой документ.
    clearFrame();
    if (els.openBtn) els.openBtn.focus();
  }

  els.frame.addEventListener('load', () => {
    if (!els.overlay.hidden && els.frame.srcdoc) {
      const frameGeneration = els.frame.contentDocument
        && els.frame.contentDocument.documentElement.getAttribute('data-preview-generation');
      if (frameGeneration !== String(rebuildGeneration)) return;
      els.loading.hidden = true;
      applyLangInFrame();
    }
  });

  els.openBtn.addEventListener('click', open);
  els.close.addEventListener('click', close);
  els.designOriginal.addEventListener('click', () => setDesign('original'));
  els.designSpecimen.addEventListener('click', () => setDesign('specimen'));
  els.designChamber.addEventListener('click', () => setDesign('chamber'));
  els.langEn.addEventListener('click', () => setLang('en'));
  els.langRu.addEventListener('click', () => setLang('ru'));
  els.vpDesktop.addEventListener('click', () => setViewport('desktop'));
  els.vpMobile.addEventListener('click', () => setViewport('mobile'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.overlay.hidden) close();
  });

  window.AdminPreview = { open, close, setDesign };
})();
