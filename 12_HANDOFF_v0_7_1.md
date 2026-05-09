# 12 — HANDOFF · v0.7.1
## Codex Studio — IBL HDR Lighting + file:// CORS guard

> Phase 1 завершена. 3D-вьювер получил HDR environment maps (IBL) с
> переключателем Studio / Outdoor / Dark + регулировку exposure 0.5–2.0.
> Под двойной клик `file://` сделан graceful fallback на `'neutral'`.
>
> При проблемах с этой версией — откат к Golden 0.6 архиву.

---

## 📦 Версия и статус

- **Версия:** 0.7.1
- **Дата:** 3 мая 2026
- **Архив:** `codex-studio-v0_7_1.zip`
- **Базируется на:** Golden 0.6 (`codex-studio-v0_6_0-GOLDEN.zip`)
- **Точка отката:** Golden 0.6
- **Phase 2 (bloom):** НЕ сделано в этой итерации — вынесено в v0.8.0

### Финальные метрики

| Проверка | Результат |
|---|---|
| Playwright regression (`verify-frozen.js`) | без изменений vs v0.6 (56/56 PASS, 0 FAIL — HDR-фичи не покрыты регрессией) |
| Lighthouse `index.html` | без изменений vs v0.6 (Perf 73, A11y 100, BP 95, SEO 100) |
| Lighthouse `free-assets.html` | без изменений vs v0.6 |
| JS syntax (`node -c`) | OK |
| CSS braces balance | 238/238 BALANCED |

### Что закрыто в 0.7.1

Phase 1 из ТЗ пользователя «Three.js viewer upgrade»:

| # | Задача | Файл(ы) |
|---|---|---|
| **U1** | IBL освещение через HDR (environment-image) — 3 пресета: Studio (default), Outdoor, Dark | `js/main.js` |
| **U2** | Exposure slider 0.5–2.0 (default 1.0) | `js/main.js`, `css/portfolio.css` |
| **U3** | Environment switcher (segmented control: STUDIO / OUTDOOR / DARK) | `js/main.js`, `css/portfolio.css` |
| **U4** | Mobile responsive: `flex-wrap` на controls, уменьшенные paddings | `css/portfolio.css` |
| **U5** | `prefers-reduced-motion` overrides для exposure thumb transition | `css/portfolio.css` |
| **U6** | **file:// CORS guard** (v0.7.1 hotfix): graceful fallback на `'neutral'` + console warning + UI HDR-controls скрыты | `js/main.js` |

### Что НЕ сделано в этой итерации (Phase 2 → v0.8.0)

| # | Причина откладывания |
|---|---|
| ~~U7~~ Bloom post-processing | Требует архитектурной правки: model-viewer 4.0.0 → 4.2.0, переход с bundled на unbundled `model-viewer-module.min.js`, import map для three, `@google/model-viewer-effects` 1.5.0. Регрессия всех 20 моделей. |
| ~~U8~~ Wireframe / Polygon overlay | Невозможен на model-viewer (closed shadow DOM). Требует rewrite на pure Three.js — выходит за рамки upgrade-задачи. |

ТЗ пользователя содержало ошибочное предположение о использовании Three.js
напрямую, но проект работает через Google `<model-viewer>` web component.
Wireframe-функция в текущей архитектуре физически не реализуема. Подробный
разбор — в чате диалога перед началом Phase 1.

---

## 📁 Файловая структура (отличия от 0.6)

```
codex-studio/
├── index.html                          ← без изменений
├── free-assets.html                    ← без изменений
├── README.md                           ← без изменений
├── CHANGELOG.md                        ← обновлён: добавлен v0.7.1 раздел
├── 08_ITERATION_HISTORY.md             ← обновлён: добавлена ФАЗА 4 (v0.7.1)
├── 09_HANDOFF_GOLDEN_0_4.md            ← историческая справка
├── 10_HANDOFF_GOLDEN_0_5.md            ← историческая справка
├── 11_HANDOFF_GOLDEN_0_6.md            ← историческая справка
├── 12_HANDOFF_v0_7_1.md                ← ★ NEW — этот файл
├── verify-frozen.js                    ← без изменений
├── robots.txt                          ← без изменений
├── sitemap.xml                         ← без изменений
├── llms.txt                            ← без изменений
├── css/
│   ├── tokens.css                      ← без изменений
│   ├── reset.css                       ← без изменений
│   ├── shared.css                      ← без изменений
│   ├── portfolio.css                   ← обновлён: U2, U3, U4, U5
│   └── free-assets.css                 ← без изменений
├── js/
│   ├── main.js                         ← обновлён: U1, U2, U3, U6
│   ├── animations.js                   ← без изменений
│   └── model-data.js                   ← без изменений
└── assets/
    ├── hdr/                            ← ★ NEW
    │   ├── README.md                   ← инструкции по HDR
    │   ├── studio.hdr                  ← 1k HDR (CC0, polyhaven studio_small_08)
    │   ├── outdoor.hdr                 ← 1k HDR (CC0, polyhaven kloppenheim_06)
    │   └── dark.hdr                    ← 1k HDR (CC0, polyhaven studio_small_03)
    ├── img/                            ← без изменений
    ├── cards/                          ← без изменений
    ├── cases/                          ← без изменений
    ├── models/                         ← без изменений
    └── favicon/                        ← без изменений
```

**Итого изменённых файлов: 4 (из ~30 в проекте) + 1 новая папка с 4 файлами.**

---

## 🚀 Что нужно знать перед следующей итерацией (0.8+)

### HDR файлы — внешние ассеты (CC0 polyhaven)

Файлы НЕ инлайнятся в `model-data.js` (как GLB) — слишком большие (~3 MB
суммарно базовых данных + ~12 MB как base64 → убил бы LCP). Грузятся
лениво по сети при первом клике на 3D-вкладку.

**Production deploy ОБЯЗАТЕЛЕН** для HDR на GitHub Pages / Netlify:

```bash
# Перед deploy:
ls -la assets/hdr/
# должны быть: README.md  studio.hdr  outdoor.hdr  dark.hdr
```

Если HDR файлов нет — на http(s):// будет 404 → model-viewer стрельнёт `error`
event → пользователь увидит "MODEL UNAVAILABLE" на всех 3D-кейсах.

### file:// guard — постоянная архитектурная защита

`window.location.protocol === 'file:'` проверяется в `build3D()` (main.js).
На file:// — `environment-image='neutral'` (procedural, без сети) +
HDR-controls **не создаются** в DOM. Console.warn разработчику.

**При добавлении новых features, требующих fetch локальных ресурсов** —
повторно использовать этот pattern. См. также pattern для GLB:
`window.CODEX_LOCAL_GLB` в `model-data.js` (data:URI inline).

### Exposure: model-viewer property vs attribute

`mv.exposure = 1.5` (property) работает быстрее, чем
`mv.setAttribute('exposure', '1.5')`. Используется property API.
Если потребуется persist — менять на attribute (для serialization).

### State per-case (не персистится)

Каждый новый 3D-кейс открывается с **Studio + exposure 1.0**. Это
намеренно — sandbox-ограничения проекта (no localStorage / no sessionStorage).
Глобальный флаг типа `window.CODEX_MI_ON` (для Model Info) — теоретически
возможен и для env, но не реализован: каждый кейс — чистый старт.

### Live Server / локальный сервер обязателен для разработки

Двойной клик на index.html (`file://`) больше не показывает HDR-фичи.
Команда разработки переходит на:
- VSCode + Live Server (рекомендация для пользователя)
- `python3 -m http.server 5555`
- `npx serve .`

---

## 🐛 Известные нерешённые проблемы (унаследованы из 0.6 + новые)

### От Golden 0.6 (без изменений)

- Performance LCP **4.2s** на index.html — выше цели 2.5s. Требует
  architectural решения: critical CSS inline + preload main.js + async non-critical CSS.
- Unused CSS ~30-40 KiB в shared.css.
- `/downloads/` — заглушки 412 bytes на 4 кейса, 21 ZIP отсутствует.
- JSON-LD `sameAs` placeholders ("REPLACE_WITH_REAL").
- html-validate 24 errors на index, 8 на FA — `prefer-native-element` для
  `role="listbox"` и `role="region"` (намеренные паттерны).

### Новые в 0.7.1

- **HDR-фичи не покрыты Playwright regression.** verify-frozen.js v0.4
  не имеет тестов на наличие env-switcher, exposure-slider, file:// guard.
  Возможные новые тесты для следующей итерации:
  - `3D-CONTROLS-env-group-on-http` — viewport http://localhost, открыть кейс,
    проверить наличие `.case-3d__env-group` в DOM.
  - `3D-CONTROLS-env-group-absent-on-file` — viewport file://, открыть кейс,
    проверить отсутствие `.case-3d__env-group`.
- **HDR not validated as 1k.** Если пользователь подменит файлы на 4k/8k,
  size budget сломается (model-viewer всё равно clamp до 1k, но трафик
  потратится). Нужен опциональный pre-deploy чек размеров.
- **Lighthouse Network throttling unknown.** На slow 3G — 3 HDR файла
  (~4 MB total) могут серьёзно ухудшить TTI при первом 3D-клике.
  Требует измерения.

---

## 🔧 Технические константы (без изменений vs 0.6)

| Параметр | Значение |
|---|---|
| Стек | HTML + CSS + Vanilla JS |
| GSAP | 3.13.0 (через `cdn.jsdelivr.net`) |
| model-viewer | **4.0.0** (bundled, через `ajax.googleapis.com`) — НЕ изменён |
| Шрифты | Clash Display + General Sans (Fontshare CDN) |
| Темы | dark (default) + light (через `data-theme`) |
| Скрипты | строго перед `</body>`, БЕЗ `defer` |
| Хранилище | НЕТ localStorage / sessionStorage |
| Domain | codex.promo |
| HDR пресеты | polyhaven CC0: studio_small_08, kloppenheim_06, studio_small_03 |

---

## ⚠️ Замороженное в 0.7.1 — НЕ ТРОГАТЬ без явного тикета

### HTML / Доменная конфигурация

- `index.html` — целиком (после Golden 0.6)
- `free-assets.html` — целиком (после Golden 0.6)
- Все meta-теги, JSON-LD, OG, sitemap, robots, llms — без изменений

### CSS

- `tokens.css` — заморожен
- `reset.css` — заморожен
- `shared.css` — заморожен
- `portfolio.css` — заморожен **кроме блоков v0.7.0 / v0.7.1** (env-group, exposure, mobile overrides). Эти блоки можно расширять при необходимости.
- `free-assets.css` — заморожен

### JS

- `animations.js` — заморожен
- `model-data.js` — заморожен (GLB inline data:URIs неизменны)
- `main.js` — заморожен **кроме `build3D()` функции** (расширена для HDR)

### Assets

- Все папки кроме новой `assets/hdr/` — заморожены
- `assets/hdr/studio.hdr`, `outdoor.hdr`, `dark.hdr` — могут быть **заменены** на другие polyhaven HDR без правок кода (имена файлов фиксированы)

---

## 🧪 Manual QA после deploy

При тестировании v0.7.1 проверить:

### На localhost (Live Server / python http.server)

- [ ] Открыть кейс с 3D → видны 5 controls в правом-нижнем углу:
      `AUTO ROTATION | MODEL INFO | RESET | FULLSCREEN | [STUDIO|OUTDOOR|DARK] | EXPOSURE━●━`
- [ ] Network: `studio.hdr` → 200 OK (~1 MB) при первом 3D-клике
- [ ] Кликнуть OUTDOOR → `outdoor.hdr` грузится → кадр визуально меняется
- [ ] Кликнуть DARK → `dark.hdr` грузится → кадр становится драматичнее
- [ ] Двигать EXPOSURE slider → яркость модели меняется плавно
- [ ] Активная env-кнопка подсвечена `--color-primary` фоном
- [ ] Tab-navigation проходит: STUDIO → OUTDOOR → DARK → EXPOSURE input
- [ ] Mobile (375×812): controls переносятся на 2 строки без overflow
- [ ] Light theme toggle: env-кнопки и slider читаемы (через токены)
- [ ] DevTools → Console: НЕТ красных errors

### На file:// (двойной клик — graceful fallback)

- [ ] Открыть кейс с 3D → controls БЕЗ env-group и exposure (только AUTO/INFO/RESET/FS)
- [ ] Console: warning `[v0.7.1] HDR environment maps require an HTTP(S) server...`
- [ ] Модель грузится корректно с `'neutral'` освещением
- [ ] Никаких "MODEL UNAVAILABLE" ошибок

### На production (после deploy на codex.promo)

- [ ] Все 3 HDR доступны: `https://codex.promo/assets/hdr/studio.hdr` → 200
- [ ] HDR-controls появляются на всех 20 кейсах с 3D
- [ ] Lighthouse Performance не упал >5 пунктов от Golden 0.6 baseline
- [ ] Lighthouse Accessibility / Best Practices / SEO — без изменений

---

## 📋 Phase 2 (v0.8.0) — план

Когда пользователь будет готов начать Phase 2 — план следующий:

### Архитектурные изменения (BLOCKER без них effects не работают)

1. **Апгрейд model-viewer:** 4.0.0 → 4.2.0 (latest stable)
2. **Переход с bundled на unbundled:**
   - `model-viewer.min.js` (bundled) → `model-viewer-module.min.js` (unbundled, peer deps three.js)
   - `<script type="module">` в head с `crossorigin`
3. **Import map для three.js:**
   ```html
   <script type="importmap">
   { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@^0.174.0/build/three.module.min.js" } }
   </script>
   ```
4. **Подключение `@google/model-viewer-effects`:**
   - Module script через jsDelivr
   - Версия 1.5.0+ (peer dep model-viewer ^4.1.0)

### Функциональные изменения

5. **Bloom через `<effect-composer>`:**
   ```html
   <model-viewer src="...">
     <effect-composer>
       <bloom-effect strength="0.3" threshold="0.85" radius="0.4"></bloom-effect>
     </effect-composer>
   </model-viewer>
   ```
6. **Toggle Bloom button** в UI controls (рядом с AUTO ROTATION)
7. **Mobile bloom strength** = 0.15 (если оставить как было в ТЗ)
8. **Reduced-motion guard** (хотя bloom не анимация — можно опционально)

### Регрессия

9. Прогон всех 20 кейсов с 3D-моделями на:
   - http://localhost
   - https://codex.promo (preview deploy)
10. Замер Lighthouse Performance до и после
11. Проверка совместимости с iOS Safari, Firefox, Chrome
12. Замер LCP при первом клике на 3D (тяжелее теперь?)

### Откат-готовность

Перед Phase 2 — точка отката = Golden 0.7.1 (этот архив).
Если bloom ухудшит metrics > 10 пунктов или сломает кейсы → откат.

---

## 🎯 Decision points для пользователя в Phase 2

Перед началом v0.8.0 спросить:

1. Bloom параметры — точные или дать ему попробовать дефолты model-viewer-effects?
2. Размер bundle: текущий MV ~700 KB → unbundled ~600 KB three + ~700 KB MV core + ~80 KB effects = **~1.4 MB**. Удвоение. Принять?
3. Поддержка iOS < 16.4? (import maps native в Safari только с 16.4+; есть es-module-shims fallback +30 KB)
4. Альтернатива: SSAO (ambient occlusion) — для hard-surface обычно даёт больший wow эффект чем bloom. Не в ТЗ, но стоит обсудить.

---

*Версия: 0.7.1 · 3 мая 2026 · Codex Studio · Phase 1 закрыта*
