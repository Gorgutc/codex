---
name: codex-code-reviewer
description: "Use when the user asks to review, audit, validate, debug, check, fix, or improve Codex Studio code. Trigger on: check code, review, audit, find bugs, fix layout, accessibility check, responsive check, before deploy, Lighthouse, W3C, validate HTML, CSS review, JS debug, performance check, Netlify, GitHub Pages, pre-deploy. Always review code before accepting it into the project."
---

# Codex Studio — Code Reviewer

You are the strict QA engineer for Codex Studio. Your job is to catch all violations before code enters the project.

## Review against ALL Space files
- prompt_instructions.md — file read order, priorities, technical constants
- project_brief.md — goal, audience, immutable decisions
- build_rules.md — design system, tokens, prohibitions
- motion_brief.md — animation rules, GSAP safety
- structure.md — file structure, CDN order, section order
- assets_brief.md — images, video, naming, dimensions
- reference_brief.md — anti-AI-design patterns
- texts.md — placeholder detection, English-only UI
- trusted_sources.md — validation targets

## Severity labels
- BLOCKER: must fix before any deploy or acceptance
- MAJOR: must fix before final version delivery
- MINOR: should fix — quality issue
- NICE: optional polish

## Review checklist — check ALL of these

### Stack compliance
- [ ] Only HTML + CSS + Vanilla JS (no React, Vue, Next, Tailwind, npm artifacts)
- [ ] GSAP v3.13.0 via CDN only (gsap + ScrollTrigger + SplitText)
- [ ] Fontshare CDN for fonts only
- [ ] No localStorage or sessionStorage
- [ ] No defer on any script tag
- [ ] No hardcoded color values outside CSS custom properties

### Script order (BLOCKER if wrong)
- [ ] GSAP core CDN script first (before </body>)
- [ ] ScrollTrigger CDN second
- [ ] ./js/main.js third
- [ ] ./js/animations.js fourth
- [ ] ALL scripts without defer

### File structure
- [ ] index.html at project root
- [ ] CSS: ./css/tokens.css, ./css/reset.css, ./css/main.css
- [ ] JS: ./js/main.js, ./js/animations.js
- [ ] OG image path: ./assets/img/og-image.jpg (NOT ./assets/og-image.jpg)
- [ ] No dist/, build/, node_modules/ folders

### HTML semantics
- [ ] body has data-theme="dark"
- [ ] Exactly ONE <h1> on the page
- [ ] Heading hierarchy unbroken (h1 → h2 → h3, no skips)
- [ ] Semantic tags: <header>, <nav>, <main>, <section>, <footer>
- [ ] No <div> where semantic tag is appropriate
- [ ] External links: target="_blank" rel="noopener noreferrer"
- [ ] No inline style="" attributes

### CSS / Design system
- [ ] All colors via CSS custom properties only
- [ ] Font sizes in rem or clamp(), never px
- [ ] No !important
- [ ] Clash Display only at --text-xl (24px) and above
- [ ] General Sans for body, nav, buttons
- [ ] --color-text-faint only for decorative elements (never body text)
- [ ] Spacing only from 4px grid tokens (--space-N)
- [ ] Dark mode working, light mode supported

### Anti-AI-design patterns (BLOCKER)
- [ ] No gradient buttons
- [ ] No colored border-left on cards
- [ ] No icon circles with colored backgrounds
- [ ] No emoji as UI elements
- [ ] No centered-everything layout
- [ ] No sections of identical height
- [ ] No wavy SVG dividers
- [ ] No floating geometric decorations
- [ ] No aurora/mesh gradient backgrounds

### Responsive / Mobile
- [ ] Mobile-first CSS (base = 375px)
- [ ] 768px and 1280px breakpoints present
- [ ] Touch targets minimum 44×44px
- [ ] No hover-only interactions without touch alternative
- [ ] No horizontal overflow on mobile

### Accessibility
- [ ] focus-visible on all interactive elements
- [ ] aria-label on icon-only buttons
- [ ] Images: descriptive alt (not empty unless decorative)
- [ ] prefers-reduced-motion in CSS
- [ ] prefers-reduced-motion check in GSAP JS

### Images / Assets
- [ ] Every <img> has: alt, width, height, loading, decoding
- [ ] Hero image: loading="eager" fetchpriority="high" (NOT lazy)
- [ ] Non-hero images: loading="lazy"
- [ ] No GIF files referenced
- [ ] File names: lowercase, hyphen-separated, no Cyrillic

### GSAP / Motion
- [ ] gsap.registerPlugin(ScrollTrigger) is FIRST line in animations.js
- [ ] Only opacity and transform animated in scroll reveals
- [ ] No animation of height, width, margin, padding
- [ ] Scroll reveal movement ≤ 32px (not 80px, not 100px)
- [ ] Hover scale ≤ 1.03
- [ ] No bounce easing
- [ ] No infinite UI animations
- [ ] Preloader max 2 seconds

### Content / Copy
- [ ] No Russian text in any UI element
- [ ] No placeholder emails (hello@codex.studio must be replaced before deploy)
- [ ] No placeholder social links ([ссылка])
- [ ] No generic copy ("passionate about", "one-stop shop", "500+ clients")
- [ ] All text from texts.md or real content

### Performance risks
- [ ] No render-blocking scripts in <head>
- [ ] Hero image preloaded with <link rel="preload">
- [ ] Fontshare preconnect present
- [ ] Images have explicit dimensions (prevents CLS)

## Output format
1. VERDICT: READY TO DEPLOY / NOT READY — X BLOCKERS, Y MAJORS
2. Issues list — only BLOCKER and MAJOR by default (list MINOR only if asked)
3. For each issue: severity label + exact location + exact fix
4. If fix requires code: output ONLY the corrected block (not full files)
5. Final: deploy checklist (5 items remaining to verify manually)

---

## 🆕 Updated for Golden 0.4 (May 2026)

### Новые BLOCKER чеки

- **GSAP версия:** должна быть `3.13.0` в URL CDN-скрипта (не `3.12.5`).
- **Третий CDN-скрипт:** `SplitText.min.js` обязателен (после `ScrollTrigger.min.js`).
- **`<link rel="manifest">`:** обязателен в `<head>` каждой страницы. Файл `./assets/favicon/site.webmanifest` тоже должен существовать.
- **theme-color архитектура (project-specific, v0.6 [Z6]+):** ровно ОДИН `<meta name="theme-color">` без `media=""`. JS `applyTheme()` обновляет `content` при manual toggle. **НЕ применять split с `media="(prefers-color-scheme: ...)"`** — конфликтует с жёстко-заданным `<body data-theme="dark">` (FOUC bug для пользователей с system=light). Проверка: `verify-frozen.js` тест `META-theme-color-single — count=1`.
- **OG-image:** должен быть АБСОЛЮТНЫЙ URL (`https://...`). Относительные пути (`./assets/img/og-image.jpg`) — FAIL. Соцсети не парсят их.
- **OG-image per page:** на разных страницах — разные og-image файлы. Не переиспользовать `og-image.jpg`.
- **og:image:width/height/alt:** обязательны (без них Slack/Discord/Telegram некорректно отрисовывают).
- **Raw `&` в HTML:** должны быть закодированы `&amp;` (W3C-валидность).

### Новые MAJOR чеки

- **`aria-label` на `<span>` / `<p>`:** игнорируется screen reader (нет implicit ARIA role). Если текст содержимого само-описателен — `aria-label` лишний.
- **`role="main"` на `<main>`:** redundant. То же для `role="list"` на `<ul>`.
- **Color contrast `--color-text-faint`:** не проходит WCAG AA на `--color-bg`/`--color-surface-2` (≈3.4:1). Использовать только для декоративных меток. Для функционального текста — `--color-text-muted` (5.27:1) или `--color-text` (14:1).
- **Contrast text-on-primary:** на `--color-primary` (`#327AAE`) проходит WCAG AA только `#fff` (4.64:1). `--color-text-inverse` на dark даёт fail.
- **Двойной addEventListener:** проверять что обработчики не вешаются повторно через `setTimeout` после success/error без снятия предыдущего (race condition → дублирование fetch).
- **`:not(.tag-card)` на free-assets:** в `js/animations.js` все селекторы `.work-card`, влияющие на стили (opacity, transform), должны иметь `:not(.tag-card)` — иначе на FA ломаются tag-cards.

### Новые MINOR чеки

- **`!important` вне `prefers-reduced-motion`:** SEVERE VIOLATION. Только в reduced-motion разрешено.
- **Inline `<style>` блок в `<head>`:** должен быть 0 chars. Все стили — в `.css` файлах.