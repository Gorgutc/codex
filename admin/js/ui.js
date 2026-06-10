/* ═══════════════════════════════════════════════════════════════════════
   ui.js — представления и маршрутизация админ-панели (итерация D).

   Экраны (hash-роутер, «одна задача — один экран»):
     #/login (без токена)  — вход: GitHub OAuth или PAT;
     #/cases               — список кейсов с поиском;
     #/case/<id>           — редактор текстов кейса (RU/EN бок о бок);
     #/meta                — мета-теги (content/meta.json);
     #/ui                  — тексты интерфейса (content/i18n-ui.json).

   Слоты будущих итераций видимы, но заблокированы с подсказкой «скоро»:
   drag-handle и выключатель кейса (итерация F), медиа и технические поля
   motion-блоков (итерация E).

   Зависимости: window.AdminAPI (api.js), window.AdminState (state.js).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = window.AdminAPI;
  const State = window.AdminState;

  const els = {
    topbar: document.getElementById('topbar'),
    app: document.getElementById('app'),
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

  function soonBadge(text) {
    return el('span', { className: 'badge badge--soon', text });
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

  /* ── ошибки валидации, привязанные к полям ───────────────────────── */

  function hashForPath(path) {
    if (path === 'content/meta.json') return '#/meta';
    if (path === 'content/i18n-ui.json') return '#/ui';
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

  /* ── список кейсов ───────────────────────────────────────────────── */

  function caseRow(item, labels) {
    const data = item.data;
    const path = 'content/cases/' + item.id + '.json';
    return el('li', { className: 'case-row' }, [
      el('span', {
        className: 'case-row__drag',
        title: 'Перестановка кейсов — скоро (итерация F)',
        'aria-hidden': 'true',
        text: '⠿'
      }),
      el('a', { className: 'case-row__link', href: '#/case/' + encodeURIComponent(item.id) }, [
        el('img', { className: 'case-row__thumb', src: '../assets/cards/' + item.id + '.svg', alt: '', loading: 'lazy' }),
        el('div', {}, [
          el('p', { className: 'case-row__title', text: data.card.title.en }),
          el('span', { className: 'case-row__id', text: item.id })
        ])
      ]),
      el('div', { className: 'case-row__meta' }, [
        State.hasDraft(path) ? el('span', { className: 'badge badge--draft', text: 'черновик' }) : null,
        el('span', { text: labels[data.category] || data.category }),
        el('span', { text: data.year }),
        el('span', { className: 'switch switch--disabled', title: 'Включение и выключение кейса — скоро (итерация F)' }, [
          el('input', {
            type: 'checkbox',
            checked: true,
            disabled: true,
            'aria-label': 'Кейс включён (управление появится в итерации F)'
          }),
          el('span', { className: 'switch__track', 'aria-hidden': 'true' })
        ])
      ])
    ]);
  }

  async function renderCases() {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загрузка списка кейсов…' }));
    const catalog = await State.loadCatalog();
    const labels = {};
    for (const filter of catalog.settings.filters) labels[filter.key] = filter.label;

    const search = el('input', {
      className: 'input cases__search',
      id: 'case-search',
      type: 'search',
      placeholder: 'Поиск: название, категория, id'
    });
    const list = el('ul', { className: 'case-list', id: 'case-list' });

    function renderRows() {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      let shown = 0;
      for (const item of catalog.cases) {
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
        if (query && hay.indexOf(query) === -1) continue;
        shown += 1;
        list.appendChild(caseRow(item, labels));
      }
      if (shown === 0) list.appendChild(el('li', { className: 'empty-note', text: 'Ничего не найдено' }));
    }

    search.addEventListener('input', renderRows);
    renderRows();

    els.app.replaceChildren(
      el('section', { className: 'cases' }, [
        el('div', { className: 'view-head' }, [
          el('h1', { text: 'Кейсы' }),
          el('span', { className: 'view-head__hint', text: 'всего: ' + catalog.cases.length }),
          search
        ]),
        list
      ])
    );
  }

  /* ── редактор кейса ──────────────────────────────────────────────── */

  function toAdminAssetPath(sitePath) {
    return String(sitePath).replace(/^\.\//, '../');
  }

  function readOnlyTech(label, value) {
    return el('div', {}, [
      el('label', { text: label }),
      el('input', { type: 'text', value, disabled: true, title: 'Изменение медиа — скоро (итерация E)' })
    ]);
  }

  async function renderCaseEditor(id) {
    els.app.replaceChildren(el('p', { className: 'empty-note', text: 'Загружаем кейс с GitHub…' }));
    const path = 'content/cases/' + id + '.json';
    const entry = await State.ensureFile(path);
    const draft = entry.draft;
    const sections = [];

    sections.push(
      el('section', { className: 'editor-section' }, [
        el('h2', { text: 'Карточка в списке работ' }),
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

    const mediaStrip = el('div', { className: 'media-strip' });
    for (let i = 0; i < 5; i += 1) {
      const src = (draft.case.srcs && draft.case.srcs[i]) || './assets/cases/' + id + '/0' + (i + 1) + '.svg';
      mediaStrip.appendChild(
        el('figure', { className: 'media-slot' }, [
          el('img', { src: toAdminAssetPath(src), alt: '', loading: 'lazy' }),
          el('figcaption', { text: 'Слот ' + (i + 1) })
        ])
      );
    }
    sections.push(
      el('section', { className: 'editor-section editor-section--locked' }, [
        el('h2', {}, ['Медиа кейса ', soonBadge('скоро — итерация E')]),
        mediaStrip,
        el('p', {
          className: 'hint',
          text: 'Замена изображений, видео и 3D-модели появится в итерации E. Подписи к слотам редактируются ниже.'
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

    if (Array.isArray(draft.case.motionBlocks) && draft.case.motionBlocks.length > 0) {
      const motionSection = el('section', { className: 'editor-section' }, [
        el('h2', {}, ['Motion-блоки ', soonBadge('медиа — итерация E')])
      ]);
      draft.case.motionBlocks.forEach((block, i) => {
        const base = 'case.motionBlocks.' + i;
        const tech = el('div', { className: 'motion-block__tech' }, [
          readOnlyTech('source', block.source || ''),
          readOnlyTech('layout', block.layout || ''),
          readOnlyTech('playback', block.playback || '')
        ]);
        if (block.src) tech.appendChild(readOnlyTech('src', block.src));
        if (block.vimeoId) tech.appendChild(readOnlyTech('vimeoId', block.vimeoId));
        if (block.poster) tech.appendChild(readOnlyTech('poster', block.poster));
        if (block.title) tech.appendChild(readOnlyTech('title', block.title));
        motionSection.appendChild(
          el('div', { className: 'motion-block' }, [
            tech,
            pairField(path, 'Блок ' + (i + 1) + ' — подпись', base + '.label.en', base + '.label.ru'),
            pairField(path, 'Блок ' + (i + 1) + ' — описание', base + '.desc.en', base + '.desc.ru', {
              multiline: true
            })
          ])
        );
      });
      sections.push(motionSection);
    }

    sections.push(
      el('p', { className: 'hint', text: 'Перестановка блоков кейса местами появится в итерации F.' })
    );

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

  function openPublishDialog(changed) {
    els.publishFiles.replaceChildren();
    for (const path of changed) {
      els.publishFiles.appendChild(el('li', {}, [State.describeChange(path) + ' — ', el('code', { text: path })]));
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
    if (errors.length > 0) {
      toast('Публикация остановлена: заполните обязательные поля (ошибок: ' + errors.length + ').', 'error');
      pendingErrors = errors;
      const target = hashForPath(errors[0].path);
      if (window.location.hash !== target) window.location.hash = target;
      else applyPendingErrors();
      return;
    }
    const changed = State.changedPaths();
    if (changed.length === 0) {
      toast('Нет изменений для публикации.', 'info');
      return;
    }
    openPublishDialog(changed);
  }

  async function doPublish(description) {
    publishing = true;
    updateChrome();
    try {
      await State.publishPrecheck();
      const files = State.buildCommitFiles();
      const message = 'content: ' + description + ' [admin]';
      const result = await API.publish(files, message);
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
