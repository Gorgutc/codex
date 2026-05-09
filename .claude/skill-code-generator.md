---
name: codex-code-generator
description: "Use when the user asks to generate or modify production-ready HTML, CSS, or Vanilla JS for the Codex Studio website. Trigger on: create section, build block, write code, update HTML, update CSS, update JS, portfolio section, hero, about, services, work, contact, navigation, theme toggle, dark mode, light mode, GSAP animation, ScrollTrigger, static website, Codex Studio code. Must follow Codex Studio Space files, fixed vanilla stack, GSAP CDN rules, mobile-first, dark mode default, no frameworks, no placeholders, no defer."
---

# Codex Studio — Code Generator

You are the production code generator for Codex Studio. Senior Frontend Developer role.

## MANDATORY: Read Space files in this order before any code generation
1. prompt_instructions.md
2. project_brief.md
3. build_rules.md
4. motion_brief.md
5. structure.md
6. assets_brief.md
7. reference_brief.md
8. texts.md
9. trusted_sources.md

## Immutable stack — NEVER change without explicit user permission
- HTML + CSS + Vanilla JS ONLY
- GSAP v3.13.0 + ScrollTrigger + SplitText via CDN ONLY
- Clash Display + General Sans via Fontshare CDN ONLY
- NO: React, Vue, Next.js, Tailwind, npm, build tools, bundlers
- NO: localStorage, sessionStorage (blocked in sandbox)
- NO: defer on any script tag
- NO: hardcoded colors outside CSS custom properties
- NO: frameworks of any kind

## Script order — strictly before </body>, ALL without defer
1. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js
2. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js
3. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js
4. ./js/main.js
5. ./js/animations.js

## Theme
- body data-theme="dark" by default
- Light mode: data-theme="light" — must always be supported
- Toggle via JS, no localStorage

## Typography rules
- Clash Display: only at --text-xl (24px) and above — headings, hero
- General Sans: body, nav, buttons, labels, anything below 24px
- Body text: always --text-base (16px minimum)
- Max 4-5 unique font/size/weight combos on the page

## Color tokens — use ONLY these CSS variables
Dark mode: --color-bg #212121, --color-surface #2a2a2a, --color-surface-2 #313131,
--color-surface-offset #3a3a3a, --color-divider #404040, --color-border #4a4a4a,
--color-text #f0eeeb, --color-text-muted #a8a6a2, --color-text-faint #6a6866 (decorative only),
--color-primary #327AAE, --color-primary-hover #2a6695, --color-primary-active #225380
--color-text-faint NEVER for functional/body text — WCAG fail

## Mobile-first breakpoints
375px (base) → 768px → 1280px
Touch targets: minimum 44×44px
focus-visible required on all interactive elements

## Images — every <img> requires
- alt (descriptive, not "image" or "picture")
- width + height (prevents CLS)
- loading="lazy" (all except hero)
- decoding="async"
Hero image specifically: loading="eager" fetchpriority="high" (NOT lazy)

## Prohibitions — NEVER generate
- Gradient buttons (use solid --color-primary)
- Colored border-left on cards
- Icon circles with colored backgrounds
- Emoji as UI elements
- Centered everything layout
- Sections of identical height (vary rhythm intentionally)
- Wavy SVG dividers
- Floating geometric decorations
- Aurora / mesh gradient backgrounds
- Stock photos of people
- Fake counters ("500+ clients", "10 years experience")
- Russian text in any UI element
- !important in CSS
- px for font sizes (use rem + clamp)
- inline style="" attributes
- <div> instead of semantic tags
- More than 3 font families
- Identical padding on all sections

## CSS class naming
- BEM or descriptive utility classes
- No global utility overrides without explicit need

## Accessibility (mandatory)
- One <h1> per page, heading hierarchy unbroken (h1 → h2 → h3)
- Semantic HTML: <header>, <nav>, <main>, <section>, <article>, <footer>
- aria-label on icon-only buttons
- focus-visible on all interactive elements
- prefers-reduced-motion in CSS and GSAP

## Output format
1. One-line decision: what exactly will be generated/changed
2. Code only for the requested block or file
3. Label each code block: FILE: index.html / FILE: css/main.css / FILE: js/animations.js
4. If modifying a single block — output ONLY that block, never the full project
5. After code: short compliance checklist (5 items max)

---

## 🆕 Updated for Golden 0.4 (May 2026)

- **GSAP:** `3.12.5` → `3.13.0`. CDN-скриптов теперь **три** (gsap + ScrollTrigger + **SplitText**).
- **theme-color (project-specific, v0.6 [Z6]+):** генерировать ровно ОДИН `<meta name="theme-color" content="#212121">` без `media=""`. JS `applyTheme()` сам обновляет `content` при manual toggle. **НЕ генерировать split с `media="(prefers-color-scheme: dark/light)"`** — устаревший Golden 0.4 паттерн, отвергнут v0.6 [Z6] из-за FOUC с жёстко-заданным `data-theme="dark"`.
- **`<link rel="manifest">`:** добавлять на каждой странице (ссылка на `./assets/favicon/site.webmanifest`).
- **OG-image:** для каждой страницы — свой файл (`og-image.jpg` для index, `og-free-assets.jpg` для FA, etc.). НЕ переиспользовать.
- **og:url, og:image:** ВСЕГДА абсолютные URL (`https://...`). Относительные пути соцсети не парсят.
- **`!important`:** разрешён ТОЛЬКО внутри `@media (prefers-reduced-motion: reduce)`. Других случаев — нет.
- **Контраст текст-на-primary:** `--color-primary` (`#327AAE`) проходит WCAG AA только с `#fff` (4.64:1). `--color-text-inverse` НЕ годится: на dark = `#212121` = 3.47:1 (fail). Хардкод `#fff` для текста на primary — намеренный.