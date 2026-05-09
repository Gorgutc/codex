# 13 — HANDOFF · v0.7.2 (FINAL)
## Codex Studio — IBL HDR Lighting (frozen) + Phase 2 abandoned

> Финальная версия после отката неудавшегося Phase 2. v0.7.2 = v0.7.1
> + полная документация причин отказа от bloom/SSAO + frozen statement.
>
> **Все элементы проекта заморожены до явного запроса пользователя.**

---

## 📦 Версия и статус

- **Версия:** 0.7.2 (FINAL FROZEN)
- **Дата:** 3 мая 2026
- **Архив:** `codex-studio-v0_7_2.zip`
- **Базируется на:** v0.7.1 (без изменений в коде)
- **Phase 2 (bloom + SSAO):** ABANDONED — см. post-mortem ниже

### Что в v0.7.2 ИДЕНТИЧНО v0.7.1

- `js/main.js` — без изменений
- `css/portfolio.css` — без изменений
- `css/shared.css`, `css/tokens.css`, `css/reset.css`, `css/free-assets.css` — без изменений
- `index.html`, `free-assets.html` — без изменений
- `js/animations.js`, `js/model-data.js` — без изменений
- `assets/hdr/` — без изменений (3 HDR файла + README)
- Все остальные ассеты — без изменений

### Что добавлено vs v0.7.1

- `13_HANDOFF_v0_7_2.md` — этот файл
- `CHANGELOG.md` — раздел v0.7.2 с post-mortem Phase 2
- `08_ITERATION_HISTORY.md` — секция «ФАЗА 9.5 — Phase 2 abandoned»

**Изменения только документационные. Код полностью идентичен v0.7.1.**

---

## 🔥 Post-mortem: почему Phase 2 был отменён

### Что пытались сделать

Phase 2 (план в чате):
- Bloom + SSAO post-processing через `@google/model-viewer-effects` 1.5.0
- Color Grade в конце pipeline (technical, для ACES tonemap)
- Один UI toggle EFFECTS

### Что пошло не так

**Архитектурная зависимость:** model-viewer-effects работает только с **unbundled**
сборкой `model-viewer-module.min.js` + import map для **three.js** как peer dependency.

```html
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.174.0/build/three.module.min.js" } }
</script>
```

Проблема: версия three.js должна **точно** совпадать с той, на которой
тестировался конкретный релиз model-viewer. Без npm/lockfile это
hand-pin через CDN URLs.

### Симптом краха

```
Uncaught SyntaxError: The requested module 'three' does not provide
an export named 'UnsignedInt101111Type' (at model-viewer-module.min.js:1:2185)
```

`model-viewer@4.2.0` импортирует символ `UnsignedInt101111Type` из three.js,
который доступен **только в версиях newer чем 0.174.0**. Я установил `three@0.174.0`
(на основе одного из источников, который, как выяснилось, был неточным).

Неправильная версия → module parsing fails → `customElements.define('model-viewer', ...)`
не вызывается → пустой canvas, нет controls.

### Почему откат правильный

**1. Архитектурная хрупкость:** каждый upgrade model-viewer требует ручной проверки
peer-dep three. Без npm/lockfile (запрещены проектным constraint «no build tools»)
это лотерея.

**2. Документация не централизована:** разные источники указывали разные версии
three для одного и того же model-viewer. Master `package.json` GitHub говорил
`three@^0.170.0`, DeepWiki — `^0.174.0`, реальный CDN-binary в bundle хотел еще
более свежую. Невозможно надёжно угадать без npm install + manual test.

**3. ROI слабый:** v0.7.1 уже даёт ~70% wow-эффекта от Marmoset через HDR + Exposure.
Bloom + SSAO добавили бы 15%, но за это:
- +800 KB в bundle
- 5+ часов работы на регрессию 18+ моделей
- Постоянный риск версионных проблем при каждом MV апдейте
- Нарушение принципа Codex Studio: «boring, stable, works for years»

**4. Альтернатива есть:** если в будущем bloom/SSAO критичны — два пути:
- Дождаться когда Google выпустит **bundled** билд `model-viewer-effects`
  (внутри issue tracker уже обсуждается)
- Перейти на сборку через npm + один bundled.js (ломает constraint, но даёт стабильность)

### Что сохранено для будущего

В этом handoff (см. ниже секцию «v0.8.0 BLUEPRINT (frozen plan)») зафиксированы:
- Точная архитектура Phase 2 которая работала бы при правильных версиях
- Pipeline order: SSAO → Bloom → Color Grade
- Decision points пользователя из чата
- Раскрытая критическая находка: `<color-grade-effect>` обязателен для ACES tonemap

Когда Google выпустит bundled `model-viewer-effects` или появится npm-сборка
проекта — этот blueprint можно достать и применить за 1-2 часа.

### Lessons learned

1. **Перед архитектурными переходами — `npm install` в sandbox для проверки версий.**
   Не угадывать через web search.
2. **Constraints проекта (no build tools, no npm) ограничивают architectural choices.**
   Фичи которые требуют peer-deps — не подходят без bundled-варианта.
3. **70% wow-эффекта без архитектурного риска > 100% эффекта с риском.**
4. **`customElements.whenDefined()` race fix v0.8.1 был корректным решением** на race
   condition уровне, но не лечил underlying version mismatch. Symptom-fix vs root-cause.

---

## ⛔ FROZEN STATEMENT — Все элементы зафиксированы

По прямому указанию пользователя — **никакие изменения не допустимы** без явного запроса.

### Заморожено

| Категория | Файлы | Статус |
|---|---|---|
| HTML | `index.html`, `free-assets.html` | 🔒 FROZEN |
| CSS | Все 5 файлов в `css/` | 🔒 FROZEN |
| JS | `main.js`, `animations.js`, `model-data.js` | 🔒 FROZEN |
| Assets | `assets/img/`, `assets/cards/`, `assets/cases/`, `assets/favicon/`, `assets/models/` | 🔒 FROZEN |
| HDR | `assets/hdr/*.hdr` (имена файлов) | 🔒 FROZEN (контент можно заменить на другие polyhaven HDR) |
| Конфигурация | `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest` | 🔒 FROZEN |
| Документация | `09_–13_HANDOFF*.md`, `CHANGELOG.md`, `08_ITERATION_HISTORY.md` | 🔒 FROZEN |
| Тесты | `verify-frozen.js` v0.4 | 🔒 FROZEN |

### Что разрешено без явного запроса

**НИЧЕГО.** Любое изменение требует явного указания пользователя:
- «Измени X в файле Y»
- «Добавь функционал Z»
- «Исправь баг в M»
- «Запусти Phase N»

Без таких указаний — **только просмотр и анализ**, никаких str_replace / create_file.

### Что разрешено с явного запроса

- Bug fixes по прямому ТЗ от пользователя
- Контентные правки (тексты, описания, real проектные данные)
- Замена HDR файлов на другие (имена и количество фиксированы)
- Замена JSON-LD `sameAs` placeholder URLs на реальные
- Замена email `hello@codex.studio` на реальный
- Замена `/downloads/*.zip` placeholder на реальные ZIP
- Запуск задач из Phase 2 BLUEPRINT когда инфраструктура созреет

---

## 📁 Полная файловая структура v0.7.2

```
codex-studio/
├── 13_HANDOFF_v0_7_2.md                ← этот файл (NEW)
├── 12_HANDOFF_v0_7_1.md                ← историческая справка
├── 11_HANDOFF_GOLDEN_0_6.md            ← историческая справка
├── 10_HANDOFF_GOLDEN_0_5.md            ← историческая справка
├── 09_HANDOFF_GOLDEN_0_4.md            ← историческая справка
├── 08_ITERATION_HISTORY.md             ← обновлён: ФАЗА 9.5 (Phase 2 abandoned)
├── CHANGELOG.md                        ← обновлён: v0.7.2 секция вверху
├── README.md                           ← без изменений
├── robots.txt                          ← без изменений
├── sitemap.xml                         ← без изменений
├── llms.txt                            ← без изменений
├── verify-frozen.js                    ← без изменений (v0.4)
├── index.html                          ← без изменений (frozen Golden 0.6)
├── free-assets.html                    ← без изменений (frozen Golden 0.6)
├── css/
│   ├── tokens.css                      ← без изменений
│   ├── reset.css                       ← без изменений
│   ├── shared.css                      ← без изменений
│   ├── portfolio.css                   ← без изменений (содержит v0.7.0/0.7.1 блоки)
│   └── free-assets.css                 ← без изменений
├── js/
│   ├── main.js                         ← без изменений (содержит file:// guard v0.7.1)
│   ├── animations.js                   ← без изменений
│   └── model-data.js                   ← без изменений
├── downloads/                          ← без изменений (412-byte placeholders)
└── assets/
    ├── hdr/                            ← из v0.7.1
    │   ├── README.md                   ← инструкции по HDR
    │   ├── studio.hdr                  ← (файл локально у пользователя)
    │   ├── outdoor.hdr
    │   └── dark.hdr
    ├── img/                            ← без изменений
    ├── cards/                          ← без изменений
    ├── cases/                          ← без изменений
    ├── models/                         ← без изменений
    └── favicon/                        ← без изменений
```

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] `node -c js/main.js` — OK
- [x] `node -c js/animations.js` — OK
- [x] `node -c js/model-data.js` — OK
- [x] CSS braces 5/5 файлов BALANCED (3+13+237+238+73)
- [x] HTML structure validates (Python HTMLParser)
- [x] `site.webmanifest` JSON valid

### Stack compliance

- [x] Только HTML + CSS + Vanilla JS
- [x] GSAP 3.13.0 + ScrollTrigger + SplitText (3 CDN scripts)
- [x] No `defer` на скриптах
- [x] No `localStorage` / `sessionStorage`
- [x] Hardcoded colors только в `CARDS_DATA` palette (frozen Golden 0.6)

### Architecture (3D viewer)

- [x] model-viewer 4.0.0 **bundled** (через `ajax.googleapis.com`)
- [x] Lazy-load script при первом 3D-клике
- [x] file:// CORS guard (graceful fallback на `'neutral'`)
- [x] HDR работает на http(s):// (3 пресета: studio / outdoor / dark)
- [x] Exposure slider 0.5–2.0
- [x] Environment switcher segmented control

### A11y

- [x] `gsap.registerPlugin(ScrollTrigger)` на строке 11 в `animations.js`
- [x] focus-visible в 5 CSS файлах (29 occurrences)
- [x] prefers-reduced-motion в CSS (15 occurrences)
- [x] prefers-reduced-motion в JS (6 occurrences)
- [x] Один <h1> на странице
- [x] data-theme="dark" на body

### Anti-AI patterns

- [x] No gradient buttons
- [x] No colored border-left на карточках
- [x] No aurora / mesh gradient
- [x] No icon circles
- [x] No emoji в UI
- [x] Кириллица только в комментариях для разработчика, не в visible UI

### Required files

- [x] index.html, free-assets.html
- [x] 5 CSS, 3 JS файла
- [x] `assets/hdr/README.md`
- [x] `assets/favicon/site.webmanifest`
- [x] `assets/favicon/favicon.ico`

### Meta-теги

- [x] canonical (1)
- [x] og:url, og:title, og:image (4 — для разных контекстов)
- [x] twitter:card, twitter:image
- [x] theme-color (1 — frozen Golden 0.6, для prod надо бы 2 с media split)
- [x] manifest link

### Browser support (без архитектурных рисков Phase 2)

- [x] Bundled MV 4.0.0 — работает в **всех evergreen** browsers (включая Safari < 16.4)
- [x] HDR работает только на http(s):// (file:// → graceful fallback на 'neutral')
- [x] Live Server / `python3 -m http.server` рекомендованы для локальной разработки

---

## 📋 v0.8.0 BLUEPRINT (frozen plan для будущего)

Когда Google выпустит bundled `model-viewer-effects`, или будет принято решение
перейти на npm-сборку — этот план готов к применению.

### Architectural prerequisites (обязательны)

1. **EITHER** model-viewer выпускает bundled билд с effects:
   ```html
   <script type="module"
           src="https://ajax.googleapis.com/ajax/libs/model-viewer-effects/X.X.X/model-viewer-effects.min.js"></script>
   ```
   Тогда bundled MV + bundled effects, без import map, без peer-deps.

2. **OR** проект переходит на npm + один bundled output.js:
   - Нарушает текущий constraint «no build tools»
   - Требует CI/CD pipeline для деплоя
   - Lockfile гарантирует версии

### Pipeline (когда инфраструктура готова)

```javascript
// В build3D() после mv.appendChild
var composer = document.createElement('effect-composer');
composer.setAttribute('render-mode', 'performance');

var ssao = document.createElement('ssao-effect');
var bloom = document.createElement('bloom-effect');
var colorGrade = document.createElement('color-grade-effect'); // ОБЯЗАТЕЛЬНЫЙ для ACES

if (!effectsOn) {
  ssao.setAttribute('blend-mode', 'skip');
  bloom.setAttribute('blend-mode', 'skip');
}

composer.appendChild(ssao);
composer.appendChild(bloom);
composer.appendChild(colorGrade); // КРИТИЧНО: последний для ACES tonemap restore
mv.appendChild(composer);
```

### Decision points (зафиксированы из чата)

- Bloom params: дефолты model-viewer-effects (более выраженные)
- SSAO params: дефолты model-viewer-effects
- UX: Variant A (один toggle EFFECTS на bloom+ssao)
- Default state: ON desktop / OFF mobile (< 768px) / OFF reduced-motion / OFF file://
- Color Grade: всегда ON (technical, не управляется UI)

### Race condition fix (v0.8.1, valid pattern)

`customElements.whenDefined()` вместо `customElements.get()` — этот fix остаётся
правильным архитектурным паттерном независимо от версионных проблем. Когда
Phase 2 будет реализован — применить этот pattern.

```javascript
function waitForCustomElement(name, timeoutMs) {
  return new Promise(function (resOk, resFail) {
    if (window.customElements && window.customElements.get(name)) {
      resOk(); return;
    }
    var timeout = setTimeout(function () {
      resFail(new Error('whenDefined("' + name + '") timeout after ' + timeoutMs + 'ms'));
    }, timeoutMs);
    window.customElements.whenDefined(name).then(function () {
      clearTimeout(timeout); resOk();
    });
  });
}
```

---

## 🐛 Унаследованные нерешённые проблемы (frozen)

Все эти проблемы существуют с Golden 0.6 и НЕ исправляются в v0.7.2 (frozen statement):

- **Performance LCP 4.2s** на index.html (выше цели 2.5s)
- **Unused CSS ~30-40 KiB** в shared.css
- **`/downloads/*.zip`** placeholder файлы 412 bytes на 4 кейса
- **JSON-LD `sameAs`** placeholder URLs ("REPLACE_WITH_REAL")
- **theme-color** один тег без `media=""` split (v0.7.x kept Golden 0.6 поведение)
- **html-validate** 24 errors на index, 8 на FA — `prefer-native-element` для `role="listbox"`
- **HDR-фичи не покрыты** Playwright regression (verify-frozen.js v0.4)

Все эти задачи — кандидаты для **v1.0 polish** итерации, когда пользователь явно
запросит улучшение Lighthouse.

---

## 🎯 Что делать дальше пользователю

### Если всё устраивает — DEPLOY

1. Загрузи `codex-studio-v0_7_2.zip` на GitHub Pages / Netlify
2. Убедись что 3 HDR файла в `assets/hdr/` доехали до production
3. Запусти Lighthouse audit на production — зафиксируй baseline
4. Заменить placeholder content (email, JSON-LD `sameAs`, real ZIP files) — это будут
   отдельные точечные правки, не итерация

### Если что-то нужно — explicit ASK

По frozen statement — **никаких автономных правок**. Любое изменение требует прямого
запроса вида:
- «Замени hello@codex.studio на real@email.com»
- «Добавь real link на Behance в JSON-LD»
- «Исправь баг X в кейсе Y»
- «Подготовь Phase 2 когда будет bundled MV-effects»

### Признаки что время для следующей итерации

Сигналы что можно вернуться к Phase 2 или v1.0:
- Google анонсировал bundled `model-viewer-effects` (отслеживать GitHub releases)
- Пользователь решил перейти на npm + build (отдельное архитектурное решение)
- Пользователь готов потратить итерацию на Lighthouse improvement (LCP < 2.5s)
- Появились реальные данные (Behance/Artstation/email/проектные ZIP) — точечные правки

---

*Версия: 0.7.2 FINAL · 3 мая 2026 · Codex Studio · Phase 1 закрыта · Phase 2 abandoned (architectural risk) · ALL FROZEN*
