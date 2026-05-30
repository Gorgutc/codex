/* ═══════════════════════════════════════════════════════════════════════
   MAIN JS — Codex Studio (v0.7.0)
   ─────────────────────────────────────────────────────────────────────
   - CARDS_DATA: каждый кейс содержит 5 медиа-блоков + 1 текст-блок.
     Базовая раскладка: 1 wide, 2 tall, 1 wide, 1 tall, 1 text.
     buildItems(id) детерминированно перемешивает этот массив через
     seeded shuffle (Mulberry32) — порядок уникален для каждого кейса,
     но стабилен между перезагрузками.
   - Game Assets — тогглится свитчем (#game-switch), независимо от тэгов.
   - Case back — кнопка "назад" в мобильном хедере (возврат к карточкам).
   - Лого в мобильном case-header — по клику сворачивает кейс.
═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════
     v0.16.0 — LENIS smooth scroll + GSAP ScrollTrigger integration
     ───────────────────────────────────────────────────────────────
     • Конфиг: duration 1.2 + custom easing (per ТЗ Phase_1).
       Lenis 1.1+: duration/lerp взаимоисключаемы — оставляем duration.
       smoothWheel:true (default). syncTouch не задаём → default false:
       touch-scroll нативный (pointer:coarse), wheel — сглажен Lenis-ом.
     • Интеграция: lenis.on('scroll', ScrollTrigger.update) + raf через
       gsap.ticker (единый rAF-loop). lagSmoothing(0) обязателен —
       иначе ScrollTrigger.update получает stale time после tab-hidden.
     • reduced-motion → init пропускается, остаётся native scroll.
     • Stopped пока case-view раскрыт (body.cards-collapsed) или
       .media-fs overlay открыт — там работает нативный scroll контента.
       Триггер: updateLenisState() из setCollapsed() и openFs/closeFs().
  ══════════════════════════════════════════════════════════════════ */
  var lenis = null;
  (function initLenis() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof Lenis === 'undefined' || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  })();

  function updateLenisState() {
    if (!lenis) return;
    var caseOpen = document.body.classList.contains('cards-collapsed');
    var fsOpen   = !!(fsOverlay && fsOverlay.classList.contains('is-open'));
    if (caseOpen || fsOpen) lenis.stop();
    else lenis.start();
  }

  /* ══════════════════════════════════════════════════════════════════
     v0.17.0 — PRELOADER with REAL asset-loading progress
     ───────────────────────────────────────────────────────────────
     • Tracks first 12 work-card SVGs via image.decode() (or load/error
       fallback) and tweens counter + bar via GSAP (0.4s, power2.out).
     • Soft timeout 2.5s → force-tween to 100%. After 4s — show SKIP.
     • Exit: hold 100% for 200ms, then clip-path inset(0 0 100% 0) +
       opacity 0 (duration 0.9, expo.inOut). On complete: overlay
       removed, html.is-loading cleared, Lenis state resynced.
     • prefers-reduced-motion → 50ms instant cut, no GSAP tweens.
  ══════════════════════════════════════════════════════════════════ */
  (function initPreloader() {
    var overlay = document.getElementById('preloader');
    if (!overlay) return;

    var html      = document.documentElement;
    var counterEl = overlay.querySelector('#preloader-counter');
    var barFill   = overlay.querySelector('#preloader-bar-fill');
    var tsEl      = overlay.querySelector('#preloader-ts');
    var skipBtn   = overlay.querySelector('#preloader-skip');
    var reduced   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Preloader holds page state — Lenis must be silent until cleanup.
    if (lenis) lenis.stop();

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function nowTs() {
      var d = new Date();
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    var tsInt = null;
    if (tsEl) {
      tsEl.textContent = nowTs();
      tsInt = setInterval(function () { tsEl.textContent = nowTs(); }, 1000);
    }

    var state = { progress: 0 };
    var lastShown = -1;
    var exited = false;
    var cleaned = false;
    var softTimer = null;
    var skipTimer = null;

    function renderProgress() {
      var p = Math.max(0, Math.min(100, Math.round(state.progress)));
      if (p === lastShown) return;
      lastShown = p;
      if (counterEl) counterEl.textContent = pad(p);
      if (barFill)   barFill.style.width = p + '%';
    }

    function tweenTo(target, onDone) {
      if (reduced || typeof gsap === 'undefined') {
        state.progress = target;
        renderProgress();
        if (onDone) onDone();
        return;
      }
      gsap.to(state, {
        progress: target,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: renderProgress,
        onComplete: onDone
      });
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (tsInt)     clearInterval(tsInt);
      if (softTimer) clearTimeout(softTimer);
      if (skipTimer) clearTimeout(skipTimer);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      html.classList.remove('is-loading');
      // Resume Lenis taking modal state into account.
      if (typeof updateLenisState === 'function') updateLenisState();
      document.dispatchEvent(new CustomEvent('codex:preloader-done'));
    }

    function exit() {
      if (exited) return;
      exited = true;
      tweenTo(100, function () {
        setTimeout(function () {
          if (reduced || typeof gsap === 'undefined') { cleanup(); return; }
          gsap.to(overlay, {
            clipPath: 'inset(0 0 100% 0)',
            opacity: 0,
            duration: 0.9,
            ease: 'expo.inOut',
            onComplete: cleanup
          });
        }, 200);
      });
    }

    if (reduced) {
      setTimeout(exit, 50);
      return;
    }

    function imgPromise(img) {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (typeof img.decode === 'function') return img.decode().catch(function () {});
      return new Promise(function (res) {
        img.addEventListener('load',  res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    }

    function startTracking() {
      var imgs = Array.prototype.slice.call(
        document.querySelectorAll('.work-card img')
      ).slice(0, 12);

      var total = imgs.length;
      if (total === 0) { tweenTo(100, function () { setTimeout(exit, 200); }); return; }

      var done = 0;
      var promises = imgs.map(function (img) {
        return imgPromise(img).then(function () {
          done++;
          tweenTo(Math.round((done / total) * 100));
        });
      });

      Promise.all(promises).then(function () {
        if (!exited) setTimeout(exit, 200);
      });

      // Soft timeout — force-finish if assets stall.
      softTimer = setTimeout(function () {
        if (!exited) exit();
      }, 2500);

      // SKIP affordance at 4s — only if user is still here.
      skipTimer = setTimeout(function () {
        if (!exited && skipBtn) {
          skipBtn.hidden = false;
          // Force reflow so transition triggers from hidden → visible.
          void skipBtn.offsetWidth;
          skipBtn.classList.add('is-visible');
        }
      }, 4000);

      if (skipBtn) skipBtn.addEventListener('click', exit, { once: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startTracking, { once: true });
    } else {
      startTracking();
    }
  })();

  /* ══════════════════════════════════════════════════════════════════
     CARDS_DATA — Как добавить / заменить иллюстрации:
     ───────────────────────────────────────────────────────────────
     Каждый кейс = массив items из 6 блоков:
       • 3 wide-иллюстрации
       • 2 tall-иллюстрации
       • 1 text-блок (заголовок + подзаголовок, без изображения)
     Файлы иллюстраций лежат в ./assets/cases/<id>/01..05.svg.
     Замени файлы с тем же именем — и картинки обновятся.

     Для видео-блока: добавь item { type: 'video', format: 'wide'|'tall',
       src: '...mp4', poster: '...jpg', enabled: true/false, label, desc }
  ══════════════════════════════════════════════════════════════════ */

  /* ────────────────────────────────
     Утилита-генератор 6-блочной схемы для каждого кейса.
     cfg = { id, bg1, bg2, palette: [5 bg-градиентов], captions: [5×{label,desc}], text: {title, body} }
  ──────────────────────────────── */
  function makeItems(cfg) {
    // v0.8 — возвращаем { media: [5], text, inline }.
    // buildItems() позже соберёт это в rows с учётом seeded shuffle.
    // Структура media: 2 wide + 3 tall. text-блок идёт первым (intro),
    // inline — опциональный текст рядом с одной из tall-иллюстраций.
    var media = [
      { type: 'image', format: 'wide', src: './assets/cases/' + cfg.id + '/01.svg' },
      { type: 'image', format: 'tall', src: './assets/cases/' + cfg.id + '/02.svg' },
      { type: 'image', format: 'tall', src: './assets/cases/' + cfg.id + '/03.svg' },
      { type: 'image', format: 'wide', src: './assets/cases/' + cfg.id + '/04.svg' },
      { type: 'image', format: 'tall', src: './assets/cases/' + cfg.id + '/05.svg' }
    ];
    for (var i = 0; i < 5; i++) {
      if (cfg.srcs && cfg.srcs[i]) media[i].src = cfg.srcs[i];
      media[i].bg      = cfg.palette[i];
      media[i].label   = cfg.captions[i].label;
      media[i].desc    = cfg.captions[i].desc;
      media[i].enabled = true;
    }
    return {
      media:  media,
      text:   cfg.text   || null,
      inline: cfg.inline || null
    };
  }

  /* ════════════════════════════════════════
     CARDS_DATA
  ════════════════════════════════════════ */
  var CARDS_DATA = {
    'orbital-mk-ii': { role: 'Personal', tools: ['Blender', 'Substance Painter', 'Marmoset'], modelSrc: './assets/models/experimental/dino.glb', modelEnvironment: 'studio', modelExposure: 1.05, modelStats: { triangles: 'Draco compressed', vertices: 'GLB embedded', materials: 1, textures: '3 embedded', software: 'Drive test asset' }, items: makeItems({
      id: 'orbital-mk-ii',
      palette: [
        'linear-gradient(135deg,#1e2d3d 0%,#2a3a4a 100%)',
        'linear-gradient(135deg,#1a2535 0%,#22303f 100%)',
        'linear-gradient(135deg,#152030 0%,#1e2c3c 100%)',
        'linear-gradient(135deg,#112030 0%,#1a2c3c 100%)',
        'linear-gradient(135deg,#0e1a28 0%,#182636 100%)'
      ],
      srcs: [null, './assets/cases/orbital-mk-ii/02.png', null, null, null],
      captions: [
        { label: 'Hero render',         desc: 'Sci-fi prop engineered for AAA pipeline. Full PBR, clean manifold topology.' },
        { label: 'Material study',      desc: 'Secondary shell finish under studio HDRI, checked for silhouette readability.' },
        { label: 'Topology pass',       desc: '18 k clean quads. Subdivision-ready and LOD0-certified for real-time integration.' },
        { label: 'Detail close-up',     desc: 'Panel seam macro. Bevel widths tuned for 2 m viewing distance at 4 K resolution.' },
        { label: 'Final composite',     desc: 'Lit with 3-point studio HDRI. Denoised in OptiX, tonemapped ACES.' }
      ],
      text: {
        title: 'Pipeline fit',
        body:  'Delivered as a game-ready asset with LOD0–LOD2 and a separate cinematic mesh for marketing renders. Naming and pivot conventions follow Unreal Engine 5 standards.'
      },
      inline: {
        title: 'Texture budget',
        body:  'Single 4 K texture set for hero, separate 2 K sets per LOD stage. Roughness authored in 16-bit to preserve micro-detail.'
      }
    }) },

    'vega-shell': { role: 'Personal', tools: ['Blender', 'ZBrush', 'Substance Painter'], modelSrc: './assets/models/experimental/humanoid-2.glb', modelEnvironment: 'studio', modelExposure: 1.05, modelStats: { triangles: 'Meshopt compressed', vertices: 'GLB embedded', materials: 1, textures: '2 KTX2', software: 'Drive test asset' }, items: makeItems({
      id: 'vega-shell',
      palette: [
        'linear-gradient(135deg,#1a2030 0%,#252e40 100%)',
        'linear-gradient(135deg,#161c2e 0%,#20283c 100%)',
        'linear-gradient(135deg,#111828 0%,#1a2234 100%)',
        'linear-gradient(135deg,#0d1422 0%,#161e2e 100%)',
        'linear-gradient(135deg,#0b1220 0%,#141c2a 100%)'
      ],
      captions: [
        { label: 'System overview',     desc: 'Modular exo-armor built from 47 individual pieces. Each segment detaches for LOD and rigging.' },
        { label: 'Component breakdown', desc: 'Parting logic derived from real manufacturing constraints. No floating geo, clean hard-edges.' },
        { label: 'LOD passes',          desc: 'LOD0–LOD2 prepared at 100 %, 40 % and 12 % poly budgets for runtime mesh streaming.' },
        { label: 'Shoulder plate',      desc: 'Ball-joint attachment with limit constraints baked into naming. Ready for IK retarget.' },
        { label: 'Paint variant',       desc: 'Three material presets — factory clean, field-worn, arctic camo — via ID-mask layering.' }
      ],
      text: {
        title: 'Why modularity',
        body:  'Each of the 47 parts can be hot-swapped at runtime to support player customisation. Every seam has been modelled as a mechanical connection rather than a floating surface decal.'
      },
      inline: {
        title: 'Rigging ready',
        body:  'Each segment carries a hidden socket bone. Joint orientation follows FBX conventions for seamless Maya/Blender export.'
      }
    }) },

    'ironclad-frame': { role: 'R&D', tools: ['Blender', 'CAD import', 'Inkscape'], modelSrc: './assets/models/experimental/car-paint.glb', modelEnvironment: 'studio', modelExposure: 1.05, modelStats: { triangles: 'Draco compressed', vertices: 'GLB embedded', materials: 1, textures: '3 embedded', software: 'Drive test asset' }, items: makeItems({
      id: 'ironclad-frame',
      palette: [
        'linear-gradient(135deg,#1c2428 0%,#28343a 100%)',
        'linear-gradient(135deg,#181e22 0%,#222e34 100%)',
        'linear-gradient(135deg,#141a1e 0%,#1c2830 100%)',
        'linear-gradient(135deg,#10161a 0%,#18242c 100%)',
        'linear-gradient(135deg,#0c1216 0%,#141e26 100%)'
      ],
      captions: [
        { label: 'Full assembly',     desc: 'Industrial chassis breakdown. Every bolt and seam modeled to engineering specification.' },
        { label: 'Part isolation',    desc: 'Selected sub-assembly with material IDs highlighted. 24 individually named mesh objects.' },
        { label: 'Production notes',  desc: 'Annotated render set delivered to engineering team as vector-accurate reference PDF.' },
        { label: 'Load diagram',      desc: 'Stress-path overlay generated in Blender Compositing from engineering FEA export.' },
        { label: 'Finish variants',   desc: 'Powder-coat and raw-steel renders delivered for catalogue and technical documentation.' }
      ],
      text: {
        title: 'Reference accuracy',
        body:  'Modelled directly from issued engineering CAD — every hole pattern, bolt head and weld bead matches the real part to within 0.5 mm at full scale.'
      },
      inline: {
        title: 'Weight target',
        body:  'Under 28 k tris at LOD0. Silhouette readable at 512 px. First-person camera tested at 2 m and 6 m focal distance.'
      }
    }) },

    'corten-series': { role: 'Client', tools: ['Blender', 'Substance Painter', 'DaVinci Resolve'], modelSrc: './assets/models/corten-series.glb', modelStats: { triangles: '60', vertices: '40', materials: 1, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
      id: 'corten-series',
      palette: [
        'linear-gradient(135deg,#2a2018 0%,#3a2e22 100%)',
        'linear-gradient(135deg,#241a14 0%,#34281e 100%)',
        'linear-gradient(135deg,#1e1410 0%,#2c2018 100%)',
        'linear-gradient(135deg,#180e0a 0%,#281c12 100%)',
        'linear-gradient(135deg,#120a08 0%,#20150e 100%)'
      ],
      captions: [
        { label: 'Studio render',    desc: 'Product viz for an industrial furniture brand. Corten steel material, HDR studio lighting.' },
        { label: 'Context shot',     desc: 'In-situ placement render in a concrete loft environment. Used as lead image for the launch deck.' },
        { label: 'Material passes',  desc: 'Raw metal base, rust gradient pass, and clearcoat variation delivered for print and web.' },
        { label: 'Detail macro',     desc: 'Texture close-up showing procedural oxidation, patina and surface imperfection layers.' },
        { label: 'Lineup shot',      desc: 'Full collection rendered as a lineup for the catalogue spread. Lighting matches brand art direction.' }
      ],
      text: {
        title: 'Material approach',
        body:  'The Corten oxidation is procedural, not painted. A single material graph drives rust density, micro-pitting and runoff stains — each chair variant reads as a unique piece without repeating textures.'
      },
      inline: {
        title: 'Patina system',
        body:  'Rust generated from curvature + ambient occlusion masks. Two layers: oxide underneath, flake breakup on top, roughness offset per layer.'
      }
    }) },

    'lumen-one': { role: 'Client', tools: ['Blender', 'Inkscape'], modelSrc: './assets/models/lumen-one.glb', modelStats: { triangles: '1,352', vertices: '690', materials: 1, textures: '1 × 2 K', software: 'Blender + Substance' }, items: makeItems({
      id: 'lumen-one',
      palette: [
        'linear-gradient(135deg,#1e2428 0%,#2c3640 100%)',
        'linear-gradient(135deg,#1a2024 0%,#28303c 100%)',
        'linear-gradient(135deg,#161c20 0%,#222c38 100%)',
        'linear-gradient(135deg,#11181c 0%,#1c2832 100%)',
        'linear-gradient(135deg,#0c1418 0%,#18242e 100%)'
      ],
      captions: [
        { label: 'Final render',    desc: 'Architectural lighting unit. Photorealistic turntable deliverable for investor pitch deck.' },
        { label: 'Lighting setup',  desc: '3-point HDRI rig with area light fill. Caustics rendered via path-tracing at 4096 samples.' },
        { label: 'Spec sheet',      desc: 'Dimension overlay and material callout sheet generated in Blender Compositing and Inkscape.' },
        { label: 'Context shot',    desc: 'Hero placement in a modern office environment, shot from client-approved camera angle.' },
        { label: 'Colour variants', desc: 'Six finish variants — brass, chrome, matte black, warm white — rendered as catalogue sprites.' }
      ],
      text: {
        title: 'Light behaviour',
        body:  'The optical housing uses a real IES profile exported from the client\u2019s photometric test. Caustics and beam spread on camera match what the product produces on a physical wall.'
      },
      inline: {
        title: 'Light model',
        body:  'Filament IES bakes drive the emissive intensity map. Inner diffuser scatters via subsurface approximation — no cheat geometry.'
      }
    }) },

    'flux-capsule': { role: 'R&D', tools: ['Blender', 'Substance Painter'], modelSrc: './assets/models/flux-capsule.glb', modelStats: { triangles: '608', vertices: '312', materials: 3, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
      id: 'flux-capsule',
      palette: [
        'linear-gradient(135deg,#1e2030 0%,#282a40 100%)',
        'linear-gradient(135deg,#1a1c2c 0%,#24263c 100%)',
        'linear-gradient(135deg,#161828 0%,#202234 100%)',
        'linear-gradient(135deg,#12142a 0%,#1c1e30 100%)',
        'linear-gradient(135deg,#0e102a 0%,#181a2a 100%)'
      ],
      captions: [
        { label: 'Product shot',    desc: 'Consumer tech device. E-commerce hero shot with studio HDRI and custom denoising.' },
        { label: '360° view',       desc: 'Full turntable sequence — 36 frames at 10° increments. Exported as WebP sprite strip.' },
        { label: 'Detail macro',    desc: 'Micro-surface texture pass. Sub-millimetre detail captured with a virtual macro lens rig.' },
        { label: 'Packaging',       desc: 'Retail box render with reflective foil stamping, printed using PBR metallic-clearcoat.' },
        { label: 'Scale ref',       desc: 'Hand comparison render to communicate size without breaking photo-neutral background.' }
      ],
      text: {
        title: 'Launch ready',
        body:  'All hero assets were delivered as 6 K master renders plus derivative crops for Shopify, Amazon and paid-social ad placements. Colour profile matches the brand Pantone book.'
      },
      inline: {
        title: 'Containment',
        body:  'Animated shader on the core reads a custom gradient texture — no vertex morph, no simulation cache. Runs at 240 FPS on mid-range GPUs.'
      }
    }) },

    'nightshard': { role: 'Personal', tools: ['Blender', 'Substance Painter', 'UE5'], modelSrc: './assets/models/nightshard.glb', modelStats: { triangles: '15,488', vertices: '8,000', materials: 1, textures: '5 × 4 K', software: 'Blender + Substance' }, items: makeItems({
      id: 'nightshard',
      palette: [
        'linear-gradient(135deg,#1a1a2a 0%,#252535 100%)',
        'linear-gradient(135deg,#161624 0%,#202030 100%)',
        'linear-gradient(135deg,#121220 0%,#1c1c2c 100%)',
        'linear-gradient(135deg,#0e0e1c 0%,#181828 100%)',
        'linear-gradient(135deg,#0a0a18 0%,#161626 100%)'
      ],
      captions: [
        { label: 'Final asset',    desc: 'Hero weapon for a third-person action title. 4K PBR textures, optimised for real-time.' },
        { label: 'Texture sheets', desc: 'Albedo, roughness, metalness, normal and AO maps. Baked from 8M-poly high source.' },
        { label: 'Polycount view', desc: 'Game-ready mesh at 12 k triangles — within budget for character-attachment LOD0.' },
        { label: 'In-engine test', desc: 'Live capture inside Unreal Engine 5 using Nanite-disabled preview with Lumen.' },
        { label: 'Blade macro',    desc: 'Edge chip detail pass. Anisotropic reflection matches reference from real forged steel.' }
      ],
      text: {
        title: 'Ready for gameplay',
        body:  'Socket points, collision primitives and a simple Blueprint-compatible animation rig are included in the deliverable. Ready to be imported and attached to a character skeleton on arrival.'
      },
      inline: {
        title: 'Refraction',
        body:  'Index of refraction tuned to 1.52 for lead crystal. Dispersion faked with a three-channel UV offset in post.'
      }
    }) },

    'recon-drone': { role: 'Personal', tools: ['Blender', 'Substance Painter', 'UE5'], modelSrc: './assets/models/recon-drone.glb', modelStats: { triangles: '496', vertices: '266', materials: 3, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
      id: 'recon-drone',
      palette: [
        'linear-gradient(135deg,#1c2030 0%,#28303e 100%)',
        'linear-gradient(135deg,#181c2a 0%,#242c38 100%)',
        'linear-gradient(135deg,#141828 0%,#202834 100%)',
        'linear-gradient(135deg,#101424 0%,#1c2430 100%)',
        'linear-gradient(135deg,#0c1020 0%,#181e2c 100%)'
      ],
      captions: [
        { label: 'Completed model', desc: 'Tactical UAV prop. Game-ready tri count with full LOD0–LOD2 chain for UE5.' },
        { label: 'Exploded view',   desc: 'Separated components rendered with distance-based transparency. Used in pitch deck.' },
        { label: 'LOD comparison',  desc: 'Side-by-side LOD0 (14 k), LOD1 (5.6 k) and LOD2 (1.8 k) with silhouette preservation.' },
        { label: 'Rotor animation', desc: 'Dual-blade rotor cycle baked into mesh. 120 fps loop for seamless idle state.' },
        { label: 'Decal library',   desc: 'Set of 12 modular decals (serials, hazard tape, unit IDs) for squad personalisation.' }
      ],
      text: {
        title: 'Engine-side integration',
        body:  'The drone ships with an Unreal-ready Blueprint actor, socket points for the antenna and gimbal, and a material parameter collection for easy colourway swaps without duplicating assets.'
      },
      inline: {
        title: 'Modularity',
        body:  'Payload bay accepts 6 swappable modules. Each snaps via a shared 3-pin connector — no per-module rigging required.'
      }
    }) },

    'apex-frame': { role: 'Client', tools: ['Blender', 'CAD export', 'Inkscape'], modelSrc: './assets/models/apex-frame.glb', modelStats: { triangles: '12,200', vertices: '6,300', materials: 4, textures: '4 × 2 K', software: 'ZBrush + Blender' }, items: makeItems({
      id: 'apex-frame',
      palette: [
        'linear-gradient(135deg,#202428 0%,#2c3034 100%)',
        'linear-gradient(135deg,#1c2024 0%,#282c30 100%)',
        'linear-gradient(135deg,#181c20 0%,#24282c 100%)',
        'linear-gradient(135deg,#14181c 0%,#202428 100%)',
        'linear-gradient(135deg,#101418 0%,#1c2024 100%)'
      ],
      captions: [
        { label: 'Assembly render',    desc: 'Mechanical component breakdown for engineering client. Manufacturing-reference accuracy.' },
        { label: 'Component detail',   desc: 'Tolerance callouts overlaid on photorealistic render for internal design review.' },
        { label: 'Engineering ref',    desc: 'Annotated PDF and STEP export handed off directly to manufacturing partner.' },
        { label: 'Stress overlay',     desc: 'FEA colour map composited onto mesh render for pitch deck to investors.' },
        { label: 'Prototype photo',    desc: 'Side-by-side of render and machined prototype. Geometry lines up within tolerance.' }
      ],
      text: {
        title: 'Engineering-grade',
        body:  'Files were exported at full 1:1 scale with real-world units baked in. All holes, threads and fillets match the STEP source that went to the CNC shop — nothing is "eyeballed".'
      },
      inline: {
        title: 'Impact geo',
        body:  'Deformable plate zones pre-sculpted in 5 stages. Blend shapes drive runtime damage without additional draw calls.'
      }
    }) },

    'core-rig': { role: 'R&D', tools: ['Blender', 'Meshmixer', 'Cura'], modelSrc: './assets/models/core-rig.glb', modelStats: { triangles: '464', vertices: '240', materials: 2, textures: 'Procedural (PBR)', software: 'Blender + Fusion 360' }, items: makeItems({
      id: 'core-rig',
      palette: [
        'linear-gradient(135deg,#1e2830 0%,#28363e 100%)',
        'linear-gradient(135deg,#1a2428 0%,#24303a 100%)',
        'linear-gradient(135deg,#161e24 0%,#202c34 100%)',
        'linear-gradient(135deg,#121a20 0%,#1c2830 100%)',
        'linear-gradient(135deg,#0e161c 0%,#18242c 100%)'
      ],
      captions: [
        { label: 'Structural view', desc: 'Structural assembly prototype modeled for 3D-print validation and form-factor approval.' },
        { label: 'Section cut',     desc: 'Cross-section render exposing interior wall thickness for print clearance verification.' },
        { label: 'Print validation',desc: 'Final mesh passed through Meshmixer slicer. Zero errors, overhang angle within tolerance.' },
        { label: 'Support map',     desc: 'Predicted support regions overlaid in blue. Used to iterate the orientation before slicing.' },
        { label: 'Fit test render', desc: 'Assembly of the printed prototype with its mating housing. Photogrammetry alignment check.' }
      ],
      text: {
        title: 'Print-first design',
        body:  'The geometry is modelled around FDM constraints — 45° overhang rules, wall-thickness minimums and bridging limits — so the file can go straight to a slicer without manual repair.'
      },
      inline: {
        title: 'Joint library',
        body:  'Custom IK handle with stretch-and-squash limits. Retargets to Mixamo and Mannequin out of the box.'
      }
    }) },

    'helix-reveal': { role: 'R&D', tools: ['Blender', 'DaVinci Resolve'], modelSrc: './assets/models/helix-reveal.glb', modelStats: { triangles: '168', vertices: '112', materials: 1, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
      id: 'helix-reveal',
      palette: [
        'linear-gradient(135deg,#1a2233 0%,#26304a 100%)',
        'linear-gradient(135deg,#161e2e 0%,#222c44 100%)',
        'linear-gradient(135deg,#121a28 0%,#1e283e 100%)',
        'linear-gradient(135deg,#0e1624 0%,#182238 100%)',
        'linear-gradient(135deg,#0a1220 0%,#141e30 100%)'
      ],
      captions: [
        { label: 'Final frame',     desc: 'Product reveal animation — 6-second loop rendered for a hero section background.' },
        { label: 'Storyboard',      desc: 'Hand-drawn beat sheet translated to Blender timeline. 6 key poses over 180 frames.' },
        { label: 'Render settings', desc: '4K @ 60 fps, Cycles path-trace, 512 samples. Denoised in OptiX. Exported as ProRes 4444.' },
        { label: 'Camera moves',    desc: 'Two-layer parallax camera setup — dolly track plus subtle handheld noise for energy.' },
        { label: 'Colour grade',    desc: 'Teal-orange grade applied in DaVinci Resolve. Matches the brand launch trailer palette.' }
      ],
      text: {
        title: 'Built for loops',
        body:  'Every motion curve is shaped so the last frame matches the first. The 6-second cycle can play forever as a hero background without a visible cut.'
      },
      inline: {
        title: 'Animation',
        body:  '12-second loop at 24 FPS. DNA helix unwinds via a single angle-driven shader — no armature, no bake.'
      }
    }) },

    'arc-motion': { role: 'R&D', tools: ['Blender', 'DaVinci Resolve', 'Nuke'], modelSrc: './assets/models/arc-motion.glb', modelStats: { triangles: '1,856', vertices: '930', materials: 2, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
      id: 'arc-motion',
      palette: [
        'linear-gradient(135deg,#1f1a2a 0%,#2a2438 100%)',
        'linear-gradient(135deg,#1b1626 0%,#262034 100%)',
        'linear-gradient(135deg,#171222 0%,#221e30 100%)',
        'linear-gradient(135deg,#130e1e 0%,#1e1a2c 100%)',
        'linear-gradient(135deg,#0f0a1a 0%,#181428 100%)'
      ],
      captions: [
        { label: 'Orbit frame',      desc: 'Turntable sequence for industrial product — 360° orbit, 4K export with motion blur.' },
        { label: 'Lighting pass',    desc: '3-layer HDRI rig with gel-coloured area lights. Lighting designed to match brand guidelines.' },
        { label: 'Export settings',  desc: 'Delivered as 4K MP4 (H.264), WebM (VP9), and individual PNG sequence for compositing.' },
        { label: 'Motion blur',      desc: 'Per-object velocity pass rendered separately so the client can tune blur amount in post.' },
        { label: 'Compositing AOVs', desc: 'Cryptomatte, depth, ID and position passes delivered for flexible relight in Nuke.' }
      ],
      text: {
        title: 'Delivery formats',
        body:  'Shipped as a master ProRes file plus H.264, WebM and an image sequence. Same timing, three containers — ready for web, print and post-production pipelines.'
      },
      inline: {
        title: 'Motion curves',
        body:  'Custom ease-out-expo for the main arc. Secondary trails use bezier splines sampled at 60 FPS.'
      }
    }) },

    /* ═══════════════════════════════
       ORGANIC — v0.7.0
    ═══════════════════════════════ */
    'nyx-panther': { role: 'Personal', tools: ['ZBrush', 'Blender', 'XGen'], modelSrc: './assets/models/nyx-panther.glb', modelStats: { triangles: '1,352', vertices: '690', materials: 1, textures: '1 × 2 K', software: 'ZBrush + Blender' }, items: makeItems({
      id: 'nyx-panther',
      palette: [
        'linear-gradient(135deg,#1a1816 0%,#2a2520 100%)',
        'linear-gradient(135deg,#161411 0%,#241f1a 100%)',
        'linear-gradient(135deg,#12100e 0%,#1e1a16 100%)',
        'linear-gradient(135deg,#0e0c0a 0%,#181614 100%)',
        'linear-gradient(135deg,#0a0908 0%,#141210 100%)'
      ],
      captions: [
        { label: 'Full body pose',    desc: 'Stylized feline creature. Hand-sculpted anatomy, two-coat fur groom, stylised musculature.' },
        { label: 'Fur pass',          desc: 'Dual-layer fur groom — undercoat + guard hairs with procedural clumping and asymmetry.' },
        { label: 'Head study',        desc: 'Facial sculpt focused on eye rhythm and nasal break. Fine whisker cards placed manually.' },
        { label: 'Silhouette cards',  desc: 'Action pose library with 6 silhouettes used to lock animation feel before keyframing.' },
        { label: 'Prowl animation',   desc: 'Looped prowl cycle at 30 fps. Cloth-free skeleton mesh for real-time preview in viewport.' }
      ],
      text: {
        title: 'Character intent',
        body:  'Designed as a neutral hero creature for a stealth-focused narrative. Silhouette reads in both light and dark environments, and the fur groom simplifies cleanly to real-time cards.'
      },
      inline: {
        title: 'Fur grooming',
        body:  'Dual-coat setup: guide hairs hand-sculpted, undercoat scattered via density map. Groom exports to Alembic at 1.2 M splines.'
      }
    }) },

    'drift-koi': { role: 'Personal', tools: ['ZBrush', 'Blender', 'Substance Painter'], modelSrc: './assets/models/drift-koi.glb', modelStats: { triangles: '168', vertices: '112', materials: 1, textures: 'Procedural (PBR)', software: 'ZBrush + Blender' }, items: makeItems({
      id: 'drift-koi',
      palette: [
        'linear-gradient(135deg,#161e24 0%,#1f2a34 100%)',
        'linear-gradient(135deg,#121a20 0%,#1a2630 100%)',
        'linear-gradient(135deg,#0e161c 0%,#18222c 100%)',
        'linear-gradient(135deg,#0b1218 0%,#141e28 100%)',
        'linear-gradient(135deg,#080f14 0%,#101a24 100%)'
      ],
      captions: [
        { label: 'Hero render',    desc: 'Ornamental fish study. Displacement scales, three-layer subsurface scattering pass.' },
        { label: 'Scale macro',    desc: 'Procedural scale pattern sculpted in ZBrush and driven by a curve-based UV layout.' },
        { label: 'Fin study',      desc: 'Thin-film interference on the tail fin. Double-sided shader with anisotropic highlights.' },
        { label: 'Swim loop',      desc: 'Seamless 3-second swim cycle driven by a spline rig. Ready for particle systems and aquariums.' },
        { label: 'Variant pattern',desc: 'Seven patterning variants — Kohaku, Showa, Asagi and custom — via mask blending.' }
      ],
      text: {
        title: 'Organic shading',
        body:  'The scale shader reads as wet without looking plastic. A combination of displacement, anisotropic highlight and soft subsurface response keeps the surface grounded even under harsh lighting.'
      },
      inline: {
        title: 'Scale shader',
        body:  'Iridescent scales driven by fresnel × vertex color. Three variants — koi red, shusui blue, asagi silver — toggle via material ID.'
      }
    }) },

    'glint-owl': { role: 'Personal', tools: ['ZBrush', 'Blender', 'Houdini groom'], modelSrc: './assets/models/glint-owl.glb', modelStats: { triangles: '496', vertices: '266', materials: 3, textures: 'Procedural (PBR)', software: 'ZBrush + Blender' }, items: makeItems({
      id: 'glint-owl',
      palette: [
        'linear-gradient(135deg,#1a1a22 0%,#262632 100%)',
        'linear-gradient(135deg,#16161e 0%,#20202c 100%)',
        'linear-gradient(135deg,#12121a 0%,#1a1a26 100%)',
        'linear-gradient(135deg,#0e0e16 0%,#161620 100%)',
        'linear-gradient(135deg,#0a0a12 0%,#12121c 100%)'
      ],
      captions: [
        { label: 'Portrait render',   desc: 'Stylized bird character. Feather grooming with procedural asymmetry and wind drift.' },
        { label: 'Wing spread',       desc: 'Fully posed flight wing with hand-placed primaries and secondaries on a bone chain.' },
        { label: 'Feather cards',     desc: 'Texture sheet of 40 individual feather cards used by the groom and LOD feather planes.' },
        { label: 'Beak & talon',      desc: 'Hero keratin shader — glossy micro-surface, warm subsurface — applied to beak and talons.' },
        { label: 'Silhouette lineup', desc: 'Eight pose silhouettes used to lock mood before the final groom pass was started.' }
      ],
      text: {
        title: 'Groom system',
        body:  'The entire plumage is driven by one groom modifier with density, length and clumping masks. Editing the mask updates every feather at once — no hand-placing individual strands.'
      },
      inline: {
        title: 'Feather layers',
        body:  'Body feathers groomed per zone: head, chest, primaries. Alpha-cards for silhouette, shell geometry for flight feathers.'
      }
    }) },

    /* ── CAD studies (v0.14.0 [15a]) — промышленная серо-синяя палитра ── */
    'mech-link': { role: 'R&D', tools: ['Fusion 360', 'Blender', 'KeyShot'], modelSrc: './assets/models/mech-link.glb', modelStats: { triangles: '512', vertices: '264', materials: 2, textures: 'Procedural (PBR)', software: 'Fusion 360 + Blender' }, items: makeItems({
      id: 'mech-link',
      palette: [
        'linear-gradient(135deg,#1d232a 0%,#2a3138 100%)',
        'linear-gradient(135deg,#1a2027 0%,#262d34 100%)',
        'linear-gradient(135deg,#171d24 0%,#222930 100%)',
        'linear-gradient(135deg,#141a21 0%,#1e252c 100%)',
        'linear-gradient(135deg,#11171e 0%,#1a2128 100%)'
      ],
      captions: [
        { label: 'Assembly overview',   desc: 'Industrial link chain assembly. Parametric pin-joint system sourced from CAD.' },
        { label: 'Bracket detail',      desc: 'Bolt-pattern close-up. Retopology pass prepared for manufacturing review.' },
        { label: 'Motion study',        desc: 'Range-of-motion sketch for the pivoting arm. Constraint solver preview.' },
        { label: 'Exploded view',       desc: 'Parts diagram for manufacture planning. Tolerances marked in source DWG.' },
        { label: 'Material preview',    desc: 'KeyShot pass — brushed steel and anodized aluminium swatches.' }
      ],
      text: {
        title: 'CAD production study',
        body:  'Parametric link-chain case focused on CAD handoff, tolerance review, and render-ready topology for the CAD category.'
      },
      inline: {
        title: 'Pipeline',
        body:  'Fusion 360 → STEP → Blender retopo → KeyShot marketing. The assembly is ready for CAD review and render handoff.'
      }
    }) },

    'flex-spine': { role: 'R&D', tools: ['Fusion 360', 'Blender', 'KeyShot'], modelSrc: './assets/models/flex-spine.glb', modelStats: { triangles: '496', vertices: '258', materials: 2, textures: 'Procedural (PBR)', software: 'Fusion 360 + Blender' }, items: makeItems({
      id: 'flex-spine',
      palette: [
        'linear-gradient(135deg,#21272d 0%,#2e353c 100%)',
        'linear-gradient(135deg,#1d232a 0%,#2a3138 100%)',
        'linear-gradient(135deg,#1a2027 0%,#262c33 100%)',
        'linear-gradient(135deg,#171d24 0%,#222930 100%)',
        'linear-gradient(135deg,#141a21 0%,#1e252c 100%)'
      ],
      captions: [
        { label: 'Spine assembly',      desc: 'Kinematic spine assembly. Parametric ribs driven by a single driver angle.' },
        { label: 'Rib section',         desc: 'Section-cut through one rib — thickness and fillet radii exposed as parameters.' },
        { label: 'Deflection test',     desc: 'FEA sketch — deflection map under 50 N lateral load, prepared for design review.' },
        { label: 'Joint detail',        desc: 'Ball-and-socket joint close-up. Tolerance stack-up listed in source PDF.' },
        { label: 'Render study',        desc: 'KeyShot pass — matte steel against cool grey backdrop.' }
      ],
      text: {
        title: 'Kinematic CAD study',
        body:  'Parametric spine case: one driver angle bends every rib, with render studies prepared for stand and motion review.'
      },
      inline: {
        title: 'Parametrics',
        body:  'Parameters: rib_count, rib_thickness, segment_angle. Linked through Fusion 360 sketches and exported to Blender.'
      }
    }) },

    'cad-strut': { role: 'R&D', tools: ['Fusion 360', 'Blender', 'KeyShot'], modelSrc: './assets/models/cad-strut.glb', modelStats: { triangles: '480', vertices: '248', materials: 2, textures: 'Procedural (PBR)', software: 'Fusion 360 + Blender' }, items: makeItems({
      id: 'cad-strut',
      palette: [
        'linear-gradient(135deg,#1f2429 0%,#2b3138 100%)',
        'linear-gradient(135deg,#1c2126 0%,#282e35 100%)',
        'linear-gradient(135deg,#191e23 0%,#252b32 100%)',
        'linear-gradient(135deg,#161b20 0%,#21272e 100%)',
        'linear-gradient(135deg,#13181d 0%,#1e242b 100%)'
      ],
      captions: [
        { label: 'Node overview',       desc: 'Structural strut node. Six-way connector for space-frame assemblies.' },
        { label: 'Axis diagram',        desc: 'Load-path diagram — principal axes marked for the structural engineer.' },
        { label: 'Cross-section',       desc: 'Section through the central hub. Wall thickness and weld-prep highlighted.' },
        { label: 'Mount plate',         desc: 'Bolt-circle mount plate. Parametric — updates when strut diameter changes.' },
        { label: 'Surface finish',      desc: 'KeyShot pass — powder-coated aluminium, matte warm grey.' }
      ],
      text: {
        title: 'Structural CAD node',
        body:  'Structural strut node with linked diameter, wall thickness, and bolt-pattern parameters for production and render review.'
      },
      inline: {
        title: 'Use case',
        body:  'Used in space-frame prototypes. STEP is exported for CNC; Blender retopo supports marketing renders.'
      }
    }) }
  };
  // Phase 2b — expose CARDS_DATA на window так что i18n.js overlayCases()
  // может мутировать поля при смене языка. Read-write reference: main.js
  // и дальше использует local `CARDS_DATA` (тот же объект), i18n.js пишет
  // через window.CARDS_DATA[id].* — обе ссылки указывают на одну структуру.
  window.CARDS_DATA = CARDS_DATA;

  /* ══════════════════════════════════════════════════════════════════
     Seeded shuffle (Mulberry32) — детерминированный порядок на каждый кейс.
     Берём id строкой, превращаем в 32-битный seed, шуффлим копию массива.
  ══════════════════════════════════════════════════════════════════ */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  /* v0.8.2: shuffleSeeded удалён — buildItems использует локальную
     shuffleInPlace (line 1179). */

  /* ══════════════════════════════════
     DOM refs
  ══════════════════════════════════ */
  // v0.15.5 [П2] — filter data-attrs живут в чекбоксах dropdown'а.
  var tags       = document.querySelectorAll('.tags-dropdown__checkbox[data-filter]');
  var cards      = document.querySelectorAll('.work-card[data-category]');

  // v0.15.5 [П2] — tags-dropdown refs (инпутподобный триггер + панель с чекбоксами)
  var tagsDropdown        = document.getElementById('tags-dropdown');
  var tagsDropdownTrigger = document.getElementById('tags-dropdown-trigger');
  var tagsDropdownPanel   = document.getElementById('tags-dropdown-panel');
  var tagsDropdownChips   = document.getElementById('tags-dropdown-chips');
  var tagsDropdownPhldr   = document.getElementById('tags-dropdown-placeholder');
  // v0.2.1 [П1] — mobile overlay под dropdown
  var tagsDropdownOverlay = document.getElementById('tags-dropdown-overlay');
  var countEl    = document.getElementById('cards-count');
  var scrollEl   = document.getElementById('cards-scroll');
  var toggleBtn  = document.getElementById('cards-toggle');
  var gameSwitch = document.getElementById('game-switch');
  var caseBack   = document.getElementById('case-back');

  // case-view
  var caseTitle  = document.getElementById('case-title');
  var caseCat    = document.getElementById('case-cat');
  var caseYear   = document.getElementById('case-year');
  var caseScroll = document.getElementById('case-scroll');
  var caseTrack  = document.getElementById('case-scroll-track');
  var progressBar = document.getElementById('case-progress-bar');
  var tab3d      = document.getElementById('case-tab-3d');
  var tabBp      = document.getElementById('case-tab-bp');
  var tab2d      = document.getElementById('case-tab-2d');

  // v0.10 — nav arrows + blueprints
  var casePrev      = document.getElementById('case-prev');
  var caseNext      = document.getElementById('case-next');
  var caseCounter   = document.getElementById('case-counter');
  var caseBlueprints = document.getElementById('case-blueprints');
  var caseBlueprintsCanvas = document.getElementById('case-blueprints-canvas');

  // v0.11 — 3D viewer
  var case3d        = document.getElementById('case-3d');
  var case3dCanvas  = document.getElementById('case-3d-canvas');

  var currentCaseId = null;
  var currentViz    = '2d';                // '2d' | '3d' | 'blueprints'
  var blueprintBuiltFor = null;            // кэш последнего rendered blueprint
  var model3dBuiltFor   = null;            // v0.11 — кэш последнего 3D-кейса
  var currentMv           = null;          // v0.11.4 — активный <model-viewer> (для cleanup)
  var currentMvReset      = null;          // v0.11.4 — функция reset camera текущего MV (вызываем при возврате в 3D)
  var currentLightDdDocClick = null;       // v0.7.3 — global click listener для close-on-outside (cleanup в destroy3D)
  var currentLightDdDocKey   = null;       // v0.7.3 — global keydown listener для Escape (cleanup в destroy3D)
  var pendingScrollReset = false;          // v0.10.2 — отложенный сброс scrollTop на 0
  // v0.8.2: currentCategory удалён — переменная только писалась внутри
  // applyFilters и сразу же шла в evt.detail. Поле detail.category
  // оставлено для обратной совместимости публичного API codex:filter.
  var currentThreeViewer = null;           // Phase 3 - active self-hosted Three.js viewer island
  var currentThreeSource = null;           // Phase 3 - source used for fullscreen rehydration
  var fsThreeViewer = null;                // Phase 3 - fullscreen Three.js viewer clone
  var gameOnly = false;

  // v0.15.5 [П2] — массив выбранных дисциплин (OR-логика). Пусто или ['all'] → все кейсы.
  var selectedFilters = [];

  // v0.15.5 [П2] — человекочитаемые названия дисциплин для chips.
  var FILTER_LABELS = {
    'all':          'All',
    'hard-surface': 'Hard Surface',
    'product':      'Product',
    'organic':      'Organic',
    'prototyping':  'Prototyping',
    'animations':   'Animations',
    'cad':          'CAD'
  };

  /* ══════════════════════════════════
     Счётчик карточек
  ══════════════════════════════════ */
  function updateCount(n) {
    if (!countEl) return;
    countEl.textContent = n + (n === 1 ? ' project' : ' projects');
  }

  /* ══════════════════════════════════
     v0.15.5 [П2] — Унифицированный фильтр (multi-select, OR-логика):
       selectedFilters [] | ['all'] → все кейсы
       selectedFilters ['product','organic'] → кейсы с data-category product ИЛИ organic
       gameOnly (bool → только карточки с data-game-asset=true) работает AND к category
  ══════════════════════════════════ */
  function isAllActive() {
    return selectedFilters.length === 0 || selectedFilters.indexOf('all') !== -1;
  }

  function applyFilters() {
    var visible = 0;
    var allActive = isAllActive();
    cards.forEach(function (card) {
      var catMatch = allActive || selectedFilters.indexOf(card.dataset.category) !== -1;
      var gameMatch = !gameOnly || card.dataset.gameAsset === 'true';
      var show = catMatch && gameMatch;
      card.hidden = !show;
      if (show) visible++;
    });
    document.body.classList.toggle('filter-game', gameOnly);
    updateCount(visible);
    // v0.10 — если текущий кейс скрыт фильтром — переключаемся на первый видимый
    if (currentCaseId) {
      var currentCard = document.querySelector('.work-card[data-id="' + currentCaseId + '"]');
      if (currentCard && currentCard.hidden) {
        var firstVisible = document.querySelector('.work-card[data-id]:not([hidden])');
        if (firstVisible) {
          openCase(firstVisible.dataset.id);
          return;                                   // openCase сама диспатчит filter-event
        }
      }
    }
    updateNavCounter();
    document.dispatchEvent(new CustomEvent('codex:filter', {
      detail: {
        // v0.15.5 [П2] — category: primary = первый фильтр или 'all' (legacy field).
        category: allActive ? 'all' : selectedFilters[0],
        filters: allActive ? ['all'] : selectedFilters.slice(),
        gameOnly: gameOnly,
        visible: visible
      }
    }));
  }

  /* ══════════════════════════════════
     v0.15.5 [П2] — Dropdown UI: открытие/закрытие, chips, чекбоксы
  ══════════════════════════════════ */
  function setDropdownOpen(open) {
    if (!tagsDropdown || !tagsDropdownTrigger || !tagsDropdownPanel) return;
    tagsDropdown.setAttribute('data-open', open ? 'true' : 'false');
    tagsDropdownTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      tagsDropdownPanel.hidden = false;
    } else {
      tagsDropdownPanel.hidden = true;
    }
  }

  function renderChips() {
    if (!tagsDropdownChips || !tagsDropdown) return;
    tagsDropdownChips.innerHTML = '';
    var hasChips = selectedFilters.length > 0;
    tagsDropdown.setAttribute('data-has-chips', hasChips ? 'true' : 'false');
    if (tagsDropdownPhldr) {
      tagsDropdownPhldr.style.display = hasChips ? 'none' : '';
    }
    selectedFilters.forEach(function (key) {
      var chip = document.createElement('span');
      chip.className = 'tags-dropdown__chip';
      chip.setAttribute('data-chip-filter', key);

      var label = document.createElement('span');
      label.className = 'tags-dropdown__chip-label';
      label.textContent = FILTER_LABELS[key] || key;
      chip.appendChild(label);

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tags-dropdown__chip-remove';
      // Phase 4a — i18n префикс 'Remove' / 'Убрать'. FILTER_LABELS[key] —
      // англицизм-категория ('Hard Surface' и т.п.), не переводится.
      var __i18n = window.I18N;
      var __removeWord = (__i18n && __i18n.t) ? __i18n.t('chip.remove') : 'Remove';
      remove.setAttribute('aria-label', __removeWord + ' ' + (FILTER_LABELS[key] || key));
      remove.setAttribute('data-remove-filter', key);
      remove.textContent = '×';
      chip.appendChild(remove);

      tagsDropdownChips.appendChild(chip);
    });
  }

  function syncCheckboxes() {
    tags.forEach(function (cb) {
      cb.checked = selectedFilters.indexOf(cb.dataset.filter) !== -1;
    });
  }

  function selectFilter(key) {
    if (key === 'all') {
      // All toggles off все остальные
      selectedFilters = ['all'];
    } else {
      // При выборе дисциплины — All автоматически снимается
      selectedFilters = selectedFilters.filter(function (f) { return f !== 'all'; });
      if (selectedFilters.indexOf(key) === -1) selectedFilters.push(key);
    }
  }

  function deselectFilter(key) {
    selectedFilters = selectedFilters.filter(function (f) { return f !== key; });
  }

  function updateFilterState() {
    syncCheckboxes();
    renderChips();
    applyFilters();
  }

  // Клик по триггеру — toggle dropdown
  if (tagsDropdownTrigger) {
    tagsDropdownTrigger.addEventListener('click', function (e) {
      // Если клик попал в chip или крестик — не открываем
      var t = e.target;
      if (t.closest && t.closest('.tags-dropdown__chip-remove')) return;
      var open = tagsDropdown.getAttribute('data-open') === 'true';
      setDropdownOpen(!open);
    });
  }

  // v0.2.1 [П1] — Mobile overlay: перехватывает клик/touch/scroll вне dropdown,
  // первым действием закрывает dropdown, сайт становится доступным со второго взаимодействия.
  // На desktop (CSS display:none) overlay не рендерится и не ловит события — поведение не меняется.
  if (tagsDropdownOverlay) {
    function closeViaOverlay(e) {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(false);
    }
    tagsDropdownOverlay.addEventListener('click',      closeViaOverlay);
    tagsDropdownOverlay.addEventListener('touchstart', closeViaOverlay, { passive: false });
    tagsDropdownOverlay.addEventListener('touchmove',  function (e) { e.preventDefault(); }, { passive: false });
    tagsDropdownOverlay.addEventListener('wheel',      function (e) { e.preventDefault(); }, { passive: false });
  }

  // Клик по крестику chip (делегирование)
  if (tagsDropdownChips) {
    tagsDropdownChips.addEventListener('click', function (e) {
      var btn = e.target.closest('.tags-dropdown__chip-remove');
      if (!btn) return;
      e.stopPropagation();
      var key = btn.getAttribute('data-remove-filter');
      if (!key) return;
      deselectFilter(key);
      updateFilterState();
    });
  }

  // Чекбоксы в панели — multi-select с OR-логикой и авто-снятием All
  tags.forEach(function (cb) {
    cb.addEventListener('change', function () {
      var key = cb.dataset.filter;
      if (cb.checked) {
        selectFilter(key);
      } else {
        deselectFilter(key);
      }
      updateFilterState();
    });
  });

  // Закрытие dropdown по клику вне
  document.addEventListener('click', function (e) {
    if (!tagsDropdown) return;
    if (tagsDropdown.getAttribute('data-open') !== 'true') return;
    if (tagsDropdown.contains(e.target)) return;
    setDropdownOpen(false);
  });

  // Клавиатура: Escape закрывает dropdown
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && tagsDropdown && tagsDropdown.getAttribute('data-open') === 'true') {
      setDropdownOpen(false);
      if (tagsDropdownTrigger) tagsDropdownTrigger.focus();
    }
  });

  // Инициализация: selectedFilters=[] → все кейсы. Синхронизируем UI.
  updateFilterState();

  // v0.8.7 [M9] — FA-guard. На free-assets.html main.js загружается раньше
  // free-assets.js, и без этого guard'а оба подписывались на game-switch:
  // applyFilters в main.js ходит по cards (двойной класс .tag-card.work-card),
  // ставит body.filter-game и hidden=true на tag-cards. Раньше free-assets.js
  // снимал это через clone-replace (хрупкий race с порядком DOMContentLoaded).
  // Теперь main.js сам пропускает game-switch на FA, опознавая страницу по
  // существованию #fa-grid. Clone-replace в free-assets.js остаётся как
  // belt + suspenders на случай будущих регрессий.
  if (gameSwitch && !document.getElementById('fa-grid')) {
    gameSwitch.addEventListener('change', function () {
      gameOnly = gameSwitch.checked;
      gameSwitch.setAttribute('aria-checked', gameOnly ? 'true' : 'false');
      applyFilters();
    });
  }

  /* ══════════════════════════════════
     CASE VIEW — построение вертикального трека
     Порядок items детерминирован, но уникален для каждого id
     (через seeded shuffle).
  ══════════════════════════════════ */
  /* HTML одного media-item (wide / tall) — общий рендер */
  function mediaItemHTML(item) {
    var isVideo = item.type === 'video';
    var format  = item.format === 'tall' ? 'tall' : 'wide';
    var cls     = 'case-item case-item--' + format;
    var h  = '<article class="' + cls + '">';
    h +=     '<div class="case-item__media" style="background:' + (item.bg || 'var(--color-surface)') + ';">';
    if (isVideo && item.src) {
      h += '<video class="case-item__video" src="' + item.src + '" autoplay muted loop playsinline ';
      if (item.poster) h += 'poster="' + item.poster + '" ';
      h += 'aria-label="' + (item.label || '') + '" onerror="this.remove();"></video>';
    } else if (!isVideo && item.src) {
      // v0.20.0 — gallery img триггерит fullscreen viewer. tabindex+role+aria
      // для клавиатурной доступности (Enter/Space в main.js gallery keydown).
      // v0.21.0 — width/height (CLS prevention) + decoding=async. Размеры
      // условные по format ('wide' 1600×900 / 'tall' 600×800) — реальные SVG
      // имеют тот же aspect через viewBox, браузер использует ratio для
      // pre-reservation места.
      var iw = item.format === 'wide' ? 1600 : 600;
      var ih = item.format === 'wide' ? 900  : 800;
      h += '<img class="case-item__img" src="' + item.src + '" alt="' + (item.label || '') + '" ';
      h += 'width="' + iw + '" height="' + ih + '" loading="lazy" decoding="async" ';
      h += 'draggable="false" tabindex="0" role="button" ';
      h += 'aria-haspopup="dialog" aria-label="Open fullscreen view of ' + (item.label || 'image') + '" ';
      h += 'onerror="this.remove();">';
    }
    h +=   '<span class="case-item__placeholder" aria-hidden="true">' + (item.label || '') + '</span>';
    /* v0.15.2 [B3] — .case-media-fs-btn удалена для 2D кейсов.
       Fullscreen остаётся для 3D (.case-3d__fs-btn) и Blueprints (.case-blueprints__fs-btn). */
    h +=   '</div>';
    h +=   '<div class="case-item__caption">';
    h +=     '<p class="case-item__caption-label">' + (item.label || '') + '</p>';
    h +=     '<p class="case-item__caption-desc">' + (item.desc || '') + '</p>';
    h +=   '</div>';
    h += '</article>';
    return h;
  }

  /* Full-width text block (intro) — v0.9: eyebrow + meta (role / year / tools)
     v0.13.8: external link button (ArtStation для game-ассетов, Behance для остальных). */
  function textFullHTML(text, meta) {
    meta = meta || {};
    var chips = '';
    if (meta.role) {
      chips += '<span class="case-text__meta-item case-text__meta-item--role">' + meta.role + '</span>';
    }
    if (meta.year) {
      chips += '<span class="case-text__meta-item">' + meta.year + '</span>';
    }
    if (meta.tools && meta.tools.length) {
      chips += '<span class="case-text__meta-item">' + meta.tools.join(' \u00b7 ') + '</span>';
    }

    // v0.13.8 — external link (game → ArtStation, non-game → Behance)
    var isGame    = meta.gameAsset === true;
    var extHref   = isGame
      ? 'https://www.artstation.com/REPLACE_WITH_REAL'
      : 'https://www.behance.net/REPLACE_WITH_REAL';
    var extLabel  = isGame ? 'View on ArtStation' : 'View on Behance';
    var extAria   = isGame
      ? 'Открыть профиль на ArtStation в новой вкладке'
      : 'Открыть профиль на Behance в новой вкладке';

    var h  = '<div class="case-row case-row--text">';
    h +=     '<article class="case-item case-item--text">';
    h +=       '<div class="case-text">';
    h +=         '<div class="case-text__header">';
    h +=           '<div class="case-text__header-left">';
    h +=             '<p class="case-text__eyebrow">Overview</p>';
    if (chips) {
      h +=           '<div class="case-text__meta">' + chips + '</div>';
    }
    h +=           '</div>';
    h +=           '<a class="case-text__external-btn"';
    h +=             ' href="' + extHref + '"';
    h +=             ' target="_blank" rel="noopener noreferrer"';
    h +=             ' aria-label="' + extAria + '"';
    h +=             ' data-external="' + (isGame ? 'artstation' : 'behance') + '">';
    h +=             '<span class="case-text__external-btn-label">' + extLabel + '</span>';
    h +=             '<span class="case-text__external-btn-arrow" aria-hidden="true">\u2192</span>';
    h +=           '</a>';
    h +=         '</div>';
    h +=         '<h2 class="case-text__title">' + (text.title || '') + '</h2>';
    h +=         '<p class="case-text__body">'  + (text.body  || '') + '</p>';
    h +=       '</div>';
    h +=     '</article>';
    h +=   '</div>';
    return h;
  }

  /* Row variants */
  function rowWide(media) {
    return '<div class="case-row case-row--wide">' + mediaItemHTML(media) + '</div>';
  }
  function rowTall1(media) {
    return '<div class="case-row case-row--tall-1">' + mediaItemHTML(media) + '</div>';
  }
  function rowTall2(a, b) {
    return '<div class="case-row case-row--tall-2">' + mediaItemHTML(a) + mediaItemHTML(b) + '</div>';
  }
  function rowTallText(media, text) {
    var h  = '<div class="case-row case-row--tall-text">';
    h +=     mediaItemHTML(media);
    h +=     '<article class="case-item case-item--text-inline">';
    h +=       '<div class="case-text case-text--inline">';
    h +=         '<p class="case-text__eyebrow">Notes</p>';
    h +=         '<h3 class="case-text__title">' + (text.title || '') + '</h3>';
    h +=         '<p class="case-text__body">'  + (text.body  || '') + '</p>';
    h +=       '</div>';
    h +=     '</article>';
    h +=   '</div>';
    return h;
  }

  /* ══════════════════════════════════
     buildItems(id) — собирает все rows.
     Структура (v0.8):
       1) text-full (intro)   — всегда первым
       2) N rows из media[] — собираются с учётом seeded shuffle:
           • 2 wide → каждая становится row --wide
           • 3 tall → распределяются в rowTall1 / rowTall2 / rowTallText
             (если есть inline-text и ≥1 tall → один row tall-text)
  ══════════════════════════════════ */
  function buildItems(id, meta) {
    var data = CARDS_DATA[id];
    if (!data || !caseTrack) return;
    var items = data.items;
    if (!items || !items.media) return;
    meta = meta || {};

    var seed = hashStr(id);
    var rng  = mulberry32(seed);

    // Разделяем media на wide / tall
    var widesSrc = items.media.filter(function (m) { return m.format === 'wide' && m.enabled !== false; });
    var tallsSrc = items.media.filter(function (m) { return m.format === 'tall' && m.enabled !== false; });

    // Детерминированное перемешивание внутри каждой группы
    function shuffleInPlace(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    var wides = shuffleInPlace(widesSrc.slice());
    var talls = shuffleInPlace(tallsSrc.slice());

    // Планируем tall-ряды.
    // Базовый план (при 3 talls): tallText (1) + tall2 (2) = 3
    // Если inline нет: tall1 + tall2 = 3
    var tallRows = [];
    if (items.inline && talls.length >= 1) {
      // Один tall уходит в tall-text
      tallRows.push({ kind: 'tall-text', a: talls.shift() });
    }
    // Оставшиеся talls: если 2+ — tall-2, если 1 — tall-1, если 0 — ничего
    while (talls.length >= 2) {
      tallRows.push({ kind: 'tall-2', a: talls.shift(), b: talls.shift() });
    }
    if (talls.length === 1) {
      tallRows.push({ kind: 'tall-1', a: talls.shift() });
    }

    // План wide-рядов
    var wideRows = wides.map(function (m) { return { kind: 'wide', a: m }; });

    // Перемешиваем tallRows и wideRows между собой, чередуя.
    // Подход: сливаем в один массив и перемешиваем seeded, но избегаем двух wide подряд.
    var all = tallRows.concat(wideRows);
    shuffleInPlace(all);

    // Развод двух wide подряд (если возникли).
    for (var k = 0; k < all.length - 1; k++) {
      if (all[k].kind === 'wide' && all[k + 1].kind === 'wide') {
        // Ищем следующий не-wide и меняем местами с k+1
        for (var m = k + 2; m < all.length; m++) {
          if (all[m].kind !== 'wide') {
            var tmp = all[k + 1]; all[k + 1] = all[m]; all[m] = tmp;
            break;
          }
        }
      }
    }

    // Сборка HTML: text-full → rows
    var html = '';
    if (items.text) {
      // v0.9: передаём role/tools из data + year из DOM (card)
      // v0.13.8: gameAsset — из meta.gameAsset (читается из DOM в openCase)
      var textMeta = {
        role:      data.role  || null,
        tools:     data.tools || null,
        year:      meta.year  || null,
        gameAsset: meta.gameAsset === true
      };
      html += textFullHTML(items.text, textMeta);
    }

    all.forEach(function (row) {
      if (row.kind === 'wide')      html += rowWide(row.a);
      else if (row.kind === 'tall-1') html += rowTall1(row.a);
      else if (row.kind === 'tall-2') html += rowTall2(row.a, row.b);
      else if (row.kind === 'tall-text') html += rowTallText(row.a, items.inline);
    });

    caseTrack.innerHTML = html;
  }

  /* ══════════════════════════════════
     Scroll progress — полоса сверху
  ══════════════════════════════════ */
  function updateProgress() {
    if (!caseScroll || !progressBar) return;
    var max = caseScroll.scrollHeight - caseScroll.clientHeight;
    var pct = max > 0 ? (caseScroll.scrollTop / max) * 100 : 0;
    progressBar.style.width = pct.toFixed(2) + '%';
  }
  // v0.8.4 [M4] — resize-handler читает scrollHeight/clientHeight (layout-thrash
  // на каждый resize-tick). Throttle через rAF: один пересчёт за кадр.
  var progressResizeQueued = false;
  function updateProgressOnResize() {
    if (progressResizeQueued) return;
    progressResizeQueued = true;
    requestAnimationFrame(function () {
      progressResizeQueued = false;
      updateProgress();
    });
  }
  if (caseScroll) {
    caseScroll.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgressOnResize);
    // v0.6 [Z7] — scroll-hint: помечаем caseScroll классом .has-scrolled при первом скролле,
    // чтобы CSS-стрелка пропала. once: true — listener auto-remove после первого срабатывания.
    // Класс persistent — после первого скролла стрелка не появляется на других кейсах.
    caseScroll.addEventListener('scroll', function () {
      caseScroll.classList.add('has-scrolled');
    }, { once: true, passive: true });
  }

  /* v0.6 [Z7] — пересоздаёт .case-scroll-hint в .case-view при каждом openCase
     для перезапуска CSS-animation. Если .case-scroll уже .has-scrolled — выходим
     (UX-обучение пройдено). Real DOM-element вместо ::after — pseudo-element с
     position:sticky внутри overflow:auto + mask-image нестабильно в Chromium. */
  function showScrollHint() {
    var caseView = document.getElementById('case-view');
    if (!caseView) return;
    if (caseScroll && caseScroll.classList.contains('has-scrolled')) return;
    var existing = caseView.querySelector('.case-scroll-hint');
    if (existing) existing.remove();
    var hint = document.createElement('div');
    hint.className = 'case-scroll-hint';
    hint.setAttribute('aria-hidden', 'true');
    caseView.appendChild(hint);
  }

  /* ══════════════════════════════════
     openCase(id) — главная точка входа
  ══════════════════════════════════ */
  // v0.9.5 + v0.9.6 — portfolio-case.css. На обычном пути preload+onload
  // в index.html <head> уже инжектит этот файл параллельно с критическими
  // ресурсами. ensureCaseStylesheet остаётся как safety-net на случай если:
  //   а) <noscript>-фоллбек не сработал (preload вообще не поддерживается)
  //   б) Какая-то модификация HTML удалила preload-link
  // Идемпотентно через querySelector — повторные openCase не дублируют <link>.
  function ensureCaseStylesheet() {
    // preload <link> ставит rel='preload', после onload меняет на 'stylesheet'.
    // Любой из них считается "уже инициирован".
    if (document.querySelector('link[href$="portfolio-case.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/portfolio-case.css';
    link.setAttribute('data-case-css', 'true');
    document.head.appendChild(link);
  }

  function openCase(id, opts) {
    opts = opts || {};
    var data = CARDS_DATA[id];
    if (!data) return;

    ensureCaseStylesheet();

    var card = document.querySelector('.work-card[data-id="' + id + '"]');

    // Active state
    cards.forEach(function (c) {
      c.classList.remove('work-card--active');
      c.removeAttribute('aria-current');
    });
    if (card) {
      card.classList.add('work-card--active');
      // v0.5: aria-current="page" — корректно для <a> (work-card теперь ссылка).
      // Раньше было "true" (валидно по spec, но "page" семантически точнее для навигации).
      card.setAttribute('aria-current', 'page');
      if (!opts.initial) {
        // v0.14.0 [13] — связываем пагинацию и скролл ленты карточек.
        // 'center' — всегда держит активную карточку в центре скролла.
        // v0.2.2 [П1] ROOT CAUSE горизонтального съезда карточек на mobile:
        //   во время case-view #cards-scroll имеет display:none (0×0).
        //   scrollIntoView({block:'center'}) в таком контейнере вычисляет
        //   scrollLeft = offsetLeft + width/2 ≈ 187px и присваивает его
        //   #cards-scroll.scrollLeft. overflow-x:hidden блокирует жест
        //   пользователя, но не программный scrollLeft. При возврате
        //   все карточки визуально съезжают влево.
        // v0.7.12 [bug] DESKTOP: тот же артефакт. setCollapsed(true) на
        //   desktop ставит scrollEl.hidden=true → display:none. После
        //   case-nav + re-expand нижние карточки визуально пропадают до
        //   resize (стейл scrollTop). Универсальный гард: пропускаем
        //   scrollIntoView пока sidebar collapsed на ЛЮБОМ брейкпоинте.
        //   Доскролл активной выполняется в animations.js на
        //   codex:toggle{collapsed:false} (mobile блок 4.1, desktop 4.2).
        var isCollapsed = document.body.classList.contains('cards-collapsed');
        if (!isCollapsed) {
          // v0.2.3 [П1] DESKTOP: smooth scrollIntoView, вызванный сразу,
          //   прерывается синхронным reflow из buildItems()/renderBlueprints()
          //   ниже в openCase() — scroll animation сбрасывается к 0 и
          //   активная карточка остаётся вне видимой зоны sidebar.
          //   Фикс: откладываем вызов на 2× rAF — к этому моменту
          //   DOM уже пересобран и smooth-анимация не прерывается.
          //   ROOT CAUSE воспроизведён playwright-ом: instant работает
          //   синхронно, smooth — нет. v0.2.2 mobile-поведение сохранено.
          var targetCard = card;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              var prefersReducedScroll = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              targetCard.scrollIntoView({
                behavior: prefersReducedScroll ? 'auto' : 'smooth',
                block: 'center'
              });
            });
          });
        }
      }
    }

    // Header meta
    var yearText = '';
    if (card) {
      var c = card.querySelector('.work-card__cat');
      var y = card.querySelector('.work-card__year');
      var t = card.querySelector('.work-card__title');
      if (y) yearText = y.textContent || '';
      if (caseCat)   caseCat.textContent   = c ? c.textContent : '';
      if (caseYear)  caseYear.textContent  = yearText;
      if (caseTitle) caseTitle.textContent = t ? t.textContent : '';
    }

    currentCaseId = id;
    blueprintBuiltFor = null;                       // v0.10 — сброс кэша blueprint
    model3dBuiltFor = null;                         // v0.11 — сброс кэша 3D

    // Build items + reset scroll + progress
    // v0.13.8: передаём gameAsset для external link (ArtStation/Behance)
    var gameAsset = !!(card && card.dataset && card.dataset.gameAsset === 'true');
    buildItems(id, { year: yearText, gameAsset: gameAsset });
    if (progressBar) progressBar.style.width = '0%';
    // v0.10.2 — scrollTop на display:none-видимости не применяется корректно,
    // поэтому если сейчас вкладка Blueprints — ставим флаг, сбросим при переходе на 2D
    // v0.15.4 [П3] — mobile: надёжный сброс при переключении кейса в любом режиме.
    // В некоторых touch-сценариях расчёт scrollTop=0 перекрывался momentum-скроллом,
    // поэтому дублируем через rAF для надёжности. Desktop-логика не затронута.
    var isMobileSwitch = window.matchMedia('(max-width: 767px)').matches;
    if (caseScroll) {
      if (currentViz === '2d') {
        caseScroll.scrollTop = 0;
        pendingScrollReset = false;
      } else {
        if (isMobileSwitch) {
          caseScroll.scrollTop = 0;
        }
        pendingScrollReset = true;
      }
      if (isMobileSwitch) {
        // дубль-reset после layout — защита от momentum-scroll на iOS/Android touch-устройствах
        requestAnimationFrame(function () {
          if (caseScroll) caseScroll.scrollTop = 0;
        });
      }
    }

    // v0.10 — обновляем счётчик + перерисовываем blueprint если активна
    updateNavCounter();
    if (currentViz === 'blueprints') {
      renderBlueprints(id);
    } else if (currentViz === '3d') {
      build3D(id);                                  // v0.11 — перестраиваем 3D под новый кейс
    }

    // v0.2.3 [П2] — синхронизируем location.hash с текущим кейсом.
    //   Для самого первого кейса (главная) — hash сбрасывается до корня:
    //   codex.promo/ вместо codex.promo/#orbital-mk-ii. Остальные кейсы имеют
    //   свой якорь. replaceState вместо pushState — чтобы не засорять history
    //   при case-nav (пользователь может быстро кликать на next/prev).
    //   Игнорируем во время вызовов из hashchange listener (чтобы не было лупы).
    if (!opts.skipHashSync) {
      var firstVisibleForHash = document.querySelector('.work-card[data-id]:not([hidden])');
      var firstId = firstVisibleForHash ? firstVisibleForHash.dataset.id : null;
      var desiredHash = (id === firstId) ? '' : ('#' + id);
      var currentHash = window.location.hash;
      if (desiredHash !== currentHash) {
        try {
          var baseUrl = window.location.pathname + window.location.search;
          history.replaceState(null, '', baseUrl + desiredHash);
        } catch (e) { /* file:// или строгий sandbox — игнорируем */ }
      }
    }

    document.dispatchEvent(new CustomEvent('codex:case-open', {
      detail: { id: id, initial: !!opts.initial }
    }));

    // v0.6 [Z7] — показ scroll-hint после построения кейса. Внутренний guard
    // не показывает на повторных кейсах (если .case-scroll уже .has-scrolled).
    showScrollHint();
  }

  /* ══════════════════════════════════
     v0.10 — навигация prev/next + счётчик
  ══════════════════════════════════ */
  function getVisibleCards() {
    return [].slice.call(document.querySelectorAll('.work-card[data-id]:not([hidden])'));
  }
  function updateNavCounter() {
    if (!caseCounter) return;
    var visible = getVisibleCards();
    var total = visible.length;
    var idx = -1;
    for (var i = 0; i < visible.length; i++) {
      if (visible[i].dataset.id === currentCaseId) { idx = i; break; }
    }
    if (total === 0) {
      caseCounter.textContent = '0 / 0';
    } else if (idx === -1) {
      caseCounter.textContent = '– / ' + total;
    } else {
      caseCounter.textContent = (idx + 1) + ' / ' + total;
    }
    var disable = total <= 1;
    if (casePrev) casePrev.disabled = disable;
    if (caseNext) caseNext.disabled = disable;
  }
  function navigateCase(direction) {
    var visible = getVisibleCards();
    if (visible.length < 2) return;
    var idx = -1;
    for (var i = 0; i < visible.length; i++) {
      if (visible[i].dataset.id === currentCaseId) { idx = i; break; }
    }
    var base = idx === -1 ? 0 : idx;
    var nextIdx = (base + direction + visible.length) % visible.length;
    openCase(visible[nextIdx].dataset.id);
  }
  if (casePrev) casePrev.addEventListener('click', function () { navigateCase(-1); });
  if (caseNext) caseNext.addEventListener('click', function () { navigateCase( 1); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    // v0.8.1 [H1] — при открытом fs-overlay стрелки управляют только галереей
    // (см. navGallery handler ниже). Иначе кейс листался под фуллскрином.
    if (fsOverlay && fsOverlay.classList.contains('is-open')) return;
    // На мобильном стрелки работают только когда case-view виден (sidebar свернут)
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile && !document.body.classList.contains('cards-collapsed')) return;
    e.preventDefault();
    navigateCase(e.key === 'ArrowLeft' ? -1 : 1);
  });

  /* ══════════════════════════════════
     v0.22 — BLUEPRINT RENDERER (multi-page)
     Каждый кейс хранит pages[] — массив страниц чертежа. Сейчас у всех
     1 страница, но buildBlueprintSVG(id, pageIdx) и renderBlueprints
     поддерживают 1..N. На desktop активна одна .case-blueprints__page,
     листание — pager-overlay. На mobile все страницы выводятся колонкой
     с per-page тулбаром (Export + Fullscreen).
  ══════════════════════════════════ */
  var BLUEPRINT_META = {
    'orbital-mk-ii':  { pages: [
      { view: 'Front view',  no: 'CS-001-A', unit: 'mm', overall: [1820, 1240], parts: ['Chassis', 'Thruster', 'Panel A', 'Panel B', 'Vent'] },
      { view: 'Top view',    no: 'CS-001-B', unit: 'mm', overall: [1820, 1640], parts: ['Hub', 'Forward bay', 'Aft bay', 'Stabilizer L', 'Stabilizer R'] },
      { view: 'Section A-A', no: 'CS-001-C', unit: 'mm', overall: [1240, 920],  parts: ['Coolant duct', 'Reactor core', 'Plenum'] }
    ] },
    'vega-shell':     { pages: [
      { view: 'Exploded view', no: 'CS-002-A', unit: 'mm', overall: [1640, 1100], parts: ['Shoulder', 'Chest', 'Forearm', 'Greave'] },
      { view: 'Front view',    no: 'CS-002-B', unit: 'mm', overall: [820, 1320],  parts: ['Pauldron', 'Cuirass', 'Vambrace'] },
      { view: 'Side view',     no: 'CS-002-C', unit: 'mm', overall: [640, 1320],  parts: ['Spaulder', 'Backplate', 'Tasset'] }
    ] },
    'ironclad-frame': { pages: [{ view: 'Top view',      no: 'CS-003', unit: 'mm', overall: [2400, 1200], parts: ['Frame', 'Bracket', 'Flange', 'Bolt row'] }] },
    'corten-series':  { pages: [{ view: 'Front view',    no: 'CS-004', unit: 'cm', overall: [85, 110],    parts: ['Seat', 'Back', 'Leg L', 'Leg R'] }] },
    'lumen-one':      { pages: [{ view: 'Section A-A',   no: 'CS-005', unit: 'mm', overall: [320, 420],   parts: ['Shade', 'Stem', 'Base', 'Socket'] }] },
    'flux-capsule':   { pages: [{ view: 'Front view',    no: 'CS-006', unit: 'mm', overall: [900, 1400],  parts: ['Capsule', 'Coil', 'Core', 'Port'] }] },
    'nightshard':     { pages: [{ view: 'Front view',    no: 'CS-007', unit: 'mm', overall: [640, 1820],  parts: ['Blade', 'Guard', 'Grip', 'Pommel'] }] },
    'recon-drone':    { pages: [{ view: 'Top view',      no: 'CS-008', unit: 'mm', overall: [1280, 1280], parts: ['Hub', 'Rotor NE', 'Rotor SE', 'Rotor SW', 'Rotor NW'] }] },
    'apex-frame':     { pages: [{ view: 'Side view',     no: 'CS-009', unit: 'mm', overall: [1700, 900],  parts: ['Top rail', 'Bottom rail', 'Strut L', 'Strut R'] }] },
    'core-rig':       { pages: [{ view: 'Front view',    no: 'CS-010', unit: 'mm', overall: [1200, 1600], parts: ['Mount', 'Arm', 'Yoke', 'Clamp'] }] },
    'helix-reveal':   { pages: [{ view: 'Exploded view', no: 'CS-011', unit: 'mm', overall: [1440, 1440], parts: ['Ring A', 'Ring B', 'Spine', 'Cap'] }] },
    'arc-motion':     { pages: [{ view: 'Side view',     no: 'CS-012', unit: 'mm', overall: [2000, 800],  parts: ['Arc', 'Pivot', 'Counterweight'] }] },
    'nyx-panther':    { pages: [{ view: 'Side view',     no: 'CS-013', unit: 'cm', overall: [180, 80],    parts: ['Head', 'Torso', 'Foreleg', 'Hindleg', 'Tail'] }] },
    'drift-koi':      { pages: [{ view: 'Top view',      no: 'CS-014', unit: 'cm', overall: [90, 40],     parts: ['Head', 'Body', 'Fin', 'Tail'] }] },
    'glint-owl':      { pages: [{ view: 'Front view',    no: 'CS-015', unit: 'cm', overall: [55, 70],     parts: ['Head', 'Body', 'Wing L', 'Wing R'] }] },
    'mech-link':      { pages: [{ view: 'Assembly view', no: 'CS-016', unit: 'mm', overall: [1200, 800],   parts: ['Link A', 'Link B', 'Pin', 'Bracket'] }] },
    'flex-spine':     { pages: [{ view: 'Side view',     no: 'CS-017', unit: 'mm', overall: [1800, 600],   parts: ['Rib x8', 'Driver', 'Joint A', 'Joint B'] }] },
    'cad-strut':      { pages: [{ view: 'Section A-A',   no: 'CS-018', unit: 'mm', overall: [600, 600],    parts: ['Hub', 'Strut N', 'Strut E', 'Mount'] }] }
  };
  function getBpPages(id) {
    var m = BLUEPRINT_META[id];
    return (m && m.pages) ? m.pages : [];
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) { for (var k in attrs) el.setAttribute(k, attrs[k]); }
    if (text != null) el.textContent = text;
    return el;
  }

  /* Параметры canvas — SVG в координатах чертежного поля.
     v0.22: grid тянется от края до края viewBox (xMidYMid meet),
     отдельный inner frame убран. Пады описывают только область
     самой схемы (drawing area) внутри grid. */
  var BP_VIEW_W = 1200;
  var BP_VIEW_H = 800;
  var BP_GRID_MINOR = 20;
  var BP_GRID_MAJOR = 100;
  // Зоны вокруг drawing area — для view-tag, dim-линий, callouts и title-block.
  var BP_PAD_LEFT   = 80;
  var BP_PAD_TOP    = 40;
  var BP_PAD_RIGHT  = 280;
  var BP_PAD_BOTTOM = 140;

  function buildBlueprintSVG(id, pageIdx, opts) {
    opts = opts || {};
    var forExport = !!opts.forExport;     // v0.22.3: runtime пропускает grid+title-block (живут CSS/HTML-оверлеями); export включает их обратно.
    var pages = getBpPages(id);
    var meta  = pages[pageIdx || 0];
    var data  = CARDS_DATA[id];
    if (!meta || !data) return null;
    var card = document.querySelector('.work-card[data-id="' + id + '"]');
    var year = card ? (card.querySelector('.work-card__year') || {}).textContent || '' : '';
    var title = card ? (card.querySelector('.work-card__title') || {}).textContent || id : id;

    var rng = mulberry32(hashStr(id + '-bp-' + (pageIdx || 0)));
    // unique suffix для defs id (несколько SVG на странице — нельзя коллидить)
    var uid = id + '-' + (pageIdx || 0);

    /* — SVG корень — */
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + BP_VIEW_W + ' ' + BP_VIEW_H,
      preserveAspectRatio: 'xMidYMid meet',
      'aria-label': 'Technical blueprint of ' + title +
        (pages.length > 1 ? ' (page ' + ((pageIdx || 0) + 1) + ' of ' + pages.length + ')' : '')
    });

    /* — defs: размерные стрелки (нужны всегда), grid-pattern только для экспорта — */
    var defs = svgEl('defs');
    var markerStart = svgEl('marker', {
      id: 'bp-arrow-start-' + uid, viewBox: '0 0 10 10',
      refX: '2', refY: '5', markerWidth: '8', markerHeight: '8',
      orient: 'auto-start-reverse'
    });
    markerStart.appendChild(svgEl('path', { class: 'blueprint__dim-arrow', d: 'M 0 5 L 10 0 L 8 5 L 10 10 Z' }));
    var markerEnd = svgEl('marker', {
      id: 'bp-arrow-end-' + uid, viewBox: '0 0 10 10',
      refX: '8', refY: '5', markerWidth: '8', markerHeight: '8',
      orient: 'auto'
    });
    markerEnd.appendChild(svgEl('path', { class: 'blueprint__dim-arrow', d: 'M 10 5 L 0 0 L 2 5 L 0 10 Z' }));
    defs.appendChild(markerStart);
    defs.appendChild(markerEnd);
    if (forExport) {
      var patMinor = svgEl('pattern', {
        id: 'bp-grid-minor-' + uid,
        width: BP_GRID_MINOR, height: BP_GRID_MINOR,
        patternUnits: 'userSpaceOnUse'
      });
      patMinor.appendChild(svgEl('path', {
        class: 'blueprint__grid-minor',
        d: 'M ' + BP_GRID_MINOR + ' 0 L 0 0 0 ' + BP_GRID_MINOR
      }));
      var patMajor = svgEl('pattern', {
        id: 'bp-grid-major-' + uid,
        width: BP_GRID_MAJOR, height: BP_GRID_MAJOR,
        patternUnits: 'userSpaceOnUse'
      });
      patMajor.appendChild(svgEl('path', {
        class: 'blueprint__grid-major',
        d: 'M ' + BP_GRID_MAJOR + ' 0 L 0 0 0 ' + BP_GRID_MAJOR
      }));
      defs.appendChild(patMinor);
      defs.appendChild(patMajor);
    }
    svg.appendChild(defs);

    /* — Grid от края до края viewBox (только в экспорте; runtime берёт CSS-сетку с canvas). — */
    if (forExport) {
      var gGrid = svgEl('g', { class: 'blueprint__grid' });
      gGrid.appendChild(svgEl('rect', {
        x: 0, y: 0, width: BP_VIEW_W, height: BP_VIEW_H,
        fill: 'url(#bp-grid-minor-' + uid + ')'
      }));
      gGrid.appendChild(svgEl('rect', {
        x: 0, y: 0, width: BP_VIEW_W, height: BP_VIEW_H,
        fill: 'url(#bp-grid-major-' + uid + ')'
      }));
      svg.appendChild(gGrid);
    }

    /* — view tag (top-left) — */
    var vg = svgEl('g');
    vg.appendChild(svgEl('text', {
      class: 'blueprint__view-tag',
      x: 16, y: 28
    }, meta.view.toUpperCase()));
    svg.appendChild(vg);

    /* — Drawing area (схема заполняет всё свободное пространство) — */
    var ratio = meta.overall[0] / meta.overall[1];
    var frameW = BP_VIEW_W - BP_PAD_LEFT - BP_PAD_RIGHT;
    var frameH = BP_VIEW_H - BP_PAD_TOP  - BP_PAD_BOTTOM;
    var drawW, drawH;
    if (ratio >= 1) {
      drawW = Math.min(frameW, frameH * ratio);
      drawH = drawW / ratio;
    } else {
      drawH = Math.min(frameH, frameW / ratio);
      drawW = drawH * ratio;
    }
    // Центрируем в пределах рабочей зоны
    var drawX = BP_PAD_LEFT + (frameW - drawW) / 2;
    var drawY = BP_PAD_TOP  + (frameH - drawH) / 2;

    /* — main outline + internal parts (grid-split) — */
    var partsG = svgEl('g', { class: 'blueprint__parts' });
    // main outline
    partsG.appendChild(svgEl('rect', {
      class: 'blueprint__part',
      x: drawX, y: drawY, width: drawW, height: drawH
    }));

    // Делим прямоугольник на N частей: horizontal или vertical режим
    var parts = meta.parts;
    var horizontal = ratio >= 1;
    var positions = [];
    if (parts.length <= 3) {
      // простое разделение
      var cuts = [];
      for (var c = 1; c < parts.length; c++) {
        cuts.push(0.25 + 0.5 * (c / parts.length) + (rng() - 0.5) * 0.1);
      }
      cuts.sort();
      var prev = 0;
      cuts.concat([1]).forEach(function (p) {
        if (horizontal) {
          positions.push({ x: drawX + drawW * prev, y: drawY, w: drawW * (p - prev), h: drawH });
        } else {
          positions.push({ x: drawX, y: drawY + drawH * prev, w: drawW, h: drawH * (p - prev) });
        }
        prev = p;
      });
    } else {
      // сетка 2×N или N×2
      var cols = horizontal ? Math.ceil(parts.length / 2) : 2;
      var rows = horizontal ? 2 : Math.ceil(parts.length / 2);
      for (var i2 = 0; i2 < parts.length; i2++) {
        var cx = i2 % cols;
        var ry = Math.floor(i2 / cols);
        positions.push({
          x: drawX + (drawW / cols) * cx,
          y: drawY + (drawH / rows) * ry,
          w: drawW / cols,
          h: drawH / rows
        });
      }
    }

    // Рисуем разделы + лейблы частей
    parts.forEach(function (name, idx) {
      var p = positions[idx];
      if (!p) return;
      // подрезаем с паддингом для визуального отделения
      var pad = 6;
      partsG.appendChild(svgEl('rect', {
        class: 'blueprint__part',
        x: p.x + pad, y: p.y + pad,
        width:  Math.max(0, p.w - pad * 2),
        height: Math.max(0, p.h - pad * 2)
      }));
      partsG.appendChild(svgEl('text', {
        class: 'blueprint__part-label',
        x: p.x + p.w / 2, y: p.y + p.h / 2 + 4,
        'text-anchor': 'middle'
      }, name));
    });
    svg.appendChild(partsG);

    /* — Размерные линии: overall width (снизу) + overall height (слева) — */
    var dimsG = svgEl('g', { class: 'blueprint__dimensions' });
    // Горизонтальная (overall width)
    var yDim = drawY + drawH + 36;
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-ext',
      x1: drawX, y1: drawY + drawH + 4, x2: drawX, y2: yDim + 6
    }));
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-ext',
      x1: drawX + drawW, y1: drawY + drawH + 4, x2: drawX + drawW, y2: yDim + 6
    }));
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-line',
      x1: drawX, y1: yDim, x2: drawX + drawW, y2: yDim,
      'marker-start': 'url(#bp-arrow-start-' + uid + ')',
      'marker-end':   'url(#bp-arrow-end-'   + uid + ')'
    }));
    // лейбл с фоновой плашкой
    var lblW = meta.overall[0] + ' ' + meta.unit;
    dimsG.appendChild(svgEl('rect', {
      class: 'blueprint__dim-label-bg',
      x: drawX + drawW / 2 - 38, y: yDim - 8,
      width: 76, height: 16
    }));
    dimsG.appendChild(svgEl('text', {
      class: 'blueprint__dim-label',
      x: drawX + drawW / 2, y: yDim + 4
    }, lblW));

    // Вертикальная (overall height)
    var xDim = drawX - 36;
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-ext',
      x1: drawX - 4, y1: drawY, x2: xDim - 6, y2: drawY
    }));
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-ext',
      x1: drawX - 4, y1: drawY + drawH, x2: xDim - 6, y2: drawY + drawH
    }));
    dimsG.appendChild(svgEl('line', {
      class: 'blueprint__dim-line',
      x1: xDim, y1: drawY, x2: xDim, y2: drawY + drawH,
      'marker-start': 'url(#bp-arrow-start-' + uid + ')',
      'marker-end':   'url(#bp-arrow-end-'   + uid + ')'
    }));
    var lblH = meta.overall[1] + ' ' + meta.unit;
    dimsG.appendChild(svgEl('rect', {
      class: 'blueprint__dim-label-bg',
      x: xDim - 38, y: drawY + drawH / 2 - 8,
      width: 76, height: 16
    }));
    dimsG.appendChild(svgEl('text', {
      class: 'blueprint__dim-label',
      x: xDim, y: drawY + drawH / 2 + 4,
      transform: 'rotate(-90 ' + xDim + ' ' + (drawY + drawH / 2) + ')'
    }, lblH));
    svg.appendChild(dimsG);

    /* — Callouts: до 4 частей, столбиком в правом свободном поле — */
    var calloutsG = svgEl('g', { class: 'blueprint__callouts' });
    var calloutTargets = parts.slice(0, Math.min(4, parts.length));
    var calloutStartX = drawX + drawW + 80;           // правее drawing area
    var calloutStartY = drawY + 30;
    var calloutStep   = 40;
    calloutTargets.forEach(function (name, idx) {
      var p = positions[idx];
      if (!p) return;
      var cxC = p.x + p.w - 6;                        // правый край части
      var cyC = p.y + p.h / 2;
      var labelX = calloutStartX;
      var labelY = calloutStartY + idx * calloutStep;
      // leader: от части → между drawing и label → к label-кругу
      var midX = drawX + drawW + 30;
      calloutsG.appendChild(svgEl('path', {
        class: 'blueprint__callout-leader',
        d: 'M ' + cxC + ' ' + cyC + ' L ' + midX + ' ' + cyC + ' L ' + (labelX - 12) + ' ' + labelY
      }));
      calloutsG.appendChild(svgEl('circle', {
        class: 'blueprint__callout-circle',
        cx: labelX, cy: labelY, r: 11
      }));
      calloutsG.appendChild(svgEl('text', {
        class: 'blueprint__callout-num',
        x: labelX, y: labelY
      }, String(idx + 1)));
      calloutsG.appendChild(svgEl('text', {
        class: 'blueprint__callout-label',
        x: labelX + 20, y: labelY + 3
      }, name));
    });
    svg.appendChild(calloutsG);

    /* — Title block: только в экспорте (runtime использует HTML-оверлей,
         который позиционируется относительно canvas, а не SVG viewBox,
         поэтому не уезжает в letterbox на широких экранах). — */
    if (forExport) {
      var tbW = 320, tbH = 96;
      var tbX = BP_VIEW_W - 16 - tbW;
      var tbY = BP_VIEW_H - 16 - tbH;
      var tbG = svgEl('g', { class: 'blueprint__title-block' });
      tbG.appendChild(svgEl('rect', {
        class: 'blueprint__title-block-frame',
        x: tbX, y: tbY, width: tbW, height: tbH
      }));
      tbG.appendChild(svgEl('text', {
        class: 'blueprint__title-block-key',
        x: tbX + 12, y: tbY + 18
      }, 'Project'));
      tbG.appendChild(svgEl('text', {
        class: 'blueprint__title-block-project',
        x: tbX + 12, y: tbY + 38
      }, title));
      tbG.appendChild(svgEl('line', {
        class: 'blueprint__title-block-divider',
        x1: tbX, y1: tbY + 48, x2: tbX + tbW, y2: tbY + 48
      }));
      var colW = tbW / 3;
      var cells = [
        { k: 'Drawing No', v: meta.no },
        { k: 'Scale',      v: '1:' + (meta.unit === 'cm' ? '4' : '8') },
        { k: 'Date',       v: (year || '—') }
      ];
      cells.forEach(function (cell, idx) {
        var cxTB = tbX + colW * idx + 12;
        tbG.appendChild(svgEl('text', {
          class: 'blueprint__title-block-key',
          x: cxTB, y: tbY + 64
        }, cell.k));
        tbG.appendChild(svgEl('text', {
          class: 'blueprint__title-block-val',
          x: cxTB, y: tbY + 82
        }, cell.v));
        if (idx < 2) {
          tbG.appendChild(svgEl('line', {
            class: 'blueprint__title-block-divider',
            x1: tbX + colW * (idx + 1), y1: tbY + 48,
            x2: tbX + colW * (idx + 1), y2: tbY + tbH
          }));
        }
      });
      svg.appendChild(tbG);
    }
    return svg;
  }
  /* HTML title-block — fixed к нижнему-правому углу page-canvas, 16px от краёв.
     Содержимое 1:1 с SVG-вариантом, но позиционируется по canvas, а не viewBox. */
  function makeTitleBlockHTML(id, pageIdx) {
    var pages = getBpPages(id);
    var meta = pages[pageIdx || 0];
    if (!meta) return null;
    var card = document.querySelector('.work-card[data-id="' + id + '"]');
    var year = card ? (card.querySelector('.work-card__year') || {}).textContent || '' : '';
    var title = card ? (card.querySelector('.work-card__title') || {}).textContent || id : id;
    var scale = '1:' + (meta.unit === 'cm' ? '4' : '8');

    var wrap = document.createElement('div');
    wrap.className = 'case-blueprints__title-block';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="case-blueprints__title-block-top">' +
        '<span class="case-blueprints__title-block-key">Project</span>' +
        '<span class="case-blueprints__title-block-project"></span>' +
      '</div>' +
      '<div class="case-blueprints__title-block-bottom">' +
        '<div class="case-blueprints__title-block-cell">' +
          '<span class="case-blueprints__title-block-key">Drawing No</span>' +
          '<span class="case-blueprints__title-block-val"></span>' +
        '</div>' +
        '<div class="case-blueprints__title-block-cell">' +
          '<span class="case-blueprints__title-block-key">Scale</span>' +
          '<span class="case-blueprints__title-block-val"></span>' +
        '</div>' +
        '<div class="case-blueprints__title-block-cell">' +
          '<span class="case-blueprints__title-block-key">Date</span>' +
          '<span class="case-blueprints__title-block-val"></span>' +
        '</div>' +
      '</div>';
    var vals = wrap.querySelectorAll('.case-blueprints__title-block-val');
    wrap.querySelector('.case-blueprints__title-block-project').textContent = title;
    vals[0].textContent = meta.no;
    vals[1].textContent = scale;
    vals[2].textContent = year || '—';
    return wrap;
  }

  function animateBlueprintReveal(svg) {
    if (!svg || !window.gsap) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // v0.22.3: grid и title-block теперь живут вне SVG (CSS + HTML), реveal только для самой схемы.
    gsap.from(svg.querySelectorAll('.blueprint__parts > *'), {
      opacity: 0, y: 6, duration: 0.35, ease: 'power2.out',
      stagger: 0.04, delay: 0.05
    });
    gsap.from(svg.querySelectorAll('.blueprint__dimensions > *, .blueprint__callouts > *'), {
      opacity: 0, duration: 0.3, ease: 'power1.out',
      stagger: 0.03, delay: 0.25
    });
  }

  /* ──────────────────────────────────────────────────────────────────
     renderBlueprints(id) — собирает все страницы в .case-blueprints__canvas.
     На desktop CSS показывает только .case-blueprints__page.is-current,
     на mobile — все страницы колонкой. Pager (prev/next/counter) виден
     только на desktop при pages.length > 1. На mobile per-page тулбар
     даёт Export/FS для каждого SVG.
  ─────────────────────────────────────────────────────────────────── */
  var currentBpPage = 0;
  function fsIconSVG(kind) {
    if (kind === 'export') {
      return '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M8 2v8m0 0l-3-3m3 3l3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    // 'fs'
    return '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
      '<path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
  }
  function makePageExportBtn(pageIdx) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bp-export-btn case-blueprints__page-export';
    b.setAttribute('data-bp-page', pageIdx);
    // Phase 4b — page aria через tFmt + label через t().
    var __I = window.I18N;
    b.setAttribute('aria-label',
      (__I && __I.tFmt) ? __I.tFmt('bp.exportPage', { n: pageIdx + 1 })
                        : 'Export blueprint page ' + (pageIdx + 1) + ' as SVG');
    var __lbl = (__I && __I.t) ? __I.t('btn.exportSvg') : 'Export SVG';
    b.innerHTML = fsIconSVG('export') + '<span class="bp-export-btn__label" data-i18n="btn.exportSvg">' + __lbl + '</span>';
    b.querySelector('svg').setAttribute('class', 'bp-export-btn__icon');
    return b;
  }
  function makePageFsBtn(pageIdx) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'case-blueprints__fs-btn case-blueprints__page-fs';
    b.setAttribute('data-bp-page', pageIdx);
    // Phase 4b
    var __I = window.I18N;
    b.setAttribute('aria-label',
      (__I && __I.tFmt) ? __I.tFmt('bp.fullscreenPage', { n: pageIdx + 1 })
                        : 'Open blueprint page ' + (pageIdx + 1) + ' fullscreen');
    b.setAttribute('title', (__I && __I.t) ? __I.t('title.fullscreen') : 'Fullscreen');
    b.innerHTML = fsIconSVG('fs');
    b.querySelector('svg').setAttribute('class', 'case-blueprints__fs-btn__icon');
    return b;
  }
  function makePager(total) {
    var wrap = document.createElement('div');
    wrap.className = 'case-blueprints__pager';
    if (total <= 1) wrap.hidden = true;

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'case-blueprints__pager-btn case-blueprints__pager-btn--prev';
    // Phase 4b
    var __Ip = window.I18N;
    prev.setAttribute('aria-label', (__Ip && __Ip.t) ? __Ip.t('bp.previous') : 'Previous blueprint');
    prev.setAttribute('data-cursor', 'link');
    prev.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4L5 9l6 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    prev.addEventListener('click', function () { setCurrentBpPage(currentBpPage - 1); });

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'case-blueprints__pager-btn case-blueprints__pager-btn--next';
    // Phase 4b
    var __In = window.I18N;
    next.setAttribute('aria-label', (__In && __In.t) ? __In.t('bp.next') : 'Next blueprint');
    next.setAttribute('data-cursor', 'link');
    next.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    next.addEventListener('click', function () { setCurrentBpPage(currentBpPage + 1); });

    var counter = document.createElement('span');
    counter.className = 'case-blueprints__pager-counter';
    counter.setAttribute('aria-live', 'polite');

    wrap.appendChild(prev);
    wrap.appendChild(next);
    wrap.appendChild(counter);
    return wrap;
  }
  function renderBlueprints(id) {
    if (!caseBlueprintsCanvas) return;
    var pages = getBpPages(id);
    if (!pages.length) {
      caseBlueprintsCanvas.innerHTML = '';
      blueprintBuiltFor = null;
      return;
    }
    caseBlueprintsCanvas.innerHTML = '';
    currentBpPage = 0;

    pages.forEach(function (_, idx) {
      var pageEl = document.createElement('div');
      pageEl.className = 'case-blueprints__page' + (idx === 0 ? ' is-current' : '');
      pageEl.setAttribute('data-bp-page', idx);

      var canvas = document.createElement('div');
      canvas.className = 'case-blueprints__page-canvas';
      var svg = buildBlueprintSVG(id, idx);
      if (svg) canvas.appendChild(svg);
      var titleBlock = makeTitleBlockHTML(id, idx);
      if (titleBlock) canvas.appendChild(titleBlock);
      pageEl.appendChild(canvas);

      var bar = document.createElement('div');
      bar.className = 'case-blueprints__page-toolbar';
      bar.appendChild(makePageExportBtn(idx));
      bar.appendChild(makePageFsBtn(idx));
      pageEl.appendChild(bar);

      caseBlueprintsCanvas.appendChild(pageEl);
    });

    var pager = makePager(pages.length);
    caseBlueprintsCanvas.appendChild(pager);
    updateBpPagerUI();

    blueprintBuiltFor = id;

    // Reveal: только активная страница (одна на desktop; на mobile та же,
    // остальные подтянутся бесшумно — экономия GSAP-тиков на длинных списках).
    var firstSvg = caseBlueprintsCanvas.querySelector('.case-blueprints__page.is-current svg');
    animateBlueprintReveal(firstSvg);
  }
  function updateBpPagerUI() {
    if (!caseBlueprintsCanvas) return;
    var total = getBpPages(currentCaseId).length;
    var counter = caseBlueprintsCanvas.querySelector('.case-blueprints__pager-counter');
    if (counter) counter.textContent = (currentBpPage + 1) + ' / ' + total;
    // v0.22.4: pager листает по кольцу — кнопки никогда не disable'ятся (как в media-fs gallery).
  }
  function setCurrentBpPage(idx) {
    var total = getBpPages(currentCaseId).length;
    if (total < 2) return;
    // v0.22.4: wrap modulo вместо clamp — листание циклически как в media-fs gallery.
    idx = ((idx % total) + total) % total;
    if (idx === currentBpPage) return;
    var prevEl = caseBlueprintsCanvas.querySelector('.case-blueprints__page.is-current');
    var nextEl = caseBlueprintsCanvas.querySelector('.case-blueprints__page[data-bp-page="' + idx + '"]');
    if (!nextEl) return;
    if (prevEl) prevEl.classList.remove('is-current');
    nextEl.classList.add('is-current');
    currentBpPage = idx;
    updateBpPagerUI();
    animateBlueprintReveal(nextEl.querySelector('svg'));
  }

  /* ══════════════════════════════════
     v0.11 — build3D(id) — ленивая загрузка <model-viewer>
     v0.5 — model-data.js теперь тоже lazy-loaded (issue #1: snizhayet LCP с 9.9s до ~2-3s).
            Скрипт инжектится при первом 3D-клике, не на page load.
  ══════════════════════════════════ */
  var MODEL_DATA_SRC = './js/model-data.js';
  var THREE_VIEWER_SRC = './vendor/codex-three-viewer.js';

  /* v0.5 — Lazy-load model-data.js. Возвращает Promise. Идемпотентно. */
  var modelDataLoading = null;
  var threeViewerLoading = null;
  function loadModelData() {
    if (modelDataLoading) return modelDataLoading;
    modelDataLoading = new Promise(function (resolve, reject) {
      // если уже загружен (повторный openCase 3D) — резолвим сразу
      if (window.CODEX_LOCAL_GLB) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = MODEL_DATA_SRC;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        // graceful degradation — без model-data fallback на ./assets/models/*.glb
        // (работает при открытии через http(s), но не file://)
        console.warn('[v0.5] model-data.js failed to load — fallback to direct GLB URLs');
        resolve();
      };
      document.head.appendChild(s);
    });
    return modelDataLoading;
  }

  function loadModelViewerScript() {
    if (window.CodexShared && typeof window.CodexShared.loadModelViewerScript === 'function') {
      return window.CodexShared.loadModelViewerScript();
    }
    return Promise.reject(new Error('CodexShared model-viewer loader missing'));
  }

  function loadThreeViewer() {
    if (threeViewerLoading) return threeViewerLoading;
    threeViewerLoading = import(THREE_VIEWER_SRC);
    return threeViewerLoading;
  }

  function resolveModelSource(data) {
    var src = data && data.modelSrc;
    if (src && src.indexOf('./assets/models/') === 0 && window.CODEX_LOCAL_GLB) {
      var key = src.replace('./assets/models/', '').replace(/\.glb$/, '');
      if (window.CODEX_LOCAL_GLB[key]) src = window.CODEX_LOCAL_GLB[key];
    }
    return src;
  }

  function render3DFallback(title, hint) {
    if (!case3dCanvas) return;
    case3dCanvas.classList.remove('is-ready');
    case3dCanvas.innerHTML =
      '<div class="case-3d__fallback">' +
        '<svg class="case-3d__fallback-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">' +
          '<polygon points="24,4 42,14 42,34 24,44 6,34 6,14" stroke-linejoin="round"/>' +
          '<polyline points="6,14 24,24 42,14" stroke-linejoin="round"/>' +
          '<line x1="24" y1="24" x2="24" y2="44"/>' +
        '</svg>' +
        '<p class="case-3d__fallback-title">' + title + '</p>' +
        '<p class="case-3d__fallback-hint">' + hint + '</p>' +
      '</div>';
  }

  /* v0.11.1 — верстка info-панели со статистикой модели */
  function buildInfoHTML(data) {
    var s = (data && data.modelStats) || {};
    function cell(label, value) {
      return (
        '<tr>' +
          '<td class="case-3d__info-label">' + label + '</td>' +
          '<td class="case-3d__info-value">' + (value == null || value === '' ? '—' : value) + '</td>' +
        '</tr>'
      );
    }
    return (
      '<h4 class="case-3d__info-title">MODEL INFO</h4>' +
      '<table class="case-3d__info-table"><tbody>' +
        cell('Triangles', s.triangles) +
        cell('Vertices',  s.vertices) +
        cell('Materials', s.materials) +
        cell('Textures',  s.textures) +
        cell('Software',  s.software) +
      '</tbody></table>'
    );
  }

  function destroy3D() {
    // v0.11.4 — явная утилизация предыдущего <model-viewer>: снимаем атрибуты,
    // убиваем tween-ы, удаляем из DOM и обнуляем ссылки, чтобы GC забрал инстанс
    // v0.7.3 — cleanup global listeners для light-dropdown (close on outside / Escape)
    if (currentLightDdDocClick) {
      document.removeEventListener('click', currentLightDdDocClick);
      currentLightDdDocClick = null;
    }
    if (currentLightDdDocKey) {
      document.removeEventListener('keydown', currentLightDdDocKey);
      currentLightDdDocKey = null;
    }
    if (currentThreeViewer && typeof currentThreeViewer.dispose === 'function') {
      try { currentThreeViewer.dispose(); } catch (_) { /* no-op */ }
      currentThreeViewer = null;
    }
    currentThreeSource = null;
    if (currentMv) {
      try { currentMv.removeAttribute('src'); } catch (_) { /* no-op */ }
      try { currentMv.remove(); } catch (_) { /* no-op */ }
      currentMv = null;
    }
    currentMvReset = null;
  }

  function mountModelViewer3D(options) {
    options = options || {};
    var id = options.caseId;
    if (!case3dCanvas || !id) return;
    var data = options.data || CARDS_DATA[id];
    if (!data) return;

    // v0.11.4 — утилизируем предыдущий MV, чтобы не копить инстансы
    destroy3D();

    // Нет модели → fallback сразу
    if (!data.modelSrc) {
      render3DFallback(
        'MODEL SOON',
        'Интерактивная 3D-модель готовится. Пока смотри 2D-рендеры и технический чертёж.'
      );
      model3dBuiltFor = id;
      return;
    }

    // Loading state
    render3DFallback(
      'LOADING 3D',
      'Подгружаем интерактивный вьюер и GLB-модель. Первый запуск занимает несколько секунд.'
    );
    model3dBuiltFor = id;
    var targetId = id;

    loadModelViewerScript().then(function () {
      // v0.5 — после загрузки model-viewer ждём model-data (для CODEX_LOCAL_GLB)
      return loadModelData();
    }).then(function () {
      // за время загрузки скрипта пользователь мог переключить кейс
      if (model3dBuiltFor !== targetId || currentCaseId !== targetId) return;

      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var autoRotateOn = !prefersReduced;
      // v0.14.0 [4] — Model Info: in-memory глобальный флаг. true при первой загрузке
      // страницы; пользователь выключил — выключен во всех последующих кейсах
      // сессии. Перезагрузка страницы — снова true (sandbox блокирует storage).
      // v0.15.4 [П2] — mobile: MI всегда OFF на старте каждога кейса,
      // клик на mobile НЕ меняет CODEX_MI_ON (desktop-логика изолирована).
      var isMobileMI = window.matchMedia('(max-width: 767px)').matches;
      if (typeof window.CODEX_MI_ON === 'undefined') window.CODEX_MI_ON = true;
      var infoOn = isMobileMI ? false : window.CODEX_MI_ON;

      // v0.11.4 — если страница открыта через file:// — относительные пути к GLB ломаются о CORS.
      // Подменяем src на data:URI из window.CODEX_LOCAL_GLB (инлайн в model-data.js).
      var src = data.modelSrc;
      if (src && src.indexOf('./assets/models/') === 0 && window.CODEX_LOCAL_GLB) {
        var key = src.replace('./assets/models/', '').replace(/\.glb$/, '');
        if (window.CODEX_LOCAL_GLB[key]) {
          src = window.CODEX_LOCAL_GLB[key];
        }
      }

      var mv = document.createElement('model-viewer');
      mv.setAttribute('src', src);
      mv.setAttribute('alt', (data.title || id) + ' — 3D model');
      mv.setAttribute('camera-controls', '');
      // v0.11.4 — 'none' разрешает pinch-zoom и drag-orbit на тач-устройствах
      mv.setAttribute('touch-action', 'none');
      mv.setAttribute('shadow-intensity', '0');
      mv.setAttribute('exposure', '1');
      // v0.7.0 — IBL через HDR. Default: studio. Switcher меняет атрибут.
      // ACES Filmic tone mapping включается model-viewer'ом по умолчанию при
      // .hdr environment-image (вместо предыдущего 'neutral' procedural).
      // v0.7.1 — file:// CORS fallback. Браузер блокирует fetch HDR-файлов с диска
      // как cross-origin (тот же баг, что у GLB — см. v0.11.4 ниже). Решение:
      // на file:// — fallback на 'neutral' (procedural, без сети), env-switcher
      // и exposure-slider скрываются. На http(s):// — реальные HDR.
      var isFileProtocol = window.location.protocol === 'file:';
      if (isFileProtocol) {
        mv.setAttribute('environment-image', 'neutral');
      } else {
        mv.setAttribute('environment-image', './assets/hdr/studio.hdr');
      }
      mv.setAttribute('loading', 'lazy');
      mv.setAttribute('reveal', 'auto');
      mv.setAttribute('interaction-prompt', 'none');
      // v0.11.4 — разрешаем zoom/pan: нативный MV их включает по умолчанию,
      // но явно фиксируем диапазон, чтобы модель не «убегала» далеко
      mv.setAttribute('min-camera-orbit', 'auto auto 2%');
      mv.setAttribute('max-camera-orbit', 'auto auto 400%');
      // v0.14.0 [3] — плавный reset-camera через exponential decay model-viewer'а.
      // Default ~50ms (ощущается мгновенным). 200ms — примерно в 3 раза медленнее.
      mv.setAttribute('interpolation-decay', '200');
      if (autoRotateOn) {
        mv.setAttribute('auto-rotate', '');
        // v0.14.0 [5] — delay 2000ms → 4000ms (модель дольше неподвижная).
        mv.setAttribute('auto-rotate-delay', '4000');
        mv.setAttribute('rotation-per-second', '15deg');
      }

      // v0.11.4 — сохраняем initial camera-state на первом load → для корректного reset
      var initialOrbit = null;
      var initialTarget = null;
      var initialFov = null;
      mv.addEventListener('load', function () {
        if (case3dCanvas) case3dCanvas.classList.add('is-ready');
        // v0.13.3 — shadow DOM model-viewer внутри ставит `.userInput { cursor: grab }`
        //           и `canvas.show { cursor: grab }`. Внешний `html.cursor-fine *` не
        //           проходит shadow boundary. Инжектим стиль в shadowRoot
        //           (последним, при равной специфичности перебивает
        //           встроенные `cursor: grab`). На touch класс `cursor-fine` не
        //           поставлен — блок пропускается, `grab` сохраняется.
        if (document.documentElement.classList.contains('cursor-fine') && mv.shadowRoot) {
          try {
            var shadowStyle = document.createElement('style');
            // model-viewer ставит `cursor: grab` прямо inline на `.userInput`.
            // Inline style = специфичность 1000 — перебить можно только `!important`.
            // Это единственное место в проекте с `!important` и оно
            // изолировано в shadowRoot третьей стороны (не попадает в css/main.css
            // и не влияет на дизайн-систему проекта).
            shadowStyle.textContent =
              ':host { cursor: none !important; } ' +
              '.userInput, .userInput *, .slot.canvas, canvas, canvas.show { cursor: none !important; }';
            mv.shadowRoot.appendChild(shadowStyle);
          } catch (_) { /* shadowRoot может быть closed — не критично */ }
        }
        try {
          if (initialOrbit == null) {
            initialOrbit = mv.getCameraOrbit().toString();
            initialTarget = mv.getCameraTarget().toString();
            initialFov = mv.getFieldOfView() + 'deg';
          }
        } catch (_) { /* no-op */ }
      });
      mv.addEventListener('error', function () {
        render3DFallback(
          'MODEL UNAVAILABLE',
          'Не удалось загрузить GLB. Проверь интернет-соединение или вернись к 2D / Blueprints.'
        );
      });

      // wheel = nativный MV zoom, drag = orbit, pinch = zoom на mobile (touch-action: none выше).

      /* UI: hint + controls + info panel */
      // v0.15.1 [1.5] — два варианта хинта для desktop/mobile,
      // видимость переключается через @media pointer/hover в CSS.
      // Phase 4b — i18n hint texts. data-i18n attached so walker re-applies
      // on language change без необходимости re-build 3D-viewer.
      var __viz = window.I18N;
      var hint = document.createElement('div');
      hint.className = 'case-3d__hint case-3d__hint--desktop';
      hint.setAttribute('data-i18n', 'viz.hintDesktop');
      hint.textContent = (__viz && __viz.t) ? __viz.t('viz.hintDesktop') : 'RIGHT MOUSE · ROTATE';

      var hintMobile = document.createElement('div');
      hintMobile.className = 'case-3d__hint case-3d__hint--mobile';
      hintMobile.setAttribute('data-i18n', 'viz.hintMobile');
      hintMobile.textContent = (__viz && __viz.t) ? __viz.t('viz.hintMobile') : 'DRAG · ZOOM';

      var controls = document.createElement('div');
      controls.className = 'case-3d__controls';

      var autoBtn = document.createElement('button');
      autoBtn.type = 'button';
      autoBtn.className = 'case-3d__ctrl' + (autoRotateOn ? ' is-on' : '');
      autoBtn.setAttribute('aria-pressed', autoRotateOn ? 'true' : 'false');
      autoBtn.textContent = '';
      // v0.7.7 [planshet-fix]: dual-text для responsive swap.
      // .full виден на mobile/desktop (default), .short — на planshet 768-1023
      // (через @media в portfolio.css). На клик меняется только classList,
      // innerHTML не трогается → state preserved. См. main.js:2194 click handler.
      autoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">AUTO ROTATION</span><span class="case-3d__ctrl__txt-short">Auto-R</span>';

      var infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'case-3d__ctrl';
      infoBtn.setAttribute('aria-pressed', 'false');
      infoBtn.textContent = '';
      // v0.7.7 [planshet-fix]: dual-text — см. autoBtn выше.
      infoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">MODEL INFO</span><span class="case-3d__ctrl__txt-short">Info</span>';
      // v0.14.0 [4] — MI по умолчанию включен (или то, что было в предыдущем кейсе).
      if (infoOn) {
        infoBtn.classList.add('is-on');
        infoBtn.setAttribute('aria-pressed', 'true');
      }

      // v0.11.2 — icon-only reset: возвращает камеру в initial position
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'case-3d__ctrl case-3d__ctrl--icon';
      // Phase 4b — viz.resetCamera. title — англоязычный short tooltip,
      // мы используем тот же aria-text без 'to initial position' части.
      var __v1 = window.I18N;
      resetBtn.setAttribute('aria-label', (__v1 && __v1.t) ? __v1.t('viz.resetCamera') : 'Reset camera to initial position');
      resetBtn.setAttribute('title', (__v1 && __v1.t) ? __v1.t('viz.resetCamera') : 'Reset camera');
      resetBtn.innerHTML =
        '<svg class="case-3d__ctrl-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3 8a5 5 0 1 0 1.46-3.54"/>' +
          '<polyline points="3,3 3,6 6,6"/>' +
        '</svg>';

      // v0.15.1 [2.2] — fullscreen-кнопка для 3D. Клон модели открывается через .media-fs overlay.
      var fsBtn3d = document.createElement('button');
      fsBtn3d.type = 'button';
      fsBtn3d.className = 'case-3d__fs-btn';
      // Phase 4b
      var __v2 = window.I18N;
      fsBtn3d.setAttribute('aria-label', (__v2 && __v2.t) ? __v2.t('viz.openFullscreen3d') : 'Open 3D fullscreen');
      fsBtn3d.setAttribute('title', 'Fullscreen');
      // v0.19.0 — override drag-state из родительского .case-3d__canvas
      fsBtn3d.setAttribute('data-cursor', 'link');
      fsBtn3d.innerHTML = '<svg class="case-3d__fs-btn__icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';

      controls.appendChild(autoBtn);
      controls.appendChild(infoBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(fsBtn3d);

      /* ══════════════════════════════════
         v0.7.0 — Environment switcher (Studio / Outdoor / Dark) + Exposure slider.
         IBL через .hdr файлы из ./assets/hdr/. ACES Filmic tone mapping
         делается model-viewer'ом по умолчанию для HDR. Состояние НЕ персистится
         (sandbox блокирует storage) — каждый кейс начинается со Studio + exposure 1.0.

         v0.7.1 — file:// guard: если страница открыта двойным кликом, HDR-файлы
         блокируются CORS (тот же баг, что у GLB). UI HDR-controls скрывается,
         model-viewer работает на 'neutral' procedural. Console.warn разработчику.
      ══════════════════════════════════ */
      if (isFileProtocol) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[v0.7.1] HDR environment maps require an HTTP(S) server. ' +
            'Open via "python3 -m http.server" or deploy to GitHub Pages / Netlify. ' +
            'Falling back to procedural \'neutral\' environment.'
          );
        }
      } else {
        var ENV_PRESETS = {
          studio:  './assets/hdr/studio.hdr',
          outdoor: './assets/hdr/outdoor.hdr',
          citrus:  './assets/hdr/experimental/citrus-orchard-puresky-4k.hdr',
          dark:    './assets/hdr/dark.hdr'
        };
        var ENVIRONMENT_MODES = Object.keys(ENV_PRESETS);
        var currentEnv = data.modelEnvironment && ENV_PRESETS[data.modelEnvironment] ? data.modelEnvironment : 'studio';
        mv.setAttribute('environment-image', ENV_PRESETS[currentEnv]);

        // v0.7.3 — early-decl syncEnvUI: обновляет visual state на ОБОИХ
        // env-button наборах (desktop inline + mobile dropdown). Объявлена
        // до создания DOM, чтобы избежать клон-replace хака.
        function syncEnvUI(key) {
          var sel = '[data-env]';
          var roots = [envGroup, ddEnvList];
          roots.forEach(function (root) {
            if (!root) return;
            root.querySelectorAll(sel).forEach(function (b) {
              var on = b.dataset.env === key;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
          });
        }

        // v0.8.6 [M6] — фабрика env-кнопки. Раньше блок ниже дублировался
        // дважды (desktop envGroup + mobile ddEnvList) — только className
        // различался; click-handler был идентичен. Закрытие захватывает
        // currentEnv, mv, syncEnvUI, ENV_PRESETS из scope build3D.
        function createEnvBtn(key, className) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = className + (key === currentEnv ? ' is-on' : '');
          btn.setAttribute('aria-pressed', key === currentEnv ? 'true' : 'false');
          btn.dataset.env = key;
          btn.textContent = key.toUpperCase();
          btn.addEventListener('click', function () {
            if (currentEnv === key) return;
            currentEnv = key;
            mv.setAttribute('environment-image', ENV_PRESETS[key]);
            syncEnvUI(key);
          });
          return btn;
        }

        var envGroup = document.createElement('div');
        envGroup.className = 'case-3d__env-group';
        envGroup.setAttribute('role', 'group');
        // Phase 4b
        var __v3 = window.I18N;
        envGroup.setAttribute('aria-label', (__v3 && __v3.t) ? __v3.t('viz.envPreset') : 'Environment preset');

        ENVIRONMENT_MODES.forEach(function (key) {
          envGroup.appendChild(createEnvBtn(key, 'case-3d__ctrl case-3d__ctrl--env'));
        });

        // Exposure slider — диапазон 0.5–2.0, default 1.0, step 0.05.
        // Значение пишется в model-viewer property mv.exposure (быстрее, чем setAttribute).
        var expoWrap = document.createElement('label');
        expoWrap.className = 'case-3d__expo';
        // Phase 4b
        var __v4 = window.I18N;
        expoWrap.setAttribute('aria-label', (__v4 && __v4.t) ? __v4.t('viz.exposure') : 'Exposure');

        var expoLabelEl = document.createElement('span');
        expoLabelEl.className = 'case-3d__expo-label';
        // Phase 4b — data-i18n чтобы walker рестейтил при смене языка.
        var __v5 = window.I18N;
        expoLabelEl.setAttribute('data-i18n', 'viz.exposureLabel');
        expoLabelEl.textContent = (__v5 && __v5.t) ? __v5.t('viz.exposureLabel') : 'EXPOSURE';

        var expoInput = document.createElement('input');
        expoInput.type = 'range';
        expoInput.min = '0.5';
        expoInput.max = '2';
        expoInput.step = '0.05';
        expoInput.value = '1';
        expoInput.className = 'case-3d__expo-input';
        // Phase 4b
        var __v6 = window.I18N;
        expoInput.setAttribute('aria-label', (__v6 && __v6.t) ? __v6.t('viz.exposureRange') : 'Exposure level from 0.5 to 2.0');

        // v0.7.3 — единый handler: меняет mv.exposure + синхронизирует mobile slider.
        // ddExpoInput объявляется ниже (forward-ref OK — handler работает после mount).
        expoInput.addEventListener('input', function () {
          mv.exposure = parseFloat(expoInput.value);
          if (typeof ddExpoInput !== 'undefined' && ddExpoInput.value !== expoInput.value) {
            ddExpoInput.value = expoInput.value;
          }
        });

        expoWrap.appendChild(expoLabelEl);
        expoWrap.appendChild(expoInput);

        controls.appendChild(envGroup);
        controls.appendChild(expoWrap);

        /* ══════════════════════════════════
           v0.7.3 — Mobile/tablet light-dropdown.
           На ≤1023px envGroup + expoWrap скрыты через CSS, показывается
           эта компактная кнопка-trigger (иконка лампочки) → раскрывает
           panel со списком 3 кнопок Studio/Outdoor/Dark + Exposure slider.
           Состояние currentEnv и exposure shared между обоими UI:
           - syncEnvUI() обновляет оба варианта при смене env
           - input listeners на обоих slider'ах синхронизируют значение в обе стороны
           Pattern референс: tags-dropdown__trigger из shared.css (но без
           checkboxes — здесь radio-выбор через aria-pressed).
        ══════════════════════════════════ */
        var lightDd = document.createElement('div');
        lightDd.className = 'case-3d__light-dd';
        lightDd.dataset.open = 'false';

        var lightTrigger = document.createElement('button');
        lightTrigger.type = 'button';
        lightTrigger.className = 'case-3d__ctrl case-3d__ctrl--icon case-3d__light-dd__trigger';
        lightTrigger.setAttribute('aria-haspopup', 'true');
        lightTrigger.setAttribute('aria-expanded', 'false');
        // Phase 4b
        var __v7 = window.I18N;
        lightTrigger.setAttribute('aria-label', (__v7 && __v7.t) ? __v7.t('viz.lightingSettings') : 'Lighting settings');
        // Lightbulb icon — env + exposure = lighting controls
        lightTrigger.innerHTML =
          '<svg class="case-3d__ctrl-icon" viewBox="0 0 20 20" width="16" height="16" ' +
          'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
          'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
          '<path d="M10 2.5c-3 0-5 2.2-5 4.8 0 1.7.8 3.1 2 4v2h6v-2c1.2-.9 2-2.3 2-4 0-2.6-2-4.8-5-4.8z"/>' +
          '<path d="M8 16h4M8.5 18h3"/>' +
          '</svg>';

        var lightPanel = document.createElement('div');
        lightPanel.className = 'case-3d__light-dd__panel';
        lightPanel.hidden = true;
        lightPanel.setAttribute('role', 'group');
        // Phase 4b
        var __v8 = window.I18N;
        lightPanel.setAttribute('aria-label', (__v8 && __v8.t) ? __v8.t('viz.lightingPanel') : 'Lighting presets and exposure');

        // Section title for env list
        var ddEnvLabel = document.createElement('div');
        ddEnvLabel.className = 'case-3d__light-dd__section-label';
        // Phase 4b
        var __v9 = window.I18N;
        ddEnvLabel.setAttribute('data-i18n', 'viz.environmentLabel');
        ddEnvLabel.textContent = (__v9 && __v9.t) ? __v9.t('viz.environmentLabel') : 'ENVIRONMENT';
        lightPanel.appendChild(ddEnvLabel);

        // Vertical list of env buttons
        var ddEnvList = document.createElement('div');
        ddEnvList.className = 'case-3d__light-dd__env-list';
        ddEnvList.setAttribute('role', 'group');
        // Phase 4b
        var __v10 = window.I18N;
        ddEnvList.setAttribute('aria-label', (__v10 && __v10.t) ? __v10.t('viz.envPreset') : 'Environment preset');

        // v0.8.6 [M6] — фабрика createEnvBtn (см. desktop envGroup выше).
        ENVIRONMENT_MODES.forEach(function (key) {
          ddEnvList.appendChild(createEnvBtn(key, 'case-3d__light-dd__env-btn'));
        });
        lightPanel.appendChild(ddEnvList);

        // Section title for exposure
        var ddExpoLabel = document.createElement('label');
        ddExpoLabel.className = 'case-3d__light-dd__section-label';
        // Phase 4b
        var __v11 = window.I18N;
        ddExpoLabel.setAttribute('data-i18n', 'viz.exposureLabel');
        ddExpoLabel.textContent = (__v11 && __v11.t) ? __v11.t('viz.exposureLabel') : 'EXPOSURE';
        lightPanel.appendChild(ddExpoLabel);

        // Mobile exposure slider (mirrors expoInput)
        var ddExpoInput = document.createElement('input');
        ddExpoInput.type = 'range';
        ddExpoInput.min = '0.5';
        ddExpoInput.max = '2';
        ddExpoInput.step = '0.05';
        ddExpoInput.value = '1';
        ddExpoInput.className = 'case-3d__light-dd__expo-input';
        // Phase 4b
        var __v12 = window.I18N;
        ddExpoInput.setAttribute('aria-label', (__v12 && __v12.t) ? __v12.t('viz.exposureRange') : 'Exposure level from 0.5 to 2.0');

        ddExpoInput.addEventListener('input', function () {
          var v = parseFloat(ddExpoInput.value);
          mv.exposure = v;
          // sync desktop slider silently (без re-fire события input)
          if (expoInput.value !== ddExpoInput.value) expoInput.value = ddExpoInput.value;
        });
        lightPanel.appendChild(ddExpoInput);

        // Toggle dropdown open/close
        function closeLightDd() {
          if (lightDd.dataset.open !== 'true') return;
          lightDd.dataset.open = 'false';
          lightTrigger.setAttribute('aria-expanded', 'false');
          lightPanel.hidden = true;
        }
        function openLightDd() {
          lightDd.dataset.open = 'true';
          lightTrigger.setAttribute('aria-expanded', 'true');
          lightPanel.hidden = false;
        }
        lightTrigger.addEventListener('click', function (e) {
          e.stopPropagation();
          if (lightDd.dataset.open === 'true') closeLightDd();
          else openLightDd();
        });
        // v0.7.3 — global listeners (close on outside click / Escape).
        // Регистрируются в module-level vars для cleanup в destroy3D —
        // иначе при смене кейса они бы накапливались и держали ссылки на удалённый lightDd.
        currentLightDdDocClick = function (e) {
          if (lightDd.dataset.open !== 'true') return;
          if (lightDd.contains(e.target)) return;
          closeLightDd();
        };
        currentLightDdDocKey = function (e) {
          if (e.key === 'Escape' && lightDd.dataset.open === 'true') {
            closeLightDd();
            lightTrigger.focus();
          }
        };
        document.addEventListener('click', currentLightDdDocClick);
        document.addEventListener('keydown', currentLightDdDocKey);

        lightDd.appendChild(lightTrigger);
        lightDd.appendChild(lightPanel);
        controls.appendChild(lightDd);
      }

      var infoPanel = document.createElement('div');
      infoPanel.className = 'case-3d__info-panel';
      infoPanel.innerHTML = buildInfoHTML(data);
      // v0.14.0 [4] — панель видима сразу, если infoOn=true (из глобального флага).
      if (infoOn) infoPanel.classList.add('is-visible');

      autoBtn.addEventListener('click', function () {
        autoRotateOn = !autoRotateOn;
        autoBtn.classList.toggle('is-on', autoRotateOn);
        autoBtn.setAttribute('aria-pressed', autoRotateOn ? 'true' : 'false');
        if (autoRotateOn) {
          // v0.14.0 [5] — delay такой же как на первом запуске (было 600ms — слишком быстро).
          mv.setAttribute('auto-rotate-delay', '4000');
          mv.setAttribute('auto-rotate', '');
          mv.setAttribute('rotation-per-second', '15deg');
        } else {
          mv.removeAttribute('auto-rotate');
        }
      });

      infoBtn.addEventListener('click', function () {
        infoOn = !infoOn;
        // v0.14.0 [4] — синхронизация с глобальным флагом для следующих кейсов.
        // v0.15.4 [П2] — на mobile глобальный флаг НЕ трогаем, чтобы каждый кейс начинался с OFF.
        if (!isMobileMI) window.CODEX_MI_ON = infoOn;
        infoBtn.classList.toggle('is-on', infoOn);
        infoBtn.setAttribute('aria-pressed', infoOn ? 'true' : 'false');
        infoPanel.classList.toggle('is-visible', infoOn);
      });

      // v0.14.0 [3] — плавный reset-camera. Раньше звался jumpCameraToGoal() — мгновенно.
      // Теперь свойства cameraOrbit/cameraTarget/fieldOfView ставятся как target для
      // встроенной интерполяции model-viewer'а (interpolation-decay=200, см. выше).
      // Это даёт плавный «подлёт» к initial position за ~600-900ms (2-3× медленнее прежнего).
      function resetCameraToInitial() {
        try {
          mv.removeAttribute('camera-orbit');
          mv.removeAttribute('camera-target');
          mv.removeAttribute('field-of-view');
          if (initialOrbit)  mv.cameraOrbit  = initialOrbit;
          if (initialTarget) mv.cameraTarget = initialTarget;
          if (initialFov)    mv.fieldOfView  = initialFov;
          // БЕЗ jumpCameraToGoal — даём MV интерполировать к target.
          if (typeof mv.resetInteractionPrompt === 'function') mv.resetInteractionPrompt();
          if (autoRotateOn) {
            mv.setAttribute('auto-rotate-delay', '4000');
            mv.setAttribute('auto-rotate', '');
          }
        } catch (_) { /* no-op */ }
      }
      currentMvReset = resetCameraToInitial;

      resetBtn.addEventListener('click', function () {
        // короткая pulse-подсветка кнопки как feedback
        resetBtn.classList.add('is-pulse');
        setTimeout(function () { resetBtn.classList.remove('is-pulse'); }, 520);
        resetCameraToInitial();
      });

      case3dCanvas.innerHTML = '';
      case3dCanvas.appendChild(mv);
      case3dCanvas.appendChild(hint);
      case3dCanvas.appendChild(hintMobile); // v0.15.1 [1.5] — mobile-вариант хинта
      case3dCanvas.appendChild(controls);
      case3dCanvas.appendChild(infoPanel);
      currentMv = mv;
    }).catch(function () {
      render3DFallback(
        'VIEWER OFFLINE',
        'Не удалось подгрузить <model-viewer>. Проверь интернет-соединение.'
      );
    });
  }

  function mountThreeViewer3D(options) {
    options = options || {};
    var id = options.caseId;
    if (!case3dCanvas || !id) return;
    var data = options.data || CARDS_DATA[id];
    if (!data) return;

    destroy3D();

    if (!data.modelSrc) {
      render3DFallback(
        'MODEL SOON',
        'Интерактивная 3D-модель готовится. Пока смотри 2D-рендеры и технический чертеж.'
      );
      model3dBuiltFor = id;
      return;
    }

    render3DFallback(
      'LOADING 3D',
      'Подгружаем интерактивный вьюер и GLB-модель. Первый запуск занимает несколько секунд.'
    );
    model3dBuiltFor = id;
    var targetId = id;

    Promise.all([loadModelData(), loadThreeViewer()]).then(function (result) {
      if (model3dBuiltFor !== targetId || currentCaseId !== targetId) return;

      var threeRuntime = result[1];
      if (!threeRuntime || !threeRuntime.canUseCodexThreeViewer || !threeRuntime.canUseCodexThreeViewer()) {
        mountModelViewer3D(options);
        return;
      }

      var src = resolveModelSource(data);
      if (!src) {
        render3DFallback('MODEL SOON', 'Интерактивная 3D-модель готовится.');
        return;
      }

      var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var autoRotateOn = !prefersReduced;
      var isMobileMI = window.matchMedia('(max-width: 767px)').matches;
      if (typeof window.CODEX_MI_ON === 'undefined') window.CODEX_MI_ON = true;
      var infoOn = isMobileMI ? false : window.CODEX_MI_ON;
      var ENVIRONMENT_MODES = ['studio', 'outdoor', 'dark', 'citrus'];
      var currentEnv = ENVIRONMENT_MODES.indexOf(data.modelEnvironment) >= 0 ? data.modelEnvironment : 'studio';
      var initialExposure = Number.isFinite(data.modelExposure) ? data.modelExposure : 1;
      var currentMaterial = 'pbr';
      var MATERIAL_MODES = {
        pbr: 'PBR',
        clay: 'CLAY',
        xray: 'XRAY'
      };

      var __viz = window.I18N;
      var hint = document.createElement('div');
      hint.className = 'case-3d__hint case-3d__hint--desktop';
      hint.setAttribute('data-i18n', 'viz.hintDesktop');
      hint.textContent = (__viz && __viz.t) ? __viz.t('viz.hintDesktop') : 'RIGHT MOUSE · ROTATE';

      var hintMobile = document.createElement('div');
      hintMobile.className = 'case-3d__hint case-3d__hint--mobile';
      hintMobile.setAttribute('data-i18n', 'viz.hintMobile');
      hintMobile.textContent = (__viz && __viz.t) ? __viz.t('viz.hintMobile') : 'DRAG · ZOOM';

      var controls = document.createElement('div');
      controls.className = 'case-3d__controls';

      var autoBtn = document.createElement('button');
      autoBtn.type = 'button';
      autoBtn.className = 'case-3d__ctrl' + (autoRotateOn ? ' is-on' : '');
      autoBtn.setAttribute('aria-pressed', autoRotateOn ? 'true' : 'false');
      autoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">AUTO ROTATION</span><span class="case-3d__ctrl__txt-short">Auto-R</span>';

      var infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'case-3d__ctrl';
      infoBtn.setAttribute('aria-pressed', 'false');
      infoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">MODEL INFO</span><span class="case-3d__ctrl__txt-short">Info</span>';
      if (infoOn) {
        infoBtn.classList.add('is-on');
        infoBtn.setAttribute('aria-pressed', 'true');
      }

      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'case-3d__ctrl case-3d__ctrl--icon';
      var __v2 = window.I18N;
      resetBtn.setAttribute('aria-label', (__v2 && __v2.t) ? __v2.t('viz.resetCamera') : 'Reset camera');
      resetBtn.setAttribute('title', (__v2 && __v2.t) ? __v2.t('viz.resetCamera') : 'Reset camera');
      resetBtn.innerHTML =
        '<svg class="case-3d__ctrl-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3.5 7.5a4.5 4.5 0 1 1 1.2 3.1"/><path d="M3.2 11.5V8.2h3.3"/>' +
        '</svg>';

      var fsBtn3d = document.createElement('button');
      fsBtn3d.type = 'button';
      fsBtn3d.className = 'case-3d__fs-btn';
      var __vFs = window.I18N;
      fsBtn3d.setAttribute('aria-label', (__vFs && __vFs.t) ? __vFs.t('viz.openFullscreen') : 'Open 3D fullscreen');
      fsBtn3d.setAttribute('title', (__vFs && __vFs.t) ? __vFs.t('viz.openFullscreen') : 'Open 3D fullscreen');
      fsBtn3d.setAttribute('data-cursor', 'link');
      fsBtn3d.innerHTML = '<svg class="case-3d__fs-btn__icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 7V2h5M11 2h5v5M16 11v5h-5M7 16H2v-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';

      controls.appendChild(autoBtn);
      controls.appendChild(infoBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(fsBtn3d);

      function syncEnvUI(key) {
        [envGroup, ddEnvList].forEach(function (root) {
          if (!root) return;
          root.querySelectorAll('[data-env]').forEach(function (b) {
            var on = b.dataset.env === key;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
      }

      function syncMaterialUI(key) {
        [matGroup, ddMatList].forEach(function (root) {
          if (!root) return;
          root.querySelectorAll('[data-material-mode]').forEach(function (b) {
            var on = b.dataset.materialMode === key;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
      }

      function createEnvBtn(key, className) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className + (key === currentEnv ? ' is-on' : '');
        btn.setAttribute('aria-pressed', key === currentEnv ? 'true' : 'false');
        btn.dataset.env = key;
        btn.textContent = key.toUpperCase();
        btn.addEventListener('click', function () {
          if (currentEnv === key) return;
          currentEnv = key;
          if (currentThreeViewer && currentThreeViewer.setEnvironment) currentThreeViewer.setEnvironment(key);
          if (currentThreeSource) currentThreeSource.environment = key;
          syncEnvUI(key);
        });
        return btn;
      }

      function createMaterialBtn(key, className) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className + (key === currentMaterial ? ' is-on' : '');
        btn.setAttribute('aria-pressed', key === currentMaterial ? 'true' : 'false');
        btn.dataset.materialMode = key;
        btn.textContent = MATERIAL_MODES[key] || key.toUpperCase();
        btn.addEventListener('click', function () {
          if (currentMaterial === key) return;
          currentMaterial = key;
          if (currentThreeViewer && currentThreeViewer.setMaterialMode) currentThreeViewer.setMaterialMode(key);
          if (currentThreeSource) currentThreeSource.materialMode = key;
          syncMaterialUI(key);
        });
        return btn;
      }

      var envGroup = document.createElement('div');
      envGroup.className = 'case-3d__env-group';
      envGroup.setAttribute('role', 'group');
      var __v3 = window.I18N;
      envGroup.setAttribute('aria-label', (__v3 && __v3.t) ? __v3.t('viz.envPreset') : 'Environment preset');
      ENVIRONMENT_MODES.forEach(function (key) {
        envGroup.appendChild(createEnvBtn(key, 'case-3d__ctrl case-3d__ctrl--env'));
      });

      var matGroup = document.createElement('div');
      matGroup.className = 'case-3d__mat-group';
      matGroup.setAttribute('role', 'group');
      var __vMat = window.I18N;
      matGroup.setAttribute('aria-label', (__vMat && __vMat.t) ? __vMat.t('viz.materialMode') : 'Material view mode');
      Object.keys(MATERIAL_MODES).forEach(function (key) {
        matGroup.appendChild(createMaterialBtn(key, 'case-3d__ctrl case-3d__ctrl--mat'));
      });

      var expoWrap = document.createElement('label');
      expoWrap.className = 'case-3d__expo';
      var __v4 = window.I18N;
      expoWrap.setAttribute('aria-label', (__v4 && __v4.t) ? __v4.t('viz.exposure') : 'Exposure');

      var expoLabelEl = document.createElement('span');
      expoLabelEl.className = 'case-3d__expo-label';
      var __v5 = window.I18N;
      expoLabelEl.setAttribute('data-i18n', 'viz.exposureLabel');
      expoLabelEl.textContent = (__v5 && __v5.t) ? __v5.t('viz.exposureLabel') : 'EXPOSURE';

      var expoInput = document.createElement('input');
      expoInput.type = 'range';
      expoInput.min = '0.5';
      expoInput.max = '2';
      expoInput.step = '0.05';
      expoInput.value = String(initialExposure);
      expoInput.className = 'case-3d__expo-input';
      var __v6 = window.I18N;
      expoInput.setAttribute('aria-label', (__v6 && __v6.t) ? __v6.t('viz.exposureRange') : 'Exposure level from 0.5 to 2.0');

      expoInput.addEventListener('input', function () {
        var value = parseFloat(expoInput.value);
        if (currentThreeViewer && currentThreeViewer.setExposure) currentThreeViewer.setExposure(value);
        if (currentThreeSource) currentThreeSource.exposure = value;
        if (typeof ddExpoInput !== 'undefined' && ddExpoInput.value !== expoInput.value) {
          ddExpoInput.value = expoInput.value;
        }
      });

      expoWrap.appendChild(expoLabelEl);
      expoWrap.appendChild(expoInput);
      controls.appendChild(envGroup);
      controls.appendChild(matGroup);
      controls.appendChild(expoWrap);

      var lightDd = document.createElement('div');
      lightDd.className = 'case-3d__light-dd';
      lightDd.dataset.open = 'false';

      var lightTrigger = document.createElement('button');
      lightTrigger.type = 'button';
      lightTrigger.className = 'case-3d__ctrl case-3d__ctrl--icon case-3d__light-dd__trigger';
      lightTrigger.setAttribute('aria-haspopup', 'true');
      lightTrigger.setAttribute('aria-expanded', 'false');
      var __v7 = window.I18N;
      lightTrigger.setAttribute('aria-label', (__v7 && __v7.t) ? __v7.t('viz.lightingSettings') : 'Lighting settings');
      lightTrigger.innerHTML =
        '<svg class="case-3d__ctrl-icon" viewBox="0 0 20 20" width="16" height="16" ' +
        'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M10 2.5c-3 0-5 2.2-5 4.8 0 1.7.8 3.1 2 4v2h6v-2c1.2-.9 2-2.3 2-4 0-2.6-2-4.8-5-4.8z"/>' +
        '<path d="M8 16h4M8.5 18h3"/>' +
        '</svg>';

      var lightPanel = document.createElement('div');
      lightPanel.className = 'case-3d__light-dd__panel';
      lightPanel.hidden = true;
      lightPanel.setAttribute('role', 'group');
      var __v8 = window.I18N;
      lightPanel.setAttribute('aria-label', (__v8 && __v8.t) ? __v8.t('viz.lightingPanel') : 'Lighting presets and exposure');

      var ddEnvLabel = document.createElement('div');
      ddEnvLabel.className = 'case-3d__light-dd__section-label';
      var __v9 = window.I18N;
      ddEnvLabel.setAttribute('data-i18n', 'viz.environmentLabel');
      ddEnvLabel.textContent = (__v9 && __v9.t) ? __v9.t('viz.environmentLabel') : 'ENVIRONMENT';
      lightPanel.appendChild(ddEnvLabel);

      var ddEnvList = document.createElement('div');
      ddEnvList.className = 'case-3d__light-dd__env-list';
      ddEnvList.setAttribute('role', 'group');
      var __v10 = window.I18N;
      ddEnvList.setAttribute('aria-label', (__v10 && __v10.t) ? __v10.t('viz.envPreset') : 'Environment preset');
      ENVIRONMENT_MODES.forEach(function (key) {
        ddEnvList.appendChild(createEnvBtn(key, 'case-3d__light-dd__env-btn'));
      });
      lightPanel.appendChild(ddEnvList);

      var ddMatLabel = document.createElement('div');
      ddMatLabel.className = 'case-3d__light-dd__section-label';
      var __vMatLabel = window.I18N;
      ddMatLabel.setAttribute('data-i18n', 'viz.materialLabel');
      ddMatLabel.textContent = (__vMatLabel && __vMatLabel.t) ? __vMatLabel.t('viz.materialLabel') : 'MATERIAL';
      lightPanel.appendChild(ddMatLabel);

      var ddMatList = document.createElement('div');
      ddMatList.className = 'case-3d__light-dd__env-list case-3d__light-dd__mat-list';
      ddMatList.setAttribute('role', 'group');
      var __vMatList = window.I18N;
      ddMatList.setAttribute('aria-label', (__vMatList && __vMatList.t) ? __vMatList.t('viz.materialMode') : 'Material view mode');
      Object.keys(MATERIAL_MODES).forEach(function (key) {
        ddMatList.appendChild(createMaterialBtn(key, 'case-3d__light-dd__env-btn case-3d__light-dd__mat-btn'));
      });
      lightPanel.appendChild(ddMatList);

      var ddExpoLabel = document.createElement('label');
      ddExpoLabel.className = 'case-3d__light-dd__section-label';
      var __v11 = window.I18N;
      ddExpoLabel.setAttribute('data-i18n', 'viz.exposureLabel');
      ddExpoLabel.textContent = (__v11 && __v11.t) ? __v11.t('viz.exposureLabel') : 'EXPOSURE';
      lightPanel.appendChild(ddExpoLabel);

      var ddExpoInput = document.createElement('input');
      ddExpoInput.type = 'range';
      ddExpoInput.min = '0.5';
      ddExpoInput.max = '2';
      ddExpoInput.step = '0.05';
      ddExpoInput.value = String(initialExposure);
      ddExpoInput.className = 'case-3d__light-dd__expo-input';
      var __v12 = window.I18N;
      ddExpoInput.setAttribute('aria-label', (__v12 && __v12.t) ? __v12.t('viz.exposureRange') : 'Exposure level from 0.5 to 2.0');
      ddExpoInput.addEventListener('input', function () {
        var value = parseFloat(ddExpoInput.value);
        if (currentThreeViewer && currentThreeViewer.setExposure) currentThreeViewer.setExposure(value);
        if (currentThreeSource) currentThreeSource.exposure = value;
        if (expoInput.value !== ddExpoInput.value) expoInput.value = ddExpoInput.value;
      });
      lightPanel.appendChild(ddExpoInput);

      function closeLightDd() {
        if (lightDd.dataset.open !== 'true') return;
        lightDd.dataset.open = 'false';
        lightTrigger.setAttribute('aria-expanded', 'false');
        lightPanel.hidden = true;
      }
      function openLightDd() {
        lightDd.dataset.open = 'true';
        lightTrigger.setAttribute('aria-expanded', 'true');
        lightPanel.hidden = false;
      }
      lightTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (lightDd.dataset.open === 'true') closeLightDd();
        else openLightDd();
      });
      currentLightDdDocClick = function (e) {
        if (lightDd.dataset.open !== 'true') return;
        if (lightDd.contains(e.target)) return;
        closeLightDd();
      };
      currentLightDdDocKey = function (e) {
        if (e.key === 'Escape' && lightDd.dataset.open === 'true') {
          closeLightDd();
          lightTrigger.focus();
        }
      };
      document.addEventListener('click', currentLightDdDocClick);
      document.addEventListener('keydown', currentLightDdDocKey);

      lightDd.appendChild(lightTrigger);
      lightDd.appendChild(lightPanel);
      controls.appendChild(lightDd);

      var infoPanel = document.createElement('div');
      infoPanel.className = 'case-3d__info-panel';
      infoPanel.innerHTML = buildInfoHTML(data);
      if (infoOn) infoPanel.classList.add('is-visible');

      autoBtn.addEventListener('click', function () {
        autoRotateOn = !autoRotateOn;
        autoBtn.classList.toggle('is-on', autoRotateOn);
        autoBtn.setAttribute('aria-pressed', autoRotateOn ? 'true' : 'false');
        if (currentThreeViewer && currentThreeViewer.setAutoRotate) currentThreeViewer.setAutoRotate(autoRotateOn);
        if (currentThreeSource) currentThreeSource.autoRotate = autoRotateOn;
      });

      infoBtn.addEventListener('click', function () {
        infoOn = !infoOn;
        if (!isMobileMI) window.CODEX_MI_ON = infoOn;
        infoBtn.classList.toggle('is-on', infoOn);
        infoBtn.setAttribute('aria-pressed', infoOn ? 'true' : 'false');
        infoPanel.classList.toggle('is-visible', infoOn);
      });

      resetBtn.addEventListener('click', function () {
        resetBtn.classList.add('is-pulse');
        setTimeout(function () { resetBtn.classList.remove('is-pulse'); }, 520);
        if (currentThreeViewer && currentThreeViewer.resetCamera) currentThreeViewer.resetCamera();
      });

      currentMvReset = function () {
        if (currentThreeViewer && currentThreeViewer.resetCamera) currentThreeViewer.resetCamera();
      };

      case3dCanvas.innerHTML = '';
      case3dCanvas.classList.remove('is-ready');

      currentThreeSource = {
        caseId: id,
        src: src,
        alt: (data.title || id) + ' - 3D model',
        autoRotate: autoRotateOn,
        exposure: parseFloat(expoInput.value),
        environment: currentEnv,
        materialMode: currentMaterial
      };
      currentThreeViewer = threeRuntime.createCodexThreeViewer({
        host: case3dCanvas,
        src: src,
        alt: currentThreeSource.alt,
        autoRotate: autoRotateOn,
        exposure: currentThreeSource.exposure,
        environment: currentEnv,
        materialMode: currentMaterial,
        onReady: function () {
          if (model3dBuiltFor === targetId && currentCaseId === targetId && case3dCanvas) {
            case3dCanvas.classList.add('is-ready');
          }
        },
        onError: function () {
          if (model3dBuiltFor === targetId && currentCaseId === targetId) {
            destroy3D();
            render3DFallback(
              'MODEL UNAVAILABLE',
              'Не удалось загрузить GLB. Проверь интернет-соединение или вернись к 2D / Blueprints.'
            );
          }
        }
      });
      case3dCanvas.appendChild(hint);
      case3dCanvas.appendChild(hintMobile);
      case3dCanvas.appendChild(controls);
      case3dCanvas.appendChild(infoPanel);
    }).catch(function () {
      threeViewerLoading = null;
      mountModelViewer3D(options);
    });
  }

  var CodexModelViewerAdapter = {
    mount3D: function (options) {
      return mountThreeViewer3D(options);
    },
    destroy3D: function () {
      destroy3D();
    },
    resetCamera: function () {
      if (typeof currentMvReset === 'function') currentMvReset();
    },
    openFullscreen: function (source) {
      if (currentThreeSource) {
        openFsThree(currentThreeSource);
        return;
      }
      var target = source || currentMv;
      if (target) openFs(target, 'model-viewer');
    }
  };
  window.CodexViewer = CodexModelViewerAdapter;

  function build3D(id) {
    if (!case3dCanvas) return;
    var data = CARDS_DATA[id];
    if (!data) return;
    CodexModelViewerAdapter.mount3D({
      caseId: id,
      container: case3dCanvas,
      data: data
    });
  }

  /* ══════════════════════════════════
     v0.10 — Tab switching (2D ↔ Blueprints)
     v0.11 — + 3D режим (Google <model-viewer>)
  ══════════════════════════════════ */
  function setViz(mode) {
    if (mode !== '2d' && mode !== '3d' && mode !== 'blueprints') return;
    currentViz = mode;
    [tab2d, tab3d, tabBp].forEach(function (t) {
      if (!t) return;
      var active = t.dataset.viz === mode;
      t.classList.toggle('case-tab--active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (mode === '2d') {
      if (caseBlueprints) caseBlueprints.hidden = true;
      if (case3d)         case3d.hidden         = true;
      if (caseScroll)     caseScroll.hidden     = false;
      // v0.10.2 — если кейс менялся пока был Blueprints/3D — сбрасываем позицию теперь
      if (pendingScrollReset && caseScroll) {
        caseScroll.scrollTop = 0;
        if (progressBar) progressBar.style.width = '0%';
        pendingScrollReset = false;
      }
    } else if (mode === 'blueprints') {
      if (caseScroll)     caseScroll.hidden     = true;
      if (case3d)         case3d.hidden         = true;
      if (caseBlueprints) caseBlueprints.hidden = false;
      if (currentCaseId && blueprintBuiltFor !== currentCaseId) {
        renderBlueprints(currentCaseId);
      }
    } else { // '3d'
      if (caseScroll)     caseScroll.hidden     = true;
      if (caseBlueprints) caseBlueprints.hidden = true;
      if (case3d)         case3d.hidden         = false;
      if (currentCaseId && model3dBuiltFor !== currentCaseId) {
        build3D(currentCaseId);
      } else if (typeof currentMvReset === 'function') {
        // v0.11.4 — возврат на тот же 3D-кейс (без пересборки) → сбрасываем камеру к initial
        currentMvReset();
      }
    }
    // v0.10.1 — уведомляем animations.js: при возврате на 2D нужно
    // перезапустить lift-триггеры (в скрытом контейнере они не срабатывают)
    document.dispatchEvent(new CustomEvent('codex:viz-change', {
      detail: { mode: mode, caseId: currentCaseId }
    }));
  }
  if (tab2d) tab2d.addEventListener('click', function () { setViz('2d'); });
  if (tab3d) tab3d.addEventListener('click', function () { setViz('3d'); });
  if (tabBp) tabBp.addEventListener('click', function () { setViz('blueprints'); });

  /* v0.13.8.1 — SVG export с inline-стилями.
     CSS-переменные (var(--color-primary) и т.п.) резолвятся только
     внутри документа-источника. При открытии standalone .svg они
     теряются и получается «чёрный экран». Решение: обходим клон
     и исходник параллельно, копируем computedStyle в inline-style
     для SVG-специфичных свойств. Плюс фоновый <rect> под содержимым. */
  var SVG_STYLE_PROPS = [
    'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-opacity', 'stroke-width',
    'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'opacity', 'visibility', 'display',
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
    'text-anchor', 'dominant-baseline', 'text-transform',
    'vector-effect', 'paint-order'
  ];
  function inlineComputedStyles(sourceEl, cloneEl) {
    if (sourceEl.nodeType !== 1 || cloneEl.nodeType !== 1) return;
    var cs = window.getComputedStyle(sourceEl);
    var parts = [];
    for (var i = 0; i < SVG_STYLE_PROPS.length; i++) {
      var p = SVG_STYLE_PROPS[i];
      var v = cs.getPropertyValue(p);
      if (v && v !== '' && v !== 'normal' && v !== 'auto') {
        parts.push(p + ':' + v);
      }
    }
    if (parts.length) cloneEl.setAttribute('style', parts.join(';'));
    var srcChildren = sourceEl.children;
    var cloneChildren = cloneEl.children;
    var n = Math.min(srcChildren.length, cloneChildren.length);
    for (var j = 0; j < n; j++) inlineComputedStyles(srcChildren[j], cloneChildren[j]);
  }
  /* exportSvgElement — клонирует переданный <svg>, инлайнит стили, добавляет
     фоновый rect, сохраняет как .svg через Blob+download. Используется
     top-toolbar и per-page Export кнопками. */
  function exportSvgElement(svg, filenameSuffix) {
    if (!svg) return;
    var clone = svg.cloneNode(true);
    if (!clone.getAttribute('xmlns'))       clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    inlineComputedStyles(svg, clone);

    var bodyStyles = window.getComputedStyle(document.body);
    var bgVar = bodyStyles.getPropertyValue('--color-bg').trim() ||
                window.getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    var bgColor = bgVar || '#212121';
    var vb = clone.getAttribute('viewBox');
    var bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    if (vb) {
      var vbParts = vb.split(/\s+/);
      bgRect.setAttribute('x', vbParts[0]);
      bgRect.setAttribute('y', vbParts[1]);
      bgRect.setAttribute('width', vbParts[2]);
      bgRect.setAttribute('height', vbParts[3]);
    } else {
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
    }
    bgRect.setAttribute('fill', bgColor.trim());
    clone.insertBefore(bgRect, clone.firstChild);

    var src = new XMLSerializer().serializeToString(clone);
    if (src.indexOf('<?xml') !== 0) src = '<?xml version="1.0" encoding="UTF-8"?>\n' + src;
    var blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'codex-blueprint-' + filenameSuffix + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function bpFileSuffix(id, pageIdx, total) {
    var safe = String(id).replace(/[^a-z0-9\-]+/gi, '-').toLowerCase();
    return total > 1 ? (safe + '-p' + (pageIdx + 1)) : safe;
  }
  function exportBpPage(pageIdx) {
    if (!currentCaseId) return;
    var pages = getBpPages(currentCaseId);
    if (!pages.length) return;
    pageIdx = Math.max(0, Math.min(pages.length - 1, pageIdx || 0));
    // v0.22.3: runtime SVG не содержит grid/title-block (они в CSS/HTML).
    // Для self-contained экспорта собираем полную версию SVG (forExport:true)
    // и временно крепим её к canvas чтобы getComputedStyle разрешил CSS-классы.
    var svg = buildBlueprintSVG(currentCaseId, pageIdx, { forExport: true });
    if (!svg || !caseBlueprintsCanvas) return;
    svg.style.position = 'absolute';
    svg.style.left = '-9999px';
    svg.style.top  = '-9999px';
    svg.style.width  = BP_VIEW_W + 'px';
    svg.style.height = BP_VIEW_H + 'px';
    svg.style.pointerEvents = 'none';
    caseBlueprintsCanvas.appendChild(svg);
    try {
      exportSvgElement(svg, bpFileSuffix(currentCaseId, pageIdx, pages.length));
    } finally {
      if (svg.parentNode) svg.parentNode.removeChild(svg);
    }
  }
  var bpExportBtn = document.getElementById('blueprint-export-svg');
  if (bpExportBtn) bpExportBtn.addEventListener('click', function () { exportBpPage(currentBpPage); });

  // Per-page Export (mobile mini-toolbar) — делегированный
  if (caseBlueprintsCanvas) {
    caseBlueprintsCanvas.addEventListener('click', function (e) {
      var exportBtn = e.target.closest && e.target.closest('.case-blueprints__page-export');
      if (exportBtn) {
        e.preventDefault();
        exportBpPage(parseInt(exportBtn.getAttribute('data-bp-page'), 10) || 0);
      }
    });
  }

  // Экспорт для animations.js
  window.CodexCase = { openCase: openCase };

  /* v0.14.0 [16] — клик по логотипу CODEX открывает первый видимый кейс
     (аналогично initial-load). Используем ту же логику, что и авто-инициализация. */
  var logoHome = document.getElementById('logo-home');
  if (logoHome) {
    logoHome.addEventListener('click', function (e) {
      e.preventDefault();
      // cards — NodeList, конвертируем в Array для .find
      var cardsArr = Array.prototype.slice.call(cards);
      var firstVisible = cardsArr.filter(function (c) {
        return !c.hasAttribute('hidden') && c.offsetParent !== null;
      })[0] || cardsArr[0];
      if (firstVisible && firstVisible.dataset.id) {
        openCase(firstVisible.dataset.id, { initial: true });
        // на мобилке — свернуть sidebar, чтобы показать case-view
        var isMobileLogo = window.matchMedia('(max-width: 767px)').matches;
        if (isMobileLogo) setCollapsed(true);
      }
    });
  }

  /* ══════════════════════════════════
     Card — click + keyboard
     v0.5: work-card теперь <a href="#card-id"> (HV5 fix), браузер по дефолту навигирует
     по hash. Перехватываем click и сами вызываем openCase, чтобы:
       1) использовать ту же логику mobile-collapse + анимация;
       2) openCase сам синхронизирует hash через replaceState (без двойного push).
  ══════════════════════════════════ */
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (!card.dataset.id) return;
      // <a href="#X"> — без preventDefault браузер откроет hash-навигацию параллельно.
      e.preventDefault();
      openCase(card.dataset.id);
      // На мобильном — закрываем sidebar (hamburger pattern)
      var isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (isMobile) setCollapsed(true);
    });
  });

  /* ══════════════════════════════════
     TOGGLE: Hide / Show cards panel
     Desktop — rail 56 px. Mobile — sidebar уезжает за край (CSS).
  ══════════════════════════════════ */
  function setCollapsed(collapsed) {
    if (!toggleBtn) return;

    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    // Phase 4a — i18n + page-aware: на FA это категории, не проекты.
    var isFA = !!document.getElementById('fa-grid');
    var I18N = window.I18N;
    var ariaKey, labelKey, ariaFallback, labelFallback;
    if (collapsed) {
      ariaKey = isFA ? 'toggle.showCategoriesAria' : 'toggle.showProjectsAria';
      labelKey = isFA ? 'toggle.showCategories' : 'toggle.showProjects';
      ariaFallback = isFA ? 'Show categories panel' : 'Show projects panel';
      labelFallback = isFA ? 'Show categories' : 'Show projects';
    } else {
      ariaKey = isFA ? 'toggle.hideCategoriesAria' : 'toggle.hideProjectsAria';
      labelKey = isFA ? 'toggle.hideCategories' : 'toggle.hideProjects';
      ariaFallback = isFA ? 'Hide categories panel' : 'Hide projects panel';
      labelFallback = isFA ? 'Hide categories' : 'Hide projects';
    }
    toggleBtn.setAttribute('aria-label', (I18N && I18N.t) ? I18N.t(ariaKey) : ariaFallback);
    var label = toggleBtn.querySelector('.cards-toggle__label');
    if (label) label.textContent = (I18N && I18N.t) ? I18N.t(labelKey) : labelFallback;

    document.body.classList.toggle('cards-collapsed', collapsed);

    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      document.documentElement.style.setProperty('--sidebar-w', collapsed ? '56px' : '340px');
      if (scrollEl) scrollEl.hidden = collapsed;
    } else {
      if (scrollEl) scrollEl.hidden = false;
      document.documentElement.style.removeProperty('--sidebar-w');
    }

    document.dispatchEvent(new CustomEvent('codex:toggle', { detail: { collapsed: collapsed } }));

    // v0.16.0 — case-view раскрыт → отключаем Lenis (нативный scroll #case-scroll).
    updateLenisState();
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var isCollapsed = toggleBtn.getAttribute('aria-expanded') === 'false';
      setCollapsed(!isCollapsed);
    });
  }

  /* ══════════════════════════════════
     THEME TOGGLE — light ↔ dark (v0.13.7)
     - переключает data-theme на body
     - GSAP fade токенов (0.25s вариация фона/текста — мягкий cross-fade)
     - без localStorage (sandbox); сбрасывается в dark при reload
  ══════════════════════════════════ */
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    var themeMetaColor = document.querySelector('meta[name="theme-color"]');
    var prm = window.matchMedia('(prefers-reduced-motion: reduce)');

    function applyTheme(next) {
      var reduced = prm.matches;
      var isLight = next === 'light';

      // ARIA и lookup-лейблы — обновляем сразу.
      // Phase 4a — aria-label через I18N с fallback на EN.
      themeBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      var I18N = window.I18N;
      var themeAriaKey = isLight ? 'theme.toDark' : 'theme.toLight';
      var themeAriaFallback = isLight ? 'Switch to dark theme' : 'Switch to light theme';
      themeBtn.setAttribute('aria-label', (I18N && I18N.t) ? I18N.t(themeAriaKey) : themeAriaFallback);
      if (themeMetaColor) themeMetaColor.setAttribute('content', isLight ? '#f5f5f5' : '#212121');

      if (reduced || typeof gsap === 'undefined') {
        // Мгновенно без анимации
        document.body.setAttribute('data-theme', next);
        return;
      }

      // GSAP cross-fade: элементы, чьи цвета берутся из токенов, должны плавно
      // сменить бекграунд. Но нельзя анимировать var(--...) напрямую.
      // Приём: накладываем overlay-слой с фоном целевой темы, fade-in, потом swap attr.
      var overlay = document.getElementById('theme-fade-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'theme-fade-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.cssText =
          'position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;' +
          'background:' + (isLight ? '#f5f5f5' : '#212121') + ';';
        document.body.appendChild(overlay);
      } else {
        overlay.style.background = isLight ? '#f5f5f5' : '#212121';
      }

      gsap.killTweensOf(overlay);
      gsap.fromTo(overlay,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.14,
          ease: 'power2.out',
          onComplete: function () {
            // SWAP темы под полностью непрозрачным overlay
            document.body.setAttribute('data-theme', next);
            gsap.to(overlay, {
              opacity: 0,
              duration: 0.26,
              ease: 'power2.inOut',
              onComplete: function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
              }
            });
          }
        });
    }

    themeBtn.addEventListener('click', function () {
      var current = document.body.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Keyboard: Enter / Space — native button, но aria-pressed toggle по-дефолту окей.
  }

  /* ══════════════════════════════════
     CASE BACK — мобильная кнопка возврата к сайдбару
     (разворачивает sidebar из collapsed)
  ══════════════════════════════════ */
  if (caseBack) {
    caseBack.addEventListener('click', function () {
      setCollapsed(false);
    });
  }
  // Лого в мобильном кейсе — тоже возврат к карточкам
  var mobileLogo = document.querySelector('.case-mobile-bar__logo');
  if (mobileLogo) {
    mobileLogo.addEventListener('click', function (e) {
      var isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (!isMobile) return;
      e.preventDefault();
      setCollapsed(false);
    });
  }

  // Breakpoint switcher — чистим состояние при смене экрана
  var mq = window.matchMedia('(max-width: 767px)');
  function handleBreakpoint() {
    if (mq.matches) {
      document.documentElement.style.removeProperty('--sidebar-w');
      if (scrollEl) scrollEl.hidden = false;
    } else if (document.body.classList.contains('cards-collapsed')) {
      document.documentElement.style.setProperty('--sidebar-w', '56px');
      if (scrollEl) scrollEl.hidden = true;
    } else {
      document.documentElement.style.removeProperty('--sidebar-w');
    }
  }
  if (mq.addEventListener) mq.addEventListener('change', handleBreakpoint);
  else if (mq.addListener) mq.addListener(handleBreakpoint);

  // v0.8.8a — делегированный error-handler для thumbnail <img>. Раньше каждая
  // из 18 work-card имела inline onerror="this.remove();" (нарушало B2).
  // capture:true — error не bubble'ит; capture-фаза доходит до scrollEl.
  if (scrollEl) {
    scrollEl.addEventListener('error', function (e) {
      var img = e.target;
      if (img && img.tagName === 'IMG' && img.closest && img.closest('.work-card__thumb')) {
        img.remove();
      }
    }, true);
  }

  updateCount(cards.length);

  /* ══════════════════════════════════
     Первая загрузка — открываем самый свежий кейс
     v0.2.3 [П2]: если в URL есть hash и он совпадает с data-id
     существующей карточки — открываем этот кейс.
     На mobile дополнительно сворачиваем sidebar в case-view.
  ══════════════════════════════════ */
  setTimeout(function () {
    var initialId = null;
    var fromHash = false;
    var rawHash = (window.location.hash || '').replace(/^#/, '');
    if (rawHash) {
      var hashCard = document.querySelector('.work-card[data-id="' + rawHash.replace(/"/g, '') + '"]');
      if (hashCard && hashCard.dataset.id && !hashCard.hasAttribute('hidden')) {
        initialId = hashCard.dataset.id;
        fromHash = true;
      }
    }
    if (!initialId) {
      var first = document.querySelector('.work-card[data-id]');
      if (first && first.dataset.id) initialId = first.dataset.id;
    }
    if (initialId) {
      openCase(initialId, { initial: true });
      // v0.8.7 [M3]: на mobile при любом валидном deep-link сразу
      // показываем case-view вместо sidebar. Раньше сравнивалось с первой
      // видимой картой через optional-chaining — пользователь приходил по
      // #orbital-mk-ii (первый кейс) и оставался на cards-screen, тогда
      // как по любой другой ссылке sidebar сворачивался. Теперь логика
      // одна: hash валидно указал на видимую карту → mobile collapse.
      if (fromHash) {
        var isMobileInit = window.matchMedia('(max-width: 767px)').matches;
        if (isMobileInit) setCollapsed(true);
      }
    }
  }, 0);

  /* v0.2.3 [П2] — hashchange: если пользователь вставил коллеге ссылку
     в адресную строку или изменил hash вручную — переключаем кейс.
     skipHashSync: true — чтобы openCase() не вызывал replaceState обратно. */
  window.addEventListener('hashchange', function () {
    var newHash = (window.location.hash || '').replace(/^#/, '');
    if (!newHash) {
      // hash убран — возвращаемся к первому видимому кейсу
      var firstHC = document.querySelector('.work-card[data-id]:not([hidden])');
      if (firstHC && firstHC.dataset.id && firstHC.dataset.id !== currentCaseId) {
        openCase(firstHC.dataset.id, { skipHashSync: true });
      }
      return;
    }
    if (newHash === currentCaseId) return;
    var card = document.querySelector('.work-card[data-id="' + newHash.replace(/"/g, '') + '"]');
    if (card && !card.hasAttribute('hidden')) {
      openCase(newHash, { skipHashSync: true });
    }
  });

  /* Phase 2b — re-render активного case-view при смене языка.
     i18n.js overlayCases() уже замутировал window.CARDS_DATA под новый язык.
     Если кейс открыт — openCase() с теми же id перестроит case-view из
     обновлённой data. Передаём skipHashSync (URL уже актуален) и initial:true,
     чтобы не было scrollIntoView и анимаций (visually instantaneous swap). */
  window.addEventListener('i18n:changed', function () {
    if (currentCaseId && typeof openCase === 'function') {
      openCase(currentCaseId, { skipHashSync: true, initial: true });
    }
    // Phase 4a — refresh aria/labels на JS-driven toggles (state-dependent).
    // Cards-toggle: читаем текущий collapsed-state из body class.
    if (typeof setCollapsed === 'function' && toggleBtn) {
      setCollapsed(document.body.classList.contains('cards-collapsed'));
    }
    // Theme-toggle: re-apply aria через помощник, если есть.
    var __tb = document.getElementById('theme-toggle');
    if (__tb) {
      var isLight = document.body.getAttribute('data-theme') === 'light';
      var I18N = window.I18N;
      var key = isLight ? 'theme.toDark' : 'theme.toLight';
      var fb  = isLight ? 'Switch to dark theme' : 'Switch to light theme';
      __tb.setAttribute('aria-label', (I18N && I18N.t) ? I18N.t(key) : fb);
    }
  });

  /* v0.2.3 [П2] — кнопка COPY LINK (desktop + mobile).
     Собираем полный URL: origin + pathname + '#' + currentCaseId
     (даже если кейс = первый и в URL hash очищен — для share
     всегда включаем явный якорь, чтобы на принимающей стороне
     гарантированно открылся именно этот кейс).
     Clipboard API с fallback через execCommand('copy') для file://. */
  function copyCaseLink(button) {
    if (!currentCaseId) return;
    var origin = window.location.origin;
    // file:// выдаёт origin='null' — фолбэк на href
    if (!origin || origin === 'null') origin = '';
    var url = origin + window.location.pathname + '#' + currentCaseId;

    function showCopied() {
      if (!button) return;
      var label = button.querySelector('.case-share__label');
      if (!label) return;
      // Phase 4a — data-i18n-pause защищает label от walker в момент
      // транзишена, если пользователь успел переключить язык за 2 секунды.
      // После таймаута мы заново читаем актуальный t('btn.copyLink').
      var I18N = window.I18N;
      var copiedTxt = (I18N && I18N.t) ? I18N.t('copy.copied') : 'COPIED ✓';
      label.setAttribute('data-i18n-pause', 'true');
      button.classList.add('case-share--copied');
      label.textContent = copiedTxt;
      button.setAttribute('aria-live', 'polite');
      setTimeout(function () {
        button.classList.remove('case-share--copied');
        label.removeAttribute('data-i18n-pause');
        // Re-read current language label (а не закешированный prev).
        label.textContent = (I18N && I18N.t) ? I18N.t('btn.copyLink') : 'COPY LINK';
      }, 2000);
    }

    var done = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        navigator.clipboard.writeText(url).then(function () { showCopied(); }, function () {
          if (!done) { done = true; fallbackCopy(url); showCopied(); }
        });
        return;
      } catch (e) { /* fall through */ }
    }
    fallbackCopy(url);
    showCopied();
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { /* ручного редактора не активируем, тихо игнорируем */ }
  }

  var shareDesktop = document.getElementById('case-share-desktop');
  var shareMobile  = document.getElementById('case-share-mobile');
  if (shareDesktop) shareDesktop.addEventListener('click', function () { copyCaseLink(shareDesktop); });
  if (shareMobile)  shareMobile.addEventListener('click',  function () { copyCaseLink(shareMobile);  });

  /* ════════════════════════════════════════════
     v0.15.1 [2.1/2.2/2.3] — FULLSCREEN OVERLAY (Variant B)
     v0.20.0 — расширен поддержкой gallery: prev/next, counter,
       aria-live, focus trap, FLIP open/close, touch swipe, cursor
       zone labels.
     Одна скрытая overlay-плашка в <body>. По клику fs-btn (3D/BP) или
     gallery img клонируется контент в .media-fs__stage.
     ════════════════════════════════════════════ */
  var fsOverlay = null, fsStage = null, fsCloseBtn = null;
  var fsPrev = null, fsNext = null, fsCounter = null, fsAnnouncer = null;
  var fsZoomBar = null, fsZoomOutBtn = null, fsZoomFitBtn = null, fsZoomActualBtn = null, fsZoomInBtn = null;
  // v0.8.2: fsOriginalEl удалён — задумывался для video time-sync, но
  // video в fs-overlay не реализовано; переменная только писалась, никем
  // не читалась.
  var fsContext = null;             // 'gallery' | 'blueprint' | null — режим overlay
  var gallery = { list: [], index: 0, triggerEl: null };
  var blueprintFs = { id: null, total: 0, index: 0, triggerEl: null };
  var fsCurrentEl = null;           // v0.20.2 — текущая видимая картинка в stage
  var focusTrapHandler = null;
  var fsImageZoom = {
    scale: 1,
    x: 0,
    y: 0,
    min: 1,
    max: 4,
    actual: 1,
    pointers: {},
    panStart: null,
    pinchStart: null,
    suppressClick: false
  };
  var fsPreviousFocus = null;       // элемент для возврата фокуса при close

  function createFsZoomButton(action, label, iconPath, handler) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'media-fs__zoom-btn media-fs__zoom-btn--' + action;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('data-cursor', 'link');
    btn.innerHTML = '<svg class="media-fs__zoom-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconPath + '</svg>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
    return btn;
  }

  function ensureFsOverlay() {
    if (fsOverlay) return fsOverlay;
    fsOverlay = document.createElement('div');
    fsOverlay.className = 'media-fs';
    fsOverlay.setAttribute('role', 'dialog');
    fsOverlay.setAttribute('aria-modal', 'true');
    (function(){ var __I=window.I18N; fsOverlay.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.fullscreenView'):'Fullscreen view'); })();
    fsOverlay.hidden = true;

    fsStage = document.createElement('div');
    fsStage.className = 'media-fs__stage';

    fsCloseBtn = document.createElement('button');
    fsCloseBtn.type = 'button';
    fsCloseBtn.className = 'media-fs__close';
    (function(){ var __I=window.I18N; var s=(__I&&__I.t)?__I.t('fs.closeFullscreen'):'Close fullscreen';
      fsCloseBtn.setAttribute('aria-label', s); fsCloseBtn.setAttribute('title', s); })();
    // v0.19.0 — media-fs overlay создаётся динамически, помечаем при build
    fsCloseBtn.setAttribute('data-cursor', 'link');
    fsCloseBtn.innerHTML = '<svg class="media-fs__close-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M6 2v4H2M12 2v4h4M2 12h4v4M12 16v-4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
    fsCloseBtn.addEventListener('click', closeFs);

    // v0.20.0 — gallery prev/next/counter/announcer. hidden до openFsImageGallery.
    fsPrev = document.createElement('button');
    fsPrev.type = 'button';
    fsPrev.className = 'media-fs__prev';
    (function(){ var __I=window.I18N; fsPrev.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.previousImage'):'Previous image'); })();
    fsPrev.setAttribute('data-cursor', 'link');
    fsPrev.hidden = true;
    fsPrev.innerHTML = '<svg class="media-fs__nav-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4L5 9l6 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fsPrev.addEventListener('click', function () { navFs(-1); });

    fsNext = document.createElement('button');
    fsNext.type = 'button';
    fsNext.className = 'media-fs__next';
    (function(){ var __I=window.I18N; fsNext.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.nextImage'):'Next image'); })();
    fsNext.setAttribute('data-cursor', 'link');
    fsNext.hidden = true;
    fsNext.innerHTML = '<svg class="media-fs__nav-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4l6 5-6 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    fsNext.addEventListener('click', function () { navFs(+1); });

    fsCounter = document.createElement('div');
    fsCounter.className = 'media-fs__counter';
    fsCounter.hidden = true;

    fsAnnouncer = document.createElement('div');
    fsAnnouncer.className = 'media-fs__announcer';
    fsAnnouncer.setAttribute('aria-live', 'polite');
    fsAnnouncer.setAttribute('aria-atomic', 'true');

    fsZoomBar = document.createElement('div');
    fsZoomBar.className = 'media-fs__zoom';
    fsZoomBar.hidden = true;
    fsZoomOutBtn = createFsZoomButton('zoom-out', 'Zoom out',
      '<path d="M4 9h10"/>',
      function () { zoomFsImageBy(0.8); });
    fsZoomFitBtn = createFsZoomButton('fit', 'Fit to screen',
      '<path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4"/>',
      function () { resetFsImageZoom(true); });
    fsZoomActualBtn = createFsZoomButton('actual', 'Actual size',
      '<text x="9" y="10.6" fill="currentColor" stroke="none" font-size="5" font-family="monospace" text-anchor="middle" dominant-baseline="middle">1:1</text>',
      function () { setFsImageScale(fsImageZoom.actual, window.innerWidth / 2, window.innerHeight / 2); });
    fsZoomInBtn = createFsZoomButton('zoom-in', 'Zoom in',
      '<path d="M4 9h10M9 4v10"/>',
      function () { zoomFsImageBy(1.25); });
    fsZoomBar.appendChild(fsZoomOutBtn);
    fsZoomBar.appendChild(fsZoomFitBtn);
    fsZoomBar.appendChild(fsZoomActualBtn);
    fsZoomBar.appendChild(fsZoomInBtn);

    fsOverlay.appendChild(fsCloseBtn);
    fsOverlay.appendChild(fsPrev);
    fsOverlay.appendChild(fsNext);
    fsOverlay.appendChild(fsCounter);
    fsOverlay.appendChild(fsZoomBar);
    fsOverlay.appendChild(fsAnnouncer);
    fsOverlay.appendChild(fsStage);
    document.body.appendChild(fsOverlay);

    // Backdrop click: в gallery/blueprint — навигация по половинам, иначе — close.
    fsOverlay.addEventListener('click', function (e) {
      if (fsImageZoom.suppressClick) {
        fsImageZoom.suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.target !== fsOverlay && e.target !== fsStage) return;
      if (fsContext === 'gallery' || fsContext === 'blueprint') {
        navFs(e.clientX < window.innerWidth / 2 ? -1 : +1);
      } else {
        closeFs();
      }
    });

    // Touch swipe (gallery only)
    setupFsSwipe(fsOverlay);
    setupFsImageZoom();
    // Cursor zone tracker — добавляет is-fs-prev/is-fs-next к .cursor
    fsOverlay.addEventListener('mousemove', trackFsCursorZones);
    fsOverlay.addEventListener('mouseleave', clearFsCursorZones);

    return fsOverlay;
  }

  function openFs(sourceEl, kind, triggerEl) {
    ensureFsOverlay();
    releaseFsImageZoom();
    if (fsThreeViewer && typeof fsThreeViewer.dispose === 'function') {
      try { fsThreeViewer.dispose(); } catch (_) { /* no-op */ }
      fsThreeViewer = null;
    }
    // Очистить stage
    while (fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);

    fsContext = null;
    fsPreviousFocus = triggerEl || sourceEl || document.activeElement;
    fsPrev.hidden = true;
    fsNext.hidden = true;
    fsCounter.hidden = true;
    fsAnnouncer.textContent = '';
    (function(){ var __I=window.I18N; fsOverlay.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.fullscreenView'):'Fullscreen view'); })();

    var clone;
    if (kind === 'video' || (sourceEl && sourceEl.tagName === 'VIDEO')) {
      clone = sourceEl.cloneNode(false);
      clone.removeAttribute('class');
      clone.muted = true;
      clone.loop = true;
      clone.autoplay = true;
      clone.playsInline = true;
      clone.controls = false;
      try { clone.currentTime = sourceEl.currentTime || 0; } catch (_) {}
      fsStage.appendChild(clone);
      try { clone.play(); } catch (_) {}
    } else if (kind === 'img' || (sourceEl && sourceEl.tagName === 'IMG')) {
      clone = sourceEl.cloneNode(false);
      clone.removeAttribute('class');
      clone.loading = 'eager';
      fsStage.appendChild(clone);
    } else if (kind === 'model-viewer' || (sourceEl && sourceEl.tagName && sourceEl.tagName.toLowerCase() === 'model-viewer')) {
      // Model-viewer: клонируем с атрибутами
      clone = document.createElement('model-viewer');
      for (var i = 0; i < sourceEl.attributes.length; i++) {
        var a = sourceEl.attributes[i];
        if (a.name === 'class' || a.name === 'id' || a.name === 'style') continue;
        clone.setAttribute(a.name, a.value);
      }
      fsStage.appendChild(clone);
    } else if (kind === 'svg' || (sourceEl && sourceEl.tagName && sourceEl.tagName.toLowerCase() === 'svg')) {
      clone = sourceEl.cloneNode(true);
      clone.removeAttribute('style');
      fsStage.appendChild(clone);
    } else if (sourceEl) {
      clone = sourceEl.cloneNode(true);
      fsStage.appendChild(clone);
    }

    fsOverlay.hidden = false;
    // force reflow для transition
    void fsOverlay.offsetWidth;
    fsOverlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    try { fsCloseBtn.focus({ preventScroll: true }); } catch (_) {}
    setupFocusTrap();
    // v0.16.0 — media-fs overlay открыт → нативный scroll внутри stage.
    updateLenisState();
  }

  function openFsThree(source) {
    if (!source || !source.src) return;
    ensureFsOverlay();
    releaseFsImageZoom();
    if (fsThreeViewer && typeof fsThreeViewer.dispose === 'function') {
      try { fsThreeViewer.dispose(); } catch (_) { /* no-op */ }
      fsThreeViewer = null;
    }
    while (fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);

    fsContext = null;
    fsPreviousFocus = document.activeElement;
    fsPrev.hidden = true;
    fsNext.hidden = true;
    fsCounter.hidden = true;
    fsAnnouncer.textContent = '';
    (function(){ var __I=window.I18N; fsOverlay.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.fullscreenView'):'Fullscreen view'); })();

    var holder = document.createElement('div');
    holder.className = 'media-fs__three';
    fsStage.appendChild(holder);

    fsOverlay.hidden = false;
    void fsOverlay.offsetWidth;
    fsOverlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    try { fsCloseBtn.focus({ preventScroll: true }); } catch (_) {}
    setupFocusTrap();
    updateLenisState();

    loadThreeViewer().then(function (threeRuntime) {
      if (!fsOverlay || fsOverlay.hidden || !holder.isConnected) return;
      if (!threeRuntime || !threeRuntime.canUseCodexThreeViewer || !threeRuntime.canUseCodexThreeViewer()) {
        throw new Error('WebGL2 unavailable');
      }
      fsThreeViewer = threeRuntime.createCodexThreeViewer({
        host: holder,
        src: source.src,
        alt: source.alt || '3D model',
        autoRotate: source.autoRotate !== false,
        exposure: source.exposure || 1,
        environment: source.environment || 'studio',
        materialMode: source.materialMode || 'pbr',
        onError: function () {
          holder.innerHTML =
            '<div class="case-3d__fallback">' +
              '<p class="case-3d__fallback-title">MODEL UNAVAILABLE</p>' +
              '<p class="case-3d__fallback-hint">Не удалось загрузить GLB.</p>' +
            '</div>';
        }
      });
    }).catch(function () {
      holder.innerHTML =
        '<div class="case-3d__fallback">' +
          '<p class="case-3d__fallback-title">VIEWER OFFLINE</p>' +
          '<p class="case-3d__fallback-hint">Не удалось открыть 3D fullscreen.</p>' +
        '</div>';
    });
  }

  function closeFs() {
    if (!fsOverlay || fsOverlay.hidden) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // v0.20.0 — gallery: reverse FLIP к текущему thumbnail (gallery.triggerEl
    // обновляется при каждом navGallery, так что закрываем на актуальную миниатюру).
    if (fsContext === 'gallery' && !reduced && !document.hidden && typeof gsap !== 'undefined') {
      closeFsImageReverseFlip();
      return;
    }

    fsOverlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    updateLenisState();
    releaseFocusTrap();
    clearFsCursorZones();
    var prevFocus = fsPreviousFocus;
    setTimeout(function () {
      if (fsOverlay && !fsOverlay.classList.contains('is-open')) {
        fsOverlay.hidden = true;
        if (fsThreeViewer && typeof fsThreeViewer.dispose === 'function') {
          try { fsThreeViewer.dispose(); } catch (_) { /* no-op */ }
          fsThreeViewer = null;
        }
        while (fsStage && fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);
        releaseFsImageZoom();
        restoreFsContext();
        if (prevFocus && typeof prevFocus.focus === 'function') {
          try { prevFocus.focus({ preventScroll: true }); } catch (_) {}
        }
      }
    }, 220);
  }

  /* ─── v0.20.0 — Gallery FLIP, navigation, focus trap, swipe ────────── */

  function openFsImageGallery(sourceImg) {
    ensureFsOverlay();
    // Собираем гал-сcope (data-gallery предок; fallback — одиночный img).
    var scope = sourceImg.closest('[data-gallery]');
    var imgs = scope
      ? Array.prototype.slice.call(scope.querySelectorAll('img'))
      : [sourceImg];
    // Отфильтровываем картинки, которые не отрисовались (broken/removed)
    imgs = imgs.filter(function (i) { return i.isConnected && i.naturalWidth >= 0; });
    gallery.list = imgs;
    gallery.index = Math.max(0, imgs.indexOf(sourceImg));
    gallery.triggerEl = sourceImg;
    fsContext = 'gallery';
    fsPreviousFocus = sourceImg;

    (function(){ var __I=window.I18N; fsOverlay.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.imageGallery'):'Image gallery viewer'); })();
    fsPrev.hidden    = imgs.length < 2;
    fsNext.hidden    = imgs.length < 2;
    fsCounter.hidden = imgs.length < 2;

    flipOpen(sourceImg);
    updateGalleryUI(false);
    preloadNeighbors();
  }

  function buildImageClone(srcImg) {
    var clone = srcImg.cloneNode(false);
    clone.removeAttribute('class');
    clone.removeAttribute('tabindex');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-haspopup');
    // v0.20.4 — Wipe inline style inherited from animations.js setupLift
    // reveal animation: case-item__img получает clip-path:inset(0 100% 0 0)
    // (hide-state) либо mid-tween value. cloneNode копирует inline style
    // полностью; class снимается, но inline остаётся и продолжает скрывать
    // картинку в fs overlay. GSAP в swap/flip ставит свои inline-стили заново.
    clone.removeAttribute('style');
    clone.loading = 'eager';
    return clone;
  }

  function flipOpen(sourceImg) {
    while (fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);
    var clone = buildImageClone(sourceImg);
    fsStage.appendChild(clone);
    fsCurrentEl = clone;

    fsOverlay.hidden = false;
    void fsOverlay.offsetWidth;
    fsOverlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    updateLenisState();

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || document.hidden || typeof gsap === 'undefined') {
      activateFsImageZoom(clone);
      setupFocusTrap();
      return;
    }

    // FLIP: получили target rect после layout, ставим transform к source rect,
    // анимируем к identity. expo.inOut 0.5s.
    var srcRect = sourceImg.getBoundingClientRect();
    var tgtRect = clone.getBoundingClientRect();
    if (tgtRect.width === 0 || tgtRect.height === 0) {
      // image ещё не загрузилась — fallback на opacity-only
      setupFocusTrap();
      return;
    }
    var dx = srcRect.left - tgtRect.left;
    var dy = srcRect.top  - tgtRect.top;
    var sx = srcRect.width  / tgtRect.width;
    var sy = srcRect.height / tgtRect.height;
    gsap.set(clone, { transformOrigin: '0 0', x: dx, y: dy, scaleX: sx, scaleY: sy });
    gsap.to(clone, {
      x: 0, y: 0, scaleX: 1, scaleY: 1,
      duration: 0.5, ease: 'expo.inOut',
      clearProps: 'transform,transformOrigin',
      onComplete: function () {
        activateFsImageZoom(clone);
        setupFocusTrap();
      }
    });
  }

  function closeFsImageReverseFlip() {
    // v0.20.2 — fsCurrentEl, не firstChild (после swap firstChild может быть
    // удаляемой fading-out предыдущей картинкой).
    if (typeof gsap !== 'undefined') gsap.killTweensOf(fsStage.children);
    Array.prototype.slice.call(fsStage.children).forEach(function (c) {
      if (c !== fsCurrentEl && c.parentNode) c.parentNode.removeChild(c);
    });
    var clone = fsCurrentEl;
    var thumb = gallery.triggerEl;
    resetFsImageZoom();
    if (!clone || !thumb || !thumb.isConnected) {
      // fallback: чистый close без FLIP
      fsContext = null;
      closeFs();
      return;
    }
    var stageRect = clone.getBoundingClientRect();
    var thumbRect = thumb.getBoundingClientRect();
    if (stageRect.width === 0 || thumbRect.width === 0) {
      fsContext = null;
      closeFs();
      return;
    }
    var dx = thumbRect.left - stageRect.left;
    var dy = thumbRect.top  - stageRect.top;
    var sx = thumbRect.width  / stageRect.width;
    var sy = thumbRect.height / stageRect.height;

    releaseFocusTrap();
    clearFsCursorZones();
    var prevFocus = thumb;

    gsap.to(clone, {
      x: dx, y: dy, scaleX: sx, scaleY: sy,
      transformOrigin: '0 0',
      duration: 0.5, ease: 'expo.inOut'
    });
    gsap.to(fsOverlay, {
      opacity: 0,
      duration: 0.4,
      ease: 'expo.inOut',
      onComplete: function () {
        fsOverlay.classList.remove('is-open');
        fsOverlay.style.opacity = '';
        fsOverlay.hidden = true;
        while (fsStage && fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);
        releaseFsImageZoom();
        document.documentElement.style.overflow = '';
        updateLenisState();
        restoreFsContext();
        try { prevFocus.focus({ preventScroll: true }); } catch (_) {}
      }
    });
  }

  /* Унифицированный диспетчер навигации для fs-overlay: gallery / blueprint. */
  function navFs(direction) {
    if (fsContext === 'gallery') navGallery(direction);
    else if (fsContext === 'blueprint') navBlueprint(direction);
  }

  function navGallery(direction) {
    if (fsContext !== 'gallery' || gallery.list.length < 2) return;
    var prev = gallery.index;
    var n = gallery.list.length;
    gallery.index = ((gallery.index + direction) % n + n) % n;
    var wrapped =
      (direction === +1 && prev === n - 1) ||
      (direction === -1 && prev === 0);
    swapGalleryImage(gallery.list[gallery.index], wrapped);
  }

  /* ─── Blueprint fullscreen — переиспользует media-fs prev/next/counter ──── */
  function openFsBlueprint(id, pageIdx, triggerEl) {
    if (!id) return;
    var pages = getBpPages(id);
    if (!pages.length) return;
    ensureFsOverlay();
    releaseFsImageZoom();
    blueprintFs.id = id;
    blueprintFs.total = pages.length;
    blueprintFs.index = Math.max(0, Math.min(pages.length - 1, pageIdx || 0));
    blueprintFs.triggerEl = triggerEl || null;
    fsContext = 'blueprint';
    fsPreviousFocus = triggerEl || null;

    (function(){ var __I=window.I18N; fsOverlay.setAttribute('aria-label', (__I&&__I.t)?__I.t('fs.blueprintViewer'):'Blueprint viewer'); })();
    var hasNav = pages.length > 1;
    fsPrev.hidden    = !hasNav;
    fsNext.hidden    = !hasNav;
    fsCounter.hidden = !hasNav;

    while (fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);
    // v0.22.3: в FS нужен self-contained SVG (с сеткой и title-block),
    // потому что fs-stage не имеет CSS-сетки фоном и HTML-overlay'я.
    var svg = buildBlueprintSVG(id, blueprintFs.index, { forExport: true });
    if (svg) {
      svg.removeAttribute('style');
      fsStage.appendChild(svg);
      fsCurrentEl = svg;
    }

    fsOverlay.hidden = false;
    void fsOverlay.offsetWidth;
    fsOverlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    updateLenisState();
    updateBlueprintFsUI(false);
    setupFocusTrap();
  }
  function navBlueprint(direction) {
    if (fsContext !== 'blueprint' || blueprintFs.total < 2) return;
    var prev = blueprintFs.index;
    var n = blueprintFs.total;
    blueprintFs.index = ((blueprintFs.index + direction) % n + n) % n;
    var wrapped =
      (direction === +1 && prev === n - 1) ||
      (direction === -1 && prev === 0);
    swapBlueprintSvg(wrapped);
  }
  function swapBlueprintSvg(wrapped) {
    if (typeof gsap !== 'undefined') gsap.killTweensOf(fsStage.children);
    Array.prototype.slice.call(fsStage.children).forEach(function (c) {
      if (c !== fsCurrentEl && c.parentNode) c.parentNode.removeChild(c);
    });
    var oldEl = fsCurrentEl;
    var newEl = buildBlueprintSVG(blueprintFs.id, blueprintFs.index, { forExport: true });
    if (!newEl) return;
    fsStage.appendChild(newEl);
    fsCurrentEl = newEl;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || document.hidden || typeof gsap === 'undefined') {
      if (oldEl && oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      updateBlueprintFsUI(wrapped);
      return;
    }
    gsap.set(newEl, { opacity: 0 });
    gsap.to(newEl, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    if (oldEl) {
      gsap.to(oldEl, {
        opacity: 0, duration: 0.35, ease: 'power2.out',
        onComplete: function () { if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl); }
      });
    }
    updateBlueprintFsUI(wrapped);
  }
  function updateBlueprintFsUI(wrapped) {
    var i = blueprintFs.index, n = blueprintFs.total;
    if (fsCounter) fsCounter.textContent = (i + 1) + ' / ' + n;
    // Phase 4a — собираем counter из i18n-кусков (prefix + N + of + total).
    if (fsAnnouncer) {
      var __I = window.I18N;
      var __pfx = (__I && __I.t) ? __I.t('fs.blueprintPrefix') : 'Blueprint';
      var __of  = (__I && __I.t) ? __I.t('fs.ofWord') : 'of';
      fsAnnouncer.textContent = __pfx + ' ' + (i + 1) + ' ' + __of + ' ' + n;
    }
    if (wrapped && fsCounter && typeof gsap !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(fsCounter,
        { scale: 1 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
  }

  function swapGalleryImage(nextImg, wrapped) {
    /* v0.20.3 — Stage children теперь absolutely-centered через CSS
       (inset+margin:auto), поэтому swap = pure crossfade. Не пиним
       inline-стилями (имело edge case'ы с unloaded lazy-img и
       transform-остатками от FLIP). Кленап накопившихся stale
       fading-out children делается перед каждым swap. */
    if (typeof gsap !== 'undefined') gsap.killTweensOf(fsStage.children);
    Array.prototype.slice.call(fsStage.children).forEach(function (c) {
      if (c !== fsCurrentEl && c.parentNode) c.parentNode.removeChild(c);
    });

    var oldEl = fsCurrentEl;
    var newEl = buildImageClone(nextImg);
    fsStage.appendChild(newEl);
    fsCurrentEl = newEl;
    gallery.triggerEl = nextImg;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || document.hidden || typeof gsap === 'undefined') {
      if (oldEl && oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      activateFsImageZoom(newEl);
      updateGalleryUI(wrapped);
      preloadNeighbors();
      return;
    }
    activateFsImageZoom(newEl);
    gsap.set(newEl, { opacity: 0 });
    gsap.to(newEl, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    if (oldEl) {
      gsap.to(oldEl, {
        opacity: 0, duration: 0.35, ease: 'power2.out',
        onComplete: function () { if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl); }
      });
    }
    updateGalleryUI(wrapped);
    preloadNeighbors();
  }

  function updateGalleryUI(wrapped) {
    var i = gallery.index, n = gallery.list.length;
    if (fsCounter) fsCounter.textContent = (i + 1) + ' / ' + n;
    // Phase 4a — counter из i18n-кусков.
    if (fsAnnouncer) {
      var __II = window.I18N;
      var __ipfx = (__II && __II.t) ? __II.t('fs.imagePrefix') : 'Image';
      var __iof  = (__II && __II.t) ? __II.t('fs.ofWord') : 'of';
      fsAnnouncer.textContent = __ipfx + ' ' + (i + 1) + ' ' + __iof + ' ' + n;
    }
    if (wrapped && fsCounter && typeof gsap !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(fsCounter,
        { scale: 1 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
  }

  function preloadNeighbors() {
    var n = gallery.list.length;
    if (n < 2) return;
    var nextIdx = (gallery.index + 1) % n;
    var prevIdx = (gallery.index - 1 + n) % n;
    [gallery.list[nextIdx], gallery.list[prevIdx]].forEach(function (img) {
      if (!img || !img.src) return;
      var pre = new Image();
      pre.src = img.src;  // browser cache prime
    });
  }

  function restoreFsContext() {
    fsContext = null;
    gallery.list = [];
    gallery.index = 0;
    gallery.triggerEl = null;
    blueprintFs.id = null;
    blueprintFs.total = 0;
    blueprintFs.index = 0;
    blueprintFs.triggerEl = null;
    fsCurrentEl = null;
    fsPreviousFocus = null;
    if (fsPrev)    fsPrev.hidden = true;
    if (fsNext)    fsNext.hidden = true;
    if (fsCounter) { fsCounter.hidden = true; fsCounter.textContent = ''; }
    if (fsAnnouncer) fsAnnouncer.textContent = '';
    if (fsOverlay) fsOverlay.setAttribute('aria-label', 'Fullscreen view');
  }

  function setupFocusTrap() {
    releaseFocusTrap();
    var focusable = [];
    if (fsPrev && !fsPrev.hidden) focusable.push(fsPrev);
    if (fsNext && !fsNext.hidden) focusable.push(fsNext);
    if (fsZoomOutBtn && fsZoomBar && !fsZoomBar.hidden && !fsZoomOutBtn.disabled) focusable.push(fsZoomOutBtn);
    if (fsZoomFitBtn && fsZoomBar && !fsZoomBar.hidden && !fsZoomFitBtn.disabled) focusable.push(fsZoomFitBtn);
    if (fsZoomActualBtn && fsZoomBar && !fsZoomBar.hidden && !fsZoomActualBtn.disabled) focusable.push(fsZoomActualBtn);
    if (fsZoomInBtn && fsZoomBar && !fsZoomBar.hidden && !fsZoomInBtn.disabled) focusable.push(fsZoomInBtn);
    focusable.push(fsCloseBtn);

    focusTrapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    fsOverlay.addEventListener('keydown', focusTrapHandler);
    try { fsCloseBtn.focus({ preventScroll: true }); } catch (_) {}
  }

  function releaseFocusTrap() {
    if (focusTrapHandler && fsOverlay) {
      fsOverlay.removeEventListener('keydown', focusTrapHandler);
    }
    focusTrapHandler = null;
  }

  function setupFsImageZoom() {
    fsStage.addEventListener('wheel', handleFsImageWheel, { passive: false });
    fsStage.addEventListener('pointerdown', handleFsImagePointerDown);
    fsStage.addEventListener('pointermove', handleFsImagePointerMove);
    fsStage.addEventListener('pointerup', handleFsImagePointerUp);
    fsStage.addEventListener('pointercancel', handleFsImagePointerUp);
    fsStage.addEventListener('dblclick', handleFsImageDoubleClick);
    window.addEventListener('resize', function () {
      if (isFsImageZoomActive()) applyFsImageTransform();
    });
  }

  function isFsImageZoomActive() {
    return fsContext === 'gallery' && fsCurrentEl && fsCurrentEl.tagName === 'IMG';
  }

  function clampFsZoom(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function activateFsImageZoom(img) {
    if (!img) return;
    fsImageZoom.scale = 1;
    fsImageZoom.x = 0;
    fsImageZoom.y = 0;
    fsImageZoom.min = 1;
    fsImageZoom.pointers = {};
    fsImageZoom.panStart = null;
    fsImageZoom.pinchStart = null;
    fsImageZoom.suppressClick = false;
    fsImageZoom.actual = computeFsActualScale(img);
    fsImageZoom.max = Math.max(4, Math.min(8, fsImageZoom.actual * 2));
    if (fsZoomBar) fsZoomBar.hidden = false;
    if (fsOverlay) fsOverlay.classList.add('is-gallery');
    applyFsImageTransform();
  }

  function releaseFsImageZoom() {
    if (fsCurrentEl && fsCurrentEl.style) {
      fsCurrentEl.style.transform = '';
      fsCurrentEl.style.transformOrigin = '';
    }
    fsImageZoom.scale = 1;
    fsImageZoom.x = 0;
    fsImageZoom.y = 0;
    fsImageZoom.pointers = {};
    fsImageZoom.panStart = null;
    fsImageZoom.pinchStart = null;
    fsImageZoom.suppressClick = false;
    if (fsZoomBar) fsZoomBar.hidden = true;
    if (fsOverlay) fsOverlay.classList.remove('is-gallery', 'is-zoomed', 'is-panning');
    updateFsZoomButtons();
  }

  function computeFsActualScale(img) {
    var rect = img.getBoundingClientRect();
    var baseW = img.offsetWidth || rect.width || 1;
    var baseH = img.offsetHeight || rect.height || 1;
    var naturalW = img.naturalWidth || baseW;
    var naturalH = img.naturalHeight || baseH;
    return Math.max(1, Math.min(naturalW / baseW, naturalH / baseH, 6));
  }

  function applyFsImageTransform() {
    if (!isFsImageZoomActive()) return;
    var stageW = fsStage.clientWidth || window.innerWidth;
    var stageH = fsStage.clientHeight || window.innerHeight;
    var baseW = fsCurrentEl.offsetWidth || 1;
    var baseH = fsCurrentEl.offsetHeight || 1;
    var maxX = Math.max(0, (baseW * fsImageZoom.scale - stageW) / 2);
    var maxY = Math.max(0, (baseH * fsImageZoom.scale - stageH) / 2);
    if (fsImageZoom.scale <= 1.001) {
      fsImageZoom.scale = 1;
      fsImageZoom.x = 0;
      fsImageZoom.y = 0;
    } else {
      fsImageZoom.x = clampFsZoom(fsImageZoom.x, -maxX, maxX);
      fsImageZoom.y = clampFsZoom(fsImageZoom.y, -maxY, maxY);
    }
    fsCurrentEl.style.transformOrigin = 'center center';
    fsCurrentEl.style.transform =
      'translate3d(' + fsImageZoom.x.toFixed(2) + 'px,' + fsImageZoom.y.toFixed(2) + 'px,0) ' +
      'scale(' + fsImageZoom.scale.toFixed(4) + ')';
    if (fsOverlay) fsOverlay.classList.toggle('is-zoomed', fsImageZoom.scale > 1.01);
    updateFsZoomButtons();
  }

  function updateFsZoomButtons() {
    if (!fsZoomBar || fsZoomBar.hidden) return;
    var atFit = fsImageZoom.scale <= 1.01;
    var atActual = Math.abs(fsImageZoom.scale - fsImageZoom.actual) < 0.03;
    fsZoomOutBtn.disabled = atFit;
    fsZoomFitBtn.disabled = atFit && Math.abs(fsImageZoom.x) < 1 && Math.abs(fsImageZoom.y) < 1;
    fsZoomActualBtn.disabled = atActual;
    fsZoomInBtn.disabled = fsImageZoom.scale >= fsImageZoom.max - 0.03;
  }

  function setFsImageScale(nextScale, clientX, clientY) {
    if (!isFsImageZoomActive()) return;
    var next = clampFsZoom(nextScale, fsImageZoom.min, fsImageZoom.max);
    var old = fsImageZoom.scale || 1;
    var stageRect = fsStage.getBoundingClientRect();
    var centerX = stageRect.left + stageRect.width / 2;
    var centerY = stageRect.top + stageRect.height / 2;
    var relX = (clientX || centerX) - centerX;
    var relY = (clientY || centerY) - centerY;
    var localX = (relX - fsImageZoom.x) / old;
    var localY = (relY - fsImageZoom.y) / old;
    fsImageZoom.scale = next;
    fsImageZoom.x = relX - localX * next;
    fsImageZoom.y = relY - localY * next;
    applyFsImageTransform();
  }

  function zoomFsImageBy(factor) {
    setFsImageScale(fsImageZoom.scale * factor, window.innerWidth / 2, window.innerHeight / 2);
  }

  function resetFsImageZoom() {
    if (!isFsImageZoomActive()) return;
    fsImageZoom.scale = 1;
    fsImageZoom.x = 0;
    fsImageZoom.y = 0;
    applyFsImageTransform();
  }

  function handleFsImageWheel(e) {
    if (!isFsImageZoomActive()) return;
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 0.88;
    setFsImageScale(fsImageZoom.scale * factor, e.clientX, e.clientY);
  }

  function handleFsImageDoubleClick(e) {
    if (!isFsImageZoomActive()) return;
    if (e.target.closest && e.target.closest('.media-fs__prev, .media-fs__next, .media-fs__close, .media-fs__zoom')) return;
    e.preventDefault();
    if (fsImageZoom.scale <= 1.01) setFsImageScale(fsImageZoom.actual, e.clientX, e.clientY);
    else resetFsImageZoom();
  }

  function getFsPointers() {
    return Object.keys(fsImageZoom.pointers).map(function (key) { return fsImageZoom.pointers[key]; });
  }

  function getPointerDistance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getPointerMidpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function handleFsImagePointerDown(e) {
    if (!isFsImageZoomActive()) return;
    if (e.target.closest && e.target.closest('.media-fs__prev, .media-fs__next, .media-fs__close, .media-fs__zoom')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fsImageZoom.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { fsStage.setPointerCapture(e.pointerId); } catch (_) {}
    var pointers = getFsPointers();
    if (pointers.length === 1) {
      fsImageZoom.panStart = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: fsImageZoom.x,
        startY: fsImageZoom.y
      };
    } else if (pointers.length === 2) {
      fsImageZoom.pinchStart = {
        distance: getPointerDistance(pointers[0], pointers[1]) || 1,
        midpoint: getPointerMidpoint(pointers[0], pointers[1]),
        scale: fsImageZoom.scale,
        x: fsImageZoom.x,
        y: fsImageZoom.y
      };
    }
    e.preventDefault();
  }

  function handleFsImagePointerMove(e) {
    if (!isFsImageZoomActive() || !fsImageZoom.pointers[e.pointerId]) return;
    fsImageZoom.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var pointers = getFsPointers();
    if (pointers.length >= 2 && fsImageZoom.pinchStart) {
      fsImageZoom.suppressClick = true;
      var midpoint = getPointerMidpoint(pointers[0], pointers[1]);
      var ratio = getPointerDistance(pointers[0], pointers[1]) / fsImageZoom.pinchStart.distance;
      fsImageZoom.scale = clampFsZoom(fsImageZoom.pinchStart.scale * ratio, fsImageZoom.min, fsImageZoom.max);
      fsImageZoom.x = fsImageZoom.pinchStart.x + (midpoint.x - fsImageZoom.pinchStart.midpoint.x);
      fsImageZoom.y = fsImageZoom.pinchStart.y + (midpoint.y - fsImageZoom.pinchStart.midpoint.y);
      applyFsImageTransform();
      e.preventDefault();
      return;
    }
    if (pointers.length === 1 && fsImageZoom.scale > 1.01 && fsImageZoom.panStart) {
      if (Math.abs(e.clientX - fsImageZoom.panStart.x) > 4 ||
          Math.abs(e.clientY - fsImageZoom.panStart.y) > 4) {
        fsImageZoom.suppressClick = true;
      }
      fsImageZoom.x = fsImageZoom.panStart.startX + (e.clientX - fsImageZoom.panStart.x);
      fsImageZoom.y = fsImageZoom.panStart.startY + (e.clientY - fsImageZoom.panStart.y);
      if (fsOverlay) fsOverlay.classList.add('is-panning');
      applyFsImageTransform();
      e.preventDefault();
    }
  }

  function handleFsImagePointerUp(e) {
    if (fsImageZoom.pointers[e.pointerId]) delete fsImageZoom.pointers[e.pointerId];
    try { fsStage.releasePointerCapture(e.pointerId); } catch (_) {}
    var pointers = getFsPointers();
    if (pointers.length === 1) {
      fsImageZoom.panStart = {
        pointerId: null,
        x: pointers[0].x,
        y: pointers[0].y,
        startX: fsImageZoom.x,
        startY: fsImageZoom.y
      };
      fsImageZoom.pinchStart = null;
    } else {
      fsImageZoom.panStart = null;
      fsImageZoom.pinchStart = null;
      if (fsOverlay) fsOverlay.classList.remove('is-panning');
    }
  }

  function setupFsSwipe(target) {
    var x0 = null, y0 = null;
    target.addEventListener('touchstart', function (e) {
      if (fsContext === 'gallery' && fsImageZoom.scale > 1.01) {
        x0 = y0 = null;
        return;
      }
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    target.addEventListener('touchend', function (e) {
      if (fsContext === 'gallery' && fsImageZoom.scale > 1.01) {
        x0 = y0 = null; return;
      }
      if (x0 == null || (fsContext !== 'gallery' && fsContext !== 'blueprint')) {
        x0 = y0 = null; return;
      }
      var t = e.changedTouches[0] || {};
      var dx = (t.clientX || 0) - x0;
      var dy = (t.clientY || 0) - y0;
      x0 = y0 = null;
      // Horizontal-dominant + threshold 60px
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
      navFs(dx < 0 ? +1 : -1);
    }, { passive: true });
  }

  // v0.8.4 [M4] — кешируем .cursor один раз. Раньше querySelector('.cursor')
  // вызывался на каждый mousemove-кадр внутри fs-overlay (10–100/сек).
  // Элемент создаётся в index.html статически, ниже DOMContentLoaded — лениво
  // подтянем при первом обращении и закешируем.
  var cachedCursorEl = null;
  function getCursorEl() {
    if (cachedCursorEl && cachedCursorEl.isConnected) return cachedCursorEl;
    cachedCursorEl = document.querySelector('.cursor');
    return cachedCursorEl;
  }

  function trackFsCursorZones(e) {
    if (fsContext !== 'gallery') return;
    var cursorEl = getCursorEl();
    if (!cursorEl) return;
    // Над кнопками data-cursor=link уже отрисовывает link-state — сбрасываем зону
    if (e.target.closest && e.target.closest('.media-fs__prev, .media-fs__next, .media-fs__close')) {
      cursorEl.classList.remove('is-fs-prev', 'is-fs-next');
      return;
    }
    var dir = e.clientX < window.innerWidth / 2 ? 'prev' : 'next';
    var addCls = 'is-fs-' + dir;
    var rmCls  = dir === 'prev' ? 'is-fs-next' : 'is-fs-prev';
    if (!cursorEl.classList.contains(addCls)) {
      cursorEl.classList.remove(rmCls);
      cursorEl.classList.add(addCls);
    }
  }

  function clearFsCursorZones() {
    var cursorEl = getCursorEl();
    if (cursorEl) cursorEl.classList.remove('is-fs-prev', 'is-fs-next');
  }

  // Делегированный клик по fs-триггерам.
  // v0.15.2 [B3] — 2D ветка удалена вместе с .case-media-fs-btn.
  // v0.20.0 — 2D ветка восстановлена через [data-gallery] img (без per-image кнопки).
  document.addEventListener('click', function (e) {
    // Gallery image trigger — поднимаем по closest до img внутри [data-gallery].
    var galleryImg = e.target.closest && e.target.closest('[data-gallery] img');
    if (galleryImg) {
      e.preventDefault();
      openFsImageGallery(galleryImg);
      return;
    }
    // 3D
    var btn3d = e.target.closest('.case-3d__fs-btn');
    if (btn3d) {
      e.preventDefault();
      if (window.CodexViewer && typeof window.CodexViewer.openFullscreen === 'function') {
        window.CodexViewer.openFullscreen();
      }
      return;
    }
    // Blueprints — top-toolbar (открывает текущую страницу) или per-page mini-toolbar.
    var btnBp = e.target.closest('.case-blueprints__fs-btn');
    if (btnBp) {
      e.preventDefault();
      var pageAttr = btnBp.getAttribute('data-bp-page');
      var pageIdx = pageAttr != null ? (parseInt(pageAttr, 10) || 0) : currentBpPage;
      openFsBlueprint(currentCaseId, pageIdx, btnBp);
      return;
    }
  });

  // Keyboard: Enter/Space на gallery img открывает; ESC закрывает; стрелки навигируют.
  document.addEventListener('keydown', function (e) {
    // Enter/Space на focused gallery img
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches &&
        e.target.matches('[data-gallery] img')) {
      e.preventDefault();
      openFsImageGallery(e.target);
      return;
    }
    if (!fsOverlay || !fsOverlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFs();
    } else if ((fsContext === 'gallery' || fsContext === 'blueprint') && e.key === 'ArrowLeft') {
      e.preventDefault();
      navFs(-1);
    } else if ((fsContext === 'gallery' || fsContext === 'blueprint') && e.key === 'ArrowRight') {
      e.preventDefault();
      navFs(+1);
    }
  });

  window.CodexMediaFullscreen = {
    openElement: openFs,
    close: closeFs
  };

})();

/* ══════════════════════════════════════════════════════════════════════
   CUSTOM CURSOR + MAGNETIC v0.13.0
   ─────────────────────────────────────────────────────────────────────
   Отдельный IIFE — не трогает CARDS_DATA и casework выше.
   • Только desktop pointer:fine (touch/coarse — ранний return).
   • reduced-motion — ранний return (native cursor + CSS display:none).
   • Движение кольца: 1:1 с mouse (v0.14.0). Раньше был lerp 0.18 +
     gsap.ticker — пользователи жаловались на «перехват скорости» (курсор
     отстаёт от нативного на других поверхностях OS). Теперь setX/setY
     напрямую в mousemove — 0 латенси, движение «instant».
     Визуал и .is-hover / .is-active классы — без изменений.
   • Магнит: .tag, .cards-toggle, .case-back, .logo, .work-card —
     mouseenter → считаем offset курсор-относительно-центра, tween x/y × 0.35.
     mouseleave → обратно в (0,0).
   • При :hover на магнитных — .cursor добавляет .is-hover (кольцо толстеет).
══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Ранние отказы — по motion_brief и требованиям.
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof gsap === 'undefined') return;

  var cursor = document.querySelector('.cursor');
  if (!cursor) return;

  // Все проверки пройдены — ставим класс, который включает
  // `html.cursor-fine * { cursor: none }` в CSS (специфичность выше
  // всех встроенных `cursor: pointer` в дизайн-системе).
  document.documentElement.classList.add('cursor-fine');

  /* ─── v0.19.0 — Extended cursor states (data-cursor delegation) ──────
     Базовый ring + dot (v0.13.0/v0.14.0) НЕ трогается. Здесь:
       • строим shell DOM (label + crosshair) внутри .cursor
       • bulk-помечаем статические элементы data-cursor-атрибутами
       • делегированный mouseover-listener на document меняет state-класс
     States: 'link' (фон-инфляция dot'а), 'work' (64px ring + VIEW →),
     'drag' (32px crosshair). reduced-motion / coarse — IIFE early-return'нул
     ещё выше, ни одна из этих веток не выполнится. */
  (function buildShellDom() {
    if (cursor.querySelector('.cursor__shell')) return;
    var shell = document.createElement('div');
    shell.className = 'cursor__shell';
    shell.setAttribute('aria-hidden', 'true');
    var label = document.createElement('span');
    label.className = 'cursor__shell-label';
    var crosshair = document.createElement('span');
    crosshair.className = 'cursor__crosshair';
    crosshair.innerHTML = '<i></i><i></i><i></i><i></i>';
    shell.appendChild(label);
    shell.appendChild(crosshair);
    cursor.appendChild(shell);
  })();

  // Bulk-mark static interactive elements (idempotent — пропускаем если
  // атрибут уже стоит в HTML). Это избавляет от ~15 ручных HTML-правок
  // и не ломает dev-flow поиска по data-cursor в index.html (drag и skip
  // помечены статически как опорные точки).
  function markStatic() {
    document.querySelectorAll('.work-card:not(.tag-card)').forEach(function (e) {
      if (!e.hasAttribute('data-cursor')) e.setAttribute('data-cursor', 'work');
    });
    var LINK_SELECTOR =
      '.contact-btn, #contact-pill, .case-share, .case-nav__btn, ' +
      '#blueprint-export-svg, .case-blueprints__fs-btn, ' +
      '.top-pill--free, #free-assets-footer';
    document.querySelectorAll(LINK_SELECTOR).forEach(function (e) {
      if (!e.hasAttribute('data-cursor')) e.setAttribute('data-cursor', 'link');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markStatic, { once: true });
  } else {
    markStatic();
  }

  // Делегированный switch состояний. mouseover bubbles → ловим в document.
  // closest('[data-cursor]') карабкается до ближайшего предка с атрибутом —
  // child-элементы внутри .work-card / .case-3d__canvas наследуют state.
  // Когда мышь уходит на background-elements без data-cursor, state=null.
  var STATE_CLASSES = ['is-link', 'is-work', 'is-drag'];
  var currentState  = null;
  function applyCursorState(state) {
    STATE_CLASSES.forEach(function (c) { cursor.classList.remove(c); });
    if (state) cursor.classList.add('is-' + state);
  }
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-cursor]');
    var state = el ? el.getAttribute('data-cursor') : null;
    if (state === currentState) return;
    currentState = state;
    applyCursorState(state);
  });

  /* Магнитные селекторы — уже существующие интерактивные элементы.
     v0.13.1 — две группы силы магнита:
       .work-card — 0.07 (было 0.35, -80%) — карточки большие и сильно ездили
       остальные — 0.18 (было 0.35, -≈50%) — кнопки/теги достаточно
       отзывчивые по-прежнему, но мягче. */
  // v0.14.1 [3] — добавлен .top-pill--contact (кнопка Contact Telegram).
  // Free Assets pill — disabled, магнит ему не нужен.
  // v0.8.2: .tag убран — класс мёртв с переезда на .tags-dropdown__* (v0.15.5).
  var MAGNETIC_SELECTOR =
    '.cards-toggle, .theme-toggle, .case-back, .logo, .work-card:not(.tag-card), ' +
    '.case-tab, .case-mobile-bar__logo, .top-pill--contact';

  // Селекторы с ослабленной силой магнита (-80% от стандартной).
  var SOFT_MAGNETIC_SELECTOR = '.work-card:not(.tag-card)';

  // Сила притяжения. Чем больше — тем сильнее элемент едет за курсором.
  var PULL_DEFAULT = 0.18;  // ≈-50% от v0.13.0 (было 0.35)
  // v0.14.0 [6] — 0.061 → 0.052 (−15%). Пользователи жаловались,
  // что блок карточек слишком сильно тянется к курсору и почти касается
  // скролла справа на ноутбуке. Смягчаем на 15%.
  var PULL_SOFT    = 0.052; // ≈-85.1% от v0.13.0 (было 0.35), для .work-card

  function getPullFor(el) {
    return el.matches(SOFT_MAGNETIC_SELECTOR) ? PULL_SOFT : PULL_DEFAULT;
  }

  // quickSetter — дешёвый путь писать transform:translate (без tween-объектов).
  var setX = gsap.quickSetter(cursor, 'x', 'px');
  var setY = gsap.quickSetter(cursor, 'y', 'px');

  var active = false;

  // v0.14.0 — кольцо движется 1:1 с mouse. Без lerp, без ticker'а.
  // Это убирает ощущение «перехвата скорости» на desktop'e.
  window.addEventListener('mousemove', function (e) {
    if (!active) {
      active = true;
      cursor.classList.add('is-active');
    }
    setX(e.clientX);
    setY(e.clientY);
  }, { passive: true });

  // Спрятать курсор когда мышь уходит с окна (alt-tab, переход на devtools).
  window.addEventListener('mouseleave', function () {
    cursor.classList.remove('is-active');
    active = false;
  });
  window.addEventListener('mouseenter', function () {
    if (!active) { active = true; cursor.classList.add('is-active'); }
  });

  /* ─── Магнит ─────────────────────────────────────────────────────────
     Делегирование через mouseover/mouseout на document — ловит
     динамически добавленные .work-card (фильтр тэгов их перестраивает,
     и навешивать слушатели на каждую карточку — хрупко). */
  var currentEl    = null;

  function enterMagnetic(el) {
    if (currentEl === el) return;
    leaveMagnetic(); // старый элемент — вернуть в (0,0) если был
    currentEl = el;
    cursor.classList.add('is-hover');
    // mousemove-ный обработчик на элементе — считаем offset каждый кадр
    el.addEventListener('mousemove', onMagneticMove);
  }

  function leaveMagnetic() {
    if (!currentEl) return;
    currentEl.removeEventListener('mousemove', onMagneticMove);
    gsap.to(currentEl, {
      x: 0, y: 0,
      duration: 0.45,
      ease: 'power3.out',
      overwrite: 'auto'
    });
    currentEl = null;
    cursor.classList.remove('is-hover');
  }

  function onMagneticMove(e) {
    var el = e.currentTarget;
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width  / 2;
    var cy = rect.top  + rect.height / 2;
    var dx = e.clientX - cx;
    var dy = e.clientY - cy;
    var pull = getPullFor(el);  // 0.07 для карточек, 0.18 для прочего
    gsap.to(el, {
      x: dx * pull,
      y: dy * pull,
      duration: 0.3,
      ease: 'power3.out',
      overwrite: 'auto'
    });
  }

  document.addEventListener('mouseover', function (e) {
    var target = e.target.closest(MAGNETIC_SELECTOR);
    if (!target) return;
    enterMagnetic(target);
  });

  document.addEventListener('mouseout', function (e) {
    var target = e.target.closest(MAGNETIC_SELECTOR);
    if (!target) return;
    // relatedTarget может быть ребёнком target'а — это НЕ leave
    if (target.contains(e.relatedTarget)) return;
    leaveMagnetic();
  });

  // Если вдруг reduce включили через девтулзы после загрузки — выключаем магнит.
  var mmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function onMotionChange() {
    if (mmQuery.matches) {
      leaveMagnetic();
      cursor.classList.remove('is-active', 'is-hover');
    }
  }
  if (mmQuery.addEventListener) mmQuery.addEventListener('change', onMotionChange);
  else if (mmQuery.addListener) mmQuery.addListener(onMotionChange);

})();
