# 16 — HANDOFF · v0.8 GOLDEN

## Codex Studio — Audit & cleanup iteration

> Сводный handoff после полного аудита кодовой базы. Заменяет 13 ранее
> существовавших файлов handoff'ов (09_HANDOFF_GOLDEN_0_4 →
> 15_HANDOFF_v0_7_10). Содержит итоги v0.8 + сжатую хронику v0.4 → v0.7.10
> для непрерывности контекста.

---

## 📦 Версия и статус

- **Версия:** 0.8 (GOLDEN)
- **Дата:** 18 мая 2026
- **База:** v0.7.10
- **Тип итерации:** audit + cleanup (no new features, no architecture changes)
- **Точка отката:** v0.7.10 (последний коммит до 0.8.1: `44dfc5e`)

---

## 🎯 Цель итерации 0.8

Полный аудит и cleanup кодовой базы. Накопилось наследие 10+ итераций
с inline-стилями, мёртвыми правилами, дублированием логики, race
conditions и устаревшей документацией. Задачи:

1. Убрать мёртвый код (CSS-правила, JS-переменные, функции).
2. Устранить логические конфликты (двойные handler'ы, race conditions).
3. Привести код в читаемый вид (мерджи дубликатов, факторинг).
4. Актуализировать документацию (README, .claude/*.md).
5. Сохранить FROZEN-инварианты v0.7.10 (verify-frozen.js 56/56 PASS).
6. Зафиксировать v0.8 как новый golden, отмаркировать точку отката.

---

## 🛠 Хроника правок v0.8 (по итерациям)

Каждая итерация — отдельный коммит на ветке `claude/audit-codebase-v0.8-YWIUz`,
draft PR #10. После каждой — sanity-check (`node --check`, CSS-брэкеты).

### v0.8.1 — Arrow-key conflict + tilt/magnetic decouple

**Файлы:** `js/main.js`, `js/animations.js`, `.gitignore` (new)

- **[H1]** `keydown ArrowLeft/Right` handler в `main.js` теперь
  раннее-возвращается при открытом fs-gallery overlay. Раньше галерея
  и case-nav одновременно перехватывали стрелки → swipe в галерее
  параллельно переключал кейс под фуллскрином.
- **[H2]** tilt в `animations.js` и magnetic-cursor в `main.js` оба
  писали `x/y` в `.work-card` через `gsap.to(... overwrite:'auto')`.
  Последний tween покадрово перетирал предыдущий → один эффект
  частично гасил другой. Tilt теперь чисто `rotationX/Y`; magnetic
  единственный владелец `x/y`. Побочный эффект: `LIFT_Y=-4px` и ±2px
  параллакс пропали (всё равно перетирались magnetic'ом).

### v0.8.2 — Dead `.tag*` CSS rules + unused JS vars

**Файлы:** `css/shared.css`, `js/main.js`

- Удалены `.tag`, `.tag:hover`, `.tag:focus-visible`, `.tag--active`,
  `.tag--badge` правила (≈40 строк) — класс мёртв с переезда на
  `.tags-dropdown__*` (v0.15.5). Также удалён `.tag` override в
  mobile-media и `.tag--badge.tag--active ~ *` chain в game-filter.
- Удалены неиспользуемые JS-функции/переменные: `shuffleSeeded()`
  (есть локальный `shuffleInPlace`), `randInt()` в `buildBlueprint`,
  `fsOriginalEl` (писалось, никем не читалось), `currentCategory`
  (инлайнен в `dispatchEvent`; поле `detail.category` сохранено для
  back-compat).
- `.tag` убран из `MAGNETIC_SELECTOR`.

### v0.8.3 — README rewrite + .claude/ footer markers

**Файлы:** `README.md` (переписан), `.claude/*.md` (20 файлов)

- `README.md` переписан под актуальную архитектуру: ссылался на
  несуществующий `css/main.css`, описывал одну CSS-файловую структуру
  вместо реальных 5 (tokens/reset/shared/portfolio/free-assets) и
  пропускал `fa-data.js`, `free-assets.js`, `model-data.js`.
- Footer'ы во всех `.claude/*.md` обновлены через sed:
  `Codex Studio v0.7.10` → `Codex Studio v0.7.10 → v0.8 (in progress)`.
  Только строки `*Версия:` / `*Version:`; упоминания в теле документов
  не тронуты.

### v0.8.4 — Null-check + throttle resize/mousemove + cache cursor

**Файлы:** `js/main.js`, `js/animations.js`

- **[M2]** `codex:case-open` handler в `animations.js` теперь раннее-
  возвращается если `header = caseView.querySelector('.case-view__header')`
  null. Раньше при частично собранном case-view (race на rebuild)
  `header.querySelector('.case-view__meta')` крашился.
- **[M4a]** `updateProgress` на `window.resize` обёрнут в rAF-throttle.
  Раньше каждый resize-tick читал `scrollHeight + clientHeight` →
  layout-thrash на resize-drag.
- **[M4b]** `trackFsCursorZones` / `clearFsCursorZones` теперь
  используют `getCursorEl()` с кешем `cachedCursorEl`. Раньше
  `querySelector('.cursor')` гонялся на каждый mousemove внутри
  fs-overlay (10–100/сек). Инвалидация через `.isConnected`.

### v0.8.5 — CSS cleanup (dead rules + duplicate `.case-view`)

**Файлы:** `css/portfolio.css`

- **[M7]** Удалены мёртвые `.case-tab--soon`, `.case-tab__badge` —
  классы не присутствуют в DOM (3 таба 2D/3D/Blueprints всегда активны).
  Селектор `.case-tab:hover:not(.case-tab--soon)` упрощён до `:hover`.
- **[M8]** Дубль `.case-view { position: relative }` смержен в основной
  блок объявления.
- **[L2]** Удалён `.case-scroll-hint.is-hidden` из chain'а — класс
  нигде не toggle'ится. Скрытие идёт только через `.case-scroll.has-scrolled ~`.
- Брэкеты 293/293.

### v0.8.6 — Merge duplicate `codex:toggle` + env-btn factory

**Файлы:** `js/animations.js`, `js/main.js`

- **[M5]** В `animations.js` были два независимых listener'а на одно
  `codex:toggle` (mobile 4.1, 5 шагов; desktop 4.2, 2 шага). Слиты
  в один handler с `if (isMobile)` веткой; общие шаги [3]
  ScrollTrigger.refresh и [5] scrollIntoView — вне условия.
  ROOT-CAUSE комментарий v0.7.12 сохранён.
- **[M6]** В `main.js` внутри `build3D` два почти идентичных цикла
  создания env-кнопок (desktop envGroup + mobile ddEnvList) — только
  className различался. Вынесено в `createEnvBtn(key, className)`.
  Closure захватывает `currentEnv` (мутация распространяется), `mv`,
  `syncEnvUI`, `ENV_PRESETS`.

### v0.8.7 — Mobile deep-link sidebar + race-proof FA game-switch

**Файлы:** `js/main.js`, `js/free-assets.js`

- **[M3]** На mobile sidebar сворачивался только если deep-link не
  указывал на первую видимую карту. Пользователь приходил по
  `#orbital-mk-ii` (первый кейс) и оставался на cards-screen.
  Заменено на explicit `fromHash` флаг: mobile collapse срабатывает
  на любой валидный hash.
- **[M9]** `applyFilters` в `main.js` обходит ВСЕ `.work-card`. На FA
  tag-cards имеют двойной класс `.tag-card.work-card` → попадают в
  выборку, при `gameOnly=true` скрываются. Clone-replace в
  `free-assets.js` был хрупким (зависел от порядка DOMContentLoaded).
  Добавлен upstream-guard: `gameSwitch && !document.getElementById('fa-grid')`.
  Маркер `#fa-grid` существует только на FA — main.js сам пропускает
  биндинг. Clone-replace оставлен как belt + suspenders.

### v0.8.8a — Extract 18 inline gradients + onerror (index.html)

**Файлы:** `index.html`, `css/portfolio.css`, `js/main.js`

- 18 inline `style="background:linear-gradient(...)"` удалены из
  `.work-card__thumb` (нарушали B2 build-rule).
- 18 inline `onerror="this.remove();"` удалены из `<img>` (то же B2).
- В `portfolio.css` добавлены 18 правил по `data-id`:
  `.work-card[data-id="<id>"] .work-card__thumb { background: ... }`.
  Специфичность (0,3,0) перебивает default (0,1,0) в shared.css.
- В `main.js` добавлен делегированный capture-phase `error` listener
  на `#cards-scroll` — при провале img удаляется, gradient + label
  плейсхолдер остаются.

### v0.8.8b — Extract inline gradients + onerror (free-assets.html)

**Файлы:** `free-assets.html`, `css/free-assets.css`, `js/free-assets.js`

- 6 inline `style=` + 6 `onerror=` удалены из sidebar tag-cards.
- В `free-assets.css` добавлены 6 правил по `data-tag`.
- В `free-assets.js` убран inline `onerror=` из generated string
  fa-card; добавлен делегированный error listener на `#fa-grid` с
  `display:none` (исторически было `.style.display='none'`).
- FA tag-cards покрыты main.js handler'ом из 0.8.8a через двойной
  класс `.tag-card__thumb work-card__thumb` → `closest('.work-card__thumb')`.
- **Не тронуто** `free-assets.js:62` `style="background:" + a.bg` —
  это data-driven inline (22 категории из `fa-data.js`), не static
  HTML inline. Аудит M10 фиксировал только static.

### v0.8.9 — Final polish + archive

**Файлы:** `js/fa-data.js`, `free-assets.html`, `css/shared.css`,
старые handoff'ы (удалены), новый `16_HANDOFF_v0_8.md`

- **[L4]** В `fa-data.js` задокументирован data-gap: 8 из 25 FA-id
  не имеют SVG-thumb в `assets/cards/`. Эти карточки корректно
  показывают только bg-gradient (img удаляется error-handler'ом).
  Это data-issue, не код-баг.
- **[L5]** На FA sidebar game-switch добавлен `title` tooltip и
  `aria-describedby="game-switch-hint"` со `<span class="sr-only">`.
  Семантика свитча на FA отличается от index (фильтрует grid внутри
  выбранной категории, не сами категории) — теперь объяснено для
  пользователя и screen-reader. `.sr-only` utility добавлен в
  `shared.css`.
- **Архивация:** удалены 13 старых handoff-файлов (09–15_HANDOFF_v0_7_*).
  `08_ITERATION_HISTORY.md` оставлен как историческая хроника фаз.

---

## 📋 Хроника предыдущих итераций (v0.4 → v0.7.10)

Краткая выжимка для непрерывности контекста. Подробные оригиналы
удалены — git-история и `CHANGELOG.md` содержат полный диктант.

### v0.4 GOLDEN (02.05.2026) — Стабилизация перед основной работой

- Закрыто 17 находок аудита: inline-style → `css/free-assets.css`,
  удалены `!important` вне reduced-motion, добавлены manifest + OG
  для FA, фикс навигации (`id="logo-back-portfolio"`), `&amp;` → `&amp;amp;`.
- `verify-frozen.js` расширен с 22 до **56 тестов** на обе страницы.
- Lighthouse A11y 100/96. Известная проблема: LCP index 10s из-за
  inline GLB 1.1 MB.

### v0.5 GOLDEN (02.05.2026) — Performance + Accessibility

- **ROOT CAUSE LCP 9.9s:** `model-data.js` 1.1 MB загружался синхронно.
  Lazy-load на первом 3D-клике → LCP 9.9s → 4.2s (−57%).
- `css/main.css` (96.6 KB) разделён на `shared.css` + `portfolio.css`.
- 24 `<article role="button">` → `<a href="#id">` (бонус: shareable URLs).
- Lighthouse A11y 100 на обеих страницах.

### v0.6 GOLDEN (02.05.2026) — Bugfix + polish

- **Z1**: FA dropdown-фильтр не работал — несовпадение `data-tag`/`data-category`.
- **Z2**: миграция домена `codex.studio` → `codex.promo` (26 точек в 5 файлах).
- **Z3**: case-item media `aspect-ratio` + `clamp` вместо хардкода.
- **Z6**: theme-color single-tag (split вызывал FOUC).
- **Z7**: scroll-hint chevron как DOM-элемент.
- **Z8**: mobile case-share сломан CSS-cascade → fix через double-class.

### v0.7.1 (03.05.2026) — IBL HDR Lighting + file:// CORS guard

- Phase 1 3D-апгрейда: HDR environment (Studio/Outdoor/Dark) +
  exposure slider 0.5–2.0 через `<model-viewer>` атрибуты. 3 HDR
  файла CC0 polyhaven.
- **ROOT CAUSE** «MODEL UNAVAILABLE» при двойном клике: `file://`
  блокирует cross-origin fetch HDR → graceful fallback на
  `environment-image='neutral'` + скрытие HDR-controls на `file://`.

### v0.7.2 (03.05.2026) — Phase 2 abandoned **[REVERT]**

- Попытка апгрейда model-viewer 4.0.0 → 4.2.0 + import map three.js +
  effects 1.5.0 (bloom/SSAO).
- **ROOT CAUSE краха**: `model-viewer@4.2.0` импортирует
  `UnsignedInt101111Type`, который есть только в three >0.174 →
  module parsing fail, пустой canvas.
- Откат на v0.7.1 как production. v0.8.0 BLUEPRINT (SSAO → Bloom →
  Color Grade) был сохранён до выхода bundled MV-effects (но в
  итоге v0.8 пошёл по пути audit/cleanup, не 3D-эффектов).

### v0.7.3 (03.05.2026) — Mobile/tablet 3D controls cleanup

- ≤1023px: STUDIO/OUTDOOR/DARK + EXPOSURE схлопнуты в один dropdown
  с trigger-лампочкой. Desktop ≥1024 не тронут.
- Двусторонняя sync через `currentEnv` + `syncEnvUI()`, cleanup
  global listeners в `destroy3D()`.

### v0.7.4 (08.05.2026) — Two-fix point release

- **P2**: убран `!important` вне reduced-motion в shared.css.
- **P3**: убран redundant `role="main"` в index.html.
- **REJECTED P1**: theme-color split на media dark/light создавал
  FOUC при `data-theme="dark"` body. Golden 0.4 рекомендация устарела
  (single-tag + JS update корректно).

### v0.7.5 (08.05.2026) — 3D-preview в FA cards

- В каждую `.fa-card` thumb добавлен `<model-viewer>` auto-rotate
  20°/sec. Convention: `./assets/models/free/{id}.glb`.
- Graceful fallback на SVG poster при 404/parse через `loadfailure`
  event + класс `.--failed`.

### v0.7.6 (08.05.2026) — Tablet responsive grid fix

- **ROOT CAUSE** «3 cols по 140-290px на iPad»: `.fa-grid` хардкодил
  `repeat(3, 1fr)`.
- Mobile-first cascade: base 1fr → `min-width:768` `auto-fit
  minmax(320px, 1fr)` → `min-width:1440` cap 3 cols.

### v0.7.7 (08.05.2026) — Planshet case-view overflow fix

- 768-1023px overflow в `.case-view__tabs`: AUTO ROTATION → AUTO,
  MODEL INFO → INFO (dual-span CSS-swap), COPY LINK → icon-only,
  RIGHT MOUSE hint → DRAG · ZOOM.

### v0.7.8 (08.05.2026) — Planshet case-row stacking fix

- На 768-1023 sidebar-OPEN tall-2 сжимались до 216×270.
- `body:not(.cards-collapsed) .case-row` → `flex-direction: column` +
  items 100% width. При collapsed — default multi-col preserved.

### v0.7.9 (09.05.2026) — Wide-screen tall-2 cap **[ОТМЕНЁН в v0.7.10]**

- Попытка: `.case-view max-width: 2220px` на ≥1440px.
- Диагноз root cause был неверным.

### v0.7.10 GOLDEN (09.05.2026) — Revert v0.7.9 + правильный fix

- **REVERT** v0.7.9: cap создавал гигантский void справа на 4K
  (до 1564px пустоты).
- **Настоящий ROOT CAUSE**: `.case-item__media max-width: 1022px`
  ограничивал media, тогда как `.case-item` тянулся `flex: 1 1 0`.
- Fix: scoped override `.case-row--tall-2 .case-item--tall
  .case-item__media { max-width: none; max-height: none }`.

---

## 📁 Изменённые файлы (v0.8 итого)

| Файл | Тип изменений | Δ строк |
|---|---|---|
| `js/main.js` | refactor + bugfix + factory | net −20 |
| `js/animations.js` | dedupe + null-check | net −44 |
| `js/free-assets.js` | guard + delegated error | net +17 |
| `js/fa-data.js` | docs | net +12 |
| `css/shared.css` | dead code + sr-only | net −47 |
| `css/portfolio.css` | dead code + 18 thumb rules | net +0 |
| `css/free-assets.css` | 6 thumb rules | net +14 |
| `index.html` | 18 inline strip | net −37 |
| `free-assets.html` | 6 inline strip + tooltip | net −18 |
| `README.md` | rewrite | net +50 |
| `.claude/*.md` (20) | footer bump | net +0 |
| `.gitignore` | new | new |
| `16_HANDOFF_v0_8.md` | new (этот файл) | new |
| `09…15_HANDOFF_v0_7_*.md` (13) | deleted | −≈170 KB |

---

## 🔒 FROZEN-инварианты (наследованы из v0.7.10)

`verify-frozen.js` — **source of truth**. 56 тестов, должны давать
56/56 PASS. v0.8 правки не затрагивают тестируемые поверхности:
- DOM-структура и количество `.work-card` (18), tag-buttons, case-tabs (3)
- `EXPECTED_IDS`, `EXPECTED_TAGS`, `EXPECTED_FA_TAGS`
- META: canonical, OG complete, twitter complete, JSON-LD, favicon-16,
  manifest, theme-color single tag
- Script order: gsap → ScrollTrigger → main.js → animations.js
- `body[data-theme="dark"]` default, theme toggle
- `B1-no-logo-home`, `B1-logo-back-portfolio`, `B6-chevron-icons`
- `NO-inline-style-block`, `N4-game-keeps-tag-cards`

### Не тронуто (frozen архитектура)

- `:not(.tag-card)` фильтр в `.work-card`-селекторах (ломает FA)
- theme-color single-tag без `media=""` (v0.6 Z6)
- `.case-share--mobile/--desktop` double-class trick (v0.6 Z8)
- fa-grid layout (v0.7.6), case-view UI (v0.7.7)
- case-row planshet stack (v0.7.8), tall-2 media stretch (v0.7.10)
- `.case-item--tall/--wide` (runtime в `main.js`)
- model-viewer 4.0.0 bundled (Phase 2 v0.7.2 revert urok)
- HDR Polyhaven CC0 (`assets/hdr/`) + file:// CORS guard (v0.7.1)

---

## 🐛 Унаследованные нерешённые проблемы (frozen)

Стабильны с v0.7.2, не входили в scope v0.8 audit:

- **Performance**: LCP 2-3s на `index.html` (после lazy-load GLB).
- **Unused CSS**: ~30-40 KiB в `shared.css` (по PageSpeed). Часть
  устранена в 0.8.2/0.8.5, но базовый набор остаётся.
- **`/downloads/*.zip`**: 412 B плейсхолдеры на все 18 архивов.
- **JSON-LD `sameAs`**: `REPLACE_WITH_REAL` массив в обоих HTML.
- **ArtStation/Behance URLs**: `REPLACE_WITH_REAL` href в `main.js:1097-1098`
  (пользователь заменит вручную).
- **8 FA-id без SVG-thumb**: bolt-cluster, terra-base, shard-cannon,
  wraith-blade, echo-shell, prism-lab, wraith-blade-g, shard-cannon-g
  (документировано в fa-data.js v0.8.9 L4).
- **HDR фичи не покрыты `verify-frozen.js`** (v0.4 baseline, до v0.7.1).
- **3D Phase 2 (effects/bloom/SSAO)** заморожен до выхода bundled
  `@google/model-viewer-effects` (см. v0.7.2 ROOT CAUSE).

---

## 🚀 Точка отката

Если v0.8 нужно откатить:

```bash
# Полный откат на v0.7.10 frozen golden
git checkout 44dfc5e -- .
# Или на любую из промежуточных итераций v0.8.X:
# 0.8.1 → 3759059
# 0.8.2 → 7e76c61
# 0.8.3 → 76d90e8
# 0.8.4 → 2c64a72
# 0.8.5 → 59f40f0
# 0.8.6 → 54e6bde
# 0.8.7 → bef847b
# 0.8.8a → 60f2f0c
# 0.8.8b → 65a19b1
# 0.8.9 → этот коммит
```

Все правки в одной ветке `claude/audit-codebase-v0.8-YWIUz`, draft PR #10.

---

## ✅ Pre-merge checklist (что прогнать перед merge в main)

1. `npm install playwright && npx playwright install chromium`
2. `node verify-frozen.js` → ожидание `SUMMARY: 56/56 PASS, 0 FAIL`
3. Manual QA (5 минут):
   - **0.8.1**: открыть кейс с галереей, F11/fullscreen, стрелки
     листают только галерею (под ней кейс не меняется); hover work-card
     — tilt + magnetic видны одновременно
   - **0.8.4**: resize окна интенсивно — нет лагов прогресс-бара
   - **0.8.7**: на mobile открыть `https://codex.promo/#orbital-mk-ii`
     — sidebar должен сразу свернуться, показав кейс
   - **0.8.8a/b**: на обеих страницах thumbnails отображаются с
     gradient backdrop; если SVG не загрузился (8 FA-id) — placeholder
     с gradient остаётся; нет console errors

---

## 🎯 Что делать дальше

После approve PR #10:

1. Merge в `main` (squash или merge — на твой выбор).
2. Tag релиз: `git tag v0.8 && git push origin v0.8`.
3. Закрыть PR #10.
4. Обновить footer'ы в `.claude/*.md` с `v0.7.10 → v0.8 (in progress)`
   на `v0.8 GOLDEN` (sed-операция, 20 файлов).
5. v0.8 = новый baseline для будущих итераций.

---

*Версия: 0.8 · 18 мая 2026 · Codex Studio · Audit & cleanup iteration*
*Заменяет 13 ранее существовавших handoff-файлов (09–15_HANDOFF_v0_7_*).*
