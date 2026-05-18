# Texts — Codex Studio

> Реальный контент сайта v0.7.10. Никаких hero/about/services-секций — это portfolio
> с двумя страницами на sidebar+case-view архитектуре.
> Hard-coded UI-тексты — в HTML и `js/main.js` (`CARDS_DATA`).

---

## 🌐 Глобальные мета (обе страницы)

```
Domain:        codex.promo
Language:      English (UI), JSON-LD inLanguage="en"
robots:        index, follow, max-image-preview:large, max-snippet:-1
Theme color:   #212121 (single tag, JS обновляет content при toggle)
Site name:     Codex Studio
```

### Контакты (реальные на сайте)

- **Telegram:** `https://t.me/WhiteCatWeb` (CTA "Contact")
- **ArtStation:** `REPLACE_WITH_REAL` (placeholder в JSON-LD)
- **Behance:** `REPLACE_WITH_REAL` (placeholder в JSON-LD)

`hello@codex.studio` НЕ используется — старая заглушка из ранних версий.

---

## 📄 index.html — Meta

```html
<title>Codex — 3D Design Studio · Hard Surface &amp; Product Visualization</title>
<meta name="description" content="Codex is a remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender. Available worldwide.">
<link rel="canonical" href="https://codex.promo/">

<meta property="og:url"          content="https://codex.promo/">
<meta property="og:type"         content="website">
<meta property="og:site_name"    content="Codex Studio">
<meta property="og:title"        content="Codex — 3D Design Studio">
<meta property="og:description"  content="Hard surface modeling, product viz, and 3D prototyping for global clients. Remote. Detail-driven. Blender-native.">
<meta property="og:image"        content="https://codex.promo/assets/img/og-image.jpg">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"    content="Codex Studio — 3D design portfolio">
<meta property="og:locale"       content="en_US">

<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="Codex — 3D Design Studio">
<meta name="twitter:description" content="Hard surface modeling, product viz, and 3D prototyping for global clients.">
<meta name="twitter:image"       content="https://codex.promo/assets/img/og-image.jpg">
```

---

## 📄 free-assets.html — Meta

```html
<title>Free 3D Assets — Codex Studio · Hard Surface, Game-Ready, CC0</title>
<meta name="description" content="Free 3D assets by Codex Studio. Hard surface models, game-ready props, and product renders. Free for personal and commercial use under CC0 / CC-BY.">
<link rel="canonical" href="https://codex.promo/free-assets.html">

<meta property="og:url"          content="https://codex.promo/free-assets.html">
<meta property="og:title"        content="Free 3D Assets — Codex Studio">
<meta property="og:description"  content="Hard surface, game-ready, and product 3D assets. Free for personal and commercial use.">
<meta property="og:image"        content="https://codex.promo/assets/img/og-free-assets.jpg">
<meta property="og:image:alt"    content="Codex Studio — Free 3D Assets">
```

---

## 🧱 Sidebar (UI-тексты, обе страницы)

| Элемент | index.html | free-assets.html |
|---|---|---|
| Logo | `CODEX` (текст) | `CODEX` (текст) |
| Logo aria-label | `Codex — back to first project` | `Codex — back to portfolio` |
| Contact button | `Contact` | `Contact` |
| Theme toggle aria-label | `Switch to light theme` | `Switch to light theme` |
| Cards-toggle (open ‹‹) | `Hide projects` | `Hide categories` |
| Cards-toggle (closed ››) | (auto-swap) | (auto-swap) |
| Tags placeholder | `Filter by discipline` | `Filter by category` |
| Game-switch label | `Game assets only` | `Game assets only` |
| Counter | `18 projects` (динамика по фильтру) | `N items` (динамика) |

### Tag-фильтры (index.html)

```
All  ·  Hard Surface  ·  Product  ·  Organic  ·  Prototyping  ·  Animations  ·  CAD
```

`data-filter` значения: `all`, `hard-surface`, `product`, `organic`, `prototyping`, `animations`, `cad`.

### Tag-фильтры (free-assets.html)

```
All (6)  ·  Hard Surface (8)  ·  Product Viz (5)  ·  Game Assets (4)  ·  Organic (3)  ·  Animation (2)  ·  CAD
```

`data-filter` значения: `hard-surface`, `product`, `game`, `organic`, `animation`, `cad`. Числа в скобках — `tags-dropdown__option-count`.

### Site footer

```
Stats:    DELETED 422 CUBES • CREATED 120 WORKS
Pills:    [Contact (Telegram)]   [Free Assets (link to free-assets.html)]
```

---

## 💼 Index — 18 work-cards

Все карточки имеют структуру:

```
Category · Year
[Title]
[Description: 1-2 предложения, технические детали]
```

Полный список (`data-id`, `data-category`, optional `data-game-asset`):

| # | data-id | Title | Category | Year | Description |
|---|---|---|---|---|---|
| 1 | `orbital-mk-ii` | Orbital Mk.II | Hard Surface | 2025 | Sci-fi prop engineered for AAA pipeline. Full PBR, clean topology. |
| 2 | `vega-shell` | Vega Shell | Hard Surface | 2025 | Modular exo-armor system. 47 individual parts, LOD-ready. |
| 3 | `ironclad-frame` | Ironclad Frame | Hard Surface | 2024 | Industrial chassis breakdown. Every bolt and seam modeled to spec. |
| 4 | `corten-series` | Corten Series | Product | 2025 | Product viz for an industrial furniture brand. Launch-ready renders. |
| 5 | `lumen-one` | Lumen One | Product | 2024 | Architectural lighting unit. Photorealistic turntable for pitch deck. |
| 6 | `flux-capsule` | Flux Capsule | Product | 2024 | Consumer tech device. E-commerce shot set, studio lighting rig. |
| 7 | `nightshard` ⭐ Game | Nightshard | Hard Surface | 2025 | Hero weapon asset. 4K PBR textures, optimised for real-time. |
| 8 | `recon-drone` ⭐ Game | Recon Drone | Hard Surface | 2024 | Tactical UAV prop. Game-ready, LOD0–LOD2, UE5-compatible. |
| 9 | `apex-frame` | Apex Frame | Prototyping | 2024 | Mechanical component breakdown for engineering client. Mfg-reference accuracy. |
| 10 | `core-rig` | Core Rig | Prototyping | 2024 | Structural assembly prototype. Modeled for 3D-print validation. |
| 11 | `helix-reveal` | Helix Reveal | Animations | 2025 | Product reveal animation. 6-second loop, render for hero section. |
| 12 | `arc-motion` | Arc Motion | Animations | 2024 | Turntable sequence for industrial product. 360° orbit, 4K export. |
| 13 | `nyx-panther` | Nyx Panther | Organic | 2025 | Stylized feline creature. Hand-sculpted anatomy, dual-coat fur groom. |
| 14 | `drift-koi` | Drift Koi | Organic | 2024 | Ornamental fish study. Displacement scales, subsurface scattering pass. |
| 15 | `glint-owl` | Glint Owl | Organic | 2025 | Stylized bird character. Feather grooming with procedural asymmetry. |
| 16 | `mech-link` | Mech Link | CAD | 2025 | Industrial CAD assembly. Placeholder kit — final GLB + renders in progress. (`data-cad-placeholder="true"`) |
| 17 | `flex-spine` | Flex Spine | CAD | 2025 | Kinematic spine study. CAD constraints, parametric ribs — work in progress. (`data-cad-placeholder="true"`) |
| 18 | `cad-strut` | CAD Strut | CAD | 2025 | Structural strut node. CAD-first geometry — final model & textures pending. (`data-cad-placeholder="true"`) |

**Frozen-инвариант:** список `data-id` зафиксирован в `verify-frozen.js` → `EXPECTED_IDS`. Тесты `WORK-cards-18` и `WORK-cards-ids` проверяют точное соответствие.

---

## 🎬 Case-view (UI)

| Элемент | Текст |
|---|---|
| Mobile back-btn | `Projects` |
| Tabs | `2D` / `3D` / `Blueprints` |
| 3D tab title | `Interactive 3D viewer` |
| Blueprints tab title | `Technical blueprint view` |
| Counter | `1 / 15` (динамика, формат `n / N`) |
| Prev / Next aria-label | `Previous project (←)` / `Next project (→)` |
| Share button (desktop+mobile) | `COPY LINK` (после клика swap → `COPIED ✓` 1.5s) |
| Blueprints export | `Export SVG` |
| Blueprints fullscreen aria-label | `Open blueprint fullscreen` |

---

## 📦 CARDS_DATA — captions per case (`js/main.js`)

Каждый кейс в `CARDS_DATA` имеет:

```javascript
{
  role: 'Личный' | 'Клиентский',
  tools: ['Blender', 'Substance Painter', 'Marmoset', ...],
  modelSrc: './assets/models/<id>.glb' | 'https://modelviewer.dev/...' (placeholder),
  modelStats: { triangles, vertices, materials, textures, software },
  items: makeItems({
    id: '<id>',
    palette: [5 background gradients],
    captions: [5 × { label, desc }],
    text:   { title, body },          // optional intro text-block
    inline: { title, body }           // optional inline text alongside one tall image
  })
}
```

**Captions — пример (orbital-mk-ii):**

| Slide | Label | Description |
|---|---|---|
| 01 | Hero render | Sci-fi prop engineered for AAA pipeline. Full PBR, clean manifold topology. |
| 02 | Material breakdown | Substance layer stack — roughness variation separates wear zones from clean panels. |
| 03 | Topology pass | 18k clean quads. Subdivision-ready and LOD0-certified for real-time integration. |
| 04 | Detail close-up | Panel seam macro. Bevel widths tuned for 2m viewing distance at 4K resolution. |
| 05 | Final composite | Lit with 3-point studio HDRI. Denoised in OptiX, tonemapped ACES. |

Полный набор captions для всех 18 кейсов — в `js/main.js` начиная с `var CARDS_DATA = {...}` (строка ~62).

**При смене реальных работ:** заменить captions + palette + (optionally) modelSrc/modelStats. Заголовки и descriptions карточек дублируются в HTML (строки 316–531) — синхронизировать оба места.

---

## 🛠 free-assets.html — UI и категории

Sidebar содержит **tag-cards** (специальные cards-категории) с двойным классом `tag-card work-card`. Главное `<main>` содержит `fa-grid` с `fa-card` (реальные карточки скачивания).

Категории FA:

```
Hard Surface (8)    — propulsion, mechanical, sci-fi
Product Viz (5)     — consumer products, industrial
Game Assets (4)     — UE5/Unity-ready, LOD0–LOD2
Organic (3)         — creatures, fauna
Animation (2)       — looped turntables, reveal sequences
CAD                 — placeholder for engineering geometry
```

Каждый `fa-card` содержит:
```
[Cover image / SVG]
[Title]
[Tags chips]
[License: CC0 / CC-BY]
[File size · format · poly count]
[Download button] → /downloads/<slug>.zip (placeholder 412 B)
```

---

## 🔻 Footer (sidebar)

```
DELETED 422 CUBES • CREATED 120 WORKS

[Contact]   [Free Assets →]
```

Stats — статичные, специально подобранные «инсайдерские» цифры, не маркетинговые counter-fluff.

---

## 🧾 JSON-LD Schemas

### Index.html

1. **Organization** (Codex Studio, sameAs Telegram + REPLACE_WITH_REAL ArtStation/Behance)
2. **WebSite** (Codex Studio)
3. **ItemList** — 4 featured CreativeWork (Orbital Mk.II / Corten Series / Apex Frame / Nightshard)

### Free-assets.html

1. **Organization** (одинаковая с index)
2. **WebPage** (Free 3D Assets, primaryImageOfPage = og-free-assets.jpg)

---

## 🌍 llms.txt

```markdown
# Codex Studio
> Remote 3D design studio focused on hard surface modeling, product
> visualization, and game-ready assets. Built natively in Blender.

## Featured works
- Orbital Mk.II — hard surface, game-ready. Personal.
- Corten Series — product visualization, industrial design. Client.
- Apex Frame — hard surface, frame system. Personal.
- Nightshard — hard surface, game asset. Personal.

## Technical
- Hand-written HTML + CSS + vanilla JavaScript. No framework.
- Typography: Clash Display + General Sans (Fontshare).
- Animation: GSAP 3 (ScrollTrigger, SplitText) via CDN.
- Accessibility: WCAG 2.1 AA, axe-core clean, prefers-reduced-motion honored, 44px touch targets.

## Contact
- Telegram: https://t.me/WhiteCatWeb
- ArtStation: https://www.artstation.com/REPLACE_WITH_REAL
- Behance:    https://www.behance.net/REPLACE_WITH_REAL
```

---

## ✍️ Tone of Voice

**Голос:** уверенный, лаконичный, профессиональный.

**Делать:**
- Конкретные глаголы: model, build, craft, deliver, render, ship, prototype
- Короткие декларативные предложения
- Технические специфики: «4K PBR», «LOD0–LOD2», «UE5-compatible», «manifold topology»
- Всё на English

**Не делать:**
- ❌ «We are passionate about 3D» — клише
- ❌ «Your one-stop shop» — маркетплейс
- ❌ «500+ satisfied clients» — без доказательств
- ❌ Упоминание города / страны
- ❌ Кириллицу в UI
- ❌ Question-headlines («Looking for quality 3D?»)
- ❌ Восклицательные знаки в body
- ❌ Buzzwords: innovative, cutting-edge, synergy, leverage

---

## ⚠️ Known placeholders / REPLACE_WITH_REAL

При финальном production deploy заменить:

- `https://www.artstation.com/REPLACE_WITH_REAL` (JSON-LD sameAs, llms.txt)
- `https://www.behance.net/REPLACE_WITH_REAL` (JSON-LD sameAs, llms.txt)
- `/downloads/*.zip` — все 4 (`apex-frame`, `corten-series`, `nightshard`, `orbital-mk-ii`) сейчас 412 B placeholder
- Некоторые `modelSrc` в `CARDS_DATA` указывают на `https://modelviewer.dev/shared-assets/...` (Astronaut, RobotExpressive) — заменить на свои GLB из `assets/models/`

Все остальные тексты — реальные UI/контент сайта.

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.8 GOLDEN*
