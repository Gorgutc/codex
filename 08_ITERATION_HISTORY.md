# 08 — ITERATION HISTORY
## Codex Studio — Полная история изменений

> Все изменения с самого первого коммита до текущей версии.
> Порядок: от первого к последнему.
> Заморожено = трогать ТОЛЬКО при наличии явного тикета.

---

## ФАЗА 0 — Архитектура / v0.1–v0.5

### v0.1 — Базовый скелет
- Первый вариант: один `index.html`, инлайн CSS
- Sidebar (340px) + main area — сетка `grid-template-columns: 340px 1fr`
- Логотип CODEX, список проектов в сайдбаре
- Нет тёмной/светлой темы, нет анимаций
- Шрифты: Clash Display + General Sans через Fontshare CDN
- Стек зафиксирован: HTML + CSS + JS, без фреймворков

### v0.2 — CSS custom properties / Design tokens
- Введены `tokens.css`, `reset.css`, `main.css` — файловое разделение
- CSS custom properties: `--color-*`, `--space-*`, `--text-*`, `--radius-*`
- Nexus Dark palette: warm #171614 bg, teal `--color-primary: #4f98a3`
- Fluid type scale с `clamp()`: `--text-xs` → `--text-hero`
- 4px spacing system: `--space-1` … `--space-32`
- Базовый `prefers-reduced-motion` в CSS

### v0.3 — Тёмная/светлая тема
- `data-theme="dark"` / `data-theme="light"` на `<html>`
- Тоглер Sun/Moon в header
- Light mode: beige surfaces `#f7f6f2`, dark text `#28251d`
- OKLCH surface layering: `--color-bg` → `--color-surface` → `--color-surface-2` → `--color-surface-offset`
- `@media (prefers-color-scheme: dark)` как fallback без toggle

### v0.4 — Work cards + sidebar scroll
- `.work-card`: thumb 4:3, info (cat / year / title / desc)
- `.cards-scroll`: `overflow-y: auto`, `scrollbar-width: thin`
- Начальный набор: 10 карточек проектов
- Placeholder thumb через `content: attr(data-label)`
- Hover: `border-color` transition 200ms

### v0.5 — Case view scaffold
- `.case-view`: flex column, `padding: 64px 64px 0`
- `.case-scroll`: `flex: 1`, `overflow-y: auto`, top mask через `mask-image`
- `.case-scrolltrack`: flex column, `gap: 64px`
- `.case-item`: wide (100%) / tall (50%)
- Заглушка для контента — placeholder text

---

## ФАЗА 1 — Контент и интерактив / v0.6–v0.9

### v0.6 — Реальный case view контент
- 15 work-cards в сайдбаре: Orbital Mk.II, Vega Shell, Ironclad Frame, Corten Series, Lumen One, Flux Capsule, Nightshard, Recon Drone, Apex Frame, Core Rig, Helix Reveal, Arc Motion, Nyx Panther, Drift Koi, Glint Owl + 3 CAD placeholders
- `.case-viewheader`: category / separator / year / title
- `.case-progress`: 2px progress bar `--color-primary`
- JS: `selectCard()` обновляет case-view, прокрутка к началу

### v0.7 — GSAP базовая интеграция
- GSAP v3.12.5 через CDN (→ позже v3.13.0 в free-assets)
- `gsap.registerPlugin(ScrollTrigger)`
- `.work-card` тilt 3D: `transform-style: preserve-3d`, `perspective: 800px`
- Clip-path reveal на `.work-cardthumb img.is-clip-reveal`

### v0.8 — Scroll snap + masks
- Вертикальный скролл case-view: `scroll-behavior: smooth`
- Top fade mask: `mask-image: linear-gradient(to bottom, transparent 0, #000 56px, #000 100%)`
- `.case-row` layouts: `--wide`, `--tall-1`, `--tall-2`, `--tall-text`

### v0.9 — Responsive case items
- Wide item: `height: 1040px` (cap для 4K)
- Tall item: `max-width: 1022px`, `height: 1100px`
- `@media (max-width: 1022px)` tall-1 → 100% ширина
- Tall-text: 50/50 split `calc(50% - 24px)`

---

## ФАЗА 2 — Расширение видов / v0.10–v0.13

### v0.10 — Tabs 2D / 3D / Blueprints + Case nav
- `.case-viewtabs`: 2D / 3D / Blueprints, высота 32px
- `.case-nav`: prev/next, счётчик (32×44px visual weight)
- `.case-viewactions`: column, align-items flex-end
- `--radius-tag` для таблеток

### v0.11 — 3D view (Google model-viewer)
- `.case-3d`: flex, overflow hidden
- `model-viewer` CDN: `--poster-color: transparent`, `--progress-bar-color: var(--color-primary)`
- `.case-3dcontrols`: AUTO / INFO кнопки с LED-пульсом (v0.11.2)
- `.case-3dinfo-panel`: tooltip с характеристиками модели
- v0.11.4: hint позиционирование bottom→top при `max-width: 640px`

### v0.12 — Blueprints view (SVG)
- `.case-blueprints`: flex column, dark canvas
- SVG части: `.blueprintpart`, `.blueprintdim-line`, `.blueprintcallout`
- `.blueprinttitle-block`: проектный stamp в правом нижнем углу
- Grid: minor/major в `--color-primary` оттенках

### v0.13 — Custom cursor + polish
- v0.13.0: кастомный курсор — кольцо 40px `border-color: --color-primary`, `mix-blend-mode` dot
- v0.13.1: `html.cursor-fine` class — JS определяет `pointer: fine`, скрывает нативный курсор
- v0.13.4: clip-path reveal на work-card thumb (`.is-clip-reveal`)
- v0.13.5: clip-path reveal на case-item media (`.is-clip-reveal-case`)
- v0.13.6: GSAP SplitText на H1 `.case-viewtitle` — `.case-titleword` overflow hidden, `.case-titlechar` transform
- v0.13.7: Theme toggle анимация sun↔moon (scale + rotate)
- v0.13.8: `.case-text` full-width intro block с `border-top/bottom`
- v0.13.8: External link button (ArtStation/Behance) в `case-textheader`
- v0.13.8: Export SVG toolbar над blueprint canvas
- v0.13.8: JSON-LD structured data (Organization + WebSite + ItemList)
- v0.13.8.1: WCAG 2.5.5 AAA touch targets — `.tag` 28px, `.case-navbtn` 44px, margin-right 64px для external btn
- v0.13.8.2: Collapsed sidebar — `cards-toggle` fixed top-right 44×44px, header-top gap 4px, `--color-divider` border
- v0.13.8.3: Blueprint grid golden ratio — minor/major stroke vars; `.case-back` dark/light surface-offset

---

## ФАЗА 3 — Mobile + UX polish / v0.14–v0.15.1

### v0.14.0 — Mobile layout + case-mobile-bar
- Пункты 1–6: мобильная раскладка sidebar fixed, translateX(-100%) при collapsed
- Пункт 7: Contact button — desktop показывает только в sidebar, `contact-btn--case` скрыт
- Пункт 8: cards-toggle SVG chevrons (open/closed иконки) вместо текста
- Пункт 9: `.case-mobile-bar` border на light/dark теме
- Пункт 10: padding site-header `--space-4`
- Пункт 11: case-nav prev/next 28→36px высота, counter `font-size: text-xs`
- Пункт 14: `.sidebarrow` — game-switch + cards-count в одном ряду, border-bottom через `.sidebardivider`
- Пункт 15а: CAD placeholder карточки с `data-cad-placeholder="true"`
- Пункт 16: `logo href=""` + JS preventDefault, чтобы не было hash в URL

### v0.14.1 — Tags & toggle fixes
- Пункт 2: `.cards-toggleicon` translateY(-2px) для visual bearing
- Пункт 3–4: высота top-pill 28→32px

### v0.15.1 — Desktop polish
- 1.1: `.case-mobile-bar` light theme `border-bottom: 1px solid --color-divider`, dark — без border
- 1.2: Mobile collapsed — `cards-toggle` скрыт, `case-back` показан в case-mobile-bar
- 1.3: `media (hover: hover) and (pointer: fine)` — hover state только для desktop мыши
- 1.4: `.case-textmeta-item--role` border-color `#3f3f3f` (не `--color-divider`)
- 1.5: 3D hint desktop "RIGHT MOUSE = ROTATE", mobile "DRAG = ZOOM"
- 2.1–2.3: Fullscreen overlay (`.media-fs`) — Variant B fixed position, `z-index: 9999`
- 2.3: Blueprint toolbar: gap 10px, Export SVG + fs-btn в одном ряду
- 3: `.site-footer` добавлен в sidebar bottom

---

## ФАЗА 4 — Footer, pills, fullscreen / v0.15.2

### v0.15.2 A — Footer pills
- A1: Mobile reveal-on-scroll для footer (desktop — всегда видим)
- A2: `.site-footerstats` — placeholder uppercase caption
- A3: `.site-footerrow--pill` Contact + Free Assets pills — `flex: 1 1 0`, gap 8px, padding 0

### v0.15.2 B — Fullscreen + case controls refinement
- B1: `.case-nav` перенесён внутрь `.case-viewtabs`; 32px высота; `case-navbtn` 30×28px
- B2: Contact pill → из `.site-footer`, убран из `.case-viewactions`
- B3: `.case-media-fs-btn` для 2D — floating expand кнопка
- B4: `z-index: 10001` для курсора, `z-index: 9999` для `.media-fs`; cursor-fine исключает `.media-fs`
- B5: `.case-3dfs-btn` 32×32, svg 16×16

---

## ФАЗА 5 — Responsive fixes / v0.15.3–v0.15.5

### v0.15.3 — Header & mobile layout
- Пункт 1: Contact + Free Assets pill в footer — padding-left/right 0, gap 8px
- Пункт 2: Mobile: 2D/3D tab 36×36px override (`.case-viewtabs .case-tab-2d/3d`); Blueprints height 36px padding 0 16px
- Пункт 3: Desktop case-viewheader `align-items: flex-end` (actions align bottom)
- Пункт 4: Mobile sidebar `translateX` — при collapsed `body.cards-collapsed .sidebar { transform: none; pointer-events: none }`, case-view остаётся; `.site-footer` absolute left/right/bottom
- Пункт 5–6: `.case-3dfs-btn` + `.case-blueprintsfs-btn` 32→36px

### v0.15.4 — Case view padding
- Пункт 1: Desktop top padding 16px (было 64px), остальные края 64px; gap `--space-4`
- Пункт 4: Breakpoint 1100px — padding `--space-8`

### v0.15.5 — Tags dropdown + mobile tabs
- Пункт 1: Mobile case-view header — column layout; 2D/3D 36×36, Blueprints height 36; `.case-nav` flex 1, justify-content space-between
- Пункт 2: Тег-фильтрация — замена `.tags-nav` chips на `.tags-dropdown` (trigger + overlay + panel с checkboxes); OR-логика мультифильтра; chips в trigger при выборе

---

## ФАЗА 6 — v0.2.x / v0.3 (нумерация ветки free-assets)

### v0.2.1 — Dropdown overlay mobile
- Mobile overlay div для dropdown: `position: fixed; inset: 0; z-index: 30`
- `data-open="true"` → overlay становится `display: block`
- Trigger при открытом состоянии: `position: relative; z-index: 35`

### v0.2.3 — Case share button
- `.case-share` — "Copy link to case" таблетка в `.case-viewtabs` (desktop)
- `.case-share--mobile` — в `.case-mobile-bar`
- States: default → hover → `.case-share--copied` (primary border/bg)
- Breakpoint split: desktop `display: inline-flex`, mobile `display: none` и наоборот

### v0.3 — Mobile share icon-only
- Пункт 1: `.case-share--mobile` padding `--space-2` (icon-only 44×44px), label sr-only
- `.case-share--copied` → padding `--space-3`, label `position: static` (COPIED текст появляется)
- Back + share в `.case-mobile-baractions` — `display: inline-flex; gap: --space-2; margin-left: auto`

---

## ФАЗА 7 — Free Assets page / FA v1.0

### FA v1.0 — Первая версия free-assets.html (этот чат, апрель 2025)
**Задача:** создать вторую страницу без изменения `index.html`

**Первая итерация (отклонена):**
- Изначально была сгенерирована страница с собственным header/footer — не соответствовала структуре index
- Карточки использовали отдельную стилизацию вне design system

**Финальная версия FA v1.0:**
- Namespace `fa-` для всех новых компонентов
- Sidebar: идентичен `index.html` — тот же header, tags-dropdown, game-switch, site-footer
- Tag cards (`.tag-card`): идентичны `.work-card` визуально; в sidebar — категории ассетов
- Asset grid (`.fa-view`): зеркалит `.case-view` — padding `16px 64px 0`, gap `--space-4`
- `.fa-scroll` + `.fa-grid`: `display: grid`, `grid-template-columns: repeat(3, 1fr)`, `gap: 24px`, `padding: 24px 0 64px`
- `.fa-card`: thumb 4:3, badge, cat/license, title, desc, contents chips, download button
- Download: `fetch()` → `blob()` → `URL.createObjectURL` → `<a>.click()`; states: Preparing → done / error
- GSAP stagger entrance animation на `.fa-card`
- Mobile: 1 колонка, sidebar collapsible как в index (карточки тегов → cards-collapsed → fa-view)
- Footer: "Portfolio ←" pill вместо "Free Assets →"
- Cursor: тот же паттерн `initCursor()` как в `main.js`

### FA v1.1 — Исправление collapse логики desktop
**Проблема:** кнопка сворачивания показывала сетку ассетов, но не сворачивалась как в index — sidebar оставался видимым
**Fix:** добавлена синхронизация `cardsScroll.hidden = true/false` при `!isMobile` (аналогично index.html)

### FA v1.2 — Исправление grid при collapse (промежуточный, заморожен)
**Проблема:** при проваливании в категорию ассеты сжимались по левому краю и выходили из зоны
**Текущий статус:** ЗАМОРОЖЕН, не применён

---

## ФАЗА 8 — Golden 0.4 — стабилизация перед основной работой / 02 мая 2026

> Цель: финальная подготовка перед получением ТЗ. Полный аудит обеих страниц,
> закрытие всех выявленных проблем, заморозка кода.

### Аудит (Этап 1)

**Инструменты:** Playwright (Chromium 141), Lighthouse (Chrome 131 desktop preset),
html-validate, stylelint. Расширенный self-contained регрешен с встроенным http-server.

**Найдено всего:** 17 проблем (6 BLOCKER + 4 MAJOR + 5 MINOR + 2 NEW от Lighthouse).

### Список фиксов Golden 0.4

#### BLOCKER (free-assets.html)
- **B1:** `id="logo-home"` ломал навигацию назад на portfolio → `id="logo-back-portfolio"`
- **B2:** Inline `<style>` 393 строки в `<head>` → `css/free-assets.css` (новый файл)
- **B3:** `!important` вне reduced-motion → специфичность через двойной класс
- **B4:** Хардкод `rgba(20,20,20,0.72)` → `var(--color-ctrl-bg)` (`#fff` оставлен на primary-bg по AX1)
- **B5:** Отсутствие META/OG/Twitter/JSON-LD/manifest → полный набор + `og-free-assets.jpg`
- **B6:** `«»` → `‹‹››` в cards-toggle (паритет с index.html)

#### MAJOR
- **M1:** `animations.js` ломал tag-cards → `:not(.tag-card)` в 3 селекторах
- **M2:** Лишний inline-style на count-badge → удалён (CSS уже задаёт top/right)
- **M3:** Двойной addEventListener в handleDownload → удалён, проверено динамически (1 fetch на клик)
- **M5:** Один `theme-color` → раздельные для dark/light prefers-color-scheme
- **AX1:** Lighthouse Accessibility 96→100 — solid surface-2 + accent-text + #fff на primary

#### MINOR
- **N1:** Удалён мёртвый `.top-pills` контейнер из main.css (~18 строк, единственный нелегитимный `!important`)
- **N4:** game-switch FA refactor через clone-replace + свой handler (фильтрует grid, не sidebar)
- **HV1:** Redundant `role="main"`, `role="list"` убраны
- **HV2:** Raw `&` в index.html (line 6 `<title>` и line 524 `<p>`) → `&amp;`
- **HV3:** `aria-label` на bare `<span>`/`<p>` убран (игнорируется screen reader)

#### Missing assets
- **MX1:** Создан `assets/favicon/site.webmanifest` + `<link rel="manifest">` в обеих HTML

### Структурные изменения

**Новые файлы:**
- `css/free-assets.css` (400 строк) — стили FA-страницы
- `assets/favicon/site.webmanifest` — PWA-манифест
- `assets/img/og-free-assets.jpg` (31 KB, 1200×630) — OG-изображение для FA
- `09_HANDOFF_GOLDEN_0_4.md` — handoff пакет

**Удалены (устаревшие):**
- `changelog.md` (231 KB), `changelog-v0.2.1.md`, `changelog-v0.2.2.md`, `changelog-v0.2.3.md`, `changelog-v0.3.md`
- `checklist.md` (32 KB)

**Обновлены:**
- `verify-frozen.js`: v0.13.8.3 (22 теста, только index) → v0.4 (56 тестов, обе страницы)
- `index.html`: HV2 fix (encode `&`), `<link rel="manifest">`
- `css/main.css`: удалён мёртвый `.top-pills` контейнер
- `js/animations.js`: 3 селектора с `:not(.tag-card)`

### Финальные метрики

| Проверка | Результат |
|---|---|
| Playwright regression | **56/56 PASS, 0 FAIL** |
| Lighthouse index.html | Perf 54, A11y 96, BP 95, SEO 100 |
| Lighthouse free-assets.html | Perf 85, A11y **100**, BP 95, SEO 100 |
| html-validate index.html | 27 errors → все намеренные `prefer-native-element` (article role=button) |
| html-validate free-assets.html | 8 errors → все намеренные паттерны симметрично с index |

### Известные нерешённые проблемы (для Golden 0.5+)

- **Performance index.html (54):** ограничен `js/model-data.js` 1.1 MB inline GLB — архитектурное решение
- **Unused CSS (~80 KiB):** main.css содержит селекторы для всех состояний (на разных страницах)
- **html-validate `prefer-native-element` errors:** `<article role="button">` нужен для интерактивных карточек со сложной структурой; переход на `<button>` запретит h2/img/p внутри
- **`label-content-name-mismatch` (Lighthouse a11y warning):** `aria-label` карточки начинается с того же текста, но этот warning остаётся Best Practice, не блокер AA

---

## ФАЗА 9 — IBL HDR Lighting / v0.7.0–v0.7.1 / 03 мая 2026

### v0.7.0 — Phase 1 апгрейда 3D-вьювера (попытка 1)

Задача от пользователя: апгрейд 3D-вьювера качества освещения, добавление post-processing,
wireframe overlay в стиле Marmoset. ТЗ изначально предполагало работу с Three.js напрямую,
но был обнаружен критический разрыв: проект работает через Google `<model-viewer>` web component
(закрытый shadow DOM, нет доступа к scene.traverse()).

После ревью ТЗ согласован путь A — IBL + Exposure + Env Switcher на model-viewer
(без архитектурной правки). Wireframe и bloom отложены на отдельные итерации.

**Изменения:**
- В `build3D()` атрибут `environment-image='neutral'` заменён на `'./assets/hdr/studio.hdr'`
- Добавлен environment switcher (segmented control: STUDIO / OUTDOOR / DARK)
- Добавлен exposure slider 0.5–2.0 (default 1.0, step 0.05) → `mv.exposure` property
- Создана папка `assets/hdr/` с README + 3 HDR файла CC0 polyhaven (1k):
  studio_small_08, kloppenheim_06, studio_small_03
- Стили `.case-3d__env-group`, `.case-3d__ctrl--env`, `.case-3d__expo*` в `portfolio.css`
- Mobile responsive: `flex-wrap` на `.case-3d__controls`
- `prefers-reduced-motion` override для `::-webkit-slider-thumb`

**Проблема выявленная пользователем:** при двойном клике на `index.html` (file://) выскакивала
ошибка "MODEL UNAVAILABLE — Не удалось загрузить GLB". Корень: model-viewer пытался fetch
`./assets/hdr/studio.hdr`, браузер блокировал как cross-origin → MV стрелял общий error event.

### v0.7.1 — file:// CORS guard (hotfix)

**Решение:** в `build3D()` детект `window.location.protocol === 'file:'`. Если true:
- `environment-image='neutral'` (как до v0.7.0, procedural без сети)
- HDR-controls (env switcher + exposure slider) **не создаются** в DOM
- `console.warn` для разработчика с инструкцией: "HDR environment maps require an HTTP(S) server"

На `http(s)://` — все HDR-фичи работают.

**Pattern reference:** проект уже имеет аналогичный workaround для GLB —
`window.CODEX_LOCAL_GLB` (data:URI inline в `model-data.js`). Для HDR такой подход
не сработает: 3 файла × 1 MB = ~12 MB base64 в JS, убил бы LCP.

**Решение для разработчика:** переход с двойного клика на локальный сервер:
- VSCode + Live Server (рекомендация)
- `python3 -m http.server 5555`
- `npx serve .`

### Метрики Phase 1

| Параметр | Значение |
|---|---|
| Изменено файлов | 4 (`js/main.js`, `css/portfolio.css`, `CHANGELOG.md`, `08_ITERATION_HISTORY.md`) |
| Новых файлов | 5 (`assets/hdr/README.md` + 3 HDR + `12_HANDOFF_v0_7_1.md`) |
| JS syntax check | OK |
| CSS braces balance | 238/238 BALANCED |
| Lighthouse impact | без изменений vs v0.6 (HDR грузится lazy при 3D-клике) |
| Playwright regression | 56/56 PASS (HDR-фичи не покрыты) |

### Что НЕ сделано в Phase 1 — вынесено в v0.8.0

- **Bloom post-processing** — требует архитектурной правки: model-viewer 4.0.0 → 4.2.0,
  переход с bundled на unbundled `model-viewer-module.min.js`, import map для three,
  `@google/model-viewer-effects` 1.5.0+. Регрессия всех 20 моделей.
- **Wireframe / Polygon overlay (Marmoset style)** — невозможен на model-viewer
  (closed shadow DOM, scene.traverse() недоступен). Требует rewrite на pure Three.js,
  что выходит за рамки upgrade-задачи. Альтернатива (для будущего): pre-rendered
  wireframe PNG из Blender, показ как 4-й режим переключателя.

### Open issues для v0.8+

- **Playwright regression тесты для HDR-фич не написаны** — verify-frozen.js v0.4
  проверяет только Golden 0.4 baseline. Кандидаты тестов:
  - `3D-CONTROLS-env-group-on-http` — viewport http, проверить наличие `.case-3d__env-group`
  - `3D-CONTROLS-env-group-absent-on-file` — viewport file://, проверить отсутствие
  - `3D-EXPOSURE-default-1` — проверить `mv.exposure === 1` при init
- **Lighthouse Slow 3G impact unknown** — 3 HDR × 1 MB при первом 3D-клике на slow networks
  может ухудшить TTI. Требует измерения.

---

## ФАЗА 9.5 — Phase 2 abandoned (architectural risk) / 03 мая 2026 / v0.7.2

После закрытия v0.7.1 пользователь принял решение двигаться к Phase 2 (bloom + SSAO
post-processing). После пересмотра архитектуры была сделана попытка перехода с
bundled `model-viewer@4.0.0` на unbundled `model-viewer-module@4.2.0` + import map
для three.js peer-dependency + `@google/model-viewer-effects@1.5.0`.

### Что упало

При первом 3D-клике console показал:
```
Uncaught SyntaxError: The requested module 'three' does not provide
an export named 'UnsignedInt101111Type' (at model-viewer-module.min.js:1:2185)
```

`model-viewer@4.2.0` импортирует символ `UnsignedInt101111Type` из three.js,
который доступен только в three версии newer 0.174.0. Был установлен `three@0.174.0`.
Несовпадение версий → module parsing fail → пустой canvas, нет controls.

### Race condition fix v0.8.1 — symptom-correct, not root-cause

Промежуточно был сделан fix v0.8.1 на race condition между `script.onload` и
`customElements.define()` через `customElements.whenDefined()` API. Этот fix был
архитектурно правильным (улучшил error reporting от пустого canvas до VIEWER OFFLINE),
но не лечил underlying version mismatch.

### Решение — откат на v0.7.1

После анализа 5-ю экспертами пользователь принял решение откатиться на v0.7.1 и
зафиксировать как v0.7.2 FINAL. Причины:

1. Архитектурная хрупкость без npm/lockfile
2. Документация версий не централизована (разные источники — разные версии)
3. ROI слабый: v0.7.1 даёт 70% wow от Marmoset через HDR
4. Нарушение принципа «boring stable» в Codex
5. Альтернатива: дождаться bundled MV-effects от Google

### Что сохранено для будущего

В `13_HANDOFF_v0_7_2.md` зафиксирован **v0.8.0 BLUEPRINT** — полный план Phase 2 для
применения когда инфраструктура созреет:
- Architectural prerequisites (либо bundled MV-effects, либо npm-сборка)
- Pipeline: SSAO → Bloom → Color Grade
- Decision points пользователя
- Race fix pattern (`customElements.whenDefined()`)

### Метрики Phase 2 (попытки)

| Параметр | Значение |
|---|---|
| Время затрачено | ~3 часа (расхватали и попытка реализации) |
| Файлы модифицированы (затем откат) | js/main.js, index.html |
| Файлы добавлены (затем откат) | — |
| Архитектурный сдвиг | bundled → unbundled (откат) |
| Lighthouse impact | не измерялся (Phase 2 не дошёл до production) |
| Final result | rollback на v0.7.1 без потери Phase 1 функционала |

### Lessons learned

1. **Перед архитектурными переходами — `npm install` в sandbox для проверки версий.**
2. **Constraints проекта (no build tools) ограничивают architectural choices.**
3. **70% wow-эффекта без риска > 100% эффекта с риском.**
4. **Symptom-fix vs root-cause:** `customElements.whenDefined()` улучшил error reporting,
   но проблема была в версионном mismatch, не в race.

---

## v0.7.2 (FINAL FROZEN) — 03 мая 2026

После Phase 2 abandoned пользователь зафиксировал v0.7.2 как production-ready.

**Изменения vs v0.7.1:** только документация. Код полностью идентичен.

- `13_HANDOFF_v0_7_2.md` — новый, с post-mortem Phase 2 + v0.8.0 BLUEPRINT
- `CHANGELOG.md` — секция v0.7.2
- `08_ITERATION_HISTORY.md` — эта секция (ФАЗА 9.5)

**FROZEN STATEMENT:** все элементы заморожены до явного запроса пользователя. Подробности в `13_HANDOFF_v0_7_2.md`.

---

## v0.7.3 — 03 мая 2026 — Mobile/tablet 3D controls cleanup

После v0.7.2 пользователь явно запросил правки только для mobile/tablet 3D controls.
Desktop UI (≥1024px) запрещено трогать. Также — header overflow на iPad Air.

### Decision points (из чата)

- Q1: где dropdown — ≤1023px (mobile + tablet portrait)
- Q2: иконка trigger — лампочка (lighting context)
- Q3: header overflow — fluid clamp() на title
- Q4: env-список в dropdown — buttons (не native radio)

### Изменения

**`js/main.js` (build3D + destroy3D + module vars):**
- Расширен build3D — после desktop env-group + expoWrap создаётся mobile-вариант
  `lightDd` с trigger (lightbulb icon) + panel (3 env-кнопки + exposure slider)
- syncEnvUI() обновляет оба UI при смене env
- Двусторонняя sync exposure: `expoInput` ↔ `ddExpoInput` через `input` событие
- 2 новых module-level var (`currentLightDdDocClick`, `currentLightDdDocKey`) для
  cleanup global listeners в `destroy3D()`
- Перепривязка desktop env-buttons на shared syncEnvUI (избегаем расхождения state)

**`css/portfolio.css` (~155 новых строк):**
- `.case-3d__light-dd*` — стили dropdown trigger + panel + env-list + exposure slider
- `@media (max-width: 1023px)` — switch UI: desktop env-group/expo скрыты, lightDd видим
- На tablet (≤1023px) — `case-view__header { flex-direction: column }` (расширение
  существующего ≤767px правила) + `case-view__title { font-size: clamp(...) }` fluid
- На tablet — `case-view__actions { width: 100%, flex-direction: row }` (расширение)
- На tablet — `case-3d__controls { justify-content: flex-end }` (выравнивание к правому)

### Метрики Phase

| Параметр | Значение |
|---|---|
| Изменено файлов | 4 (`js/main.js`, `css/portfolio.css`, `CHANGELOG.md`, `08_ITERATION_HISTORY.md`) |
| Новых файлов | 0 |
| JS syntax | OK |
| CSS braces balance | 259/259 (was 238/238) |
| BLOCKERS | 0 |
| MAJORS | 0 |
| Hardcoded colors в новых стилях | 0 |
| Listener leak risk | устранён через destroy3D cleanup |

### Замороженное (frozen scope)

- Desktop UI (≥1024px) полностью frozen — env-group + expoWrap visible как раньше
- Frozen statement из v0.7.2 продолжает действовать на всё остальное вне scope этих 3 задач

### Open issues для v0.7.4+

- HDR + light-dropdown поведение **не покрыто** Playwright regression
  (verify-frozen.js v0.4 не знает про новые селекторы)
- На очень узких экранах (<320px) panel может выходить за viewport — есть protection
  через `max-width: calc(100vw - 32px)`, но edge-case не тестировался
- `closeLightDd()` НЕ вызывается при `destroy3D()` — если кейс закрыт с открытым
  panel, в новом кейсе lightDd начинается в `data-open="false"` (новый DOM), так что
  это не баг. Но dataset.open старого DOM может остаться у GC — невидимо для пользователя

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (май 2026, после v0.7.3)

### Активные файлы

| Файл | Статус |
|------|--------|
| `index.html`, `free-assets.html` | ✅ Frozen (Golden 0.6) |
| `css/tokens.css`, `reset.css`, `shared.css`, `free-assets.css` | ✅ Frozen |
| `css/portfolio.css` | ✅ Frozen **кроме v0.7.3 mobile/tablet блоков** |
| `js/main.js` | ✅ Frozen **кроме build3D + destroy3D + 2 module vars** |
| `js/animations.js`, `model-data.js` | ✅ Frozen |
| `assets/hdr/*.hdr` | ✅ Frozen by names |

### CDN-зависимости (без изменений vs v0.7.2)

| Пакет | Версия | URL |
|---|---|---|
| @google/model-viewer | 4.0.0 (bundled) | ajax.googleapis.com |
| GSAP + ScrollTrigger + SplitText | 3.13.0 | jsDelivr |
| Fontshare fonts | latest | api.fontshare.com |

### Открытые задачи (когда пользователь явно запросит)

- Manual QA на iPad Air physical device (только simulated проверено)
- Replace placeholder content (email, sameAs, ZIPs)
- v0.8.0 Phase 2 BLUEPRINT (когда инфраструктура созреет)
- v1.0 production polish (Lighthouse improvements)

---

## v0.7.2 (FINAL FROZEN — superseded by v0.7.3) — 03 мая 2026

После Phase 2 abandoned пользователь зафиксировал v0.7.2 как production-ready.
Затем пришёл запрос на mobile/tablet UI правки → v0.7.3 (см. выше).

**Изменения vs v0.7.1:** только документация. Код полностью идентичен.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ — superseded by «после v0.7.3»

### Все элементы FROZEN

По указанию пользователя — никаких автономных правок. Любое изменение требует
прямого запроса:
- «Замени hello@codex.studio на real@email.com»
- «Добавь real link на Behance в JSON-LD»
- «Запусти Phase 2 когда будет bundled MV-effects»

### CDN-зависимости (production, без изменений vs v0.7.1)

| Пакет | Версия | URL |
|---|---|---|
| @google/model-viewer | **4.0.0** (bundled) | ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/ |
| GSAP | 3.13.0 | jsDelivr |
| ScrollTrigger | 3.13.0 | jsDelivr |
| SplitText | 3.13.0 | jsDelivr |
| Fontshare (Clash Display + General Sans) | latest | api.fontshare.com |

**Важно:** model-viewer **bundled** 4.0.0 — стабильный, three.js внутри. Никаких
peer-deps, никаких import maps. Это сознательное архитектурное решение после
Phase 2 abandoned.

### Открытые задачи (когда пользователь явно запросит)

**v0.7.x — point fixes:**
- Replace placeholder email `hello@codex.studio`
- Replace JSON-LD `sameAs` placeholder URLs
- Replace `/downloads/*.zip` placeholders на real ZIPs
- Возможно: добавить `theme-color` media split (Golden 0.4 рекомендация)

**v0.8.0 — Phase 2 (когда инфраструктура созреет):**
- Дождаться Google bundled `model-viewer-effects`
- ИЛИ перейти на npm + build (отдельное архитектурное решение)
- План в `13_HANDOFF_v0_7_2.md` секция «v0.8.0 BLUEPRINT»

**v1.0 — production polish:**
- Critical CSS inline для LCP < 2.5s
- Lighthouse Performance ≥ 80 (сейчас 73 на index)
- Replace HDR-фичи в verify-frozen.js (v0.5)

---

## ФАЗА 8 (старое содержание, сохранено как историческая справка) — Golden 0.4 — стабилизация перед основной работой / 02 мая 2026

*(оригинальное содержание ФАЗА 8 ниже без изменений)*

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (май 2026, после v0.7.1)

### Активные файлы

| Файл | Статус |
|------|--------|
| `index.html` | ✅ Заморожен (Golden 0.6) |
| `free-assets.html` | ✅ Заморожен (Golden 0.6) |
| `css/tokens.css` | ✅ Заморожен |
| `css/reset.css` | ✅ Заморожен |
| `css/shared.css` | ✅ Заморожен (Golden 0.5+) |
| `css/portfolio.css` | ✅ Заморожен **кроме v0.7.0/0.7.1 блоков** (env-group, exposure, mobile) |
| `css/free-assets.css` | ✅ Заморожен |
| `js/main.js` | ✅ Заморожен **кроме `build3D()`** (расширена для HDR) |
| `js/animations.js` | ✅ Заморожен |
| `js/model-data.js` | ✅ Заморожен |
| `assets/hdr/*.hdr` | ✅ Заморожены **по именам файлов** (можно заменить контент на другие polyhaven HDR) |
| `assets/favicon/site.webmanifest` | ✅ Заморожен |
| `verify-frozen.js` | ⚠️ v0.4 (HDR-фичи не покрыты — кандидат для v0.8) |

### Открытые задачи для v0.8+

**v0.8.0 — Phase 2 (bloom):**
- Апгрейд model-viewer 4.0.0 → 4.2.0
- Переход с bundled на unbundled `model-viewer-module.min.js`
- Import map для three.js
- Подключение `@google/model-viewer-effects` 1.5.0+
- `<effect-composer><bloom-effect>` внутри `<model-viewer>`
- Toggle Bloom button в UI controls
- Регрессия всех 20 моделей
- Замер Lighthouse Performance до/после

**v0.8.x — alternatives для wireframe (без rewrite на Three.js):**
- Pre-render wireframe PNG в Blender для каждой модели
- 4-й режим переключателя: 2D / 3D / Blueprints / Wire
- Альтернатива в стиле Marmoset polygon view, но без runtime-overhead

**v0.9 — DSLR-feel (при наличии bloom):**
- SSAO (ambient occlusion) — для hard-surface даёт больший wow эффект чем bloom
- Tone mapping presets (AgX, ACES, Commerce) через `<tonemap-effect>`
- Color grading через `<color-grade-effect>`

---

## ФАЗА 8 (старое содержание, сохранено как историческая справка) — Golden 0.4 — стабилизация перед основной работой / 02 мая 2026

*(оригинальное содержание ФАЗА 8 ниже без изменений)*

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (май 2026, после Golden 0.4)

### Активные файлы

| Файл | Статус |
|------|--------|
| `index.html` | ✅ Заморожен (37/37 PASS) |
| `free-assets.html` | ✅ Заморожен (23/23 PASS) |
| `css/tokens.css` | ✅ Заморожен |
| `css/reset.css` | ✅ Заморожен |
| `css/main.css` | ✅ Заморожен (без `.top-pills` контейнера) |
| `css/free-assets.css` | ✅ Заморожен (новый, v0.4) |
| `js/main.js` | ✅ Заморожен |
| `js/animations.js` | ✅ Заморожен (с `:not(.tag-card)` v0.4) |
| `js/model-data.js` | ✅ Заморожен |
| `assets/favicon/site.webmanifest` | ✅ Заморожен (новый, v0.4) |
| `assets/img/og-free-assets.jpg` | ✅ Заморожен (новый, v0.4) |
| `verify-frozen.js` | ✅ v0.4 (self-contained, 56 тестов) |

### Открытые задачи для будущих итераций

**Golden 0.5 — оптимизация Performance:**
- Вынести `js/model-data.js` в lazy-loaded модуль (открывать только при первом клике 3D-таба)
- Удалить unused CSS из main.css по audit
- Рассмотреть `<article role="button">` → semantic `<button>` (требует реструктуризации карточки)

**Golden 0.6 — content:**
- Заменить placeholder ассеты в `/downloads/` на реальные (есть только 4 из 25)
- Заменить SVG placeholders в `/assets/cards/` на реальные превью

---

## ЗАМОРОЖЕНО — НЕ ТРОГАТЬ (Golden 0.4 baseline)

> Откат в случае проблем → к Golden 0.4. Любая правка вне явного запроса запрещена.

- `index.html` — вся страница целиком (после HV2 + manifest)
- `free-assets.html` — вся страница целиком (после всех B1-B6, M*, AX1, N4, HV1, HV3, MX1 фиксов)
- `css/tokens.css` — дизайн-токены
- `css/reset.css` — базовый сброс
- `css/main.css` — весь CSS (после удаления `.top-pills` контейнера N1)
- `css/free-assets.css` — новый CSS-файл v0.4
- `js/main.js` — вся логика
- `js/animations.js` — GSAP анимации (с `:not(.tag-card)` v0.4)
- `js/model-data.js` — inline GLB
- Custom cursor (`.cursor`, `.cursor-dot`)
- Film grain + vignette (`body::before`, `body::after`)
- `.work-card` блок — карточки проектов
- `.case-view` блок — все три вида (2D / 3D / Blueprints)
- `.tag-card` блок — карточки категорий (free-assets)
- `.fa-card` блок — карточки ассетов (free-assets grid)
- Все ассеты в `/assets/**`
- `verify-frozen.js` — регрешен 56 тестов



---

## ФАЗА 9 — Performance + Accessibility (Golden 0.5, май 2026)

> Цель: закрыть все 5 нерешённых проблем из «known issues» Golden 0.4.
> Снять заморозку с 5 файлов точечно, минимизировать риск регрессий.

### Контекст и решения

Все 5 проблем потребовали правки замороженных файлов. Получено явное
подтверждение пользователя на снятие заморозки + выбор стратегии для каждой:

| Issue | Стратегия | Решение |
|---|---|---|
| #1 Performance LCP 9.9s | 3.1.A | lazy-load model-data.js на первом 3D-клике |
| #2 aria-label-misuse | трив. | удаление 3 неиспользуемых aria-label |
| #3 Unused CSS 80 KiB | 4.1.A | разделение main.css → shared + portfolio |
| #4 label-content-name | через #5 | удалён aria-label, anchor сам себя описывает |
| #5 article role=button | 5.1.A | замена на `<a href="#card-id">` |

### Список фиксов Golden 0.5

#### Performance (#1)
- `js/main.js`: `loadModelData()` Promise-функция (новая) рядом с `loadModelViewerScript`
- `js/main.js`: `build3D` цепочка `loadModelViewerScript().then(loadModelData).then(...)`
- `index.html`: удалён `<script src="./js/model-data.js">` из `<body>` perm

#### Accessibility (#2, #4)
- `index.html`: удалены 3 `aria-label` со span/p
- `index.html` + `free-assets.html`: удалены `aria-label` со всех 18 + 6 cards
- `js/main.js`: `aria-current="true"` → `aria-current="page"` (семантически корректнее)

#### CSS reorganization (#3)
- `css/main.css` (96.6 KB) разделён на:
  - `css/shared.css` (55 KB) — для обеих страниц
  - `css/portfolio.css` (44 KB) — только для index
- Подключения: index = tokens + reset + shared + portfolio; FA = tokens + reset + shared + free-assets
- `css/main.css` удалён
- `css/shared.css`: `.work-card__year` color-text-faint → color-text-muted (WCAG AA)

#### Semantic HTML (#5)
- `index.html`: 18 `<article role="button">` → `<a class="work-card" href="#data-id">`
- `free-assets.html`: 6 `<article role="button">` → `<a class="tag-card" href="#data-tag">`
- `js/main.js`: card click handler `e.preventDefault()` + openCase
- `free-assets.html`: bindTagCards — `e.preventDefault()` + selectTag
- Удалены: tabindex="0", role="button", keydown handlers, aria-pressed
- Добавлено: aria-current="page" для активной карточки

### Финальные метрики

| Проверка | Результат |
|---|---|
| Playwright regression (verify-frozen.js) | **56/56 PASS, 0 FAIL** |
| Lighthouse index.html | Perf **73**, A11y **100**, BP 95, SEO 100 |
| Lighthouse free-assets.html | Perf ~80, A11y **100**, BP 95, SEO 100 |
| LCP index.html | 4.2s (было 9.9s, -57%) |
| html-validate index.html | 24 errors (было 45, -21) |
| html-validate free-assets.html | 8 errors (было 14, -6) |

### Бонусы Golden 0.5

- **Shareable URLs:** `https://codex.studio/#orbital-mk-ii` напрямую открывает кейс.
- **CSS code organization:** разделение по странице, легче поддерживать.
- **WCAG AA для всех текстов:** `--color-text-muted` теперь основной для secondary text.

### Известные нерешённые проблемы (для Golden 0.6+)

- **Unused CSS остаётся в shared.css:** ~30-40 KiB unused (часть селекторов используется
  только в одном из контекстов, но не разделимо без дальнейшей реструктуризации).
- **Performance LCP 4.2s** — всё ещё выше идеала 2.5s. Дальнейшее улучшение требует:
  critical CSS inline в `<head>`, preload main.js, или async loading non-critical
  ресурсов. Architectural решение для 0.6+.
- **html-validate 24 errors на index** — `prefer-native-element` для `<div role="listbox">`
  (tags-dropdown с multi-select), `<div role="region">` (cards-scroll). Намеренные
  паттерны, нет нативных эквивалентов.
- **`/downloads/` content:** заглушки 412 bytes в orbital/apex/corten/nightshard, 21 ZIP отсутствуют.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (май 2026, после Golden 0.5)

### Активные файлы

| Файл | Статус |
|------|--------|
| `index.html` | ✅ Заморожен (после #1, #2, #4, #5) |
| `free-assets.html` | ✅ Заморожен (после #4, #5) |
| `css/tokens.css` | ✅ Заморожен |
| `css/reset.css` | ✅ Заморожен |
| `css/shared.css` | ✅ Заморожен (новый, v0.5) |
| `css/portfolio.css` | ✅ Заморожен (новый, v0.5) |
| `css/free-assets.css` | ✅ Заморожен |
| `css/main.css` | ❌ УДАЛЁН (заменён shared + portfolio) |
| `js/main.js` | ✅ Заморожен (с lazy-load + click handler updates v0.5) |
| `js/animations.js` | ✅ Заморожен |
| `js/model-data.js` | ✅ Заморожен (теперь lazy-loaded) |
| Все assets/** | ✅ Заморожены |
| `verify-frozen.js` | ✅ v0.4 (56 тестов) — без изменений |

### Откат-точки

- **0.5 проблема** → откат к **Golden 0.4** (`codex-studio-v0_4_0-GOLDEN.zip`)
- **0.4 проблема** → откат к **0.3.5** (исходный архив)
