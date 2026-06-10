/* ═══════════════════════════════════════════════════════════════════════
   state.js — черновики и валидация админ-панели (итерация D).

   Модель: на каждый редактируемый файл content/*.json держим
     { base: свежий JSON с GitHub, sha, draft: редактируемая копия }.
   Черновик автосохраняется (debounce) в sessionStorage и переживает
   перезагрузку вкладки; «грязность» = draft отличается от base.

   Валидация зеркалит правила validateContent() из
   scripts/generate-content.mjs для полей, которые редактирует MVP:
   непустые EN+RU тексты карточки/кейса/подписей/motion-блоков и непустые
   значения всех ключей meta.json / i18n-ui.json. Сообщения — русские,
   привязаны к полям через field-идентификаторы (см. ui.js data-field).

   API: window.AdminState. Подключается ПОСЛЕ api.js, ПЕРЕД ui.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DRAFTS_KEY = 'codexAdminDrafts';
  const files = new Map(); // path → { base, sha, draft }
  let orphanDrafts = {}; // черновики из sessionStorage для ещё не загруженных файлов
  const listeners = [];
  let persistTimer = 0;
  let catalogPromise = null;

  /* ── утилиты ─────────────────────────────────────────────────────── */

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Черновик — клон base с тем же порядком ключей, поэтому сравнение
  // сериализаций корректно детектирует возврат к исходному значению.
  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function isFilled(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  /* ── автосохранение в sessionStorage (debounce) ──────────────────── */

  function loadStoredDrafts() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(DRAFTS_KEY) || '{}');
      orphanDrafts = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
      orphanDrafts = {};
    }
  }

  function persistNow() {
    const store = {};
    for (const path of Object.keys(orphanDrafts)) store[path] = orphanDrafts[path];
    files.forEach((entry, path) => {
      if (!deepEqual(entry.draft, entry.base)) store[path] = entry.draft;
    });
    try {
      if (Object.keys(store).length === 0) sessionStorage.removeItem(DRAFTS_KEY);
      else sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
    } catch (_e) {
      /* квота/приватный режим — черновик живёт хотя бы в памяти */
    }
  }

  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 400);
  }

  /* ── каталог кейсов (same-origin, для списка) ────────────────────── */

  async function fetchLocalJson(relPath) {
    const res = await fetch(relPath, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Не удалось загрузить ' + relPath + ' (' + res.status + ')');
    return res.json();
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = (async () => {
        const settings = await fetchLocalJson('../content/settings.json');
        const cases = await Promise.all(
          settings.cardOrder.map(async (id) => ({ id, data: await fetchLocalJson('../content/cases/' + id + '.json') }))
        );
        return { settings, cases };
      })();
      catalogPromise.catch(() => {
        catalogPromise = null; // дать шанс повторной загрузке после ошибки
      });
    }
    return catalogPromise;
  }

  /* ── файлы и черновики ───────────────────────────────────────────── */

  // Перед редактированием берём СВЕЖИЙ файл + sha с GitHub (источник
  // истины), черновик из sessionStorage накладывается поверх.
  async function ensureFile(path) {
    if (files.has(path)) return files.get(path);
    const fresh = await window.AdminAPI.fetchFile(path);
    const base = JSON.parse(fresh.text);
    let draft = deepClone(base);
    if (orphanDrafts[path] !== undefined) {
      draft = orphanDrafts[path];
      delete orphanDrafts[path];
    }
    const entry = { base, sha: fresh.sha, draft };
    files.set(path, entry);
    schedulePersist();
    notify();
    return entry;
  }

  function getEntry(path) {
    return files.get(path) || null;
  }

  function getValue(path, dotPath) {
    const entry = files.get(path);
    if (!entry) return undefined;
    let node = entry.draft;
    for (const key of String(dotPath).split('.')) {
      if (node === null || node === undefined) return undefined;
      node = node[key];
    }
    return node;
  }

  function setValue(path, dotPath, value) {
    const entry = files.get(path);
    if (!entry) return;
    const keys = String(dotPath).split('.');
    let node = entry.draft;
    for (let i = 0; i < keys.length - 1; i += 1) node = node[keys[i]];
    node[keys[keys.length - 1]] = value;
    schedulePersist();
    notify();
  }

  function changedPaths() {
    const out = [];
    files.forEach((entry, path) => {
      if (!deepEqual(entry.draft, entry.base)) out.push(path);
    });
    for (const path of Object.keys(orphanDrafts)) {
      if (out.indexOf(path) === -1) out.push(path);
    }
    out.sort();
    return out;
  }

  function isDirty() {
    return changedPaths().length > 0;
  }

  function hasDraft(path) {
    const entry = files.get(path);
    if (entry) return !deepEqual(entry.draft, entry.base);
    return orphanDrafts[path] !== undefined;
  }

  // Догружаем base/sha для черновиков, восстановленных из sessionStorage,
  // но ещё не открытых в этой сессии (нужно перед валидацией и публикацией).
  async function ensureAllDrafts() {
    const pending = Object.keys(orphanDrafts);
    for (const path of pending) await ensureFile(path);
  }

  /* ── валидация (зеркало validateContent для редактируемых полей) ─── */

  function pushPairErrors(errors, path, dotBase, pair, label) {
    const en = pair && typeof pair === 'object' ? pair.en : undefined;
    const ru = pair && typeof pair === 'object' ? pair.ru : undefined;
    if (!isFilled(en)) errors.push({ path, field: dotBase + '.en', message: label + ': EN-текст не может быть пустым' });
    if (!isFilled(ru)) errors.push({ path, field: dotBase + '.ru', message: label + ': RU-текст не может быть пустым' });
  }

  function validateCaseDraft(errors, path, draft) {
    const card = draft.card || {};
    pushPairErrors(errors, path, 'card.title', card.title, 'Заголовок карточки');
    pushPairErrors(errors, path, 'card.desc', card.desc, 'Описание карточки');
    pushPairErrors(errors, path, 'card.alt', card.alt, 'Alt-текст изображения');

    const cs = draft.case || {};
    pushPairErrors(errors, path, 'case.role', cs.role, 'Роль в проекте');
    if (!Array.isArray(cs.tools) || cs.tools.length === 0 || !cs.tools.every(isFilled)) {
      errors.push({ path, field: 'case.tools', message: 'Инструменты: укажите хотя бы один (через запятую)' });
    }
    if (Array.isArray(cs.captions)) {
      cs.captions.forEach((caption, i) => {
        const where = 'Подпись ' + (i + 1);
        pushPairErrors(errors, path, 'case.captions.' + i + '.label', caption && caption.label, where + ' — заголовок');
        pushPairErrors(errors, path, 'case.captions.' + i + '.desc', caption && caption.desc, where + ' — описание');
      });
    }
    if (cs.text) {
      pushPairErrors(errors, path, 'case.text.title', cs.text.title, 'Текстовый блок — заголовок');
      pushPairErrors(errors, path, 'case.text.body', cs.text.body, 'Текстовый блок — текст');
    }
    if (cs.inline) {
      pushPairErrors(errors, path, 'case.inline.title', cs.inline.title, 'Инлайн-блок — заголовок');
      pushPairErrors(errors, path, 'case.inline.body', cs.inline.body, 'Инлайн-блок — текст');
    }
    if (Array.isArray(cs.motionBlocks)) {
      cs.motionBlocks.forEach((block, i) => {
        const where = 'Motion-блок ' + (i + 1);
        pushPairErrors(errors, path, 'case.motionBlocks.' + i + '.label', block && block.label, where + ' — подпись');
        pushPairErrors(errors, path, 'case.motionBlocks.' + i + '.desc', block && block.desc, where + ' — описание');
      });
    }
  }

  function validateLeafStrings(errors, path, node, dotBase, fileLabel) {
    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      for (const key of Object.keys(node)) {
        validateLeafStrings(errors, path, node[key], dotBase + '.' + key, fileLabel);
      }
      return;
    }
    if (!isFilled(node)) {
      const keyPath = dotBase.split('.').slice(1).join('.');
      const lang = dotBase.split('.')[0].toUpperCase();
      errors.push({
        path,
        field: dotBase,
        message: fileLabel + ': «' + keyPath + '» (' + lang + ') не может быть пустым'
      });
    }
  }

  function validateDraft(path, draft) {
    const errors = [];
    if (path.indexOf('content/cases/') === 0) {
      validateCaseDraft(errors, path, draft);
    } else if (path === 'content/meta.json') {
      for (const lang of ['en', 'ru']) validateLeafStrings(errors, path, draft[lang], lang, 'Мета-теги');
    } else if (path === 'content/i18n-ui.json') {
      for (const lang of ['en', 'ru']) validateLeafStrings(errors, path, draft[lang], lang, 'Тексты интерфейса');
    }
    return errors;
  }

  function validateAll() {
    const errors = [];
    for (const path of changedPaths()) {
      const entry = files.get(path);
      const draft = entry ? entry.draft : orphanDrafts[path];
      if (draft) errors.push.apply(errors, validateDraft(path, draft));
    }
    return errors;
  }

  /* ── публикация ──────────────────────────────────────────────────── */

  function serializeDraft(draft) {
    return JSON.stringify(draft, null, 2) + '\n';
  }

  // Перед коммитом подтверждаем актуальность base: если файл на GitHub
  // уже отличается от того, от которого редактировали, — останавливаемся.
  async function publishPrecheck() {
    for (const path of changedPaths()) {
      const entry = files.get(path);
      if (!entry) continue;
      const fresh = await window.AdminAPI.fetchFile(path);
      const freshBase = JSON.parse(fresh.text);
      if (!deepEqual(freshBase, entry.base)) {
        throw new Error('Файл ' + path + ' изменился на GitHub. Обновите страницу и повторите правки.');
      }
      entry.sha = fresh.sha;
    }
  }

  function buildCommitFiles() {
    return changedPaths().map((path) => {
      const entry = files.get(path);
      return { path, content: serializeDraft(entry.draft) };
    });
  }

  function describeChange(path) {
    if (path === 'content/meta.json') return 'Мета-теги';
    if (path === 'content/i18n-ui.json') return 'Тексты интерфейса';
    const entry = files.get(path);
    const match = path.match(/^content\/cases\/(.+)\.json$/);
    const id = match ? match[1] : path;
    const title = entry && entry.draft && entry.draft.card && entry.draft.card.title && entry.draft.card.title.en;
    return 'Кейс «' + (title || id) + '»';
  }

  function defaultCommitDescription() {
    const parts = changedPaths().map((path) => {
      if (path === 'content/meta.json') return 'мета-теги';
      if (path === 'content/i18n-ui.json') return 'тексты интерфейса';
      const match = path.match(/^content\/cases\/(.+)\.json$/);
      return match ? 'кейс ' + match[1] : path;
    });
    return 'обновление: ' + parts.join(', ');
  }

  // После успешного коммита черновики становятся новой базой.
  function markPublished() {
    files.forEach((entry) => {
      entry.base = deepClone(entry.draft);
    });
    orphanDrafts = {};
    clearTimeout(persistTimer);
    persistNow();
    notify();
  }

  function onChange(listener) {
    listeners.push(listener);
  }

  loadStoredDrafts();

  window.AdminState = {
    loadCatalog,
    ensureFile,
    ensureAllDrafts,
    getEntry,
    getValue,
    setValue,
    changedPaths,
    isDirty,
    hasDraft,
    validateAll,
    publishPrecheck,
    buildCommitFiles,
    describeChange,
    defaultCommitDescription,
    markPublished,
    onChange
  };
})();
