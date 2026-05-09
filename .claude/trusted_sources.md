# Trusted Sources — Codex Studio
> Проверенные источники для AI: помогают генерировать чистый, современный код

---

## 🔍 Валидация и проверка

### W3C Markup Validator
**URL:** https://validator.w3.org
**Когда:** после генерации HTML — проверить валидность разметки
**Что ловит:** синтаксические ошибки, неправильную вложенность, пропущенные атрибуты

### Can I Use — браузерная совместимость
**URL:** https://caniuse.com
**Когда:** перед использованием современных CSS/JS возможностей
**Что проверять:** `has()`, `container queries`, `@layer`, `oklch()`, `dvh`, `field-sizing`

### Lighthouse — Google Quality Audit
**URL:** https://developer.chrome.com/docs/lighthouse/overview
**Когда:** после сборки страницы — аудит performance, accessibility, SEO
**Цели:** Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95

---

## 📚 Документация (приоритетные источники)

### MDN Web Docs — HTML Reference
**URL:** https://developer.mozilla.org/en-US/docs/Web/HTML/Reference
**Для:** семантические теги, атрибуты, ARIA

### MDN Web Docs — CSS
**URL:** https://developer.mozilla.org/en-US/docs/Web/CSS
**Для:** CSS-свойства, custom properties, современные layout-техники

### GSAP Docs v3
**URL:** https://gsap.com/docs/v3
**Для:** GSAP API, методы, параметры

### GSAP ScrollTrigger
**URL:** https://gsap.com/docs/v3/Plugins/ScrollTrigger
**Для:** scroll-анимации, pin, scrub, markers

### MDN ARIA
**URL:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
**Для:** aria-атрибуты, roles, доступность

---

## ⚡ Производительность и шрифты

### web.dev — Core Web Vitals
**URL:** https://web.dev/explore/learn-core-web-vitals
**Для:** понимание LCP, CLS, INP — ключевые метрики Google

### web.dev — WebFont Loading Optimization
**URL:** https://web.dev/articles/optimize-webfont-loading
**Для:** `font-display: swap`, preconnect, preload — предотвратить FOIT/FOUT

### Fontshare CDN
**URL:** https://fontshare.com
**Для:** проверка доступных шрифтов, актуальные CDN-ссылки

---

## 🎨 CSS Reset и паттерны

### Andy Bell — Modern CSS Reset
**URL:** https://piccalil.li/blog/a-more-modern-css-reset/
**Когда:** начало каждого нового проекта (файл `css/reset.css`)
**Что даёт:** box-sizing, сглаживание, мобильные отступы — 30 строк

### web.dev Patterns
**URL:** https://web.dev/patterns
**Для:** готовые CSS-паттерны (scroll snap, carousels, layouts)

### Radix UI Colors
**URL:** https://radix-ui.com/colors
**Для:** проверка контрастности, построение цветовых шкал

---

## 🖼 Оптимизация ассетов

### Squoosh — конвертация в WebP
**URL:** https://squoosh.app
**Когда:** перед добавлением любого изображения — конвертировать в WebP

### SVGOMG — оптимизация SVG
**URL:** https://jakearchibald.github.io/svgomg/
**Когда:** перед вставкой SVG-иконок inline

### Google Styleguide — HTML/CSS
**URL:** https://google.github.io/styleguide/htmlcssguide.html
**Для:** общие нормы качества кода

---

*Версия: 1.2 | Апрель 2026 | Стек: HTML + CSS + JS + GSAP | Без фреймворков*