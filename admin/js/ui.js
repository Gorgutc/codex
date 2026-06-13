/* ═══════════════════════════════════════════════════════════════════════
   ui.js — представления и маршрутизация админ-панели (итерации D–H).

   Экраны (hash-роутер, «одна задача — один экран»):
     #/login (без токена)  — вход: GitHub OAuth или PAT;
     #/cases               — список кейсов: поиск, drag-перестановка
                             карточек (cardOrder) и выключатели кейсов;
     #/case/<id>           — редактор кейса: тексты RU/EN + медиа
                             (миниатюра, слоты, motion-блоки, GLB-модель) +
                             порядок блоков (layoutMode seeded/manual);
     #/categories          — категории: вкл/выкл фильтров сайта;
     #/free-assets         — каталог Free Assets: группы категорий, вкл/выкл
                             и порядок категорий и ассетов (итерация H);
     #/free-assets/<id>    — редактор ассета: тексты, архив, фон, замена
                             GLB-превью и SVG-постера (конвенция thumb/model:
                             поле отсутствует → id, null → выключено);
     #/meta                — мета-теги + OG-изображения (content/meta.json);
     #/ui                  — тексты интерфейса (content/i18n-ui.json).

   Медиа (итерация E): drop-зона поверх текущего изображения (принцип 6
   research.md), превью pending-файлов через object-URL, предупреждение
   «не переживут перезагрузку» в шапке.

   Перестановка (итерация F, принцип 4 research.md): drag-handle ⠿ через
   self-hosted SortableJS (admin/js/vendor/sortable.min.js, v1.15.7, MIT)
   плюс клавиатурные кнопки «вверх/вниз» как a11y-фоллбек — работают и без
   SortableJS. Видимость (принцип 5): выключенный кейс сразу затемняется
   и получает бейдж «скрыто»; кейсы выключенной категории — бейдж
   «категория скрыта».

   Зависимости: window.AdminAPI (api.js), window.AdminState (state.js),
   window.Sortable (vendor, опционален).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = window.AdminAPI;
  const State = window.AdminState;

  const SETTINGS_PATH = 'content/settings.json';
  const FA_PATH = 'content/free-assets.json';
  // Формат слота фиксирован позицией в раскладке сайта (MEDIA_FORMATS
  // генератора): 1 и 4 — широкие, 2/3/5 — высокие.
  const SLOT_FORMATS = ['широкий', 'высокий', 'высокий', 'широкий', 'высокий'];

  const els = {
    topbar: document.getElementById('topbar'),
    app: document.getElementById('app'),
    mediaWarning: document.getElementById('media-warning'),
    draftIndicator: document.getElementById('draft-indicator'),
    publishBtn: document.getElementById('publish-btn'),
    topbarUser: document.getElementById('topbar-user'),
    toasts: document.getElementById('toasts'),
    dialog: document.getElementById('publish-dialog'),
    publishFiles: document.getElementById('publish-files'),
    publishDesc: document.getElementById('publish-desc'),
    publishCancel: document.getElementById('publish-cancel'),
    publishConfirm: document.getElementById('publish-confirm')
  };

  let publishing = false;
  let pendingErrors = [];
  let publishPlan = null; // план коммита, собранный перед открытием диалога

  const META_PAGE_LABELS = {
    index: 'Главная страница (index.html)',
    fa: 'Free Assets (free-assets.html)'
  };

  const META_FIELD_LABELS = {
    title: 'Заголовок вкладки (title)',
    description: 'Описание для поисковиков (description)',
    ogTitle: 'Open Graph — заголовок',
    ogDescription: 'Open Graph — описание',
    ogSiteName: 'Open Graph — имя сайта',
    ogImageAlt: 'Open Graph — alt изображения',
    ogLocale: 'Open Graph — локаль',
    twitterTitle: 'Twitter — заголовок',
    twitterDescription: 'Twitter — описание'
  };

  const UI_GROUP_LABELS = {
    aria: 'ARIA-подписи (доступность)',
    title: 'Всплывающие подсказки (title)',
    btn: 'Кнопки',
    pill: 'Навигационные пилюли',
    preloader: 'Прелоадер',
    filter: 'Фильтры',
    tabs: 'Вкладки режимов',
    footer: 'Подвал',
    toggle: 'Переключатели панелей',
    theme: 'Переключение темы',
    copy: 'Копирование ссылки',
    chip: 'Чипы фильтров',
    fs: 'Полноэкранный просмотр',
    motion: 'Motion-блоки',
    bp: 'Blueprint-режим',
    viz: 'Режимы визуализации',
    faTrust: 'Free Assets — блок доверия',
    faTag: 'Free Assets — теги'
  };

  /* ── DOM-конструктор ─────────────────────────────────────────────── */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (value === undefined || value === null || value === false) continue;
        if (key === 'text') node.textContent = value;
        else if (key === 'className') node.className = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, String(value));
      }
    }
    if (children !== undefined && children !== null) {
      for (const child of [].concat(children)) {
        if (child === null || child === undefined) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    }
    return node;
  }

  /* ── тосты ───────────────────────────────────────────────────────── */

  function toast(message, type, link) {
    const node = el('div', { className: 'toast toast--' + (type || 'info'), text: message });
    if (link) {
      node.appendChild(el('a', { href: link.href, target: '_blank', rel: 'noopener', text: link.label }));
    }
    els.toasts.appendChild(node);
    const ttl = type === 'error' || type === 'warn' ? 12000 : 6000;
    setTimeout(() => {
      node.remove();
    }, ttl);
  }

  /* ── перестановка (итерация F, принцип 4 research.md) ────────────── */

  // Перестановка элемента массива: from → to, остальные сдвигаются.
  function movedArray(arr, from, to) {
    const next = arr.slice();
    const item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    return next;
  }

  // Старый индекс → новый после movedArray (для переезда pending-медиа).
  function movedIndex(i, from, to) {
    if (i === from) return to;
    if (from < to) return i > from && i <= to ? i - 1 : i;
    return i >= to && i < from ? i + 1 : i;
  }

  // Переезд pending-медиа при перестановке элементов массива: dot-пути с
  // индексом в указанной позиции (capture group `slot` в regex) сдвигаются
  // через movedIndex. `build(match, newIndex)` собирает новый dot-путь;
  // `accept(match)` (необязательно) отбраковывает чужие пути (например медиа
  // другой категории). Делит общую механику между всеми FA/кейс-моверами.
  function remapListIndex(filePath, regex, slot, from, to, build, accept) {
    State.remapMediaEdits(filePath, (dot) => {
      const match = dot.match(regex);
      if (!match) return dot;
      if (accept && !accept(match)) return dot;
      return build(match, movedIndex(Number(match[slot]), from, to));
    });
  }

  // Ручка ⠿ (крупная зона захвата для SortableJS) + кнопки «вверх/вниз»
  // как клавиатурный a11y-фоллбек. opts: { label, index, count,
  // focusKey, onMove(from, to, focusKey) }.
  function reorderControls(opts) {
    const bar = el('span', { className: 'reorder-bar' });
    bar.appendChild(
      el('span', {
        className: 'reorder-handle',
        title: 'Перетащите, чтобы изменить порядок',
        'aria-hidden': 'true',
        text: '⠿'
      })
    );
    const up = el('button', {
      type: 'button',
      className: 'reorder-btn',
      'data-reorder': opts.focusKey + '::up',
      'aria-label': opts.label + ' — переместить вверх',
      title: 'Вверх',
      text: '↑'
    });
    if (opts.index === 0) up.disabled = true;
    up.addEventListener('click', () => opts.onMove(opts.index, opts.index - 1, opts.focusKey + '::up'));
    const down = el('button', {
      type: 'button',
      className: 'reorder-btn',
      'data-reorder': opts.focusKey + '::down',
      'aria-label': opts.label + ' — переместить вниз',
      title: 'Вниз',
      text: '↓'
    });
    if (opts.index === opts.count - 1) down.disabled = true;
    down.addEventListener('click', () => opts.onMove(opts.index, opts.index + 1, opts.focusKey + '::down'));
    bar.appendChild(up);
    bar.appendChild(down);
    return bar;
  }

  // SortableJS поверх списка (плейсхолдер места вставки — .reorder-ghost).
  // Без vendor-файла остаётся клавиатурный фоллбек reorderControls.
  function makeSortable(listEl, draggable, onMove) {
    if (typeof window.Sortable === 'undefined') return;
    window.Sortable.create(listEl, {
      animation: 150,
      handle: '.reorder-handle',
      draggable,
      ghostClass: 'reorder-ghost',
      onEnd: (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
        onMove(evt.oldIndex, evt.newIndex, null);
      }
    });
  }

  // Восстановление фокуса на той же кнопке после перерисовки списка.
  // У крайней позиции прежняя кнопка может стать disabled — тогда фокус
  // переезжает на парную (up↔down), а не падает на body.
  function focusReorder(focusKey) {
    if (!focusKey) return;
    const find = (key) => document.querySelector('[data-reorder="' + key.replace(/"/g, '\\"') + '"]');
    const node = find(focusKey);
    if (node && !node.disabled) {
      node.focus();
      return;
    }
    let pairedKey = null;
    if (focusKey.slice(-4) === '::up') pairedKey = focusKey.slice(0, -4) + '::down';
    else if (focusKey.slice(-6) === '::down') pairedKey = focusKey.slice(0, -6) + '::up';
    if (!pairedKey) return;
    const paired = find(pairedKey);
    if (paired && !paired.disabled) paired.focus();
  }

  /* ── поля RU/EN (всегда две колонки, не табы) ────────────────────── */

  function clearFieldError(input) {
    input.classList.remove('field-invalid');
    const next = input.nextElementSibling;
    if (next && next.classList.contains('field-error-msg')) next.remove();
  }

  function langInput(filePath, dotPath, opts) {
    const multiline = Boolean(opts && opts.multiline);
    const input = el(multiline ? 'textarea' : 'input', { 'data-field': filePath + '::' + dotPath });
    if (!multiline) input.setAttribute('type', 'text');
    const value = State.getValue(filePath, dotPath);
    input.value = value === undefined || value === null ? '' : String(value);
    input.addEventListener('input', () => {
      State.setValue(filePath, dotPath, input.value);
      clearFieldError(input);
    });
    return input;
  }

  function pairField(filePath, label, enPath, ruPath, opts) {
    const labelClass = opts && opts.mono ? 'pair__label key-label' : 'pair__label';
    return el('div', { className: 'pair' }, [
      el('div', { className: labelClass, text: label }),
      el('div', { className: 'pair__cols' }, [
        el('div', { className: 'pair__col' }, [
          el('span', { className: 'lang-tag', text: 'EN' }),
          langInput(filePath, enPath, opts)
        ]),
        el('div', { className: 'pair__col' }, [
          el('span', { className: 'lang-tag', text: 'RU' }),
          langInput(filePath, ruPath, opts)
        ])
      ])
    ]);
  }

  /* ── drop-зоны медиа (итерация E) ────────────────────────────────── */

  function toAdminAssetPath(sitePath) {
    return String(sitePath).replace(/^\.\//, '../');
  }

  function fileNameOf(assetPath) {
    return String(assetPath).split('/').pop();
  }

  // Drop-зона поверх текущего медиа (принцип 6 research.md).
  // opts: { filePath, dotPath, kind ('image'|'ogImage'|'video'|'model'|'faThumb'),
  //         namingPath  — слот-«назначение»: папка и базовое имя нового файла,
  //         currentPath — текущий файл на GitHub или null,
  //         preview     — 'image' | 'video' | 'file',
  //         hint        — строка с целевыми размерами/форматами,
  //         valueMode   — 'baseName' для слотов free-assets (в JSON пишется
  //                       базовое имя, не путь; см. State.stageMedia),
  //         resolveValue— значение поля → site-путь файла (для превью и
  //                       строки пути; по умолчанию значение УЖЕ путь) }
  function dropZone(opts) {
    const rule = State.getMediaRule(opts.kind);
    const resolveValue = opts.resolveValue || ((value) => value);
    // tabindex="-1": единственный tab-stop слота — сам file-input (он
    // накрывает зону целиком); видимый фокус рисует .drop-zone:focus-within.
    const zone = el('div', { className: 'drop-zone', tabindex: '-1' });
    const badge = el('span', { className: 'drop-zone__badge', text: 'новый файл', hidden: true });
    const pathLine = el('p', { className: 'drop-zone-path' });
    const input = el('input', {
      type: 'file',
      className: 'drop-zone__input',
      accept: rule.accept,
      'aria-label': 'Заменить файл: ' + (opts.hint || rule.formatLabel),
      'data-media': opts.filePath + '::' + opts.dotPath
    });

    function render() {
      const record = State.getMediaEdit(opts.filePath, opts.dotPath);
      const draftValue = State.getValue(opts.filePath, opts.dotPath);
      // record.value / draftValue проходят через resolveValue (для FA это
      // базовое имя → путь); opts.currentPath — уже готовый site-путь.
      let effective;
      if (record) effective = resolveValue(record.value);
      else if (draftValue !== undefined && draftValue !== null && draftValue !== '') effective = resolveValue(draftValue);
      else effective = opts.currentPath || null;
      const url = record ? record.objectURL : effective ? toAdminAssetPath(effective) : null;

      zone.replaceChildren();
      if (url && opts.preview === 'image') {
        zone.appendChild(el('img', { className: 'drop-zone__preview', src: url, alt: '', loading: 'lazy' }));
      } else if (url && opts.preview === 'video') {
        zone.appendChild(
          el('video', {
            className: 'drop-zone__preview drop-zone__preview--video',
            src: url,
            muted: true,
            loop: true,
            controls: true,
            playsinline: true,
            preload: 'metadata'
          })
        );
      } else {
        zone.appendChild(
          el('div', { className: 'drop-zone__file', text: effective ? fileNameOf(effective) : 'файла ещё нет' })
        );
      }
      zone.appendChild(
        el('div', { className: 'drop-zone__overlay' }, [
          el('span', { className: 'drop-zone__cta', text: 'перетащите новую или нажмите' })
        ])
      );
      badge.hidden = !record;
      zone.appendChild(badge);
      zone.appendChild(input);
      pathLine.replaceChildren(el('code', { text: effective || '—' }));
    }

    async function handleFile(file) {
      if (!file) return;
      try {
        const result = await State.stageMedia(
          opts.filePath,
          opts.dotPath,
          opts.kind,
          opts.namingPath,
          opts.currentPath,
          file,
          opts.valueMode
        );
        if (result.unchanged) {
          toast('Этот файл уже опубликован под тем же именем — заменять нечего.', 'info');
        } else if (result.warning) {
          toast(result.warning, 'warn');
        }
        render();
        // Итерация H: слоту free-assets нужно снять блокирующую ошибку
        // «файла ещё нет» — после staging файл существует (в памяти или
        // уже опубликован под тем же именем).
        if (opts.onStaged) opts.onStaged(result);
      } catch (error) {
        toast(error && error.message ? error.message : 'Не удалось подготовить файл.', 'error');
      }
      input.value = '';
    }

    input.addEventListener('change', () => handleFile(input.files && input.files[0]));
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('drop-zone--over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drop-zone--over'));
    zone.addEventListener('drop', (event) => {
      zone.classList.remove('drop-zone--over');
      // Файл, упавший на невидимый input, обрабатывает его нативный drop
      // (input.files + событие change) — перехват здесь дал бы двойную
      // обработку одного файла.
      if (event.target === input) return;
      event.preventDefault();
      handleFile(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    });

    render();
    const wrap = el('div', { className: 'drop-zone-field' });
    if (opts.label) wrap.appendChild(el('label', { text: opts.label }));
    wrap.appendChild(zone);
    if (opts.hint) wrap.appendChild(el('p', { className: 'hint', text: opts.hint }));
    wrap.appendChild(pathLine);
    return wrap;
  }

  /* ── ошибки валидации, привязанные к полям ───────────────────────── */

  function hashForPath(path, field) {
    if (path === 'content/meta.json') return '#/meta';
    if (path === 'content/i18n-ui.json') return '#/ui';
    if (path === 'content/settings.json') return '#/cases';
    if (path === FA_PATH) {
      // Ошибка уровня ассета → его редактор (поля живут только там);
      // ошибка уровня каталога → список Free Assets.
      const itemMatch = String(field || '').match(/^categories\.(\d+)\.items\.(\d+)\./);
      if (itemMatch) {
        const categories = State.getValue(FA_PATH, 'categories') || [];
        const category = categories[Number(itemMatch[1])];
        const item = category && Array.isArray(category.items) ? category.items[Number(itemMatch[2])] : null;
        if (item && item.id) return '#/free-assets/' + encodeURIComponent(item.id);
      }
      return '#/free-assets';
    }
    const match = path.match(/^content\/cases\/(.+)\.json$/);
    return match ? '#/case/' + encodeURIComponent(match[1]) : '#/cases';
  }

  function applyPendingErrors() {
    if (pendingErrors.length === 0) return;
    const byField = {};
    for (const error of pendingErrors) byField[error.path + '::' + error.field] = error.message;
    let firstNode = null;
    for (const node of document.querySelectorAll('[data-field]')) {
      const key = node.getAttribute('data-field');
      if (!(key in byField)) continue;
      node.classList.add('field-invalid');
      let parent = node.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS') parent.open = true;
        parent = parent.parentElement;
      }
      const next = node.nextElementSibling;
      if (!next || !next.classList.contains('field-error-msg')) {
        node.insertAdjacentElement('afterend', el('p', { className: 'field-error-msg', text: byField[key] }));
      }
      if (!firstNode) firstNode = node;
    }
    pendingErrors = [];
    if (firstNode) firstNode.scrollIntoView({ block: 'center' });
  }

  /* ── шапка (индикатор черновика, публикация, пользователь) ───────── */

  function onLogout() {
    API.clearSession();
    window.location.hash = '#/login';
    route();
  }

  function updateChrome() {
    const token = API.getToken();
    const user = API.getUser();
    els.topbar.hidden = !token;
    const dirty = State.isDirty();
    els.draftIndicator.hidden = !dirty;
    els.mediaWarning.hidden = State.mediaPendingCount() === 0;
    els.publishBtn.disabled = !dirty || publishing || !token;
    els.publishBtn.textContent = publishing ? 'Публикуем…' : 'Опубликовать';
    els.topbarUser.replaceChildren();
    if (token && user) {
      if (user.avatarUrl) {
        els.topbarUser.appendChild(el('img', { className: 'topbar__avatar', src: user.avatarUrl, alt: '' }));
      }
      els.topbarUser.appendChild(el('span', { className: 'topbar__login', text: user.login }));
      els.topbarUser.appendChild(
        el('button', { type: 'button', className: 'btn btn--ghost', id: 'logout-btn', text: 'Выйти', onclick: onLogout })
      );
    }
  }

  function setActiveNav(view) {
    const active = view === 'case' ? 'cases' : view;
    for (const link of els.topbar.querySelectorAll('[data-nav]')) {
      link.classList.toggle('is-active', link.getAttribute('data-nav') === active);
    }
  }

  /* ── вход ────────────────────────────────────────────────────────── */

  function renderLogin() {
    els.topbar.hidden = true;
    const errorMsg = el('p', { className: 'login__error', id: 'login-error', hidden: true });

    function showError(message) {
      errorMsg.textContent = message;
      errorMsg.hidden = false;
    }

    async function applyToken(token) {
      const user = await API.validateToken(token);
      API.setSession(token, user);
      if (window.location.hash && window.location.hash !== '#/login') route();
      else window.location.hash = '#/cases';
    }

    const githubBtn = el('button', { type: 'button', className: 'btn btn--primary', id: 'login-github' }, [
      'Войти через GitHub'
    ]);
    githubBtn.addEventListener('click', async () => {
      errorMsg.hidden = true;
      githubBtn.disabled = true;
      try {
        const token = await API.loginWithGitHub();
        await applyToken(token);
      } catch (error) {
        showError(error.message || 'Не удалось войти через GitHub.');
      } finally {
        githubBtn.disabled = false;
      }
    });

    const patInput = el('input', { className: 'input', id: 'pat-input', type: 'password', autocomplete: 'off' });
    const patSubmit = el('button', { type: 'submit', className: 'btn btn--primary', id: 'pat-submit' }, ['Войти']);
    const patForm = el('form', { className: 'pat-form', id: 'pat-form', hidden: true }, [
      el('label', { for: 'pat-input', text: 'Personal access token (fine-grained)' }),
      patInput,
      el('p', {
        className: 'hint',
        text:
          'Создайте токен на github.com → Settings → Developer settings → Fine-grained tokens: ' +
          'доступ к репозиторию Gorgutc/codex, право «Contents: Read and write». ' +
          'Токен хранится только в этой вкладке (sessionStorage) и пропадёт при её закрытии.'
      }),
      patSubmit
    ]);
    patForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorMsg.hidden = true;
      const token = patInput.value.trim();
      if (!token) {
        showError('Вставьте токен.');
        return;
      }
      patSubmit.disabled = true;
      try {
        await applyToken(token);
      } catch (error) {
        showError(error.message || 'Не удалось проверить токен.');
      } finally {
        patSubmit.disabled = false;
      }
    });

    const patToggle = el('button', { type: 'button', className: 'btn', id: 'login-pat-toggle' }, ['Войти с токеном']);
    patToggle.addEventListener('click', () => {
      patForm.hidden = !patForm.hidden;
      if (!patForm.hidden) patInput.focus();
    });

    els.app.replaceChildren(
      el('section', { className: 'login' }, [
        el('p', { className: 'login__brand', text: 'CODEX STUDIO' }),
        el('h1', { text: 'Вход в админ-панель' }),
        el('div', { className: 'login__buttons' }, [githubBtn, patToggle]),
        patForm,
        errorMsg
      ])
    );
  }

  /* ── список кейсов (итерация F: порядок + видимость) ─────────────── */

  function casePathOf(id) {
    return 'content/cases/' + id + '.json';
  }

  async function renderCases() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загрузка списка кейсов…' }));
    // Свежий settings.json с GitHub — источник порядка и категорий
    // (черновик накладывается в AdminState поверх).
    const [catalog] = await Promise.all([State.loadCatalog(), State.ensureFile(SETTINGS_PATH)]);
    const byId = new Map(catalog.cases.map((item) => [item.id, item]));

    const labels = {};
    function draftFilters() {
      return State.getValue(SETTINGS_PATH, 'filters') || [];
    }
    for (const filter of draftFilters()) labels[filter.key] = filter.label;

    function order() {
      return (State.getValue(SETTINGS_PATH, 'cardOrder') || []).slice();
    }
    function categoryEnabled(key) {
      const filter = draftFilters().find((f) => f && f.key === key);
      return !filter || filter.enabled !== false;
    }
    // enabled кейса с учётом черновика (в т.ч. восстановленного из
    // sessionStorage) поверх каталога.
    function caseEnabled(id) {
      const drafted = State.peekDraftValue(casePathOf(id), 'enabled');
      if (drafted !== undefined) return drafted !== false;
      const item = byId.get(id);
      return !item || item.data.enabled !== false;
    }
    function isVisible(id) {
      const item = byId.get(id);
      return caseEnabled(id) && (!item || categoryEnabled(item.data.category));
    }
    function visibleCount() {
      return order().filter(isVisible).length;
    }

    const search = el('input', {
      className: 'input cases__search',
      id: 'case-search',
      type: 'search',
      placeholder: 'Поиск: название, категория, id'
    });
    const list = el('ul', { className: 'case-list', id: 'case-list' });
    const hint = el('p', {
      className: 'hint',
      id: 'case-list-hint',
      text:
        'Порядок карточек на сайте: перетащите строку за ⠿ или используйте кнопки ↑/↓. ' +
        'Выключатель справа скрывает кейс с сайта (файлы не удаляются).'
    });

    function moveCase(from, to, focusKey) {
      const current = order();
      if (from === to || to < 0 || to >= current.length) return;
      State.setValue(SETTINGS_PATH, 'cardOrder', movedArray(current, from, to));
      toast('Порядок сохранён в черновик', 'info');
      renderRows();
      focusReorder(focusKey);
    }

    async function toggleCase(id, next, input) {
      if (!next && isVisible(id) && visibleCount() <= 1) {
        toast('Нельзя скрыть последний видимый кейс — сетка работ на сайте останется пустой.', 'error');
        input.checked = true;
        return;
      }
      input.disabled = true;
      try {
        await State.ensureFile(casePathOf(id));
        State.setValue(casePathOf(id), 'enabled', next);
        renderRows();
      } catch (error) {
        toast('Не удалось загрузить кейс с GitHub: ' + (error.message || error), 'error');
        input.checked = !next;
        input.disabled = false;
      }
    }

    function caseRow(item, index, count, reorderEnabled) {
      const data = item.data;
      const path = casePathOf(item.id);
      const enabledFlag = caseEnabled(item.id);
      const catEnabled = categoryEnabled(data.category);

      const toggleInput = el('input', {
        type: 'checkbox',
        'data-case-toggle': item.id,
        'aria-label': enabledFlag ? 'Кейс «' + data.card.title.en + '» включён' : 'Кейс «' + data.card.title.en + '» скрыт'
      });
      toggleInput.checked = enabledFlag;
      toggleInput.addEventListener('change', () => toggleCase(item.id, toggleInput.checked, toggleInput));

      return el(
        'li',
        {
          className: 'case-row' + (!enabledFlag || !catEnabled ? ' case-row--off' : ''),
          'data-case-id': item.id
        },
        [
          reorderEnabled
            ? reorderControls({
                label: 'Кейс «' + data.card.title.en + '»',
                index,
                count,
                focusKey: 'case::' + item.id,
                onMove: moveCase
              })
            : null,
          el('a', { className: 'case-row__link', href: '#/case/' + encodeURIComponent(item.id) }, [
            el('img', { className: 'case-row__thumb', src: toAdminAssetPath(data.card.thumb), alt: '', loading: 'lazy' }),
            el('div', {}, [
              el('p', { className: 'case-row__title', text: data.card.title.en }),
              el('span', { className: 'case-row__id', text: item.id })
            ])
          ]),
          el('div', { className: 'case-row__meta' }, [
            State.hasDraft(path) ? el('span', { className: 'badge badge--draft', text: 'черновик' }) : null,
            !enabledFlag ? el('span', { className: 'badge badge--off', text: 'скрыто' }) : null,
            !catEnabled ? el('span', { className: 'badge badge--off', text: 'категория скрыта' }) : null,
            el('span', { text: labels[data.category] || data.category }),
            el('span', { text: data.year }),
            el('label', { className: 'switch', title: enabledFlag ? 'Скрыть кейс с сайта' : 'Показать кейс на сайте' }, [
              toggleInput,
              el('span', { className: 'switch__track', 'aria-hidden': 'true' })
            ])
          ])
        ]
      );
    }

    function renderRows() {
      const query = search.value.trim().toLowerCase();
      const reorderEnabled = query === '';
      hint.textContent = reorderEnabled
        ? 'Порядок карточек на сайте: перетащите строку за ⠿ или используйте кнопки ↑/↓. ' +
          'Выключатель справа скрывает кейс с сайта (файлы не удаляются).'
        : 'Во время поиска перестановка отключена — очистите поле, чтобы менять порядок.';
      list.replaceChildren();
      const ids = order();
      let shown = 0;
      ids.forEach((id, index) => {
        const item = byId.get(id);
        if (!item) return;
        const hay = (
          item.id +
          ' ' +
          item.data.card.title.en +
          ' ' +
          item.data.card.title.ru +
          ' ' +
          (labels[item.data.category] || item.data.category) +
          ' ' +
          item.data.year
        ).toLowerCase();
        if (query && hay.indexOf(query) === -1) return;
        shown += 1;
        list.appendChild(caseRow(item, index, ids.length, reorderEnabled));
      });
      if (shown === 0) list.appendChild(el('li', { className: 'empty-note', text: 'Ничего не найдено' }));
    }

    search.addEventListener('input', renderRows);
    renderRows();
    makeSortable(list, '.case-row', (from, to) => {
      // Drag активен только без поискового фильтра (handle скрыт при поиске),
      // поэтому индексы Sortable совпадают с индексами cardOrder.
      moveCase(from, to, null);
    });

    els.app.replaceChildren(
      el('section', { className: 'cases' }, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Кейсы' }),
          el('span', { className: 'view-head__hint', text: 'всего: ' + catalog.cases.length }),
          search
        ]),
        hint,
        list
      ])
    );
  }

  /* ── категории (итерация F: вкл/выкл фильтров сайта) ─────────────── */

  async function renderCategories() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем настройки с GitHub…' }));
    const [catalog] = await Promise.all([State.loadCatalog(), State.ensureFile(SETTINGS_PATH)]);

    const casesByCategory = {};
    for (const item of catalog.cases) {
      casesByCategory[item.data.category] = (casesByCategory[item.data.category] || []).concat(item.id);
    }

    function draftFilters() {
      return State.getValue(SETTINGS_PATH, 'filters') || [];
    }
    function categoryEnabled(key) {
      const filter = draftFilters().find((f) => f && f.key === key);
      return !filter || filter.enabled !== false;
    }
    function caseEnabled(id) {
      const drafted = State.peekDraftValue(casePathOf(id), 'enabled');
      if (drafted !== undefined) return drafted !== false;
      const item = catalog.cases.find((c) => c.id === id);
      return !item || item.data.enabled !== false;
    }
    // Сколько кейсов останется видимыми, если выключить категорию key.
    function visibleCountWithout(key) {
      let count = 0;
      for (const item of catalog.cases) {
        if (item.data.category === key) continue;
        if (caseEnabled(item.id) && categoryEnabled(item.data.category)) count += 1;
      }
      return count;
    }

    const list = el('ul', { className: 'category-list', id: 'category-list' });

    function toggleCategory(index, next, input) {
      const filter = draftFilters()[index];
      if (!next && visibleCountWithout(filter.key) === 0) {
        toast('Нельзя выключить категорию «' + filter.label + '» — на сайте не останется ни одного видимого кейса.', 'error');
        input.checked = true;
        return;
      }
      State.setValue(SETTINGS_PATH, 'filters.' + index + '.enabled', next);
      renderRows();
    }

    function renderRows() {
      list.replaceChildren();
      draftFilters().forEach((filter, index) => {
        if (!filter || filter.key === 'all') return; // «All» — сброс фильтра, не выключается
        const enabled = filter.enabled !== false;
        const ids = casesByCategory[filter.key] || [];
        const toggleInput = el('input', {
          type: 'checkbox',
          'data-category-toggle': filter.key,
          'aria-label': enabled ? 'Категория «' + filter.label + '» включена' : 'Категория «' + filter.label + '» скрыта'
        });
        toggleInput.checked = enabled;
        toggleInput.addEventListener('change', () => toggleCategory(index, toggleInput.checked, toggleInput));
        list.appendChild(
          el('li', { className: 'category-row' + (enabled ? '' : ' category-row--off'), 'data-category-row': filter.key }, [
            el('div', { className: 'category-row__info' }, [
              el('p', { className: 'category-row__label', text: filter.label }),
              el('span', { className: 'category-row__id', text: filter.key + ' · кейсов: ' + ids.length })
            ]),
            el('div', { className: 'case-row__meta' }, [
              !enabled ? el('span', { className: 'badge badge--off', text: 'скрыта' }) : null,
              el('label', {
                className: 'switch',
                title: enabled ? 'Скрыть категорию и все её кейсы с сайта' : 'Показать категорию на сайте'
              }, [toggleInput, el('span', { className: 'switch__track', 'aria-hidden': 'true' })])
            ])
          ])
        );
      });
    }

    renderRows();

    els.app.replaceChildren(
      el('section', {}, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Категории' }),
          el('span', { className: 'view-head__hint', text: 'фильтры сайта · content/settings.json' })
        ]),
        el('p', {
          className: 'hint',
          text:
            'Выключенная категория исчезает из фильтров на сайте, а все её кейсы скрываются из сетки. ' +
            'Файлы кейсов не удаляются — категорию можно включить обратно в любой момент. ' +
            'Фильтр «All» выключить нельзя.'
        }),
        list
      ])
    );
  }

  /* ── Free Assets (итерация H): каталог, видимость, порядок ───────── */

  // Свёрнутость групп категорий переживает перерисовки экрана (не вкладку).
  const faCollapsed = new Set();

  function faCategories() {
    return State.getValue(FA_PATH, 'categories') || [];
  }

  function faItemVisible(category, item) {
    return category.enabled !== false && item.enabled !== false;
  }

  // Видимых ассетов в каталоге; skipCategoryIndex (число) — категория,
  // которую считаем выключенной (предпросмотр выключения). Делит единый
  // предикат с валидатором — см. State.countVisibleFaAssets.
  function faVisibleTotal(skipCategoryIndex) {
    return State.countVisibleFaAssets(
      faCategories(),
      typeof skipCategoryIndex === 'number' ? { skipCategoryIndex } : undefined
    );
  }

  async function renderFreeAssets() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем каталог Free Assets с GitHub…' }));
    await State.ensureFile(FA_PATH);

    const list = el('div', { className: 'fa-cat-list', id: 'fa-cat-list' });

    function moveCategory(from, to, focusKey) {
      const categories = faCategories();
      if (from === to || to < 0 || to >= categories.length) return;
      State.setValue(FA_PATH, 'categories', movedArray(categories, from, to));
      remapListIndex(
        FA_PATH,
        /^categories\.(\d+)\.(.+)$/,
        1,
        from,
        to,
        (match, newIndex) => 'categories.' + newIndex + '.' + match[2]
      );
      toast('Порядок сохранён в черновик', 'info');
      renderRows();
      focusReorder(focusKey);
    }

    function moveItem(categoryIndex, from, to, focusKey) {
      const items = State.getValue(FA_PATH, 'categories.' + categoryIndex + '.items') || [];
      if (from === to || to < 0 || to >= items.length) return;
      State.setValue(FA_PATH, 'categories.' + categoryIndex + '.items', movedArray(items, from, to));
      remapListIndex(
        FA_PATH,
        /^categories\.(\d+)\.items\.(\d+)\.(.+)$/,
        2,
        from,
        to,
        (match, newIndex) => 'categories.' + match[1] + '.items.' + newIndex + '.' + match[3],
        (match) => Number(match[1]) === categoryIndex
      );
      toast('Порядок сохранён в черновик', 'info');
      renderRows();
      focusReorder(focusKey);
    }

    function toggleItem(categoryIndex, itemIndex, next, input) {
      const category = faCategories()[categoryIndex];
      const item = (category.items || [])[itemIndex];
      if (!next && faItemVisible(category, item) && faVisibleTotal() <= 1) {
        toast('Нельзя скрыть последний видимый ассет — каталог Free Assets на сайте останется пустым.', 'error');
        input.checked = true;
        return;
      }
      const dot = 'categories.' + categoryIndex + '.items.' + itemIndex + '.enabled';
      // Включение возвращает конвенцию «поле отсутствует = включено» —
      // черновик без других правок снова чистый.
      if (next) State.deleteValue(FA_PATH, dot);
      else State.setValue(FA_PATH, dot, false);
      renderRows();
    }

    function toggleCategory(categoryIndex, next, input) {
      const category = faCategories()[categoryIndex];
      if (!next && faVisibleTotal(categoryIndex) === 0) {
        toast('Нельзя выключить категорию «' + category.key + '» — на сайте не останется ни одного видимого ассета.', 'error');
        input.checked = true;
        return;
      }
      const dot = 'categories.' + categoryIndex + '.enabled';
      if (next) State.deleteValue(FA_PATH, dot);
      else State.setValue(FA_PATH, dot, false);
      renderRows();
    }

    function itemRow(category, categoryIndex, item, itemIndex, count) {
      const enabledFlag = item.enabled !== false;
      const catEnabled = category.enabled !== false;
      const toggleInput = el('input', {
        type: 'checkbox',
        'data-fa-item-toggle': item.id,
        'aria-label': enabledFlag ? 'Ассет «' + item.title + '» включён' : 'Ассет «' + item.title + '» скрыт'
      });
      toggleInput.checked = enabledFlag;
      toggleInput.addEventListener('change', () => toggleItem(categoryIndex, itemIndex, toggleInput.checked, toggleInput));
      return el(
        'li',
        { className: 'case-row fa-item-row' + (!enabledFlag || !catEnabled ? ' case-row--off' : ''), 'data-fa-item': item.id },
        [
          reorderControls({
            label: 'Ассет «' + item.title + '»',
            index: itemIndex,
            count,
            focusKey: 'fa-item::' + item.id,
            onMove: (from, to, focusKey) => moveItem(categoryIndex, from, to, focusKey)
          }),
          el('a', { className: 'case-row__link', href: '#/free-assets/' + encodeURIComponent(item.id) }, [
            el('div', {}, [
              el('p', { className: 'case-row__title', text: item.title }),
              el('span', { className: 'case-row__id', text: item.id + ' · ' + item.size + ' · ' + item.file })
            ])
          ]),
          el('div', { className: 'case-row__meta' }, [
            !enabledFlag ? el('span', { className: 'badge badge--off', text: 'скрыто' }) : null,
            !catEnabled ? el('span', { className: 'badge badge--off', text: 'категория скрыта' }) : null,
            el('span', { text: item.badge }),
            el('label', { className: 'switch', title: enabledFlag ? 'Скрыть ассет с сайта' : 'Показать ассет на сайте' }, [
              toggleInput,
              el('span', { className: 'switch__track', 'aria-hidden': 'true' })
            ])
          ])
        ]
      );
    }

    function categorySection(category, categoryIndex, count) {
      const enabled = category.enabled !== false;
      const items = category.items || [];
      const visibleItems = items.filter((item) => item.enabled !== false).length;
      const collapsed = faCollapsed.has(category.key);

      const toggleInput = el('input', {
        type: 'checkbox',
        'data-fa-category-toggle': category.key,
        'aria-label': enabled ? 'Категория «' + category.key + '» включена' : 'Категория «' + category.key + '» скрыта'
      });
      toggleInput.checked = enabled;
      toggleInput.addEventListener('change', () => toggleCategory(categoryIndex, toggleInput.checked, toggleInput));

      const itemsList = el('ul', { className: 'fa-cat__items', hidden: collapsed });
      items.forEach((item, itemIndex) => itemsList.appendChild(itemRow(category, categoryIndex, item, itemIndex, items.length)));
      makeSortable(itemsList, '.fa-item-row', (from, to) => moveItem(categoryIndex, from, to, null));

      const collapseBtn = el(
        'button',
        {
          type: 'button',
          className: 'fa-cat__collapse',
          'aria-expanded': collapsed ? 'false' : 'true',
          'data-fa-collapse': category.key
        },
        [
          el('span', { className: 'fa-cat__chevron', 'aria-hidden': 'true', text: collapsed ? '▸' : '▾' }),
          el('span', { className: 'fa-cat__label', text: (items[0] && items[0].cat) || category.key }),
          el('span', {
            className: 'fa-cat__count',
            text: category.key + ' · ассетов: ' + items.length + (visibleItems !== items.length ? ' · видимых: ' + visibleItems : '')
          })
        ]
      );
      collapseBtn.addEventListener('click', () => {
        if (faCollapsed.has(category.key)) faCollapsed.delete(category.key);
        else faCollapsed.add(category.key);
        renderRows();
      });

      return el('section', { className: 'fa-cat' + (enabled ? '' : ' fa-cat--off'), 'data-fa-category': category.key }, [
        el('div', { className: 'fa-cat__head' }, [
          reorderControls({
            label: 'Категория «' + category.key + '»',
            index: categoryIndex,
            count,
            focusKey: 'fa-cat::' + category.key,
            onMove: moveCategory
          }),
          collapseBtn,
          el('div', { className: 'case-row__meta' }, [
            !enabled ? el('span', { className: 'badge badge--off', text: 'скрыта' }) : null,
            el('label', {
              className: 'switch',
              title: enabled ? 'Скрыть категорию и все её ассеты с сайта' : 'Показать категорию на сайте'
            }, [toggleInput, el('span', { className: 'switch__track', 'aria-hidden': 'true' })])
          ])
        ]),
        itemsList
      ]);
    }

    // Бейдж «черновик» в шапке должен отражать ЖИВОЕ состояние черновика:
    // экран строится один раз, а renderRows() перерисовывает только список,
    // поэтому badge обновляем тем же вызовом, что и список (тоглы/перестановки
    // его уже зовут). Согласован с topbar #draft-indicator.
    const draftBadgeSlot = el('span', { className: 'view-head__badge-slot' });
    function refreshDraftBadge() {
      draftBadgeSlot.replaceChildren();
      if (State.hasDraft(FA_PATH)) {
        draftBadgeSlot.appendChild(el('span', { className: 'badge badge--draft', text: 'черновик' }));
      }
    }

    function renderRows() {
      list.replaceChildren();
      const categories = faCategories();
      categories.forEach((category, categoryIndex) => {
        list.appendChild(categorySection(category, categoryIndex, categories.length));
      });
      refreshDraftBadge();
    }

    renderRows();
    makeSortable(list, '.fa-cat', (from, to) => moveCategory(from, to, null));

    els.app.replaceChildren(
      el('section', { className: 'fa-screen' }, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Free Assets' }),
          el('span', { className: 'view-head__hint', text: 'каталог бесплатных ассетов · content/free-assets.json' }),
          draftBadgeSlot
        ]),
        el('p', {
          className: 'hint',
          text: 'Нажмите «Предпросмотр» вверху — каталог соберётся с черновиком (видимость, порядок, тексты). Замена 3D-превью и постеров видна только после публикации.'
        }),
        el('p', {
          className: 'hint',
          text:
            'Порядок категорий и ассетов на сайте повторяет порядок списков: перетащите за ⠿ или используйте кнопки ↑/↓. ' +
            'Выключатель скрывает ассет или категорию целиком (файлы не удаляются) — ' +
            'счётчики на карточках категорий сайта пересчитываются автоматически при публикации.'
        }),
        list
      ])
    );
  }

  /* ── Free Assets: редактор ассета ────────────────────────────────── */

  function faFindItem(id) {
    const categories = faCategories();
    for (let ci = 0; ci < categories.length; ci += 1) {
      const items = categories[ci].items || [];
      for (let ii = 0; ii < items.length; ii += 1) {
        if (items[ii].id === id) return { category: categories[ci], item: items[ii], ci, ii };
      }
    }
    return null;
  }

  function faTextField(label, dotPath, opts) {
    const wrap = el('div', { className: 'pair' }, [
      el('div', { className: 'pair__label', text: label }),
      el('div', { className: 'pair__col' }, [langInput(FA_PATH, dotPath, opts)])
    ]);
    if (opts && opts.hint) wrap.appendChild(el('p', { className: 'hint', text: opts.hint }));
    return wrap;
  }

  // Поле фона карточки: CSS-градиент строкой + живой образец рядом.
  function faBgField(dotBase) {
    // langInput уже даёт data-field, начальное значение и input-листенер
    // (setValue + clearFieldError); добавляем только покраску образца.
    const input = langInput(FA_PATH, dotBase + '.bg');
    const swatch = el('span', { className: 'bg-swatch', 'aria-hidden': 'true' });
    function paint() {
      swatch.style.background = '';
      swatch.style.background = input.value;
    }
    input.addEventListener('input', paint);
    paint();
    return el('div', { className: 'pair' }, [
      el('div', { className: 'pair__label', text: 'Фон превью (CSS-градиент)' }),
      el('div', { className: 'pair__col fa-bg-row' }, [input, swatch]),
      el('p', {
        className: 'hint',
        text: 'Строка CSS как есть, например «linear-gradient(135deg,#1e2d3d 0,#2a3a4a 100%)» — образец справа обновляется по мере ввода.'
      })
    ]);
  }

  // Список «архив содержит»: добавление, удаление, порядок строк.
  function faContentsEditor(dotBase) {
    const dot = dotBase + '.contents';
    const rows = el('div', { className: 'fa-contents__rows' });
    const wrap = el('div', { className: 'fa-contents', 'data-field': FA_PATH + '::' + dot });

    function values() {
      return (State.getValue(FA_PATH, dot) || []).slice();
    }

    function moveRow(from, to, focusKey) {
      const current = values();
      if (from === to || to < 0 || to >= current.length) return;
      State.setValue(FA_PATH, dot, movedArray(current, from, to));
      renderRows();
      focusReorder(focusKey);
    }

    function renderRows() {
      rows.replaceChildren();
      const current = values();
      current.forEach((value, i) => {
        const input = el('input', { type: 'text', 'aria-label': 'Строка ' + (i + 1) + ' списка «архив содержит»' });
        input.value = value === undefined || value === null ? '' : String(value);
        input.addEventListener('input', () => {
          State.setValue(FA_PATH, dot + '.' + i, input.value);
          clearFieldError(wrap);
        });
        const removeBtn = el('button', {
          type: 'button',
          className: 'btn btn--ghost fa-contents__remove',
          'aria-label': 'Строка ' + (i + 1) + ' — удалить',
          text: 'удалить'
        });
        removeBtn.addEventListener('click', () => {
          const next = values();
          next.splice(i, 1);
          State.setValue(FA_PATH, dot, next);
          renderRows();
        });
        rows.appendChild(
          el('div', { className: 'fa-contents__row' }, [
            reorderControls({ label: 'Строка ' + (i + 1), index: i, count: current.length, focusKey: 'fa-contents::' + i, onMove: moveRow }),
            input,
            removeBtn
          ])
        );
      });
    }

    const addBtn = el('button', { type: 'button', className: 'btn', id: 'fa-contents-add', text: '+ Добавить строку' });
    addBtn.addEventListener('click', () => {
      State.setValue(FA_PATH, dot, values().concat(['']));
      renderRows();
      const inputs = rows.querySelectorAll('input');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    });

    renderRows();
    wrap.appendChild(el('label', { text: 'Архив содержит (по строке на пункт)' }));
    wrap.appendChild(rows);
    wrap.appendChild(addBtn);
    return wrap;
  }

  // Опубликованное (base, не draft) состояние ассета — по id, потому что
  // порядок items в черновике мог поменяться и индексы draft ≠ индексы base.
  function faBaseItem(id) {
    const entry = State.getEntry(FA_PATH);
    const categories = entry && entry.base && Array.isArray(entry.base.categories) ? entry.base.categories : [];
    for (const category of categories) {
      const items = Array.isArray(category.items) ? category.items : [];
      for (const item of items) {
        if (item && item.id === id) return item;
      }
    }
    return null;
  }

  // Блокирующие ошибки медиа-слотов free-assets: «включили слот, а файла в
  // репозитории нет». Ключ — id + '::' + thumb|model (не dot-путь: индексы
  // черновика меняются при перестановках). onPublishClick добавляет эти
  // ошибки к State.validateAll() — публикация блокируется как при любой
  // другой ошибке поля.
  const faMediaErrors = new Map();

  // Тогл «3D-превью» / «постер» (конвенция thumb/model в free-assets.json:
  // поле отсутствует → файл по умолчанию = id, null → выключено, строка →
  // базовое имя). Выключение сбрасывает и pending-загрузку слота.
  function faMediaSection(id, dotBase, key, opts, rerender) {
    const dot = dotBase + '.' + key;
    const errorKey = id + '::' + key;
    const draftItem = faFindItem(id);
    const item = draftItem ? draftItem.item : {};
    const pending = State.getMediaEdit(FA_PATH, dot);
    const base = key in item ? item[key] : item.id;
    const enabled = Boolean(pending) || base !== null;

    const toggleInput = el('input', {
      type: 'checkbox',
      'data-fa-media-toggle': key,
      'aria-label': opts.toggleLabel + (enabled ? ' — включено' : ' — выключено')
    });
    toggleInput.checked = enabled;
    toggleInput.addEventListener('change', () => {
      if (toggleInput.checked) {
        // Включение: если в опубликованном файле у слота было кастомное
        // базовое имя ({id}-{hash8} после прошлой загрузки) — возвращаем
        // именно его; ключ удаляем (файл по умолчанию <id>.<ext>) только
        // когда в base ключа не было вовсе.
        const baseItem = faBaseItem(id);
        const baseValue = baseItem && typeof baseItem[key] === 'string' && baseItem[key] ? baseItem[key] : null;
        if (baseValue) State.setValue(FA_PATH, dot, baseValue);
        else State.deleteValue(FA_PATH, dot);
        const checkPath = opts.resolveValue(baseValue || id);
        fetch(toAdminAssetPath(checkPath), { method: 'HEAD' })
          .then((res) => {
            // Пока шёл HEAD-запрос состояние слота могло измениться: слот
            // выключили (null) ЛИБО появилась staged-загрузка — в обоих
            // случаях ошибка «файла нет» неактуальна (staged-файл уйдёт в
            // коммит). Снимаем возможную ошибку и не навешиваем новую.
            if (State.getValue(FA_PATH, dot) === null || State.getMediaEdit(FA_PATH, dot)) {
              if (faMediaErrors.delete(errorKey)) rerender();
              return;
            }
            // Перерисовываем только при реальном изменении карты ошибок —
            // иначе HEAD на существующий файл крал бы фокус/каретку у
            // печатающего владельца лишним перестроением редактора.
            if (!res.ok) {
              const message =
                'Файла ' + checkPath + ' ещё нет в репозитории — загрузите файл или выключите тогл, публикация заблокирована.';
              if (faMediaErrors.get(errorKey) !== message) {
                faMediaErrors.set(errorKey, message);
                rerender();
              }
            } else if (faMediaErrors.delete(errorKey)) {
              rerender();
            }
          })
          .catch(() => {});
      } else {
        faMediaErrors.delete(errorKey);
        State.discardMediaEdit(FA_PATH, dot);
        State.setValue(FA_PATH, dot, null);
      }
      rerender();
    });

    const section = el('div', { className: 'fa-media-slot', 'data-field': FA_PATH + '::' + dot }, [
      el('label', { className: 'fa-media-toggle' }, [
        el('span', { className: 'switch' }, [toggleInput, el('span', { className: 'switch__track', 'aria-hidden': 'true' })]),
        el('span', { text: opts.toggleLabel })
      ])
    ]);
    if (enabled) {
      section.appendChild(
        dropZone({
          filePath: FA_PATH,
          dotPath: dot,
          kind: opts.kind,
          valueMode: 'baseName',
          namingPath: opts.resolveValue(id),
          currentPath: base ? opts.resolveValue(base) : null,
          resolveValue: opts.resolveValue,
          preview: opts.preview,
          label: opts.zoneLabel,
          hint: opts.hint,
          onStaged: () => {
            if (faMediaErrors.delete(errorKey)) rerender();
          }
        })
      );
    } else {
      section.appendChild(el('p', { className: 'hint', text: opts.offHint }));
    }
    const errorMessage = faMediaErrors.get(errorKey);
    if (!errorMessage) return section;
    // Ошибка рисуется как у обычных полей: рамка + .field-error-msg сразу
    // ПОСЛЕ узла с data-field (applyPendingErrors тогда не дублирует текст).
    section.classList.add('field-invalid');
    return el('div', {}, [section, el('p', { className: 'field-error-msg', text: errorMessage })]);
  }

  async function renderFaItemEditor(id) {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем каталог Free Assets с GitHub…' }));
    await State.ensureFile(FA_PATH);
    const found = faFindItem(id);
    if (!found) {
      renderError(new Error('Ассет «' + id + '» не найден в content/free-assets.json'));
      return;
    }
    const dotBase = 'categories.' + found.ci + '.items.' + found.ii;

    function rerender() {
      const y = window.scrollY;
      renderFaItemEditor(id).then(() => {
        window.scrollTo(0, y);
      });
    }

    const sections = [];
    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Карточка ассета' }),
        faTextField('Название', dotBase + '.title'),
        faTextField('Бейдж на превью', dotBase + '.badge'),
        faTextField('Подпись категории на карточке', dotBase + '.cat', {
          hint:
            'Видимая подпись категории на самой карточке (например «Hard Surface»). ' +
            'Принадлежность ассета категории каталога она не меняет.'
        }),
        pairField(FA_PATH, 'Описание', dotBase + '.desc.en', dotBase + '.desc.ru', { multiline: true })
      ])
    );

    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Архив' }),
        faContentsEditor(dotBase),
        faTextField('Размер архива', dotBase + '.size', {
          hint: 'Строка как есть, например «48 MB» — показывается на кнопке скачивания.'
        }),
        faTextField('Файл архива', dotBase + '.file', {
          hint:
            'Имя ZIP в папке downloads/ репозитория (без папок). Сам архив через админку не загружается — ' +
            'у GitHub лимит 100 МБ на файл; положите ZIP в downloads/ через git.'
        })
      ])
    );

    sections.push(el('section', { className: 'editor-section' }, [el('h2', { text: 'Оформление' }), faBgField(dotBase)]));

    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Медиа карточки' }),
        faMediaSection(id, dotBase, 'model', {
          kind: 'model',
          preview: 'file',
          toggleLabel: '3D-превью (вращающаяся модель)',
          zoneLabel: 'GLB-файл 3D-превью',
          hint: 'Только GLB · до 15 МБ (жёсткий предел 50 МБ) · файл получит новое имя вида ' + id + '-xxxxxxxx.glb',
          offHint: '3D-превью выключено (model: null) — карточка покажет постер или фон.',
          resolveValue: (b) => './assets/models/free/' + b + '.glb'
        }, rerender),
        faMediaSection(id, dotBase, 'thumb', {
          kind: 'faThumb',
          preview: 'image',
          toggleLabel: 'Постер (SVG-картинка карточки)',
          zoneLabel: 'SVG-постер карточки',
          hint:
            'Только SVG — сайт жёстко подставляет расширение .svg · до 200 КБ · ' +
            'файл получит новое имя вида ' + id + '-xxxxxxxx.svg',
          offHint: 'Постер выключен (thumb: null) — до загрузки 3D карточка покажет только фон.',
          resolveValue: (b) => './assets/cards/' + b + '.svg'
        }, rerender)
      ])
    );

    els.app.replaceChildren(
      el('section', {}, [
        el('a', { className: 'back-link', href: '#/free-assets', text: '← К каталогу Free Assets' }),
        el('div', { className: 'view-head' }, [
          el('h1', { text: found.item.title }),
          el('span', { className: 'view-head__hint', text: id + ' · категория ' + found.category.key })
        ]),
        el('p', {
          className: 'hint',
          text: 'Нажмите «Предпросмотр» вверху — каталог соберётся с черновиком (видимость, порядок, тексты). Замена 3D-превью и постеров видна только после публикации.'
        }),
        el('div', {}, sections)
      ])
    );
  }

  /* ── редактор кейса ──────────────────────────────────────────────── */

  function readOnlyTech(label, value, hint) {
    return el('div', {}, [
      el('label', { text: label }),
      el('input', {
        type: 'text',
        value,
        disabled: true,
        title: hint || 'Поле управляется генератором и пока не редактируется'
      })
    ]);
  }

  // F5: строгий enum-<select> для motion-полей (layout/playback), редактируемых
  // владельцем. data-field позволяет inline-ошибке валидатора привязаться к полю.
  function enumSelect(path, dotBase, field, current, fallback, options) {
    const select = el('select', { 'data-field': path + '::' + dotBase + '.' + field },
      options.map((o) => el('option', { value: o.value, text: o.text })));
    // Легаси/ручной out-of-enum значение: добавляем его опцией, чтобы <select> не
    // показывал молча первый вариант (UI-vs-state ложь) — владелец видит реальное
    // значение, валидатор его пометит. На чистом контенте эта ветка спит.
    if (current && !options.some((o) => o.value === current)) {
      select.appendChild(el('option', { value: current, text: current + ' — недопустимо' }));
    }
    select.value = current || fallback;
    select.addEventListener('change', () => {
      State.setValue(path, dotBase + '.' + field, select.value);
      clearFieldError(select);
    });
    return el('div', {}, [el('label', { text: field }), select]);
  }

  /* ── motion-блок: источник local/vimeo, файлы, Vimeo ID ──────────── */

  function vimeoIdField(path, dotBase) {
    const wrap = el('div', {});
    const input = el('input', { type: 'text', 'data-field': path + '::' + dotBase + '.vimeoId' });
    const confirmLine = el('p', { className: 'vimeo-confirm', hidden: true });
    const current = State.getValue(path, dotBase + '.vimeoId');
    input.value = current === undefined || current === null ? '' : String(current);

    function showParsed(raw) {
      const parsed = State.parseVimeoId(raw);
      const hash = State.parseVimeoHash(raw);
      if (!raw.trim()) {
        confirmLine.hidden = true;
        return parsed;
      }
      confirmLine.hidden = false;
      if (parsed) {
        confirmLine.classList.remove('vimeo-confirm--bad');
        confirmLine.textContent = 'Распознан ID: ' + parsed + (hash ? ' · приватный hash: ' + hash : '');
      } else {
        confirmLine.classList.add('vimeo-confirm--bad');
        confirmLine.textContent = 'Не похоже на Vimeo ID или ссылку vimeo.com';
      }
      return parsed;
    }

    input.addEventListener('input', () => {
      const raw = input.value;
      const parsed = showParsed(raw);
      State.setValue(path, dotBase + '.vimeoId', parsed || raw.trim());
      // F5: приватный hash (unlisted) пишем/чистим ТОЛЬКО при вводе URL vimeo.com.
      // Ввод голого ID hash НЕ трогает: опечатка в цифрах не должна безвозвратно
      // терять hash. Смена источника на local чистит hash (см. sourceSelect). Это
      // оставляет узкий край (другой unlisted-ролик голым ID сохранит старый hash),
      // но unlisted всегда вставляют ПОЛНОЙ ссылкой vimeo.com/<id>/<hash>, где
      // ветка ниже корректно переустановит/снимет hash.
      if (/vimeo\.com/i.test(raw)) {
        const hash = State.parseVimeoHash(raw);
        if (hash) State.setValue(path, dotBase + '.vimeoHash', hash);
        else if (State.getValue(path, dotBase + '.vimeoHash')) State.deleteValue(path, dotBase + '.vimeoHash');
      }
      clearFieldError(input);
    });
    showParsed(input.value);

    wrap.appendChild(el('label', { text: 'Vimeo — ссылка на ролик или ID' }));
    wrap.appendChild(input);
    wrap.appendChild(confirmLine);
    wrap.appendChild(
      el('p', { className: 'hint', text: 'Подойдёт любая ссылка vimeo.com или цифровой ID. Для unlisted-ролика вставьте полную ссылку vimeo.com/<id>/<hash> — приватный hash распознается автоматически.' })
    );
    return wrap;
  }

  function motionBlockEditor(path, id, i) {
    const dotBase = 'case.motionBlocks.' + i;
    const container = el('div', { className: 'motion-block' });

    function renderBlock() {
      const block = State.getValue(path, dotBase) || {};
      container.replaceChildren();

      const sourceSelect = el('select', { 'data-field': path + '::' + dotBase + '.source' }, [
        el('option', { value: 'local', text: 'local — .webm из репозитория' }),
        el('option', { value: 'vimeo', text: 'vimeo — ролик на Vimeo' })
      ]);
      sourceSelect.value = block.source === 'vimeo' ? 'vimeo' : 'local';
      sourceSelect.addEventListener('change', () => {
        State.setValue(path, dotBase + '.source', sourceSelect.value);
        // F5: блок либо local, либо vimeo. Чистим поля ДРУГОГО источника, чтобы
        // приватный Vimeo hash/ID не утёк в публичный cards-data на local-блоке
        // (оба валидатора проверяют vimeoHash только в ветке source==='vimeo' —
        // без чистки stale hash прошёл бы), а мёртвый src не висел на vimeo-блоке.
        if (sourceSelect.value === 'local') {
          if (State.getValue(path, dotBase + '.vimeoId') !== undefined) State.deleteValue(path, dotBase + '.vimeoId');
          if (State.getValue(path, dotBase + '.vimeoHash') !== undefined) State.deleteValue(path, dotBase + '.vimeoHash');
        } else if (State.getValue(path, dotBase + '.src') !== undefined) {
          State.deleteValue(path, dotBase + '.src');
        }
        renderBlock();
      });

      const tech = el('div', { className: 'motion-block__tech' }, [
        el('div', {}, [el('label', { text: 'source' }), sourceSelect]),
        enumSelect(path, dotBase, 'layout', block.layout, 'wide', [
          { value: 'wide', text: 'wide — широкий ряд' },
          { value: 'half', text: 'half — половина ряда' }
        ]),
        enumSelect(path, dotBase, 'playback', block.playback, 'ambient', [
          { value: 'ambient', text: 'ambient — фон без управления' },
          { value: 'controlled', text: 'controlled — кнопка play/pause' }
        ])
      ]);
      if (block.title) {
        tech.appendChild(readOnlyTech('title', block.title, 'Технический заголовок Vimeo-плеера'));
      }
      container.appendChild(tech);

      if (block.source === 'vimeo') {
        container.appendChild(vimeoIdField(path, dotBase));
      } else {
        container.appendChild(
          dropZone({
            filePath: path,
            dotPath: dotBase + '.src',
            kind: 'video',
            namingPath: block.src || './assets/cases/' + id + '/motion-0' + (i + 1) + '.webm',
            currentPath: block.src || null,
            preview: 'video',
            label: 'видеофайл (.webm)',
            hint: 'Только WebM · до 20 МБ (жёсткий предел 40 МБ — тяжёлые ролики лучше на Vimeo)'
          })
        );
      }

      container.appendChild(
        dropZone({
          filePath: path,
          dotPath: dotBase + '.poster',
          kind: 'image',
          namingPath: block.poster || './assets/cases/' + id + '/poster-0' + (i + 1) + '.png',
          currentPath: block.poster || null,
          preview: 'image',
          label: 'постер (показывается до запуска видео)',
          hint: 'SVG, PNG, JPG или WebP · до 200 КБ'
        })
      );

      container.appendChild(
        pairField(path, 'Блок ' + (i + 1) + ' — подпись', dotBase + '.label.en', dotBase + '.label.ru')
      );
      container.appendChild(
        pairField(path, 'Блок ' + (i + 1) + ' — описание', dotBase + '.desc.en', dotBase + '.desc.ru', {
          multiline: true
        })
      );
      applyPendingErrors();
    }

    renderBlock();
    return container;
  }

  async function renderCaseEditor(id) {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем кейс с GitHub…' }));
    const path = 'content/cases/' + id + '.json';
    const entry = await State.ensureFile(path);
    const draft = entry.draft;
    const sections = [];

    // Итерация F: режим порядка блоков. Перерисовка редактора после
    // перестановок/переключения режима (черновик — источник истины).
    const manualLayout = State.getValue(path, 'layoutMode') === 'manual';
    function rerender(focusKey) {
      const y = window.scrollY;
      renderCaseEditor(id).then(() => {
        window.scrollTo(0, y);
        focusReorder(focusKey);
      });
    }

    // Перестановка слота иллюстраций: src/фон/подпись переезжают вместе.
    // Дефолтный src зависит от ПОЗИЦИИ (./assets/cases/<id>/0N.svg), поэтому
    // prod-review F2 (D-09): i18nOverrides адресуются структурными
    // индексами (captions.N, motionBlocks.N) и при перестановке слотов
    // уезжали бы на чужие блоки МОЛЧА (verify это не ловит). Пока
    // безопасный вариант — блокировать reorder у кейсов с индексными
    // overrides; миграция overrides по стабильному id — отдельная задача.
    var NUMERIC_KEY_RE = new RegExp('^[0-9]+$');
    function hasIndexedOverrides(node) {
      if (node === null || typeof node !== 'object') return false;
      return Object.keys(node).some(function (key) {
        return NUMERIC_KEY_RE.test(key) || hasIndexedOverrides(node[key]);
      });
    }

    function reorderBlockedByOverrides() {
      if (!hasIndexedOverrides(State.getValue(path, 'i18nOverrides'))) return false;
      toast(
        'Перестановка недоступна: у кейса есть i18nOverrides, привязанные к номерам слотов. ' +
          'Перенесите их вручную в репозитории и повторите.',
        'error'
      );
      return true;
    }

    // перед перестановкой эффективные src фиксируются явными путями.
    function moveMediaSlot(from, to, focusKey) {
      if (from === to || to < 0 || to > 4) return;
      if (reorderBlockedByOverrides()) return;
      const cs = State.getValue(path, 'case') || {};
      const srcs = [];
      for (let i = 0; i < 5; i += 1) {
        const current = Array.isArray(cs.srcs) ? cs.srcs[i] : null;
        srcs.push(current || './assets/cases/' + id + '/0' + (i + 1) + '.svg');
      }
      State.setValue(path, 'case.srcs', movedArray(srcs, from, to));
      State.setValue(path, 'case.palette', movedArray(cs.palette, from, to));
      State.setValue(path, 'case.captions', movedArray(cs.captions, from, to));
      remapListIndex(path, /^case\.srcs\.(\d+)$/, 1, from, to, (_match, newIndex) => 'case.srcs.' + newIndex);
      toast('Порядок сохранён в черновик', 'info');
      rerender(focusKey);
    }

    function moveMotionBlock(from, to, focusKey) {
      const blocks = State.getValue(path, 'case.motionBlocks') || [];
      if (from === to || to < 0 || to >= blocks.length) return;
      if (reorderBlockedByOverrides()) return;
      State.setValue(path, 'case.motionBlocks', movedArray(blocks, from, to));
      remapListIndex(
        path,
        /^case\.motionBlocks\.(\d+)\.(.+)$/,
        1,
        from,
        to,
        (match, newIndex) => 'case.motionBlocks.' + newIndex + '.' + match[2]
      );
      toast('Порядок сохранён в черновик', 'info');
      rerender(focusKey);
    }

    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Карточка в списке работ' }),
        dropZone({
          filePath: path,
          dotPath: 'card.thumb',
          kind: 'image',
          namingPath: './assets/cards/' + id + '.svg',
          currentPath: draft.card.thumb,
          preview: 'image',
          label: 'миниатюра карточки',
          hint: 'SVG, PNG, JPG или WebP · 800×600 (4:3) · до 200 КБ'
        }),
        pairField(path, 'Заголовок', 'card.title.en', 'card.title.ru'),
        pairField(path, 'Описание', 'card.desc.en', 'card.desc.ru', { multiline: true }),
        pairField(path, 'Alt-текст изображения', 'card.alt.en', 'card.alt.ru')
      ])
    );

    const toolsInput = el('input', { type: 'text', 'data-field': path + '::case.tools' });
    toolsInput.value = (draft.case.tools || []).join(', ');
    toolsInput.addEventListener('input', () => {
      State.setValue(
        path,
        'case.tools',
        toolsInput.value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      );
      clearFieldError(toolsInput);
    });
    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'О проекте' }),
        pairField(path, 'Роль', 'case.role.en', 'case.role.ru'),
        el('div', { className: 'pair' }, [
          el('div', { className: 'pair__label', text: 'Инструменты (через запятую)' }),
          el('div', { className: 'pair__col' }, [toolsInput])
        ])
      ])
    );

    // Итерация F: режим порядка блоков (seeded — автоматическая раскладка,
    // manual — авторский порядок списков ниже).
    const layoutSection = el('section', { className: 'editor-section', id: 'layout-section' }, [
      el('h2', { text: 'Порядок блоков' })
    ]);
    if (!manualLayout) {
      layoutSection.appendChild(
        el('p', {
          className: 'hint',
          text:
            'Порядок подбирается автоматически (фиксированная раскладка по id). ' +
            'Включите ручной порядок, чтобы расставить блоки самим.'
        })
      );
      const manualBtn = el('button', { type: 'button', className: 'btn', id: 'layout-manual-btn' }, [
        'Включить ручной порядок'
      ]);
      manualBtn.addEventListener('click', () => {
        State.setValue(path, 'layoutMode', 'manual');
        toast(
          'Ручной порядок включён. Стартовый порядок — авторский порядок файлов кейса: ' +
            'он может отличаться от того, что показывала автоматическая раскладка.',
          'info'
        );
        rerender();
      });
      layoutSection.appendChild(manualBtn);
    } else {
      layoutSection.appendChild(
        el('p', {
          className: 'hint',
          text:
            'Ручной порядок включён: иллюстрации и motion-блоки идут в порядке списков ниже. ' +
            'Стартовый порядок — авторский порядок файлов кейса; он может отличаться от того, ' +
            'что показывала автоматическая раскладка. Широкие и высокие блоки сайт ' +
            'по-прежнему расставляет по своей сетке. Ряды при этом идут как два высоких ряда, ' +
            'затем два широких подряд — правило чередования автоматической раскладки не применяется.'
        })
      );
      const seededBtn = el('button', { type: 'button', className: 'btn btn--ghost', id: 'layout-seeded-btn' }, [
        'Вернуть автоматический порядок'
      ]);
      seededBtn.addEventListener('click', () => {
        State.setValue(path, 'layoutMode', 'seeded');
        toast('Автоматический порядок возвращён — раскладка снова подбирается по id кейса.', 'info');
        rerender();
      });
      layoutSection.appendChild(seededBtn);
    }
    sections.push(layoutSection);

    const mediaStrip = el('div', { className: 'media-strip', id: 'media-strip' });
    for (let i = 0; i < 5; i += 1) {
      const defaultSrc = './assets/cases/' + id + '/0' + (i + 1) + '.svg';
      const effectiveSrc = (draft.case.srcs && draft.case.srcs[i]) || defaultSrc;
      mediaStrip.appendChild(
        el('figure', { className: 'media-slot' }, [
          manualLayout
            ? reorderControls({
                label: 'Слот ' + (i + 1),
                index: i,
                count: 5,
                focusKey: 'slot::' + i,
                onMove: moveMediaSlot
              })
            : null,
          dropZone({
            filePath: path,
            dotPath: 'case.srcs.' + i,
            kind: 'image',
            namingPath: defaultSrc,
            currentPath: effectiveSrc,
            preview: 'image'
          }),
          el('figcaption', { text: 'Слот ' + (i + 1) + ' · ' + SLOT_FORMATS[i] })
        ])
      );
    }
    if (manualLayout) makeSortable(mediaStrip, '.media-slot', moveMediaSlot);
    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Иллюстрации кейса' }),
        mediaStrip,
        el('p', {
          className: 'hint',
          text:
            'SVG, PNG, JPG или WebP · до 200 КБ на изображение. Подписи к слотам редактируются ниже.' +
            (manualLayout
              ? ' При перестановке слотов подпись и фон переезжают вместе с изображением; формат слота (широкий/высокий) задаётся позицией.'
              : '')
        })
      ])
    );

    if (Array.isArray(draft.case.captions)) {
      const captionSection = el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Подписи к медиа-слотам' })
      ]);
      draft.case.captions.forEach((_caption, i) => {
        const base = 'case.captions.' + i;
        captionSection.appendChild(
          pairField(path, 'Слот ' + (i + 1) + ' — заголовок', base + '.label.en', base + '.label.ru')
        );
        captionSection.appendChild(
          pairField(path, 'Слот ' + (i + 1) + ' — описание', base + '.desc.en', base + '.desc.ru', { multiline: true })
        );
      });
      sections.push(captionSection);
    }

    if (draft.case.text) {
      sections.push(
        el('section', { className: 'editor-section' }, [
          el('h2', { text: 'Текстовый блок' }),
          pairField(path, 'Заголовок', 'case.text.title.en', 'case.text.title.ru'),
          pairField(path, 'Текст', 'case.text.body.en', 'case.text.body.ru', { multiline: true })
        ])
      );
    }

    if (draft.case.inline) {
      sections.push(
        el('section', { className: 'editor-section' }, [
          el('h2', { text: 'Инлайн-блок' }),
          pairField(path, 'Заголовок', 'case.inline.title.en', 'case.inline.title.ru'),
          pairField(path, 'Текст', 'case.inline.body.en', 'case.inline.body.ru', { multiline: true })
        ])
      );
    }

    const modelSection = el('section', { className: 'editor-section' }, [
      el('h2', { text: '3D-модель' }),
      dropZone({
        filePath: path,
        dotPath: 'case.modelSrc',
        kind: 'model',
        namingPath: draft.case.modelSrc,
        currentPath: draft.case.modelSrc,
        preview: 'file',
        label: 'GLB-файл для 3D-viewer',
        hint: 'Только GLB · до 15 МБ (жёсткий предел 50 МБ)'
      })
    ]);
    const modelTech = el('div', { className: 'motion-block__tech' });
    if ('modelEnvironment' in draft.case) {
      modelTech.appendChild(
        readOnlyTech('modelEnvironment', String(draft.case.modelEnvironment), 'Настройка 3D-viewer — не редактируется')
      );
    }
    if ('modelExposure' in draft.case) {
      modelTech.appendChild(
        readOnlyTech('modelExposure', String(draft.case.modelExposure), 'Настройка 3D-viewer — не редактируется')
      );
    }
    if (modelTech.childNodes.length > 0) modelSection.appendChild(modelTech);
    if (draft.case.modelStats && typeof draft.case.modelStats === 'object') {
      const statsGrid = el('div', { className: 'model-stats' });
      for (const key of Object.keys(draft.case.modelStats)) {
        const dot = 'case.modelStats.' + key;
        const original = draft.case.modelStats[key];
        const input = el('input', { type: 'text', 'data-field': path + '::' + dot });
        input.value = original === undefined || original === null ? '' : String(original);
        input.addEventListener('input', () => {
          const raw = input.value;
          // Числовые значения (например materials: 4) сохраняем числами,
          // чтобы тип в JSON не дрейфовал от косметической правки.
          const next = typeof original === 'number' && /^\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw.trim()) : raw;
          State.setValue(path, dot, next);
          clearFieldError(input);
        });
        statsGrid.appendChild(el('div', {}, [el('label', { text: key }), input]));
      }
      modelSection.appendChild(el('p', { className: 'hint', text: 'Статистика модели (показывается в панели кейса):' }));
      modelSection.appendChild(statsGrid);
    }
    sections.push(modelSection);

    if (Array.isArray(draft.case.motionBlocks) && draft.case.motionBlocks.length > 0) {
      const motionCount = draft.case.motionBlocks.length;
      const motionList = el('div', { id: 'motion-list' });
      draft.case.motionBlocks.forEach((block, i) => {
        const wrap = el('div', { className: 'motion-block-wrap' });
        if (manualLayout) {
          wrap.appendChild(
            el('div', { className: 'motion-block-head' }, [
              reorderControls({
                label: 'Motion-блок ' + (i + 1),
                index: i,
                count: motionCount,
                focusKey: 'motion::' + i,
                onMove: moveMotionBlock
              }),
              el('span', {
                className: 'motion-block-head__title',
                text: 'Блок ' + (i + 1) + (block.label && block.label.en ? ' · ' + block.label.en : '')
              })
            ])
          );
        }
        wrap.appendChild(motionBlockEditor(path, id, i));
        motionList.appendChild(wrap);
      });
      if (manualLayout) makeSortable(motionList, '.motion-block-wrap', moveMotionBlock);
      const motionSection = el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Motion-блоки' }),
        motionList,
        el('p', {
          className: 'hint',
          text: 'Поля layout и playback управляются раскладкой сайта и не редактируются.'
        })
      ]);
      sections.push(motionSection);
    }

    els.app.replaceChildren(
      el('section', {}, [
        el('a', { className: 'back-link', href: '#/cases', text: '← К списку кейсов' }),
        el('div', { className: 'view-head' }, [
          el('h1', { text: draft.card.title.en }),
          el('span', { className: 'view-head__hint', text: id + '.json · ' + draft.category + ' · ' + draft.year })
        ]),
        el('div', {}, sections)
      ])
    );
  }

  /* ── мета-теги ───────────────────────────────────────────────────── */

  async function renderMetaEditor() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем content/meta.json с GitHub…' }));
    const path = 'content/meta.json';
    const entry = await State.ensureFile(path);
    const sections = [];
    for (const page of Object.keys(entry.draft.en)) {
      const section = el('section', { className: 'editor-section' }, [
        el('h2', { text: META_PAGE_LABELS[page] || page })
      ]);
      // Итерация E: OG-изображение страницы (og:image / twitter:image).
      const ogPath = entry.draft.ogImages && entry.draft.ogImages[page];
      if (ogPath) {
        section.appendChild(
          dropZone({
            filePath: path,
            dotPath: 'ogImages.' + page,
            kind: 'ogImage',
            namingPath: ogPath,
            currentPath: ogPath,
            preview: 'image',
            label: 'OG-изображение (превью в соцсетях)',
            hint: 'JPG, PNG или WebP · 1200×630 · до 200 КБ'
          })
        );
      }
      for (const key of Object.keys(entry.draft.en[page])) {
        const multiline = /description/i.test(key);
        section.appendChild(
          pairField(path, META_FIELD_LABELS[key] || key, 'en.' + page + '.' + key, 'ru.' + page + '.' + key, {
            multiline
          })
        );
      }
      sections.push(section);
    }
    // F5: логотип организации (Organization.logo / JSON-LD) — одна загрузка, вне
    // постраничного цикла (ogImages.orgLogo — единое поле, не per-page).
    const orgLogoPath = entry.draft.ogImages && entry.draft.ogImages.orgLogo;
    if (orgLogoPath) {
      sections.push(
        el('section', { className: 'editor-section' }, [
          el('h2', { text: 'Логотип организации' }),
          dropZone({
            filePath: path,
            dotPath: 'ogImages.orgLogo',
            kind: 'orgLogo',
            namingPath: orgLogoPath,
            currentPath: orgLogoPath,
            preview: 'image',
            label: 'Логотип (Organization.logo в JSON-LD)',
            hint: 'Квадратная брендовая иконка · JPG, PNG или WebP · до 200 КБ'
          })
        ])
      );
    }
    els.app.replaceChildren(
      el('section', {}, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Мета-теги' }),
          el('span', { className: 'view-head__hint', text: 'SEO и превью соцсетей · content/meta.json' })
        ]),
        el('div', {}, sections)
      ])
    );
  }

  /* ── тексты интерфейса ───────────────────────────────────────────── */

  function collectLeaves(node, prefix, out) {
    for (const key of Object.keys(node)) {
      const dot = prefix ? prefix + '.' + key : key;
      const child = node[key];
      if (child !== null && typeof child === 'object' && !Array.isArray(child)) collectLeaves(child, dot, out);
      else out.push(dot);
    }
  }

  async function renderUiEditor() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем content/i18n-ui.json с GitHub…' }));
    const path = 'content/i18n-ui.json';
    const entry = await State.ensureFile(path);
    const en = entry.draft.en;

    const groups = [];
    const rootLeaves = Object.keys(en).filter((key) => typeof en[key] !== 'object' || en[key] === null);
    if (rootLeaves.length > 0) groups.push({ label: 'Общие строки', leaves: rootLeaves });
    for (const key of Object.keys(en)) {
      if (typeof en[key] !== 'object' || en[key] === null) continue;
      const leaves = [];
      collectLeaves(en[key], key, leaves);
      groups.push({ label: UI_GROUP_LABELS[key] || key, leaves });
    }

    const sections = groups.map((group, index) => {
      const body = el('div', { className: 'ui-group__body' });
      for (const dot of group.leaves) {
        body.appendChild(pairField(path, dot, 'en.' + dot, 'ru.' + dot, { mono: true }));
      }
      return el('details', { className: 'ui-group', open: index === 0 }, [
        el('summary', {}, [group.label + ' ', el('span', { className: 'ui-group__count', text: 'строк: ' + group.leaves.length })]),
        body
      ]);
    });

    els.app.replaceChildren(
      el('section', {}, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Тексты интерфейса' }),
          el('span', { className: 'view-head__hint', text: 'кнопки, подсказки, ARIA · content/i18n-ui.json' })
        ]),
        el('div', {}, sections)
      ])
    );
  }

  /* ── публикация ──────────────────────────────────────────────────── */

  function openPublishDialog(changed, plan) {
    els.publishFiles.replaceChildren();
    for (const path of changed) {
      els.publishFiles.appendChild(el('li', {}, [State.describeChange(path) + ' — ', el('code', { text: path })]));
    }
    for (const binary of plan.binaries) {
      els.publishFiles.appendChild(el('li', {}, ['Новый файл — ', el('code', { text: binary.path })]));
    }
    els.publishDesc.value = State.defaultCommitDescription();
    els.dialog.showModal();
  }

  async function onPublishClick() {
    if (publishing) return;
    try {
      await State.ensureAllDrafts();
    } catch (error) {
      toast('Не удалось получить актуальные файлы с GitHub: ' + (error.message || error), 'error');
      return;
    }
    const errors = State.validateAll();
    // Итерация H (Fix #5): блокирующие ошибки медиа-слотов free-assets
    // («файла ещё нет в репозитории») останавливают публикацию наравне с
    // ошибками полей. Источник истины — НЕ in-memory faMediaErrors (он
    // не переживает reload: черновик восстанавливается из sessionStorage, а
    // карта ошибок — нет, и публикация уходила бы на сервер → checkAssetFile
    // в CI падал бы → авто-revert). Вместо этого перечень missing-файлов
    // пере-выводится из текущего состояния на КАЖДОЙ публикации
    // (State.findMissingFaMediaFiles) и сетевую HEAD-проверку мы awaitим
    // здесь — слот со staged-загрузкой проверку проходит (файл уйдёт в
    // коммит). faMediaErrors при этом синхронизируем, чтобы поля подсветились.
    let missingMedia;
    try {
      missingMedia = await State.findMissingFaMediaFiles((sitePath) =>
        fetch(toAdminAssetPath(sitePath), { method: 'HEAD' }).then((res) => res.ok)
      );
    } catch (error) {
      toast('Не удалось проверить файлы медиа: ' + (error.message || error), 'error');
      return;
    }
    faMediaErrors.clear();
    for (const slot of missingMedia) {
      const errorKey = slot.id + '::' + slot.key;
      const message =
        'Файла ' + slot.sitePath + ' ещё нет в репозитории — загрузите файл или выключите тогл, публикация заблокирована.';
      faMediaErrors.set(errorKey, message);
      const found = faFindItem(slot.id);
      const field = found
        ? 'categories.' + found.ci + '.items.' + found.ii + '.' + slot.key
        : 'categories';
      errors.push({ path: FA_PATH, field, message });
    }
    if (errors.length > 0) {
      // prod-review F2 (кросс-ревью): у части ошибок (year, palette,
      // cardOrder, structuredData, i18nOverrides — обычно следы ручной
      // правки репозитория) нет полей-якорей в UI, applyPendingErrors их
      // не отрисует. Первые сообщения показываем прямо в тосте, чтобы
      // блокировка публикации никогда не была безликим счётчиком.
      const preview = errors.slice(0, 3).map((e) => e.message).join(' • ');
      toast(
        'Публикация остановлена (ошибок: ' + errors.length + '): ' + preview + (errors.length > 3 ? ' …' : ''),
        'error'
      );
      pendingErrors = errors;
      const target = hashForPath(errors[0].path, errors[0].field);
      if (window.location.hash !== target) window.location.hash = target;
      else applyPendingErrors();
      return;
    }
    const changed = State.changedPaths();
    if (changed.length === 0) {
      toast('Нет изменений для публикации.', 'info');
      return;
    }
    try {
      publishPlan = await State.buildPublishPlan();
    } catch (error) {
      toast('Не удалось подготовить публикацию: ' + (error.message || error), 'error');
      return;
    }
    openPublishDialog(changed, publishPlan);
  }

  async function doPublish(description) {
    publishing = true;
    updateChrome();
    try {
      await State.publishPrecheck();
      const plan = publishPlan || (await State.buildPublishPlan());
      const message = 'content: ' + description + ' [admin]';
      const result = await API.publish(plan, message);
      State.markPublished();
      toast('Коммит создан. Конвейер проверяет контент и пересобирает сайт…', 'info');
      const outcome = await API.waitForPipeline(result.date);
      if (outcome.status === 'published') {
        toast('Опубликовано! Сайт обновится через ~2 минуты.', 'success');
      } else if (outcome.status === 'reverted') {
        toast('Изменения отклонены проверкой и откатены.', 'error', {
          href: outcome.url,
          label: 'Открыть детали в GitHub'
        });
      } else {
        toast('Проверка ещё не завершилась — статус смотрите в GitHub Actions.', 'warn', {
          href: outcome.url,
          label: 'Открыть GitHub Actions'
        });
      }
    } catch (error) {
      toast(error && error.message ? error.message : 'Не удалось опубликовать изменения.', 'error');
    } finally {
      publishPlan = null;
      publishing = false;
      updateChrome();
    }
  }

  /* ── маршрутизация ───────────────────────────────────────────────── */

  function renderError(error) {
    els.app.replaceChildren(
      el('p', { className: 'empty-note', text: 'Ошибка: ' + (error && error.message ? error.message : error) })
    );
  }

  async function route() {
    updateChrome();
    if (!API.getToken()) {
      renderLogin();
      return;
    }
    const hash = window.location.hash || '#/cases';
    const parts = hash.replace(/^#\/?/, '').split('/');
    try {
      if (parts[0] === 'case' && parts[1]) await renderCaseEditor(decodeURIComponent(parts[1]));
      else if (parts[0] === 'free-assets' && parts[1]) await renderFaItemEditor(decodeURIComponent(parts[1]));
      else if (parts[0] === 'free-assets') await renderFreeAssets();
      else if (parts[0] === 'categories') await renderCategories();
      else if (parts[0] === 'meta') await renderMetaEditor();
      else if (parts[0] === 'ui') await renderUiEditor();
      else await renderCases();
    } catch (error) {
      renderError(error);
    }
    setActiveNav(parts[0]);
    applyPendingErrors();
  }

  /* ── инициализация ───────────────────────────────────────────────── */

  els.publishBtn.addEventListener('click', onPublishClick);
  els.publishCancel.addEventListener('click', () => els.dialog.close());
  els.publishConfirm.addEventListener('click', async () => {
    const description = els.publishDesc.value.trim();
    if (!description) {
      els.publishDesc.classList.add('field-invalid');
      return;
    }
    els.publishDesc.classList.remove('field-invalid');
    els.dialog.close();
    await doPublish(description);
  });

  State.onChange(updateChrome);
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', (event) => {
    if (!State.isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  route();
})();
