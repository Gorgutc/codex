# CHANGELOG — Codex Studio

## v0.7.3 — 2026-05-03

> Mobile/tablet UI правки в 3D-вьювере: env+exposure controls свёрнуты в один
> light-dropdown trigger с иконкой лампочки (только ≤1023px). Header overflow
> fix на tablet portrait. Desktop UI (≥1024px) — без изменений.

### Закрытые задачи (U13–U15)

| # | Задача | Файл(ы) |
|---|---|---|
| **U13** | Light-dropdown для env-presets + exposure на mobile/tablet (≤1023px). Один trigger-button с иконкой лампочки → раскрывает panel со списком 3 кнопок Studio/Outdoor/Dark + вертикальный exposure slider. Pattern: `tags-dropdown__trigger` (без checkboxes) | `js/main.js`, `css/portfolio.css` |
| **U14** | Header overflow fix на tablet portrait (768–1023px). При раскрытом sidebar правая колонка теряла ширину → title переносился по буквам ("ReconDrone" → столбиком). Решение: расширил column-flow header на tablet (раньше работало только ≤767px), title теперь fluid clamp 1.25→2rem | `css/portfolio.css` |
| **U15** | Listener cleanup для light-dropdown global handlers (close-on-outside click + Escape). Зарегистрированы в module-level vars `currentLightDdDocClick` / `currentLightDdDocKey` → `removeEventListener` в `destroy3D()`. Защита от утечек при смене кейса | `js/main.js` |

### Decision points (зафиксировано из чата)

| Решение | Значение |
|---|---|
| Where dropdown applies | ≤1023px (mobile + tablet portrait) |
| Trigger icon | Lightbulb — env+exposure = lighting context |
| Header overflow fix | Fluid clamp() на title + extend column-flow до 1023px |
| Env list inside dropdown | Buttons (без `<input type="radio">`) — переиспользует существующий aria-pressed pattern |

### U13 — Light-dropdown architecture

**DOM:** обе UI-структуры создаются всегда (desktop env-group + expoWrap **И** mobile lightDd).
CSS media query показывает нужное:

```css
@media (max-width: 1023px) {
  .case-3d__env-group { display: none; }
  .case-3d__expo { display: none; }
  .case-3d__light-dd { display: inline-flex; }
}
```

**Sync helpers** — изменение env или exposure в любом UI обновляет оба:

- `syncEnvUI(key)` — обновляет classList + aria-pressed на обеих env-групп
- `expoInput` ↔ `ddExpoInput` — двусторонняя синхронизация slider value через `input` событие

**Pattern:** mirror-state без single source of truth (намеренно). Альтернатива
(один shared state via JS object) дала бы те же результаты, но добавила бы
indirection — для 2 контролов overkill.

### U14 — Tablet header overflow fix

**Root cause:** на 820×1180 (iPad Air portrait) при открытом sidebar (раскрытые карточки)
правая колонка `.case-view` получала меньше ширины, header был в `flex-direction: row`
с `actions` (2D/3D/Blueprints + COPY LINK + arrows) flex-end, и `case-view__title`
терял место → переносился по буквам.

**Fix:**
1. Расширил `flex-direction: column` на header с ≤767px → ≤1023px
2. Расширил `case-view__actions { flex-direction: row; width: 100% }` на ≤1023px
3. Title fluid clamp `clamp(1.25rem, 0.8rem + 2vw, 2rem)` на tablet diapason

### U15 — Listener cleanup

**Pattern:** существующий `currentWheelListener` уже использует это — module-level var
для `removeEventListener` в `destroy3D()`. Применил аналогичный подход к
`currentLightDdDocClick` и `currentLightDdDocKey`.

```javascript
function destroy3D() {
  // ...existing cleanup...
  if (currentLightDdDocClick) {
    document.removeEventListener('click', currentLightDdDocClick);
    currentLightDdDocClick = null;
  }
  if (currentLightDdDocKey) {
    document.removeEventListener('keydown', currentLightDdDocKey);
    currentLightDdDocKey = null;
  }
}
```

Без этого при смене кейса (build3D → destroy3D → build3D) global listener'ы накапливались
бы и держали ссылки на удалённые DOM-узлы → memory leak + некорректное поведение.

### Файловая структура (отличия от 0.7.2)

```
codex-studio/
├── 13_HANDOFF_v0_7_2.md             ← историческая справка (v0.7.2 frozen)
├── CHANGELOG.md                     ← обновлён (этот раздел вверху)
├── 08_ITERATION_HISTORY.md          ← обновлён (новая секция v0.7.3)
├── js/main.js                       ← обновлён: U13, U15 (+~120 строк, +2 module vars, cleanup в destroy3D)
└── css/portfolio.css                ← обновлён: U13, U14 (+~155 строк новых стилей; mobile-block упрощён)
```

### Метрики

| Проверка | Результат |
|---|---|
| JS syntax (`node -c js/main.js`) | OK |
| CSS braces balance (portfolio.css) | 259/259 BALANCED |
| BLOCKERS | 0 |
| MAJORS | 0 |
| Hardcoded colors в новых стилях | 0 (всё через токены) |
| `!important` вне reduced-motion | 0 |
| ARIA на новых элементах | aria-haspopup, aria-expanded, aria-label, aria-pressed, role group |
| Listener leak risk | устранён (cleanup в destroy3D) |
| **VERDICT** | **READY FOR PRODUCTION DEPLOY** |

### Что НЕ затронуто (по требованию пользователя)

- Desktop UI ≥1024px — env-group и expoWrap отображаются как раньше
- Все остальные элементы проекта — frozen statement из v0.7.2 продолжает действовать
- Code outside build3D() и destroy3D() — без изменений

### Manual QA (после deploy)

**Mobile (375×812):**
- [ ] Controls в одну строку: AUTO ROTATION | MODEL INFO | ⟲ | ⛶ | ⚙ (lightbulb)
- [ ] Tap на ⚙ → открывается panel с ENVIRONMENT [Studio|Outdoor|Dark] + EXPOSURE slider
- [ ] Outside tap / Escape → panel закрывается
- [ ] Смена env синхронизирована (если бы был desktop UI рядом)

**Tablet portrait (iPad Air 820×1180):**
- [ ] Те же controls, выровнены к **правому краю** canvas
- [ ] Header не переносится по буквам — title shrinks до ~1.5rem fluid
- [ ] Sidebar (карточки) можно раскрыть без поломки header

**Tablet landscape / Desktop (≥1024px):**
- [ ] Controls в одну строку как раньше: AUTO | INFO | ⟲ | ⛶ | [STUDIO|OUTDOOR|DARK] | EXPOSURE━●━
- [ ] Light-dropdown trigger (⚙) НЕ виден — скрыт через `.case-3d__light-dd { display: none }` default

### Rollback path

Точка отката: `codex-studio-v0_7_2.zip` (предыдущая FINAL FROZEN итерация).
Изменения только в 2 файлах (`main.js` + `portfolio.css`) + документация.
Перезаписать назад → быстрый откат без побочных эффектов.

---

## v0.7.2 — 2026-05-03 (FINAL FROZEN)

> Финальная версия после отката неудавшегося Phase 2.
> v0.7.2 = v0.7.1 идентично по коду + полная документация причин отказа от bloom/SSAO.
> Все элементы зафиксированы до явного запроса пользователя.

### Изменения vs v0.7.1

**Только документационные изменения. Код полностью идентичен v0.7.1.**

| Что изменено | Файл |
|---|---|
| Новый handoff doc с post-mortem Phase 2 | `13_HANDOFF_v0_7_2.md` (NEW) |
| Раздел v0.7.2 + post-mortem | `CHANGELOG.md` (этот файл) |
| Секция «ФАЗА 9.5 — Phase 2 abandoned» | `08_ITERATION_HISTORY.md` |
| Frozen statement | `13_HANDOFF_v0_7_2.md` |

### Post-mortem: почему Phase 2 был отменён

**Что пытались:** SSAO + Bloom + Color Grade post-processing pipeline через
`@google/model-viewer-effects` 1.5.0. Архитектура: переход с bundled
`model-viewer@4.0.0` на unbundled module 4.2.0 + import map для three.js peer-dep.

**Что упало (точная ошибка):**
```
Uncaught SyntaxError: The requested module 'three' does not provide
an export named 'UnsignedInt101111Type' (at model-viewer-module.min.js:1:2185)
```

`model-viewer@4.2.0` импортирует символ `UnsignedInt101111Type` из three.js,
который доступен только в three версии newer 0.174.0. Был установлен
`three@0.174.0` (на основе одного источника). Несовпадение версий —
module parsing fail — `customElements.define('model-viewer', ...)` не вызывается —
пустой canvas, нет controls.

**Почему откат правильный (5 причин):**

1. **Архитектурная хрупкость:** каждый upgrade model-viewer требует ручной проверки
   peer-dep three. Без npm/lockfile (запрещены constraint проекта «no build tools»)
   это лотерея.
2. **Документация не централизована:** разные источники указывали разные версии three
   для одного MV. Невозможно угадать без npm install.
3. **ROI слабый:** v0.7.1 уже даёт ~70% wow-эффекта от Marmoset через HDR + Exposure.
   Bloom + SSAO добавили бы 15%, но за это +800 KB bundle, 5+ часов на регрессию,
   постоянный риск версионных проблем.
4. **Нарушение принципа Codex Studio:** «boring, stable, works for years». Phase 2
   архитектура — opposite (fragile, unstable, breaks on each MV upgrade).
5. **Альтернатива есть:** дождаться когда Google выпустит bundled `model-viewer-effects`
   (обсуждается в issue tracker). Тогда не нужен import map, всё в одном файле.

### Lessons learned

1. **Перед архитектурными переходами — `npm install` в sandbox для проверки версий.**
   Не угадывать через web search.
2. **Constraints проекта (no build tools) ограничивают architectural choices.**
   Фичи которые требуют peer-deps работают плохо без bundled-варианта.
3. **70% wow-эффекта без архитектурного риска > 100% эффекта с риском.**
4. **`customElements.whenDefined()` race fix v0.8.1 был корректным symptom-fix**, но
   не лечил underlying version mismatch. Symptom vs root-cause distinction важна.

### v0.8.0 BLUEPRINT (frozen plan)

Полный план Phase 2 для будущего применения зафиксирован в `13_HANDOFF_v0_7_2.md`
(секция «v0.8.0 BLUEPRINT»). Включает:
- Architectural prerequisites
- Pipeline order: SSAO → Bloom → Color Grade (последний обязателен для ACES tonemap)
- Decision points пользователя из чата
- Race condition fix pattern (`customElements.whenDefined()`)

Когда Google выпустит bundled `model-viewer-effects` или появится npm-сборка —
этот blueprint можно достать и применить за 1-2 часа.

### Frozen statement

По прямому указанию пользователя — **никакие изменения не допустимы** без явного запроса.
Подробности в `13_HANDOFF_v0_7_2.md` секция «FROZEN STATEMENT».

### Метрики

| Проверка | Результат |
|---|---|
| Code health (всё что в v0.7.1) | OK (без изменений) |
| BLOCKERS | 0 |
| MAJORS | 0 |
| MINORS | 1 (theme-color без media split — frozen Golden 0.6) |
| **VERDICT** | **READY FOR PRODUCTION DEPLOY** |

### Признаки что можно расфиксить

Сигналы что время для следующей итерации:
- Google анонсировал bundled `model-viewer-effects`
- Пользователь решил перейти на npm + build
- Пользователь запросил Lighthouse improvement (v1.0 polish)
- Появились реальные данные (Behance/email/ZIPs) — точечные правки

---

## v0.7.1 — 2026-05-03

> Phase 1 апгрейда 3D-вьювера: IBL HDR освещение + exposure slider + environment switcher.
> Базируется на Golden 0.6 (`codex-studio-v0_6_0-GOLDEN.zip`).
> Точка отката: Golden 0.6.

### Закрытые задачи (U1–U6)

| # | Задача | Файл(ы) |
|---|---|---|
| **U1** | IBL освещение через HDR — `environment-image` атрибут с тремя пресетами (studio default / outdoor / dark) | `js/main.js`, новая папка `assets/hdr/` |
| **U2** | Exposure slider 0.5–2.0 (default 1.0, step 0.05) — управление через `mv.exposure` property | `js/main.js`, `css/portfolio.css` |
| **U3** | Environment switcher — segmented control (STUDIO/OUTDOOR/DARK) в стиле существующих ctrl-кнопок | `js/main.js`, `css/portfolio.css` |
| **U4** | Mobile responsive: `flex-wrap` на `.case-3d__controls`, уменьшенные paddings и font-size | `css/portfolio.css` |
| **U5** | `prefers-reduced-motion` override для `::-webkit-slider-thumb` transition | `css/portfolio.css` |
| **U6** | **file:// CORS guard** (hotfix между v0.7.0 и v0.7.1): graceful fallback на `'neutral'` + console warning + UI HDR-controls скрыты при двойном клике | `js/main.js` |

### НЕ сделано в этой итерации (вынесено в v0.8.0)

| # | Причина |
|---|---|
| ~~U7~~ Bloom post-processing | Требует архитектурную правку: model-viewer 4.0.0 → 4.2.0, переход на unbundled `model-viewer-module.min.js`, import map для three. Регрессия 20 моделей. |
| ~~U8~~ Wireframe / Polygon overlay | Невозможен на model-viewer (closed shadow DOM — нет доступа к scene.traverse()). Требует rewrite на pure Three.js. |

### U1 — IBL HDR Lighting

**Что:** model-viewer 4.0.0 поддерживает `environment-image` атрибут со ссылкой на .hdr файл. Внутри использует RGBELoader + PMREMGenerator + ACES Filmic tone mapping (всё автоматически). Раньше использовалось `environment-image='neutral'` (procedural без сети).

**HDR файлы (CC0 polyhaven 1k):**
- `studio.hdr` ← `studio_small_08` (low-contrast soft studio, default)
- `outdoor.hdr` ← `kloppenheim_06` (open field with clear sky)
- `dark.hdr` ← `studio_small_03` (high-contrast single-lamp dark mood)

**Размеры:** ~1.0 / 1.5 / 1.5 MB. Lazy-load — грузятся при первом клике на 3D.

### U6 — file:// CORS guard (между v0.7.0 и v0.7.1)

**Проблема:** model-viewer при `environment-image='./assets/hdr/studio.hdr'` делает `fetch()` запрос. На `file://` (двойной клик) браузер блокирует cross-origin fetch локальных файлов → model-viewer стрельнул общий `error` event на элементе → существующий handler показал "MODEL UNAVAILABLE" хотя GLB загрузился корректно.

**Решение:** в `build3D()` проверка `window.location.protocol === 'file:'`. Если true:
- `environment-image='neutral'` (как до v0.7.0)
- Env switcher и exposure slider **не создаются** в DOM
- `console.warn` для разработчика с инструкцией про HTTP сервер

На `http(s)://` всё работает как задумано.

**Pattern reference:** аналог уже сделанного в проекте data:URI workaround для GLB (`window.CODEX_LOCAL_GLB`, см. `js/main.js:1798`).

### Файловая структура (отличия от 0.6)

```
codex-studio/
├── 12_HANDOFF_v0_7_1.md                ← ★ NEW
├── CHANGELOG.md                        ← обновлён
├── 08_ITERATION_HISTORY.md             ← обновлён (ФАЗА 4)
├── css/portfolio.css                   ← обновлён: U2, U3, U4, U5
├── js/main.js                          ← обновлён: U1, U2, U3, U6
└── assets/hdr/                         ← ★ NEW
    ├── README.md
    ├── studio.hdr
    ├── outdoor.hdr
    └── dark.hdr
```

### Метрики

| Проверка | Результат |
|---|---|
| JS syntax (`node -c js/main.js`) | OK |
| CSS braces balance (portfolio.css) | 238/238 BALANCED |
| Lighthouse | без изменений vs v0.6 (HDR грузится lazy) |
| Playwright regression | без изменений vs v0.6 (56/56 PASS — HDR не покрыты) |

### Для production deploy

```bash
# Перед deploy на GitHub Pages / Netlify:
ls -la assets/hdr/
# должны быть: README.md  studio.hdr  outdoor.hdr  dark.hdr
```

Без HDR файлов на production будет 404 → "MODEL UNAVAILABLE" на всех 3D-кейсах.

---

## v0.6.0 — GOLDEN — 2026-05-02

> Фиксы итерация: 6 задач + 1 нерегрессированный CSS-cascade баг по mobile case-share.
> Базируется на Golden 0.5 (`codex-studio-v0_5_0-GOLDEN.zip`).
> Точка отката: Golden 0.5.

### Закрытые задачи (Z1–Z8)

| # | Задача | Файл(ы) |
|---|---|---|
| **Z1** | Dropdown-фильтр на free-assets.html не сортировал tag-cards (data-tag вместо data-category) | `free-assets.html` |
| **Z2** | Глобальная замена домена `codex.studio` → `codex.promo` (26 вхождений в 5 файлах) | `index.html`, `free-assets.html`, `sitemap.xml`, `robots.txt`, `llms.txt` |
| **Z3** | `.case-item--{wide,tall} .case-item__media` — жёсткие height:1040/1100px → `aspect-ratio` + `clamp` max-height | `css/portfolio.css` |
| Z4 | Page transition при смене кейсов | пропущена (вариант A — оставить existing clip-path reveal) |
| Z5 | Hover-desc reveal | пропущена (вариант A — UX side-effects на mobile/FA) |
| **Z6** | theme-color на FA: split с media → single tag (приведение к архитектуре index) | `free-assets.html`, `verify-frozen.js` |
| **Z7** | Scroll-hint chevron в .case-view (DOM-element + CSS animation) | `css/portfolio.css`, `js/main.js` |
| **Z8** | **CSS-cascade баг (нерегрессированный)**: на mobile отображалась `.case-share--desktop` вместо mobile-кнопки. portfolio.css `.case-share--{mobile,desktop}` (specificity 1) загружается ПОСЛЕ shared.css mobile @media (specificity 1) → desktop wins. Фикс: shared.css selectors → `.case-share.case-share--{mobile,desktop}` (specificity 2). | `css/shared.css` |

### Z1 — Dropdown filter на free-assets

**Проблема:** `applyFilters()` в `main.js` использует `card.dataset.category`. На FA tag-cards имели только `data-tag`, не `data-category` → `cards = querySelectorAll('.work-card[data-category]')` возвращал пустой NodeList → фильтрация не работала.

**Решение:** добавлены 6 атрибутов `data-category` (дублируют `data-tag`) на tag-cards в FA. `main.js` оставлен frozen. `rebindGameSwitch()` в FA inline script отвязывает main.js handler — game-switch на FA не сломан (N4 regression test passes).

### Z2 — Замена домена

| Файл | Вхождений |
|---|---|
| `index.html` | 11 (canonical, og:url, og:image, twitter:image, JSON-LD x4, ItemList x4) |
| `free-assets.html` | 9 |
| `sitemap.xml` | 2 |
| `llms.txt` | 3 |
| `robots.txt` | 1 |
| **Итого** | **26 → 0** |

Markdown-документация (CHANGELOG, HANDOFF, ITERATION_HISTORY) сохранена как историческая запись (упоминания `codex.studio` в этих файлах остались — правильно).

### Z3 — aspect-ratio для case-item media

```css
/* Было (frozen v0.5) */
.case-item--wide .case-item__media { width: 100%; height: 1040px; }
.case-item--tall .case-item__media { width: 100%; max-width: 1022px; height: 1100px; }

/* Стало (v0.6) */
.case-item--wide .case-item__media {
  width: 100%; aspect-ratio: 16/9; height: auto;
  max-height: clamp(480px, 60vh, 1040px);
}
.case-item--tall .case-item__media {
  width: 100%; max-width: 1022px; aspect-ratio: 4/5; height: auto;
  max-height: clamp(520px, 70vh, 1100px);
}
```

**Mobile override (1216–1227 portfolio.css) — НЕ ТРОНУТ.**

### Z6 — theme-color архитектура

**Было в v0.5:** index.html — single tag `<meta name="theme-color" content="#212121">`. FA — split с `media="(prefers-color-scheme: dark|light)"`. Скрытый баг: `applyTheme()` JS на FA обновлял первый tag (dark), второй (light) оставался устаревшим при ручном toggle.

**Стало в v0.6:** обе страницы — single tag без media. `applyTheme()` в main.js обновляет один тег при ручном toggle (`#212121` ↔ `#f5f5f5`).

**verify-frozen.js обновлён:** `META-theme-color-light-dark` (split) → `META-theme-color-single` (требует ровно 1 тег без media).

### Z7 — Scroll-hint chevron

Тонкая стрелка вниз снизу `.case-view`, появляется при первом открытии кейса:
- DOM-element `<div class="case-scroll-hint">` создаётся в `main.js showScrollHint()`.
- CSS `position: absolute` относительно `.case-view` (получившей `position: relative`).
- Animation: 3 цикла мигания (1.6s каждый), задержка 1.2s, opacity 0→0.85→0, translateY ±6px.
- **Гасится** через CSS sibling combinator: `.case-scroll.has-scrolled ~ .case-scroll-hint { display: none }` при первом скролле.
- `.has-scrolled` persistent — UX-обучение проходит один раз.
- `prefers-reduced-motion` → `display: none`.

**Почему не `::after`:** `position: sticky` на pseudo-element внутри `overflow:auto` контейнера + `mask-image` нестабильно в Chromium.

**Фикс keyframes:** `transform: translate(-50%, ±6px) rotate(45deg)` — translateY указан **до** rotate, иначе translateY работает в локальной (повёрнутой 45°) системе координат и стрелка дрожит по диагонали.

### Z8 — Mobile case-share CSS cascade fix (нерегрессированный баг)

**Симптом:** на mobile (≤767px) в шапке `.case-mobile-bar` mobile-кнопка share была СКРЫТА, а desktop-кнопка из `.case-view__actions` показывалась.

**Root cause:** Cascade order в index.html — `shared.css` загружается ПЕРЕД `portfolio.css`.
- shared.css mobile @media: `.case-share--desktop { display: none; }` (specificity 1 class)
- portfolio.css вне @media: `.case-share--desktop { display: inline-flex; }` (specificity 1 class)
- При equal specificity → wins позднее объявленный = portfolio.css.
- Result: `.case-share--desktop` отображалась на mobile поверх @media-rule.

**Fix:** в shared.css mobile-блоке использован double-class selector `.case-share.case-share--desktop` (specificity 2). Побеждает portfolio.css single-class. Двойная кнопка на mobile исчезла, mobile-кнопка показана как на скриншоте (icon-only в шапке).

**В каких версиях существовал:** возможно с v0.2.3 [П2] (когда portfolio.css был частью main.css — тогда конфликта не было). После v0.5 split на shared+portfolio (#3) баг проявился, но не был замечен и не покрыт regression-тестом.

---

## ⚠️ Обновление verify-frozen.js (Z6)

Один тест переименован под новую архитектуру:
- ❌ `META-theme-color-light-dark` (требовал split с media)
- ✅ `META-theme-color-single` (требует ровно 1 тег)

Общее количество тестов на FA — 28, на index — 28, **итого 56**. Ожидаемо: **56/56 PASS** на чистом архиве.

---

## 🆕 Изменённые файлы (9)

| Файл | Что изменено |
|---|---|
| `index.html` | Z2 (домен) |
| `free-assets.html` | Z1 (data-category x6), Z2 (домен), Z6 (theme-color) |
| `sitemap.xml` | Z2 (домен) |
| `robots.txt` | Z2 (домен) |
| `llms.txt` | Z2 (домен) |
| `css/portfolio.css` | Z3 (aspect-ratio), Z7 (case-scroll-hint CSS) |
| `css/shared.css` | Z8 (double-class specificity fix) |
| `js/main.js` | Z7 (showScrollHint + scroll listener) |
| `verify-frozen.js` | Z6 (META-theme-color-single test) |

## 🧊 Frozen — не трогать без явного запроса

- `index.html`, `free-assets.html` (после v0.6 правок)
- `css/tokens.css`, `css/reset.css`, `css/free-assets.css`
- `css/shared.css` (после Z8)
- `css/portfolio.css` (после Z3 + Z7)
- `js/main.js` (после Z7), `js/animations.js`, `js/model-data.js`
- `verify-frozen.js` (после Z6)
- Все assets/

При откате: 0.6 → 0.5 → 0.4 → ... (последовательно).

---

## v0.5.0 — GOLDEN — 2026-05-02

> Производительность + accessibility итерация: закрытие 5 нерешённых проблем
> из «known issues» Golden 0.4. **Оба Lighthouse Accessibility = 100/100.**

### Lighthouse сравнение v0.4 → v0.5

| Страница            | Performance       | A11y                | Best Practices | SEO       |
|---------------------|-------------------|---------------------|----------------|-----------|
| index.html          | 52 → **73** (+21) | 96 → **100** (+4)   | 95 → 95 (=)    | 100 → 100 |
| free-assets.html    | 80 → ~80 (=)      | 100 → 100 (=)       | 95 → 95 (=)    | 100 → 100 |

### Core Web Vitals

| Метрика | index 0.4 | index 0.5 | Δ |
|---|---|---|---|
| LCP | 9.9s | **4.2s** | **-5.7s** |
| TBT | 750ms | 320ms | -430ms |
| CLS | 0 | 0 | = |

### Playwright regression

`verify-frozen.js`: **56/56 PASS, 0 FAIL** на финальном архиве.

---

## 🚀 Closed findings (5 issues)

### #1 — Lazy-load `model-data.js`

**Проблема:** `js/model-data.js` (1.1 MB inline GLB) грузился синхронно при загрузке
index.html → LCP 9.9s.

**Fix:**
- Удалён `<script src="./js/model-data.js">` из `<head>` index.html.
- Добавлена `loadModelData()` в main.js — Promise-функция, инжектит script
  через `document.head.appendChild(s)` при первом клике на 3D-вкладку.
- Идемпотентна: повторный openCase 3D не загружает заново.
- Graceful: если CDN недоступен — fallback на относительные GLB URLs.

**Результат:** Performance index.html 52 → 73 (+21). LCP 9.9s → 4.2s.

### #2 — `aria-label-misuse` в index.html

**Fix:** удалены `aria-label` со 2-х `<span class="work-card__badge">` и одного
`<p class="site-footer__stats">` — игнорировались screen reader.

### #3 — Unused CSS ~80 KiB

**Fix:** разделение `main.css` на 2 файла:

| Файл | Размер | Подключается |
|---|---|---|
| `css/shared.css` | 55 KB | Обе страницы |
| `css/portfolio.css` | 44 KB | **Только index** |

**Результат:** FA загружает на ~45 KB CSS меньше. main.css удалён.

### #4 — `label-content-name-mismatch`

**Fix:** удалён `aria-label` со всех 18 work-cards + 6 tag-cards.
После #5 (`<a>` вместо `role=button`) — visible text (h2) сам себя описывает.

### #5 — `<article role="button">` → `<a href="#card-id">`

**Fix:** замена 18 work-cards (index) и 6 tag-cards (FA):
- HTML-валидно (`<a>` разрешает любой контент).
- A11y: implicit role=link.
- **Бонус: shareable URLs** — `https://codex.studio/#orbital-mk-ii`.
- В JS: `e.preventDefault()` в click handler.
- Удалены `tabindex="0"`, `role="button"`, `aria-pressed`, keydown handlers.
- Active state теперь через `aria-current="page"`.

**Результат:**
- html-validate: index 45 → 24 errors (-21), FA 14 → 8 errors (-6).

---

## 🎨 Bonus: color-contrast улучшение

После #3 Lighthouse выявил остаточный fail на `.work-card__year`. Fix в
`shared.css`: `--color-text-faint` (3.67:1) → `--color-text-muted` (5.27:1 ✓).
Симметрично с AX1 в Golden 0.4.

**Результат:** A11y index 96 → 100/100.

---

## 🆕 Новые / удалённые файлы

| File | Action |
|---|---|
| `css/shared.css` | **NEW** (55 KB) |
| `css/portfolio.css` | **NEW** (44 KB) |
| `css/main.css` | **DELETED** (заменён) |

---

## 🧊 Frozen — не трогать без явного запроса

- `index.html`, `free-assets.html` (после всех правок 0.5)
- `css/tokens.css`, `css/reset.css`
- `css/shared.css` (новый), `css/portfolio.css` (новый), `css/free-assets.css`
- `js/main.js`, `js/animations.js`, `js/model-data.js`
- Все ассеты `/assets/**`
- `verify-frozen.js`

При откате: 0.5 → 0.4 → ... (последовательно, см. handoff).

---

## v0.4.0 — GOLDEN — 2026-05-02 (предыдущая итерация)

Базовая итерация: фиксация качества обеих страниц.
Закрыто 17 находок аудита (B1–B6 + M1–M5 + AX1 + N1, N4 + HV1, HV2, HV3 + MX1).
Полный список — в архиве `codex-studio-v0_4_0-GOLDEN.zip` → CHANGELOG.md.
