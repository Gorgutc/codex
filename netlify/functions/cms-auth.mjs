/* cms-auth.mjs — GitHub OAuth web flow proxy для админ-панели (итерация D).
 *
 * Два шага:
 *   GET /.netlify/functions/cms-auth
 *     → 302 на github.com/login/oauth/authorize (scope=repo) c crypto-random
 *       state, который сохраняется в HttpOnly-cookie.
 *   GET /.netlify/functions/cms-auth?code=...&state=...
 *     → проверка state против cookie, обмен code на access_token и крошечная
 *       HTML-страница, которая postMessage'ом передаёт токен в window.opener
 *       (строго на origin этого сайта) и закрывает popup.
 *
 * Секреты ТОЛЬКО в env-переменных Netlify:
 *   GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET
 * (создание OAuth App и настройка — см. журнал итерации D в
 *  docs/agent/admin-panel/handoff.md).
 */

const STATE_COOKIE = 'codex_admin_oauth_state';
const MESSAGE_TYPE = 'codex-admin-oauth';

function jsLiteral(value) {
  // postMessage-страница вставляет значения в <script>: экранируем "<",
  // чтобы содержимое не могло закрыть тег или открыть новый.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtmlText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resultPage(origin, payload) {
  const message = { type: MESSAGE_TYPE, token: payload.token || null, error: payload.error || null };
  const note = payload.error
    ? 'Ошибка входа: ' + escapeHtmlText(payload.error)
    : 'Вход выполнен. Это окно можно закрыть.';
  const html = [
    '<!DOCTYPE html>',
    '<html lang="ru">',
    '<head><meta charset="UTF-8"><title>Codex Admin — вход</title></head>',
    '<body style="background:#212121;color:#f0eeeb;font-family:system-ui,sans-serif;padding:2rem">',
    '<p>' + note + '</p>',
    '<script>',
    '(function () {',
    '  if (window.opener) {',
    '    window.opener.postMessage(' + jsLiteral(message) + ', ' + jsLiteral(origin) + ');',
    '  }',
    '  window.close();',
    '})();',
    '</scr' + 'ipt>',
    '</body>',
    '</html>'
  ].join('\n');
  return new Response(html, {
    status: payload.error ? 400 : 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // state одноразовый: затираем cookie в любом исходе второго шага.
      'Set-Cookie': STATE_COOKIE + '=; Max-Age=0; Path=/.netlify/functions/cms-auth; Secure; HttpOnly; SameSite=Lax'
    }
  });
}

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

export default async function handler(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return resultPage(origin, {
      error: 'OAuth не настроен: задайте GITHUB_OAUTH_CLIENT_ID и GITHUB_OAUTH_CLIENT_SECRET в Netlify.'
    });
  }

  const code = url.searchParams.get('code');

  // Шаг 1: редирект на GitHub с одноразовым state в cookie.
  if (!code) {
    const state = crypto.randomUUID();
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('redirect_uri', origin + '/.netlify/functions/cms-auth');
    authorize.searchParams.set('scope', 'repo');
    authorize.searchParams.set('state', state);
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorize.toString(),
        'Cache-Control': 'no-store',
        'Set-Cookie':
          STATE_COOKIE +
          '=' +
          state +
          '; Max-Age=600; Path=/.netlify/functions/cms-auth; Secure; HttpOnly; SameSite=Lax'
      }
    });
  }

  // Шаг 2: проверка state и обмен кода на токен.
  const returnedState = url.searchParams.get('state') || '';
  const cookieState = readCookie(request.headers.get('cookie'), STATE_COOKIE);
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return resultPage(origin, { error: 'state не совпал — попробуйте войти ещё раз.' });
  }

  let data;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: origin + '/.netlify/functions/cms-auth'
      })
    });
    data = await res.json();
  } catch (_e) {
    return resultPage(origin, { error: 'GitHub не ответил на обмен кода. Попробуйте ещё раз.' });
  }

  if (!data || !data.access_token) {
    const detail = data && data.error_description ? data.error_description : 'GitHub не вернул access_token.';
    return resultPage(origin, { error: detail });
  }

  return resultPage(origin, { token: data.access_token });
}
