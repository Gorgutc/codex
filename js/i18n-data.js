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

    // Phase 4a — dynamic JS strings.
    // cards-toggle: четыре варианта (Show/Hide × Projects/Categories) +
    // соответствующие aria-labels. main.js setCollapsed() читает их по странице.
    toggle: {
      showProjects: 'Show projects',
      hideProjects: 'Hide projects',
      showCategories: 'Show categories',
      hideCategories: 'Hide categories',
      showProjectsAria: 'Show projects panel',
      hideProjectsAria: 'Hide projects panel',
      showCategoriesAria: 'Show categories panel',
      hideCategoriesAria: 'Hide categories panel',
    },

    // theme-toggle aria-label (label text шевеление пиктограммы, не текст).
    theme: {
      toDark: 'Switch to dark theme',
      toLight: 'Switch to light theme',
    },

    // COPY LINK kit.
    copy: {
      label: 'COPY LINK',
      copied: 'COPIED ✓',
    },

    // Filter chip remove button: 'Remove ' + filter-label.
    chip: {
      remove: 'Remove',
    },

    // Fullscreen overlay counters / aria-labels.
    fs: {
      fullscreenView: 'Fullscreen view',
      closeFullscreen: 'Close fullscreen',
      previousImage: 'Previous image',
      nextImage: 'Next image',
      imageGallery: 'Image gallery viewer',
      blueprintViewer: 'Blueprint viewer',
      // Counter prefixes — assembled in JS as
      // `${imagePrefix} ${i+1} ${ofWord} ${total}`.
      imagePrefix: 'Image',
      blueprintPrefix: 'Blueprint',
      ofWord: 'of',
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

  // Phase 4a — RU overrides для всех новых ключей. UI_STRINGS_EN — единый
  // source; здесь оверрайдим только те поля, где RU реально отличается.
  // Filter / category-имена / tools остаются англицизмами (см. Phase 1/2/3),
  // поэтому не оверрайдятся.
  UI_STRINGS.ru.toggle = {
    showProjects: 'Показать проекты',
    hideProjects: 'Скрыть проекты',
    showCategories: 'Показать категории',
    hideCategories: 'Скрыть категории',
    showProjectsAria: 'Развернуть панель проектов',
    hideProjectsAria: 'Свернуть панель проектов',
    showCategoriesAria: 'Развернуть панель категорий',
    hideCategoriesAria: 'Свернуть панель категорий',
  };
  UI_STRINGS.ru.theme = {
    toDark: 'Переключить на тёмную тему',
    toLight: 'Переключить на светлую тему',
  };
  UI_STRINGS.ru.copy = {
    label: 'СКОПИРОВАТЬ',
    copied: 'СКОПИРОВАНО ✓',
  };
  UI_STRINGS.ru.chip = {
    remove: 'Убрать',
  };
  UI_STRINGS.ru.fs = {
    fullscreenView: 'Полноэкранный режим',
    closeFullscreen: 'Закрыть полноэкранный режим',
    previousImage: 'Предыдущее изображение',
    nextImage: 'Следующее изображение',
    imageGallery: 'Галерея изображений',
    blueprintViewer: 'Просмотр чертежа',
    imagePrefix: 'Изображение',
    blueprintPrefix: 'Чертёж',
    ofWord: 'из',
  };

  // Также — btn.copyLink (RU вариант для самого CTA). Английский вариант
  // 'COPY LINK' уже есть в EN. RU делаем тише регистром (для контраста с
  // КОПИРОВАНО).
  UI_STRINGS.ru.btn = Object.assign({}, UI_STRINGS.ru.btn, {
    copyLink: 'СКОПИРОВАТЬ',
  });

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

  // ── CARDS_LOCALES — 18 портфолио-кейсов, по data-id (Phase 2) ──────────────
  //
  // Поля card-level (выводятся прямо в HTML work-card):
  //   - title — название кейса. Брэнды / 3D-product-names НЕ переводятся
  //     (Orbital Mk.II, Vega Shell, Nightshard и т.д. — это имена работ,
  //     как у живописных полотен; локализация = ноль).
  //   - desc — короткое описание. Tech-термины (PBR, LOD, AAA, UE5, CAD,
  //     turntable, groom, SSS, displacement, UAV) остаются англицизмами —
  //     это профессиональный сленг 3D-индустрии, и senior-аудитория видит
  //     их именно в этой форме.
  //   - alt — alt-текст для <img>. Структура "<Brand> — <RU-описание>".
  //
  // Поля cat / year / role / tools / modelStats / captions / text-блоки
  // живут в CARDS_DATA в main.js (case-view content) и обрабатываются в
  // Phase 2b отдельно через CARDS_DATA snapshot-and-overlay механизм.
  const CARDS_LOCALES_EN = {
    'orbital-mk-ii':  { title: 'Orbital Mk.II',  desc: 'Sci-fi prop engineered for AAA pipeline. Full PBR, clean topology.',                     alt: 'Orbital Mk.II — sci-fi hard surface prop' },
    'vega-shell':     { title: 'Vega Shell',     desc: 'Modular exo-armor system. 47 individual parts, LOD-ready.',                              alt: 'Vega Shell — modular exo-armor system' },
    'ironclad-frame': { title: 'Ironclad Frame', desc: 'Industrial chassis breakdown. Every bolt and seam modeled to spec.',                     alt: 'Ironclad Frame — industrial chassis breakdown' },
    'corten-series':  { title: 'Corten Series',  desc: 'Product viz for an industrial furniture brand. Launch-ready renders.',                   alt: 'Corten Series — industrial furniture product viz' },
    'lumen-one':      { title: 'Lumen One',      desc: 'Architectural lighting unit. Photorealistic turntable for pitch deck.',                  alt: 'Lumen One — architectural lighting unit' },
    'flux-capsule':   { title: 'Flux Capsule',   desc: 'Consumer tech device. E-commerce shot set, studio lighting rig.',                        alt: 'Flux Capsule — consumer tech device' },
    'nightshard':     { title: 'Nightshard',     desc: 'Hero weapon asset. 4K PBR textures, optimised for real-time.',                           alt: 'Nightshard — hero weapon asset, game-ready' },
    'recon-drone':    { title: 'Recon Drone',    desc: 'Tactical UAV prop. Game-ready, LOD0–LOD2, UE5-compatible.',                              alt: 'Recon Drone — tactical UAV prop' },
    'apex-frame':     { title: 'Apex Frame',     desc: 'Mechanical component breakdown for engineering client. Mfg-reference accuracy.',         alt: 'Apex Frame — mechanical component breakdown' },
    'core-rig':       { title: 'Core Rig',       desc: 'Structural assembly prototype. Modeled for 3D-print validation.',                        alt: 'Core Rig — structural assembly prototype' },
    'helix-reveal':   { title: 'Helix Reveal',   desc: 'Product reveal animation. 6-second loop, render for hero section.',                      alt: 'Helix Reveal — product reveal animation' },
    'arc-motion':     { title: 'Arc Motion',     desc: 'Turntable sequence for industrial product. 360° orbit, 4K export.',                      alt: 'Arc Motion — turntable sequence for industrial product' },
    'nyx-panther':    { title: 'Nyx Panther',    desc: 'Stylized feline creature. Hand-sculpted anatomy, dual-coat fur groom.',                  alt: 'Nyx Panther — stylized feline creature' },
    'drift-koi':      { title: 'Drift Koi',      desc: 'Ornamental fish study. Displacement scales, subsurface scattering pass.',                alt: 'Drift Koi — ornamental fish study' },
    'glint-owl':      { title: 'Glint Owl',      desc: 'Stylized bird character. Feather grooming with procedural asymmetry.',                   alt: 'Glint Owl — stylized bird character' },
    'mech-link':      { title: 'Mech Link',      desc: 'Industrial CAD assembly. Placeholder kit — final GLB + renders in progress.',            alt: 'Mech Link — CAD assembly placeholder' },
    'flex-spine':     { title: 'Flex Spine',     desc: 'Kinematic spine study. CAD constraints, parametric ribs — work in progress.',            alt: 'Flex Spine — CAD kinematic placeholder' },
    'cad-strut':      { title: 'CAD Strut',      desc: 'Structural strut node. CAD-first geometry — final model & textures pending.',           alt: 'CAD Strut — structural node placeholder' },
  };
  const CARDS_LOCALES_RU = {
    'orbital-mk-ii':  { title: 'Orbital Mk.II',  desc: 'Sci-fi-проп для AAA-пайплайна. Полный PBR, чистая топология.',                            alt: 'Orbital Mk.II — sci-fi-проп hard surface' },
    'vega-shell':     { title: 'Vega Shell',     desc: 'Модульный экзо-доспех. 47 отдельных деталей, LOD-ready.',                                 alt: 'Vega Shell — модульный экзо-доспех' },
    'ironclad-frame': { title: 'Ironclad Frame', desc: 'Промышленное шасси в разборе. Каждый болт и шов — по чертежу.',                           alt: 'Ironclad Frame — промышленное шасси в разборе' },
    'corten-series':  { title: 'Corten Series',  desc: 'Product viz для бренда промышленной мебели. Рендеры готовы к запуску.',                   alt: 'Corten Series — индустриальная мебель, product viz' },
    'lumen-one':      { title: 'Lumen One',      desc: 'Архитектурный светильник. Фотореалистичный turntable для pitch-deck.',                    alt: 'Lumen One — архитектурный светильник' },
    'flux-capsule':   { title: 'Flux Capsule',   desc: 'Consumer-гаджет. E-commerce сет, studio lighting rig.',                                   alt: 'Flux Capsule — consumer-гаджет' },
    'nightshard':     { title: 'Nightshard',     desc: 'Hero-оружие. 4K PBR-текстуры, оптимизация под real-time.',                                alt: 'Nightshard — hero-оружие, game-ready' },
    'recon-drone':    { title: 'Recon Drone',    desc: 'Тактический UAV-проп. Game-ready, LOD0–LOD2, под UE5.',                                   alt: 'Recon Drone — тактический UAV-проп' },
    'apex-frame':     { title: 'Apex Frame',     desc: 'Разборка механического узла для инженерного заказчика. Точность по заводскому чертежу.',  alt: 'Apex Frame — механический узел в разборе' },
    'core-rig':       { title: 'Core Rig',       desc: 'Прототип несущей сборки. Геометрия под 3D-печатную валидацию.',                           alt: 'Core Rig — прототип несущей сборки' },
    'helix-reveal':   { title: 'Helix Reveal',   desc: 'Product reveal-анимация. 6-секундный луп, рендер под hero-секцию.',                       alt: 'Helix Reveal — product reveal-анимация' },
    'arc-motion':     { title: 'Arc Motion',     desc: 'Turntable-секвенция для промышленного продукта. Орбита 360°, выгрузка 4K.',               alt: 'Arc Motion — turntable для индустриального продукта' },
    'nyx-panther':    { title: 'Nyx Panther',    desc: 'Стилизованный хищник кошачьих. Скульптинг анатомии вручную, двухслойный грум меха.',      alt: 'Nyx Panther — стилизованный хищник' },
    'drift-koi':      { title: 'Drift Koi',      desc: 'Этюд декоративной рыбы. Displacement-чешуя, SSS-пасс.',                                   alt: 'Drift Koi — этюд декоративной рыбы' },
    'glint-owl':      { title: 'Glint Owl',      desc: 'Стилизованный птичий персонаж. Грум пера с процедурной асимметрией.',                     alt: 'Glint Owl — стилизованный птичий персонаж' },
    'mech-link':      { title: 'Mech Link',      desc: 'Промышленная CAD-сборка. Placeholder-кит — финальный GLB и рендеры в работе.',            alt: 'Mech Link — CAD-сборка, плейсхолдер' },
    'flex-spine':     { title: 'Flex Spine',     desc: 'Этюд кинематической оси. CAD-констрейнты, параметрические рёбра — в работе.',             alt: 'Flex Spine — этюд кинематической оси, CAD' },
    'cad-strut':      { title: 'CAD Strut',      desc: 'Структурный strut-узел. CAD-first геометрия — финальная модель и текстуры в очереди.',    alt: 'CAD Strut — структурный узел, CAD' },
  };
  const CARDS_LOCALES = { en: CARDS_LOCALES_EN, ru: CARDS_LOCALES_RU };

  // ── CASE_LOCALES — case-view контент 18 кейсов (Phase 2b) ──────────────────
  //
  // Покрывает поля внутри CARDS_DATA (main.js):
  //   - role         — тип проекта ('Personal' / 'R&D' / 'Client').
  //   - captions[5]  — 5 галерейных слайдов × { label, desc }.
  //   - text         — главный текстовый блок { title, body }.
  //   - inline       — врезка { title, body }.
  //
  // НЕ переводятся (живут в CARDS_DATA как есть):
  //   - tools[]      — Blender / ZBrush / Substance Painter / UE5 / Fusion 360 /
  //                    Inkscape / Meshmixer / KeyShot — proper nouns 3D-софта.
  //   - modelSrc     — URL.
  //   - modelStats   — числа + software-field (англицизмы).
  //   - palette / srcs — техническое.
  //
  // Mechanics в i18n.js: snapshot of window.CARDS_DATA at first applyLang;
  // on every applyLang restore baseline + overlay tr[lang]; затем fire
  // 'i18n:changed' event для main.js, который re-renderит активный case-view.
  const CASE_LOCALES_EN = {
    'orbital-mk-ii': {
      role: 'Personal',
      captions: [
        { label: 'Hero render',     desc: 'Sci-fi prop engineered for AAA pipeline. Full PBR, clean manifold topology.' },
        { label: 'Testing hamster', desc: 'Проверка загрузки иллюстрации' },
        { label: 'Topology pass',   desc: '18 k clean quads. Subdivision-ready and LOD0-certified for real-time integration.' },
        { label: 'Detail close-up', desc: 'Panel seam macro. Bevel widths tuned for 2 m viewing distance at 4 K resolution.' },
        { label: 'Final composite', desc: 'Lit with 3-point studio HDRI. Denoised in OptiX, tonemapped ACES.' }
      ],
      text:   { title: 'Pipeline fit',    body: 'Delivered as a game-ready asset with LOD0–LOD2 and a separate cinematic mesh for marketing renders. Naming and pivot conventions follow Unreal Engine 5 standards.' },
      inline: { title: 'Texture budget',  body: 'Single 4 K texture set for hero, separate 2 K sets per LOD stage. Roughness authored in 16-bit to preserve micro-detail.' }
    },
    'vega-shell': {
      role: 'Personal',
      captions: [
        { label: 'System overview',     desc: 'Modular exo-armor built from 47 individual pieces. Each segment detaches for LOD and rigging.' },
        { label: 'Component breakdown', desc: 'Parting logic derived from real manufacturing constraints. No floating geo, clean hard-edges.' },
        { label: 'LOD passes',          desc: 'LOD0–LOD2 prepared at 100 %, 40 % and 12 % poly budgets for runtime mesh streaming.' },
        { label: 'Shoulder plate',      desc: 'Ball-joint attachment with limit constraints baked into naming. Ready for IK retarget.' },
        { label: 'Paint variant',       desc: 'Three material presets — factory clean, field-worn, arctic camo — via ID-mask layering.' }
      ],
      text:   { title: 'Why modularity', body: 'Each of the 47 parts can be hot-swapped at runtime to support player customisation. Every seam has been modelled as a mechanical connection rather than a floating surface decal.' },
      inline: { title: 'Rigging ready',  body: 'Each segment carries a hidden socket bone. Joint orientation follows FBX conventions for seamless Maya/Blender export.' }
    },
    'ironclad-frame': {
      role: 'R&D',
      captions: [
        { label: 'Full assembly',    desc: 'Industrial chassis breakdown. Every bolt and seam modeled to engineering specification.' },
        { label: 'Part isolation',   desc: 'Selected sub-assembly with material IDs highlighted. 24 individually named mesh objects.' },
        { label: 'Production notes', desc: 'Annotated render set delivered to engineering team as vector-accurate reference PDF.' },
        { label: 'Load diagram',     desc: 'Stress-path overlay generated in Blender Compositing from engineering FEA export.' },
        { label: 'Finish variants',  desc: 'Powder-coat and raw-steel renders delivered for catalogue and technical documentation.' }
      ],
      text:   { title: 'Reference accuracy', body: 'Modelled directly from issued engineering CAD — every hole pattern, bolt head and weld bead matches the real part to within 0.5 mm at full scale.' },
      inline: { title: 'Weight target',      body: 'Under 28 k tris at LOD0. Silhouette readable at 512 px. First-person camera tested at 2 m and 6 m focal distance.' }
    },
    'corten-series': {
      role: 'Client',
      captions: [
        { label: 'Studio render',   desc: 'Product viz for an industrial furniture brand. Corten steel material, HDR studio lighting.' },
        { label: 'Context shot',    desc: 'In-situ placement render in a concrete loft environment. Used as lead image for the launch deck.' },
        { label: 'Material passes', desc: 'Raw metal base, rust gradient pass, and clearcoat variation delivered for print and web.' },
        { label: 'Detail macro',    desc: 'Texture close-up showing procedural oxidation, patina and surface imperfection layers.' },
        { label: 'Lineup shot',     desc: 'Full collection rendered as a lineup for the catalogue spread. Lighting matches brand art direction.' }
      ],
      text:   { title: 'Material approach', body: 'The Corten oxidation is procedural, not painted. A single material graph drives rust density, micro-pitting and runoff stains — each chair variant reads as a unique piece without repeating textures.' },
      inline: { title: 'Patina system',     body: 'Rust generated from curvature + ambient occlusion masks. Two layers: oxide underneath, flake breakup on top, roughness offset per layer.' }
    },
    'lumen-one': {
      role: 'Client',
      captions: [
        { label: 'Final render',    desc: 'Architectural lighting unit. Photorealistic turntable deliverable for investor pitch deck.' },
        { label: 'Lighting setup',  desc: '3-point HDRI rig with area light fill. Caustics rendered via path-tracing at 4096 samples.' },
        { label: 'Spec sheet',      desc: 'Dimension overlay and material callout sheet generated in Blender Compositing and Inkscape.' },
        { label: 'Context shot',    desc: 'Hero placement in a modern office environment, shot from client-approved camera angle.' },
        { label: 'Colour variants', desc: 'Six finish variants — brass, chrome, matte black, warm white — rendered as catalogue sprites.' }
      ],
      text:   { title: 'Light behaviour', body: 'The optical housing uses a real IES profile exported from the client’s photometric test. Caustics and beam spread on camera match what the product produces on a physical wall.' },
      inline: { title: 'Light model',     body: 'Filament IES bakes drive the emissive intensity map. Inner diffuser scatters via subsurface approximation — no cheat geometry.' }
    },
    'flux-capsule': {
      role: 'R&D',
      captions: [
        { label: 'Product shot',    desc: 'Consumer tech device. E-commerce hero shot with studio HDRI and custom denoising.' },
        { label: '360° view',       desc: 'Full turntable sequence — 36 frames at 10° increments. Exported as WebP sprite strip.' },
        { label: 'Detail macro',    desc: 'Micro-surface texture pass. Sub-millimetre detail captured with a virtual macro lens rig.' },
        { label: 'Packaging',       desc: 'Retail box render with reflective foil stamping, printed using PBR metallic-clearcoat.' },
        { label: 'Scale ref',       desc: 'Hand comparison render to communicate size without breaking photo-neutral background.' }
      ],
      text:   { title: 'Launch ready', body: 'All hero assets were delivered as 6 K master renders plus derivative crops for Shopify, Amazon and paid-social ad placements. Colour profile matches the brand Pantone book.' },
      inline: { title: 'Containment', body: 'Animated shader on the core reads a custom gradient texture — no vertex morph, no simulation cache. Runs at 240 FPS on mid-range GPUs.' }
    },
    'nightshard': {
      role: 'Personal',
      captions: [
        { label: 'Final asset',    desc: 'Hero weapon for a third-person action title. 4K PBR textures, optimised for real-time.' },
        { label: 'Texture sheets', desc: 'Albedo, roughness, metalness, normal and AO maps. Baked from 8M-poly high source.' },
        { label: 'Polycount view', desc: 'Game-ready mesh at 12 k triangles — within budget for character-attachment LOD0.' },
        { label: 'In-engine test', desc: 'Live capture inside Unreal Engine 5 using Nanite-disabled preview with Lumen.' },
        { label: 'Blade macro',    desc: 'Edge chip detail pass. Anisotropic reflection matches reference from real forged steel.' }
      ],
      text:   { title: 'Ready for gameplay', body: 'Socket points, collision primitives and a simple Blueprint-compatible animation rig are included in the deliverable. Ready to be imported and attached to a character skeleton on arrival.' },
      inline: { title: 'Refraction',         body: 'Index of refraction tuned to 1.52 for lead crystal. Dispersion faked with a three-channel UV offset in post.' }
    },
    'recon-drone': {
      role: 'Personal',
      captions: [
        { label: 'Completed model', desc: 'Tactical UAV prop. Game-ready tri count with full LOD0–LOD2 chain for UE5.' },
        { label: 'Exploded view',   desc: 'Separated components rendered with distance-based transparency. Used in pitch deck.' },
        { label: 'LOD comparison',  desc: 'Side-by-side LOD0 (14 k), LOD1 (5.6 k) and LOD2 (1.8 k) with silhouette preservation.' },
        { label: 'Rotor animation', desc: 'Dual-blade rotor cycle baked into mesh. 120 fps loop for seamless idle state.' },
        { label: 'Decal library',   desc: 'Set of 12 modular decals (serials, hazard tape, unit IDs) for squad personalisation.' }
      ],
      text:   { title: 'Engine-side integration', body: 'The drone ships with an Unreal-ready Blueprint actor, socket points for the antenna and gimbal, and a material parameter collection for easy colourway swaps without duplicating assets.' },
      inline: { title: 'Modularity',              body: 'Payload bay accepts 6 swappable modules. Each snaps via a shared 3-pin connector — no per-module rigging required.' }
    },
    'apex-frame': {
      role: 'Client',
      captions: [
        { label: 'Assembly render',  desc: 'Mechanical component breakdown for engineering client. Manufacturing-reference accuracy.' },
        { label: 'Component detail', desc: 'Tolerance callouts overlaid on photorealistic render for internal design review.' },
        { label: 'Engineering ref',  desc: 'Annotated PDF and STEP export handed off directly to manufacturing partner.' },
        { label: 'Stress overlay',   desc: 'FEA colour map composited onto mesh render for pitch deck to investors.' },
        { label: 'Prototype photo',  desc: 'Side-by-side of render and machined prototype. Geometry lines up within tolerance.' }
      ],
      text:   { title: 'Engineering-grade', body: 'Files were exported at full 1:1 scale with real-world units baked in. All holes, threads and fillets match the STEP source that went to the CNC shop — nothing is "eyeballed".' },
      inline: { title: 'Impact geo',        body: 'Deformable plate zones pre-sculpted in 5 stages. Blend shapes drive runtime damage without additional draw calls.' }
    },
    'core-rig': {
      role: 'R&D',
      captions: [
        { label: 'Structural view', desc: 'Structural assembly prototype modeled for 3D-print validation and form-factor approval.' },
        { label: 'Section cut',     desc: 'Cross-section render exposing interior wall thickness for print clearance verification.' },
        { label: 'Print validation',desc: 'Final mesh passed through Meshmixer slicer. Zero errors, overhang angle within tolerance.' },
        { label: 'Support map',     desc: 'Predicted support regions overlaid in blue. Used to iterate the orientation before slicing.' },
        { label: 'Fit test render', desc: 'Assembly of the printed prototype with its mating housing. Photogrammetry alignment check.' }
      ],
      text:   { title: 'Print-first design', body: 'The geometry is modelled around FDM constraints — 45° overhang rules, wall-thickness minimums and bridging limits — so the file can go straight to a slicer without manual repair.' },
      inline: { title: 'Joint library',      body: 'Custom IK handle with stretch-and-squash limits. Retargets to Mixamo and Mannequin out of the box.' }
    },
    'helix-reveal': {
      role: 'R&D',
      captions: [
        { label: 'Final frame',     desc: 'Product reveal animation — 6-second loop rendered for a hero section background.' },
        { label: 'Storyboard',      desc: 'Hand-drawn beat sheet translated to Blender timeline. 6 key poses over 180 frames.' },
        { label: 'Render settings', desc: '4K @ 60 fps, Cycles path-trace, 512 samples. Denoised in OptiX. Exported as ProRes 4444.' },
        { label: 'Camera moves',    desc: 'Two-layer parallax camera setup — dolly track plus subtle handheld noise for energy.' },
        { label: 'Colour grade',    desc: 'Teal-orange grade applied in DaVinci Resolve. Matches the brand launch trailer palette.' }
      ],
      text:   { title: 'Built for loops', body: 'Every motion curve is shaped so the last frame matches the first. The 6-second cycle can play forever as a hero background without a visible cut.' },
      inline: { title: 'Animation',       body: '12-second loop at 24 FPS. DNA helix unwinds via a single angle-driven shader — no armature, no bake.' }
    },
    'arc-motion': {
      role: 'R&D',
      captions: [
        { label: 'Orbit frame',      desc: 'Turntable sequence for industrial product — 360° orbit, 4K export with motion blur.' },
        { label: 'Lighting pass',    desc: '3-layer HDRI rig with gel-coloured area lights. Lighting designed to match brand guidelines.' },
        { label: 'Export settings',  desc: 'Delivered as 4K MP4 (H.264), WebM (VP9), and individual PNG sequence for compositing.' },
        { label: 'Motion blur',      desc: 'Per-object velocity pass rendered separately so the client can tune blur amount in post.' },
        { label: 'Compositing AOVs', desc: 'Cryptomatte, depth, ID and position passes delivered for flexible relight in Nuke.' }
      ],
      text:   { title: 'Delivery formats', body: 'Shipped as a master ProRes file plus H.264, WebM and an image sequence. Same timing, three containers — ready for web, print and post-production pipelines.' },
      inline: { title: 'Motion curves',    body: 'Custom ease-out-expo for the main arc. Secondary trails use bezier splines sampled at 60 FPS.' }
    },
    'nyx-panther': {
      role: 'Personal',
      captions: [
        { label: 'Full body pose',   desc: 'Stylized feline creature. Hand-sculpted anatomy, two-coat fur groom, stylised musculature.' },
        { label: 'Fur pass',         desc: 'Dual-layer fur groom — undercoat + guard hairs with procedural clumping and asymmetry.' },
        { label: 'Head study',       desc: 'Facial sculpt focused on eye rhythm and nasal break. Fine whisker cards placed manually.' },
        { label: 'Silhouette cards', desc: 'Action pose library with 6 silhouettes used to lock animation feel before keyframing.' },
        { label: 'Prowl animation',  desc: 'Looped prowl cycle at 30 fps. Cloth-free skeleton mesh for real-time preview in viewport.' }
      ],
      text:   { title: 'Character intent', body: 'Designed as a neutral hero creature for a stealth-focused narrative. Silhouette reads in both light and dark environments, and the fur groom simplifies cleanly to real-time cards.' },
      inline: { title: 'Fur grooming',     body: 'Dual-coat setup: guide hairs hand-sculpted, undercoat scattered via density map. Groom exports to Alembic at 1.2 M splines.' }
    },
    'drift-koi': {
      role: 'Personal',
      captions: [
        { label: 'Hero render',     desc: 'Ornamental fish study. Displacement scales, three-layer subsurface scattering pass.' },
        { label: 'Scale macro',     desc: 'Procedural scale pattern sculpted in ZBrush and driven by a curve-based UV layout.' },
        { label: 'Fin study',       desc: 'Thin-film interference on the tail fin. Double-sided shader with anisotropic highlights.' },
        { label: 'Swim loop',       desc: 'Seamless 3-second swim cycle driven by a spline rig. Ready for particle systems and aquariums.' },
        { label: 'Variant pattern', desc: 'Seven patterning variants — Kohaku, Showa, Asagi and custom — via mask blending.' }
      ],
      text:   { title: 'Organic shading', body: 'The scale shader reads as wet without looking plastic. A combination of displacement, anisotropic highlight and soft subsurface response keeps the surface grounded even under harsh lighting.' },
      inline: { title: 'Scale shader',    body: 'Iridescent scales driven by fresnel × vertex color. Three variants — koi red, shusui blue, asagi silver — toggle via material ID.' }
    },
    'glint-owl': {
      role: 'Personal',
      captions: [
        { label: 'Portrait render',   desc: 'Stylized bird character. Feather grooming with procedural asymmetry and wind drift.' },
        { label: 'Wing spread',       desc: 'Fully posed flight wing with hand-placed primaries and secondaries on a bone chain.' },
        { label: 'Feather cards',     desc: 'Texture sheet of 40 individual feather cards used by the groom and LOD feather planes.' },
        { label: 'Beak & talon',      desc: 'Hero keratin shader — glossy micro-surface, warm subsurface — applied to beak and talons.' },
        { label: 'Silhouette lineup', desc: 'Eight pose silhouettes used to lock mood before the final groom pass was started.' }
      ],
      text:   { title: 'Groom system',   body: 'The entire plumage is driven by one groom modifier with density, length and clumping masks. Editing the mask updates every feather at once — no hand-placing individual strands.' },
      inline: { title: 'Feather layers', body: 'Body feathers groomed per zone: head, chest, primaries. Alpha-cards for silhouette, shell geometry for flight feathers.' }
    },
    'mech-link': {
      role: 'R&D',
      captions: [
        { label: 'Assembly overview', desc: 'Industrial link chain placeholder. Parametric pin-joint assembly sourced from CAD.' },
        { label: 'Bracket detail',    desc: 'Bolt-pattern close-up. Placeholder geometry — final topology pass pending.' },
        { label: 'Motion study',      desc: 'Range-of-motion sketch for the pivoting arm. Constraint solver preview.' },
        { label: 'Exploded view',     desc: 'Parts diagram for manufacture planning. Tolerances marked in source DWG.' },
        { label: 'Material preview',  desc: 'KeyShot pass — brushed steel and anodized aluminium swatches.' }
      ],
      text:   { title: 'CAD placeholder', body: 'This case is a technology placeholder. Final GLB, topology and renders are being prepared. Used to validate the layout and the CAD-category filter.' },
      inline: { title: 'Pipeline',        body: 'Fusion 360 → STEP → Blender retopo → KeyShot marketing. Will be swapped to a live render in the Dev cycle.' }
    },
    'flex-spine': {
      role: 'R&D',
      captions: [
        { label: 'Spine assembly',  desc: 'Kinematic spine placeholder. Parametric ribs driven by a single driver angle.' },
        { label: 'Rib section',     desc: 'Section-cut through one rib — thickness and fillet radii exposed as parameters.' },
        { label: 'Deflection test', desc: 'FEA sketch — deflection map under 50 N lateral load. Placeholder visualisation.' },
        { label: 'Joint detail',    desc: 'Ball-and-socket joint close-up. Tolerance stack-up listed in source PDF.' },
        { label: 'Render study',    desc: 'KeyShot pass — matte steel against cool grey backdrop.' }
      ],
      text:   { title: 'CAD placeholder', body: 'A kinematic-spine placeholder. The design is parametric: one driver angle bends every rib. Final model and stand renders are in progress.' },
      inline: { title: 'Parametrics',     body: 'Parameters: rib_count, rib_thickness, segment_angle. Linked via Fusion 360 sketches → exported to Blender.' }
    },
    'cad-strut': {
      role: 'R&D',
      captions: [
        { label: 'Node overview',  desc: 'Structural strut node placeholder. Six-way connector for space-frame assemblies.' },
        { label: 'Axis diagram',   desc: 'Load-path diagram — principal axes marked for the structural engineer.' },
        { label: 'Cross-section',  desc: 'Section through the central hub. Wall thickness and weld-prep highlighted.' },
        { label: 'Mount plate',    desc: 'Bolt-circle mount plate. Parametric — updates when strut diameter changes.' },
        { label: 'Surface finish', desc: 'KeyShot pass — powder-coated aluminium, matte warm grey.' }
      ],
      text:   { title: 'CAD placeholder', body: 'A structural strut node. Parametric CAD geometry: diameter, wall thickness and bolt pattern are linked. Final renders and game-ready topology are being prepared.' },
      inline: { title: 'Use case',        body: 'Used in space-frame prototypes. STEP is exported for CNC; Blender retopo for marketing renders.' }
    }
  };

  const CASE_LOCALES_RU = {
    'orbital-mk-ii': {
      role: 'Личный проект',
      captions: [
        { label: 'Hero-рендер',     desc: 'Sci-fi-проп для AAA-пайплайна. Полный PBR, чистая manifold-топология.' },
        { label: 'Тест-загрузка',   desc: 'Стенд-проверка загрузки иллюстрации, плейсхолдер.' },
        { label: 'Топология',       desc: '18k чистых quads. Subdivision-ready и LOD0-сертифицирован под real-time.' },
        { label: 'Крупный план',    desc: 'Макро шва панели. Bevel-радиусы рассчитаны под 2 м просмотра в 4K.' },
        { label: 'Финальный composite', desc: 'Свет: 3-точечный studio HDRI. Denoise через OptiX, тонмап ACES.' }
      ],
      text:   { title: 'Pipeline fit',      body: 'Доставлен как game-ready ассет: LOD0–LOD2 плюс отдельный cinematic-меш для маркетинговых рендеров. Naming и pivot-конвенции — под Unreal Engine 5.' },
      inline: { title: 'Texture budget',    body: 'Один 4K-сет для hero, отдельные 2K-сеты на каждый LOD. Roughness авторен в 16-bit — сохраняет микро-детализацию.' }
    },
    'vega-shell': {
      role: 'Личный проект',
      captions: [
        { label: 'Обзор системы',       desc: 'Модульный экзо-доспех из 47 отдельных деталей. Каждый сегмент отсоединяется под LOD и риг.' },
        { label: 'Разборка компонентов',desc: 'Логика парт-сетки выведена из реальных производственных констрейнтов. Без плавающей геометрии, чистые hard-edges.' },
        { label: 'LOD-пассы',           desc: 'LOD0–LOD2 подготовлены под 100%, 40% и 12% поли-бюджета для runtime mesh streaming.' },
        { label: 'Наплечник',           desc: 'Шарнирное крепление с лимитами, прописанными в naming. Готов к IK-retarget.' },
        { label: 'Вариант покраски',    desc: 'Три материальных пресета — factory clean, field-worn, arctic camo — через ID-маски.' }
      ],
      text:   { title: 'Зачем модульность', body: 'Каждая из 47 деталей может hot-swap-иться в рантайме — игроку доступна кастомизация. Каждый шов — это механическое сочленение, а не декаль на поверхности.' },
      inline: { title: 'Rigging ready',     body: 'У каждого сегмента — скрытый socket-bone. Ориентация суставов — по FBX-конвенциям, чтобы Maya/Blender ели без переделки.' }
    },
    'ironclad-frame': {
      role: 'R&D',
      captions: [
        { label: 'Полная сборка',        desc: 'Промышленное шасси в разборе. Каждый болт и шов — по инженерной спецификации.' },
        { label: 'Изоляция узла',        desc: 'Выделенный sub-assembly с подсветкой material ID. 24 поименованных меша.' },
        { label: 'Производственные ноты',desc: 'Аннотированный сет рендеров для инженерной команды — векторно-точный reference PDF.' },
        { label: 'Диаграмма нагрузок',   desc: 'Stress-path-оверлей собран в Blender Compositing из инженерного FEA-экспорта.' },
        { label: 'Варианты отделки',     desc: 'Powder-coat и raw-steel — рендеры под каталог и техническую документацию.' }
      ],
      text:   { title: 'Точность по чертежу', body: 'Смоделировано напрямую из инженерного CAD: каждое отверстие, головка болта и сварной шов совпадают с реальной деталью с точностью до 0.5 мм в полный масштаб.' },
      inline: { title: 'Бюджет веса',         body: 'До 28k tris на LOD0. Силуэт читается на 512 px. Камера первого лица проверена на дистанции 2 м и 6 м.' }
    },
    'corten-series': {
      role: 'Клиент',
      captions: [
        { label: 'Studio-рендер',    desc: 'Product viz для бренда промышленной мебели. Материал — corten-сталь, HDR-свет студии.' },
        { label: 'Context shot',     desc: 'In-situ рендер в бетонном лофте. Использован как lead-image launch-deck.' },
        { label: 'Material passes',  desc: 'Raw-metal база, rust gradient-пасс и clearcoat-вариация — под печать и web.' },
        { label: 'Detail macro',     desc: 'Крупный план текстуры: процедурная оксидация, патина, слои поверхностных дефектов.' },
        { label: 'Lineup-кадр',      desc: 'Вся коллекция собрана lineup-ом под разворот каталога. Свет соответствует AD-гайдам бренда.' }
      ],
      text:   { title: 'Материальный подход', body: 'Corten-оксидация процедурная, не нарисованная. Один material-graph рулит плотностью ржавчины, micro-pitting и потёками — каждый стул выглядит уникально, без повторяющихся текстур.' },
      inline: { title: 'Patina-система',      body: 'Ржавчина генерируется из curvature + AO-маски. Два слоя: оксид снизу, чешуйчатый отрыв сверху, roughness-сдвиг на каждом слое.' }
    },
    'lumen-one': {
      role: 'Клиент',
      captions: [
        { label: 'Финальный рендер',    desc: 'Архитектурный светильник. Фотореалистичный turntable под pitch-deck инвесторов.' },
        { label: 'Lighting setup',      desc: '3-точечный HDRI-риг с area-light fill. Каустики через path-tracing на 4096 сэмплов.' },
        { label: 'Spec sheet',          desc: 'Оверлей размерностей и material callout — собраны в Blender Compositing и Inkscape.' },
        { label: 'Context shot',        desc: 'Hero-кадр в современном офисе — ракурс утверждён клиентом.' },
        { label: 'Варианты отделки',    desc: 'Шесть finish-вариантов — brass, chrome, matte black, warm white — рендеры под catalogue-спрайты.' }
      ],
      text:   { title: 'Поведение света', body: 'Оптический корпус использует реальный IES-профиль, экспортированный из фотометрического теста клиента. Каустики и beam spread на камере соответствуют тому, что продукт даёт на физической стене.' },
      inline: { title: 'Модель света',    body: 'Filament-IES bakes управляют emissive intensity map. Внутренний рассеиватель — subsurface-приближение, без cheat-геометрии.' }
    },
    'flux-capsule': {
      role: 'R&D',
      captions: [
        { label: 'Product shot',     desc: 'Consumer-гаджет. E-commerce hero-кадр со studio HDRI и кастомным denoising.' },
        { label: 'Turntable 360°',   desc: 'Полная turntable-секвенция — 36 кадров с шагом 10°. Экспорт WebP sprite strip.' },
        { label: 'Detail macro',     desc: 'Пасс микро-текстуры. Субмиллиметровая детализация — virtual macro lens.' },
        { label: 'Упаковка',         desc: 'Рендер упаковки с reflective foil stamping, печать PBR metallic-clearcoat.' },
        { label: 'Scale-референс',   desc: 'Сравнение с рукой — передать размер без потери фотонейтрального фона.' }
      ],
      text:   { title: 'Готов к запуску', body: 'Все hero-ассеты доставлены как 6K master-рендеры плюс производные кропы под Shopify, Amazon и paid-social. Color-profile под brand Pantone.' },
      inline: { title: 'Containment',     body: 'Анимированный shader на ядре читает кастомный gradient-текстуру — без vertex morph, без sim-кеша. Идёт 240 FPS на mid-range GPU.' }
    },
    'nightshard': {
      role: 'Личный проект',
      captions: [
        { label: 'Финальный ассет',   desc: 'Hero-оружие под TPS-action. 4K PBR-текстуры, оптимизация под real-time.' },
        { label: 'Texture sheets',    desc: 'Albedo, roughness, metalness, normal и AO. Запечены с 8M-poly high-source.' },
        { label: 'Polycount',         desc: 'Game-ready меш на 12k tris — в бюджете под character-attachment LOD0.' },
        { label: 'In-engine тест',    desc: 'Live-capture в Unreal Engine 5: Nanite-disabled preview с Lumen.' },
        { label: 'Макро клинка',      desc: 'Пасс детализации сколов на кромке. Anisotropic reflection совпадает с reference кованой стали.' }
      ],
      text:   { title: 'Готов к gameplay', body: 'В поставке: socket-points, collision-примитивы и простой Blueprint-совместимый animation rig. Готов к импорту и attach к скелету персонажа из коробки.' },
      inline: { title: 'Преломление',      body: 'IOR 1.52 под lead crystal. Dispersion имитирован через 3-канальный UV-offset в посте.' }
    },
    'recon-drone': {
      role: 'Личный проект',
      captions: [
        { label: 'Готовая модель',    desc: 'Тактический UAV-проп. Game-ready tri-count, полная цепочка LOD0–LOD2 под UE5.' },
        { label: 'Exploded view',     desc: 'Разнесённые компоненты, distance-based transparency. Использован в pitch-deck.' },
        { label: 'Сравнение LOD',     desc: 'Side-by-side LOD0 (14k), LOD1 (5.6k), LOD2 (1.8k) — силуэт сохранён.' },
        { label: 'Анимация роторов',  desc: 'Цикл двойного винта запечён в меш. 120 fps луп под seamless idle.' },
        { label: 'Decal-библиотека',  desc: 'Набор из 12 модульных деколей (серийники, hazard tape, ID юнита) под кастомизацию отрядов.' }
      ],
      text:   { title: 'Интеграция в движок', body: 'Дрон поставляется с Unreal-ready Blueprint-актером, socket-points под антенну и gimbal, и material parameter collection — colorway-свопы без дублирования ассетов.' },
      inline: { title: 'Модульность',         body: 'Payload-отсек принимает 6 swappable-модулей. Каждый снапится через общий 3-pin коннектор — отдельный риг под каждый модуль не нужен.' }
    },
    'apex-frame': {
      role: 'Клиент',
      captions: [
        { label: 'Сборка',             desc: 'Разборка механического узла для инженерного заказчика. Точность по заводскому чертежу.' },
        { label: 'Деталь узла',        desc: 'Tolerance-callouts наложены на фотореалистичный рендер — для внутреннего design review.' },
        { label: 'Инженерный reference',desc: 'Аннотированный PDF и STEP-экспорт переданы напрямую производственному партнёру.' },
        { label: 'Stress-оверлей',     desc: 'FEA color-map скомпозирована на mesh-рендер — под pitch-deck для инвесторов.' },
        { label: 'Фото прототипа',     desc: 'Side-by-side рендера и обработанного прототипа. Геометрия совпадает в пределах допуска.' }
      ],
      text:   { title: 'Engineering-grade', body: 'Файлы экспортированы в полном масштабе 1:1 с реальными единицами. Все отверстия, резьбы и фаски совпадают с STEP-исходником, ушедшим на CNC-станок — без "на глаз".' },
      inline: { title: 'Impact geo',        body: 'Деформируемые зоны пластин предзалеплены в 5 стадий. Blend shapes гонят runtime damage без дополнительных draw calls.' }
    },
    'core-rig': {
      role: 'R&D',
      captions: [
        { label: 'Структурный вид',    desc: 'Прототип несущей сборки. Геометрия под 3D-печатную валидацию и утверждение форм-фактора.' },
        { label: 'Section cut',        desc: 'Cross-section рендер — экспонирует толщину внутренних стенок под проверку зазоров печати.' },
        { label: 'Валидация печати',   desc: 'Финальный меш прошёл Meshmixer-слайсер. Ноль ошибок, overhang-угол в допуске.' },
        { label: 'Support map',        desc: 'Предсказанные зоны поддержек подсвечены синим. Использовалось для итерации ориентации до слайсинга.' },
        { label: 'Fit-test',           desc: 'Сборка напечатанного прототипа с его mate-корпусом. Photogrammetry alignment check.' }
      ],
      text:   { title: 'Print-first', body: 'Геометрия смоделирована под FDM-констрейнты — правила 45° overhang, минимумы wall-thickness и bridging-лимиты — файл идёт прямо в слайсер без ручного ремонта.' },
      inline: { title: 'Joint library', body: 'Кастомный IK-handle с stretch-and-squash лимитами. Retarget на Mixamo и Mannequin из коробки.' }
    },
    'helix-reveal': {
      role: 'R&D',
      captions: [
        { label: 'Финальный кадр',     desc: 'Product reveal-анимация — 6-секундный луп, рендер под фон hero-секции.' },
        { label: 'Раскадровка',        desc: 'Beat sheet от руки перенесён на Blender timeline. 6 ключевых поз на 180 кадров.' },
        { label: 'Render settings',    desc: '4K @ 60 fps, Cycles path-trace, 512 сэмплов. Denoise OptiX. Экспорт ProRes 4444.' },
        { label: 'Движение камеры',    desc: 'Двухслойная parallax-камера — dolly-track плюс тонкий handheld noise для энергии.' },
        { label: 'Color grade',        desc: 'Teal-orange грейд в DaVinci Resolve — совпадает с палитрой brand launch-трейлера.' }
      ],
      text:   { title: 'Сделан под лупы', body: 'Каждая motion-кривая выстроена так, что последний кадр совпадает с первым. 6-секундный цикл играет вечно как hero-фон без заметного шва.' },
      inline: { title: 'Анимация',        body: '12-секундный луп на 24 FPS. DNA-helix раскручивается одним angle-driven шейдером — без арматуры, без bake.' }
    },
    'arc-motion': {
      role: 'R&D',
      captions: [
        { label: 'Orbit-кадр',          desc: 'Turntable-секвенция для индустриального продукта — орбита 360°, экспорт 4K с motion blur.' },
        { label: 'Lighting-пасс',       desc: '3-слойный HDRI-риг с gel-coloured area lights. Свет под brand-гайды.' },
        { label: 'Export-настройки',    desc: 'Доставлен как 4K MP4 (H.264), WebM (VP9) и отдельная PNG-секвенция под composit.' },
        { label: 'Motion blur',         desc: 'Per-object velocity-пасс рендерится отдельно — клиент может крутить blur amount в посте.' },
        { label: 'Compositing AOVs',    desc: 'Cryptomatte, depth, ID и position-пассы — гибкий relight в Nuke.' }
      ],
      text:   { title: 'Форматы доставки', body: 'Отгружено как мастер ProRes плюс H.264, WebM и image-sequence. Один тайминг, три контейнера — готов под web, печать и post-production пайплайны.' },
      inline: { title: 'Motion curves',    body: 'Кастомный ease-out-expo на главную дугу. Вторичные следы — bezier-сплайны на 60 FPS.' }
    },
    'nyx-panther': {
      role: 'Личный проект',
      captions: [
        { label: 'Поза в полный рост',  desc: 'Стилизованный хищник кошачьих. Скульптинг анатомии вручную, двухслойный грум меха, стилизованная мускулатура.' },
        { label: 'Fur-пасс',            desc: 'Двухслойный грум — подшёрсток + остевые волосы с процедурным клампингом и асимметрией.' },
        { label: 'Этюд головы',         desc: 'Скульптинг лица — ритм глаз и nasal break. Тонкие whisker-карты расставлены вручную.' },
        { label: 'Силуэтные карты',     desc: 'Библиотека из 6 action-силуэтов — лочили animation feel до начала ключей.' },
        { label: 'Анимация подкрадывания', desc: 'Looped prowl-цикл на 30 fps. Cloth-free скелет-меш — real-time preview во viewport.' }
      ],
      text:   { title: 'Идея персонажа', body: 'Спроектирован как нейтральный hero-крич для stealth-нарратива. Силуэт читается и в светлом, и в тёмном окружении, а грум меха чисто упрощается до real-time карт.' },
      inline: { title: 'Грум меха',      body: 'Двухслойная схема: guide hairs от руки, подшёрсток рассеян по density-маске. Грум экспортируется в Alembic на 1.2M сплайнов.' }
    },
    'drift-koi': {
      role: 'Личный проект',
      captions: [
        { label: 'Hero-рендер',     desc: 'Этюд декоративной рыбы. Displacement-чешуя, трёхслойный SSS-пасс.' },
        { label: 'Макро чешуи',     desc: 'Процедурный паттерн чешуи скульптурирован в ZBrush, ведётся curve-based UV-разверткой.' },
        { label: 'Этюд плавника',   desc: 'Thin-film интерференция на хвостовом плавнике. Двусторонний шейдер с anisotropic-highlights.' },
        { label: 'Swim-луп',        desc: 'Бесшовный 3-секундный цикл плавания, spline-риг. Готов под particle systems и аквариумы.' },
        { label: 'Варианты узора',  desc: 'Семь patterning-вариантов — Kohaku, Showa, Asagi и кастом — через mask blending.' }
      ],
      text:   { title: 'Органический shading', body: 'Чешуйчатый shader читается как мокрый, но не пластик. Комбинация displacement, anisotropic-highlight и мягкого subsurface держит поверхность даже под жёстким светом.' },
      inline: { title: 'Шейдер чешуи',         body: 'Иридесцентные чешуйки управляются fresnel × vertex color. Три варианта — koi red, shusui blue, asagi silver — переключаются через material ID.' }
    },
    'glint-owl': {
      role: 'Личный проект',
      captions: [
        { label: 'Портрет',          desc: 'Стилизованный птичий персонаж. Грум пера с процедурной асимметрией и wind drift.' },
        { label: 'Размах крыла',     desc: 'Полностью спозированное крыло — первичные и вторичные перья расставлены вручную на bone chain.' },
        { label: 'Feather cards',    desc: 'Texture-sheet из 40 индивидуальных feather-карт — для грума и LOD feather planes.' },
        { label: 'Клюв и когти',     desc: 'Hero keratin-шейдер — глянцевая микро-поверхность, тёплый subsurface — на клюве и когтях.' },
        { label: 'Силуэты',          desc: 'Восемь pose-силуэтов — лочили настрой до старта финального грум-пасса.' }
      ],
      text:   { title: 'Groom-система', body: 'Всё оперение управляется одним groom-модификатором с масками плотности, длины и клампинга. Правишь маску — обновляется каждое перо разом, без ручной расстановки.' },
      inline: { title: 'Слои перьев',   body: 'Перья тела грумлены по зонам: голова, грудь, primaries. Alpha-карты — на силуэт, shell-геометрия — на маховые перья.' }
    },
    'mech-link': {
      role: 'R&D',
      captions: [
        { label: 'Обзор сборки',     desc: 'Плейсхолдер промышленной link-цепи. Параметрическая pin-joint сборка из CAD.' },
        { label: 'Деталь кронштейна',desc: 'Крупный план bolt-pattern. Плейсхолдер-геометрия — финальный topology-пасс готовится.' },
        { label: 'Motion study',     desc: 'Скетч range-of-motion для pivoting-arm. Preview constraint-solver.' },
        { label: 'Exploded view',    desc: 'Диаграмма деталей под производственное планирование. Допуски размечены в исходном DWG.' },
        { label: 'Material preview', desc: 'KeyShot-пасс — brushed steel и anodized aluminium-сэмплы.' }
      ],
      text:   { title: 'CAD-плейсхолдер', body: 'Этот кейс — технологический плейсхолдер. Финальный GLB, топология и рендеры готовятся. Используется для проверки layout и фильтра CAD-категории.' },
      inline: { title: 'Pipeline',        body: 'Fusion 360 → STEP → Blender retopo → KeyShot marketing. В Dev-цикле заменяется live-рендером.' }
    },
    'flex-spine': {
      role: 'R&D',
      captions: [
        { label: 'Сборка позвоночника',desc: 'Плейсхолдер кинематической оси. Параметрические рёбра — управляются одним driver-углом.' },
        { label: 'Сечение ребра',      desc: 'Section-cut через одно ребро — толщина и радиусы фасок выведены как параметры.' },
        { label: 'Тест отклонения',    desc: 'FEA-скетч — deflection map под 50 N боковой нагрузки. Placeholder-визуализация.' },
        { label: 'Деталь сустава',     desc: 'Крупный план ball-and-socket. Tolerance stack-up расписан в исходном PDF.' },
        { label: 'Этюд рендера',       desc: 'KeyShot-пасс — matte-steel на cool-grey фоне.' }
      ],
      text:   { title: 'CAD-плейсхолдер', body: 'Кинематический позвоночник-плейсхолдер. Конструкция параметрическая: один управляющий угол гнёт все рёбра. Финальная модель и стенд-рендеры в процессе.' },
      inline: { title: 'Параметры',       body: 'Параметры: rib_count, rib_thickness, segment_angle. Связаны через Fusion 360 sketches → экспорт в Blender.' }
    },
    'cad-strut': {
      role: 'R&D',
      captions: [
        { label: 'Обзор узла',         desc: 'Плейсхолдер структурного strut-узла. Six-way коннектор под space-frame сборки.' },
        { label: 'Диаграмма осей',     desc: 'Load-path диаграмма — главные оси размечены для конструктора.' },
        { label: 'Cross-section',      desc: 'Сечение через центральный hub. Толщина стенок и weld-prep подсвечены.' },
        { label: 'Mount-плита',        desc: 'Bolt-circle mount-плита. Параметрическая — обновляется при смене диаметра strut.' },
        { label: 'Поверхностная отделка', desc: 'KeyShot-пасс — powder-coated aluminium, matte warm grey.' }
      ],
      text:   { title: 'CAD-плейсхолдер', body: 'Структурный strut-узел. Параметрическая CAD-геометрия: диаметр, толщина стенки и схема болтов связаны. Финальные рендеры и игровая топология готовятся.' },
      inline: { title: 'Use case',        body: 'Применяется в space-frame прототипах. STEP экспортируется для CNC, Blender-retopo — для marketing-рендеров.' }
    }
  };

  const CASE_LOCALES = { en: CASE_LOCALES_EN, ru: CASE_LOCALES_RU };

  // ── FA_LOCALES — каталог free-assets (Phase 3) ──────────────────────────
  //
  // Покрывает поле `desc` каждой записи в FA_DATA[category]. Поля:
  //   - title    — брэнд/имя ассета, не переводится (Orbital Mk.II,
  //                Bolt Cluster, Terra Base, Wraith Blade, Echo Shell etc).
  //   - cat      — англицизм (Hard Surface, Product Viz, Game Asset,
  //                Organic, Animation, CAD) — уже в UI_STRINGS.filter.*.
  //   - badge    — англицизм (Hard Surface, Mechanical, Product Viz, Game
  //                Asset, Organic, Animation, CAD).
  //   - contents — массив технических ярлыков (.blend / .fbx / 4K PBR /
  //                LOD 0–2 / GeoNodes / etc) — proff-сленг, не переводится.
  //   - size / file / bg / id — техническое, не переводится.
  //
  // Один dict[id] на каждый ассет — id в каталоге уникальны
  // (включая `-g` варианты для game-категории), плоская структура без
  // вложенности по category. На overlay i18n.js обходит все category-bucket'ы
  // FA_DATA и ищет item.id в FA_LOCALES[lang].
  const FA_LOCALES_EN = {
    'orbital-mk-ii':  { desc: 'Sci-fi prop engineered for AAA pipeline. Full PBR, clean topology.' },
    'vega-shell':     { desc: 'Modular exo-armor system — 47 parts. Snap-together assembly, clean UVs.' },
    'ironclad-frame': { desc: 'Industrial chassis breakdown. Every bolt and seam modeled to spec.' },
    'bolt-cluster':   { desc: 'Industrial fastener kit — 12 variants. Scatter-ready GeoNodes setup.' },
    'terra-base':     { desc: 'Modular environment kit — 24 tileable pieces. GeoNodes scatter system.' },
    'shard-cannon':   { desc: 'Sci-fi heavy weapon — three skin variations, UE5-compatible export.' },
    'wraith-blade':   { desc: 'Thin melee weapon with emissive edge glow texture variant included.' },
    'apex-frame':     { desc: 'Mechanical component breakdown. Exploded view rig. Mfg-reference accuracy.' },
    'corten-series':  { desc: 'Industrial furniture scene. HDRI + camera rigs for stills and turntable.' },
    'lumen-one':      { desc: 'Minimalist product scene. Cycles render with area lights and reflectors.' },
    'flux-capsule':   { desc: 'Consumer tech device — 8 camera angles, e-commerce shot set.' },
    'echo-shell':     { desc: 'Speaker product scene — three colorways, compositing nodes included.' },
    'prism-lab':      { desc: 'Architectural product viz — day and night lighting setups.' },
    'nightshard':     { desc: 'Hero weapon. 4K PBR textures, optimised for real-time. UE5-ready.' },
    'recon-drone':    { desc: 'Tactical UAV prop. LOD 0–2, UE5-compatible. Full PBR texture set.' },
    'wraith-blade-g': { desc: 'Thin melee weapon. High-poly bake, emissive edge glow variant.' },
    'shard-cannon-g': { desc: 'Sci-fi heavy weapon — three skin variations, UE5-compatible.' },
    'nyx-panther':    { desc: 'Stylized feline. Hand-sculpted anatomy, dual-coat fur groom. Rigged.' },
    'drift-koi':      { desc: 'Ornamental fish. SSS pass, displacement scales, swim cycle at 30fps.' },
    'glint-owl':      { desc: 'Stylized bird. Procedural feather asymmetry, idle animation rig.' },
    'helix-reveal':   { desc: 'Product reveal loop — 6 seconds. Camera path + keyframes fully editable.' },
    'arc-motion':     { desc: 'Turntable sequence — full 360° orbit, 4K export. Lighting customizable.' },
    'mech-link':      { desc: 'Industrial CAD assembly. Exported from Fusion 360, cleaned for Blender.' },
    'flex-spine':     { desc: 'Kinematic spine study. Parametric ribs — robotics and biomedical reference.' },
    'cad-strut':      { desc: 'Structural strut node system. Modular connectors, manufacturing docs.' }
  };
  const FA_LOCALES_RU = {
    'orbital-mk-ii':  { desc: 'Sci-fi-проп для AAA-пайплайна. Полный PBR, чистая топология.' },
    'vega-shell':     { desc: 'Модульный экзо-доспех — 47 деталей. Snap-сборка, чистые UV.' },
    'ironclad-frame': { desc: 'Промышленное шасси в разборе. Каждый болт и шов — по чертежу.' },
    'bolt-cluster':   { desc: 'Кит промышленного крепежа — 12 вариантов. Scatter-ready на GeoNodes.' },
    'terra-base':     { desc: 'Модульный environment-кит — 24 tileable-куска. GeoNodes scatter-система.' },
    'shard-cannon':   { desc: 'Sci-fi тяжёлое оружие — три варианта скина, экспорт под UE5.' },
    'wraith-blade':   { desc: 'Тонкое холодное оружие с вариантом эмиссивного свечения кромки.' },
    'apex-frame':     { desc: 'Разборка механического узла. Exploded view-риг. Точность по заводскому чертежу.' },
    'corten-series':  { desc: 'Сцена индустриальной мебели. HDRI и камерные риги под стиллы и turntable.' },
    'lumen-one':      { desc: 'Минималистичная product-сцена. Рендер в Cycles с area-lights и рефлекторами.' },
    'flux-capsule':   { desc: 'Consumer-гаджет — 8 ракурсов камеры, e-commerce-сет.' },
    'echo-shell':     { desc: 'Сцена со спикером — три colorway, compositing-ноды в комплекте.' },
    'prism-lab':      { desc: 'Архитектурный product viz — день/ночь lighting-сетапы.' },
    'nightshard':     { desc: 'Hero-оружие. 4K PBR-текстуры, оптимизация под real-time. UE5-ready.' },
    'recon-drone':    { desc: 'Тактический UAV-проп. LOD 0–2, под UE5. Полный сет PBR-текстур.' },
    'wraith-blade-g': { desc: 'Тонкое холодное оружие. Hi-poly bake, вариант эмиссивного свечения.' },
    'shard-cannon-g': { desc: 'Sci-fi тяжёлое оружие — три варианта скина, под UE5.' },
    'nyx-panther':    { desc: 'Стилизованный хищник кошачьих. Скульптинг анатомии, двухслойный грум меха. С ригом.' },
    'drift-koi':      { desc: 'Декоративная рыба. SSS-пасс, displacement-чешуя, swim-цикл на 30 fps.' },
    'glint-owl':      { desc: 'Стилизованная птица. Процедурная асимметрия перьев, idle-анимация на риге.' },
    'helix-reveal':   { desc: 'Product reveal-луп — 6 секунд. Путь камеры и ключи — редактируемые.' },
    'arc-motion':     { desc: 'Turntable-секвенция — орбита 360°, экспорт 4K. Свет настраиваемый.' },
    'mech-link':      { desc: 'Промышленная CAD-сборка. Экспорт из Fusion 360, причёсано для Blender.' },
    'flex-spine':     { desc: 'Этюд кинематической оси. Параметрические рёбра — reference для робототехники и biomed.' },
    'cad-strut':      { desc: 'Структурный strut-узел. Модульные коннекторы, производственная документация.' }
  };
  const FA_LOCALES = { en: FA_LOCALES_EN, ru: FA_LOCALES_RU };

  window.I18N_DATA = {
    CIS_COUNTRIES: CIS_COUNTRIES.slice(),
    UI_STRINGS: UI_STRINGS,
    META_STRINGS: META_STRINGS,
    CARDS_LOCALES: CARDS_LOCALES,
    CASE_LOCALES: CASE_LOCALES,
    FA_LOCALES: FA_LOCALES,
  };
})();
