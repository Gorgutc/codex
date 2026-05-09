# 15 — HANDOFF · v0.7.8
## Codex Studio — Case-row planshet stacking fix on top of v0.7.7 frozen baseline

> Точечный релиз: при sidebar-open на planshet (768-1023) ряды иллюстраций
> кейса (`.case-row`) сжимались до миниатюр (216×270 для tall-2). Теперь они
> stack'аются вертикально в один столбец full-width — read'абельно как mobile,
> но scoped только на sidebar-open режим. При collapsed sidebar default
> multi-col layout preserved.

---

## 📦 Версия и статус

- **Версия:** 0.7.8
- **Дата:** 8 мая 2026
- **Архив:** `codex-studio-v0_7_8.zip` (накатывается поверх v0.7.7 базы)
- **Базируется на:** v0.7.7 (frozen) → 1 файл, 1 точечная правка (новый media-блок)
- **Точка отката:** v0.7.7

---

## 🎯 Что исправлено

При viewport 768-1023px И **sidebar открыт** (body НЕ имеет `.cards-collapsed`):

- `.case-row` (все варианты: tall-1, tall-2, tall-text) меняют `flex-direction` на `column`
- Все `.case-item` внутри получают `flex: 1 1 100%; width: 100%`
- `.case-item--tall .case-item__media` получает `aspect-ratio: 4/5 + max-height: calc(100vh - 180px)` — идентично mobile rule

При **sidebar collapsed** (body.cards-collapsed) на planshet — поведение default (multi-col) полностью preserved.

### Поведенческая матрица

| Viewport | Sidebar | case-row layout | tall-2 ширина |
|---|---|---|---|
| ≤767 (mobile) | — | column (existing rule) | full width |
| 768-1023 (planshet) | **OPEN** | **column** ✓ NEW | **full width** ✓ NEW |
| 768-1023 (planshet) | COLLAPSED | flex-row (default) | ~370px каждая |
| ≥1024 (desktop) | any | flex-row (default) | ~480-700px каждая |

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `css/portfolio.css` | 1 новый media-блок (`@media (min-width: 768px) and (max-width: 1023px)`) | +46/-0 |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`, `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/free-assets.css`
- `verify-frozen.js`, `README.md`, все ассеты, favicons, manifest, sitemap, robots, llms

---

## 🛠 Технические детали правки

### portfolio.css — вставка нового media-блока (после v0.7.7 [planshet-fix], ~строка 1430)

```css
/* ══════════════════════════════════════════════════════════════════════════
   v0.7.8 [planshet-case-row-fix] — case-row stack на planshet sidebar-open.
   ══════════════════════════════════════════════════════════════════════════ */
@media (min-width: 768px) and (max-width: 1023px) {
  body:not(.cards-collapsed) .case-row {
    flex-direction: column;
    gap: var(--space-6);
  }
  body:not(.cards-collapsed) .case-row > .case-item,
  body:not(.cards-collapsed) .case-row--tall-1 > .case-item--tall,
  body:not(.cards-collapsed) .case-row--tall-2 > .case-item--tall,
  body:not(.cards-collapsed) .case-row--tall-text > .case-item--tall,
  body:not(.cards-collapsed) .case-row--tall-text > .case-item--text-inline {
    flex: 1 1 100%;
    width: 100%;
  }
  body:not(.cards-collapsed) .case-item--tall .case-item__media {
    aspect-ratio: 4 / 5;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: calc(100vh - 180px);
  }
}
```

### Specificity calculation

| Selector | Specificity | Перебивает |
|---|---|---|
| `body:not(.cards-collapsed) .case-row` | (0, 2, 1) | default `.case-row` (0, 1, 0) ✓ |
| `body:not(.cards-collapsed) .case-row--tall-2 > .case-item--tall` | (0, 4, 1) | default `.case-row--tall-2 > .case-item--tall` (0, 2, 0) ✓ |
| `body:not(.cards-collapsed) .case-item--tall .case-item__media` | (0, 4, 1) | default `.case-item--tall .case-item__media` (0, 2, 0) ✓ |

Все правила корректно перебивают defaults.

### Pattern reuse

`body:not(.cards-collapsed)` — паттерн уже существует в проекте:
- `shared.css:1039` использует `body.cards-collapsed .site-header`
- Class toggling управляется existing JS в main.js (`.cards-toggle` button handler)

Никаких новых классов или JS-логики не вводим.

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] CSS braces balanced (272/272)
- [x] Никаких `!important` в новых правилах (только existing в reduced-motion + один задокументированный slider)
- [x] Никакого хардкода цветов / размеров вне токенов (используем `var(--space-6)`, `calc(100vh - 180px)`)

### v0.7.8 specific

- [x] **Mobile (≤767) полностью исключен** через `min-width: 768px`. Mobile уже имеет свои rules в `@media (max-width: 767px)`.
- [x] **Desktop (≥1024) полностью исключен** через `max-width: 1023px`.
- [x] **Planshet collapsed sidebar** — `:not(.cards-collapsed)` исключает. Default multi-col layout preserved.
- [x] **GSAP scroll-reveal** в animations.js не затрагивается — DOM-структура не меняется, только flex-direction.
- [x] **`<img object-fit: cover>`** на `.case-item__img` (line 607) — даже если max-height срабатывает на iPad landscape, картинка корректно crop'нется без растягивания.
- [x] **`<link rel="manifest">` preserved** ✓
- [x] **theme-color single-tag preserved** ✓
- [x] **GSAP scripts order preserved** ✓
- [x] **`:not(.tag-card)` filter preserved** ✓
- [x] **model-viewer logic v0.7.5 preserved** ✓
- [x] **fa-grid v0.7.6 preserved** ✓
- [x] **case-view UI v0.7.7 preserved** ✓

### Verify-frozen test mapping

| Test | Risk after this release |
|---|---|
| Все DOM count tests | ✓ PASS — DOM не меняется (только CSS flex-direction) |
| `META-theme-color-single` | ✓ PASS |
| `META-manifest` | ✓ PASS |
| `SCRIPTS-no-defer` | ✓ PASS |
| `CONSOLE-no-internal-errors` | ✓ PASS |
| Все остальные тесты | ✓ Unaffected |

После применения: ожидание `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### iPad Air portrait (820×1180, sidebar OPEN) — критический сценарий

- [ ] Открыть index.html → выбрать кейс (например Vega Shell)
- [ ] Тогда вкладка 2D
- [ ] Скроллить вниз — все иллюстрации (и `tall-1`, и `tall-2`, и `tall-text`) **в одном столбце** ✓
- [ ] Каждая иллюстрация занимает full width main area (~480px)
- [ ] Caption блок (`tall-text`) — текст под медиа, читаемая ширина
- [ ] Никаких пар миниатюр в ряд

### iPad Air portrait (820×1180, sidebar COLLAPSED) — regression

- [ ] Тапнуть «« — sidebar уезжает
- [ ] Скроллить тот же кейс
- [ ] `tall-2` row — **две иллюстрации в ряд** (как раньше) ✓
- [ ] `tall-text` — медиа слева, текст справа (как раньше) ✓
- [ ] Поведение default preserved

### iPad Air landscape (1180×820, sidebar OPEN)

- [ ] Поворот в landscape — main area ~840px
- [ ] case-row всё ещё stack'ются в column (planshet range активен)
- [ ] tall items: aspect-ratio 4/5 + max-height calc(100vh - 180px) = 640px → image crop'нется через `object-fit: cover`, без растягивания

### Mobile (≤767) regression

- [ ] Открыть на phone → кейс → 2D
- [ ] Все rows column (existing mobile rule) ✓
- [ ] **Никаких визуальных изменений** vs v0.7.7

### Desktop (≥1024) regression

- [ ] Открыть на desktop laptop → кейс → 2D
- [ ] tall-2 — две колонки 50/50 ✓
- [ ] tall-text — медиа + текст side-by-side ✓
- [ ] **Никаких визуальных изменений** vs v0.7.7

### GSAP scroll-reveal regression

- [ ] Скроллить кейс на любом viewport
- [ ] Иллюстрации появляются с GSAP fade + lift анимацией ✓
- [ ] reduced-motion — мгновенно ✓ (animations.js не трогали)

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано (frozen / out of scope)

- **Нет** изменений в desktop UI (≥1024 поведение полностью preserved)
- **Нет** изменений в mobile UI (≤767 поведение полностью preserved)
- **Нет** изменений в JS (DOM не меняется)
- **Нет** изменений в animations.js (GSAP scroll-reveal не затрагивается)
- **Нет** изменений в free-assets (v0.7.5 + v0.7.6 preserved)
- **Нет** изменений в case-view UI v0.7.7 (kbutton preserved)

### Альтернативы рассмотрены и отклонены

| Подход | Почему отклонён |
|---|---|
| Container queries (`@container`) | Требует `container-type: inline-size` на main-area — изменение архитектуры. Sidebar state селектор работает чище. |
| Auto-fit grid вместо flex column | case-row уже использует flex с разными модификаторами (--wide, --tall-1, etc). Замена на grid требует больше рефакторинга. |
| Class toggle через JS при resize | Лишняя complexity. CSS-only решение через `:not(.cards-collapsed)` достаточно. |
| Применять для всех viewport ≤1023 (включая collapsed planshet) | Пользователь явно сказал «при свёрнутом всё ок» — не трогаем. |

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.7 без изменений:

- Performance LCP 2-3s на index.html
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders

Кандидаты для v0.8.x — когда пользователь явно запросит.

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.7 остаются заморожены, кроме одного явно изменённого
файла в этом релизе (`css/portfolio.css`). Дальнейшие изменения требуют
прямого запроса пользователя.

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подменить `css/portfolio.css` в проекте на новую версию (один файл)
2. Открыть index.html в DevTools → Toggle device toolbar → iPad Air (820×1180)
3. Выбрать любой кейс (например Vega Shell) → 2D таб
4. Проверить два сценария:
   - **Sidebar open** → все иллюстрации stack в column (1 в ряд) ✓
   - **Sidebar collapsed** (нажать ««) → tall-2 в две колонки (как раньше) ✓
5. Прогнать `node verify-frozen.js` → ожидание `56/56 PASS`

### При обнаружении багов

Прислать скриншот с указанным viewport. Точечный фикс через v0.7.8.x.

### Production deploy

Никаких новых dependencies. CSS-only fix. GitHub Pages / Netlify deploy
идентичен v0.7.7.

---

*Версия: 0.7.8 · 8 мая 2026 · Codex Studio · Planshet case-row stacking fix*
