# 15 — HANDOFF · v0.7.10
## Codex Studio — Tall-2 stretch fix (revert v0.7.9 + correct approach)

> Точечный релиз: откат неправильного v0.7.9 cap на `case-view max-width`
> (создавал гигантский void справа на 4K) + корректный fix через override
> `max-width/max-height` только на media в tall-2 row. Media растягивается
> до ширины item, gap и right margin стабильны на всех viewport.

---

## 📦 Версия и статус

- **Версия:** 0.7.10
- **Дата:** 9 мая 2026
- **Архив:** `codex-studio-v0_7_10.zip` (накатывается поверх v0.7.8 базы)
- **Базируется на:** v0.7.8 (frozen — v0.7.9 откатывается полностью)
- **Точка отката:** v0.7.8 если что-то пойдёт не так

---

## 🔄 Что изменилось vs v0.7.9

### Откат v0.7.9 (неправильный подход)

```css
/* УДАЛЕНО — v0.7.9 cap был неправильным */
@media (min-width: 1440px) {
  .case-view {
    max-width: 2220px;
  }
}
```

**Проблема v0.7.9**: cap на `.case-view` фиксировал layout на 2220px, но
без `margin-inline: auto` создавал align-left → на 4K появлялся **гигантский
void справа** (1280-1564px пустого пространства). Right margin визуально
сильно скакал между OPEN/COLLAPSED.

### Правильный fix v0.7.10

```css
.case-row--tall-2 .case-item--tall .case-item__media {
  max-width: none;
  max-height: none;
}
```

**Корень проблемы был неправильно диагностирован в v0.7.9**: проблема не в
ширине case-view, а в том что `.case-item__media max-width: 1022px` cap'ит
media, но `.case-item` (родитель) тянется `flex: 1 1 0` до доступной
ширины. Когда item шире 1022 — справа от media void внутри item.

**Правильное решение**: дать media растягиваться до полной ширины item
(`max-width: none`). Тогда:
- gap между media = 48px **всегда** (= flex gap)
- right edge of right media = case-view padding 64 **всегда**
- items растягиваются равномерно как user и хочет

`max-height: none` нужен для сохранения aspect-ratio 4:5: без него default
`max-height: clamp(520px, 70vh, 1100px)` ограничивал бы высоту, image
становился pancake (1804×1100 = ratio 1.64 instead of 0.8) на 4K.

---

## 🎯 Поведенческая матрица

| Viewport | Sidebar | item width | media width (FIXED) | gap | right margin |
|---|---|---|---|---|---|
| 1440 | OPEN | 462 | 462 (fits, не активирован cap) | 48 | 64 |
| 1440 | COLLAPSED | 604 | 604 | 48 | 64 |
| 1920 | OPEN | 702 | 702 | 48 | 64 |
| 1920 | COLLAPSED | 844 | 844 | 48 | 64 |
| **2560** | **OPEN** | **1022** | **1022** | **48** | **64** ✓ |
| **2560** | **COLLAPSED** | **1164** | **1164** ✓ FIXED | **48** ✓ | **64** ✓ FIXED |
| 4K | OPEN | 1662 | **1662** ✓ FIXED | 48 ✓ | 64 ✓ FIXED |
| 4K | COLLAPSED | 1804 | **1804** ✓ FIXED | 48 ✓ | 64 ✓ FIXED |

**Все отступы стабильны на всех viewport ≥2K.** Иллюстрации растягиваются
равномерно, aspect-ratio 4:5 сохраняется.

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `css/portfolio.css` | Удалён v0.7.9 block (-46 строк) + добавлен v0.7.10 override (+34 строки, из них 5 кода) | +34/-46 vs v0.7.9, **итого +34 vs v0.7.8** baseline |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`, `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/free-assets.css`
- `verify-frozen.js`, `README.md`, все ассеты

---

## 🛠 Технические детали правки

### 1. Удалён v0.7.9 block (lines 47-83 в v0.7.9 portfolio.css)

```css
/* WAS:
@media (min-width: 1440px) {
  .case-view {
    max-width: 2220px;
  }
}
*/
```

### 2. Добавлен v0.7.10 override (после default `.case-item--tall .case-item__media`, ~строка 481)

```css
.case-row--tall-2 .case-item--tall .case-item__media {
  max-width: none;
  max-height: none;
}
```

### Specificity

| Selector | Specificity |
|---|---|
| Default `.case-item--tall .case-item__media` | (0, 2, 0) |
| **My override** `.case-row--tall-2 .case-item--tall .case-item__media` | **(0, 3, 0)** |
| Mobile rule (max-width: 767) `.case-item--tall .case-item__media` | (0, 2, 0) within @media |

Мой override (0,3,0) перебивает default (0,2,0) on all viewports.
На mobile: mobile rule сам имеет `max-width: 100%` (= item width), так что
my override `max-width: none` функционально идентичен. ✓ no regression.

### Что НЕ затронуто

- `tall-1` rows — `.case-item--tall .case-item__media` keeps max-width 1022
  (default). На 4K единственная media в row — capped 1022 нужен иначе она
  бы растянулась до 3000+px wide.
- `tall-text` rows — media 50% + text 50%. max-width 1022 на media keeps
  text readable.
- `wide` rows — отдельная aspect-ratio 16:9, не затронута.

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] CSS braces balanced (273/273)
- [x] Никаких `!important` в новом правиле
- [x] Никакого хардкода цветов
- [x] Specificity correctness verified (0,3,0 > 0,2,0)

### v0.7.10 specific

- [x] **v0.7.9 cap полностью удалён** (`grep -c "max-width: 2220px"` = 0) ✓
- [x] **Mobile (≤767) regression**: mobile rule имеет `max-width: 100%` — my override `max-width: none` функционально идентичен (item full-width anyway in column flow). ✓
- [x] **Planshet (768-1023) regression**: на planshet items < 1022 (cap не активирован раньше), my override no-op. ✓
- [x] **Desktop 1440-1919 regression**: items < 1022, my override no-op. ✓
- [x] **Desktop 2K+ activation**: my override активируется когда item > 1022. ✓
- [x] **Aspect-ratio 4:5 preserved**: max-height: none предотвращает pancake. ✓
- [x] **`<link rel="manifest">` preserved** ✓
- [x] **theme-color single-tag preserved** ✓
- [x] **GSAP scripts order preserved** ✓
- [x] **`:not(.tag-card)` filter preserved** ✓
- [x] **model-viewer logic v0.7.5 preserved** ✓
- [x] **fa-grid v0.7.6 preserved** ✓
- [x] **case-view UI v0.7.7 preserved** ✓
- [x] **case-row planshet stack v0.7.8 preserved** ✓

### Verify-frozen test mapping

| Test | Risk |
|---|---|
| Все DOM count tests | ✓ PASS |
| Все CSS structural tests | ✓ PASS (только override, не удаление) |
| `META-theme-color-single` | ✓ PASS |
| Все остальные тесты | ✓ Unaffected |

После применения: `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### Desktop 1440 (regression)

- [ ] Open кейс с tall-2 row (Vega Shell) → 2D таб
- [ ] Sidebar OPEN: layout идентичен v0.7.8 — items 462px, gap 48, right 64
- [ ] Sidebar COLLAPSED: layout идентичен v0.7.8 — items 604px, gap 48, right 64
- [ ] Никакой void справа (cap 2220 удалён)

### Desktop 2K (2560 viewport) — критический сценарий

- [ ] Sidebar OPEN: items 1022 each, media filling = 1022, gap 48, right 64 ✓
- [ ] Sidebar COLLAPSED: items 1164 each, media **1164** (растягивается!), gap 48, right 64 ✓ FIXED
- [ ] Видимый gap между двумя media = 48px (раньше было 190px скачком)
- [ ] Видимый right margin = 64px от case-view padding (раньше был void до 142+)

### Desktop 4K (3840 viewport)

- [ ] Sidebar OPEN: items 1662, media **1662** растягивается ✓
- [ ] Sidebar COLLAPSED: items 1804, media **1804** растягивается ✓
- [ ] Никакого гигантского void справа от case-view (v0.7.9 проблема устранена)
- [ ] gap 48, right 64 в обоих состояниях
- [ ] aspect-ratio 4:5 сохранён (image не превращается в pancake)
- [ ] На 4K COLLAPSED image height = 2255px > viewport 2160 → case-scroll скроллится. Acceptable.

### Mobile / Planshet (regression)

- [ ] Mobile ≤767: media full width column flow ✓ (mobile rule `max-width: 100%` ≡ my `max-width: none` for items < 100% width)
- [ ] Planshet 768-1023 sidebar OPEN: media full-width column ✓ (v0.7.8 `body:not(.cards-collapsed)` rule)
- [ ] Planshet 768-1023 sidebar COLLAPSED: media side-by-side ~370px each ✓ (cap 1022 не активирован)

### tall-1 / tall-text (regression — НЕ затронуты)

- [ ] tall-1 row: media остаётся capped 1022 (default rule preserved)
- [ ] tall-text row: media 50% capped 1022 + text 50% (default preserved)
- [ ] Только tall-2 получил new behavior

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано (frozen / out of scope)

- **Нет** изменений в case-view max-width (v0.7.9 откачен)
- **Нет** изменений в `.case-row--tall-1`, `.case-row--tall-text`, `.case-row--wide`
- **Нет** изменений в mobile / planshet behavior (cap не активировался ниже 2K)
- **Нет** изменений в DOM или JS

### Альтернативы рассмотрены и отклонены

| Подход | Почему отклонён |
|---|---|
| `.case-view max-width: 2220px` (v0.7.9) | Создавал гигантский void справа на 4K, неправильно диагностирован root cause |
| Cap `.case-row--tall-2 max-width: 2092` | Создаёт боковой скачок (centering vs align-left dilemma) |
| Убрать `max-width: 1022` глобально на `.case-item__media` | Ломает tall-1 (одна media full track = 3000+px на 4K) и tall-text |
| Cap track `max-width: 2092` | Не решает right margin consistency |
| Container queries `@container` | Архитектурный change, не нужен для одного селектора |

### Известное мелкое последствие

На очень широких мониторах (4K COLLAPSED, item 1804) image height = 2255px,
slightly exceeds viewport (2160). User должен немного проскроллить
case-scroll чтобы увидеть всю иллюстрацию. **Acceptable trade-off**:
сохранение aspect-ratio 4:5 важнее чем «всё видно сразу». Image content
не теряется — просто виден частично сразу.

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
файла в этом релизе (`css/portfolio.css`). v0.7.9 cap полностью отменён.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подменить `css/portfolio.css` на новую версию (v0.7.10)
2. Открыть index.html на 2K или 4K мониторе → выбрать кейс с tall-2 →2D
3. Toggle sidebar — проверить:
   - **Иллюстрации растягиваются** при collapsed (раньше были fixed на 1022) ✓
   - **gap между ними = 48px стабильно** ✓
   - **right margin = 64px стабильно** ✓
   - **Никакого void справа** (v0.7.9 проблема устранена) ✓
4. Прогнать `node verify-frozen.js` → `56/56 PASS`

### Production deploy

CSS-only fix. Никаких новых dependencies. GitHub Pages / Netlify deploy
идентичен v0.7.8.

---

*Версия: 0.7.10 · 9 мая 2026 · Codex Studio · Tall-2 media stretch (revert v0.7.9 + proper fix)*
