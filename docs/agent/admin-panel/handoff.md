# Handoff: проект «Админ-панель + двойная обвязка»

Живой журнал проекта. Обновляется в конце каждой итерации.
Любая сессия (Claude Code или Codex) продолжает работу отсюда.

## Как продолжить из новой сессии

1. Прочитать `docs/agent/admin-panel/tz.md` (ТЗ и утверждённые решения) и этот файл.
2. Посмотреть таблицу итераций ниже: найти первую итерацию не в статусе «готово».
3. Прочитать раздел журнала последней сессии — там состояние и следующий шаг.
4. Правила репозитория: `AGENTS.md` (для Codex) / `CLAUDE.md` (для Claude Code);
   перед коммитом обязателен `npm run codex:ship` (ноль FAIL).
5. Каждая итерация — отдельная ветка `codex/admin-*` и draft PR; после ревью
   (`/codex:review`, для итераций B и F ещё `/codex:adversarial-review`) — мерж.

## Статус итераций

| Итерация | Содержание | Статус |
| --- | --- | --- |
| 0 | Окружение, ТЗ, ресерч, handoff | готово (PR #36, draft) |
| A | Двойная обвязка Claude + Codex (зеркало `.claude`, sync-гейт) | готово (ветка `codex/admin-ia-dual-harness`, draft PR) |
| B | Извлечение контента в `content/*.json` + генератор + golden-тест | готово (ветка `codex/admin-ib-content-layer`, draft PR) |
| C | CI-конвейер публикации (GitHub Action) + sync-гейт | готово (ветка `codex/admin-ic-publish-pipeline`, draft PR) |
| D | Админка MVP: вход GitHub OAuth, тексты RU/EN, мета | в ревью (ветка `codex/admin-id-admin-mvp`) |
| E | Медиа: фото, видео (`.webm`/Vimeo), GLB, OG | в ревью (ветка `codex/admin-ie-media`) |
| F | Порядок блоков (drag-and-drop), вкл/выкл кейсов и категорий | в ревью (ветка `codex/admin-if-order-visibility`) |
| G | Превью, гайд владельца, финальный handoff | не начата |

## Шаги владельца (требуют ручного участия)

- [ ] В Claude Code выполнить: `/plugin marketplace add openai/codex-plugin-cc`,
  затем `/plugin install codex@openai-codex`, `/reload-plugins`, `/codex:setup`.
  `/codex:setup` попросит авторизацию OpenAI (ChatGPT-логин или API-ключ).
  Codex CLI уже установлен глобально (`npm install -g @openai/codex`, 2026-06-10).
- [ ] Создать GitHub OAuth App для входа в админку — пошаговая инструкция
  в журнале итерации D ниже.
- [ ] После итерации D: заполнить русские тексты кейсов через админку (сейчас RU = EN).

## Журнал сессий

### 2026-06-10 — Сессия 1 (Claude Code): разведка, план, итерация 0

Сделано:

- Полная разведка репозитория: сайт (контент захардкожен в `index.html`,
  `js/main.js` `CARDS_DATA`, `js/fa-data.js`, `js/i18n-data.js`), обвязка
  (Codex-native: `AGENTS.md`, плагин с 9 скиллами, 7 скиллов `.agents/skills/`,
  3 хука и 6 агентов в `.codex/`), история (6 спринтов Industrial Editorial
  Refresh завершены, админ-работ ранее не было).
- Продуктовый ресерч админок и CMS — итоги в `research.md`.
- План из 8 итераций утверждён владельцем; решения по 4 ключевым вопросам
  зафиксированы в `tz.md` (кастомная админка, webm+Vimeo, черновик→превью→
  публикация, вход через GitHub).
- Установлен Codex CLI глобально; зависимости проекта поставлены в worktree.
- Созданы `tz.md`, `research.md`, `handoff.md` (эта папка).
- Добавлен русский словарь cspell (`@cspell/dict-ru_ru` + import в `cspell.json`):
  конфиг заявлял `language: "en,ru"`, но словаря не было — русскоязычные документы
  не проходили `check:spelling`.
- Проверка `legacy .claude removed from root` в `scripts/verify-codex-plugin.mjs`
  заменена на git-aware вариант («в git нет отслеживаемых файлов из `.claude`»):
  Claude Code локально создаёт `.claude/settings.local.json`, и старая проверка
  по факту существования папки роняла гейт у любой Claude-сессии.
- В `.gitignore` добавлены `.claude/settings.local.json` и `.claude/worktrees/`.

Технические заметки для следующих итераций:

- `scripts/verify-codex-plugin.mjs`: проверка про `.claude` в итерации 0 стала
  git-aware («нет отслеживаемых файлов»), но в итерации A её нужно заменить ещё
  раз — на проверки существования зеркала (`.claude/skills`, `.claude/agents`,
  `.claude/settings.json`), которое как раз попадёт под отслеживание git.
- `scripts/check-governance.mjs` проверяет относительный порядок защищённых
  скриптов в обеих HTML-страницах; новый `js/cards-data.js` (итерация B) в его
  списки можно не добавлять (проверяется только относительный порядок
  перечисленных), но в frozen-список `verify-frozen.js` — обязательно.
- Скан `docs/**` в `verify-codex-plugin.mjs` запрещает строки вида
  «число/число PASS» в активных инструкциях — не писать такие в документах.
- `cspell.json` заявляет `language: "en,ru"`, но словарь `@cspell/dict-ru_ru`
  не установлен — добавляется в этой итерации (devDependency + import в конфиге),
  иначе русскоязычные документы не пройдут `check:spelling`.
- Хуки `.codex/hooks/*.js` кросс-совместимы с Claude Code (формат
  `hookSpecificOutput`); в итерации A они переиспользуются без копирования.
- Claude Code на этой машине — десктоп-приложение без CLI `claude` в PATH,
  поэтому плагин кросс-ревью ставится слэш-командами владельца (см. выше);
  в итерации A в `.claude/settings.json` добавим `extraKnownMarketplaces` +
  `enabledPlugins`, чтобы установка предлагалась автоматически.

Следующий шаг: завершить итерацию 0 (ветка `codex/admin-i0-docs-env`, draft PR),
затем итерация A.

### 2026-06-10 — Сессия 1, продолжение: итерация A (двойная обвязка)

Сделано (ветка `codex/admin-ia-dual-harness`, поверх итерации 0):

- `scripts/sync-harness.mjs`: `--write` генерирует зеркало (16 скиллов = 56
  файлов в `.claude/skills/` + 6 агентов в `.claude/agents/`), `--check` =
  `npm run check:parity` — гейт паритета, включён в цепочку `codex:ship`.
- `.claude/settings.json`: три хука обеих систем указывают на ОБЩИЕ скрипты
  `.codex/hooks/*.js` через `${CLAUDE_PROJECT_DIR}`; плюс
  `extraKnownMarketplaces`/`enabledPlugins` для `openai/codex-plugin-cc` —
  Claude Code сам предложит установить плагин кросс-ревью.
- `CLAUDE.md` переписан: импорт `@AGENTS.md` + Claude-специфика + процесс
  кросс-ревью. `AGENTS.md` обновлён под двойную обвязку (authority, команды).
- `scripts/verify-codex-plugin.mjs`: проверки существования зеркала и
  `@AGENTS.md`-импорта вместо запрета `.claude`.
- ADR 0008 (dual harness parity); правки дрейфа в 17 местах по итогам аудита
  (README, RUN_INSTRUCTIONS, SKILL_DRIFT_REPORT, instruction-audit, code-audit,
  audit-summary, orchestration, quality-tooling, evals/README, docs/agent/README,
  session-start.js, два TOML-контракта, два скилла, ADR 0001/0003 amended).
- По adversarial-ревью: `.claude/` исключён из prettier и jscpd (иначе
  `format:all` ломал бы паритет); read-only агенты в зеркале получают
  `tools: Read, Grep, Glob` (без Bash); guard на запуск sync-harness вне корня
  репозитория; симметричная проверка хуков.

Верификация: `npm run check:parity` 0 FAIL, `npm run quality:fast` зелёный,
`npm run codex:ship` зелёный (прогоняется pre-push хуком).

Незакрытое по итерации A (не блокирует):

- Smoke-тест в живой Codex-сессии (поведение Codex не должно измениться) —
  владелец или следующая Codex-сессия.
- Установка плагина кросс-ревью — шаги владельца (см. чек-лист выше);
  `/codex:review` на итерациях 0/A заменён adversarial-ревью внутренними
  агентами, фактические имена команд плагина сверить после установки.

Следующий шаг: итерация B — извлечение контента в `content/*.json`, генератор
и golden-тест (см. tz.md). Перед стартом прочитать `js/main.js` (CARDS_DATA,
makeItems, buildItems) целиком.

### 2026-06-10 — Сессия 1, продолжение: итерация B (слой данных контента)

Сделано (ветка `codex/admin-ib-content-layer`, поверх итерации A):

- `content/` — редактируемый слой: `settings.json` (фильтры, `cardOrder`),
  `cases/{id}.json` ×18 (card EN+RU, case: role/tools/model*/palette/srcs/
  captions/text/inline/motionBlocks, всё EN+RU), `free-assets.json`,
  `i18n-ui.json`, `meta.json`.
- `scripts/generate-content.mjs` (`content:generate` / `content:check`):
  детерминированно генерирует `js/cards-data.js` (новый, между
  `shared-runtime.js` и `main.js` в index.html; логика `makeItems` перенесена
  в генератор), `js/fa-data.js`, `js/i18n-data.js` (по шаблону
  `scripts/templates/i18n-data.tpl.js`), регион index.html между маркерами
  `<!-- CODEX:GEN cards-grid BEGIN/END -->` (байт-в-байт).
- `js/main.js` минус ~570 строк данных; `buildItems`/seeded shuffle не тронуты.
- Golden-фикстуры `tests/quality/fixtures/` + спек
  `tests/quality/content-golden.spec.mjs` (`npm run test:golden`):
  runtime CARDS_DATA/FA_DATA/i18n/grid innerHTML deep-equal до и после.
  Adversarial-ревью дополнительно доказало побайтную идентичность данных
  старого и нового рантайма через vm-исполнение старого main.js.
- `verify-frozen.js`: cards-data.js добавлен в script order и A8/A9-сканы
  (строго аддитивно). `knip.json`: cards-data.js как entry.
- По ревью: `content:check` включён в `quality:fast`, `content:check` +
  `test:golden` — в `codex:ship`; HTML-экранирование в генераторе грида
  (под будущий пользовательский ввод из админки); защита от `$&`-паттернов
  в подстановке шаблона; удалены мёртвые поля (`order` в кейсах,
  `faCategoryOrder`); `*.html` в `.prettierignore` (чтобы `format:all`
  не воевал с генератором).

Верификация: `codex:ship` полный зелёный (plugin 35/35, governance 0 fail,
parity, content:check, golden 2/2, verify-frozen 128/128); `test:visual`
без диффов; `quality:fast` зелёный.

Заметки для следующих итераций:

- `enabled:false` в кейсах уже поддержан генератором (задел под итерацию F).
- `i18nOverrides.caseEn` у `cad-strut`/`flex-spine` консервирует историческое
  расхождение EN-текстов CARDS_DATA и CASE_LOCALES.en — владелец может
  унифицировать через админку.
- `scripts/capture-content-golden.mjs` перезаписывает golden-фикстуры —
  запускать ТОЛЬКО при намеренном обновлении эталона (в npm-скрипты не зашит).
- free-assets.html не грузит cards-data.js: там `window.CARDS_DATA` пуст;
  все консумеры в main.js имеют guard — поведение страницы не изменилось.
- Тех-долг (не блокирует): нет `.gitattributes` с `eol=lf` — на чужой машине
  с `autocrlf=true` возможны ложные диффы; решить в итерации C вместе с CI.
- В `.prettierrc.json` остался мёртвый override для `*.html` — безвреден.

Следующий шаг: итерация C — `.github/workflows/content-publish.yml`
(регенерация + verify + commit-back при правке `content/**`, авто-revert при
FAIL, защита от петли) + JSON-schema валидация `content/`.

### 2026-06-10 — Сессия 1, продолжение: итерация C (конвейер публикации)

Сделано (ветка `codex/admin-ic-publish-pipeline`, поверх итерации B):

- `.github/workflows/content-publish.yml`: push в `main` по `content/**` →
  `npm ci` + chromium → регенерация → `npm run verify` (0 FAIL) →
  пересъёмка golden-фикстур → bot-коммит
  `chore(content): regenerate ... [content-publish]` с js/html/фикстурами.
  При падении генератора ИЛИ verify — авто-revert контент-коммитов
  (диапазон от последнего bot-якоря `[content-publish*]`, только коммиты,
  трогающие `content/`; newest-first, merge через `-m 1`) с маркером
  `[content-publish-revert]`. Защита от петли: paths-фильтр + guard по
  автору-боту + push через GITHUB_TOKEN не триггерит workflows.
  Rebase fail-fast (никакого mid-rebase состояния), concurrency
  сериализован, actions запинены на SHA.
- `validateContent()` в генераторе (оба режима): уникальность/биекция id и
  `cardOrder`, обязательные поля, EN+RU паритет, существование медиа-файлов,
  enum для `imgLoading`/`imgFetchPriority`, фильтры с key+label,
  free-assets поля, traversal-guard (все пути строго внутрь `./assets/`,
  без `..`/`\`/абсолютных) — все нарушения списком, exit 1.
- Негативный самотест `tests/quality/content-validate.test.mjs`
  (`npm run test:content-validate`, включён в `quality:deep`).
- EOL-устойчивость `--check`/`--write` (CRLF-checkout не даёт ложных диффов
  и churn; проверено симуляцией CRLF).
- `docs/agent/verification.md`: новые гейты задокументированы.

Верификация: `codex:ship` зелёный (verify-frozen 128/128), `quality:fast`,
`test:golden` 2/2, `test:content-validate`, prettier по новым файлам.
Adversarial-ревью: блокеров нет; 3 major исправлены (burst-push revert,
rebase fail-fast, пробелы валидатора), плюс автопересъёмка golden в CI и
пин actions на SHA.

Контракт конвейера для итерации D (админка):

- Админка коммитит в `main` ТОЛЬКО `content/**`; рантайм эти JSON не читает,
  сайт меняется после bot-коммита (Netlify деплоит итог, ~2–3 мин).
- Пути медиа — строго `./assets/...`, иначе валидатор завернёт и CI
  откатит коммит. Админке стоит гонять те же правила до коммита:
  `CONTENT_DIR=<черновик> node scripts/generate-content.mjs --check`.
- Golden-фикстуры пересоберёт CI; вручную `capture-content-golden.mjs`
  гонять только при намеренном обновлении эталона.
- Известные ниши (приемлемо): CRLF внутри строки контента невидим для
  `--check` только в HTML-регионе; `tests/**/*.mjs` не покрыты eslint
  (конвенция репо); смоук free-assets preloader (`quality:deep`) флачит
  по таймингу на этой машине и на чистом дереве.

Следующий шаг: итерация D — админка MVP (`admin/`, GitHub OAuth через
Netlify Function, тексты RU/EN, мета; см. tz.md и 12 UX-принципов в
research.md). Владелец должен будет создать GitHub OAuth App (инструкцию
дать в журнале итерации D).

### 2026-06-10 — Сессия 2 (Claude Code): итерация D (админка MVP)

Сделано (ветка `codex/admin-id-admin-mvp`):

- `admin/` — vanilla-админка без сборки (classic scripts):
  `index.html` (каркас, диалог публикации, тосты), `css/admin.css`
  (самодостаточные dark-стили на токенах сайта, сайтовые css не тронуты),
  `js/api.js` (GitHub-клиент: сессия, вход, Contents API, Git Data API,
  поллинг конвейера), `js/state.js` (черновики, sessionStorage-автосейв
  и валидация), `js/ui.js` (hash-роутер и экраны).
- Экраны: вход (OAuth-popup или PAT) → список кейсов (поиск, превью,
  бейдж «черновик») → редактор кейса (RU/EN всегда бок о бок) →
  «Мета-теги» → «Тексты интерфейса» (раскрывающиеся группы по неймспейсам).
- UX по research.md: структурированные поля без WYSIWYG; автосохранение
  черновика (debounce) в sessionStorage, индикатор «несохранённые
  изменения» и предупреждение beforeunload; явная «Опубликовать» с
  подтверждением и списком изменённых файлов; клиентская валидация до
  публикации (зеркало validateContent для редактируемых полей, русские
  сообщения у конкретных полей); тосты статуса; слоты итераций E/F видимы,
  но заблокированы с подсказкой «скоро» (медиа, drag-handle, выключатели).
- Публикация: ОДИН atomic-коммит в `main` через Git Data API
  (blobs → tree → commit → update ref, без force; non-fast-forward →
  «main изменился, обновите страницу»). Сообщение
  `content: <описание> [admin]`. После пуша — поллинг commits API до
  bot-маркера `[content-publish]` (успех) / `[content-publish-revert]`
  (откат, ссылка на GitHub) с таймаут-сообщением.
- Перед правкой и публикацией файл перечитывается через Contents API
  (источник истины); расхождение base ↔ GitHub останавливает публикацию.
- `netlify/functions/cms-auth.mjs` — OAuth web flow proxy (современная
  ESM-сигнатура): редирект на GitHub c crypto-random state в HttpOnly-cookie,
  обмен кода на токен, postMessage в opener строго на origin сайта.
  Секреты только в env. В `netlify.toml` добавлена секция `[functions]`
  (publish/headers не тронуты).
- Интеграция гейтов: `robots.txt` — `Disallow: /admin/` во всех группах
  (именованные группы перекрывают `*`); eslint покрывает `admin/js` и
  `netlify/functions`; htmlhint — `admin/*.html`; knip/depcruise — новые
  entry; `test:admin` (Playwright-смоук с полностью замоканным GitHub API)
  включён в `quality:deep`. Shipped-файлы сайта не изменялись.

Шаги владельца для входа через GitHub (однократно):

1. GitHub → Settings → Developer settings → OAuth Apps → «New OAuth App»:
   - Application name: `Codex Admin` (любое);
   - Homepage URL: `https://codex.promo`;
   - Authorization callback URL:
     `https://codex.promo/.netlify/functions/cms-auth`;
   - Device flow не включать. После создания нажать
     «Generate a new client secret».
2. Netlify → Site configuration → Environment variables → добавить:
   - `GITHUB_OAUTH_CLIENT_ID` = Client ID из OAuth App;
   - `GITHUB_OAUTH_CLIENT_SECRET` = сгенерированный Client secret.
   Затем передеплоить сайт (Deploys → Trigger deploy), чтобы функция
   увидела переменные.
3. Запасной вход без OAuth: fine-grained PAT (Settings → Developer
   settings → Fine-grained tokens) с доступом к `Gorgutc/codex` и правом
   «Contents: Read and write» — вставить на экране «Войти с токеном».

Заметки для итераций E/F (точки расширения):

- `admin/js/ui.js`: медиа-слоты кейса и технические поля motion-блоков
  уже отрисованы как заблокированные (`итерация E`) — UI-замена сводится
  к снятию disabled и загрузке blob'ов через тот же `AdminAPI.publish`
  (Git Data API умеет бинарные blob'ы base64).
- Drag-handle и выключатель кейса в списке (`итерация F`) отрисованы
  заблокированными; включение/выключение = правка `enabled` в
  `content/cases/{id}.json` + `cardOrder` в `settings.json` — генератор
  и валидатор это уже поддерживают (см. итерацию B).
- `AdminState` работает с любым файлом `content/**`: для free-assets
  достаточно добавить экран и правила валидации.
- Поллинг конвейера управляется `window.ADMIN_POLL_INTERVAL_MS` /
  `ADMIN_POLL_TIMEOUT_MS` (используется тестом).

Верификация: `content:check`, `test:admin` (3 сценария), `quality:fast`,
`codex:ship`, `check:parity`, prettier по новым mjs — зелёные;
`test:visual` без диффов (shipped-страницы не менялись).

Итоги security-ревью итерации D (adversarial, блокеров и major нет):

- Исправлено: экранирование текста ошибки на relay-странице OAuth
  (`cms-auth.mjs`); 404-редирект на `/netlify/*` в `netlify.toml`
  (исходники функций не раздаются статикой при `publish="."`);
  `event.source === popup` в обработчике postMessage (`api.js`).
- Зафиксированный компромисс: OAuth App даёт токен со scope `repo`
  (шире, чем fine-grained PAT) — для единственного владельца приемлемо;
  least-privilege вариант на будущее — GitHub App. PAT-вход остаётся
  рекомендуемым минимально-привилегированным путём.
- Подтверждено ревью: XSS-безопасный рендер (textContent/setAttribute), state
  одноразовый (HttpOnly+Secure+SameSite cookie), токен только в
  sessionStorage и только на api.github.com, атомарный коммит с
  предварительной сверкой fresh-head, изоляция сайта полная (verify-frozen 0 FAIL,
  visual без диффов).

Следующий шаг: итерация E — медиа (фото, `.webm`/Vimeo, GLB, OG) поверх
заблокированных слотов админки.

### 2026-06-10 — Сессия 3 (Claude Code): итерация E (медиа)

Сделано (ветка `codex/admin-ie-media`):

- Cache-bust медиа: `netlify.toml` раздаёт `/assets/*` с immutable-кэшем на
  год, поэтому каждый загруженный файл получает НОВОЕ каноничное имя
  `{base}-{hash8}.{ext}` (hash8 — первые 8 hex-символов SHA-256 содержимого,
  считается в браузере через `crypto.subtle`; base — имя-назначение слота:
  `orbital-mk-ii` для миниатюры, `02` для слота 2, имя текущего файла для
  видео/GLB/OG). Ссылка в `content/*.json` обновляется в том же atomic-коммите.
  Заменённые файлы НЕ удаляются (решение второго ревью, см. ниже): они
  остаются в репозитории под старыми именами, чистка осиротевших ассетов —
  будущая maintenance-задача. Легаси-файлы живут под старыми именами до
  первой замены.
- `admin/js/ui.js`: drop-зоны поверх текущего изображения (принцип 6
  research.md, «перетащите новую или нажмите») — миниатюра карточки,
  5 слотов иллюстраций (эффективный источник = `srcs[i]` или дефолт, как в
  генераторе), постеры motion-блоков, `.webm`-видео (превью через `<video>`),
  GLB-модель, OG-изображения обеих страниц на экране «Мета-теги».
- Motion-блоки: переключатель источника local↔vimeo; для vimeo — поле,
  принимающее цифровой ID или любой URL `vimeo.com` (автопарсинг с
  подтверждением «Распознан ID: …», валидация только-цифры); `layout` и
  `playback` остаются заблокированными — решение об их редактировании
  примет итерация F. `modelStats` редактируются (числовые значения не
  дрейфуют в строки), `modelEnvironment`/`modelExposure` — read-only.
- Лимиты и allowlist (`admin/js/state.js` MEDIA_RULES): изображения
  `.svg/.png/.jpg/.webp` — предупреждение от 200 КБ, блокировка от 2 МБ;
  `.webm` — предупреждение от 20 МБ («рекомендуем Vimeo для тяжёлых
  роликов»), блокировка от 40 МБ (запас до лимита base64-blob GitHub);
  `.glb` — предупреждение от 15 МБ, блокировка от 50 МБ; OG — `.jpg/.png/.webp`.
  MIME сверяется, если браузер его сообщил. Сообщения русские.
- Pending-медиа живут только в памяти (path → bytes + object-URL) и не
  переживают перезагрузку: в шапке предупреждение «загруженные файлы не
  переживут перезагрузку страницы — опубликуйте или загрузите заново»;
  текстовые правки по-прежнему автосохраняются в sessionStorage.
  `AdminAPI.publish` принимает план `{ files, binaries, deletions }`:
  бинарные blob'ы кодируются в base64 чанками (без лимита стека вызовов),
  бинарные пути дедуплицируются в `buildPublishPlan`. Возможность
  `deletions` (tree-entry с `sha: null`) в `publish()` сохранена и
  задокументирована, но UI её сознательно не использует. Диалог
  публикации перечисляет изменённые JSON и новые файлы.
- Генератор: ВТОРОЙ GEN-регион `head-meta` в `index.html` и
  `free-assets.html` — title, description, og:\*/twitter:\* собираются из
  `content/meta.json` (EN-локаль) плюс новое поле `ogImages.{index,fa}`;
  первая генерация байт-в-байт совпала с прежним head (проверено
  `content:check`). `free-assets.html` стал генерируемым таргетом;
  `validateContent` проверяет `ogImages` (путь, расширение, существование)
  и непустоту обязательных head-полей EN; в `js/i18n-data.js` уходит только
  `{en, ru}` без `ogImages` — рантайм-словарь не изменился (golden зелёный).
- `verify-frozen.js`: проверка `META-og-image-fa-specific` заякорена на
  каталог — `/assets/img/og-free-assets(-hash8)?.(jpg|jpeg|png|webp)$`
  (cache-bust-суффикс допустим, иначе первая же замена OG-картинки FA
  роняла бы конвейер); добавлена симметричная `META-og-image-index-specific`
  для og:image главной (`/assets/img/og-image(-hash8)?.<ext>$`). Инвариант
  «у FA своя картинка, не общий og-image главной» сохранён.
  `content-publish.yml`: `free-assets.html` добавлен в detect-diff и
  `git add` bot-коммита.
- Тесты: `tests/quality/admin-media.spec.mjs` (GitHub API полностью
  замокан) включён в `test:admin`: замена миниатюры и GLB → pending-бейдж,
  blob-превью, в tree нового коммита hash-пути и бинарные blob'ы, БЕЗ
  единой tree-entry с `sha: null` (старые `dino.glb` и миниатюра остаются
  в репозитории); парсинг Vimeo-URL и блокировка мусорного ввода;
  oversize-изображение блокируется русским сообщением.

Решение по head-мете: полный GEN-регион, а не узкие OG-маркеры.
`verify-frozen` пинит только наличие head-тегов и суффикс имени OG-картинки
FA, а не байты head, поэтому риск управляемый; бонус — head обеих страниц
теперь реально следует за `content/meta.json` (до этого правка меты через
админку меняла только runtime-словарь i18n, а статический head оставался
захардкоженным).

FA-медиа отложено (сознательно): `content/free-assets.json` хранит
`thumb`/`model` как базовые имена-конвенции (`resolveAssetMedia` в
`js/free-assets.js` достраивает `./assets/cards/<base>.svg` и
`./assets/models/free/<base>.glb`), а не полные пути — cache-bust-имя с
hash-суффиксом ляжет в эту схему без слома (имя без расширения остаётся
валидным base), но потребует отдельного экрана FA в админке. Точка
расширения: `AdminState` работает с любым `content/**` — осталось добавить
экран и naming-правила.

Верификация: `content:check` (все таргеты OK, head-регион байт-в-байт),
`test:admin` (смоук + медиа), `test:golden`, `test:content-validate`,
`quality:fast`, `codex:ship` полностью зелёный, `check:parity`,
`test:visual` без диффов.

Заметки:

- Повторная замена того же слота до публикации не плодит лишних файлов:
  промежуточные pending-загрузки просто замещаются в памяти, в коммит
  уходит только последняя.
- Загрузка файла, байты которого уже опубликованы под тем же hash-именем,
  распознаётся как «заменять нечего» (no-op).

Второе ревью (adversarial): два major-замечания, оба исправлены:

- Major 1 — окно 404 на проде: admin-коммит удалял заменённый ассет, а
  живой сайт продолжал ссылаться на него, пока bot-коммит конвейера не
  пересоберёт страницы минутами позже (Netlify деплоит каждый коммит main
  сразу). Решение: удаления выведены из scope админки полностью —
  `buildPublishPlan` больше не формирует `deletions`, заменённые файлы
  накапливаются в репозитории (git history хранит их в любом случае),
  чистка — отдельная будущая maintenance-задача. Мёртвая
  cross-reference-механика (`collectReferencedAssets`, `PROTECTED_ASSETS`,
  неиспользуемый экспорт `mediaPendingPaths`) удалена; «будут удалены»
  убрано из диалога публикации. `AdminAPI.publish` по-прежнему умеет
  `deletions` (на будущее, задокументировано), но UI их не передаёт.
- Major 2 — verify-frozen хардкодил motion-контракт orbital-mk-ii
  (порядок source/playback/layout и «ровно 2 локальных ролика»):
  переключение local↔vimeo владельцем через админку валило бы конвейер и
  откатывало легитимную публикацию. Решение: ожидания выводятся из
  `content/cases/orbital-mk-ii.json` при старте (`CASE-motion-*`-проверки,
  guard для `CASE-motion-control-single-handler`, счётчик motion-блоков в
  `B4-CASE_LOCALES-18-ru`); структурная строгость DOM-vs-data сохранена,
  изменился только источник ожиданий.

Попутно по ревью: дедупликация бинарных путей в `buildPublishPlan` (два
слота с одинаковыми байтами и назначением не плодят дублей path в tree);
drop-зона не обрабатывает один файл дважды (drop на невидимый input
обрабатывает его нативный change) и держит один tab-stop на слот
(`tabindex="-1"` на зоне, фокус-стиль через `:focus-within`).

Отложено (deferred):

- `sitemap.xml` (`image:loc`) и захардкоженный JSON-LD в `<head>` обеих
  страниц продолжают указывать на исходные OG/logo-файлы после замены
  OG-картинки через админку (SEO-дрейф, не ломает сайт) — план на
  итерацию G: генерировать sitemap/JSON-LD из `content/meta.json`.
- Vimeo privacy-hash (unlisted, `vimeo.com/<id>/<hash>`) не
  поддерживается — принимаются только цифровые ID/обычные ссылки.
- `og:image:width/height` захардкожены 1200×630 в генераторе; подсказка
  «1200×630» в UI — только текст, размеры загружаемой картинки не
  проверяются.
- Серверный (validateContent) allowlist расширений для thumb/srcs/poster
  шире клиентского MEDIA_RULES (pre-existing, не регрессия итерации E).

Следующий шаг: итерация F — порядок блоков (drag-and-drop), включение и
выключение кейсов и категорий; там же решить, открывать ли редактирование
`layout`/`playback` motion-блоков.

### 2026-06-10 — Сессия 4 (Claude Code): итерация F (порядок и видимость)

Сделано (ветка `codex/admin-if-order-visibility`):

- `layoutMode` кейса (`content/cases/{id}.json`, опционально): `'seeded'`
  (по умолчанию/отсутствует — прежнее поведение байт-в-байт) или `'manual'`.
  Валидатор — enum-проверка. Генератор кладёт флаг в запись
  `js/cards-data.js` ТОЛЬКО при `'manual'`, поэтому при полностью seeded
  контенте сгенерированные файлы не меняются (golden-фикстуры остались
  валидны без пересъёмки — доказано `test:golden`). В `js/main.js`
  `buildItems()` единственное изменение: `shuffleInPlace` становится no-op
  при `manual` — авторский порядок `media[]` внутри групп, план рядов
  (wide/tall, tall-text, развод двух wide) не тронут.
- ВАЖНАЯ оговорка про manual: ручной режим стартует с АВТОРСКОГО порядка
  массивов в JSON, а не с того, что показывала seeded-раскладка (вычислять
  её на клиенте — лишняя связка с рантаймом, отвергнуто). UI говорит это
  прямо: «Стартовый порядок — авторский порядок файлов кейса: он может
  отличаться от того, что показывала автоматическая раскладка». Второй
  нюанс: план рядов кладёт tall-ряды раньше wide-рядов, а формат слота
  (широкий/высокий) задаётся ПОЗИЦИЕЙ (1 и 4 — wide, 2/3/5 — tall) — это
  тоже написано в подсказках редактора.
- Перестановка слота иллюстраций двигает тройку src+фон(palette)+подпись
  (captions) как единое целое; эффективные src перед перестановкой
  материализуются явными путями (дефолт `0N.svg` зависит от позиции).
  Pending-медиа переезжают вместе со слотом (`remapMediaEdits`).
  Motion-блоки переставляются целиком (массив `case.motionBlocks`).
- Решение по `layout`/`playback` motion-блоков (вопрос из итерации E):
  остаются read-only — комбинации управляют раскладкой/контролами
  рендерера, порядок блоков теперь и так редактируется.
- Видимость: выключатель кейса в списке (`enabled` в JSON кейса) — строка
  мгновенно затемняется + бейдж «скрыто» (принцип 5 research.md). Новый
  экран «Категории»: `enabled` у записей `settings.filters`; выключенная
  категория исчезает из dropdown фильтров сайта, все её кейсы выпадают из
  грида/cards-data/локалей; в списке кейсов такие кейсы затемнены с
  бейджем «категория скрыта» (их собственный `enabled` не трогается).
  Файлы никогда не удаляются. Guard'ы: «All» не выключается (валидатор +
  в UI тогл вообще не рисуется); последний видимый кейс скрыть нельзя —
  русское сообщение в админке + валидация генератора «at least one case
  must stay visible» (пустой грид уронил бы и verify).
- Порядок карточек: список кейсов перестраивается drag-and-drop за ручку
  ⠿ (SortableJS) и кнопками ↑/↓ (клавиатурный a11y-фоллбек, принцип 4);
  пишет `cardOrder` в `content/settings.json`; тост «Порядок сохранён в
  черновик». При активном поиске перестановка отключена (индексы строк не
  совпадали бы с cardOrder).
- SortableJS: self-hosted `admin/js/vendor/sortable.min.js`, версия 1.15.7,
  MIT (баннер с версией в первой строке файла). Источник —
  `registry.npmjs.org/sortablejs/-/sortablejs-1.15.7.tgz` (файл с jsdelivr
  сверен побайтно с npm-тарболом). `js/vendor` сайта не тронут. Без
  vendor-файла админка деградирует до кнопок ↑/↓. Исключения добавлены в
  eslint/prettier/knip/jscpd (`admin/js/vendor/**`).
- Генератор: `enabledCases` → `visibleCases` (enabled-кейс И включённая
  категория) для cards-data/локалей/грида; новый GEN-регион
  `<!-- CODEX:GEN filters BEGIN/END -->` в index.html — чекбоксы фильтров
  собираются из `settings.filters` (только включённые; data-i18n-ключ —
  camelCase от key, `hard-surface` → `filter.hardSurface`); первая
  генерация байт-в-байт. Для тестов добавлен env `CONTENT_OUT_DIR`
  (вывод таргетов в темп-каталог, рабочее дерево не трогается).
- `verify-frozen.js`: ожидания выводятся из `content/` вместо хардкода —
  `EXPECTED_IDS` (cardOrder ∩ видимые кейсы), `EXPECTED_TAGS` (включённые
  фильтры, теперь точное равенство множеств — выключенный фильтр обязан
  исчезнуть), счётчик карточек и sprint-b-анатомия (`WORK-cards-count`),
  B3/B4-локали (имена проверок теперь без числа), motion-кейс обобщён
  (первый видимый кейс с motion-блоками вместо литерала orbital), studio-env
  список (вместо трёх захардкоженных id; пустой список = вакуумный pass),
  стартовый кейс/финальный титул/счётчик 3D-пагинации, и free-assets
  счётчики (B5-локали, numberOfItems JSON-LD, дефолтный тег hard-surface,
  категория product) — из `content/free-assets.json`. Строгость прежняя,
  сменился только источник ожиданий; verify в CI бежит по
  регенерированному состоянию, контракт DOM-vs-content остаётся точным.
  `check-governance.mjs` прочитан: id/счётчики кейсов там не пинятся —
  не тронут.
- Админка: `peekDraftValue` (черновик без загрузки файла — список кейсов
  видит orphan-черновики из sessionStorage), `remapMediaEdits`,
  валидация settings.json (cardOrder, «All»), `describeChange`/коммит-
  описание для settings («Порядок карточек и категории»).
- Тесты: `tests/quality/content-visibility.test.mjs` (в
  `test:content-validate`): выключенный кейс исчезает из грида/cards-data/
  локалей (FA_LOCALES сознательно не реагирует — free-assets легитимно
  делят id с кейсами), выключенная категория убирает чекбокс и кейсы,
  невалидный layoutMode и выключенный «All» — ошибки валидации, manual
  попадает в cards-data, пустой грид отвергается.
  `tests/quality/admin-order-visibility.spec.mjs` (в `test:admin`):
  тогл кейса (затемнение+бейдж+черновик), перестановка кнопками ↑/↓ +
  publish-payload с обновлённым settings.json, переключение manual
  (ручки/кнопки появляются, слот переезжает с подписью и фоном,
  motion-блок переставляется, возврат к seeded), guard последнего
  видимого кейса, экран категорий (бейджи в списке кейсов, «All»
  отсутствует). Drag-симуляция не добавлялась (опционально по ТЗ) —
  SortableJS вызывает тот же `onMove`, что и кнопки.

Final review (та же ветка, до merge):

- `verify-frozen.js`: фильтр клик-теста и состав game-кейсов тоже выведены
  из content — `TAGS-filter-category` (первая включённая категория с
  видимыми кейсами, вместо клика по литералу `product`),
  `WORK-cards-game-assets`/`GAME-switch-filters` сверяют точные id кейсов
  с `gameAsset:true` вместо floor «≥2». `WORK-cards-ids` сравнивает полную
  упорядоченную последовательность `data-id` с `cardOrder` (порядок
  карточек теперь редактируется владельцем), а не принадлежность множеству.
- Motion-, studio-проверки и проверки пагинации стали условно-пропускаемыми
  С ЯВНЫМ маркером: когда в контенте нет триггера (ни одного видимого
  motion-кейса, game-кейса, studio-кейса, категории с видимыми кейсами
  или меньше двух видимых кейсов для пагинации), строка проверки печатается
  как PASS с detail `skipped: …` — тихих вакуумных сравнений «пусто с
  пустым» больше нет. В текущем (полностью включённом) контенте все
  skip-ветки спят: verify печатает 0 FAIL и ни одного skipped-маркера.
- `enabled` кейса проверяется как строгий boolean (зеркально
  `filters[].enabled`) в `generate-content.mjs` и в `admin/js/state.js`.
- `focusReorder` админки: если после перестановки к краю списка прежняя
  кнопка стала disabled, фокус переезжает на парную кнопку (up↔down),
  а не падает на body.
- Подсказка ручного режима говорит и про фактическую раскладку: в manual
  ряды идут как два высоких ряда, затем два широких подряд — правило
  чередования автоматической (seeded) раскладки не применяется
  (`buildItems` разводит два wide, меняя со СЛЕДУЮЩИМ не-wide, а в manual
  все tall-ряды стоят раньше wide-рядов).
- `admin/js/vendor/LICENSE` — текст MIT-лицензии SortableJS (copyright
  по официальному репо, сверен с npm-тарболом 1.15.7), по прецеденту
  `js/vendor/three/LICENSE`.
- Латентный нюанс (зафиксирован, не чинится сейчас): `i18nOverrides`
  кейса НЕ переезжают при перестановке слотов/motion-блоков. Сегодня
  существуют только overrides `caseEn.inline.body` (`cad-strut`,
  `flex-spine`), которые от порядка не зависят; если появятся overrides
  на `captions`/`motionBlocks` по индексам, перестановка разведёт их с
  новым порядком.

Отложено (deferred):

- Тоглы видимости отдельных free-assets — экрана FA в админке ещё нет
  (медиа FA отложено ещё в итерации E); содержимое
  `content/free-assets.json` рендерится целиком.
- Drag-перестановка в списке кейсов при активном поиске (сознательно
  отключена, кнопки тоже скрыты до очистки поиска).
- Статический JSON-LD и sitemap по-прежнему захардкожены в HTML — при
  скрытии кейса/категории SEO-разметка не сужается (план на итерацию G
  вместе с генерацией sitemap/JSON-LD из content).

Для итерации G:

- Превью «как будет» теперь особенно ценно для manual-порядка: владелец
  не видит итоговую раскладку до публикации (админка показывает список
  слотов, сайт — ряды); этот чёрный ящик закрывается iframe-превью.
- В гайде владельца объяснить: seeded против manual (и что manual
  стартует с авторского порядка), скрытие кейса против скрытия категории,
  что «скрыто» не удаляет файлы и откат — переключение тогла обратно.
- `CONTENT_OUT_DIR` генератора — готовый инструмент для песочницы превью.

Верификация: `content:check` (включая первую генерацию filters-региона
байт-в-байт), `test:content-validate` (оба node-теста),
`test:admin` (все спеки, включая новый), `test:golden` без пересъёмки
фикстур, `quality:fast`, `codex:ship` полностью зелёный (verify-frozen
0 FAIL с ожиданиями из content), `check:parity`, `test:visual` без диффов.
