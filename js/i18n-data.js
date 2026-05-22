/* ═════════════════════════════════════════════════════════════════════════════
   i18n-data.js — v0.8.x (Phase 1)

   Словари для переключателя RU/EN. UI_STRINGS и META_STRINGS заполнены
   ключами всего видимого статичного текста. CARDS_LOCALES / FA_LOCALES —
   пустые скелеты, заполнятся в Phase 2 / Phase 3.

   Принцип "никогда не переводить" зафиксирован: технические термины и
   англицизмы (Hard Surface, Product, Organic, Prototyping, Animations,
   CAD, Game, Game Assets, Game-Ready, Product Viz, Animation, 2D, 3D,
   Blueprints, Blender, ZBrush, Substance Painter, PBR, LOD, Tris, 4K,
   CC0, .blend, .fbx и т.п.) остаются одинаковыми в EN и RU.

   На этом этапе ru === en (placeholder для последующего копирайта;
   реальные переводы заголовков 18 кейсов и 25 FA-моделей придут в
   Phase 2–3).

   Persistence: URL ?lang=ru|en. NO localStorage / sessionStorage / cookies.
   ═════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CIS_COUNTRIES = ['RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'AM', 'AZ', 'MD'];

  // ── UI_STRINGS ──────────────────────────────────────────────────────────────
  // Dot-notation ключи, парсятся window.I18N.t('aria.contactTelegram').
  // Технические термины (Hard Surface, Product Viz, CAD, Game и т.п.) — ru === en.
  const UI_STRINGS_EN = {
    skipToContent: 'Skip to content',

    aria: {
      projectsNavigator: 'Projects navigator',
      freeAssetsNavigator: 'Free assets navigator',
      sidebarFooter: 'Sidebar footer',
      preloaderLoading: 'Loading',
      codexBackFirst: 'Codex — back to first project',
      codexBackPortfolio: 'Codex — back to portfolio',
      codexHome: 'Codex — home',
      contactTelegram: 'Contact via Telegram',
      langToggleEn: 'Switch language to English',
      langToggleRu: 'Switch language to Russian',
      switchToLight: 'Switch to light theme',
      switchToDark: 'Switch to dark theme',
      hideProjectsPanel: 'Hide projects panel',
      hideCategoriesPanel: 'Hide categories panel',
      filterByDiscipline: 'Filter by discipline',
      filterByCategory: 'Filter by category',
      disciplines: 'Disciplines',
      categories: 'Categories',
      projectList: 'Project list',
      assetCategories: 'Asset categories',
      visualizationMode: 'Visualization mode',
      projectNavigation: 'Project navigation',
      projectGallery: 'Project gallery',
      projectBlueprint: 'Project blueprint',
      project3dViewer: 'Project 3D viewer',
      projectCaseStudy: 'Project case study',
      backToProjects: 'Back to projects',
      backToCategories: 'Back to categories',
      prevProject: 'Previous project',
      nextProject: 'Next project',
      copyLink: 'Copy link to this project',
      exportBlueprintSvg: 'Export blueprint as SVG',
      openBlueprintFullscreen: 'Open blueprint fullscreen',
      backToPortfolio: 'Back to Portfolio',
      freeAssetsView: 'Free assets',
    },

    title: {
      contactTelegram: 'Contact · Telegram',
      toggleTheme: 'Toggle theme',
      switchLanguage: 'Switch language',
      copyLink: 'Copy link to this project',
      interactive3d: 'Interactive 3D viewer',
      technicalBlueprint: 'Technical blueprint view',
      prevProjectKey: 'Previous project (←)',
      nextProjectKey: 'Next project (→)',
      fullscreen: 'Fullscreen',
      backToPortfolio: 'Back to Portfolio',
      gameSwitchTitle: 'Filter the current category to game-ready assets only (does not switch category)',
    },

    btn: {
      contact: 'Contact',
      hideProjects: 'Hide projects',
      hideCategories: 'Hide categories',
      enterSite: 'ENTER SITE',
      copyLink: 'COPY LINK',
      exportSvg: 'Export SVG',
      gameAssetsOnly: 'Game assets only',
      gameSwitchHint: 'Filters the current category to game-ready assets only',
      backProjects: 'Projects',
      backCategories: 'Categories',
    },

    pill: {
      contact: 'Contact',
      freeAssets: 'Free Assets',
      portfolio: 'Portfolio',
    },

    preloader: {
      studio: 'CODEX_STUDIO',
      loadingIndex: 'LOADING_INDEX.HTML',
      loadingFa: 'LOADING_FREE_ASSETS.HTML',
      initializing: 'INITIALIZING ASSETS',
    },

    filter: {
      placeholderDiscipline: 'Filter by discipline',
      placeholderCategory: 'Filter by category',
      all: 'All',
      hardSurface: 'Hard Surface',
      product: 'Product',
      productViz: 'Product Viz',
      organic: 'Organic',
      prototyping: 'Prototyping',
      animations: 'Animations',
      animation: 'Animation',
      gameAssets: 'Game Assets',
      cad: 'CAD',
    },

    tabs: {
      twoD: '2D',
      threeD: '3D',
      blueprints: 'Blueprints',
    },

    footer: {
      statsIndex: 'DELETED 422 CUBES • CREATED 120 WORKS',
      statsFa: 'FREE  ·  25 ASSETS  ·  CC0',
    },

    faTag: {
      hardSurface: {
        title: 'Hard Surface',
        cat: 'Hard Surface',
        desc: 'Props, weapons, armour. AAA-ready topology.',
        format: '.blend .fbx',
        count: '8 assets',
        alt: 'Hard Surface assets preview',
      },
      product: {
        title: 'Product Visualization',
        cat: 'Product Viz',
        desc: 'Studio scenes, lighting rigs, camera setups.',
        format: '.blend',
        count: '5 assets',
        alt: 'Product Viz preview',
      },
      game: {
        title: 'Game-Ready',
        cat: 'Game Assets',
        desc: 'Optimised props with LODs and 4K PBR maps.',
        format: '.fbx LOD 0–2',
        count: '4 assets',
        alt: 'Game Assets preview',
        badge: 'Game',
      },
      organic: {
        title: 'Organic',
        cat: 'Organic',
        desc: 'Sculpted creatures, fur grooms, rigs.',
        format: '.blend rig',
        count: '3 assets',
        alt: 'Organic preview',
      },
      animation: {
        title: 'Animation',
        cat: 'Animation',
        desc: 'Turntables, reveal loops, camera paths.',
        format: '.blend .mp4',
        count: '2 assets',
        alt: 'Animation preview',
      },
      cad: {
        title: 'CAD',
        cat: 'CAD',
        desc: 'Parametric assemblies, print-ready geometry.',
        format: '.blend .step .stl',
        count: '3 assets',
        alt: 'CAD preview',
      },
    },
  };

  // Deep clone helper для ru = en (Phase 1 placeholder).
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone);
    const out = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = deepClone(obj[k]);
    }
    return out;
  }

  const UI_STRINGS = {
    en: UI_STRINGS_EN,
    ru: deepClone(UI_STRINGS_EN),
  };

  // ── META_STRINGS ───────────────────────────────────────────────────────────
  // Per-page (index / fa). Ключи: title, description, ogTitle, ogDescription,
  // ogSiteName, ogImageAlt, ogLocale, twitterTitle, twitterDescription.
  // Используются через data-i18n-meta="index.title" / "fa.description" и т.п.
  const META_STRINGS_EN = {
    index: {
      title: 'Codex — 3D Design Studio · Hard Surface & Product Visualization',
      description: 'Codex is a remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender. Available worldwide.',
      ogTitle: 'Codex — 3D Design Studio',
      ogDescription: 'Hard surface modeling, product viz, and 3D prototyping for global clients. Remote. Detail-driven. Blender-native.',
      ogSiteName: 'Codex Studio',
      ogImageAlt: 'Codex Studio — 3D design portfolio',
      ogLocale: 'en_US',
      twitterTitle: 'Codex — 3D Design Studio',
      twitterDescription: 'Hard surface modeling, product viz, and 3D prototyping for global clients.',
    },
    fa: {
      title: 'Free 3D Assets — Codex Studio · Hard Surface, Game-Ready, CC0',
      description: 'Free 3D assets by Codex Studio. Hard surface models, game-ready props, and product renders. Free for personal and commercial use under CC0 / CC-BY.',
      ogTitle: 'Free 3D Assets — Codex Studio',
      ogDescription: 'Hard surface, game-ready, and product 3D assets. Free for personal and commercial use.',
      ogSiteName: 'Codex Studio',
      ogImageAlt: 'Codex Studio — Free 3D Assets',
      ogLocale: 'en_US',
      twitterTitle: 'Free 3D Assets — Codex Studio',
      twitterDescription: 'Hard surface, game-ready, and product 3D assets. Free for personal and commercial use.',
    },
  };

  const META_STRINGS = {
    en: META_STRINGS_EN,
    ru: deepClone(META_STRINGS_EN),
  };

  // SEO-correctness override: og:locale ВСЕГДА должен соответствовать реальному
  // языку страницы (crawlers / OG scrapers). Это единственное per-key исключение
  // из "ru = clone en placeholder" — текстовые ключи останутся англоязычными
  // до реального копирайта в Phase 2-3, но locale-коды настоящие.
  META_STRINGS.ru.index.ogLocale = 'ru_RU';
  META_STRINGS.ru.fa.ogLocale = 'ru_RU';

  // ── CARDS_LOCALES / FA_LOCALES — пустые скелеты (Phase 2 / Phase 3) ────────
  const CARDS_LOCALES = { en: {}, ru: {} };
  const FA_LOCALES = { en: {}, ru: {} };

  window.I18N_DATA = {
    CIS_COUNTRIES: CIS_COUNTRIES.slice(),
    UI_STRINGS: UI_STRINGS,
    META_STRINGS: META_STRINGS,
    CARDS_LOCALES: CARDS_LOCALES,
    FA_LOCALES: FA_LOCALES,
  };
})();
