# Trusted Sources — Codex Studio

> Проверенные источники для AI: помогают генерировать чистый, современный код.

---

## 🥇 Внутренний source of truth

**`verify-frozen.js`** в корне проекта — Playwright-регрешен на 56 тестов. Авторитетнее любого skill-файла. Перед предложением правки на основании skill-чека — `grep` соответствующий тест в `verify-frozen.js`.

---

## 🔍 Валидация

### W3C Markup Validator
**URL:** https://validator.w3.org
**Когда:** после правки HTML — проверить валидность разметки.

### Can I Use
**URL:** https://caniuse.com
**Когда:** перед использованием современных CSS/JS возможностей (`:has()`, container queries, `@layer`, `oklch()`, `dvh`, `field-sizing`).

### Lighthouse
**URL:** https://developer.chrome.com/docs/lighthouse/overview
**Целевые метрики (v0.7.10 baseline):**
- Performance ≥ 90 (FA), index ≈ 54 (limited by `model-data.js`)
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

---

## 📚 Документация

### MDN
- **HTML:** https://developer.mozilla.org/en-US/docs/Web/HTML/Reference
- **CSS:** https://developer.mozilla.org/en-US/docs/Web/CSS
- **ARIA:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA

### GSAP v3
- **Core:** https://gsap.com/docs/v3
- **ScrollTrigger:** https://gsap.com/docs/v3/Plugins/ScrollTrigger
- **SplitText (free since 3.13.0):** https://gsap.com/docs/v3/Plugins/SplitText

### `<model-viewer>` (Google)
- **Docs:** https://modelviewer.dev/docs/index.html
- **Examples:** https://modelviewer.dev/examples/
- **Notes:** lazy-load скрипта `@google/model-viewer@4.0.0` через `cdn.jsdelivr.net`. На `file://` HDR-fetch блокируется CORS — fallback на `environment-image='neutral'`.

### Polyhaven (HDR CC0)
- **URL:** https://polyhaven.com/hdris
- **Используется:** `studio_small_08.hdr` → `studio.hdr`, `kloppenheim_06.hdr` → `outdoor.hdr`, `studio_small_03.hdr` → `dark.hdr` (1k разрешение).

---

## ⚡ Производительность и шрифты

### web.dev — Core Web Vitals
**URL:** https://web.dev/explore/learn-core-web-vitals
**Для:** LCP / CLS / INP / FCP — целевые лимиты см. `skill-a11y-performance.md`.

### web.dev — WebFont Loading
**URL:** https://web.dev/articles/optimize-webfont-loading
**Для:** `font-display: swap`, preconnect, preload — предотвращение FOIT/FOUT.

### Fontshare
**URL:** https://fontshare.com
**Для:** проверка доступных шрифтов и актуальных CDN-ссылок.

---

## 🎨 CSS

### Andy Bell — Modern CSS Reset
**URL:** https://piccalil.li/blog/a-more-modern-css-reset/
**В проекте:** `css/reset.css`.

### web.dev Patterns
**URL:** https://web.dev/patterns
**Для:** scroll snap, carousels, layout patterns.

### Radix UI Colors
**URL:** https://radix-ui.com/colors
**Для:** проверка контрастности, цветовые шкалы.

---

## 🖼 Оптимизация ассетов

### Squoosh (WebP/AVIF)
https://squoosh.app

### HandBrake (MP4)
https://handbrake.fr

### SVGOMG (SVG)
https://jakearchibald.github.io/svgomg/

### glTF-Transform / gltf.report (GLB + DRACO)
- https://github.com/donmccurdy/glTF-Transform
- https://gltf.report

---

## 📋 SEO и schema валидация

- **Google Rich Results Test:** https://search.google.com/test/rich-results
- **Schema Markup Validator:** https://validator.schema.org/
- **Facebook Sharing Debugger:** https://developers.facebook.com/tools/debug/
- **Google PageSpeed Insights:** https://pagespeed.web.dev/

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.7.10*
