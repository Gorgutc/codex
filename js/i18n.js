/* ═════════════════════════════════════════════════════════════════════════════
   i18n.js — Phase 0 logic for RU/EN toggle (v0.8.x)

   Зависимости: window.I18N_DATA (i18n-data.js загружается ПЕРЕД этим файлом).
   Подключение: gsap → ScrollTrigger → SplitText → i18n-data.js → i18n.js →
   shared-runtime.js → main.js → animations.js.

   Persistence: URL ?lang=ru|en. NO localStorage / sessionStorage / cookies.

   API (window.I18N): getLang(), t(key), applyLang(lang), isValidLang(lang),
                      SUPPORTED_LANGS.
   Событие: 'i18n:changed' (CustomEvent с detail.lang) — диспатчится ТОЛЬКО
            при реальной смене языка (lastAppliedLang guard).
   ═════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SUPPORTED_LANGS = ['en', 'ru'];
  const DEFAULT_LANG = 'en';
  // Strict allowlist для data-i18n-html. Всё что не в этом списке — эскейпится.
  const ALLOWED_HTML_TAGS = /^(br|b|em|i|strong)$/i;

  let currentLang = DEFAULT_LANG;
  let lastAppliedLang = null;

  function getCIS() {
    const d = window.I18N_DATA;
    return (d && Array.isArray(d.CIS_COUNTRIES)) ? d.CIS_COUNTRIES : [];
  }
  function uiDict() {
    const d = window.I18N_DATA;
    return (d && d.UI_STRINGS) ? d.UI_STRINGS : { en: {}, ru: {} };
  }
  function metaDict() {
    const d = window.I18N_DATA;
    return (d && d.META_STRINGS) ? d.META_STRINGS : { en: {}, ru: {} };
  }
  function isValidLang(lang) { return SUPPORTED_LANGS.indexOf(lang) !== -1; }
  function getLang() { return currentLang; }

  // Безопасный геттер по dot-notation, проверяет own-properties (защита от
  // случайного попадания в Object.prototype.constructor и т.п.).
  function getKey(obj, key) {
    if (!obj || typeof key !== 'string') return undefined;
    const parts = key.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur && typeof cur === 'object' &&
          Object.prototype.hasOwnProperty.call(cur, parts[i])) {
        cur = cur[parts[i]];
      } else {
        return undefined;
      }
    }
    return cur;
  }
  function t(key) {
    const d = uiDict();
    // 1) Primary: UI_STRINGS[currentLang].<key>
    const v = getKey(d[currentLang], key);
    if (typeof v === 'string') return v;

    // 2) Namespace lookup: 'card.<id>.<field>' → CARDS_LOCALES[currentLang][id][field]
    //    Phase 2 — work-card title/desc/alt живут в CARDS_LOCALES чтобы не
    //    раздувать UI_STRINGS на 18×3 ключей.
    if (key.indexOf('card.') === 0) {
      const data = window.I18N_DATA;
      const cards = data && data.CARDS_LOCALES;
      if (cards) {
        const sub = key.slice(5); // strip 'card.'
        const v2 = getKey(cards[currentLang], sub);
        if (typeof v2 === 'string') return v2;
        const fb2 = getKey(cards[DEFAULT_LANG], sub);
        if (typeof fb2 === 'string') return fb2;
      }
    }

    // 3) Fallback: UI_STRINGS[DEFAULT_LANG].<key>
    const fb = getKey(d[DEFAULT_LANG], key);
    return typeof fb === 'string' ? fb : key;
  }
  function tMeta(key) {
    const d = metaDict();
    const v = getKey(d[currentLang], key);
    if (typeof v === 'string') return v;
    const fb = getKey(d[DEFAULT_LANG], key);
    return typeof fb === 'string' ? fb : '';
  }

  // Allowlist-санитайзер: эскейпит все теги, затем выборочно "разэскейпивает"
  // только разрешённые (br, b, em, i, strong). Защита от stored-XSS если когда-то
  // словарь начнут наполнять из внешнего источника.
  function safeHtml(value) {
    if (typeof value !== 'string') return '';
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/&lt;(\/?)([a-z0-9]+)\s*(\/?)&gt;/gi,
      function (full, slash, tag, selfClose) {
        if (ALLOWED_HTML_TAGS.test(tag)) {
          return '<' + slash + tag.toLowerCase() + (selfClose ? '/' : '') + '>';
        }
        return full;
      });
  }

  function readLangFromURL() {
    try {
      const u = new URL(window.location.href);
      const v = (u.searchParams.get('lang') || '').toLowerCase();
      return isValidLang(v) ? v : null;
    } catch (_) { return null; }
  }

  function applyTextContent() {
    const els = document.querySelectorAll('[data-i18n]');
    for (let i = 0; i < els.length; i++) {
      // Phase 4a — JS-driven transitions (COPY LINK → COPIED → COPY LINK)
      // могут временно ставить data-i18n-pause, чтобы walker не вытер их
      // promo-state на смене языка в середине таймаута.
      if (els[i].hasAttribute('data-i18n-pause')) continue;
      const key = els[i].getAttribute('data-i18n');
      if (!key) continue;
      const v = t(key);
      if (typeof v === 'string') els[i].textContent = v;
    }
  }
  function applyInnerHTML() {
    const els = document.querySelectorAll('[data-i18n-html]');
    for (let i = 0; i < els.length; i++) {
      const key = els[i].getAttribute('data-i18n-html');
      if (!key) continue;
      const v = t(key);
      if (typeof v === 'string') els[i].innerHTML = safeHtml(v);
    }
  }
  function applyAttrs() {
    const els = document.querySelectorAll('[data-i18n-attr]');
    for (let i = 0; i < els.length; i++) {
      const spec = els[i].getAttribute('data-i18n-attr') || '';
      const pairs = spec.split(';');
      for (let j = 0; j < pairs.length; j++) {
        const parts = pairs[j].split(':');
        const attr = (parts[0] || '').trim();
        const key = (parts[1] || '').trim();
        if (!attr || !key) continue;
        const v = t(key);
        if (typeof v === 'string') els[i].setAttribute(attr, v);
      }
    }
  }
  function applyMetaAttrs() {
    const els = document.querySelectorAll('[data-i18n-meta]');
    for (let i = 0; i < els.length; i++) {
      const key = els[i].getAttribute('data-i18n-meta');
      if (!key) continue;
      const v = tMeta(key);
      if (typeof v !== 'string' || !v) continue;
      const tag = els[i].tagName;
      if (tag === 'META') els[i].setAttribute('content', v);
      else if (tag === 'TITLE') els[i].textContent = v;
    }
  }

  function updateURL(lang) {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('lang', lang);
      window.history.replaceState(null, '', u.toString());
    } catch (_) { /* silent */ }
  }

  function isExternalHref(rawHref) {
    if (!rawHref) return true;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return true;
    if (rawHref.charAt(0) === '#') return true;
    if (/^https?:\/\//i.test(rawHref)) {
      try {
        const u = new URL(rawHref);
        return u.origin !== window.location.origin;
      } catch (_) { return true; }
    }
    return false;
  }

  function propagateLangToLinks(lang) {
    const anchors = document.querySelectorAll('a[href]');
    for (let i = 0; i < anchors.length; i++) {
      const raw = anchors[i].getAttribute('href');
      if (isExternalHref(raw)) continue;
      try {
        const u = new URL(anchors[i].href, window.location.href);
        if (u.origin !== window.location.origin) continue;
        u.searchParams.set('lang', lang);
        anchors[i].setAttribute('href', u.pathname + u.search + u.hash);
      } catch (_) { /* silent */ }
    }
  }

  function updateToggleLabels(lang) {
    const opposite = lang === 'ru' ? 'EN' : 'RU';
    const ariaSwitch = lang === 'ru'
      ? 'Switch language to English'
      : 'Switch language to Russian';

    // Same #lang-toggle на desktop и на mobile (CSS меняет только размер /
    // padding; DOM-элемент один).
    const btn = document.getElementById('lang-toggle');
    if (btn) {
      const span = btn.querySelector('.lang-toggle__current');
      if (span) span.textContent = opposite;
      btn.setAttribute('aria-label', ariaSwitch);
    }
  }

  // Phase 2b — overlay case-view content (CARDS_DATA в main.js) переводами
  // из I18N_DATA.CASE_LOCALES.
  //
  // Структура CARDS_DATA[id].items (см. makeItems() в main.js):
  //   {
  //     media:  [{ label, desc, src, bg, format, ... } × 5],
  //     motionBlocks: [{ label, desc, source, layout, playback, ... }] | null,
  //     text:   { title, body } | null,
  //     inline: { title, body } | null
  //   }
  //
  // На первом applyLang снимаем deep-snapshot baseline (исходный EN из
  // main.js); при каждой смене языка восстанавливаем baseline и накладываем
  // overlay для нового языка. JSON.parse(JSON.stringify(...)) рвёт shared
  // refs внутри text/inline, поэтому мы безопасно мутируем эти объекты на
  // каждом id отдельно.
  let __cardsDataBaseline = null;
  function overlayCases(lang) {
    const data = window.I18N_DATA;
    const cards = window.CARDS_DATA;
    if (!data || !data.CASE_LOCALES || !cards) return;

    if (!__cardsDataBaseline) {
      try { __cardsDataBaseline = JSON.parse(JSON.stringify(cards)); }
      catch (_) { return; }
    }

    // 1) Restore baseline (role + media[i].label/desc + text + inline).
    Object.keys(cards).forEach(id => {
      const card = cards[id];
      const base = __cardsDataBaseline[id];
      if (!card || !base) return;
      card.role = base.role;
      const it = card.items;
      const bi = base.items;
      if (!it || !bi) return;
      if (Array.isArray(it.media) && Array.isArray(bi.media)) {
        it.media.forEach((m, i) => {
          const bm = bi.media[i];
          if (!bm) return;
          m.label = bm.label;
          m.desc  = bm.desc;
        });
      }
      if (it.text && bi.text)     { it.text.title   = bi.text.title;   it.text.body   = bi.text.body; }
      if (it.inline && bi.inline) { it.inline.title = bi.inline.title; it.inline.body = bi.inline.body; }
      if (Array.isArray(it.motionBlocks) && Array.isArray(bi.motionBlocks)) {
        it.motionBlocks.forEach((m, i) => {
          const bm = bi.motionBlocks[i];
          if (!bm) return;
          m.label = bm.label;
          m.desc  = bm.desc;
        });
      }
    });

    // 2) Overlay для нового языка. Для DEFAULT_LANG шаг 1 уже дал EN — выходим.
    if (lang === DEFAULT_LANG) return;
    const dict = data.CASE_LOCALES[lang];
    if (!dict) return;

    Object.keys(cards).forEach(id => {
      const card = cards[id];
      const tr = dict[id];
      if (!card || !tr) return;
      if (typeof tr.role === 'string') card.role = tr.role;
      const it = card.items;
      if (!it) return;
      if (Array.isArray(tr.captions) && Array.isArray(it.media)) {
        tr.captions.forEach((cap, i) => {
          if (!it.media[i] || !cap) return;
          if (typeof cap.label === 'string') it.media[i].label = cap.label;
          if (typeof cap.desc  === 'string') it.media[i].desc  = cap.desc;
        });
      }
      if (tr.text && it.text) {
        if (typeof tr.text.title === 'string') it.text.title = tr.text.title;
        if (typeof tr.text.body  === 'string') it.text.body  = tr.text.body;
      }
      if (tr.inline && it.inline) {
        if (typeof tr.inline.title === 'string') it.inline.title = tr.inline.title;
        if (typeof tr.inline.body  === 'string') it.inline.body  = tr.inline.body;
      }
      if (Array.isArray(tr.motionBlocks) && Array.isArray(it.motionBlocks)) {
        tr.motionBlocks.forEach((block, i) => {
          if (!it.motionBlocks[i] || !block) return;
          if (typeof block.label === 'string') it.motionBlocks[i].label = block.label;
          if (typeof block.desc  === 'string') it.motionBlocks[i].desc  = block.desc;
        });
      }
    });
  }

  // Phase 3 — overlay FA catalog (window.FA_DATA в fa-data.js) translations
  // из I18N_DATA.FA_LOCALES.
  //
  // FA_DATA structure: { category: [ { id, cat, title, desc, badge,
  // contents, size, file, bg }, ... ] }
  // Переводимое поле: desc. Остальное — англицизмы proff-индустрии.
  //
  // Baseline snapshot — отдельный от cases (это отдельная страница);
  // на free-assets.js fires re-render через i18n:changed listener.
  let __faDataBaseline = null;
  function overlayFA(lang) {
    const data = window.I18N_DATA;
    const fa = window.FA_DATA;
    if (!data || !data.FA_LOCALES || !fa) return;

    if (!__faDataBaseline) {
      try { __faDataBaseline = JSON.parse(JSON.stringify(fa)); }
      catch (_) { return; }
    }

    // 1) Restore baseline (desc) для каждого asset в каждом category-bucket.
    Object.keys(fa).forEach(cat => {
      const items = fa[cat];
      const baseItems = __faDataBaseline[cat];
      if (!Array.isArray(items) || !Array.isArray(baseItems)) return;
      items.forEach((it, i) => {
        const bi = baseItems[i];
        if (!bi) return;
        if (typeof bi.desc === 'string') it.desc = bi.desc;
      });
    });

    if (lang === DEFAULT_LANG) return;

    // 2) Overlay по id. FA_LOCALES — плоский dict, искать по item.id.
    const dict = data.FA_LOCALES[lang];
    if (!dict) return;
    Object.keys(fa).forEach(cat => {
      const items = fa[cat];
      if (!Array.isArray(items)) return;
      items.forEach(it => {
        const tr = dict[it.id];
        if (tr && typeof tr.desc === 'string') it.desc = tr.desc;
      });
    });
  }

  function applyLang(lang) {
    if (!isValidLang(lang)) lang = DEFAULT_LANG;
    const changed = lastAppliedLang !== lang;
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang);
    applyTextContent();
    applyInnerHTML();
    applyAttrs();
    applyMetaAttrs();
    overlayCases(lang);
    overlayFA(lang);
    updateURL(lang);
    if (changed) propagateLangToLinks(lang);
    updateToggleLabels(lang);
    lastAppliedLang = lang;
    if (changed) {
      try {
        window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
      } catch (_) { /* silent */ }
    }
  }

  function detectFromNavigator() {
    try {
      const langs = navigator.languages || [navigator.language || ''];
      for (let i = 0; i < langs.length; i++) {
        if (/^ru\b/i.test(langs[i] || '')) return 'ru';
      }
    } catch (_) { /* silent */ }
    return 'en';
  }

  // Cloudflare CDN trace: бесплатный, без лимитов, без CORS-проблем.
  // Любая ошибка проглатывается тихо — никаких console.error
  // (verify-frozen.js CONSOLE-no-internal-errors).
  async function detectFromGeo() {
    let timer = null;
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    try {
      if (ctrl) {
        timer = setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, 1500);
      }
      const opts = ctrl ? { signal: ctrl.signal } : {};
      const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', opts);
      if (!res || !res.ok) return null;
      const txt = await res.text();
      if (!txt) return null;
      const m = /(?:^|\n)loc=([A-Z]{2})/.exec(txt);
      if (!m) return null;
      const cc = m[1].toUpperCase();
      return getCIS().indexOf(cc) !== -1 ? 'ru' : 'en';
    } catch (_) {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function bindToggle() {
    const btn = document.getElementById('lang-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      applyLang(currentLang === 'ru' ? 'en' : 'ru');
    });
  }

  function init() {
    const urlLang = readLangFromURL();
    if (urlLang) {
      applyLang(urlLang);
      bindToggle();
      return;
    }
    // Первый рендер всегда EN (быстрый FCP, нет мигания).
    applyLang(DEFAULT_LANG);
    bindToggle();
    // Асинхронно: geo → fallback на navigator.language → final lang.
    detectFromGeo().then(function (geoLang) {
      if (geoLang === null) geoLang = detectFromNavigator();
      if (geoLang && geoLang !== currentLang) applyLang(geoLang);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Phase 4a — format-helper для строк с плейсхолдерами вида '{name}'.
  // Использование: I18N.tFmt('fs.imageNofM', { n: 3, total: 10 })  → 'Image 3 of 10'.
  // Если ключ в словаре не содержит фигурных скобок (как в Phase 4a, где мы
  // собираем counters из 3 кусков), tFmt деградирует до обычного t().
  function tFmt(key, vars) {
    let s = t(key);
    if (vars && typeof s === 'string') {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  window.I18N = {
    getLang: getLang,
    t: t,
    tFmt: tFmt,
    applyLang: applyLang,
    isValidLang: isValidLang,
    SUPPORTED_LANGS: SUPPORTED_LANGS.slice(),
  };
})();
