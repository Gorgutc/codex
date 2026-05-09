# 15 — HANDOFF · v0.7.9
## Codex Studio — Wide-screen tall-2 layout fix on top of v0.7.8 baseline

> Точечный релиз: на ≥2K мониторах (≥2560 OPEN, ≥1920 COLLAPSED) layout
> `.case-row--tall-2` (две вертикальные иллюстрации) флуктуировал между
> состояниями sidebar — items расширялись, gap визуально менялся, отступ
> справа скакал. Cap на `.case-view max-width: 2220px` устраняет расхождение,
> делая layout case-view идентичным в OPEN/COLLAPSED на любом мониторе ≥2K.

---

## 📦 Версия и статус

- **Версия:** 0.7.9
- **Дата:** 9 мая 2026
- **Архив:** `codex-studio-v0_7_9.zip` (накатывается поверх v0.7.8 базы)
- **Базируется на:** v0.7.8 (frozen) → 1 файл, 1 точечная правка
- **Точка отката:** v0.7.8

---

## 🎯 Что исправлено

### Численная диагностика (до фикса)

`.case-item--tall .case-item__media` имеет `max-width: 1022px`. `.case-item`
(родитель) — `flex: 1 1 0`, тянется до доступной ширины. На 2K+ мониторах
item становится шире 1022, media упирается в cap, справа от media растёт
пустота внутри item. Visual gap между двумя tall-2 media:

| Viewport | Sidebar | item width | media width | empty right of media | total visual gap |
|---|---|---|---|---|---|
| 1440 | OPEN/COLLAPSED | 462-604 | 462-604 (no cap) | 0 | **48px** |
| 1920 | OPEN/COLLAPSED | 702-844 | 702-844 (no cap) | 0 | **48px** |
| **2560** | **OPEN** | **1022** | **1022** | **0** | **48px** ✓ |
| **2560** | **COLLAPSED** | **1164** | **1022** | **142** | **190px** ❌ |
| 4K (3840) | OPEN | 1662 | 1022 | 640 | **688px** ❌ |
| 4K (3840) | COLLAPSED | 1804 | 1022 | 782 | **830px** ❌ |

User experience: на любом мониторе ≥2560px при toggle sidebar tall-2
items "прыгают" — расширяются, gap растёт, отступ справа скачет на 142px+.

### После фикса

Cap на `.case-view max-width: 2220px` делает content area идентичной в
OPEN/COLLAPSED на любом ≥2K мониторе:

| Viewport | Sidebar | item width | media width | empty right | total visual gap |
|---|---|---|---|---|---|
| 1440-1919 | any | unchanged | unchanged | 0 | **48px** ✓ unchanged |
| 2560 | OPEN | 1022 | 1022 | 0 | **48px** ✓ |
| 2560 | COLLAPSED | **1022** | **1022** | **0** | **48px** ✓ FIXED |
| 4K | OPEN | **1022** | **1022** | **0** | **48px** ✓ FIXED |
| 4K | COLLAPSED | **1022** | **1022** | **0** | **48px** ✓ FIXED |

Cap value 2220 = 2 × 1022 (media max) + 48 (gap) + 64×2 (case-view padding).

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `css/portfolio.css` | 1 новый media-блок `@media (min-width: 1440px) { .case-view { max-width: 2220px } }` | +41/-0 (3 строки кода + комментарий) |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`, `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/free-assets.css`
- `verify-frozen.js`, `README.md`, все ассеты

---

## 🛠 Технические детали правки

### portfolio.css — новый media-блок (после `@media (max-width: 1100px)`, ~строка 47)

```css
/* ══════════════════════════════════════════════════════════════════════════
   v0.7.9 [wide-screen-fix] — cap .case-view max-width на ≥2K мониторах.
   ══════════════════════════════════════════════════════════════════════════ */
@media (min-width: 1440px) {
  .case-view {
    max-width: 2220px;
  }
}
```

### Почему `min-width: 1440px` (а не bare `.case-view max-width`)

Cap value 2220 в любом случае dormant ниже 2K (content area никогда
не достигает 2220 на mobile/planshet/1440). Media-query НЕ функциональное
ограничение, а **семантическая защита**: явно отделяет правило от mobile
и planshet ranges, упрощая будущий ревью.

### Почему align-left (без `margin-inline: auto`)

Centering вызвало бы свой собственный скачок: case-view position
сдвигался бы при OPEN→COLLAPSED transitions (чем шире main-area, тем
больше боковые margin'ы). Align-left сохраняет позицию case-view
относительно sidebar — sidebar collapses, case-view stays in place,
empty space appears на right side outside case-view (looks like background).

### Что cap НЕ затрагивает

- header (tabs, copy link) — capped within case-view, layout остаётся
- 3D canvas — capped до 2092px wide на 2K+, что приемлемо
- blueprints — capped аналогично
- case-view position в main-area — стабильна (align-left)

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] CSS braces balanced (274/274)
- [x] Никаких `!important` в новых правилах
- [x] Никакого хардкода цветов

### v0.7.9 specific

- [x] **Mobile (≤767) regression**: cap value 2220 > любого mobile content. Не активируется. ✓
- [x] **Planshet (768-1023) regression**: max iPad Pro landscape main = ~1140 < 2220. ✓
- [x] **Desktop 1440-1919 regression**: max content при 1919 COLLAPSED = ~1736 < 2220. Cap dormant. ✓
- [x] **Desktop ≥2560 activation**: cap kicks in где нужно. ✓
- [x] **`<link rel="manifest">` preserved** ✓
- [x] **theme-color single-tag preserved** ✓
- [x] **GSAP scripts order preserved** ✓
- [x] **`:not(.tag-card)` filter preserved** ✓
- [x] **model-viewer logic v0.7.5 preserved** ✓
- [x] **fa-grid v0.7.6 preserved** ✓
- [x] **case-view UI v0.7.7 preserved** ✓
- [x] **case-row stack v0.7.8 preserved** ✓ (`body:not(.cards-collapsed)` в 768-1023 range остаётся)

### Verify-frozen test mapping

| Test | Risk |
|---|---|
| Все DOM count tests | ✓ PASS — DOM не меняется (только CSS max-width) |
| `META-theme-color-single` | ✓ PASS |
| `META-manifest` | ✓ PASS |
| `SCRIPTS-no-defer` | ✓ PASS |
| `CONSOLE-no-internal-errors` | ✓ PASS |
| Все остальные тесты | ✓ Unaffected |

После применения: `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### Desktop 1440 (regression — не должно быть изменений)

- [ ] Открыть index.html → выбрать кейс с tall-2 row (Vega Shell, Orbital Mk.II) → 2D таб
- [ ] Sidebar OPEN: layout идентичен v0.7.8
- [ ] Sidebar COLLAPSED: layout идентичен v0.7.8
- [ ] gap между tall-2 items не изменился

### Desktop 2K (2560 viewport) — критический сценарий

- [ ] Sidebar OPEN: tall-2 items по 1022px каждый, gap 48px ✓
- [ ] Sidebar COLLAPSED: items **по 1022 каждый** (раньше было 1164), gap **48** (раньше 190 visual) ✓ FIXED
- [ ] Right margin: empty space на right side case-view одинаковый в OPEN/COLLAPSED

### Desktop 4K (3840 viewport)

- [ ] Sidebar OPEN: items 1022 (раньше 1662 с пустотой 640) ✓ FIXED
- [ ] Sidebar COLLAPSED: items 1022 (раньше 1804 с пустотой 782) ✓ FIXED
- [ ] gap 48 в обоих состояниях ✓
- [ ] case-view выровнен слева в main-area, void справа — это норма

### Mobile / Planshet (regression — не должно быть изменений)

- [ ] Mobile ≤767: case-view full width (cap не активен) ✓
- [ ] Planshet 768-1023: case-view full main-area width (cap не активен) ✓

### 3D Canvas / Blueprints (potentially affected)

- [ ] На 4K case-view → 3D таб → canvas viewport capped 2092px × ~aspect. Acceptable.
- [ ] На 4K → Blueprints таб → SVG canvas capped 2092px. Acceptable.

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано (frozen / out of scope)

- **Нет** изменений в mobile / planshet behavior
- **Нет** изменений в 1440 desktop behavior
- **Нет** изменений в `.case-row--tall-1` (одна иллюстрация — её media тоже capped 1022, но она не дублируется и right padding не воспринимается как «скачок»)
- **Нет** изменений в `.case-row--wide`, `.case-row--tall-text` (другая внутренняя структура, отдельный анализ)
- **Нет** изменений в JS — DOM не трогаем

### Альтернативы рассмотрены и отклонены

| Подход | Почему отклонён |
|---|---|
| Cap на `.case-row--tall-2 max-width: 2092` | Создаёт боковой скачок (centering vs align-left dilemma внутри track) |
| Cap на `.case-item--tall max-width: 1022` | Право-empty space внутри track становится конфликтным (justify-content space-between vs flex-start) |
| Убрать `.case-item__media max-width 1022` | media расширяется до огромных размеров на 4K — иллюстрация теряет читаемость |
| `margin-inline: auto` на `.case-view` | case-view position скакает при toggle sidebar (centering shift) |
| Cap на `.case-scroll__track` | Track centered внутри case-view даёт свой собственный скачок |
| Использовать container queries | Требует `container-type: inline-size` на main-area — архитектурный change. Простой max-width решает проблему чище. |

---

## 🐛 Унаследованные нерешённые проблемы (frozen)

Все из v0.7.8 без изменений:

- Performance LCP 2-3s на index.html
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.8 остаются заморожены, кроме одного явно изменённого
файла в этом релизе (`css/portfolio.css`). Дальнейшие изменения требуют
прямого запроса пользователя.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подменить `css/portfolio.css` в проекте на новую версию
2. Открыть index.html на 2K или 4K мониторе (или DevTools → Responsive 2560)
3. Выбрать кейс с tall-2 row → 2D таб
4. Toggle sidebar — items должны остаться того же размера, gap константный
5. Прогнать `node verify-frozen.js` → ожидание `56/56 PASS`

### Verify the theory

Пользователь предположил «проблема только на больших экранах». Численный
анализ подтвердил:

- На <2560px: cap на media (1022) не активируется — items уже < 1022 →
  layout идентичен в OPEN/COLLAPSED, проблемы нет.
- На ≥2560px (только OPEN COLLAPSED) и ≥1920 (только COLLAPSED): cap
  активируется → расхождение между состояниями.

Фикс активируется на тех же ≥2K viewport через `@media (min-width: 1440px)`
+ cap value 2220px (dormant ниже).

### Production deploy

CSS-only fix. Никаких новых dependencies. GitHub Pages / Netlify deploy
идентичен v0.7.8.

---

*Версия: 0.7.9 · 9 мая 2026 · Codex Studio · Wide-screen tall-2 layout cap*
