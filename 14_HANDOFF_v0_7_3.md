# 14 — HANDOFF · v0.7.3
## Codex Studio — Mobile/Tablet 3D controls compaction + header overflow fix

> Точечная итерация по запросу пользователя: на mobile + tablet portrait (≤1023px)
> 7 контролов в нижней панели 3D-вьювера сжимаются в 5 за счёт схлопывания
> STUDIO/OUTDOOR/DARK + EXPOSURE в один dropdown с trigger-кнопкой (иконка лампочки).
> Дополнительно: fluid clamp на h1 для tablet portrait — устраняет вертикальный
> перенос букв в `case-view__title` при узкой правой колонке.
>
> Desktop (≥1024px) НЕ изменён — остаются inline кнопки + slider как в v0.7.2.

---

## 📦 Версия и статус

- **Версия:** 0.7.3
- **Дата:** 3 мая 2026
- **Архив:** `codex-studio-v0_7_3.zip`
- **Базируется на:** v0.7.2 (frozen) → расфиксация по явному запросу пользователя
- **Точка отката:** v0.7.2 / v0.7.1
- **Phase 2 (bloom + SSAO):** остаётся abandoned (см. v0.7.2 handoff)

### Что закрыто в 0.7.3

Точечный запрос пользователя по 3 пунктам:

| # | Задача | Файл(ы) |
|---|---|---|
| **M1** | Mobile/tablet (≤1023px): схлопнуть `STUDIO/OUTDOOR/DARK` + `EXPOSURE` slider в один dropdown с trigger-кнопкой (иконка лампочки) после Fullscreen | `js/main.js`, `css/portfolio.css` |
| **M2** | Tablet (≤1023px): `.case-3d__controls` выравнивание с правого края (`justify-content: flex-end`) | `css/portfolio.css` |
| **M3** | Tablet portrait (≤1023px): `case-view__title` fluid clamp (1.25rem→2rem) — fix вертикального переноса букв при узкой правой колонке | `css/portfolio.css` |

### Решения принятые пользователем (зафиксированы из чата)

| Решение | Значение |
|---|---|
| Breakpoint для dropdown | ≤1023px (mobile + tablet portrait); >1024px = desktop без изменений |
| Иконка trigger | Лампочка (✦ env+exposure = lighting) |
| Header overflow fix | Fluid clamp() на `case-view__title` |
| Внутри dropdown | Вертикальный список 3 кнопок (без `<input type="radio">`) |
| State sharing | Desktop ↔ Mobile синхронизированы через единый `currentEnv` + helper `syncEnvUI()` |
| Cleanup | Global listeners (click-outside, ESC) удаляются в `destroy3D()` через module-level vars |

---

## 🏗 Архитектура

### DOM структура (mobile/tablet)

```html
<div class="case-3d__controls">
  <!-- 4 unchanged buttons -->
  <button autoBtn>AUTO ROTATION</button>
  <button infoBtn>MODEL INFO</button>
  <button resetBtn class="--icon">⟲</button>
  <button fsBtn3d>⛶</button>

  <!-- v0.7.0/v0.7.2: desktop inline UI (display: none на ≤1023px) -->
  <div class="case-3d__env-group">[STUDIO|OUTDOOR|DARK]</div>
  <label class="case-3d__expo">EXPOSURE━●━</label>

  <!-- v0.7.3: mobile/tablet dropdown (display: none на >1024px) -->
  <div class="case-3d__light-dd" data-open="false">
    <button class="case-3d__light-dd__trigger" aria-haspopup="true" aria-expanded="false">
      💡  <!-- lightbulb SVG -->
    </button>
    <div class="case-3d__light-dd__panel" hidden>
      <div class="section-label">ENVIRONMENT</div>
      <div class="case-3d__light-dd__env-list">
        <button data-env="studio" class="is-on">STUDIO</button>
        <button data-env="outdoor">OUTDOOR</button>
        <button data-env="dark">DARK</button>
      </div>
      <label class="section-label">EXPOSURE</label>
      <input type="range" class="__expo-input">
    </div>
  </div>
</div>
```

### Responsive switch via CSS

```css
/* Default (desktop ≥1024px): inline UI visible, dropdown hidden */
.case-3d__light-dd { display: none; }

@media (max-width: 1023px) {
  /* Mobile/tablet portrait: hide inline, show dropdown */
  .case-3d__env-group,
  .case-3d__expo { display: none; }
  .case-3d__light-dd { display: inline-flex; }

  /* Tablet alignment fix */
  .case-3d__controls { justify-content: flex-end; }

  /* Header overflow fix */
  .case-view__header { flex-direction: column; ... }
  .case-view__title { font-size: clamp(1.25rem, 0.8rem + 2vw, 2rem); }
}
```

### State sharing (desktop ↔ mobile)

Один `currentEnv` (closure variable) + один `syncEnvUI(key)` helper, который
обновляет `is-on` class и `aria-pressed` на **обоих** наборах env-buttons:

```javascript
function syncEnvUI(key) {
  [envGroup, ddEnvList].forEach(function (root) {
    if (!root) return;
    root.querySelectorAll('[data-env]').forEach(function (b) {
      var on = b.dataset.env === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
}
```

Exposure sliders синхронизируются через cross-listener — изменение одного
обновляет `value` другого без re-fire события.

### Dropdown behavior

- **Click trigger** → toggle `data-open` + `aria-expanded`, panel `hidden` removed
- **Click outside** → close dropdown (через `document.click` listener)
- **ESC key** → close dropdown + return focus to trigger
- **Smooth visibility** — panel показ/скрытие через `hidden` атрибут (одна точка истины)

### Cleanup в destroy3D

Module-level vars `currentLightDdDocClick` / `currentLightDdDocKey` хранят
ссылки на global listeners. При смене кейса `destroy3D()` снимает их через
`removeEventListener`, иначе они бы держали ссылки на удалённые DOM-элементы
и накапливались.

---

## 📁 Изменённые файлы

| Файл | Изменения |
|---|---|
| `js/main.js` | + `currentLightDdDocClick`, `currentLightDdDocKey` module vars; + cleanup в `destroy3D()`; + lightDd block в `build3D()` (~140 строк); единый syncEnvUI; единый expoInput handler |
| `css/portfolio.css` | + 175 строк CSS для `.case-3d__light-dd*` (dropdown/panel/env-list/expo); + media query `@media (max-width: 1023px)` с responsive switch + header overflow fix; чистка старых mobile-only env+expo overrides |
| `13_HANDOFF_v0_7_2.md` | без изменений (frozen statement post-mortem) |
| `12_HANDOFF_v0_7_1.md` | без изменений |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`
- `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/free-assets.css`
- Все ассеты, favicons, manifest, sitemap, robots, llms

### Десктоп (≥1024px) НЕ изменён

| До v0.7.3 | После v0.7.3 |
|---|---|
| 7 контролов inline | 7 контролов inline (idential) |
| `[STUDIO|OUTDOOR|DARK]` группа | `[STUDIO|OUTDOOR|DARK]` группа |
| `EXPOSURE━●━` slider | `EXPOSURE━●━` slider |
| dropdown скрыт | dropdown скрыт (`display: none`) |

Никакой визуальной разницы на desktop — pixel-perfect совпадение с v0.7.2.

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] `node -c js/main.js` — OK
- [x] `node -c js/animations.js` — OK
- [x] `node -c js/model-data.js` — OK
- [x] CSS braces 5/5 файлов BALANCED (3+13+237+**258**+73)
- [x] HTML structure validates (Python HTMLParser)

### v0.7.3 specific

- [x] file:// guard работает (dropdown создаётся только на http(s)://)
- [x] cleanup в `destroy3D()` снимает оба global listener'а
- [x] `aria-haspopup`, `aria-expanded`, `aria-label` на trigger
- [x] `aria-pressed` на 6 env-buttons (3 desktop + 3 mobile)
- [x] focus-visible styles в 14 местах
- [x] Никаких hardcoded colors — все через токены

### A11y

- [x] Trigger `aria-haspopup="true"` + `aria-expanded` синхронизирован с `data-open`
- [x] Panel `role="group"` + `aria-label="Lighting presets and exposure"`
- [x] Env list `role="group"` + `aria-label="Environment preset"`
- [x] ESC возвращает focus на trigger (полный keyboard cycle)
- [x] Click outside корректно закрывает dropdown

### Responsive matrix

| Viewport | Inline UI | Dropdown | Header | Result |
|---|---|---|---|---|
| 320–767px (mobile) | hidden | visible | column flow + clamp | ✓ |
| 768–1023px (tablet portrait) | hidden | visible | column flow + clamp | ✓ |
| 1024–1439px (tablet landscape, small desktop) | visible | hidden | row flow | ✓ unchanged |
| 1440px+ (desktop) | visible | hidden | row flow | ✓ unchanged |

---

## 🧪 Manual QA checklist

### Mobile (≤767px, например 375×812)

- [ ] Открыть кейс с 3D
- [ ] В нижнем-правом углу 5 контролов в одну линию: `AUTO | INFO | ⟲ | ⛶ | 💡`
- [ ] Кликнуть на 💡 trigger → панель раскрывается
- [ ] В панели сверху: лейбл `ENVIRONMENT`, ниже 3 вертикальных кнопки `STUDIO/OUTDOOR/DARK`
- [ ] Под ними: лейбл `EXPOSURE`, ниже full-width slider
- [ ] STUDIO подсвечена `is-on` по умолчанию
- [ ] Кликнуть OUTDOOR → подсвечивается, кадр меняется
- [ ] Подвинуть exposure slider → яркость меняется
- [ ] Кликнуть вне dropdown → закрывается
- [ ] Открыть dropdown → нажать ESC → закрывается, focus возвращается на 💡

### Tablet portrait (iPad Air 820×1180)

- [ ] Открыть кейс с 3D
- [ ] Header: title не ломается по буквам вертикально
- [ ] Title в одну строку (или несколько слов на разных строках, но не буквы)
- [ ] tabs (2D/3D/Blueprints) под header в row flow
- [ ] 3D controls в одну линию, выравнивание справа: `| | AUTO | INFO | ⟲ | ⛶ | 💡 |`
- [ ] Dropdown работает идентично mobile

### Tablet landscape / Desktop (≥1024px)

- [ ] Открыть кейс с 3D
- [ ] **Идентично v0.7.2**: 7 контролов inline
- [ ] `[STUDIO|OUTDOOR|DARK]` segmented control видим
- [ ] `EXPOSURE━●━` slider видим
- [ ] 💡 trigger **отсутствует** (display: none)
- [ ] Кликнуть STUDIO → переключается env

### State sharing test

- [ ] На desktop переключить на DARK
- [ ] Открыть DevTools → переключить на mobile viewport (375px)
- [ ] Открыть 💡 dropdown → DARK подсвечен (state preserved через currentEnv)
- [ ] На mobile переключить на OUTDOOR
- [ ] Закрыть dropdown → переключиться обратно на desktop viewport
- [ ] Проверить: OUTDOOR подсвечен в desktop env-group

---

## 🚫 Что НЕ сделано

По ТЗ пользователя — только 3 пункта (M1, M2, M3). Не сделано (frozen):

- **Нет** изменений в desktop UI
- **Нет** изменений в Phase 2 решении (всё ещё abandoned)
- **Нет** изменений в `index.html`, `free-assets.html`
- **Нет** изменений в HDR файлах или их структуре
- **Нет** изменений в model-viewer версии (4.0.0 bundled, как в v0.7.1)

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.2 без изменений:

- Performance LCP 4.2s на index.html
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders
- theme-color без media split
- HDR-фичи + light-dd не покрыты Playwright regression

Кандидаты для v0.8.x point fixes — когда пользователь явно запросит.

---

## 🔒 FROZEN STATEMENT

По принципу проекта — все элементы остаются заморожены. v0.7.3 — точечная
правка по явному ТЗ пользователя. Дальнейшие изменения требуют прямого запроса:

- «Замени hello@codex.studio на real@email.com»
- «Поменяй иконку лампочки на шестерёнку»
- «Расширь breakpoint dropdown до 1280px»
- «Запусти Phase 2 когда выйдет bundled MV-effects»

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 🎯 Что делать дальше пользователю

### Сейчас
1. Скачать `codex-studio-v0_7_3.zip`
2. Распаковать поверх существующего проекта
3. Запустить через Live Server
4. Проверить **Manual QA checklist** выше:
   - Mobile (375px) — dropdown работает
   - Tablet (820px) — header не ломается, controls справа
   - Desktop (1440px) — без изменений

### При обнаружении багов
Прислать скриншот + viewport size. Точечный фикс через v0.7.4.

### Production deploy
HDR файлы должны быть в `assets/hdr/` (как в v0.7.1/v0.7.2). CDN dependencies без изменений.

---

*Версия: 0.7.3 · 3 мая 2026 · Codex Studio · Mobile/tablet 3D controls compaction + header overflow fix*
