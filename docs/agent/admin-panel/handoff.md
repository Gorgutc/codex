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
| 0 | Окружение, ТЗ, ресерч, handoff | готово (PR #36, merged) |
| A | Двойная обвязка Claude + Codex (зеркало `.claude`, sync-гейт) | готово (PR #37, merged) |
| B | Извлечение контента в `content/*.json` + генератор + golden-тест | готово (PR #38, merged) |
| C | CI-конвейер публикации (GitHub Action) + sync-гейт | готово (PR #39, merged) |
| D | Админка MVP: вход GitHub OAuth, тексты RU/EN, мета | готово (PR #40, merged) |
| E | Медиа: фото, видео (`.webm`/Vimeo), GLB, OG | готово (PR #41, merged) |
| F | Порядок блоков (drag-and-drop), вкл/выкл кейсов и категорий | готово (PR #42, merged) |
| G | Превью, гайд владельца, финальный handoff | готово (PR #43, merged) |
| H | Free Assets: каталог в админке (тексты, медиа, видимость, порядок) + code-review fixes | готово (PR #44, merged) |

## Pre-production кампания (с 2026-06-12)

Главная цель: найти и вычистить все баги, довести сайт до прода.
План: R0 (глобальное ревью) → F1 (контракт) → F2 (security) →
F3 (рантайм сайта) → F4 (SEO/i18n/deploy) → F5 (deferred-фичи) →
F6 (релизный гейт). Реестр находок и триаж:
`docs/agent/prod-review/findings.md` — фиксы только по реестру.

Решения владельца (2026-06-12): deferred-лист включаем весь (кроме
требующего внешней инфраструктуры); каждая итерация — draft PR с
мержем в main по готовности; security-заголовки добавляем полным
набором, включая строгий CSP (обкатка перед мержем).

| Итерация кампании | Содержание | Статус |
| --- | --- | --- |
| R0 | Глобальное ревью: 7 потоков, реестр находок, триаж deferred | готово (PR #45) |
| F1 | Контракт: генератор, verify-frozen, golden, валидатор | готово (PR #46, merged) |
| F2 | Security: XSS-фиксы, админ-зеркало валидации, заголовки/CSP | готово (PR #47, merged) |
| F3 | Рантайм сайта: js/css/HTML фиксы по реестру | готово (PR #48, merged) |
| F4 | SEO, i18n RU, a11y, deploy readiness, 404 | влито частично (PR #49 merged на 6/9 chunk'ов); хвост вынесен в F4-tail |
| F4-tail | Остаток F4: count→i18n (E-12/A1-12/A2-02), fs-aria (A1-13), empty-state (A1-20/A2-03), удаление `chip.remove`, A2-05, A1-17, E-05, E-15 | готово (draft PR, ветка `codex/prod-f4-seo-i18n-tail`) |
| F5 | Deferred-фичи: Vimeo hash, FA-превью, manual-order, чистка ассетов, motion-поля, admin-замена логотипа | не начата |
| F6 | Релизный гейт: quality:all, 5-сек тест, прод-чек, go/no-go | не начата |

> Сверка с git (2026-06-13, Сессия 5): PR #48 (F3) и PR #49 (F4) **смержены в main**
> (`6330cbf`, `f81e579`). PR #49 влит на отметке 6/9 chunk'ов — между обновлением
> handoff (`2bb42fd`) и мержем новых коммитов не было, значит хвост F4 (8 пунктов
> выше) попал в main **незавершённым**. Кампания продолжается итерациями F4-tail →
> F5 → F6 стопкой stacked draft PR.

## Шаги владельца (требуют ручного участия)

- [x] Смержить draft PR итераций 0–G (PR #36–#43, влиты в main).
- [x] Смержить draft PR итерации H (PR #44, влит в main).
- [x] Ответить на 3 вопроса кампании (2026-06-12): остаёмся на
  Beget; Download скрываем у ассетов без файла; RU индексируем
  (hreflang). Детали — findings.md, «Решения владельца».
- [x] **Деплой репо→Beget уточнён (2026-06-13):** владелец вручную
  выгружает полный архив последней итерации с GitHub и распаковывает
  его в файловое пространство Beget с полной очисткой предыдущего
  сайта (полный перенос всего репозитория). Значит `.htaccess`
  доезжает с каждым деплоем; весь репозиторий попадает на хост, но
  `.htaccess` (F2) 404-блокирует все не-сайтовые пути. Живая проверка
  CSP / `.htaccess` / превью админки — после ближайшего деплоя
  владельца (F6).
- [ ] (изменилось) GitHub OAuth App для входа в админку актуален
  только при возврате на Netlify; на Beget вход — fine-grained PAT
  (`docs/admin-guide.md`).
- [ ] Создать GitHub OAuth App для входа в админку и добавить переменные в
  Netlify — пошаговая инструкция в журнале итерации D ниже. До этого вход
  работает по fine-grained PAT (запасной путь, см. `docs/admin-guide.md`).
- [ ] Заполнить русские тексты кейсов через админку (сейчас RU = EN,
  плейсхолдеры). Гайд: `docs/admin-guide.md`, раздел 2.
  (2026-06-13: владелец сделает сам; агент готовит только инфраструктуру
  индексации RU, объём перевода meta/UI — уточняется в F4.)
- [ ] В Claude Code выполнить: `/plugin marketplace add openai/codex-plugin-cc`,
  затем `/plugin install codex@openai-codex`, `/reload-plugins`, `/codex:setup`.
  `/codex:setup` попросит авторизацию OpenAI (ChatGPT-логин или API-ключ).
  Codex CLI уже установлен глобально (`npm install -g @openai/codex`, 2026-06-10).
- [ ] Smoke-тест живой Codex-сессии после мержа итерации A (поведение Codex
  не должно измениться) — осталось с итерации A.

## Состояние проекта (финальный handoff, итерации G–H)

**Готово.** Все 9 итераций (0–H) реализованы и находятся в draft PR:

- Контент сайта извлечён в `content/*.json`; генератор
  (`scripts/generate-content.mjs`) детерминированно собирает
  `js/cards-data.js`, `js/fa-data.js`, `js/i18n-data.js`, GEN-регионы
  `index.html`/`free-assets.html` (cards-grid, filters, head-meta, jsonld,
  fa-filters) и `sitemap.xml`. Golden-тест и валидатор охраняют
  эквивалентность.
- CI-конвейер `content-publish.yml`: правка `content/**` в `main` →
  регенерация → verify (0 FAIL) → bot-коммит; при провале — авто-revert.
- Админка `/admin/`: вход (GitHub OAuth / PAT), тексты RU/EN, мета-теги и
  OG, медиа (фото/`.webm`/Vimeo/GLB) с cache-bust-именами, порядок карточек
  и блоков (drag-and-drop + клавиатура), вкл/выкл кейсов и категорий,
  экран «Free Assets» (тексты/архив/фон, замена GLB-превью и SVG-постера,
  вкл/выкл и порядок ассетов и категорий каталога), предпросмотр черновика
  на настоящем сайте, публикация одним atomic-коммитом с ожиданием вердикта
  конвейера.
- Гайд владельца: `docs/admin-guide.md` (по-русски, 7 сценариев,
  13 скриншотов).
- Двойная обвязка Claude+Codex: 17 скиллов (включая новый
  `codex-studio-admin-rules`), зеркало `.claude/` генерируется
  `npm run sync:harness`, паритет — гейтом `check:parity`.

**Известные ограничения (собраны из deferred всех итераций):**

- Vimeo privacy-hash (unlisted-ролики `vimeo.com/<id>/<hash>`) не
  поддерживается — только публичные ролики/цифровые ID (итерация E).
- `og:image:width/height` захардкожены 1200×630; подсказка «1200×630» в
  админке — только текст, реальные размеры загружаемой картинки не
  проверяются (итерация E).
- Free Assets: предпросмотр черновика покрывает только `index.html` —
  каталог проверяется на сайте после публикации (подсказка есть на экране);
  ZIP-архивы через админку не загружаются (лимит GitHub 100 МБ на файл,
  поле `file` — только имя в `downloads/`); счётчики «N assets»
  на tag-карточках пересчитываются генератором автоматически из видимого
  числа ассетов (code-review итерации H, батч 1 — ручная правка больше
  не нужна);
  name/description/encodingFormat JSON-LD ItemList каталога — SEO-копи,
  литералы в генераторе (ключ — id ассета), остальное выводится из content.
- Ручной порядок блоков: стартует с авторского порядка файлов (не с seeded-
  раскладки), ряды идут «два высоких, затем два широких подряд» — правило
  чередования автоматики не применяется (итерация F). Предпросмотр закрывает
  этот чёрный ящик.
- Golden-фикстуры пинят ТЕКУЩИЙ контент: после легитимной публикации их
  пересобирает CI; локально `scripts/capture-content-golden.mjs` гонять
  только при намеренном обновлении эталона (итерация B).
- ~~Тех-долг: нет `.gitattributes`~~ — закрыт в кампании (итерация F1):
  добавлен `.gitattributes` с `* text=auto eol=lf` + binary-маски;
  индекс уже был 100% LF, ренормализации не потребовалось.
- ~~Pre-existing флак preloader-смоука~~ — закрыт в F1: порог теста
  поднят 2200→3500мс при инварианте «строго меньше 4000мс задержки
  превью» (контракт «прелоадер не ждёт ленивые превью» сохранён).
- `i18nOverrides` кейса не переезжают при перестановке слотов/motion-блоков;
  сегодня существуют только не зависящие от порядка overrides (итерация F).
- Чистка осиротевших ассетов (заменённые файлы накапливаются в репозитории
  под старыми именами) — отдельная maintenance-задача (итерация E).

## Журнал сессий

### 2026-06-13 — Сессия 5 (Claude Code): F4-tail — завершение хвоста F4

Ветка `codex/prod-f4-seo-i18n-tail` от main (F1–F4 влиты). Закрыты все 8
оставшихся пунктов F4 (журнал F4 выше, раздел «Осталось в F4»). Оркестрация:
3 постоянных фоновых агента-стража на Opus 4.8 (spec-guardian / code-reviewer /
cleanliness) + workflow `f4-tail-code-review` (7 finder-углов → verify) + Codex
adversarial (`codex exec review --uncommitted`). `verify-frozen` 135→**135**
(чек `B2-UI_STRINGS-namespaces` 15→16 namespaces; `N4-game-persists-after-lang-switch`
теперь сверяет content-derived RU-строку).

Отгружено (батчами, verify после каждого):

- **count→i18n** (E-12/A1-12/A2-02 + часть A2-06/E-11): новый namespace `count.*`
  с плюрал-формами `{one,few,many,other}` (en+ru, leaf-parity), хелпер
  `I18N.tCount(key,n)` через `Intl.PluralRules` (en→one/other, ru→one/few/many);
  `updateCount` (main.js) ветвится FA→«categories» / index→«projects» и
  пересчитывается на `i18n:changed`; `faCountText` (free-assets.js) у обоих
  сеттеров `#fa-view-count`, рефреш на смене языка через `applyGameFilter`.
  EN-вывод байт-в-байт. verify N4-after-lang-switch обновлён под RU.
- **empty-state i18n** (A1-20/A2-03): namespace `empty.*`; видимый `.cards-empty`
  на index (вне GEN-региона, CSS `body.filter-empty`, БЕЗ `role=status` —
  озвучивает `#cards-count`), FA `setGridEmptyState` через i18n.
- **fs-aria** (A1-13): `refreshFsLabels()` переводит aria/ title fullscreen-кнопок
  (close/prev/next/zoom×4) при создании оверлея и на `i18n:changed`; ключи
  `fs.zoom*`.
- **chip.remove**: мёртвый ключ удалён (трассирован — кнопка-крестик chip'а
  внутри `aria-hidden`, без aria-label), `chip` убран из B2-namespaces.
- **A2-05**: провизорный первый рендер не штампует `?lang` в URL/ссылки до
  settle; `userSettled` блокирует поздний geo от перетирания явного выбора.
- **A1-17**: смена языка при открытом кейсе сохраняет 2D-позицию скролла
  (`opts.langRefresh`); 3D/blueprint-панель пересобирается (её aria-лейблы
  ставятся императивно через `I18N.t`, rebuild нужен для перевода).
- **E-05**: FA JSON-LD больше не подставляет OG-картинку как `thumbnailUrl` у
  ассетов без обложки (omit вместо faOg); тесты content-visibility 8/13
  инвертированы. `numberOfItems`=25 оставлен по дизайну (A2-15 принято).
- **E-15**: дропдаун-фильтр `role="listbox"`→`role="group"`, `aria-multiselectable`
  и `role="option"` сняты (нативные чекбоксы — интерактив внутри option был
  нарушением ARIA); статичные панели + генератор `filterOptionLine`.

Ревью-итог: spec-guardian / cleanliness — NO FINDINGS; code-reviewer — 0 high/med
(2 low). Workflow + Codex нашли и **исправлены**: (1) лишний `i18n:changed` на
EN→EN geo-settle (редизайн `applyLang`: `lastAppliedLang` ставится и в provisional,
dispatch только при реальной смене, ссылки штампуются безусловно на settle);
(2) empty-state `role=status` с display-toggle не озвучивался → снят (озвучивает
счётчик); (3) langRefresh сбрасывал scroll на 3D/blueprint-вкладке → restore
только при `currentViz==='2d'`; (4) **Codex P2** — langRefresh замораживал
JS-лейблы 3D/blueprint → rebuild возвращён (A1-17 сужен до сохранения скролла).

Принятые ограничения: blueprint title-block при langRefresh берёт перевод из
rebuild (как и 3D); ремаунт 3D при смене языка НА 3D-вкладке сохранён намеренно
(лейблы `viz.*` ставятся через `I18N.t`, не `data-i18n-attr` — декаплинг отложен).
`numberOfItems`=25 (SEO-призрак, документировано). Stale `aria-multiselectable`
в `references/claude-original/` не трогаем (AGENTS.md: архив stale-when-conflicting).

Гейты: `codex:ship` exit 0 (verify 135/135, plugin, governance, parity,
content:check, golden 2/2, verify-fatal); `test:content-validate` (8/13 обновлены),
`site-smoke` 6/6 (axe a11y-бюджет чист), `test:admin` (preview через `applyLang`)
4/4. Golden пересобран дважды (i18n-словарь + `.cards-empty` markup).

Следующий шаг: draft PR F4-tail, затем F5 (`codex/prod-f5-deferred`, stacked).

### 2026-06-13 — Сессия 4, продолжение: F4 — SEO/i18n RU/a11y/deploy (в работе)

Ветка `codex/prod-f4-seo-i18n` (stacked на F3 PR #48), **draft PR #49**.
План — 4 агента Opus 4.8 (`f4-plan` workflow). Детерминированная инфра
применялась батчами, gate-green коммиты + push, verify-frozen 134→**135**
(новый чек `F1-jsonld-contentsize-files`).

Отгружено (коммиты на ветке):

- **Download-hiding + честный размер** (A2-01/E-02/F-03): генератор кладёт
  `hasFile` в FA_DATA + `formatBytes`, JSON-LD contentSize/contentUrl только
  при наличии архива; рантайм `free-assets.js` скрывает кнопку при `!hasFile`.
- **SEO-мета**: hreflang x-default/en/ru (оба head), twitter:image:alt
  (reuse ogImageAlt), Organization.logo → `ogImages.orgLogo`
  (apple-touch-icon + валидатор), llms.txt refresh.
- **sitemap RU**: `?lang=ru` URL + xhtml:link alternates (EN-блок первый —
  F1-sitemap-* regex зелён).
- **a11y/deploy**: сняты role=banner/contentinfo (E-14); CSP-safe `404.html`,
  `.htaccess ErrorDocument`, netlify redirect→/404.html, и /assets cache
  downgrade (E-18).
- **RU-перевод** (translation-workflow, 5 агентов): meta 18 строк + i18n-ui
  83 ключа; тексты кейсов УЖЕ были переведены (E-13). EN-база нетронута
  (golden cards-data без изменений). NB: i18n-ui-агент по ошибке правил файл
  ОСНОВНОГО репо — перенесён в worktree, основной восстановлен.
- **Placeholder-архивы** (запрос владельца): 19 ZIP-заглушек (README внутри)
  для отсутствовавших файлов → все 25 ассетов показывают рабочий Download,
  честные размеры; владелец заменит реальными позже (через админку).

Скрытый баг, пойман и исправлен: E-06-валидатор orgLogo ломал self-тест
`content-visibility` (он НЕ в pre-commit/pre-push, только quality:deep) —
фикстура дополнена orgLogo + ассерт logo→orgLogo.

**Осталось в F4** (доделать в #49; спеки — в прогоне `f4-plan` workflow):
экстернализация count-строк (E-12/A1-12/A2-02: «N projects/assets», FA
«categories») + fs-zoom-лейблы (A1-13) + empty-state i18n + удаление
dead-ключа `chip.remove` (+ убрать `chip` из B2-namespaces в verify-frozen);
A2-05 (provisional-lang URL); A1-17 (lang-refresh openCase); E-05 (FA-JSON-LD
thumbnail honesty + тест content-visibility сценарии 8/13); E-15
(listbox/option). Затем ревью-workflow + `/code-review` + Codex adversarial.

**Новый запрос владельца (→ F5/admin):** добавить в админку **замену
логотипа** (сейчас нельзя). `ogImages.orgLogo` теперь content-поле
(meta.json) — нужен upload-слот на экране «Мета-теги» (admin/js/ui.js +
state.js, тот же media-flow, что у OG-картинок). **E-08** (manifest-иконки
192/512/maskable) остаётся отложенным — нет исходной брендовой иконки в этих
размерах (есть 16/32/180); как появится — генерируем (или после
admin-замены логотипа владелец зальёт сам).

### 2026-06-13 — Сессия 4 (Claude Code): F3 — рантайм сайта

Ветка `codex/prod-f3-site-runtime` от main (`a42d4fe`, F2 влита PR #47).
Вводные владельца: деплой репо→Beget уточнён (ручной полный архив с
очисткой — `.htaccess` доезжает каждым деплоем); RU-тексты владелец
заполнит сам, агент готовит инфраструктуру + черновики в F4; кампанию
вести без пауз, 4 draft PR стопкой (F3→F4→F5→F6); ревью `/code-review`
и Codex adversarial в конце каждой итерации; оркестрация на Opus 4.8.

Оркестрация: workflow `f3-analyze` (агент-карта frozen-инвариантов +
4 кластерных аналитика на Opus 4.8) выдал apply-ready патч-спеки против
ТЕКУЩЕГО кода (R0-номера строк устарели после F1/F2); правки применены
батчами по непересекающимся файлам, verify-frozen после каждой (post-edit
хук). Затем workflow `f3-review` (4 агента: spec-guardian/корректность/
a11y-perf/чистота) + Codex adversarial через `codex:rescue`.

Закрыто ~40 находок реестра (полный свод, deferred и ревью —
`docs/agent/prod-review/findings.md`, раздел «Итерация F3»):
A1-02/03/04/05/06/07/08/09/10/11/14/16/18/19/20(hook), A2-08, E-17, E-23
(`js/main.js`); A2-03/04/07/09/10/11/12/13/14 (`free-assets.js`/
`animations.js`); B-01/02/03/05/06/07/14/08/09/15/16/18, E-24 (css/html).

Исправлено по ревью ДО коммита: A1-19 (таймер COPY LINK на кнопке, без
конфликта desktop/mobile), A2-12 (pause внутри IO — off-screen footer
переводим), **A1-02 async-гонка** (Codex HIGH: `autoRotate` на создании
вьюера гард `currentViz==='3d'` — уход с вкладки во время загрузки модели
больше не стартует фоновый rAF).

Перенесено в F4: A1-17 (lang-switch scroll/3D remount), A2-05 (provisional
lang URL), видимый empty-state + его i18n (A1-20/A2-03), chip.remove
cleanup. Accepted: B-04 (мёртвый CSS, post-prod). Отклонено: B-19
(false-positive — комментарии о брейкпоинтах уже корректны).

Гейты: `codex:ship` exit 0 (verify-frozen 134/134, 0 FAIL; plugin 37/37,
governance 0, parity 19/19, content:check, golden 2/2, verify-fatal).
Технота окружения: worktree без своего `node_modules` — `test:verify-fatal`
падал на резолве `playwright` из temp-копии (NODE_PATH=worktree/node_modules);
починено junction'ом на `node_modules` основного репо (gitignored, к репо
отношения не имеет).

Следующий шаг: draft PR F3, затем F4 (`codex/prod-f4-seo-i18n`).

### 2026-06-12 — Сессия 3, продолжение 2: F2 — безопасность

Ветка `codex/prod-f2-admin-security` от main (PR #45/#46 смержены
владельцем). Вводные от владельца: деплой на Beget — РУЧНОЙ (архив
репо с GitHub → распаковка в файловое пространство с полной
очисткой), значит `.htaccess` доезжает с каждым деплоем, а на проде
раздавался ВЕСЬ репозиторий (новая находка F-06, подтверждена
HTTP-200 на /docs/, /content/, /AGENTS.md и т.д.).

Сначала — adversarial-ревью смерженного F1 независимым агентом:
контракт выдержал атаку, но найден high-баг моего же E-03-фикса
(`contentLastmod()` ломал `--check` после любого нового
content-коммита — включая путь auto-revert) + дыра гарда
(modelStats). Оба закрыты здесь же (ADV1-1, ADV1-2 в реестре):
`--check` сравнивает sitemap по модулю lastmod (протестировано
подменой даты), гард расширен.

Сделано в F2 (всё — по реестру):

- **A1-01/C-01 (high)**: stored XSS закрыт — escapeHTML во всех
  innerHTML-билдерах кейса (mediaItemHTML/textFullHTML/rowTallText/
  buildInfoHTML); inline-onerror заменены делегированным
  error-листенером (минус CSP-блокер).
- **C-04/E-22/F-02/F-06**: новый корневой `.htaccess` —
  security-заголовки, СТРОГИЙ CSP, кэш-политика, Options -Indexes,
  RedirectMatch 404 на все внутренности репо; `admin/.htaccess` —
  no-store, X-Robots-Tag noindex, CSP-надмножество (srcdoc-превью
  наследует политику). Локальная обкатка CSP (Playwright: index с
  3D-вкладкой/wasm/motion-скроллом, FA с mini-3D, админка) —
  0 нарушений; обкатка поймала реальный блокер: GLTFLoader тянет
  blob-текстуры через fetch → connect-src blob:.
- **C-05**: model-viewer 4.0.0 self-hosted (js/vendor/), декодеры
  запинены на локальные пути; visual-regression блокирует и
  локальный путь (baselines стабильны).
- **C-MIRROR + D-09 + C-08**: зеркало валидации админки дозаполнено
  (`<>`/control-гард, cardOrder-дубли, og-конвенция, ogLocale,
  featuredWorks, tagCard, FA-id-дубли и др.); перестановка слотов
  блокируется при индексных i18nOverrides; publish-план ассертит
  префиксы content/ и assets/.
- **C-06/C-07/E-20**: admin-guide — PAT объявлен основным входом на
  Beget; netlify.toml понижен до preview-контура (мёртвый паттерн
  `/*.html` заменён явными страницами).

Известное ограничение (ADV1-3, осознанный trade-off): транзиентный
сбой recapture-шага конвейера откатывает легитимную публикацию —
владелец публикует повторно (до F1 сбой молча ломал инвариант, что
хуже).

Кросс-ревью F2 до коммита: `/security-review` — 0 уязвимостей;
`/code-review` (high) нашёл 2 критических бага конфигурации
(.htaccess блокировал /content/ для админки; admin-CSP ломал
srcdoc-превью) и 7 поменьше — все исправлены в этой же итерации,
реестр: раздел «Кросс-ревью F2» (CR-1…CR-9). Обкатка CSP после
фиксов — снова 0 нарушений. Добавлен governance-гард: пересчёт
CSP-хэшей inline-кода и наличие vendor model-viewer проверяются на
каждом codex:ship.

Финальные гейты F2: verify 134/134, test:admin 20/20, test:browser
6/6, test:content-validate, check:governance — зелёные.

Следующий шаг: draft PR F2, затем F3
(`codex/prod-f3-site-runtime`) — находки A1-02…A1-21, A2-02…A2-14,
B-01…B-19 батчами. На F6 — живая проверка CSP и превью админки
после ручного деплоя владельца.

### 2026-06-12 — Сессия 3, продолжение: F1 — контрактный слой

Ветка `codex/prod-f1-contract` (stacked на R0). Закрыты находки
потока D + C-02/C-07/E-03 + три deferred-пункта. Свод:

- **D-01 (high)**: новый `scripts/content-expectations.mjs` — общий
  вывод видимых кейсов/FA-категорий из content; используют
  `capture-content-golden.mjs`, `content-golden.spec.mjs`,
  `site-smoke.spec.mjs`, `admin-smoke.spec.mjs` (вместо литералов
  18/8/4). Workflow: recapture-шаг получил `continue-on-error` и
  включён в revert/report-условия — упавший recapture больше не
  оставляет main без регенерации и отката.
- **D-02**: floor `B1-data-i18n-attr-floor` (index) выводится из
  content: 32 base + 3×карточки + 2×фильтры (= прежние 100 на полном
  каталоге).
- **C-02/D-05**: `j()` экранирует `<`/U+2028/U+2029 (JSON-LD
  breakout закрыт); вывод байт-идентичен на текущем контенте.
- **C-03/D-06 (server-часть)**: валидатор отклоняет `<>` и
  control-символы во всех HTML-эмитируемых кейс-полях (включая
  i18nOverrides-листья) и control-символы в head-meta-полях.
- **D-03**: конвенция og-basename перенесена в `validateMetaImages`;
  тест-сценарий №8 разделён на 8a (cache-bust, позитив) и 8b
  (кросс-своп отклоняется). Старый сценарий «своп» противоречил
  пинам verify-frozen — противоречие было невидимо, потому что тест
  не гонял verify.
- **D-04**: ogLocale — enum `en_US|ru_RU` в валидаторе.
- **C-07**: guard workflow якорится только на bot-автора.
- **E-03**: lastmod sitemap = дата последнего content-коммита из
  git (фолбэк — старый литерал); sitemap регенерирован
  (2026-06-11).
- **Deferred закрыты**: `.gitattributes` (`* text=auto eol=lf`,
  индекс уже был LF — без ренормализации); флак preloader-смоука
  (порог 2200→3500мс при гейте «<4000мс»; на прогоне тест занял
  3.4s — старый порог флакнул бы); текст про ручные счётчики FA в
  этом handoff обновлён.
- **D-09 переразмечен в F2**: ремап `i18nOverrides` при reorder —
  точная локация `admin/js/ui.js:1576-1606` (`moveMediaSlot`/
  `moveMotionBlock` не ремапят оверрайды).
- Технота сессии: в инструментах агента `\uXXXX`-эскейпы в
  аргументах декодируются JSON-слоем — control-regex в генераторе
  пришлось писать через PowerShell-композицию; регэкспы покрыты
  eslint-disable `no-control-regex` с обоснованием.

Гейты F1: `codex:ship` exit 0 (verify 134/134, 0 FAIL),
`test:content-validate` (все сценарии + 2 новых),
`test:golden` 2/2, `test:browser` 6/6, `test:admin` 20/20,
`check:js` чистый. Изменённые зоны: scripts/, tests/quality/,
verify-frozen.js (1 чек), .github/workflows/content-publish.yml,
.gitattributes, sitemap.xml (regen).

Следующий шаг: adversarial-ревью F1 (frozen-зона), затем итерация
F2 (`codex/prod-f2-admin-security`): XSS-фиксы main.js (A1-01),
зеркало валидации админки (C-MIRROR, C-03), D-09, cms-auth/SCOPE
доки (C-06), `.htaccess` с security-заголовками и строгим CSP
(C-04, инвентарь в реестре) + no-cache `/admin/`, C-08.

### 2026-06-12 — Сессия 3 (Claude Code): R0 — глобальное pre-production ревью

Старт кампании «Pre-production: полное ревью и зачистка багов»
(план итераций — в разделе «Pre-production кампания» выше). Ветка
`codex/prod-r0-review-register`, read-only итерация: код не менялся,
создан реестр находок `docs/agent/prod-review/findings.md`.

Проведено 7 параллельных ревью-потоков: A1 (main.js + index.html),
A2 (free-assets/animations/i18n JS), B (CSS), C (безопасность
админки/auth/CI), D (контракт генератор↔verify-frozen↔content),
E (SEO/i18n/a11y/deploy), F (живой сайт codex.promo). Итог: ~66
уникальных находок после дедупликации, из них 1 critical, 7 high.
Полные детали, триаж и назначение по итерациям — в реестре.

Ключевые открытия:

- **Прод-хостинг — Beget, не Netlify** (DNS 45.130.41.162, функция
  cms-auth на проде 404, `/admin/` за beget-заглушкой). OAuth-вход
  админки на проде работать не может (только PAT); `netlify.toml`
  на проде инертен. При этом файлы сайта на проде байт-в-байт
  совпадают с main — деплой-синк работает. Вопрос владельцу #1.
- Stored XSS в рендере кейса (innerHTML без escapeHTML) и breakout
  из JSON-LD через `j()` без `<`-эскейпа — две high-дыры, фиксы в
  F2 и F1.
- Golden-capture жёстко ждёт 18 карточек — скрытие кейса через
  админку ломает publish-конвейер без авто-revert (high, F1).
- 21 из 25 ZIP-архивов Free Assets отсутствуют (404 на проде),
  существующие 4 — стабы 412 байт; JSON-LD обещает «48 MB».
  Вопрос владельцу #2.
- RU-локаль наполовину плейсхолдер (16/18 строк meta, 119/165
  UI-ключей RU=EN) и невидима для поисковиков (нет hreflang).
  Вопрос владельцу #3.

Решения владельца, зафиксированные на старте кампании: deferred-лист
включаем весь (кроме внешней инфраструктуры: ZIP-хранилище, Vimeo
API, откат-UI, GitHub App); итерации мержатся в main по готовности;
security-заголовки — полный набор включая строгий CSP с обкаткой.

Baseline-гейты на чистом дереве: `verify` 0 FAIL; `quality:fast`
зелёный (после `npm install` в worktree — отсутствовал
`@cspell/dict-ru_ru`, env-проблема, не репо); `check:a11y` 0/0
ошибок; `check:lighthouse` PASS (index perf=95, FA perf=78 c
LCP 5.5s — кандидат на улучшение в F4, см. E-23).

Ответы владельца получены в той же сессии: остаёмся на Beget
(заголовки/кэш через `.htaccess`, вход по PAT); Download скрываем у
ассетов без файла (честный JSON-LD, авто-включение при появлении
архива); RU индексируем (hreflang + `?lang=ru` + перевод meta).
Открытым остался под-вопрос: механизм деплоя репо→Beget.

Следующий шаг: итерация F1 (`codex/prod-f1-contract`) по находкам
потока D (+ C-02/C-07, E-03, .gitattributes, флак preloader-смоука).

### 2026-06-11 — Сессия 2 (Claude Code): code-review итерации H + фиксы

Прогнан xhigh code-review дифа итерации H (9 finder-углов × до 8 кандидатов,
1-голос verify, gap-sweep): 63 кандидата → 31 после дедупликации → 15
подтверждённых находок (1 high, 6 medium, 8 low) + ~10 чистых дублирований.
Все 15 + cleanup исправлены тремя последовательными батчами (одно рабочее
дерево, непересекающиеся файлы):

- **Батч 1 (сайт + генератор):** #1 stored XSS — рендер метки кнопки загрузки
  через `createTextNode` (`setDownloadLabel`) вместо `innerHTML`, + запрет
  `<`/`>` в `validateFreeAssets`; #2 порядок/видимость категорий каталога —
  сетка tag-карточек вынесена в новый GEN-регион `fa-tag-cards` (первая
  генерация байт-в-байт), `pruneHiddenTagCards` удалён; #6 счётчик сайдбара
  больше не рассинхронизируется (карточки скрытых категорий отсутствуют в DOM
  на сборке); #10 `firstAvailableTag` читает `data-tag` первой отрисованной
  карточки вместо `for..in`; #11 счётчики `faTag.*.count` генерируются из
  видимого числа ассетов (обе локали); generator-cleanup (faEffectiveBase,
  faFilterI18nKey, общий option-хелпер).
- **Батч 2 (verify-frozen):** #3 `FA_CURATED` фильтруется зеркалом
  `FA_JSONLD_COPY_IDS` + новый чек `F1-jsonld-copy-mirror`; #4 порог
  `B1-data-i18n-attr-floor` выведен из видимого контента (35 + 8×категории +
  game) вместо жёсткого 70; #7 `N4-game` помечается SKIPPED, если switch-
  категория целиком game-badged; #13 first-class skip-bucket в `add()`/SUMMARY
  (`X PASS, Y FAIL, Z SKIPPED`); новые инварианты порядка и счётчиков
  tag-карточек. На текущем контенте все проверки проходят, 0 FAIL и 0 SKIPPED.
- **Батч 3 (админка):** #5 блок «файла нет в репозитории» переведён в
  publish-precheck (`State.findMissingFaMediaFiles`, выводится из
  sessionStorage-черновика, staged-загрузки пропускаются, fail-closed) —
  reload больше не теряет блок; #8 HEAD-guard учитывает staged-загрузку;
  #9 rerender только при изменении карты ошибок (нет кражи фокуса);
  #12 бейдж «черновик» в шапке FA обновляется в `renderRows`; #14 кэш
  `stableStringify(base)`; #15 единый предикат видимости
  `State.countVisibleFaAssets`; cleanup (langInput для bg, `walkToParent`,
  `remapListIndex`, общий `tests/quality/fixtures/admin-harness.mjs`).
- Гайд: убрана устаревшая подсказка про ручную правку счётчиков (теперь
  пересчёт автоматический).

Финальное adversarial-ревью комбинированных фиксов: регрессий нет, байт-
идентичность GEN-региона и i18n-data.js подтверждена, `walkToParent`/
`remapListIndex` сверены с HEAD. Гейты: `codex:ship` exit 0 (verify-frozen без
FAIL), `test:admin` все сценарии, `test:golden` без пересъёмки, `test:visual`
без диффов, `quality:fast` зелёный.

Заметки: зеркало `FA_JSONLD_COPY_IDS` (verify-frozen) держать в синхроне с
`FA_JSONLD_COPY` (генератор) при добавлении curated-ассета с SEO-копи — иначе
явно падает `F1-jsonld-copy-mirror`. Тех-долг `.gitattributes eol=lf` остаётся
(prettier на этой машине шумит только по CRLF).

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

### 2026-06-10 — Сессия 5 (Claude Code): итерация G (превью, гайд, полировка)

Сделано (ветка `codex/admin-ig-preview-polish`):

- Превью «как будет» (`admin/js/preview.js` + кнопка «Предпросмотр» в шапке):
  настоящий `index.html` сайта → fetch + DOMParser → мутации под черновик →
  same-origin iframe через srcdoc с `<base>` (относительные пути резолвятся
  в реальные файлы сайта). Мутации: чекбоксы фильтров пересобираются из
  settings-черновика; грид — скрытые кейсы/категории выпадают, порядок =
  cardOrder черновика, тексты/alt/миниатюры черновика (включая blob-URL для
  pending-медиа), карточка вновь включённого кейса достраивается зеркалом
  `buildCardHtml`; теги `<script src=…cards-data.js>` и `…i18n-data.js`
  заменяются inline-скриптами с данными черновика — `main.js` и `i18n.js`
  сайта потребляют черновик как опубликованные файлы. Гибридная стратегия
  данных: кейсы БЕЗ черновика идут байт-в-байт из `window.CARDS_DATA` /
  `window.I18N_DATA` (admin/index.html подключает `../js/cards-data.js` и
  `../js/i18n-data.js`), кейсы с черновиком пересобираются из content-JSON
  зеркалами генератора (`buildRuntimeEntry`/`build*Locale` + `applySparse`
  для `i18nOverrides`). `AdminState.previewDraft(path)` (state.js) отдаёт
  черновик с pending-медиа, подставленными как object-URL. Оверлей: баннер
  «Это предпросмотр черновика…», переключатели RU/EN (вызов
  `iframe.contentWindow.I18N.applyLang` — родная механика сайта),
  Десктоп/Мобильный (390px), «Закрыть», Escape. GSAP/Lenis/прелоадер/3D
  работают в srcdoc без фоллбеков: проверено вручную Playwright-зондом —
  грид виден, case-view открывается, 3D-вкладка рендерит three-canvas
  (lazy `model-data.js` резолвится через `<base>`), консоль чистая.
  Тест `tests/quality/admin-preview.spec.mjs` (включён в `test:admin`):
  черновик RU-заголовка + pending-миниатюра + скрытый кейс → в iframe
  скрытой карточки нет, миниатюра `blob:`, порядок = cardOrder без скрытого,
  RU-переключатель показывает черновичный заголовок, EN — опубликованный;
  geo-зонд i18n (cloudflare trace) в тесте блокируется для детерминизма.
- SEO-долги E/F: новый GEN-регион `jsonld` в обеих страницах + `sitemap.xml`
  стал шестым генерируемым таргетом. `content/meta.json` получил
  `structuredData.featuredWorks` (id+about, валидатор: id существует,
  уникален, about непуст). Генератор собирает: Organization (logo ←
  `ogImages.index`), WebSite/WebPage (primaryImageOfPage ← `ogImages.fa`),
  ItemList главной из featuredWorks ∩ видимые кейсы (позиции
  перенумеровываются, name — живой title кейса; порядок — авторский порядок
  featuredWorks, исторически ≠ cardOrder), ItemList каталога FA
  (numberOfItems ← счётчик content, thumbnail-фоллбеки ← `ogImages.fa`;
  имена/описания — SEO-копи, литералы в генераторе), sitemap `image:loc` ←
  ogImages (lastmod — литерал). Первая генерация всех таргетов байт-в-байт
  (`content:check` OK до пересборки). Кейсы в sitemap не перечислены —
  менялись только image-поля. `verify-frozen.js`:
  `F1-sitemap-free-assets-image` теперь выводится из content (+ симметричный
  `F1-sitemap-index-image`), новый `F1-jsonld-featured-visible` (точная
  последовательность ItemList = featuredWorks ∩ видимые).
  `content-publish.yml`: `sitemap.xml` в detect-diff и `git add`.
  Самотест `content-visibility.test.mjs` +3 сценария: скрытый featured-кейс
  выпадает из ItemList с перенумерацией; своп ogImages тянет logo/thumbnails/
  sitemap; несуществующий id в featuredWorks — ошибка валидации.
- Скилл `codex-studio-admin-rules` (SKILL.md + agents/openai.yaml по формату
  соседей): контракт content-vs-generated, семантика конвейера и golden,
  архитектура админки, media-naming `{base}-{hash8}`, правило «verify-frozen
  выводится из content». `sync:harness` пересобрал зеркало (17 скиллов),
  `check:parity` 0 FAIL, счётчик скиллов в `verify-codex-plugin` (>=9)
  проходит. AGENTS.md: скилл в списке, «sixteen» → «seventeen», Working
  Rules + правило «контент только через content/*.json, GEN-регионы руками
  не трогать»; skill-map.md дополнен.
- Гайд владельца `docs/admin-guide.md` (по-русски, 6 сценариев: вход
  OAuth/PAT; тексты RU/EN; фото и видео+Vimeo; перестановка блоков и
  карточек с объяснением seeded/manual и «двух широких подряд»; выключение
  кейса/категории; предпросмотр→публикация→откат через Netlify «Publish
  deploy» и git-историю). 11 настоящих скриншотов
  `docs/img/admin-guide/*.png` (Playwright 1280×800, GitHub API замокан,
  сессия посеяна в sessionStorage; скрипт пересъёмки —
  `scripts/capture-admin-guide.mjs`); каждый PNG < 300 КБ (превью ужат до
  1024×640/палитра). README.md: короткая секция «Admin Panel» со ссылками.
  cspell: `docs/*.md` добавлен в files.

Решения/заметки:

- 3D-вьювер в превью НЕ отключался — фоллбек «3D доступен после публикации»
  не понадобился (dynamic import и lazy-скрипты резолвятся через `<base>`).
- Пределы fidelity превью: документ собирается из ОПУБЛИКОВАННОГО
  `index.html` (структурные правки страницы вне контента в превью не видны
  до деплоя); карточка вновь включённого кейса строится зеркалом генератора
  (без HTML-комментария и нюансов fetchpriority оригинала); geo-автоязык
  работает как на проде (может сам переключить на RU — это поведение сайта).
- ItemList главной держит порядок featuredWorks (а не cardOrder): текущие
  байты страницы перечисляют apex-frame ПЕРЕД nightshard, что противоречит
  cardOrder — байт-идентичность первой генерации диктует владельческий
  порядок списка. Состав можно менять только через `content/meta.json`.

Верификация: `content:check` (6 таргетов OK, первая генерация байт-в-байт),
`test:admin` (12 тестов, включая превью), `test:golden` без пересъёмки,
`test:content-validate` (9 сценариев visibility/jsonld), `npm run verify`
0 FAIL (sitemap/jsonld-ожидания из content), `check:parity`,
`codex:verify-plugin` 0 FAIL.

Итоговый прогон `quality:all`: всё зелёное, кроме pre-existing флака —
`quality:fast` полностью (verify-plugin, governance, content:check, js/css/
html/markdown/spelling/deps/audit), `check:dead`, `check:duplicates`,
`test:content-validate`, `test:admin`, `check:a11y` (pa11y: errors=0 на
обеих страницах), `quality:governance`, `test:visual` (4/4 без диффов),
`check:lighthouse` (index perf 95 / a11y 100 / seo 100; FA perf 78 /
a11y 100 / seo 100 — PASS бюджетов), `codex:ship` (verify 0 FAIL).
Единственный красный — смоук `site-smoke.spec.mjs` «releases preloader
without waiting for lazy tag previews» (`test:browser` внутри
`quality:deep`): жёсткий бюджет 2200 мс wall-clock; падает на ЭТОЙ машине
и на чистом дереве (проверено `git stash` → прогон → fail → `git stash pop`),
зафиксирован как машинный флак ещё в итерации C. К изменениям итерации G
отношения не имеет.

Следующий шаг: ревью (`/codex:review`) и мерж цепочки draft PR 0 → G;
дальше — шаги владельца из чек-листа выше.

### 2026-06-11 — Сессия 6 (Claude Code): итерация H (Free Assets в админке)

Сделано (ветка `codex/admin-ih-free-assets`, от main с влитыми 0–G):

- Видимость каталога через генератор: новый опциональный `enabled:false` на
  ассетах И категориях `content/free-assets.json` (валидатор — strict
  boolean, зеркально кейсам/фильтрам). `visibleFaCategories()` — единая
  выборка для всех потребителей: выключенные ассеты (и все ассеты
  выключенной категории) выпадают из `FA_DATA`, `FA_LOCALES`, JSON-LD
  каталога (`numberOfItems` и ItemList) и нового региона фильтров;
  категория без видимых ассетов выпадает целиком. Guard «хотя бы один
  видимый ассет» (зеркало кейсового). Плюс: `file` — только plain-имя
  `*.zip` (уходит в `./downloads/`+file и в contentUrl).
- Чекбоксы фильтров FA-страницы оказались СТАТИЧНЫМ HTML (не рендерятся из
  FA_DATA, в отличие от грида) — обёрнуты в новый GEN-регион
  `<!-- CODEX:GEN fa-filters BEGIN/END -->`: 'all' + опция на видимую
  категорию со счётчиком видимых ассетов ('all' считает категории); первая
  генерация байт-в-байт (label'ы из `i18n-ui.json` en.filter.*, mapping
  product→productViz, game→gameAssets литералом в генераторе; наличие
  label'ов видимых категорий проверяет валидатор).
- JSON-LD каталога FA переведён с полного литерала на вывод из content:
  SEO-копи (name/description/encodingFormat) остаётся литералами в
  генераторе, но теперь keyed by id ассета; список = видимые ассеты
  категории `hard-surface` (FA_JSONLD_CATEGORY) в авторском порядке,
  позиции перенумеровываются; `contentSize` = item.size, `thumbnailUrl` =
  эффективный thumb (null → OG-картинка FA), `contentUrl` — только когда
  `downloads/<file>` реально существует. Первая генерация байт-в-байт.
- Tag-карточки категорий — тоже статичный HTML, но в GEN-регион не
  оборачивались (там исторические комментарии и i18n-вёрстка): вместо этого
  `js/free-assets.js` на DOMContentLoaded удаляет tag-карточки категорий,
  отсутствующих в FA_DATA (`pruneHiddenTagCards`), а стартовый тег теперь —
  первая категория FA_DATA вместо литерала 'hard-surface' (при полном
  каталоге поведение байт-в-байт прежнее, проверено golden/visual).
- `verify-frozen.js`: все FA-ожидания из ВИДИМОЙ выборки content
  (`FA_VISIBLE_CATEGORIES`, дефолтный тег = первая видимая категория);
  `TAG-product-switch` → `TAG-category-switch` (цель выводится по образцу
  FILTER_TEST_KEY: первая видимая категория ≠ дефолтной; нет второй —
  «skipped»); N4-game-проверки считают ожидаемое число game-ассетов целевой
  категории из бейджей content; `META-jsonLD-asset-depth` сверяет ТОЧНУЮ
  последовательность фрагментов с видимыми ассетами hard-surface
  (DOM-резолв фрагментов — только когда hard-surface и есть дефолтный тег,
  иначе явный skipped-маркер); `F1-jsonld-contenturl-files` — точное
  равенство с выводимым из downloads/ ожиданием. Деградации помечаются
  «skipped: …», при полном каталоге skip-ветки спят (0 FAIL, маркеров нет).
- Админка: новый пункт навигации «Free Assets» (`#/free-assets`) — группы
  категорий (сворачиваются, порядок = порядок массива) с ассетами: тогл
  видимости (мгновенное затемнение + бейдж, guard последнего видимого
  ассета и категории), ручка ⠿ + кнопки ↑/↓ для ассетов И категорий
  (pending-медиа переезжают через `remapMediaEdits`). Редактор ассета
  (`#/free-assets/<id>`): название/бейдж/подпись категории, описание EN/RU
  бок о бок, список «архив содержит» (добавить/удалить/переставить),
  размер («строка как есть»), имя ZIP (с подсказкой про лимит GitHub
  100 МБ), фон-градиент с живым образцом; медиа — тоглы «3D-превью» и
  «постер» (конвенция: поле отсутствует → файл = id, null → выключено;
  включение удаляет ключ и HEAD-проверкой предупреждает, если дефолтного
  файла нет), drop-зоны GLB (только .glb) и постера (ТОЛЬКО .svg — рантайм
  жёстко подставляет расширение; новое правило MEDIA_RULES.faThumb).
- `state.js`: `stageMedia` получил `valueMode: 'baseName'` (в JSON уходит
  базовое имя `{id}-{hash8}` без папки/расширения, файл — тем же
  cache-bust-конвейером в `assets/models/free/`/`assets/cards/`);
  `deleteValue` (возврат к конвенции «ключ отсутствует»), `discardMediaEdit`
  (сброс pending при выключении тогла), клиентская валидация FA (зеркало
  серверной: непустые поля, contents, base-имена, «нельзя скрыть все»);
  `dropZone` получил `resolveValue` (базовое имя → site-путь для превью).
- Тесты: `content-visibility.test.mjs` +5 сценариев (ассет off → fa-data/
  локали/JSON-LD/счётчики; категория off → чекбокс/ключ/локали; не-boolean
  enabled и кривой thumb-base → ошибки; thumb:null + кастомное base-имя
  эмитятся дословно, JSON-LD-фоллбек на OG; все ассеты off → guard).
  Новый `admin-free-assets.spec.mjs` (6 тестов, GitHub API замокан): RU-desc
  → черновик; тогл ассета (затемнение/бейдж/enabled:false, обратное
  включение чистит черновик); ↑/↓ меняет порядок items; GLB через
  setInputFiles → pending-бейдж + публикация несёт бинарный blob
  `assets/models/free/{id}-{hash8}.glb` и `free-assets.json` с base-именем;
  guard последнего ассета; тогл категории. `test:admin` расширен.
  `test:golden` прошёл БЕЗ пересъёмки фикстур (контент не менялся).
- Доки: `docs/admin-guide.md` — раздел 7 «Free Assets» (тексты, замена
  3D-превью/постера, вкл/выкл, порядок, ограничение про ZIP) + 2 скриншота
  `12-free-assets.png`/`13-free-assets-item.png`;
  `scripts/capture-admin-guide.mjs` получил префикс-фильтр пересъёмки
  (`node scripts/capture-admin-guide.mjs 12,13` — старые кадры не трогаются).

Решения/нюансы:

- Free Assets в превью НЕ входит (предпросмотр собирает только index.html) —
  на обоих FA-экранах есть строка «предпросмотр не поддерживается —
  проверяйте после публикации»; зафиксировано в ограничениях.
- Счётчик в сайдбаре FA («6 projects», `#cards-count`) пишет main.js по
  снапшоту `.work-card[data-category]` ДО удаления tag-карточек — при
  выключенной категории счётчик остаётся прежним (косметика, pre-existing
  механика индексной страницы; сам текст «N projects» на FA — тоже
  pre-existing).
- Счётчики «N assets» на tag-карточках и их подписи — i18n-строки
  (`faTag.*`): при скрытии ассетов владелец правит их в «Текстах
  интерфейса»; на экране FA есть подсказка об этом.
- Повторное включение ассета/категории УДАЛЯЕТ ключ enabled (а не пишет
  true): черновик без других правок снова чистый, JSON не накапливает шум.

Верификация: `content:check` (7 регионов/таргетов OK, fa-filters первая
генерация байт-в-байт), `test:content-validate` (14 сценариев),
`test:admin` (18 тестов, включая 6 новых FA), `test:golden` без пересъёмки,
`quality:fast`, `codex:ship` полностью зелёный (verify 0 FAIL),
`check:parity`, `test:visual` без диффов.

Следующий шаг: ревью (`/codex:review`) и мерж цепочки draft PR 0 → H;
дальше — шаги владельца из чек-листа выше.
