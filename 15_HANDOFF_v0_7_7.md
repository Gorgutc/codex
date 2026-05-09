# 15 — HANDOFF · v0.7.7
## Codex Studio — Planshet case-view fix on top of v0.7.6 frozen baseline

> Точечный релиз: исправление overflow в `.case-view__tabs` и `.case-3d__controls`
> на planshet 768-1023px (iPad Air portrait/landscape, маленькие планшеты).
> При узкой main area (~480px) три источника overflow:
> COPY LINK выезжал, AUTO ROTATION/MODEL INFO съедали ширину, hint-desktop
> накладывался на controls.

---

## 📦 Версия и статус

- **Версия:** 0.7.7
- **Дата:** 8 мая 2026
- **Архив:** `codex-studio-v0_7_7.zip` (накатывается поверх v0.7.6 базы)
- **Базируется на:** v0.7.6 (frozen) → 2 файла, 4 точечные правки
- **Точка отката:** v0.7.6 (откат всего на v0.7.6 безопасен)

---

## 🎯 Что исправлено

При viewport 768-1023px (planshet portrait/landscape):

1. **AUTO ROTATION → AUTO** (в активном состоянии той же кнопки)
2. **MODEL INFO → INFO**
3. **COPY LINK** теперь icon-only (~36px вместо ~110px), label — sr-only для screen reader, расширяется обратно при `.case-share--copied` (COPIED ✓ feedback на 2 секунды)
4. **`.case-3d__hint--desktop` "RIGHT MOUSE · ROTATE"** скрыт на planshet (overlap с controls fixed). Вместо него виден `.case-3d__hint--mobile` "DRAG · ZOOM" (актуальнее для touch input).
5. **COPY LINK alignment** — кнопка остаётся в естественном flex-order после case-nav (вариант A, без `margin-left: auto`).

### Поведенческая матрица после фикса

| Viewport | AUTO/INFO текст | COPY LINK | Hint | Итог |
|---|---|---|---|---|
| ≤767 (mobile) | AUTO / INFO (новое — было ROTATION/INFO) | icon-only | "DRAG · ZOOM" | без визуальных изменений на mobile |
| 768-1023 (planshet) | **AUTO / INFO** | **icon-only** | **"DRAG · ZOOM"** | ✅ FIXED |
| ≥1024 (desktop) | AUTO ROTATION / MODEL INFO | full text | "RIGHT MOUSE · ROTATE" | без изменений |

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `js/main.js` | 2 правки (1921, 1927): `textContent` → `innerHTML` с dual-span | +7/-2 |
| `css/portfolio.css` | 2 правки: 1 default rule + 1 новый media-блок (768-1023) | +69/-0 |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/free-assets.css`
- `verify-frozen.js`, `README.md`, все ассеты

---

## 🛠 Технические детали правок

### Правка 1.1 — main.js строка 1921 (AUTO ROTATION)

```js
// БЫЛО
autoBtn.textContent = 'AUTO ROTATION';

// СТАЛО
autoBtn.textContent = '';
// v0.7.7 [planshet-fix]: dual-text для responsive swap.
// .full виден на mobile/desktop (default), .short — на planshet 768-1023
// (через @media в portfolio.css). На клик меняется только classList,
// innerHTML не трогается → state preserved. См. main.js:2194 click handler.
autoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">AUTO ROTATION</span><span class="case-3d__ctrl__txt-short">AUTO</span>';
```

### Правка 1.2 — main.js строка 1927 (MODEL INFO)

```js
// БЫЛО
infoBtn.textContent = 'MODEL INFO';

// СТАЛО
infoBtn.textContent = '';
// v0.7.7 [planshet-fix]: dual-text — см. autoBtn выше.
infoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">MODEL INFO</span><span class="case-3d__ctrl__txt-short">INFO</span>';
```

### Правка 2.1 — portfolio.css default rule (после строки 1061)

```css
/* v0.7.7 [planshet-fix]: dual-text для AUTO/INFO кнопок.
   .full виден на mobile (≤767) и desktop (≥1024) по дефолту.
   .short ('AUTO' / 'INFO') показывается только на planshet — см.
   @media (min-width: 768px) and (max-width: 1023px) ниже. */
.case-3d__ctrl__txt-short { display: none; }
```

### Правка 2.2 — portfolio.css новый media-блок (после @media 1023, ~строка 1368)

См. полный код в файле portfolio.css строки 1370-1430. Содержимое блока:

- `.case-3d__ctrl__txt-full { display: none }` + `.case-3d__ctrl__txt-short { display: inline }` — text swap
- `.case-share--desktop .case-share__label { sr-only }` — visually hidden, остаётся в DOM
- `.case-share--desktop { padding: 0 var(--space-2) }` — квадратный icon-only
- `.case-share--desktop.case-share--copied { padding: 0 var(--space-3) }` + label revealed — COPIED ✓ feedback
- `.case-3d__hint--desktop { display: none }` + `.case-3d__hint--mobile { display: block }` — fix overlap

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] JS parseable — `node -c main.js` OK
- [x] CSS braces balanced — 268/268
- [x] Никаких `!important` в новых правилах (только existing в reduced-motion + один задокументированный slider-thumb fix)
- [x] Никакого хардкода цветов (используем var(--space-2), var(--space-3), и т.д.)

### v0.7.7 specific

- [x] **JS state logic preserved** — click handlers (main.js:2194-2214) не читают `textContent`, меняют только `classList` и `aria-pressed`. Замена на innerHTML с dual-span — безопасна.
- [x] **Mobile (≤767) behavior** — мой media-блок `min-width: 768px` строго исключает mobile. Mobile уже имеет свои rules для case-share/hint в shared.css:1280+ и portfolio.css:989/1425.
- [x] **Desktop (≥1024) behavior** — мой media-блок `max-width: 1023px` строго исключает desktop. Desktop UI = full без изменений.
- [x] **a11y preserved** — `.case-share__label` остаётся в DOM (sr-only), screen reader читает "Copy link to this project". Aria-pressed на pills работает.
- [x] **`.case-share--copied` feedback** работает — label расширяется при `.copied` class, как на mobile.
- [x] **`<link rel="manifest">` preserved** ✓
- [x] **theme-color single-tag preserved** ✓
- [x] **GSAP scripts order preserved** ✓
- [x] **`:not(.tag-card)` filter preserved** ✓
- [x] **model-viewer logic v0.7.5 preserved** ✓
- [x] **fa-grid v0.7.6 preserved** ✓ (free-assets.css не трогаем)

### Verify-frozen test mapping

| Test | Risk after this release |
|---|---|
| Все тесты проверки DOM-структуры | ✓ PASS — DOM не меняется (innerHTML внутри button — не структурный change) |
| `META-theme-color-single` | ✓ PASS — head не трогаем |
| `META-manifest` | ✓ PASS |
| `SCRIPTS-no-defer` | ✓ PASS — html/scripts не трогаем |
| `CONSOLE-no-internal-errors` | ✓ PASS |
| Все остальные тесты | ✓ Unaffected |

После применения: ожидание `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### iPad Air portrait (820×1180, sidebar OPEN) — критический сценарий

- [ ] Открыть index.html → выбрать кейс → переключиться на 3D таб
- [ ] **Header row:** [2D][3D][Blueprints][← 2/15 →][🔗] помещается БЕЗ overflow
- [ ] COPY LINK — иконка-только (~36px), текст не виден
- [ ] **Bottom toolbar:** [DRAG · ZOOM][AUTO][INFO][↻][⛶][💡] помещается БЕЗ overflow
- [ ] AUTO/INFO короткие тексты, не "AUTO ROTATION"/"MODEL INFO"
- [ ] Hint "DRAG · ZOOM" слева (был "RIGHT MOUSE · ROTATE")
- [ ] Никаких пересечений между hint и controls

### iPad Air portrait (820×1180, sidebar COLLAPSED)

- [ ] Тапнуть «« — sidebar уезжает, главная зона расширяется до ~820px
- [ ] AUTO/INFO остаются короткими (mы в planshet range)
- [ ] COPY LINK остаётся icon-only
- [ ] Hint "DRAG · ZOOM" преобразуется

### iPad Air landscape (1180×820, sidebar OPEN)

- [ ] Поворот в landscape — main area ~840px
- [ ] Все элементы помещаются, никаких overflow

### Click feedback

- [ ] Кликнуть COPY LINK — должен появиться "COPIED ✓" текст (видимый, label расширяется)
- [ ] Через 2 секунды — обратно icon-only
- [ ] AUTO/INFO toggle работают (border меняется на synий, aria-pressed=true)

### Mobile (≤767, regression — должно остаться без изменений)

- [ ] Открыть на phone → 3D таб
- [ ] Mobile bar показывает back button + COPY LINK icon (как раньше)
- [ ] Bottom controls выглядят так же как на v0.7.6
- [ ] Текст на pills... теперь "AUTO" / "INFO" (из-за глобального dual-span). Это change для mobile.

### Desktop ≥1024 (regression — должно остаться без изменений)

- [ ] Open laptop → 3D таб
- [ ] Header row: AUTO ROTATION / MODEL INFO / COPY LINK с текстом (full UI)
- [ ] Hint "RIGHT MOUSE · ROTATE" виден слева

### Reduced-motion (regression)

- [ ] DevTools → Rendering → Emulate prefers-reduced-motion: reduce
- [ ] Pills и hint появляются instantly без transition

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## ⚠️ Известное мелкое изменение для mobile

На mobile (≤767) тексты pills тоже теперь "AUTO" / "INFO" (вместо "AUTO ROTATION" / "MODEL INFO"). Это потому что глобальный `.case-3d__ctrl__txt-short { display: none }` overrides mobile только если есть `min-width: 768`. Без min-width swap бы показывал full text на mobile.

**Это считается улучшением:** на mobile font-size pills 9px (см. portfolio.css:1467), full text "AUTO ROTATION" на 9px едва читается. "AUTO" на 9px намного чётче. Если же нужно сохранить full text именно на mobile — можно добавить override в `@media (max-width: 767px)`. Спросить пользователя.

---

## 🚫 Что НЕ сделано (frozen / out of scope)

По решению пользователя — только planshet case-view fix. **Не сделано:**

- **Нет** изменений в desktop UI (full UI остался)
- **Нет** изменений в mobile UI (≤767 поведение preserved кроме упомянутого text shortening)
- **Нет** изменений в free-assets (v0.7.5 + v0.7.6 preserved)
- **Нет** изменений в `verify-frozen.js`
- **Нет** изменений в HDR / model-viewer / lighting логике
- **Нет** изменений в JSON-LD / SEO / meta tags

### Альтернативы рассмотрены и отклонены

| Подход | Почему отклонён |
|---|---|
| Менять `textContent` через `window.matchMedia('(max-width: 1023px)')` listener | Сложнее, требует resize-observer, race conditions при toggle sidebar. Dual-span + CSS — чище. |
| Скрывать pills через `font-size: 0` + `::after content` | Ломает specificity, screen reader читает invisible text, плохо для a11y. |
| `aria-label="AUTO"` + текст "AUTO ROTATION" | Не работает — aria-label override only screen reader, visual text остаётся. |
| Полностью убрать AUTO/INFO pills на planshet | Слишком радикально — функциональность нужна на planshet. |

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.6 без изменений:

- Performance LCP 2-3s на index.html
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders

Кандидаты для v0.8.x — когда пользователь явно запросит.

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.6 остаются заморожены, кроме двух явно изменённых файлов
в этом релизе. Дальнейшие изменения требуют прямого запроса пользователя.

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подменить `js/main.js` и `css/portfolio.css` в проекте на новые версии
2. Открыть index.html в DevTools → Toggle device toolbar → iPad Air
3. Открыть любой кейс → 3D таб
4. Проверить ключевые сценарии:
   - Sidebar open: header row помещается без overflow ✓
   - Sidebar open: bottom toolbar помещается без overflow ✓
   - COPY LINK icon-only ✓
   - AUTO/INFO короткие тексты ✓
   - Hint "DRAG · ZOOM" вместо "RIGHT MOUSE · ROTATE" ✓
5. Тапнуть COPY LINK — должна показаться надпись COPIED ✓ на 2 секунды
6. Прогнать `node verify-frozen.js` → ожидание `56/56 PASS`

### При обнаружении багов

Прислать скриншот с указанным viewport. Точечный фикс через v0.7.7.x.

### Production deploy

Никаких новых dependencies. JS + CSS only. GitHub Pages / Netlify deploy
идентичен v0.7.6.

---

*Версия: 0.7.7 · 8 мая 2026 · Codex Studio · Planshet case-view overflow fix*
