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
| E | Медиа: фото, видео (`.webm`/Vimeo), GLB, OG | не начата |
| F | Порядок блоков (drag-and-drop), вкл/выкл кейсов и категорий | не начата |
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
