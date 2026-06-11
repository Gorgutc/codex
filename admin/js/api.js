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

  async function fetchFile(path) {
    const data = await api(REPO_BASE + '/contents/' + path + '?ref=' + BRANCH);
    if (!data || data.type !== 'file' || data.encoding !== 'base64') {
      throw new Error('Неожиданный ответ GitHub Contents API для ' + path);
    }
    return { path, sha: data.sha, text: decodeContent(data.content) };
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
  async function publish(payload, message) {
    const plan = Array.isArray(payload) ? { files: payload } : payload || {};
    const files = plan.files || [];
    const binaries = plan.binaries || [];
    const deletions = plan.deletions || [];

    const ref = await api(REPO_BASE + '/git/ref/heads/' + BRANCH);
    const headSha = ref.object.sha;
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

    try {
      await api(REPO_BASE + '/git/refs/heads/' + BRANCH, {
        method: 'PATCH',
        body: { sha: commit.sha, force: false }
      });
    } catch (error) {
      if (error.status === 409 || error.status === 422) {
        // Non-fast-forward: перечитываем head, чтобы подтвердить гонку.
        let moved = true;
        try {
          const fresh = await api(REPO_BASE + '/git/ref/heads/' + BRANCH);
          moved = fresh.object.sha !== headSha;
        } catch (_e) {
          /* считаем гонкой */
        }
        if (moved) {
          const conflict = new Error('main изменился, обновите страницу');
          conflict.code = 'non-fast-forward';
          throw conflict;
        }
      }
      throw error;
    }

    return { sha: commit.sha, date: new Date().toISOString() };
  }

  /* ── ожидание вердикта конвейера content-publish ─────────────────── */

  function pollInterval() {
    return typeof window.ADMIN_POLL_INTERVAL_MS === 'number' ? window.ADMIN_POLL_INTERVAL_MS : 10000;
  }

  function pollTimeout() {
    return typeof window.ADMIN_POLL_TIMEOUT_MS === 'number' ? window.ADMIN_POLL_TIMEOUT_MS : 6 * 60 * 1000;
  }

  async function waitForPipeline(sinceIso) {
    const deadline = Date.now() + pollTimeout();
    const query = '?sha=' + BRANCH + '&since=' + encodeURIComponent(sinceIso);
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval()));
      let commits;
      try {
        commits = await api(REPO_BASE + '/commits' + query);
      } catch (_e) {
        continue; // временная ошибка сети/API — пробуем дальше
      }
      if (!Array.isArray(commits)) continue;
      for (const item of commits) {
        const message = (item && item.commit && item.commit.message) || '';
        if (message.indexOf('[content-publish-revert]') !== -1) {
          return { status: 'reverted', url: (item && item.html_url) || ACTIONS_URL };
        }
        if (message.indexOf('[content-publish]') !== -1) {
          return { status: 'published' };
        }
      }
    }
    return { status: 'timeout', url: ACTIONS_URL };
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
    loginWithGitHub,
    fetchFile,
    publish,
    waitForPipeline
  };
})();
