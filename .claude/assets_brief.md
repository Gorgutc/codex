# Assets Brief — Codex Studio

> Правила работы с изображениями, видео, 3D-моделями, HDR и медиа-контентом.
> Реальная инвентаризация ассетов v0.7.10 ниже.

---

## 📦 Реальный инвентарь ассетов

| Папка | Содержимое | Формат | Кол-во |
|---|---|---|---|
| `assets/cards/` | SVG-thumbnails для work-cards | inline-style SVG (8:6 viewBox) | 18 |
| `assets/cases/<id>/` | Слайды кейса в case-view 2D | SVG (`01.svg`–`05.svg`) | 18 кейсов × 5 = 90 |
| `assets/models/` | 3D-модели для main case-3d | GLB | 18 |
| `assets/models/free/` | 3D-модели для FA | GLB | 18 |
| `assets/hdr/` | IBL-окружение для 3D-вьювера | HDR (Polyhaven CC0) | 3 (`studio.hdr` / `outdoor.hdr` / `dark.hdr`) |
| `assets/img/og-image.jpg` | OG-image для index | JPEG 1200×630 | 1 |
| `assets/img/og-free-assets.jpg` | OG-image для FA | JPEG 1200×630 | 1 |
| `assets/favicon/` | Полный favicon-комплект | ico + png | 5 файлов |
| `downloads/` | ZIP-архивы ассетов (плейсхолдеры) | ZIP | 4 |

`EXPECTED_IDS` (`verify-frozen.js`) — 18 кейсов:
`orbital-mk-ii`, `vega-shell`, `ironclad-frame`, `corten-series`, `lumen-one`, `flux-capsule`, `nightshard`, `recon-drone`, `apex-frame`, `core-rig`, `helix-reveal`, `arc-motion`, `nyx-panther`, `drift-koi`, `glint-owl`, `mech-link`, `flex-spine`, `cad-strut`.

---

## 🖼 Форматы

| Тип | Формат | Notes |
|---|---|---|
| Превью карточки (work-card / fa-card) | SVG inline-style | Сейчас плейсхолдеры с градиентами; при замене на real renders — WebP 800×600 |
| Слайды кейса | SVG (real renders можно заменить на WebP) | 5 слайдов на кейс |
| OG-image | JPEG 1200×630, ≤200 KB | Per-page обязательно |
| 3D-модель | GLB (binary glTF 2.0) | DRACO compression желательно; max ~5 MB на модель |
| HDR | RGBE `.hdr` (Polyhaven CC0) | 1k разрешение достаточно для IBL; ~1.0–1.5 MB |
| UI иконки | Inline SVG | Никаких иконочных шрифтов |
| Логотип | Текст `<span class="logo__text">CODEX</span>` или `<svg class="logo__svg">` | Сейчас текстовый |
| Favicon | ico + png (16, 32, 180) | См. ниже |
| Видео (если будет) | MP4 (H.264) + WebM (VP9) | Никаких GIF |

---

## 📏 Размеры изображений

| Зона | Размер (px) | Ratio | Max size | Имя |
|---|---|---|---|---|
| Card thumbnail | 800×600 | 4:3 | 120 KB (если WebP) | `<id>.svg` или `<id>.webp` |
| Case slide | 1600×1000 (wide) / 800×1000 (tall) | 8:5 / 4:5 | 200 KB | `<id>/01.svg` … `05.svg` |
| OG-image | 1200×630 | ~1.9:1 | 200 KB | `og-image.jpg`, `og-free-assets.jpg` |
| Apple touch icon | 180×180 | 1:1 | — | `apple-touch-icon.png` |
| Favicon-32 | 32×32 | 1:1 | — | `favicon-32.png` |
| Favicon-16 | 16×16 | 1:1 | — | `favicon-16.png` |
| Favicon (multi) | 16+32 | 1:1 | — | `favicon.ico` |

**Имена favicon — без `xN`:** `favicon-16.png`, `favicon-32.png` (НЕ `favicon-16x16.png`).

---

## 🧊 3D-модели (GLB)

```html
<!-- model-viewer лениво инжектится в build3D() из main.js -->
<model-viewer
  src="./assets/models/<id>.glb"
  alt="<title> — interactive 3D viewer"
  camera-controls
  auto-rotate
  rotation-per-second="30deg"
  environment-image="./assets/hdr/studio.hdr"
  exposure="1.0"
  shadow-intensity="0.6"
  ar
  loading="eager">
</model-viewer>
```

**Правила:**
- DRACO compression желательна (уменьшает размер 5–10×)
- На `file://` (двойной клик по `index.html`) HDR `fetch()` блокируется CORS → fallback на `environment-image='neutral'` (захардкожен в `build3D()`). На `http(s)://` всё работает
- Лениво грузим скрипт `<model-viewer>` (`@google/model-viewer@4.0.0`) при первом клике на 3D-tab
- `model-data.js` (1.1 MB inline GLB data) — ленится в `main.js` через `loadModelData()`
- Camera presets, exposure, env-switcher (Studio / Outdoor / Dark) — встроены в UI

**HDR (Polyhaven CC0):**
- `studio.hdr` ← `studio_small_08` (low-contrast soft, default)
- `outdoor.hdr` ← `kloppenheim_06` (open field with sky)
- `dark.hdr` ← `studio_small_03` (high-contrast dark mood)

---

## 🎬 Видео (если добавляются)

```html
<video
  autoplay muted loop playsinline
  preload="metadata"
  width="1280" height="720"
  aria-label="3D turntable — <title>">
  <source src="./assets/.../<slug>.webm" type="video/webm">
  <source src="./assets/.../<slug>.mp4"  type="video/mp4">
</video>
```

- MP4 (H.264) + WebM (VP9), max **8 MB** на видео
- `preload="metadata"` обязательно
- `playsinline` обязателен для iOS Safari
- `autoplay muted loop` для background-видео

---

## 🗜 Сжатие

| Инструмент | Для чего |
|---|---|
| https://squoosh.app | WebP / AVIF |
| https://handbrake.fr | MP4 / WebM |
| https://jakearchibald.github.io/svgomg/ | SVG |
| https://gltf.report / https://github.com/donmccurdy/glTF-Transform | GLB + DRACO |

**Цели по весу (per-asset):**

| Ресурс | Максимум |
|---|---|
| Card thumbnail (WebP) | 120 KB |
| Case slide (WebP) | 200 KB |
| OG-image (JPEG) | 200 KB |
| GLB | ~5 MB (с DRACO желательно ≤ 2 MB) |
| HDR | 1.5 MB |
| Видео turntable | 8 MB |

Текущий `model-data.js` 1.1 MB — известная проблема (frozen issue), lazy-load решает LCP.

---

## 📂 Именование

```
✅ orbital-mk-ii.glb
✅ corten-series.svg
✅ apex-frame-large.webp
✅ og-free-assets.jpg

❌ Орбитал.glb              (кириллица)
❌ Work Image 1.jpg         (пробелы, неинформативно)
❌ IMG_20240315.png         (нерелевантное имя)
❌ final_final_v2.svg       (мусор)
```

**Правила:**
- Только lowercase
- Слова через дефис `-`
- Никаких пробелов, спецсимволов, кириллицы
- Имя описывает содержимое
- `data-id` на `.work-card` ↔ имя файла в `assets/cards/<id>.svg`, `assets/cases/<id>/`, `assets/models/<id>.glb`

---

## 🏷 HTML-атрибуты `<img>`

```html
<!-- Стандартное (lazy) -->
<img src="./assets/cards/<id>.svg"
     alt="<descriptive>"
     width="800" height="600"
     loading="lazy" decoding="async"
     onerror="this.remove();">

<!-- Если когда-либо появится hero — НЕ lazy -->
<img src="..." alt="..." width="..." height="..."
     loading="eager" fetchpriority="high" decoding="async">
```

**На текущем сайте hero-image нет** — первое содержимое case-view рендерится из `CARDS_DATA`. Поэтому `<link rel="preload" as="image">` НЕ нужен и не должен генерироваться.

**Правила alt-текста:**
- Описывает что изображено, не «image» / «picture»
- Декоративные изображения: `alt=""`
- Логотип: `alt="Codex Studio"` или `aria-label="..."` на родителе

---

## 🎨 SVG-иконки

Inline SVG, не иконочные шрифты, не PNG:

```html
<!-- Декоративная (есть text label рядом) -->
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
  <path d="..." stroke="currentColor" stroke-width="1.5"/>
</svg>

<!-- Семантическая (icon-only кнопка) -->
<button class="..." aria-label="Copy link to project">
  <svg viewBox="..." aria-hidden="true">...</svg>
</button>
```

- `aria-hidden="true"` — если есть текст рядом (или родитель имеет `aria-label`)
- `fill="none" stroke="currentColor"` — цвет наследуется

---

## ⚡ Preload для критики

```html
<!-- На текущем сайте preload не используется (нет hero image, нет critical above-the-fold image).
     Если добавляется — формат: -->
<!-- <link rel="preload" as="image" href="./assets/img/some-critical.webp" fetchpriority="high"> -->

<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
```

---

## 🚫 Запреты

- ❌ Стоковые фото людей (Unsplash-портреты) — только свои рендеры
- ❌ GIF — использовать MP4/WebM
- ❌ PNG для фото/рендеров (только для favicon и SVG-fallback)
- ❌ Изображения без `width` + `height` (CLS)
- ❌ Файлы с кириллицей / пробелами
- ❌ `loading="lazy"` на критических above-the-fold изображениях
- ❌ Переиспользование `og-image.jpg` для разных страниц (per-page обязательно)
- ❌ `og:image` с относительным путём (только абсолютный `https://codex.promo/...`)

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.7.10*
