/* ═══════════════════════════════════════════════════════════════════════
   api.js — GitHub-клиент админ-панели (итерация D).

   Отвечает за:
     • сессию (токен + пользователь в sessionStorage — только на вкладку);
     • вход: GitHub OAuth popup (/.netlify/functions/cms-auth) или PAT;
     • чтение файлов через Contents API (источник истины перед правкой);
     • публикацию: ОДИН atomic-коммит в main через Git Data API
       (blobs → tree → commit → update ref, без force);
     • ожидание вердикта конвейера content-publish (итерация C):
       bot-коммит с маркером [content-publish] = успех,
       [content-publish-revert] = откат.

   API: window.AdminAPI. Classic script, подключается ПЕРВЫМ.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const OWNER = 'Gorgutc';
  const REPO = 'codex';
  const BRANCH = 'main';
  const API_BASE = 'https://api.github.com';
  const REPO_BASE = '/repos/' + OWNER + '/' + REPO;
  const ACTIONS_URL = 'https://github.com/' + OWNER + '/' + REPO + '/actions/workflows/content-publish.yml';
  const TOKEN_KEY = 'codexAdminToken';
  const USER_KEY = 'codexAdminUser';

  /* ── сессия ──────────────────────────────────────────────────────── */

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (_e) {
      return '';
    }
  }

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch (_e) {
      return null;
    }
  }

  function setSession(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  /* ── базовый fetch к GitHub REST ─────────────────────────────────── */

  async function api(path, options) {
    const opts = options || {};
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    const token = opts.token !== undefined ? opts.token : getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const init = { method: opts.method || 'GET', headers };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API_BASE + path, init);
    if (!res.ok) {
      const error = new Error('GitHub API: ' + res.status + ' (' + path.split('?')[0] + ')');
      error.status = res.status;
      try {
        error.payload = await res.json();
      } catch (_e) {
        /* тело может отсутствовать */
      }
      throw error;
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /* ── base64 для UTF-8 содержимого ────────────────────────────────── */

  function bytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function encodeContent(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function decodeContent(base64) {
    const binary = atob(String(base64).replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /* ── вход ────────────────────────────────────────────────────────── */

  // Проверка токена: GET /user + проба доступа к репозиторию.
  async function validateToken(token) {
    let user;
    try {
      user = await api('/user', { token });
    } catch (error) {
      throw new Error('GitHub не принял токен (код ' + (error.status || 'сети') + '). Проверьте токен.', {
        cause: error
      });
    }
    let repo;
    try {
      repo = await api(REPO_BASE, { token });
    } catch (error) {
      throw new Error('Нет доступа к репозиторию ' + OWNER + '/' + REPO + ' (код ' + (error.status || 'сети') + ').', {
        cause: error
      });
    }
    if (!repo.permissions || repo.permissions.push !== true) {
      throw new Error(
        'Токену не хватает прав на запись в ' + OWNER + '/' + REPO + ' — нужен доступ «Contents: Read and write».'
      );
    }
    return { login: user.login, avatarUrl: user.avatar_url || '' };
  }

  /* Доступен ли OAuth-контур на этом хостинге.
     Панель раздаётся и с Netlify (функции есть), и с Beget (статика — функций
     нет, и «Войти через GitHub» открывает popup с 404). Вход по PAT штатный и
     задокументирован, поэтому на статике кнопку просто не показываем.

     Проба: GET без параметров. На Netlify функция отвечает 302 на github.com —
     с redirect:'manual' fetch отдаёт opaqueredirect (status 0) и НИКУДА не
     ходит, OAuth-флоу не стартует. Если секреты не заданы, функция отдаёт 400 —
     контур всё равно есть, кнопка нужна (владелец увидит внятную ошибку).
     На статике — 404. Правило: недоступен ТОЛЬКО при явном 404.
     Fail-open: сетевая ошибка оставляет кнопку (не ломаем Netlify-контур). */
  const OAUTH_FUNCTION_PATH = '/.netlify/functions/cms-auth';

  async function probeOAuthAvailable() {
    try {
      const res = await fetch(OAUTH_FUNCTION_PATH, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store'
      });
      return res.status !== 404;
    } catch (_e) {
      return true;
    }
  }

  // OAuth web flow через Netlify Function: popup → postMessage с токеном.
  function loginWithGitHub() {
    return new Promise((resolve, reject) => {
      const popup = window.open('/.netlify/functions/cms-auth', 'codex-admin-oauth', 'width=920,height=720');
      if (!popup) {
        reject(new Error('Браузер заблокировал всплывающее окно — разрешите pop-up для этого сайта.'));
        return;
      }
      let settled = false;
      let timer = 0;
      function finish(fn, value) {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(timer);
        fn(value);
      }
      function onMessage(event) {
        // Origin-check: токен принимаем только от собственного origin
        // (страница-результат функции живёт на том же домене).
        if (event.origin !== window.location.origin) return;
        if (event.source !== popup) return;
        const data = event.data;
        if (!data || data.type !== 'codex-admin-oauth') return;
        if (data.token) finish(resolve, data.token);
        else finish(reject, new Error(data.error || 'GitHub не вернул токен.'));
      }
      window.addEventListener('message', onMessage);
      timer = setInterval(() => {
        if (popup.closed) finish(reject, new Error('Окно входа закрыто до завершения авторизации.'));
      }, 400);
    });
  }

  /* ── Contents API: свежий файл + sha (источник истины) ──────────── */

  async function fetchFile(path, ref) {
    const resolvedRef = ref === undefined || ref === null ? BRANCH : ref;
    if (resolvedRef !== BRANCH && !/^[0-9a-f]{40}$/.test(resolvedRef)) {
      throw new Error('Для чтения publication recovery нужен main или полный SHA коммита.');
    }
    const data = await api(REPO_BASE + '/contents/' + path + '?ref=' + encodeURIComponent(resolvedRef));
    if (!data || data.type !== 'file' || data.encoding !== 'base64') {
      throw new Error('Неожиданный ответ GitHub Contents API для ' + path);
    }
    return { path, sha: data.sha, text: decodeContent(data.content), ref: resolvedRef };
  }

  /* ── публикация: один atomic-коммит в main ───────────────────────── */

  // payload (итерация E):
  //   { files:     [{ path, content }]  — текстовые файлы (content/*.json),
  //     binaries:  [{ path, bytes }]    — загруженные медиа (Uint8Array →
  //                                       base64-blob, кодирование чанками
  //                                       в bytesToBase64 — без лимита стека),
  //     deletions: [path]               — удаления (tree-entry с sha: null).
  //                                       Возможность сохранена, но админка
  //                                       СОЗНАТЕЛЬНО не передаёт deletions:
  //                                       admin-коммит деплоится на прод сразу,
  //                                       а страницы, ссылающиеся на старый
  //                                       файл, пересоберёт только bot-коммит
  //                                       конвейера минутами позже — удаление
  //                                       открыло бы окно 404 }
  // Для совместимости принимается и старый формат — просто массив files.
  //
  // Слайс B (TOCTOU): каждый текстовый файл плана несёт expectedSha — sha блоба,
  // от которого редактировали (publishPrecheck обновляет его прямо перед
  // сборкой плана). Между precheck'ом и созданием дерева main мог уехать:
  // второй админ, ручной коммит или bot-коммит конвейера. base_tree новый
  // коммит берёт от head, поэтому наш блоб МОЛЧА затёр бы чужую правку —
  // ref-update при этом остался бы fast-forward и не сработал бы. Поэтому
  // сверяем sha на head ДО создания хоть одного блоба и отказываемся без
  // коммита; заслон non-fast-forward ниже остаётся вторым рубежом.
  // sha блоба по пути на КОНКРЕТНОМ коммите. 404 — это ответ («файла нет»),
  // а не сбой: их надо различать, иначе оборванная сеть диагностируется как
  // «файл изменился» и владелец идёт чинить несуществующую гонку.
  async function blobShaAt(path, headSha) {
    try {
      const data = await api(REPO_BASE + '/contents/' + path + '?ref=' + headSha);
      return { known: true, sha: (data && data.sha) || null };
    } catch (error) {
      if (error && error.status === 404) return { known: true, sha: null };
      return { known: false, error };
    }
  }

  function staleError(message) {
    const stale = new Error(message);
    stale.code = 'stale-blob';
    return stale;
  }

  async function assertPlanFresh(files, binaries, headSha) {
    for (const file of files) {
      if (!file.expectedSha) continue;
      const actual = await blobShaAt(file.path, headSha);
      if (!actual.known) {
        const failed = new Error(
          'Не удалось проверить состояние ' + file.path + ' на сервере — публикация отменена, повторите попытку.'
        );
        failed.code = 'precheck-unavailable';
        throw failed;
      }
      if (actual.sha !== file.expectedSha) {
        throw staleError('Файл ' + file.path + ' изменился на сервере — обновите страницу.');
      }
    }
    for (const binary of binaries) {
      if (!binary.expectedAbsent) continue;
      const actual = await blobShaAt(binary.path, headSha);
      if (!actual.known) {
        const failed = new Error(
          'Не удалось проверить состояние ' + binary.path + ' на сервере — публикация отменена, повторите попытку.'
        );
        failed.code = 'precheck-unavailable';
        throw failed;
      }
      if (actual.sha !== null) {
        throw staleError('Медиафайл ' + binary.path + ' уже существует на сервере — обновите страницу.');
      }
    }
  }

  async function candidateReachability(candidate, options) {
    const ref = await api(REPO_BASE + '/git/ref/heads/' + BRANCH);
    const head = ref && ref.object && ref.object.sha;
    if (head === candidate.sha)
      return { status: 'confirmed_source', sha: candidate.sha, date: candidate.date, url: candidate.url || null };
    // A ref can have advanced after our successful PATCH. Walk authoritative
    // first-parent history rather than treating only exact head equality as
    // proof; a candidate ancestor is a committed source too.
    for (let page = 1; page <= 100; page += 1) {
      const commits = await api(REPO_BASE + '/commits?sha=' + BRANCH + '&per_page=100&page=' + page);
      if (!Array.isArray(commits)) throw new Error('GitHub вернул некорректную историю main.');
      if (commits.some((item) => item && item.sha === candidate.sha)) {
        return { status: 'confirmed_source', sha: candidate.sha, date: candidate.date, url: candidate.url || null };
      }
      if (commits.length < 100) break;
    }
    if (options && options.authoritativeRejection) return { status: 'definite_not_submitted' };
    return { status: 'unknown' };
  }

  async function publish(payload, message, options) {
    const plan = Array.isArray(payload) ? { files: payload } : payload || {};
    const files = plan.files || [];
    const binaries = plan.binaries || [];
    const deletions = plan.deletions || [];

    const ref = await api(REPO_BASE + '/git/ref/heads/' + BRANCH);
    const headSha = ref.object.sha;
    await assertPlanFresh(files, binaries, headSha);
    const headCommit = await api(REPO_BASE + '/git/commits/' + headSha);

    const tree = [];
    for (const file of files) {
      const blob = await api(REPO_BASE + '/git/blobs', {
        method: 'POST',
        body: { content: encodeContent(file.content), encoding: 'base64' }
      });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const binary of binaries) {
      const blob = await api(REPO_BASE + '/git/blobs', {
        method: 'POST',
        body: { content: bytesToBase64(binary.bytes), encoding: 'base64' }
      });
      tree.push({ path: binary.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    for (const path of deletions) {
      tree.push({ path, mode: '100644', type: 'blob', sha: null });
    }

    const newTree = await api(REPO_BASE + '/git/trees', {
      method: 'POST',
      body: { base_tree: headCommit.tree.sha, tree }
    });

    const commit = await api(REPO_BASE + '/git/commits', {
      method: 'POST',
      body: { message, tree: newTree.sha, parents: [headSha] }
    });

    const candidate = { sha: commit.sha, baseSha: headSha, date: new Date().toISOString(), url: null };
    if (options && typeof options.onCandidate === 'function') await options.onCandidate(candidate);

    try {
      await api(REPO_BASE + '/git/refs/heads/' + BRANCH, {
        method: 'PATCH',
        body: { sha: commit.sha, force: false }
      });
    } catch (error) {
      let reachability;
      try {
        reachability = await candidateReachability(candidate, {
          authoritativeRejection: error.status === 409 || error.status === 422
        });
      } catch (_e) {
        reachability = { status: 'unknown' };
      }
      if (reachability.status === 'confirmed_source') return reachability;
      if (reachability.status === 'definite_not_submitted' && (error.status === 409 || error.status === 422)) {
        const conflict = new Error(
          'main изменился, source-коммит не был отправлен. Обновите страницу и повторите попытку.'
        );
        conflict.code = 'definite-not-submitted';
        throw conflict;
      }
      const unknown = new Error(
        'Не удалось подтвердить отправку source-коммита. Публикация заблокирована: проверьте статус ещё раз.'
      );
      unknown.code = 'publish-unknown';
      unknown.candidate = candidate;
      throw unknown;
    }

    return candidate;
  }

  /* ── ожидание вердикта конвейера content-publish ─────────────────── */

  function pollInterval() {
    return typeof window.ADMIN_POLL_INTERVAL_MS === 'number' ? window.ADMIN_POLL_INTERVAL_MS : 10000;
  }

  function pollTimeout() {
    return typeof window.ADMIN_POLL_TIMEOUT_MS === 'number' ? window.ADMIN_POLL_TIMEOUT_MS : 6 * 60 * 1000;
  }

  async function waitForPipeline(sourceSha, sinceIso) {
    if (typeof sourceSha !== 'string' || !/^[0-9a-f]{40}$/.test(sourceSha)) {
      throw new Error('Для проверки конвейера нужен полный source SHA из 40 строчных hex-символов.');
    }
    const deadline = Date.now() + pollTimeout();
    // Exact source attribution is stronger than a client-clock cutoff: a
    // slow/local clock must not hide the bot settlement we are waiting for.
    // `sinceIso` remains accepted for API compatibility but is intentionally
    // not sent to GitHub.
    void sinceIso;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval()));
      let terminal = null;
      for (let page = 1; page <= 100 && !terminal; page += 1) {
        let commits;
        try {
          commits = await api(REPO_BASE + '/commits?sha=' + BRANCH + '&per_page=100&page=' + page);
        } catch (_e) {
          break; // временная ошибка сети/API — пробуем позже
        }
        if (!Array.isArray(commits)) break;
        for (const item of commits) {
          const message = (item && item.commit && item.commit.message) || '';
          const author = item && item.author && item.author.login;
          if (author !== 'github-actions[bot]') continue;
          const successSubject =
            'chore(content): regenerate site from content/ [content-publish] [source:' + sourceSha + ']';
          const revertSubject =
            'revert(content): roll back content push after failed publish [content-publish-revert] [source:' +
            sourceSha +
            ']';
          if (message === revertSubject) {
            terminal = {
              status: 'reverted',
              sha: (item && item.sha) || null,
              url: (item && item.html_url) || ACTIONS_URL,
              message
            };
          }
          if (message === successSubject) {
            terminal = {
              status: 'published',
              sha: (item && item.sha) || null,
              url: (item && item.html_url) || ACTIONS_URL,
              message
            };
          }
        }
        if (commits.length < 100) break;
      }
      if (terminal) return terminal;
    }
    return {
      status: 'timed_out',
      sha: null,
      url: ACTIONS_URL,
      message: 'Конвейер ещё не прислал source-bound verdict.'
    };
  }

  window.AdminAPI = {
    OWNER,
    REPO,
    BRANCH,
    ACTIONS_URL,
    getToken,
    getUser,
    setSession,
    clearSession,
    validateToken,
    probeOAuthAvailable,
    loginWithGitHub,
    fetchFile,
    publish,
    candidateReachability,
    waitForPipeline
  };
})();
