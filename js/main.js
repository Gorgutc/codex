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
    'orbital-mk-ii': { role: 'Личный', tools: ['Blender', 'Substance Painter', 'Marmoset'], modelSrc: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb', modelStats: { triangles: '18,432', vertices: '9,521', materials: 3, textures: '4 × 4 K', software: 'Blender' }, items: makeItems({
      id: 'orbital-mk-ii',
      palette: [
        'linear-gradient(135deg,#1e2d3d 0%,#2a3a4a 100%)',
        'linear-gradient(135deg,#1a2535 0%,#22303f 100%)',
        'linear-gradient(135deg,#152030 0%,#1e2c3c 100%)',
        'linear-gradient(135deg,#112030 0%,#1a2c3c 100%)',
        'linear-gradient(135deg,#0e1a28 0%,#182636 100%)'
      ],
      captions: [
        { label: 'Hero render',         desc: 'Sci-fi prop engineered for AAA pipeline. Full PBR, clean manifold topology.' },
        { label: 'Material breakdown',  desc: 'Substance layer stack — roughness variation separates wear zones from clean panels.' },
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

    'vega-shell': { role: 'Личный', tools: ['Blender', 'ZBrush', 'Substance Painter'], modelSrc: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb', modelStats: { triangles: '25,600', vertices: '13,200', materials: 5, textures: '6 × 2 K', software: 'Blender' }, items: makeItems({
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

    'ironclad-frame': { role: 'R&D', tools: ['Blender', 'CAD import', 'Inkscape'], modelSrc: './assets/models/ironclad-frame.glb', modelStats: { triangles: '464', vertices: '240', materials: 2, textures: 'Procedural (PBR)', software: 'Blender + Fusion 360' }, items: makeItems({
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

    'corten-series': { role: 'Клиентский', tools: ['Blender', 'Substance Painter', 'DaVinci Resolve'], modelSrc: './assets/models/corten-series.glb', modelStats: { triangles: '60', vertices: '40', materials: 1, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
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

    'lumen-one': { role: 'Клиентский', tools: ['Blender', 'Inkscape'], modelSrc: './assets/models/lumen-one.glb', modelStats: { triangles: '1,352', vertices: '690', materials: 1, textures: '1 × 2 K', software: 'Blender + Substance' }, items: makeItems({
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

    'nightshard': { role: 'Личный', tools: ['Blender', 'Substance Painter', 'UE5'], modelSrc: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb', modelStats: { triangles: '15,488', vertices: '8,000', materials: 1, textures: '5 × 4 K', software: 'Blender + Substance' }, items: makeItems({
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

    'recon-drone': { role: 'Личный', tools: ['Blender', 'Substance Painter', 'UE5'], modelSrc: './assets/models/recon-drone.glb', modelStats: { triangles: '496', vertices: '266', materials: 3, textures: 'Procedural (PBR)', software: 'Blender' }, items: makeItems({
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

    'apex-frame': { role: 'Клиентский', tools: ['Blender', 'CAD export', 'Inkscape'], modelSrc: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb', modelStats: { triangles: '12,200', vertices: '6,300', materials: 4, textures: '4 × 2 K', software: 'ZBrush + Blender' }, items: makeItems({
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
    'nyx-panther': { role: 'Личный', tools: ['ZBrush', 'Blender', 'XGen'], modelSrc: './assets/models/nyx-panther.glb', modelStats: { triangles: '1,352', vertices: '690', materials: 1, textures: '1 × 2 K', software: 'ZBrush + Blender' }, items: makeItems({
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

    'drift-koi': { role: 'Личный', tools: ['ZBrush', 'Blender', 'Substance Painter'], modelSrc: './assets/models/drift-koi.glb', modelStats: { triangles: '168', vertices: '112', materials: 1, textures: 'Procedural (PBR)', software: 'ZBrush + Blender' }, items: makeItems({
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

    'glint-owl': { role: 'Личный', tools: ['ZBrush', 'Blender', 'Houdini groom'], modelSrc: './assets/models/glint-owl.glb', modelStats: { triangles: '496', vertices: '266', materials: 3, textures: 'Procedural (PBR)', software: 'ZBrush + Blender' }, items: makeItems({
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

    /* ── CAD placeholders (v0.14.0 [15a]) — промышленная серо-синяя палитра ── */
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
        { label: 'Assembly overview',   desc: 'Industrial link chain placeholder. Parametric pin-joint assembly sourced from CAD.' },
        { label: 'Bracket detail',      desc: 'Bolt-pattern close-up. Placeholder geometry — final topology pass pending.' },
        { label: 'Motion study',        desc: 'Range-of-motion sketch for the pivoting arm. Constraint solver preview.' },
        { label: 'Exploded view',       desc: 'Parts diagram for manufacture planning. Tolerances marked in source DWG.' },
        { label: 'Material preview',    desc: 'KeyShot pass — brushed steel and anodized aluminium swatches.' }
      ],
      text: {
        title: 'CAD placeholder',
        body:  'Этот кейс — технологический плейсхолдер. Финальный GLB, топология и рендеры готовятся. Используется для проверки layout и фильтра CAD-категории.'
      },
      inline: {
        title: 'Pipeline',
        body:  'Fusion 360 → STEP → Blender retopo → KeyShot marketing. В Dev-цикле заменяется live-рендером.'
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
        { label: 'Spine assembly',      desc: 'Kinematic spine placeholder. Parametric ribs driven by a single driver angle.' },
        { label: 'Rib section',         desc: 'Section-cut through one rib — thickness and fillet radii exposed as parameters.' },
        { label: 'Deflection test',     desc: 'FEA sketch — deflection map under 50 N lateral load. Placeholder visualisation.' },
        { label: 'Joint detail',        desc: 'Ball-and-socket joint close-up. Tolerance stack-up listed in source PDF.' },
        { label: 'Render study',        desc: 'KeyShot pass — matte steel against cool grey backdrop.' }
      ],
      text: {
        title: 'CAD placeholder',
        body:  'Кинематический позвоночник-плейсхолдер. Конструкция параметрическая: один управляющий угол гнёт все рёбра. Финальная модель и стенд-рендеры в процессе.'
      },
      inline: {
        title: 'Parametrics',
        body:  'Параметры: rib_count, rib_thickness, segment_angle. Связаны через Fusion 360 sketches → экспорт в Blender.'
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
        { label: 'Node overview',       desc: 'Structural strut node placeholder. Six-way connector for space-frame assemblies.' },
        { label: 'Axis diagram',        desc: 'Load-path diagram — principal axes marked for the structural engineer.' },
        { label: 'Cross-section',       desc: 'Section through the central hub. Wall thickness and weld-prep highlighted.' },
        { label: 'Mount plate',         desc: 'Bolt-circle mount plate. Parametric — updates when strut diameter changes.' },
        { label: 'Surface finish',      desc: 'KeyShot pass — powder-coated aluminium, matte warm grey.' }
      ],
      text: {
        title: 'CAD placeholder',
        body:  'Структурный strut-узел. Параметрическая CAD-геометрия: диаметр, толщина стенки и схема болтов связаны. Финальные рендеры и игровая топология готовятся.'
      },
      inline: {
        title: 'Use case',
        body:  'Применяется в space-frame прототипах. STEP экспортируется для CNC, Blender-retopo — для marketing-рендеров.'
      }
    }) }
  };

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
  function shuffleSeeded(arr, seed) {
    var a = arr.slice();
    var rand = mulberry32(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

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
  var modelViewerLoading = null;           // v0.11 — Promise загрузки <model-viewer>-скрипта
  var currentMv           = null;          // v0.11.4 — активный <model-viewer> (для cleanup)
  var currentMvReset      = null;          // v0.11.4 — функция reset camera текущего MV (вызываем при возврате в 3D)
  var currentOrbitProxy   = null;          // v0.11.1 — активный tween-proxy (legacy, больше не используется)
  var currentWheelListener = null;         // v0.11.1 — legacy (wheel-hijack удалён в v0.11.4)
  var currentLightDdDocClick = null;       // v0.7.3 — global click listener для close-on-outside (cleanup в destroy3D)
  var currentLightDdDocKey   = null;       // v0.7.3 — global keydown listener для Escape (cleanup в destroy3D)
  var pendingScrollReset = false;          // v0.10.2 — отложенный сброс scrollTop на 0
  var currentCategory = 'all';
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
    // v0.15.5 [П2] — currentCategory для совместимости: primary = первый фильтр или 'all'
    currentCategory = allActive ? 'all' : selectedFilters[0];
    document.dispatchEvent(new CustomEvent('codex:filter', {
      detail: {
        category: currentCategory,
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
      remove.setAttribute('aria-label', 'Remove ' + (FILTER_LABELS[key] || key));
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

  if (gameSwitch) {
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
      h += '<img class="case-item__img" src="' + item.src + '" alt="' + (item.label || '') + '" ';
      h += 'loading="lazy" draggable="false" onerror="this.remove();">';
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
  if (caseScroll) {
    caseScroll.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
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
  function openCase(id, opts) {
    opts = opts || {};
    var data = CARDS_DATA[id];
    if (!data) return;

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
        // 'nearest' прокручивал только когда карточка вне видимости.
        // 'center' — всегда держит активную карточку в центре скролла.
        // v0.2.2 [П1] ROOT CAUSE горизонтального съезда карточек:
        //   на mobile во время case-view #cards-scroll имеет display:none (0×0).
        //   scrollIntoView({block:'center'}) в таком контейнере вычисляет
        //   scrollLeft = offsetLeft + width/2 ≈ 187px и присваивает его
        //   #cards-scroll.scrollLeft. overflow-x:hidden блокирует жест
        //   пользователя, но не программный scrollLeft. При возврате
        //   все карточки визуально съезжают влево.
        // Фикс: пропускаем scrollIntoView пока mobile+collapsed;
        //   прокрутка к активной карточке выполняется в animations.js
        //   на codex:toggle{collapsed:false}, когда контейнер снова видим.
        var isMobileCollapsed =
          window.matchMedia('(max-width: 767px)').matches &&
          document.body.classList.contains('cards-collapsed');
        if (!isMobileCollapsed) {
          // v0.2.3 [П1] DESKTOP: smooth scrollIntoView, вызванный сразу,
          //   прерывается синхронным reflow из buildItems()/buildBlueprint()
          //   ниже в openCase() — scroll animation сбрасывается к 0 и
          //   активная карточка остаётся вне видимой зоны sidebar.
          //   Фикс: откладываем вызов на 2× rAF — к этому моменту
          //   DOM уже пересобран и smooth-анимация не прерывается.
          //   ROOT CAUSE воспроизведён playwright-ом: instant работает
          //   синхронно, smooth — нет. v0.2.2 mobile-поведение сохранено.
          var targetCard = card;
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      buildBlueprint(id);
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
    // На мобильном стрелки работают только когда case-view виден (sidebar свернут)
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile && !document.body.classList.contains('cards-collapsed')) return;
    e.preventDefault();
    navigateCase(e.key === 'ArrowLeft' ? -1 : 1);
  });

  /* ══════════════════════════════════
     v0.10 — BLUEPRINT RENDERER
     Генеративный: из hash(id) строим детерминированный чертёж,
     оформление берём из BLUEPRINT_META.
  ══════════════════════════════════ */
  var BLUEPRINT_META = {
    'orbital-mk-ii':  { view: 'Front view',    no: 'CS-001', unit: 'mm', overall: [1820, 1240], parts: ['Chassis', 'Thruster', 'Panel A', 'Panel B', 'Vent'] },
    'vega-shell':     { view: 'Exploded view', no: 'CS-002', unit: 'mm', overall: [1640, 1100], parts: ['Shoulder', 'Chest', 'Forearm', 'Greave'] },
    'ironclad-frame': { view: 'Top view',      no: 'CS-003', unit: 'mm', overall: [2400, 1200], parts: ['Frame', 'Bracket', 'Flange', 'Bolt row'] },
    'corten-series':  { view: 'Front view',    no: 'CS-004', unit: 'cm', overall: [85, 110],    parts: ['Seat', 'Back', 'Leg L', 'Leg R'] },
    'lumen-one':      { view: 'Section A-A',   no: 'CS-005', unit: 'mm', overall: [320, 420],   parts: ['Shade', 'Stem', 'Base', 'Socket'] },
    'flux-capsule':   { view: 'Front view',    no: 'CS-006', unit: 'mm', overall: [900, 1400],  parts: ['Capsule', 'Coil', 'Core', 'Port'] },
    'nightshard':     { view: 'Front view',    no: 'CS-007', unit: 'mm', overall: [640, 1820],  parts: ['Blade', 'Guard', 'Grip', 'Pommel'] },
    'recon-drone':    { view: 'Top view',      no: 'CS-008', unit: 'mm', overall: [1280, 1280], parts: ['Hub', 'Rotor NE', 'Rotor SE', 'Rotor SW', 'Rotor NW'] },
    'apex-frame':     { view: 'Side view',     no: 'CS-009', unit: 'mm', overall: [1700, 900],  parts: ['Top rail', 'Bottom rail', 'Strut L', 'Strut R'] },
    'core-rig':       { view: 'Front view',    no: 'CS-010', unit: 'mm', overall: [1200, 1600], parts: ['Mount', 'Arm', 'Yoke', 'Clamp'] },
    'helix-reveal':   { view: 'Exploded view', no: 'CS-011', unit: 'mm', overall: [1440, 1440], parts: ['Ring A', 'Ring B', 'Spine', 'Cap'] },
    'arc-motion':     { view: 'Side view',     no: 'CS-012', unit: 'mm', overall: [2000, 800],  parts: ['Arc', 'Pivot', 'Counterweight'] },
    'nyx-panther':    { view: 'Side view',     no: 'CS-013', unit: 'cm', overall: [180, 80],    parts: ['Head', 'Torso', 'Foreleg', 'Hindleg', 'Tail'] },
    'drift-koi':      { view: 'Top view',      no: 'CS-014', unit: 'cm', overall: [90, 40],     parts: ['Head', 'Body', 'Fin', 'Tail'] },
    'glint-owl':      { view: 'Front view',    no: 'CS-015', unit: 'cm', overall: [55, 70],     parts: ['Head', 'Body', 'Wing L', 'Wing R'] },
    'mech-link':      { view: 'Assembly view', no: 'CS-016', unit: 'mm', overall: [1200, 800],   parts: ['Link A', 'Link B', 'Pin', 'Bracket'] },
    'flex-spine':     { view: 'Side view',     no: 'CS-017', unit: 'mm', overall: [1800, 600],   parts: ['Rib x8', 'Driver', 'Joint A', 'Joint B'] },
    'cad-strut':      { view: 'Section A-A',   no: 'CS-018', unit: 'mm', overall: [600, 600],    parts: ['Hub', 'Strut N', 'Strut E', 'Mount'] }
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) { for (var k in attrs) el.setAttribute(k, attrs[k]); }
    if (text != null) el.textContent = text;
    return el;
  }

  /* Параметры canvas — SVG в координатах чертежного поля */
  var BP_VIEW_W = 1200;
  var BP_VIEW_H = 800;
  var BP_INSET  = 48;                  // полями внутри frame
  var BP_GRID_MINOR = 20;
  var BP_GRID_MAJOR = 100;

  function buildBlueprint(id) {
    if (!caseBlueprintsCanvas) return;
    var meta = BLUEPRINT_META[id];
    var data = CARDS_DATA[id];
    if (!meta || !data) {
      caseBlueprintsCanvas.innerHTML = '';
      return;
    }
    var card = document.querySelector('.work-card[data-id="' + id + '"]');
    var year = card ? (card.querySelector('.work-card__year') || {}).textContent || '' : '';
    var title = card ? (card.querySelector('.work-card__title') || {}).textContent || id : id;

    var rng = mulberry32(hashStr(id + '-bp'));
    function rand(min, max) { return min + rng() * (max - min); }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

    /* — SVG корень — */
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + BP_VIEW_W + ' ' + BP_VIEW_H,
      preserveAspectRatio: 'xMidYMid meet',
      'aria-label': 'Technical blueprint of ' + title
    });

    /* — defs: grid pattern — */
    var defs = svgEl('defs');
    var patMinor = svgEl('pattern', {
      id: 'bp-grid-minor-' + id,
      width: BP_GRID_MINOR, height: BP_GRID_MINOR,
      patternUnits: 'userSpaceOnUse'
    });
    patMinor.appendChild(svgEl('path', {
      class: 'blueprint__grid-minor',
      d: 'M ' + BP_GRID_MINOR + ' 0 L 0 0 0 ' + BP_GRID_MINOR
    }));
    var patMajor = svgEl('pattern', {
      id: 'bp-grid-major-' + id,
      width: BP_GRID_MAJOR, height: BP_GRID_MAJOR,
      patternUnits: 'userSpaceOnUse'
    });
    patMajor.appendChild(svgEl('path', {
      class: 'blueprint__grid-major',
      d: 'M ' + BP_GRID_MAJOR + ' 0 L 0 0 0 ' + BP_GRID_MAJOR
    }));
    // Стрелка для размерных линий
    var markerStart = svgEl('marker', {
      id: 'bp-arrow-start-' + id, viewBox: '0 0 10 10',
      refX: '2', refY: '5', markerWidth: '8', markerHeight: '8',
      orient: 'auto-start-reverse'
    });
    markerStart.appendChild(svgEl('path', { class: 'blueprint__dim-arrow', d: 'M 0 5 L 10 0 L 8 5 L 10 10 Z' }));
    var markerEnd = svgEl('marker', {
      id: 'bp-arrow-end-' + id, viewBox: '0 0 10 10',
      refX: '8', refY: '5', markerWidth: '8', markerHeight: '8',
      orient: 'auto'
    });
    markerEnd.appendChild(svgEl('path', { class: 'blueprint__dim-arrow', d: 'M 10 5 L 0 0 L 2 5 L 0 10 Z' }));
    defs.appendChild(patMinor);
    defs.appendChild(patMajor);
    defs.appendChild(markerStart);
    defs.appendChild(markerEnd);
    svg.appendChild(defs);

    /* — frame + сетка — */
    var gGrid = svgEl('g', { class: 'blueprint__grid' });
    gGrid.appendChild(svgEl('rect', {
      x: BP_INSET, y: BP_INSET,
      width:  BP_VIEW_W - BP_INSET * 2,
      height: BP_VIEW_H - BP_INSET * 2,
      fill: 'url(#bp-grid-minor-' + id + ')'
    }));
    gGrid.appendChild(svgEl('rect', {
      x: BP_INSET, y: BP_INSET,
      width:  BP_VIEW_W - BP_INSET * 2,
      height: BP_VIEW_H - BP_INSET * 2,
      fill: 'url(#bp-grid-major-' + id + ')'
    }));
    gGrid.appendChild(svgEl('rect', {
      class: 'blueprint__frame',
      x: BP_INSET, y: BP_INSET,
      width:  BP_VIEW_W - BP_INSET * 2,
      height: BP_VIEW_H - BP_INSET * 2
    }));
    svg.appendChild(gGrid);

    /* — view tag (top-left) — */
    var vg = svgEl('g');
    vg.appendChild(svgEl('text', {
      class: 'blueprint__view-tag',
      x: BP_INSET + 8, y: BP_INSET + 20
    }, meta.view.toUpperCase()));
    svg.appendChild(vg);

    /* — Части: выбираем силуэт (square / tall / wide) из soft ratio overall — */
    var ratio = meta.overall[0] / meta.overall[1];
    // силуэт bounding box в svg единицах: оставляем 260px справа для callouts
    var frameW = BP_VIEW_W - BP_INSET * 2 - 320;
    var frameH = BP_VIEW_H - BP_INSET * 2 - 200;
    var drawW, drawH;
    if (ratio >= 1) {
      drawW = Math.min(frameW, frameH * ratio);
      drawH = drawW / ratio;
    } else {
      drawH = Math.min(frameH, frameW / ratio);
      drawW = drawH * ratio;
    }
    var drawX = BP_INSET + 80;
    var drawY = BP_INSET + 60;

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
      'marker-start': 'url(#bp-arrow-start-' + id + ')',
      'marker-end':   'url(#bp-arrow-end-'   + id + ')'
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
      'marker-start': 'url(#bp-arrow-start-' + id + ')',
      'marker-end':   'url(#bp-arrow-end-'   + id + ')'
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

    /* — Title block: правый нижний — */
    var tbW = 320, tbH = 96;
    var tbX = BP_VIEW_W - BP_INSET - tbW;
    var tbY = BP_VIEW_H - BP_INSET - tbH;
    var tbG = svgEl('g', { class: 'blueprint__title-block' });
    tbG.appendChild(svgEl('rect', {
      class: 'blueprint__title-block-frame',
      x: tbX, y: tbY, width: tbW, height: tbH
    }));
    // верхний ряд (проект)
    tbG.appendChild(svgEl('text', {
      class: 'blueprint__title-block-key',
      x: tbX + 12, y: tbY + 18
    }, 'Project'));
    tbG.appendChild(svgEl('text', {
      class: 'blueprint__title-block-project',
      x: tbX + 12, y: tbY + 38
    }, title));
    // сепаратор
    tbG.appendChild(svgEl('line', {
      class: 'blueprint__title-block-divider',
      x1: tbX, y1: tbY + 48, x2: tbX + tbW, y2: tbY + 48
    }));
    // 3 колонки: Drawing / Scale / Date
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

    /* — сажаем в DOM — */
    caseBlueprintsCanvas.innerHTML = '';
    caseBlueprintsCanvas.appendChild(svg);
    blueprintBuiltFor = id;

    // Анимация reveal (если доступна GSAP и не reduced-motion)
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.gsap && !prefersReduced) {
      gsap.from(svg.querySelectorAll('.blueprint__grid > *'), {
        opacity: 0, duration: 0.4, ease: 'power1.out', stagger: 0.04
      });
      gsap.from(svg.querySelectorAll('.blueprint__parts > *'), {
        opacity: 0, y: 6, duration: 0.35, ease: 'power2.out',
        stagger: 0.04, delay: 0.15
      });
      gsap.from(svg.querySelectorAll('.blueprint__dimensions > *, .blueprint__callouts > *'), {
        opacity: 0, duration: 0.3, ease: 'power1.out',
        stagger: 0.03, delay: 0.35
      });
      gsap.from(svg.querySelectorAll('.blueprint__title-block > *'), {
        opacity: 0, duration: 0.35, ease: 'power1.out', delay: 0.45
      });
    }
  }

  /* ══════════════════════════════════
     v0.11 — build3D(id) — ленивая загрузка <model-viewer>
     v0.5 — model-data.js теперь тоже lazy-loaded (issue #1: snizhayet LCP с 9.9s до ~2-3s).
            Скрипт инжектится при первом 3D-клике, не на page load.
  ══════════════════════════════════ */
  var MODEL_VIEWER_SRC = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  var MODEL_DATA_SRC = './js/model-data.js';

  /* v0.5 — Lazy-load model-data.js. Возвращает Promise. Идемпотентно. */
  var modelDataLoading = null;
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
    if (modelViewerLoading) return modelViewerLoading;
    modelViewerLoading = new Promise(function (resolve, reject) {
      // уже зарегистрирован?
      if (window.customElements && window.customElements.get('model-viewer')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.type = 'module';
      s.src = MODEL_VIEWER_SRC;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('model-viewer load failed')); };
      document.head.appendChild(s);
    });
    return modelViewerLoading;
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
    if (currentOrbitProxy && window.gsap) { gsap.killTweensOf(currentOrbitProxy); }
    currentOrbitProxy = null;
    if (currentWheelListener && case3dCanvas) {
      case3dCanvas.removeEventListener('wheel', currentWheelListener, { capture: true });
      currentWheelListener = null;
    }
    // v0.7.3 — cleanup global listeners для light-dropdown (close on outside / Escape)
    if (currentLightDdDocClick) {
      document.removeEventListener('click', currentLightDdDocClick);
      currentLightDdDocClick = null;
    }
    if (currentLightDdDocKey) {
      document.removeEventListener('keydown', currentLightDdDocKey);
      currentLightDdDocKey = null;
    }
    if (currentMv) {
      try { currentMv.removeAttribute('src'); } catch (_) { /* no-op */ }
      try { currentMv.remove(); } catch (_) { /* no-op */ }
      currentMv = null;
    }
    currentMvReset = null;
  }

  function build3D(id) {
    if (!case3dCanvas) return;
    var data = CARDS_DATA[id];
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
      var resumeTimer = null;

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

      // v0.11.4 — wheel-hijack (scroll→orbit) удалён: возвращён нативный MV zoom.
      // drag = orbit, wheel = zoom, pinch = zoom на mobile (touch-action: none выше).
      currentOrbitProxy = null;
      currentWheelListener = null;

      /* UI: hint + controls + info panel */
      // v0.15.1 [1.5] — два варианта хинта для desktop/mobile,
      // видимость переключается через @media pointer/hover в CSS.
      var hint = document.createElement('div');
      hint.className = 'case-3d__hint case-3d__hint--desktop';
      hint.textContent = 'RIGHT MOUSE · ROTATE';

      var hintMobile = document.createElement('div');
      hintMobile.className = 'case-3d__hint case-3d__hint--mobile';
      hintMobile.textContent = 'DRAG · ZOOM';

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
      autoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">AUTO ROTATION</span><span class="case-3d__ctrl__txt-short">AUTO</span>';

      var infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'case-3d__ctrl';
      infoBtn.setAttribute('aria-pressed', 'false');
      infoBtn.textContent = '';
      // v0.7.7 [planshet-fix]: dual-text — см. autoBtn выше.
      infoBtn.innerHTML = '<span class="case-3d__ctrl__txt-full">MODEL INFO</span><span class="case-3d__ctrl__txt-short">INFO</span>';
      // v0.14.0 [4] — MI по умолчанию включен (или то, что было в предыдущем кейсе).
      if (infoOn) {
        infoBtn.classList.add('is-on');
        infoBtn.setAttribute('aria-pressed', 'true');
      }

      // v0.11.2 — icon-only reset: возвращает камеру в initial position
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'case-3d__ctrl case-3d__ctrl--icon';
      resetBtn.setAttribute('aria-label', 'Reset camera to initial position');
      resetBtn.setAttribute('title', 'Reset camera');
      resetBtn.innerHTML =
        '<svg class="case-3d__ctrl-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3 8a5 5 0 1 0 1.46-3.54"/>' +
          '<polyline points="3,3 3,6 6,6"/>' +
        '</svg>';

      // v0.15.1 [2.2] — fullscreen-кнопка для 3D. Клон модели открывается через .media-fs overlay.
      var fsBtn3d = document.createElement('button');
      fsBtn3d.type = 'button';
      fsBtn3d.className = 'case-3d__fs-btn';
      fsBtn3d.setAttribute('aria-label', 'Open 3D fullscreen');
      fsBtn3d.setAttribute('title', 'Fullscreen');
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
          dark:    './assets/hdr/dark.hdr'
        };
        var currentEnv = 'studio';

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

        var envGroup = document.createElement('div');
        envGroup.className = 'case-3d__env-group';
        envGroup.setAttribute('role', 'group');
        envGroup.setAttribute('aria-label', 'Environment preset');

        ['studio', 'outdoor', 'dark'].forEach(function (key) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'case-3d__ctrl case-3d__ctrl--env' + (key === currentEnv ? ' is-on' : '');
          btn.setAttribute('aria-pressed', key === currentEnv ? 'true' : 'false');
          btn.dataset.env = key;
          btn.textContent = key.toUpperCase();

          btn.addEventListener('click', function () {
            if (currentEnv === key) return;
            currentEnv = key;
            mv.setAttribute('environment-image', ENV_PRESETS[key]);
            syncEnvUI(key);
          });

          envGroup.appendChild(btn);
        });

        // Exposure slider — диапазон 0.5–2.0, default 1.0, step 0.05.
        // Значение пишется в model-viewer property mv.exposure (быстрее, чем setAttribute).
        var expoWrap = document.createElement('label');
        expoWrap.className = 'case-3d__expo';
        expoWrap.setAttribute('aria-label', 'Exposure');

        var expoLabelEl = document.createElement('span');
        expoLabelEl.className = 'case-3d__expo-label';
        expoLabelEl.textContent = 'EXPOSURE';

        var expoInput = document.createElement('input');
        expoInput.type = 'range';
        expoInput.min = '0.5';
        expoInput.max = '2';
        expoInput.step = '0.05';
        expoInput.value = '1';
        expoInput.className = 'case-3d__expo-input';
        expoInput.setAttribute('aria-label', 'Exposure level from 0.5 to 2.0');

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
        lightTrigger.setAttribute('aria-label', 'Lighting settings');
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
        lightPanel.setAttribute('aria-label', 'Lighting presets and exposure');

        // Section title for env list
        var ddEnvLabel = document.createElement('div');
        ddEnvLabel.className = 'case-3d__light-dd__section-label';
        ddEnvLabel.textContent = 'ENVIRONMENT';
        lightPanel.appendChild(ddEnvLabel);

        // Vertical list of env buttons
        var ddEnvList = document.createElement('div');
        ddEnvList.className = 'case-3d__light-dd__env-list';
        ddEnvList.setAttribute('role', 'group');
        ddEnvList.setAttribute('aria-label', 'Environment preset');

        ['studio', 'outdoor', 'dark'].forEach(function (key) {
          var ddBtn = document.createElement('button');
          ddBtn.type = 'button';
          ddBtn.className = 'case-3d__light-dd__env-btn' + (key === currentEnv ? ' is-on' : '');
          ddBtn.setAttribute('aria-pressed', key === currentEnv ? 'true' : 'false');
          ddBtn.dataset.env = key;
          ddBtn.textContent = key.toUpperCase();

          ddBtn.addEventListener('click', function () {
            if (currentEnv === key) return;
            currentEnv = key;
            mv.setAttribute('environment-image', ENV_PRESETS[key]);
            syncEnvUI(key);
          });

          ddEnvList.appendChild(ddBtn);
        });
        lightPanel.appendChild(ddEnvList);

        // Section title for exposure
        var ddExpoLabel = document.createElement('label');
        ddExpoLabel.className = 'case-3d__light-dd__section-label';
        ddExpoLabel.textContent = 'EXPOSURE';
        lightPanel.appendChild(ddExpoLabel);

        // Mobile exposure slider (mirrors expoInput)
        var ddExpoInput = document.createElement('input');
        ddExpoInput.type = 'range';
        ddExpoInput.min = '0.5';
        ddExpoInput.max = '2';
        ddExpoInput.step = '0.05';
        ddExpoInput.value = '1';
        ddExpoInput.className = 'case-3d__light-dd__expo-input';
        ddExpoInput.setAttribute('aria-label', 'Exposure level from 0.5 to 2.0');

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
      // сброс Promise — дадим ещё одну попытку при следующем клике
      modelViewerLoading = null;
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
        buildBlueprint(currentCaseId);
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
  var bpExportBtn = document.getElementById('blueprint-export-svg');
  function exportBlueprintSVG() {
    if (!caseBlueprintsCanvas) return;
    var svg = caseBlueprintsCanvas.querySelector('svg');
    if (!svg || !currentCaseId) return;
    var clone = svg.cloneNode(true);
    if (!clone.getAttribute('xmlns'))       clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Инлайним computed-стили, чтобы не зависеть от CSS-переменных документа
    inlineComputedStyles(svg, clone);

    // Фоновая подложка — тема живёт на <body data-theme="...">, значит --color-bg
    // нужно резолвить именно у body, а не у documentElement. Fallback —
    // :root, затем жёсткий dark-цвет.
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
    a.download = 'codex-blueprint-' + String(currentCaseId).replace(/[^a-z0-9\-]+/gi, '-').toLowerCase() + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  if (bpExportBtn) bpExportBtn.addEventListener('click', exportBlueprintSVG);

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
    // keydown больше не нужен: <a> сам активируется Enter. Space на <a> не активирует
    // — но это спецификация, мы не меняем дефолт.
  });

  /* ══════════════════════════════════
     TOGGLE: Hide / Show cards panel
     Desktop — rail 56 px. Mobile — sidebar уезжает за край (CSS).
  ══════════════════════════════════ */
  function setCollapsed(collapsed) {
    if (!toggleBtn) return;

    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleBtn.setAttribute('aria-label', collapsed ? 'Show projects panel' : 'Hide projects panel');
    var label = toggleBtn.querySelector('.cards-toggle__label');
    if (label) label.textContent = collapsed ? 'Show projects' : 'Hide projects';

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

      // ARIA и lookup-лейблы — обновляем сразу
      themeBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      themeBtn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
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

  updateCount(cards.length);

  /* ══════════════════════════════════
     Первая загрузка — открываем самый свежий кейс
     v0.2.3 [П2]: если в URL есть hash и он совпадает с data-id
     существующей карточки — открываем этот кейс.
     На mobile дополнительно сворачиваем sidebar в case-view.
  ══════════════════════════════════ */
  setTimeout(function () {
    var initialId = null;
    var rawHash = (window.location.hash || '').replace(/^#/, '');
    if (rawHash) {
      var hashCard = document.querySelector('.work-card[data-id="' + rawHash.replace(/"/g, '') + '"]');
      if (hashCard && hashCard.dataset.id && !hashCard.hasAttribute('hidden')) {
        initialId = hashCard.dataset.id;
      }
    }
    if (!initialId) {
      var first = document.querySelector('.work-card[data-id]');
      if (first && first.dataset.id) initialId = first.dataset.id;
    }
    if (initialId) {
      openCase(initialId, { initial: true });
      // v0.2.3 [П2]: deep-link на mobile — сразу показать case-view, а не sidebar.
      if (rawHash && initialId !== (document.querySelector('.work-card[data-id]:not([hidden])') || {}).dataset?.id) {
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
      var prev = label.textContent;
      button.classList.add('case-share--copied');
      label.textContent = 'COPIED ✓';
      button.setAttribute('aria-live', 'polite');
      setTimeout(function () {
        button.classList.remove('case-share--copied');
        label.textContent = prev || 'COPY LINK';
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
     Одна скрытая overlay-плашка в <body>. По клику fs-btn клонируется
     контент (img/video/model-viewer/svg) в .media-fs__stage. ESC или клик по
     backdrop закрывают.
     ════════════════════════════════════════════ */
  var fsOverlay = null, fsStage = null, fsCloseBtn = null;
  var fsOriginalEl = null; // для video: чтобы синхронизировать время.
  function ensureFsOverlay() {
    if (fsOverlay) return fsOverlay;
    fsOverlay = document.createElement('div');
    fsOverlay.className = 'media-fs';
    fsOverlay.setAttribute('role', 'dialog');
    fsOverlay.setAttribute('aria-modal', 'true');
    fsOverlay.setAttribute('aria-label', 'Fullscreen view');
    fsOverlay.hidden = true;

    fsStage = document.createElement('div');
    fsStage.className = 'media-fs__stage';

    fsCloseBtn = document.createElement('button');
    fsCloseBtn.type = 'button';
    fsCloseBtn.className = 'media-fs__close';
    fsCloseBtn.setAttribute('aria-label', 'Close fullscreen');
    fsCloseBtn.setAttribute('title', 'Close fullscreen');
    fsCloseBtn.innerHTML = '<svg class="media-fs__close-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M6 2v4H2M12 2v4h4M2 12h4v4M12 16v-4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>';
    fsCloseBtn.addEventListener('click', closeFs);

    fsOverlay.appendChild(fsCloseBtn);
    fsOverlay.appendChild(fsStage);
    document.body.appendChild(fsOverlay);

    // Клик по backdrop (не по stage-детям) закрывает
    fsOverlay.addEventListener('click', function (e) {
      if (e.target === fsOverlay || e.target === fsStage) closeFs();
    });
    return fsOverlay;
  }

  function openFs(sourceEl, kind) {
    ensureFsOverlay();
    // Очистить stage
    while (fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);

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

    fsOriginalEl = sourceEl || null;
    fsOverlay.hidden = false;
    // force reflow для transition
    void fsOverlay.offsetWidth;
    fsOverlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    try { fsCloseBtn.focus({ preventScroll: true }); } catch (_) {}
  }

  function closeFs() {
    if (!fsOverlay || fsOverlay.hidden) return;
    fsOverlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    // скрываем после трансишна, чистим stage
    setTimeout(function () {
      if (fsOverlay && !fsOverlay.classList.contains('is-open')) {
        fsOverlay.hidden = true;
        while (fsStage && fsStage.firstChild) fsStage.removeChild(fsStage.firstChild);
        fsOriginalEl = null;
      }
    }, 220);
  }

  // Делегированный клик по fs-кнопкам (3D/BP — через делегацию для единообразия).
  // v0.15.2 [B3] — 2D ветка удалена вместе с .case-media-fs-btn.
  document.addEventListener('click', function (e) {
    // 3D
    var btn3d = e.target.closest('.case-3d__fs-btn');
    if (btn3d) {
      e.preventDefault();
      var mv = document.querySelector('#case-3d-canvas model-viewer');
      if (mv) openFs(mv, 'model-viewer');
      return;
    }
    // Blueprints
    var btnBp = e.target.closest('.case-blueprints__fs-btn');
    if (btnBp) {
      e.preventDefault();
      var svg = document.querySelector('#case-blueprints-canvas svg');
      if (svg) openFs(svg, 'svg');
      return;
    }
  });

  // ESC закрывает
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && fsOverlay && fsOverlay.classList.contains('is-open')) {
      e.preventDefault();
      closeFs();
    }
  });

})();

/* ══════════════════════════════════════════════════════════════════════
   SITE FOOTER v0.15.2 [A1]
   ─────────────────────────────────────────────────────────────────────
   v0.15.1 [3] вводил mobile reveal-on-scroll — удалён в v0.15.2 [A1]
   по требованию заказчика (ТЗ: «это работает не совсем очевидно и
   постоянно видим пустое место»). Подвал виден всегда (CSS-дефолт),
   JS-логика .is-revealed удалена полностью.
══════════════════════════════════════════════════════════════════════ */

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

  /* Магнитные селекторы — уже существующие интерактивные элементы.
     v0.13.1 — две группы силы магнита:
       .work-card — 0.07 (было 0.35, -80%) — карточки большие и сильно ездили
       остальные — 0.18 (было 0.35, -≈50%) — кнопки/теги достаточно
       отзывчивые по-прежнему, но мягче. */
  // v0.14.1 [3] — добавлен .top-pill--contact (кнопка Contact Telegram).
  // Free Assets pill — disabled, магнит ему не нужен.
  var MAGNETIC_SELECTOR =
    '.tag, .cards-toggle, .theme-toggle, .case-back, .logo, .work-card, ' +
    '.case-tab, .case-mobile-bar__logo, .top-pill--contact';

  // Селекторы с ослабленной силой магнита (-80% от стандартной).
  var SOFT_MAGNETIC_SELECTOR = '.work-card';

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
  var currentTween = null;
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
