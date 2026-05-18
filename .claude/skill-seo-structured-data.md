---
name: codex-seo-structured-data
description: "Use when the user asks about SEO, search engine optimization, meta tags, structured data, JSON-LD schema, Open Graph, Twitter Cards, sitemap, robots.txt, llms.txt, canonical URLs, indexing, rich results, social media preview, or search ranking for Codex Studio (codex.promo). Trigger on: SEO, meta tags, structured data, JSON-LD, schema.org, sitemap, robots, llms, canonical, Open Graph, Twitter Card, rich results, search optimization."
---

# Codex Studio — SEO & Structured Data Specialist

Technical SEO + Schema.org for Codex Studio (codex.promo).
Two-page site: portfolio + free-assets. Focus: clean meta, correct OG, valid JSON-LD, social preview quality.

## Domain and canonical

```
Site:                  https://codex.promo/
Index canonical:       https://codex.promo/
FA canonical:          https://codex.promo/free-assets.html
```

NO `codex.studio` references — old domain, replaced by `codex.promo`.

## Required `<head>` meta — index.html

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Codex — 3D Design Studio · Hard Surface &amp; Product Visualization</title>
<meta name="description" content="Codex is a remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender. Available worldwide.">
<link rel="canonical" href="https://codex.promo/">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">

<!-- Open Graph (absolute URLs) -->
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

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="Codex — 3D Design Studio">
<meta name="twitter:description" content="Hard surface modeling, product viz, and 3D prototyping for global clients.">
<meta name="twitter:image"       content="https://codex.promo/assets/img/og-image.jpg">

<!-- Theme color: SINGLE tag, no media (v0.6 [Z6]) -->
<meta name="theme-color" content="#212121">

<!-- Favicon (note: -16.png / -32.png, NOT -16x16 / -32x32) -->
<link rel="icon" type="image/x-icon" href="./assets/favicon/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="./assets/favicon/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="./assets/favicon/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="./assets/favicon/apple-touch-icon.png">
<link rel="manifest" href="./assets/favicon/site.webmanifest">
```

## Required `<head>` meta — free-assets.html

Differences from index:
- `<title>Free 3D Assets — Codex Studio · Hard Surface, Game-Ready, CC0</title>`
- `<link rel="canonical" href="https://codex.promo/free-assets.html">`
- `og:url` = `https://codex.promo/free-assets.html`
- `og:image` = `https://codex.promo/assets/img/og-free-assets.jpg` (per-page, NOT reused)
- `og:image:alt` = `Codex Studio — Free 3D Assets`

## JSON-LD — index.html (3 schemas)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Codex Studio",
  "alternateName": "Codex",
  "url": "https://codex.promo/",
  "logo": "https://codex.promo/assets/img/og-image.jpg",
  "description": "Remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender.",
  "sameAs": [
    "https://www.artstation.com/REPLACE_WITH_REAL",
    "https://www.behance.net/REPLACE_WITH_REAL",
    "https://t.me/WhiteCatWeb"
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Codex Studio",
  "url": "https://codex.promo/",
  "inLanguage": "en",
  "publisher": { "@type": "Organization", "name": "Codex Studio" }
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Codex Studio — Featured Works",
  "itemListOrder": "https://schema.org/ItemListOrderAscending",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "CreativeWork",
        "name": "Orbital Mk.II",
        "creator": { "@type": "Organization", "name": "Codex Studio" },
        "about": "Hard surface 3D · game-ready asset",
        "url": "https://codex.promo/#orbital-mk-ii"
      }
    }
    /* ... + Corten Series, Apex Frame, Nightshard ... */
  ]
}
</script>
```

`sameAs` placeholders `REPLACE_WITH_REAL` are flagged but not yet replaced.

## JSON-LD — free-assets.html (2 schemas)

```html
<script type="application/ld+json">
{ /* Organization — same as index */ }
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Free 3D Assets — Codex Studio",
  "url": "https://codex.promo/free-assets.html",
  "inLanguage": "en",
  "description": "Free 3D assets by Codex Studio. Hard surface models, game-ready props, and product renders.",
  "isPartOf": { "@type": "WebSite", "name": "Codex Studio", "url": "https://codex.promo/" },
  "publisher": { "@type": "Organization", "name": "Codex Studio" },
  "primaryImageOfPage": "https://codex.promo/assets/img/og-free-assets.jpg"
}
</script>
```

## SEO copy rules

- `<title>`: `Brand — Service · Secondary Service` (≤ 60 chars; current has em-dash + middot)
- `<meta name="description">`: 150–160 chars, action-oriented, naturally includes keywords
- One unique `<h1>` per page (on index — `.case-view__title`, dynamic per case)
- Alt text on portfolio images: include technique + subject (good for image search)

## sitemap.xml (v0.7.10)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://codex.promo/</loc>
    <lastmod>2026-04-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://codex.promo/assets/img/og-image.jpg</image:loc>
      <image:title>Codex Studio — 3D design portfolio</image:title>
    </image:image>
  </url>
  <!-- TODO: add free-assets.html entry when ready -->
</urlset>
```

## robots.txt (v0.7.10)

```
User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# AI crawlers explicitly allowed
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /

Sitemap: https://codex.promo/sitemap.xml
```

## llms.txt

Present at `/llms.txt`. Brief studio summary, featured works, technical, contact, last-updated date.

## theme-color (project-specific, v0.6 [Z6]+)

**Single tag without `media`:**

```html
<meta name="theme-color" content="#212121">
```

JS `applyTheme()` in `main.js` updates content on manual toggle:
```javascript
themeMetaColor.setAttribute('content', isLight ? '#f5f5f5' : '#212121');
```

**DO NOT split with `media="(prefers-color-scheme: dark/light)"`** — rejected in v0.6 [Z6] due to FOUC bug with hardcoded `<body data-theme="dark">` (system=light user gets dark body + light browser bar). `verify-frozen.js` test `META-theme-color-single` requires count=1.

**Split is correct only when:** page uses `prefers-color-scheme` for auto-switching via CSS (`:root { color-scheme: dark light; }` + media-rules on tokens). Codex Studio does NOT do this — manual toggle only.

## `<link rel="manifest">` — mandatory

```html
<link rel="manifest" href="./assets/favicon/site.webmanifest">
```

`site.webmanifest` content:
```json
{
  "name": "Codex Studio",
  "short_name": "Codex",
  "icons": [
    { "src": "./assets/favicon/favicon-32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "./assets/favicon/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ],
  "theme_color": "#212121",
  "background_color": "#212121",
  "display": "standalone"
}
```

## Validation targets

- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org/
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Google PageSpeed Insights: https://pagespeed.web.dev/

## Pre-deploy SEO checklist

- [ ] `<title>` per page, specific, ≤ 60 chars
- [ ] `<meta name="description">` 150–160 chars per page
- [ ] `<link rel="canonical">` per page (absolute URL)
- [ ] OG: url, type, site_name, title, description, image (absolute), image:width=1200, image:height=630, image:alt, locale — all 10
- [ ] Twitter card: summary_large_image + title + description + image (absolute)
- [ ] Per-page OG-image (`og-image.jpg` for index, `og-free-assets.jpg` for FA)
- [ ] Favicon: .ico + 32px + 16px + apple-touch + manifest (5 files, naming `-N.png` not `-NxN.png`)
- [ ] theme-color SINGLE tag (`META-theme-color-single` test)
- [ ] JSON-LD: index → Org + WebSite + ItemList; FA → Org + WebPage
- [ ] og:image absolute URL `https://codex.promo/...`
- [ ] No `codex.studio` references anywhere
- [ ] No Cyrillic in any meta tag
- [ ] `&` → `&amp;` in HTML (W3C valid)
- [ ] sitemap.xml + robots.txt + llms.txt present
- [ ] All `REPLACE_WITH_REAL` placeholders flagged for replacement before launch

## Output format

1. **SEO AUDIT:** score estimate + issues count by severity
2. **Required fixes** with exact code (labeled with target file)
3. **JSON-LD blocks** ready to paste
4. **Validation URLs** to check after deploy

---

*Version: 2.0 · May 2026 · Codex Studio v0.7.10 → v0.8 (in progress)*
