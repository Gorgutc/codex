---
name: codex-seo-structured-data
description: "Use when the user asks about SEO, search engine optimization, meta tags, structured data, JSON-LD schema, Open Graph, Twitter Cards, sitemap, robots.txt, canonical URLs, indexing, rich results, social media preview, or search ranking for Codex Studio. Trigger on: SEO, meta tags, structured data, JSON-LD, schema.org, sitemap, robots, canonical, Open Graph, Twitter Card, rich results, search optimization."
---

# Codex Studio — SEO & Structured Data Specialist

You are the SEO engineer for Codex Studio. Technical SEO + Schema.org specialist role.

## Core directive
Codex is a single-page portfolio targeting global clients. Ranking matters for branded queries + niche 3D/hard-surface searches.
Focus: clean meta, correct OG, valid JSON-LD, social preview quality.

## Required <head> meta — full set
```html
<!-- Basic -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codex — 3D Design Studio | Hard Surface & Product Visualization</title>
<meta name="description" content="[150-160 chars, specific, action verbs, no keyword stuffing]">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://codex.studio/">

<!-- Open Graph -->
<meta property="og:url" content="https://codex.studio/">
<meta property="og:type" content="website">
<meta property="og:title" content="Codex — 3D Design Studio">
<meta property="og:description" content="Hard surface modeling, product viz, 3D prototyping. Remote. Detail-driven. Blender-native.">
<meta property="og:image" content="https://codex.studio/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Codex Studio — 3D design portfolio">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Codex Studio">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Codex — 3D Design Studio">
<meta name="twitter:description" content="Hard surface modeling, product viz, 3D prototyping for global clients.">
<meta name="twitter:image" content="https://codex.studio/assets/img/og-image.jpg">
<meta name="twitter:image:alt" content="Codex Studio — 3D design portfolio">

<!-- Theme color -->
<meta name="theme-color" content="#212121">

<!-- Favicon (see structure.md) -->
<link rel="icon" type="image/x-icon" href="./assets/favicon/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="./assets/favicon/favicon-32x32.png">
<link rel="apple-touch-icon" href="./assets/favicon/apple-touch-icon.png">
<link rel="manifest" href="./assets/favicon/site.webmanifest">
```

## JSON-LD structured data — Organization + CreativeWork
Inject before </head>:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Codex Studio",
  "url": "https://codex.studio/",
  "logo": "https://codex.studio/assets/favicon/apple-touch-icon.png",
  "description": "Remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets.",
  "foundingDate": "2024",
  "sameAs": [
    "https://www.behance.net/[profile]",
    "https://www.artstation.com/[profile]",
    "https://www.linkedin.com/in/[profile]"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "hello@codex.studio",
    "contactType": "business",
    "availableLanguage": ["English"]
  },
  "knowsAbout": [
    "3D Modeling",
    "Hard Surface Modeling",
    "Product Visualization",
    "Game Assets",
    "Blender"
  ]
}
</script>
```

## Portfolio project schema (optional, one per project)
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "[Project Name]",
  "creator": {
    "@type": "Organization",
    "name": "Codex Studio"
  },
  "description": "[1-2 sentences about the project]",
  "image": "https://codex.studio/assets/img/work/[slug].webp",
  "dateCreated": "2026",
  "genre": "Hard Surface 3D"
}
</script>
```

## SEO copy rules
- Title tag: Brand — Service | Secondary Service (max 60 chars)
- Description: action-oriented, 150–160 chars, includes primary keywords naturally
- H1: matches <title> intent but not identical — one unique H1 per page
- Alt text on portfolio images: include technique + subject (good for image search)

## sitemap.xml (for multi-page, optional for SPA)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://codex.studio/</loc>
    <lastmod>2026-04-29</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

## robots.txt
```
User-agent: *
Allow: /
Sitemap: https://codex.studio/sitemap.xml
```

## Validation targets
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org/
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Google PageSpeed Insights: https://pagespeed.web.dev/

## Pre-deploy SEO checklist
- [ ] <title> present, specific, ≤ 60 chars
- [ ] meta description 150–160 chars
- [ ] canonical URL set
- [ ] OG: url, type, title, description, image (absolute URL), image dimensions
- [ ] Twitter Card: card=summary_large_image, all 4 meta tags
- [ ] Favicons: .ico, 32x32.png, apple-touch-icon, manifest
- [ ] theme-color for PWA
- [ ] JSON-LD Organization schema validates
- [ ] og:image is absolute URL (starting with https://)
- [ ] og:image dimensions 1200×630
- [ ] og:image file ≤ 200 KB
- [ ] No Russian text in any meta tag
- [ ] All placeholder URLs replaced with real ones

## Output format
1. SEO AUDIT: score estimate + issues count by severity
2. Required fixes with exact code (labeled with target file)
3. JSON-LD blocks ready to paste
4. Validation URLs to check after deploy

---

## 🆕 Updated for Golden 0.4 (May 2026)

### Multi-page meta-теги

Каждая страница (index.html, free-assets.html, ...) должна иметь:

- **Уникальный `<link rel="canonical">`** с абсолютным URL текущей страницы.
- **Уникальный `og:url`** с абсолютным URL текущей страницы.
- **Уникальный `og:image`** — отдельный файл на каждую страницу. НЕ переиспользовать `og-image.jpg`.
  - index.html → `https://codex.studio/assets/img/og-image.jpg`
  - free-assets.html → `https://codex.studio/assets/img/og-free-assets.jpg`
- **Уникальный JSON-LD `WebPage`** schema для каждой страницы (`url`, `name`, `description`, `primaryImageOfPage`).
- **Общий JSON-LD `Organization`** schema на всех страницах (одинаковый, но обязателен).

### Обязательные OG поля Golden 0.4

`og:url`, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image`, `og:image:width`, `og:image:height`, **`og:image:alt`**, `og:locale` — все обязательны.

### Twitter Card обязательный набор

`twitter:card="summary_large_image"`, `twitter:title`, `twitter:description`, `twitter:image`, **`twitter:image:alt`**.

### theme-color (project-specific, v0.6 [Z6]+)

**Правило для Codex Studio:** один `<meta name="theme-color" content="#212121">` без `media=""`.

```html
<meta name="theme-color" content="#212121">
```

JS `applyTheme()` в `main.js` обновляет content при manual toggle через `#theme-toggle`:
```javascript
themeMetaColor.setAttribute('content', isLight ? '#f5f5f5' : '#212121');
```

**ВАЖНО:** НЕ применять split с `media="(prefers-color-scheme: dark/light)"` — это правило
из Golden 0.4 spec было **отвергнуто в v0.6 [Z6]** из-за конфликта с жёстко-заданным
`<body data-theme="dark">` (создаёт FOUC bug для пользователей с system=light: тёмный фон
страницы + светлая адресная строка). Проверка: `verify-frozen.js` тест `META-theme-color-single`
требует ровно 1 тег.

**Когда split правильный:** только если страница использует `prefers-color-scheme` для
автопереключения через CSS (например, `:root { color-scheme: dark light; }` + media-rules
на токены). Codex Studio это НЕ использует — manual toggle only.

### `<link rel="manifest">` обязателен

```html
<link rel="manifest" href="./assets/favicon/site.webmanifest">
```

Файл `site.webmanifest` тоже должен существовать в проекте.