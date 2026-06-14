/* ═══════════════════════════════════════════════════════════════════════
   state.js — черновики и валидация админ-панели (итерации D–H).

   Модель: на каждый редактируемый файл content/*.json держим
     { base: свежий JSON с GitHub, sha, draft: редактируемая копия }.
   Черновик автосохраняется (debounce) в sessionStorage и переживает
   перезагрузку вкладки; «грязность» = draft отличается от base.

   Медиа (итерация E): загруженные файлы живут ТОЛЬКО в памяти
   (mediaEdits: путь файла → dot-путь поля → { bytes, objectURL, новый
   путь ассета }) и НЕ переживают перезагрузку — UI предупреждает.
   Каждый загруженный файл получает cache-bust-имя
   {base}-{hash8}.{ext} (hash8 = первые 8 hex-символов SHA-256
   содержимого), потому что netlify.toml раздаёт /assets/* с
   immutable-кэшем на год: перезапись по старому пути оставила бы
   постоянным посетителям старую картинку. Заменённые файлы НЕ удаляются:
   коммит админки деплоится на прод сразу, а страницы, ссылающиеся на
   старый файл, пересоберёт только bot-коммит конвейера минутами позже —
   удаление открыло бы окно 404. Файлы накапливаются (git history хранит
   их в любом случае); чистка осиротевших ассетов — отдельная
   maintenance-задача на будущее.

   Валидация зеркалит правила validateContent() из
   scripts/generate-content.mjs для полей, которые редактирует админка:
   непустые EN+RU тексты, источники motion-блоков (local → .webm-файл,
   vimeo → цифровой ID), пути медиа строго «./assets/...», OG-изображения.
   Сообщения — русские, привязаны к полям через field-идентификаторы
   (см. ui.js data-field).

   API: window.AdminState. Подключается ПОСЛЕ api.js, ПЕРЕД ui.js.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const DRAFTS_KEY = 'codexAdminDrafts';
  const FA_PATH = 'content/free-assets.json';
  const files = new Map(); // path → { base, sha, draft }
  let orphanDrafts = {}; // черновики из sessionStorage для ещё не загруженных файлов
  const mediaEdits = new Map(); // path → Map(dotPath → media-запись, см. stageMedia)
  const listeners = [];
  let persistTimer = 0;
  let catalogPromise = null;

  const KB = 1024;
  const MB = 1024 * KB;

  // Правила загрузки по типу слота: допустимые расширения/MIME, мягкий
  // порог (предупреждение) и жёсткий лимит (блокировка). Лимит видео
  // держит запас до предела base64-blob у GitHub Git Data API.
  const MEDIA_RULES = {
    image: {
      exts: ['svg', 'png', 'jpg', 'jpeg', 'webp'],
      mimes: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'],
      accept: '.svg,.png,.jpg,.jpeg,.webp',
      formatLabel: 'SVG, PNG, JPG или WebP',
      warnBytes: 200 * KB,
      warnText: 'тяжелее 200 КБ — карточки сайта будут грузиться медленнее',
      blockBytes: 2 * MB,
      blockText: 'изображения тяжелее 2 МБ не публикуем'
    },
    ogImage: {
      exts: ['jpg', 'jpeg', 'png', 'webp'],
      mimes: ['image/jpeg', 'image/png', 'image/webp'],
      accept: '.jpg,.jpeg,.png,.webp',
      formatLabel: 'JPG, PNG или WebP',
      warnBytes: 200 * KB,
      warnText: 'тяжелее 200 КБ — превью в соцсетях будет грузиться медленнее',
      blockBytes: 2 * MB,
      blockText: 'OG-изображения тяжелее 2 МБ не публикуем',
      // F5: целевые размеры превью для мягкой проверки соотношения сторон.
      ogWidth: 1200,
      ogHeight: 630,
      dimTolerance: 0.04
    },
    // F5: логотип организации (Organization.logo / JSON-LD) — КВАДРАТНЫЙ брендовый
    // ассет. Целевых OG-размеров у правила НЕТ намеренно, поэтому проверка
    // соотношения сторон ~1200×630 для логотипа не выполняется (см. stageMedia).
    orgLogo: {
      exts: ['jpg', 'jpeg', 'png', 'webp'],
      mimes: ['image/jpeg', 'image/png', 'image/webp'],
      accept: '.jpg,.jpeg,.png,.webp',
      formatLabel: 'JPG, PNG или WebP',
      warnBytes: 200 * KB,
      warnText: 'тяжелее 200 КБ — логотип будет грузиться медленнее',
      blockBytes: 2 * MB,
      blockText: 'логотип тяжелее 2 МБ не публикуем',
      // F5: логотип ожидается квадратным → мягкая проверка соотношения сторон.
      square: true,
      dimTolerance: 0.1
    },
    // Логотип в шапке сайта (видимый wordmark). Широкий брендовый ассет, НЕ квадратный,
    // поэтому без ogWidth/square → readImageDimensions не вызывается → SVG безопасен
    // (new Image() отдаёт 0×0 для многих SVG). Вектор ИЛИ растр; одна картинка на обе
    // темы. Набор расширений совпадает с генератором и verify-frozen (svg/png/webp).
    headerLogo: {
      exts: ['svg', 'png', 'webp'],
      mimes: ['image/svg+xml', 'image/png', 'image/webp'],
      accept: '.svg,.png,.webp',
      formatLabel: 'SVG, PNG или WebP',
      warnBytes: 200 * KB,
      warnText: 'тяжелее 200 КБ — логотип в шапке будет грузиться медленнее',
      blockBytes: 2 * MB,
      blockText: 'логотип тяжелее 2 МБ не публикуем'
    },
    video: {
      exts: ['webm'],
      mimes: ['video/webm'],
      accept: '.webm',
      formatLabel: 'WebM',
      warnBytes: 20 * MB,
      warnText: 'тяжелее 20 МБ — рекомендуем Vimeo для тяжёлых роликов',
      blockBytes: 40 * MB,
      blockText: 'ролики тяжелее 40 МБ не публикуем — загрузите на Vimeo'
    },
    model: {
      exts: ['glb'],
      mimes: ['model/gltf-binary', 'application/octet-stream'],
      accept: '.glb',
      formatLabel: 'GLB',
      warnBytes: 15 * MB,
      warnText: 'тяжелее 15 МБ — 3D-viewer будет грузиться медленнее',
      blockBytes: 50 * MB,
      blockText: 'модели тяжелее 50 МБ не публикуем'
    },
    // Итерация H: постер карточки Free Assets. Рантайм каталога жёстко
    // подставляет расширение .svg к базовому имени (resolveAssetMedia в
    // js/free-assets.js), поэтому слот принимает ТОЛЬКО SVG.
    faThumb: {
      exts: ['svg'],
      mimes: ['image/svg+xml'],
      accept: '.svg',
      formatLabel: 'SVG',
      warnBytes: 200 * KB,
      warnText: 'тяжелее 200 КБ — карточки каталога будут грузиться медленнее',
      blockBytes: 2 * MB,
      blockText: 'изображения тяжелее 2 МБ не публикуем'
    }
  };

  /* ── утилиты ─────────────────────────────────────────────────────── */

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Сравнение по канонической сериализации с СОРТИРОВКОЙ ключей:
  // deleteValue + setValue возвращают семантически то же значение, но ключ
  // встаёт в конец объекта — посимвольный JSON.stringify навсегда считал бы
  // такой черновик «грязным» (итерация H: тогл thumb/model выкл→вкл→выкл).
  // Порядок ключей нигде не несёт смысла: в коммит уходит serializeDraft
  // (собственный порядок draft), deepEqual используется только как предикат
  // равенства (persistNow, changedPaths, hasDraft, publishPrecheck).
  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      const items = value.map((item) => (item === undefined ? 'null' : stableStringify(item)));
      return '[' + items.join(',') + ']';
    }
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    const body = keys.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key]));
    return '{' + body.join(',') + '}';
  }

  function deepEqual(a, b) {
    return stableStringify(a) === stableStringify(b);
  }

  // Сериализация base кэшируется на самой entry: changedPaths/isDirty/hasDraft
  // прогоняют deepEqual(draft, base) по КАЖДОМУ загруженному файлу на каждый
  // keystroke и каждый persist. base иммутабелен между публикациями, поэтому
  // его строку считаем один раз (лениво) и инвалидируем там, где base
  // переприсваивается: ensureFile (загрузка) и markPublished (новая база).
  // Re-сериализуется только draft.
  function baseString(entry) {
    if (entry.baseString === undefined) entry.baseString = stableStringify(entry.base);
    return entry.baseString;
  }

  function draftEqualsBase(entry) {
    return stableStringify(entry.draft) === baseString(entry);
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
      if (!draftEqualsBase(entry)) store[path] = entry.draft;
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

  // Итерация F: значение черновика БЕЗ загрузки файла с GitHub — смотрит
  // загруженный draft, затем orphan-черновик из sessionStorage. undefined,
  // если черновика нет (список кейсов накладывает черновики поверх каталога).
  function peekDraftValue(path, dotPath) {
    let node;
    const entry = files.get(path);
    if (entry) node = entry.draft;
    else if (orphanDrafts[path] !== undefined) node = orphanDrafts[path];
    else return undefined;
    for (const key of String(dotPath).split('.')) {
      if (node === null || node === undefined) return undefined;
      node = node[key];
    }
    return node;
  }

  // Спуск по dot-пути до объекта-РОДИТЕЛЯ последнего ключа.
  // Возвращает { parent, key } или null, если по пути встретился
  // null/undefined (родитель не существует). setValue и deleteValue делят
  // безопасное поведение: на отсутствующем родителе обе тихо выходят
  // (раньше setValue падал на node[keys[i]] === undefined).
  function walkToParent(draft, dotPath) {
    const keys = String(dotPath).split('.');
    let node = draft;
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (node === null || node === undefined) return null;
      node = node[keys[i]];
    }
    if (node === null || node === undefined) return null;
    return { parent: node, key: keys[keys.length - 1] };
  }

  function setValue(path, dotPath, value) {
    const entry = files.get(path);
    if (!entry) return;
    const target = walkToParent(entry.draft, dotPath);
    if (!target) return;
    target.parent[target.key] = value;
    schedulePersist();
    notify();
  }

  // Итерация H: удаление ключа из черновика (возврат к конвенции «поле
  // отсутствует»: enabled → true, thumb/model → базовое имя = id). setValue
  // с undefined оставил бы ключ в draft-объекте и шумел при сравнениях.
  function deleteValue(path, dotPath) {
    const entry = files.get(path);
    if (!entry) return;
    const target = walkToParent(entry.draft, dotPath);
    if (!target) return;
    if (Array.isArray(target.parent)) return; // элементы массивов не удаляем — только ключи
    delete target.parent[target.key];
    schedulePersist();
    notify();
  }

  function hasMediaEdits(path) {
    const edits = mediaEdits.get(path);
    return Boolean(edits && edits.size > 0);
  }

  function changedPaths() {
    const out = [];
    files.forEach((entry, path) => {
      if (!draftEqualsBase(entry) || hasMediaEdits(path)) out.push(path);
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
    if (entry) return !draftEqualsBase(entry) || hasMediaEdits(path);
    return orphanDrafts[path] !== undefined;
  }

  // Догружаем base/sha для черновиков, восстановленных из sessionStorage,
  // но ещё не открытых в этой сессии (нужно перед валидацией и публикацией).
  async function ensureAllDrafts() {
    const pending = Object.keys(orphanDrafts);
    for (const path of pending) await ensureFile(path);
  }

  /* ── медиа (итерация E): загрузка файлов в память до публикации ──── */

  function getMediaRule(kind) {
    return MEDIA_RULES[kind];
  }

  // «02.png» → «02», «orbital-mk-ii-1a2b3c4d.svg» → «orbital-mk-ii»:
  // базовое имя без расширения и без предыдущего hash-суффикса, в slug-форме.
  function mediaBaseName(assetPath) {
    const file = String(assetPath).split('/').pop() || 'file';
    const base = file
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/-[0-9a-f]{8}$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'file';
  }

  function mediaDirName(assetPath) {
    const parts = String(assetPath).split('/');
    parts.pop();
    return parts.join('/');
  }

  async function hashBytes(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const view = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < 4; i += 1) hex += view[i].toString(16).padStart(2, '0');
    return hex;
  }

  function formatBytes(size) {
    if (size >= MB) return (size / MB).toFixed(1).replace('.', ',') + ' МБ';
    return Math.max(1, Math.round(size / KB)) + ' КБ';
  }

  // Проверка файла до чтения: расширение, MIME (если браузер его дал)
  // и жёсткий лимит размера. Бросает Error с русским сообщением.
  function assertUploadAllowed(rule, file) {
    const extMatch = /\.([a-z0-9]+)$/i.exec(file.name || '');
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    if (rule.exts.indexOf(ext) === -1) {
      throw new Error(
        'Файл «' + (file.name || '?') + '» не подходит: нужен формат ' + rule.formatLabel + '.'
      );
    }
    if (file.type && rule.mimes.indexOf(file.type) === -1) {
      throw new Error('Тип файла ' + file.type + ' не подходит: нужен формат ' + rule.formatLabel + '.');
    }
    if (file.size > rule.blockBytes) {
      throw new Error('Файл слишком большой (' + formatBytes(file.size) + '): ' + rule.blockText + '.');
    }
    return ext;
  }

  // Постановка файла в очередь публикации.
  //   filePath/dotPath — куда в content-JSON записать новое значение;
  //   kind             — ключ MEDIA_RULES;
  //   namingPath       — путь-«назначение» слота: его папка и базовое имя
  //                      дают каноничное имя нового файла;
  //   currentPath      — текущий файл на GitHub (кандидат на удаление)
  //                      или null, если у слота файла ещё не было;
  //   valueMode        — что писать в JSON: 'path' (по умолчанию — полный
  //                      './assets/...'-путь) или 'baseName' (итерация H,
  //                      free-assets: имя файла без папки и расширения —
  //                      конвенция thumb/model в content/free-assets.json).
  // Возвращает { assetPath, objectURL, size, warning|null, unchanged }.
  // F5: читает реальные пиксельные размеры картинки из её байтов (Image-декод),
  // тихо возвращает null при ошибке декода — предупреждение никогда не блокирует.
  function readImageDimensions(mime, bytes) {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(new Blob([bytes], { type: mime || '' }));
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          URL.revokeObjectURL(url);
          resolve({ width: w, height: h });
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } catch (_e) {
        resolve(null);
      }
    });
  }

  async function stageMedia(filePath, dotPath, kind, namingPath, currentPath, file, valueMode) {
    const rule = MEDIA_RULES[kind];
    const ext = assertUploadAllowed(rule, file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash8 = await hashBytes(bytes);

    let edits = mediaEdits.get(filePath);
    if (!edits) {
      edits = new Map();
      mediaEdits.set(filePath, edits);
    }
    const previous = edits.get(dotPath) || null;
    const originalPath = previous ? previous.originalPath : currentPath || null;
    const baseFrom = previous ? previous.namingPath : namingPath;
    const newBase = mediaBaseName(baseFrom) + '-' + hash8;
    const assetPath = mediaDirName(baseFrom) + '/' + newBase + '.' + ext;

    if (assetPath === originalPath) {
      // Загружен файл, байты которого уже опубликованы под этим именем.
      if (previous) {
        URL.revokeObjectURL(previous.objectURL);
        edits.delete(dotPath);
        notify();
      }
      return { assetPath, objectURL: null, size: file.size, warning: null, unchanged: true };
    }

    if (previous) URL.revokeObjectURL(previous.objectURL);
    const objectURL = URL.createObjectURL(new Blob([bytes], { type: file.type || '' }));
    edits.set(dotPath, {
      value: valueMode === 'baseName' ? newBase : assetPath,
      originalPath,
      namingPath: baseFrom,
      uploadPath: assetPath.replace(/^\.\//, ''),
      bytes,
      size: file.size,
      objectURL
    });
    let warning = file.size > rule.warnBytes ? 'Файл ' + formatBytes(file.size) + ' — ' + rule.warnText + '.' : null;
    // F5: для слотов с ЦЕЛЕВЫМ размером (OG-картинки) читаем реальные пиксели и
    // мягко предупреждаем, если соотношение далеко от целевого ~1200×630 (превью
    // в соцсетях обрежется). Не блокирует публикацию. У квадратного логотипа
    // (rule.orgLogo) целевых размеров нет → проверка соотношения не выполняется.
    if (rule.ogWidth && rule.ogHeight) {
      const dim = await readImageDimensions(file.type, bytes);
      if (dim) {
        const target = rule.ogWidth / rule.ogHeight;
        const aspect = dim.height ? dim.width / dim.height : 0;
        if (dim.width < 600 || !aspect || Math.abs(aspect / target - 1) > rule.dimTolerance) {
          const dimWarn = 'Изображение ' + dim.width + '×' + dim.height + ' — рекомендуем ~' +
            rule.ogWidth + '×' + rule.ogHeight + ' для корректного превью в соцсетях.';
          warning = warning ? warning + ' ' + dimWarn : dimWarn;
        }
      }
    } else if (rule.square) {
      // F5: логотип организации — квадратный; мягко предупреждаем при сильном
      // отклонении от 1:1 (не блокирует публикацию).
      const dim = await readImageDimensions(file.type, bytes);
      if (dim && dim.height) {
        const aspect = dim.width / dim.height;
        if (Math.abs(aspect - 1) > rule.dimTolerance) {
          const dimWarn = 'Изображение ' + dim.width + '×' + dim.height + ' — рекомендуем квадратный логотип.';
          warning = warning ? warning + ' ' + dimWarn : dimWarn;
        }
      }
    }
    notify();
    return { assetPath, objectURL, size: file.size, warning, unchanged: false };
  }

  function getMediaEdit(filePath, dotPath) {
    const edits = mediaEdits.get(filePath);
    return (edits && edits.get(dotPath)) || null;
  }

  // Итерация H: сброс pending-загрузки слота (например, при выключении
  // 3D-превью/постера free-asset — файл больше не должен уйти в коммит).
  function discardMediaEdit(filePath, dotPath) {
    const edits = mediaEdits.get(filePath);
    const record = edits && edits.get(dotPath);
    if (!record) return;
    URL.revokeObjectURL(record.objectURL);
    edits.delete(dotPath);
    notify();
  }

  // Итерация F: при перестановке элементов массива (слоты иллюстраций,
  // motion-блоки) pending-медиа должны переехать вместе со своим слотом —
  // иначе загруженный файл лёг бы в чужую позицию. renameFn(dotPath) →
  // новый dot-путь (или тот же).
  function remapMediaEdits(filePath, renameFn) {
    const edits = mediaEdits.get(filePath);
    if (!edits || edits.size === 0) return;
    const next = new Map();
    edits.forEach((record, dotPath) => {
      next.set(renameFn(dotPath), record);
    });
    mediaEdits.set(filePath, next);
    notify();
  }

  // Значение поля с учётом pending-медиа поверх черновика.
  function getEffectiveValue(filePath, dotPath) {
    const record = getMediaEdit(filePath, dotPath);
    return record ? record.value : getValue(filePath, dotPath);
  }

  function mediaPendingCount() {
    let count = 0;
    mediaEdits.forEach((edits) => {
      count += edits.size;
    });
    return count;
  }

  // Запись значения по dot-пути с созданием недостающих контейнеров.
  // Особый случай «srcs»: валидатор требует массив ровно из 5 элементов,
  // поэтому отсутствующий srcs создаётся как [null×5].
  function setDeep(target, dotPath, value) {
    const keys = String(dotPath).split('.');
    let node = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (node[key] === null || node[key] === undefined) {
        if (key === 'srcs') node[key] = [null, null, null, null, null];
        else node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      }
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
  }

  // Черновик с наложенными pending-медиа — то, что реально уйдёт в коммит.
  function effectiveDraft(path) {
    const entry = files.get(path);
    const draft = entry ? entry.draft : orphanDrafts[path];
    if (draft === undefined) return undefined;
    if (!hasMediaEdits(path)) return draft;
    const out = deepClone(draft);
    mediaEdits.get(path).forEach((record, dotPath) => {
      setDeep(out, dotPath, record.value);
    });
    return out;
  }

  // Итерация G: черновик для превью — как effectiveDraft, но значения
  // pending-медиа заменяются на blob object-URL: новые cache-bust-файлы
  // ещё не существуют на сервере, превью показывает их прямо из памяти.
  function previewDraft(path) {
    const entry = files.get(path);
    const draft = entry ? entry.draft : orphanDrafts[path];
    if (draft === undefined) return undefined;
    const out = deepClone(draft);
    const edits = mediaEdits.get(path);
    if (edits) {
      edits.forEach((record, dotPath) => {
        setDeep(out, dotPath, record.objectURL);
      });
    }
    return out;
  }

  /* ── Vimeo: ID или любой URL ролика → строка цифр ────────────────── */

  function parseVimeoId(input) {
    const raw = String(input || '').trim();
    if (/^\d+$/.test(raw)) return raw;
    const match = raw.match(/^(?:https?:\/\/)?(?:www\.)?(?:player\.)?vimeo\.com\/(?:[a-z][\w-]*\/)*?(\d+)(?:[/?#].*)?$/i);
    return match ? match[1] : '';
  }

  /* ── Vimeo privacy hash (unlisted: vimeo.com/<id>/<hash> или ?h=<hash>) ─
     Клиентский разбор URL, без Vimeo API. Bare-id → '' (нет хеша). */

  function parseVimeoHash(input) {
    const raw = String(input || '').trim();
    if (/^\d+$/.test(raw)) return '';
    const pathForm = raw.match(/vimeo\.com\/\d+\/([A-Za-z0-9]+)/i);
    if (pathForm) return pathForm[1];
    const queryForm = raw.match(/[?&]h=([A-Za-z0-9]+)/i);
    return queryForm ? queryForm[1] : '';
  }

  /* ── валидация (зеркало validateContent для редактируемых полей) ─── */

  function pushPairErrors(errors, path, dotBase, pair, label) {
    const en = pair && typeof pair === 'object' ? pair.en : undefined;
    const ru = pair && typeof pair === 'object' ? pair.ru : undefined;
    if (!isFilled(en)) errors.push({ path, field: dotBase + '.en', message: label + ': EN-текст не может быть пустым' });
    if (!isFilled(ru)) errors.push({ path, field: dotBase + '.ru', message: label + ': RU-текст не может быть пустым' });
  }

  // Зеркало MARKUP_OR_CONTROL_RE генератора (prod-review F2, C-03/C-MIRROR):
  // «<», «>» и управляющие символы не должны доходить до публикации — иначе
  // админ узнаёт об ошибке только из авто-revert конвейера. Литерал ниже
  // байт-в-байт повторяет канон в scripts/generate-content.mjs — при правке
  // канона скопируйте регэксп сюда целиком.
  // eslint-disable-next-line no-control-regex -- intentional: the guard exists to REJECT control characters
  const FORBIDDEN_TEXT_RE = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/;

  function pushMarkupError(errors, path, field, value, label) {
    if (typeof value === 'string' && FORBIDDEN_TEXT_RE.test(value)) {
      errors.push({
        path,
        field,
        message: label + ': символы «<», «>» и управляющие недопустимы — текст публикуется в HTML'
      });
    }
  }

  function pushPairMarkupErrors(errors, path, dotBase, pair, label) {
    if (pair && typeof pair === 'object') {
      pushMarkupError(errors, path, dotBase + '.en', pair.en, label + ' (EN)');
      pushMarkupError(errors, path, dotBase + '.ru', pair.ru, label + ' (RU)');
    }
  }

  // Обязательность + запрет разметки одним вызовом: раньше две проверки шли
  // парой у каждого текстового поля и легко рассинхронизировались —
  // кросс-ревью F2 нашло пропуск зеркала у motion-блоков.
  function pushPairTextErrors(errors, path, dotBase, pair, label) {
    pushPairErrors(errors, path, dotBase, pair, label);
    pushPairMarkupErrors(errors, path, dotBase, pair, label);
  }

  // Зеркало traversal-guard валидатора: путь медиа строго внутрь ./assets/.
  function isAssetPath(value) {
    return (
      isFilled(value) &&
      value.indexOf('./assets/') === 0 &&
      value.indexOf('\\') === -1 &&
      value.split('/').indexOf('..') === -1
    );
  }

  function validateCaseDraft(errors, path, draft) {
    const card = draft.card || {};
    // prod-review F2 (C-MIRROR): + зеркала серверных правил (разметка,
    // year, enum-ы, палитра, длины).
    pushPairTextErrors(errors, path, 'card.title', card.title, 'Заголовок карточки');
    pushPairTextErrors(errors, path, 'card.desc', card.desc, 'Описание карточки');
    pushPairTextErrors(errors, path, 'card.alt', card.alt, 'Alt-текст изображения');
    pushMarkupError(errors, path, 'card.thumbLabel', card.thumbLabel, 'Подпись миниатюры');
    pushMarkupError(errors, path, 'year', draft.year, 'Год');
    if (!isFilled(draft.year)) {
      errors.push({ path, field: 'year', message: 'Год: не может быть пустым' });
    }
    if ('imgLoading' in card && card.imgLoading !== 'eager' && card.imgLoading !== 'lazy') {
      errors.push({ path, field: 'card.imgLoading', message: 'Загрузка миниатюры: только «eager» или «lazy»' });
    }
    if (
      'imgFetchPriority' in card &&
      card.imgFetchPriority !== null &&
      ['high', 'low', 'auto'].indexOf(card.imgFetchPriority) === -1
    ) {
      errors.push({ path, field: 'card.imgFetchPriority', message: 'Приоритет миниатюры: high, low, auto или пусто' });
    }

    const cs = draft.case || {};
    pushPairTextErrors(errors, path, 'case.role', cs.role, 'Роль в проекте');
    if (!Array.isArray(cs.tools) || cs.tools.length === 0 || !cs.tools.every(isFilled)) {
      errors.push({ path, field: 'case.tools', message: 'Инструменты: укажите хотя бы один (через запятую)' });
    }
    if (Array.isArray(cs.tools)) {
      cs.tools.forEach((tool, i) => pushMarkupError(errors, path, 'case.tools.' + i, tool, 'Инструмент ' + (i + 1)));
    }
    // Зеркало «ровно 5» и palette-правил генератора.
    if (Array.isArray(cs.captions) && cs.captions.length !== 5) {
      errors.push({ path, field: 'case.captions', message: 'Подписи: должно быть ровно 5 — обновите страницу' });
    }
    if (!Array.isArray(cs.palette) || cs.palette.length !== 5 || !cs.palette.every(isFilled)) {
      errors.push({ path, field: 'case.palette', message: 'Палитра: должно быть 5 непустых значений — обновите страницу' });
    } else {
      cs.palette.forEach((color, i) => pushMarkupError(errors, path, 'case.palette.' + i, color, 'Палитра, слот ' + (i + 1)));
    }
    if (Array.isArray(cs.captions)) {
      cs.captions.forEach((caption, i) => {
        const where = 'Подпись ' + (i + 1);
        pushPairTextErrors(errors, path, 'case.captions.' + i + '.label', caption && caption.label, where + ' — заголовок');
        pushPairTextErrors(errors, path, 'case.captions.' + i + '.desc', caption && caption.desc, where + ' — описание');
      });
    }
    if (cs.text) {
      pushPairTextErrors(errors, path, 'case.text.title', cs.text.title, 'Текстовый блок — заголовок');
      pushPairTextErrors(errors, path, 'case.text.body', cs.text.body, 'Текстовый блок — текст');
    }
    if (cs.inline) {
      pushPairTextErrors(errors, path, 'case.inline.title', cs.inline.title, 'Инлайн-блок — заголовок');
      pushPairTextErrors(errors, path, 'case.inline.body', cs.inline.body, 'Инлайн-блок — текст');
    }
    if (Array.isArray(cs.motionBlocks)) {
      cs.motionBlocks.forEach((block, i) => {
        const where = 'Motion-блок ' + (i + 1);
        const dotBase = 'case.motionBlocks.' + i;
        pushPairTextErrors(errors, path, dotBase + '.label', block && block.label, where + ' — подпись');
        pushPairTextErrors(errors, path, dotBase + '.desc', block && block.desc, where + ' — описание');
        pushMarkupError(errors, path, dotBase + '.title', block && block.title, where + ' — title');
        if (!block || typeof block !== 'object') return;
        // Итерация E: зеркало validateMotionBlock из generate-content.mjs.
        if (block.source === 'vimeo') {
          if (typeof block.vimeoId !== 'string' || !/^\d+$/.test(block.vimeoId)) {
            errors.push({
              path,
              field: dotBase + '.vimeoId',
              message: where + ': Vimeo ID должен состоять только из цифр — вставьте ссылку на ролик или его ID'
            });
          }
          // F5: приватный hash unlisted-ролика (vimeo.com/<id>/<hash>) — зеркало
          // generate-content.mjs validateMotionBlock (/^[A-Za-z0-9]+$/).
          if ('vimeoHash' in block && (typeof block.vimeoHash !== 'string' || !/^[A-Za-z0-9]+$/.test(block.vimeoHash))) {
            errors.push({
              path,
              field: dotBase + '.vimeoHash',
              message: where + ': приватный hash Vimeo — только латинские буквы и цифры (vimeo.com/<id>/<hash>)'
            });
          }
        } else if (block.source === 'local') {
          if (!isAssetPath(block.src) || !/\.webm$/i.test(block.src)) {
            errors.push({
              path,
              field: dotBase + '.src',
              message: where + ': нужен локальный .webm-файл — загрузите ролик'
            });
          }
        } else {
          errors.push({
            path,
            field: dotBase + '.source',
            message: where + ': источник должен быть «local» (файл .webm) или «vimeo»'
          });
        }
        if ('poster' in block && !isAssetPath(block.poster)) {
          errors.push({ path, field: dotBase + '.poster', message: where + ': постер должен лежать внутри ./assets/' });
        }
        // F5: layout/playback теперь редактируются → строгие enum (зеркало генератора).
        if ('layout' in block && block.layout !== 'wide' && block.layout !== 'half') {
          errors.push({ path, field: dotBase + '.layout', message: where + ': раскладка должна быть «wide» (широкий ряд) или «half» (половина)' });
        }
        if ('playback' in block && block.playback !== 'ambient' && block.playback !== 'controlled') {
          errors.push({ path, field: dotBase + '.playback', message: where + ': режим воспроизведения должен быть «ambient» (фон) или «controlled» (с управлением)' });
        }
      });
    }

    // Итерация E: медиа-пути кейса (миниатюра, слоты, 3D-модель).
    if (!isAssetPath(card.thumb)) {
      errors.push({ path, field: 'card.thumb', message: 'Миниатюра карточки: путь должен лежать внутри ./assets/' });
    }
    if (!isAssetPath(cs.modelSrc) || !/\.glb$/i.test(cs.modelSrc)) {
      errors.push({ path, field: 'case.modelSrc', message: '3D-модель: нужен .glb-файл внутри ./assets/' });
    }
    if (Array.isArray(cs.srcs)) {
      cs.srcs.forEach((src, i) => {
        if (src !== null && src !== undefined && !isAssetPath(src)) {
          errors.push({
            path,
            field: 'case.srcs.' + i,
            message: 'Слот ' + (i + 1) + ': путь изображения должен лежать внутри ./assets/'
          });
        }
      });
    }
    if (cs.modelStats !== null && typeof cs.modelStats === 'object' && !Array.isArray(cs.modelStats)) {
      for (const key of Object.keys(cs.modelStats)) {
        const value = cs.modelStats[key];
        if (!isFilled(typeof value === 'number' ? String(value) : value)) {
          errors.push({
            path,
            field: 'case.modelStats.' + key,
            message: 'Статистика модели: «' + key + '» не может быть пустым'
          });
        }
        pushMarkupError(errors, path, 'case.modelStats.' + key, value, 'Статистика модели — ' + key);
      }
    }
    // i18nOverrides-листья уходят в те же innerHTML-пути (зеркало walker'а
    // генератора).
    (function walkOverrides(node, trail) {
      if (typeof node === 'string') {
        pushMarkupError(errors, path, trail, node, 'i18nOverrides');
        return;
      }
      if (node !== null && typeof node === 'object') {
        for (const key of Object.keys(node)) walkOverrides(node[key], trail + '.' + key);
      }
    })(draft.i18nOverrides, 'i18nOverrides');
  }

  // Итерация H: зеркало validateFreeAssets из generate-content.mjs для
  // полей, которые редактирует экран Free Assets.
  const FA_FIELD_LABELS = {
    title: 'название',
    cat: 'подпись категории',
    badge: 'бейдж',
    size: 'размер',
    file: 'имя ZIP-файла',
    bg: 'фон (CSS-градиент)'
  };

  function isPlainBaseName(value) {
    return (
      isFilled(value) && value.indexOf('/') === -1 && value.indexOf('\\') === -1 && value.indexOf('..') === -1
    );
  }

  // Единый предикат «ассет виден на сайте»: категория и сам ассет не
  // выключены (enabled !== false — конвенция «поле отсутствует = включено»).
  function faAssetVisible(category, item) {
    return (
      category && typeof category === 'object' && category.enabled !== false &&
      item && typeof item === 'object' && item.enabled !== false
    );
  }

  // Сколько ассетов останется видимыми на сайте. opts.skipCategoryIndex —
  // индекс категории, которую считаем выключенной (предпросмотр выключения
  // категории в ui.js). Единственный источник правды для guard'ов ui.js и
  // финальной проверки validateFreeAssetsDraft (генератор/verify-frozen
  // считают независимо — другой рантайм, намеренно).
  function countVisibleFaAssets(categories, opts) {
    const skip = opts && typeof opts.skipCategoryIndex === 'number' ? opts.skipCategoryIndex : -1;
    let count = 0;
    (Array.isArray(categories) ? categories : []).forEach(function (category, ci) {
      if (ci === skip) return;
      const items = category && Array.isArray(category.items) ? category.items : [];
      items.forEach(function (item) {
        if (faAssetVisible(category, item)) count += 1;
      });
    });
    return count;
  }

  function validateFreeAssetsDraft(errors, path, draft) {
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    // prod-review F2 (C-MIRROR #38/#39/#40): ключ категории, tagCard и
    // глобальная уникальность id ассетов — зеркала серверных правил.
    const seenAssetIds = new Set();
    categories.forEach(function (category, ci) {
      if (category === null || typeof category !== 'object') return;
      if (!isFilled(category.key)) {
        errors.push({ path, field: 'categories.' + ci + '.key', message: 'Категория ' + (ci + 1) + ': ключ повреждён — обновите страницу' });
      }
      const tagCard = category.tagCard;
      if (tagCard !== undefined && tagCard !== null) {
        if (typeof tagCard !== 'object' || Array.isArray(tagCard)) {
          errors.push({ path, field: 'categories.' + ci + '.tagCard', message: 'Категория «' + category.key + '»: tagCard повреждён' });
        } else {
          if ('thumb' in tagCard && tagCard.thumb !== null && !isPlainBaseName(tagCard.thumb)) {
            errors.push({
              path,
              field: 'categories.' + ci + '.tagCard.thumb',
              message: 'Категория «' + category.key + '»: thumb tag-карточки — базовое имя файла без папок'
            });
          }
          if ('gameAsset' in tagCard && typeof tagCard.gameAsset !== 'boolean') {
            errors.push({
              path,
              field: 'categories.' + ci + '.tagCard.gameAsset',
              message: 'Категория «' + category.key + '»: признак game-категории повреждён'
            });
          }
        }
      }
      if ('enabled' in category && typeof category.enabled !== 'boolean') {
        errors.push({
          path,
          field: 'categories.' + ci + '.enabled',
          message: 'Видимость категории «' + category.key + '» повреждена — переключите тогл заново'
        });
      }
      const items = Array.isArray(category.items) ? category.items : [];
      items.forEach(function (item, ii) {
        if (item === null || typeof item !== 'object') return;
        const dotBase = 'categories.' + ci + '.items.' + ii;
        const label = 'Ассет «' + (isFilled(item.title) ? item.title : item.id || ii + 1) + '»';
        if ('enabled' in item && typeof item.enabled !== 'boolean') {
          errors.push({
            path,
            field: dotBase + '.enabled',
            message: label + ': видимость повреждена — переключите тогл заново'
          });
        }
        if (isFilled(item.id)) {
          if (seenAssetIds.has(item.id)) {
            errors.push({ path, field: dotBase + '.id', message: label + ': id «' + item.id + '» уже используется другим ассетом' });
          }
          seenAssetIds.add(item.id);
        }
        for (const field of Object.keys(FA_FIELD_LABELS)) {
          if (!isFilled(item[field])) {
            errors.push({
              path,
              field: dotBase + '.' + field,
              message: label + ': поле «' + FA_FIELD_LABELS[field] + '» не может быть пустым'
            });
          } else if (field !== 'file') {
            // Зеркало серверного "<>"-гарда FA-полей (итерация H + F2).
            pushMarkupError(errors, path, dotBase + '.' + field, item[field], label + ' — ' + FA_FIELD_LABELS[field]);
          }
        }
        if (isFilled(item.file) && !/^[A-Za-z0-9._-]+\.zip$/i.test(item.file)) {
          errors.push({
            path,
            field: dotBase + '.file',
            message: label + ': имя ZIP — только имя файла в downloads/, без папок (например ' + (item.id || 'asset') + '.zip)'
          });
        }
        pushPairErrors(errors, path, dotBase + '.desc', item.desc, label + ' — описание');
        if (
          !Array.isArray(item.contents) ||
          item.contents.length === 0 ||
          !item.contents.every(isFilled)
        ) {
          errors.push({
            path,
            field: dotBase + '.contents',
            message: label + ': список «архив содержит» должен иметь хотя бы одну непустую строку'
          });
        }
        // thumb/model: отсутствие = базовое имя id, null = выключено,
        // строка = базовое имя файла без папок и расширения.
        for (const key of ['thumb', 'model']) {
          if (key in item && item[key] !== null && !isPlainBaseName(item[key])) {
            errors.push({
              path,
              field: dotBase + '.' + key,
              message: label + ': «' + key + '» — базовое имя файла без папок и расширения'
            });
          }
        }
      });
    });
    if (countVisibleFaAssets(categories) === 0) {
      errors.push({
        path,
        field: 'categories',
        message: 'Нельзя скрыть все ассеты — каталог Free Assets на сайте останется пустым'
      });
    }
  }

  // Итерация H (Fix #5): шаблоны путей файлов медиа-слотов free-assets.
  // Рантайм каталога (resolveAssetMedia в js/free-assets.js) подставляет
  // расширение к базовому имени, поэтому путь детерминирован по ключу слота.
  // Источник истины и для ui.js (resolveValue dropZone), и для проверки
  // существования файла перед публикацией.
  const FA_MEDIA_SLOTS = {
    thumb: { dir: './assets/cards/', ext: '.svg' },
    model: { dir: './assets/models/free/', ext: '.glb' }
  };

  function faSlotPath(key, baseName) {
    const slot = FA_MEDIA_SLOTS[key];
    if (!slot) return null;
    return slot.dir + baseName + slot.ext;
  }

  // Перечень ВКЛЮЧЁННЫХ медиа-слотов free-assets, у которых эффективное
  // значение указывает на конкретный файл (конвенция: ключ отсутствует →
  // файл по умолчанию <id>; строка → базовое имя; null → выключено).
  // Возвращает [{ id, key, dot, baseName, sitePath, staged }].
  // staged=true, если слот покрыт pending-загрузкой (файл уже в памяти и
  // уйдёт в коммит — проверять его наличие в репозитории не нужно).
  function faEnabledMediaSlots() {
    const out = [];
    const entry = files.get(FA_PATH);
    const draft = entry ? entry.draft : orphanDrafts[FA_PATH];
    const categories = draft && Array.isArray(draft.categories) ? draft.categories : [];
    categories.forEach(function (category, ci) {
      const items = category && Array.isArray(category.items) ? category.items : [];
      items.forEach(function (item, ii) {
        if (!item || typeof item !== 'object') return;
        for (const key of Object.keys(FA_MEDIA_SLOTS)) {
          const dot = 'categories.' + ci + '.items.' + ii + '.' + key;
          const staged = Boolean(getMediaEdit(FA_PATH, dot));
          // Значение слота: pending-загрузка важнее (её базовое имя уйдёт в
          // коммит); иначе draft-значение; отсутствие ключа = базовое имя id.
          let value;
          if (staged) value = getMediaEdit(FA_PATH, dot).value;
          else if (key in item) value = item[key];
          else value = item.id;
          if (value === null) continue; // слот выключен
          const baseName = String(value);
          out.push({
            id: item.id,
            key,
            dot,
            baseName,
            sitePath: faSlotPath(key, baseName),
            staged
          });
        }
      });
    });
    return out;
  }

  // Итерация H (Fix #5): асинхронная проверка наличия файлов всех включённых
  // медиа-слотов free-assets ПЕРЕД публикацией. Раньше блок «файла нет в
  // репозитории» жил только in-memory в ui.js (faMediaErrors) и не переживал
  // перезагрузку: после reload черновик восстанавливался из sessionStorage,
  // а блок терялся → публикация уходила на сервер → checkAssetFile в CI
  // падал → авто-revert. Теперь проверка пере-выводится из состояния на
  // каждой публикации, поэтому reload её не теряет.
  //   checkExists(sitePath) → Promise<boolean> (ui.js даёт HEAD-запрос;
  //   маппинг site→admin-путь и сеть живут в ui.js, State не знает про fetch).
  // Возвращает массив { id, key, dot, sitePath } для слотов с отсутствующим
  // файлом и без staged-загрузки.
  async function findMissingFaMediaFiles(checkExists) {
    if (!changedPaths().includes(FA_PATH)) return [];
    const slots = faEnabledMediaSlots().filter(function (slot) {
      return !slot.staged && slot.sitePath;
    });
    const results = await Promise.all(
      slots.map(async function (slot) {
        let exists;
        try {
          exists = await checkExists(slot.sitePath);
        } catch (_e) {
          exists = false;
        }
        return { slot, exists };
      })
    );
    return results
      .filter(function (r) {
        return !r.exists;
      })
      .map(function (r) {
        return { id: r.slot.id, key: r.slot.key, dot: r.slot.dot, sitePath: r.slot.sitePath };
      });
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
      // Итерация F: зеркало strict-boolean-проверки enabled из
      // generate-content.mjs (как у filters.enabled).
      if ('enabled' in draft && typeof draft.enabled !== 'boolean') {
        errors.push({
          path,
          field: 'enabled',
          message: 'Видимость кейса: значение «enabled» повреждено — переключите тогл видимости заново'
        });
      }
      // Итерация F: зеркало enum-проверки layoutMode из generate-content.mjs.
      if ('layoutMode' in draft && draft.layoutMode !== 'seeded' && draft.layoutMode !== 'manual') {
        errors.push({
          path,
          field: 'layoutMode',
          message: 'Порядок блоков: режим должен быть «seeded» (автоматический) или «manual» (ручной)'
        });
      }
    } else if (path === 'content/settings.json') {
      // Итерация F: зеркало правил settings из generate-content.mjs.
      if (!Array.isArray(draft.cardOrder) || draft.cardOrder.length === 0 || !draft.cardOrder.every(isFilled)) {
        errors.push({ path, field: 'cardOrder', message: 'Порядок карточек повреждён — обновите страницу' });
      }
      // prod-review F2 (C-MIRROR #22): дубль id в cardOrder ловится до
      // публикации, а не авто-revert'ом конвейера.
      if (Array.isArray(draft.cardOrder)) {
        const seen = new Set();
        draft.cardOrder.forEach((id, i) => {
          if (seen.has(id)) {
            errors.push({ path, field: 'cardOrder.' + i, message: 'Порядок карточек: кейс «' + id + '» встречается дважды' });
          }
          seen.add(id);
        });
      }
      const filters = Array.isArray(draft.filters) ? draft.filters : [];
      filters.forEach((filter, i) => {
        if (filter && filter.key === 'all' && filter.enabled === false) {
          errors.push({
            path,
            field: 'filters.' + i + '.enabled',
            message: 'Фильтр «All» нельзя выключить — это сброс фильтрации в гриде'
          });
        }
      });
    } else if (path === 'content/meta.json') {
      for (const lang of ['en', 'ru']) validateLeafStrings(errors, path, draft[lang], lang, 'Мета-теги');
      // Итерация E: зеркало validateMetaImages из generate-content.mjs.
      const images = draft.ogImages || {};
      // prod-review F2 (C-MIRROR #26): конвенция имени og-картинки, как в
      // валидаторе и verify-frozen (страница держит СВОЁ базовое имя +
      // опциональный -hash8 cache-bust).
      const ogBasename = {
        index: new RegExp('^[.][/]assets[/]img[/]og-image(-[0-9a-f]{8})?[.](jpg|jpeg|png|webp)$'),
        fa: new RegExp('^[.][/]assets[/]img[/]og-free-assets(-[0-9a-f]{8})?[.](jpg|jpeg|png|webp)$')
      };
      for (const page of ['index', 'fa']) {
        if (!isAssetPath(images[page]) || !/\.(jpg|jpeg|png|webp)$/i.test(images[page])) {
          errors.push({
            path,
            field: 'ogImages.' + page,
            message: 'OG-изображение: нужен JPG, PNG или WebP внутри ./assets/'
          });
        } else if (!ogBasename[page].test(images[page])) {
          errors.push({
            path,
            field: 'ogImages.' + page,
            message:
              'OG-изображение: имя должно быть ' +
              (page === 'fa' ? 'og-free-assets' : 'og-image') +
              '(-hash8).jpg/png/webp в ./assets/img/ — загрузите файл через drop-зону'
          });
        }
      }
      // F5: логотип организации (Organization.logo) ОБЯЗАТЕЛЕН — JSON-LD генератора
      // разыменовывает ogImages.orgLogo безусловно. Путь внутри ./assets/ и
      // растровый формат, без конвенции имени (зеркало validateMetaImages).
      if (!isAssetPath(images.orgLogo) || !/\.(jpg|jpeg|png|webp)$/i.test(images.orgLogo)) {
        errors.push({
          path,
          field: 'ogImages.orgLogo',
          message: 'Логотип организации: нужен JPG, PNG или WebP внутри ./assets/'
        });
      }
      // Логотип в шапке (headerLogo) — НЕОБЯЗАТЕЛЕН и независим от orgLogo: отсутствие или
      // { src: null/'' } оставляет текстовый логотип «CODEX». Полное зеркало
      // validateHeaderLogo генератора: сначала тип контейнера (объект), затем путь и
      // расширение (svg/png/webp — синхронно с генератором и verify-frozen). Любое
      // расхождение → админка опубликует коммит, который конвейер content-publish откатит.
      if (
        draft.headerLogo !== undefined &&
        draft.headerLogo !== null &&
        (typeof draft.headerLogo !== 'object' || Array.isArray(draft.headerLogo))
      ) {
        errors.push({
          path,
          field: 'headerLogo',
          message: 'Логотип в шапке: headerLogo должен быть объектом { "src": … }'
        });
      } else {
        const headerLogoSrc = draft.headerLogo && draft.headerLogo.src;
        if (
          headerLogoSrc !== undefined &&
          headerLogoSrc !== null &&
          headerLogoSrc !== '' &&
          (!isAssetPath(headerLogoSrc) || !/\.(svg|png|webp)$/i.test(headerLogoSrc))
        ) {
          errors.push({
            path,
            field: 'headerLogo.src',
            message: 'Логотип в шапке: нужен SVG, PNG или WebP внутри ./assets/'
          });
        }
      }
      // prod-review F2 (C-MIRROR D-04): зеркало enum-проверки ogLocale.
      for (const lang of ['en', 'ru']) {
        for (const page of ['index', 'fa']) {
          const block = draft[lang] && draft[lang][page];
          const value = block && block.ogLocale;
          if (value !== undefined && value !== 'en_US' && value !== 'ru_RU') {
            errors.push({
              path,
              field: lang + '.' + page + '.ogLocale',
              message: 'og:locale: только «en_US» или «ru_RU»'
            });
          }
        }
      }
      // prod-review F2 (C-MIRROR #27): структура featuredWorks — JSON-LD
      // главной собирается из этого списка.
      const sd = draft.structuredData;
      if (sd !== undefined) {
        if (sd === null || typeof sd !== 'object' || Array.isArray(sd) || !Array.isArray(sd.featuredWorks)) {
          errors.push({ path, field: 'structuredData', message: 'structuredData.featuredWorks повреждён — обновите страницу' });
        } else {
          const seenFeatured = new Set();
          sd.featuredWorks.forEach((entry, i) => {
            const base = 'structuredData.featuredWorks.' + i;
            if (entry === null || typeof entry !== 'object' || !isFilled(entry.id) || !isFilled(entry.about)) {
              errors.push({ path, field: base, message: 'Featured-работа ' + (i + 1) + ': нужны id кейса и текст about' });
              return;
            }
            if (seenFeatured.has(entry.id)) {
              errors.push({ path, field: base + '.id', message: 'Featured-работы: «' + entry.id + '» встречается дважды' });
            }
            seenFeatured.add(entry.id);
            pushMarkupError(errors, path, base + '.about', entry.about, 'Featured-работа — about');
          });
        }
      }
    } else if (path === 'content/i18n-ui.json') {
      for (const lang of ['en', 'ru']) validateLeafStrings(errors, path, draft[lang], lang, 'Тексты интерфейса');
    } else if (path === FA_PATH) {
      validateFreeAssetsDraft(errors, path, draft);
    }
    return errors;
  }

  // Валидируется эффективный черновик (с pending-медиа) — то, что реально
  // уйдёт в коммит.
  function validateAll() {
    const errors = [];
    for (const path of changedPaths()) {
      const draft = effectiveDraft(path);
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

  // Полный план коммита: текстовые JSON (эффективные черновики) плюс
  // бинарные загрузки. Заменённые файлы НЕ удаляются: admin-коммит
  // деплоится на прод сразу, а ссылающиеся страницы пересоберёт только
  // bot-коммит конвейера минутами позже — удаление открыло бы окно 404
  // (чистка осиротевших ассетов — будущая maintenance-задача).
  // Бинарные файлы дедуплицируются по пути: два слота с одинаковыми байтами
  // и назначением дают одно cache-bust-имя, а git-tree не терпит дублей path.
  function buildPublishPlan() {
    const planFiles = changedPaths().map((path) => ({ path, content: serializeDraft(effectiveDraft(path)) }));

    const binariesByPath = new Map();
    mediaEdits.forEach((edits) => {
      edits.forEach((record) => {
        binariesByPath.set(record.uploadPath, { path: record.uploadPath, bytes: record.bytes });
      });
    });

    // prod-review F2 (C-08): assert-префиксы путей коммита — defense in
    // depth поверх валидации. Админка пишет ТОЛЬКО content/*.json и
    // бинарные медиа в assets/; любой другой путь — баг или атака.
    for (const file of planFiles) {
      if (file.path.indexOf('content/') !== 0) {
        throw new Error('Публикация остановлена: неожиданный путь файла «' + file.path + '» (ожидается content/…)');
      }
    }
    for (const binary of binariesByPath.values()) {
      if (binary.path.indexOf('assets/') !== 0) {
        throw new Error('Публикация остановлена: неожиданный путь медиа «' + binary.path + '» (ожидается assets/…)');
      }
    }

    return { files: planFiles, binaries: Array.from(binariesByPath.values()) };
  }

  function describeChange(path) {
    if (path === 'content/meta.json') return 'Мета-теги';
    if (path === 'content/i18n-ui.json') return 'Тексты интерфейса';
    if (path === 'content/settings.json') return 'Порядок карточек и категории';
    if (path === FA_PATH) return 'Каталог Free Assets';
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
      if (path === 'content/settings.json') return 'порядок и категории';
      if (path === FA_PATH) return 'каталог free assets';
      const match = path.match(/^content\/cases\/(.+)\.json$/);
      return match ? 'кейс ' + match[1] : path;
    });
    return 'обновление: ' + parts.join(', ');
  }

  // После успешного коммита черновики (с наложенными медиа) становятся
  // новой базой, pending-медиа считаются доставленными.
  function markPublished() {
    files.forEach((entry, path) => {
      entry.draft = effectiveDraft(path);
      entry.base = deepClone(entry.draft);
      entry.baseString = undefined; // base переприсвоен — кэш сериализации сбросить
    });
    mediaEdits.forEach((edits) => {
      edits.forEach((record) => {
        URL.revokeObjectURL(record.objectURL);
      });
    });
    mediaEdits.clear();
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
    peekDraftValue,
    setValue,
    deleteValue,
    remapMediaEdits,
    changedPaths,
    isDirty,
    hasDraft,
    validateAll,
    // итерация H: видимость и медиа-слоты free-assets
    countVisibleFaAssets,
    faSlotPath,
    findMissingFaMediaFiles,
    publishPrecheck,
    buildPublishPlan,
    describeChange,
    defaultCommitDescription,
    markPublished,
    onChange,
    // итерация E: медиа
    getMediaRule,
    stageMedia,
    getMediaEdit,
    discardMediaEdit,
    getEffectiveValue,
    mediaPendingCount,
    parseVimeoId,
    parseVimeoHash,
    // итерация G: превью
    previewDraft
  };
})();
