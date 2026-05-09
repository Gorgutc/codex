# 15 — HANDOFF · v0.7.5
## Codex Studio — Single-feature point release on top of v0.7.4 frozen baseline

> Точечный релиз по запросу пользователя: добавление 3D-предпросмотра моделей
> в карточки `.fa-card` каталога free-assets через `<model-viewer>` auto-rotate.
>
> Основан на исследовании 3 решений (model-viewer / sprite-sheet / Three.js
> mini-scene), победитель — model-viewer 4.0.0 как единственное решение,
> совместимое с frozen v0.7.4 архитектурой и не вводящее новый стек.

---

## 📦 Версия и статус

- **Версия:** 0.7.5
- **Дата:** 8 мая 2026
- **Архив:** `codex-studio-v0_7_5.zip` (пользователь собирает поверх v0.7.4 базы)
- **Базируется на:** v0.7.4 (frozen) → 4 точечные правки в 2 файлах
- **Точка отката:** v0.7.4 (если что-то пойдёт не так — откат всего на v0.7.4 безопасен)

---

## 🎯 Что добавлено

3D-предпросмотр моделей в `.fa-card` thumb области:

- Каждая карточка ассета в каталоге free-assets автоматически отображает
  крутящуюся 3D-модель (auto-rotate, 20°/sec) при появлении в viewport.
- Если `.glb` для конкретного ассета ещё не залит — карточка показывает
  существующий SVG-poster (graceful fallback, никаких сломанных карточек).
- Поведение идентично на desktop и mobile (hover не требуется → аффорданс
  одинаковый).
- Lazy-load встроен в model-viewer (Intersection Observer внутри компонента),
  модели грузятся только когда близко к viewport.
- `prefers-reduced-motion` респектится автоматически (auto-rotate выключается
  без дополнительных CSS-правил).

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `free-assets.html` | 4 точечные правки в IIFE script-блоке | +51/-2 |
| `css/free-assets.css` | 1 новый блок `.fa-card__thumb-mv` + `--failed` | +32/-0 |

### Файлы НЕ изменены

- `index.html`, `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/portfolio.css`
- `verify-frozen.js`, `README.md`
- Все ассеты, favicons, manifest, sitemap, robots, llms

---

## 🛠 Что нужно сделать пользователю помимо подмены файлов

### Создать папку `./assets/models/free/` и положить `.glb` файлы

Convention: имя файла = `{id}.glb`, где `{id}` — поле `id` из `FA_DATA`
в `free-assets.html`. Полный список ID (25 штук):

**Hard Surface (8):**
- `orbital-mk-ii.glb`, `vega-shell.glb`, `ironclad-frame.glb`, `bolt-cluster.glb`,
  `terra-base.glb`, `shard-cannon.glb`, `wraith-blade.glb`, `apex-frame.glb`

**Product Viz (5):**
- `corten-series.glb`, `lumen-one.glb`, `flux-capsule.glb`, `echo-shell.glb`,
  `prism-lab.glb`

**Game Asset (4):**
- `nightshard.glb`, `recon-drone.glb`, `wraith-blade-g.glb`, `shard-cannon-g.glb`

**Organic (3):**
- `nyx-panther.glb`, `drift-koi.glb`, `glint-owl.glb`

**Animation (2):**
- `helix-reveal.glb`, `arc-motion.glb`

**CAD (3):**
- `mech-link.glb`, `flex-spine.glb`, `cad-strut.glb`

### Бюджеты на `.glb` (для предпросмотра в карточке 240×180)

- **Геометрия:** Draco-сжатая, ≤ 50K triangles
- **Текстуры:** 1024px max edge, KTX2 или WebP при возможности
- **Целевой размер файла:** 300 KB – 1 MB
- **Pivot/origin:** центр модели в (0, 0, 0)
- **Y-axis up** (Blender default) — auto-rotate крутит вокруг Y
- **Front-facing** к +Z (камеру model-viewer'а ставит автоматически на +Z)

Постепенное наполнение работает: можно начать с 1-2 файлов, остальные карточки
останутся со старым SVG-fallback.

---

## ✅ Pre-deploy чек-лист (passed на стороне кода)

### Code health

- [x] CSS braces balanced (75/75)
- [x] HTML structure validates
- [x] JS IIFE парсится (Function constructor sanity check)

### v0.7.5 specific

- [x] **Никаких `!important` в новом коде** ✓ (model-viewer сам респектит reduced-motion)
- [x] **Никакого хардкода цветов** в новом блоке ✓ (background:transparent — не цвет)
- [x] **`<link rel="manifest">` остался** на FA ✓
- [x] **theme-color single-tag preserved** ✓ (head не трогаем)
- [x] **GSAP scripts order preserved** ✓ (script tag не добавляли в head)
- [x] **`:not(.tag-card)` filter в animations.js не трогаем** ✓
- [x] **No `defer` на скриптах** ✓ (model-viewer через `type="module"` lazy-load по паттерну main.js:1683)
- [x] **CDN identical** to index.html (`ajax.googleapis.com/.../model-viewer/4.0.0/model-viewer.min.js`) → один cache hit для обеих страниц
- [x] **No localStorage / sessionStorage** ✓
- [x] **alt атрибут** на model-viewer присутствует (a11y)
- [x] **alt="" + aria-hidden="true"** на SVG-fallback (декоративный, не дублирует accessible name)

### Verify-frozen test mapping

| Test | Risk after this release |
|---|---|
| `GRID-rendered` (.fa-card count > 0) | ✓ PASS — DOM-структуру `.fa-card` сохраняем |
| `TAG-product-switch` (5 карточек) | ✓ PASS — `FA_DATA` не меняем |
| `N4-game-keeps-tag-cards` | ✓ PASS — tag-card логику не трогаем |
| `CONSOLE-no-internal-errors` | ✓ PASS — regex уже фильтрует `model-viewer` (verify-frozen.js:332) |
| `META-theme-color-single` | ✓ PASS — head не трогаем |
| `META-manifest` | ✓ PASS |
| `SCRIPTS-no-defer` | ✓ PASS — `type="module"` ≠ `defer` |
| Все остальные 49 тестов | ✓ Unaffected |

После применения: ожидание `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### Без `.glb` файлов (день деплоя, папка `./assets/models/free/` пустая)

- [ ] Открыть `free-assets.html` → Hard Surface category
- [ ] Карточки выглядят **идентично v0.7.4** (виден SVG poster)
- [ ] DevTools → Network: видим 8 неудачных запросов на `*.glb` (status 404) — это норма
- [ ] DevTools → Console: тихо. Если есть warnings от `model-viewer` про `loadfailure` — gracefully gase'нутся через `.--failed` класс
- [ ] Никаких visual glitches на карточках

### С одним `.glb` (например, `orbital-mk-ii.glb` залит)

- [ ] Hard Surface → первая карточка через ~200-800ms fade-in'ом показывает крутящуюся модель
- [ ] Соседние 7 карточек остаются со SVG poster
- [ ] Скорость вращения ровно 20°/sec (полный оборот ≈ 18 секунд)
- [ ] Auto-rotate начинается **сразу** (без задержки 3 секунды от model-viewer's interaction-prompt)

### Mobile (≤ 767px), все `.glb` залиты

- [ ] Скроллим грид → модели появляются по очереди когда подходят к viewport
- [ ] Page scroll НЕ блокируется (нет `camera-controls` → нет touch-capture)
- [ ] Pinch-to-zoom страницы работает нормально
- [ ] Тап на download кнопку — без задержки (`camera-controls` отключены, нет конфликта)

### Reduced-motion

- [ ] Chrome DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce → reload
- [ ] Модели **не крутятся**, показывают первый кадр статично
- [ ] Это работает **из коробки** model-viewer, без CSS-правил с нашей стороны

### Switch category (regression)

- [ ] Hard Surface → Product → старые `<model-viewer>` удаляются с DOM (`grid.innerHTML = ...`)
- [ ] Новые `<model-viewer>` для Product создаются, ленивая загрузка `.glb` запускается заново
- [ ] DevTools → Network: видим запрос `corten-series.glb` (или 404 если ещё нет)
- [ ] Shared WebGL context переиспользуется (DevTools → ⋮ → More tools → WebGL inspector → один context на странице)

### Lighthouse (performance regression)

- [ ] Запустить Lighthouse на FA-странице (DevTools → Lighthouse → Mobile)
- [ ] **Performance не должен упасть ниже 75** (предыдущий ≈85 на v0.7.4)
- [ ] Если падает ниже 75 — текстуры в `.glb` уменьшить с 1024px до 512px и/или применить более агрессивный Draco compression (`-vp 11 -vt 11`)
- [ ] **CLS должен остаться 0** — `aspect-ratio: 4/3` на `.fa-card__thumb` гарантирует фиксированный размер до загрузки модели

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано (frozen / out of scope)

По решению пользователя — только 3D-preview для FA-каталога. **Не сделано:**

- **Нет** mouse-follow camera orbit (отвергнуто — добавляет сложность без пропорционального UX-выигрыша; mobile/trackpad даёт jitter)
- **Нет** click-to-load или play-button UI (отвергнуто — auto-rotate с lazy-load работает чище)
- **Нет** custom loading indicator поверх model-viewer (встроенный progress-bar скрыт через `--progress-bar-color: transparent`)
- **Нет** изменений в case-view 3D на index.html (frozen v0.7.4)
- **Нет** изменений в HDR / environment / lighting на index.html (frozen)
- **Нет** изменений в FA `tag-card` (sidebar, левая панель) — только основной grid
- **Нет** изменений в `FA_DATA` (поле `model:` НЕ добавлено — convention `./assets/models/free/{id}.glb` достаточно)

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.4 без изменений:

- Performance LCP 2-3s на index.html (model-data.js lazy уже снизил с ~10s)
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders
- HDR-фичи + light-dd не покрыты Playwright regression

Кандидаты для v0.8.x — когда пользователь явно запросит.

---

## 🔧 Технические детали (для future-self / debug)

### Поведенческая матрица

| Сценарий | model-viewer script | `.glb` файл | Что видит пользователь |
|---|---|---|---|
| CDN OK + .glb OK | ✓ загружен | ✓ 200 OK | Крутящаяся 3D-модель |
| CDN OK + .glb 404 | ✓ загружен | ✗ 404 | SVG poster (через `.--failed` class) |
| CDN OK + .glb malformed | ✓ загружен | ⚠ parse error | SVG poster (через `loadfailure` event) |
| CDN заблокирован | ✗ не загружен | — | SVG poster (custom element без размера) |
| Reduced-motion ON + .glb OK | ✓ загружен | ✓ 200 OK | Первый кадр модели, статично |
| Mobile + .glb OK | ✓ загружен | ✓ 200 OK | Крутящаяся модель + page-scroll работает |

### DOM layering внутри `.fa-card__thumb`

```
.fa-card__thumb (relative, aspect-ratio 4/3)
├─ ::after (z:1)            ← data-label text (gradient bg + uppercase title)
├─ <img src=".svg" z:2>     ← SVG poster fallback (alt="", aria-hidden)
├─ <model-viewer z:2>       ← 3D model (alt="{title} — 3D preview")
└─ <span class="badge" z:3> ← top-left category badge
```

Z-index у img и model-viewer одинаковый (2). model-viewer идёт ПОСЛЕ img в DOM,
поэтому при равной специфичности перекрывает его. Это намеренно — даёт fallback
"sandwich" pattern: всегда есть что показать на любом этапе загрузки.

### Skill-spec compliance

- ✅ `skill-code-generator.md` — стек preserved, no defer, no localStorage, no !important вне reduced-motion, no hardcoded colors outside docs WCAG exceptions
- ✅ `skill-code-reviewer.md` — все BLOCKER чеки pass
- ✅ `skill-motion-director.md` — animation justified ("показать что это интерактивная 3D-модель"), reduced-motion из коробки, без bounce/infinite UI
- ✅ `skill-a11y-performance.md` — alt на model-viewer, aria-hidden на decorative img, никакого CLS (aspect-ratio thumb)
- ✅ `skill-asset-optimizer.md` — convention naming (`{id}.glb` lowercase, hyphenated), отдельная папка
- ✅ `skill-deploy-auditor.md` — verify-frozen 56/56 ожидается PASS

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.4 остаются заморожены, кроме двух явно изменённых файлов
в этом релизе. Дальнейшие изменения требуют прямого запроса пользователя.

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подмени `free-assets.html` и `css/free-assets.css` в проекте на новые версии
2. Создай папку `./assets/models/free/`
3. Подложи как минимум **1 тестовый `.glb`** (например, `orbital-mk-ii.glb`) для проверки auto-rotate
4. Запусти проект через Live Server / GitHub Pages preview
5. Проверь Manual QA checklist выше — особенно на mobile (page-scroll должен работать)
6. Прогони `node verify-frozen.js` → ожидание `56/56 PASS`

### Постепенное наполнение

7. По мере готовности `.glb` файлов в Blender — экспортируй с Draco-compression
   (`File → Export → glTF 2.0 → Compression: Enabled`) и клади в `./assets/models/free/`
8. Никаких правок в код больше не нужно — convention `{id}.glb` подхватывается автоматически

### При обнаружении багов

Прислать скриншот + viewport size + Network tab. Точечный фикс через v0.7.6.

### Production deploy

Никаких новых CDN dependencies (model-viewer 4.0.0 уже использовался на index.html).
GitHub Pages / Netlify deploy идентичен v0.7.4 — статика, `index.html` в root.

---

*Версия: 0.7.5 · 8 мая 2026 · Codex Studio · model-viewer 3D preview in FA cards*
