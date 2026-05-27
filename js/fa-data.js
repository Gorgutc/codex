/* ═══════════════════════════════════════════════════════════════════════
   FA_DATA — каталог free-assets для js/free-assets.js
   v0.7.11 [P2 #26]: вынесено из inline <script> в free-assets.html.

   v0.8.9 L4 — known data-gap (известный недостаток данных, не код-баг):
   thumbnail-path конструируется как './assets/cards/' + id + '.svg' по умолчанию.
   model-path конструируется как './assets/models/free/' + id + '.glb' по умолчанию.
   Если thumb/model задан строкой — используется это имя файла без расширения.
   Если thumb/model явно null — соответствующий preview отключён.
   8 FA-id пока не имеют SVG/GLB preview: bolt-cluster, terra-base,
   shard-cannon, wraith-blade, echo-shell, prism-lab, wraith-blade-g,
   shard-cannon-g. Эти карточки показывают bg-gradient + label.
   Когда подъедут реальные preview'ы — положить SVG/GLB с именем id или
   прописать thumb/model с нужным базовым именем файла.
═══════════════════════════════════════════════════════════════════════ */
var FA_DATA = {
  'hard-surface': [
    { id:'orbital-mk-ii',  cat:'Hard Surface', title:'Orbital Mk.II',    desc:'Sci-fi prop engineered for AAA pipeline. Full PBR, clean topology.',        badge:'Hard Surface', contents:['.blend','.fbx','.obj','4K PBR textures','Normal map'],                       size:'48 MB',  file:'orbital-mk-ii.zip',  bg:'linear-gradient(135deg,#1e2d3d 0,#2a3a4a 100%)' },
    { id:'vega-shell',     cat:'Hard Surface', title:'Vega Shell',       desc:'Modular exo-armor system — 47 parts. Snap-together assembly, clean UVs.',   badge:'Hard Surface', contents:['.blend','.fbx','Modular pieces','4K textures'],                              size:'93 MB',  file:'vega-shell.zip',     bg:'linear-gradient(135deg,#1a2030 0,#252e40 100%)' },
    { id:'ironclad-frame', cat:'Hard Surface', title:'Ironclad Frame',   desc:'Industrial chassis breakdown. Every bolt and seam modeled to spec.',         badge:'Hard Surface', contents:['.blend','.fbx','2K textures','Wire renders'],                               size:'55 MB',  file:'ironclad-frame.zip', bg:'linear-gradient(135deg,#1c2428 0,#28343a 100%)' },
    { id:'bolt-cluster',   thumb:null, model:null, cat:'Hard Surface', title:'Bolt Cluster',     desc:'Industrial fastener kit — 12 variants. Scatter-ready GeoNodes setup.',       badge:'Hard Surface', contents:['.blend','12 variants','GeoNodes setup','2K textures'],                      size:'31 MB',  file:'bolt-cluster.zip',   bg:'linear-gradient(135deg,#1e2428 0,#2a3038 100%)' },
    { id:'terra-base',     thumb:null, model:null, cat:'Hard Surface', title:'Terra Base',       desc:'Modular environment kit — 24 tileable pieces. GeoNodes scatter system.',     badge:'Hard Surface', contents:['.blend','24 modules','GeoNodes','4K tileable textures'],                    size:'182 MB', file:'terra-base.zip',     bg:'linear-gradient(135deg,#1c2030 0,#28303e 100%)' },
    { id:'shard-cannon',   thumb:null, model:null, cat:'Hard Surface', title:'Shard Cannon',     desc:'Sci-fi heavy weapon — three skin variations, UE5-compatible export.',        badge:'Hard Surface', contents:['.fbx','.blend','3 skin variants','4K PBR'],                                size:'103 MB', file:'shard-cannon.zip',   bg:'linear-gradient(135deg,#1a1a2a 0,#252535 100%)' },
    { id:'wraith-blade',   thumb:null, model:null, cat:'Hard Surface', title:'Wraith Blade',     desc:'Thin melee weapon with emissive edge glow texture variant included.',        badge:'Hard Surface', contents:['.fbx','.blend','Emissive variant','4K PBR'],                               size:'76 MB',  file:'wraith-blade.zip',   bg:'linear-gradient(135deg,#1e1a28 0,#2a2438 100%)' },
    { id:'apex-frame',     cat:'Hard Surface', title:'Apex Frame',       desc:'Mechanical component breakdown. Exploded view rig. Mfg-reference accuracy.', badge:'Mechanical',   contents:['.blend','.step','Exploded rig','2K textures','README'],                    size:'67 MB',  file:'apex-frame.zip',     bg:'linear-gradient(135deg,#202428 0,#2c3034 100%)' },
  ],
  'product': [
    { id:'corten-series',  cat:'Product Viz',  title:'Corten Series',    desc:'Industrial furniture scene. HDRI + camera rigs for stills and turntable.', badge:'Product Viz',  contents:['.blend','HDRI lighting','Camera rigs','4K textures','Render settings'],    size:'112 MB', file:'corten-series.zip',  bg:'linear-gradient(135deg,#2a2018 0,#3a2e22 100%)' },
    { id:'lumen-one',      cat:'Product Viz',  title:'Lumen One',        desc:'Minimalist product scene. Cycles render with area lights and reflectors.',   badge:'Product Viz',  contents:['.blend','Studio lighting','Material lib','4K renders'],                    size:'74 MB',  file:'lumen-one.zip',      bg:'linear-gradient(135deg,#1e2428 0,#2c3640 100%)' },
    { id:'flux-capsule',   cat:'Product Viz',  title:'Flux Capsule',     desc:'Consumer tech device — 8 camera angles, e-commerce shot set.',              badge:'Product Viz',  contents:['.blend','8 camera angles','Studio rig','4K textures'],                     size:'88 MB',  file:'flux-capsule.zip',   bg:'linear-gradient(135deg,#1e2030 0,#282a40 100%)' },
    { id:'echo-shell',     thumb:null, model:null, cat:'Product Viz',  title:'Echo Shell',       desc:'Speaker product scene — three colorways, compositing nodes included.',      badge:'Product Viz',  contents:['.blend','3 colorways','Compositor','4K renders'],                          size:'118 MB', file:'echo-shell.zip',     bg:'linear-gradient(135deg,#1e2024 0,#282830 100%)' },
    { id:'prism-lab',      thumb:null, model:null, cat:'Product Viz',  title:'Prism Lab',        desc:'Architectural product viz — day and night lighting setups.',                badge:'Product Viz',  contents:['.blend','Day lighting','Night lighting','4K renders'],                     size:'145 MB', file:'prism-lab.zip',      bg:'linear-gradient(135deg,#1c2030 0,#282a40 100%)' },
  ],
  'game': [
    { id:'nightshard',     cat:'Game Asset',   title:'Nightshard',       desc:'Hero weapon. 4K PBR textures, optimised for real-time. UE5-ready.',         badge:'Game Asset',   contents:['.fbx (LOD 0–2)','.blend','4K PBR textures','AO map'],                      size:'89 MB',  file:'nightshard.zip',     bg:'linear-gradient(135deg,#1a1a2a 0,#252535 100%)' },
    { id:'recon-drone',    cat:'Game Asset',   title:'Recon Drone',      desc:'Tactical UAV prop. LOD 0–2, UE5-compatible. Full PBR texture set.',         badge:'Game Asset',   contents:['.fbx','.blend','4K PBR textures','LOD 0–2'],                               size:'61 MB',  file:'recon-drone.zip',    bg:'linear-gradient(135deg,#1c2030 0,#28303e 100%)' },
    { id:'wraith-blade-g', thumb:null, model:null, cat:'Game Asset',   title:'Wraith Blade',     desc:'Thin melee weapon. High-poly bake, emissive edge glow variant.',            badge:'Game Asset',   contents:['.fbx','.blend','Emissive variant','4K PBR'],                               size:'76 MB',  file:'wraith-blade.zip',   bg:'linear-gradient(135deg,#1e1a28 0,#2a2438 100%)' },
    { id:'shard-cannon-g', thumb:null, model:null, cat:'Game Asset',   title:'Shard Cannon',     desc:'Sci-fi heavy weapon — three skin variations, UE5-compatible.',              badge:'Game Asset',   contents:['.fbx','.blend','3 skin variants','4K PBR'],                               size:'103 MB', file:'shard-cannon.zip',   bg:'linear-gradient(135deg,#1a1a2a 0,#252535 100%)' },
  ],
  'organic': [
    { id:'nyx-panther',    cat:'Organic',      title:'Nyx Panther',      desc:'Stylized feline. Hand-sculpted anatomy, dual-coat fur groom. Rigged.',      badge:'Organic',      contents:['.blend','Rig','Fur groom','4K textures'],                                  size:'156 MB', file:'nyx-panther.zip',    bg:'linear-gradient(135deg,#1a1816 0,#2a2520 100%)' },
    { id:'drift-koi',      cat:'Organic',      title:'Drift Koi',        desc:'Ornamental fish. SSS pass, displacement scales, swim cycle at 30fps.',      badge:'Organic',      contents:['.blend','SSS shader','Swim cycle','4K textures'],                          size:'128 MB', file:'drift-koi.zip',      bg:'linear-gradient(135deg,#161e24 0,#1f2a34 100%)' },
    { id:'glint-owl',      cat:'Organic',      title:'Glint Owl',        desc:'Stylized bird. Procedural feather asymmetry, idle animation rig.',          badge:'Organic',      contents:['.blend','Feather groom','Rig','4K textures'],                              size:'97 MB',  file:'glint-owl.zip',      bg:'linear-gradient(135deg,#1a1a22 0,#262632 100%)' },
  ],
  'animation': [
    { id:'helix-reveal',   cat:'Animation',    title:'Helix Reveal',     desc:'Product reveal loop — 6 seconds. Camera path + keyframes fully editable.',  badge:'Animation',    contents:['.blend','Camera path','MP4 render','4K output'],                          size:'340 MB', file:'helix-reveal.zip',   bg:'linear-gradient(135deg,#1a2233 0,#26304a 100%)' },
    { id:'arc-motion',     cat:'Animation',    title:'Arc Motion',       desc:'Turntable sequence — full 360° orbit, 4K export. Lighting customizable.',   badge:'Animation',    contents:['.blend','360° path','MP4 render','HDRI'],                                 size:'210 MB', file:'arc-motion.zip',     bg:'linear-gradient(135deg,#1f1a2a 0,#2a2438 100%)' },
  ],
  'cad': [
    { id:'mech-link',      cat:'CAD',          title:'Mech Link',        desc:'Industrial CAD assembly. Exported from Fusion 360, cleaned for Blender.',   badge:'CAD',          contents:['.blend','.step','.f3d source','Assembly notes'],                          size:'38 MB',  file:'mech-link.zip',      bg:'linear-gradient(135deg,#1d232a 0,#2a3138 100%)' },
    { id:'flex-spine',     cat:'CAD',          title:'Flex Spine',       desc:'Kinematic spine study. Parametric ribs — robotics and biomedical reference.',badge:'CAD',          contents:['.blend','.step','Parametric notes','Renders'],                            size:'29 MB',  file:'flex-spine.zip',     bg:'linear-gradient(135deg,#21272d 0,#2e353c 100%)' },
    { id:'cad-strut',      cat:'CAD',          title:'CAD Strut',        desc:'Structural strut node system. Modular connectors, manufacturing docs.',      badge:'CAD',          contents:['.blend','.stl','.step','Tech docs'],                                      size:'33 MB',  file:'cad-strut.zip',      bg:'linear-gradient(135deg,#1f2429 0,#2b3138 100%)' },
  ]
};
