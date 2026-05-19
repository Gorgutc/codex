---
title: Flex Spine
slug: flex-spine
year: 2025
category:
  - CAD
role: 'R&D'
description: 'Kinematic spine study. CAD constraints, parametric ribs — work in progress.'
thumb:
  src: /works/flex-spine/thumb.svg
  alt: Flex Spine thumbnail
gallery:
  - src: /works/flex-spine/01.svg
    alt: Flex Spine — Spine assembly
    type: image
    format: wide
    label: Spine assembly
    description: Kinematic spine placeholder. Parametric ribs driven by a single driver angle.
    bg: 'linear-gradient(135deg,#21272d 0%,#2e353c 100%)'
  - src: /works/flex-spine/02.svg
    alt: Flex Spine — Rib section
    type: image
    format: tall
    label: Rib section
    description: Section-cut through one rib — thickness and fillet radii exposed as parameters.
    bg: 'linear-gradient(135deg,#1d232a 0%,#2a3138 100%)'
  - src: /works/flex-spine/03.svg
    alt: Flex Spine — Deflection test
    type: image
    format: tall
    label: Deflection test
    description: FEA sketch — deflection map under 50 N lateral load. Placeholder visualisation.
    bg: 'linear-gradient(135deg,#1a2027 0%,#262c33 100%)'
  - src: /works/flex-spine/04.svg
    alt: Flex Spine — Joint detail
    type: image
    format: wide
    label: Joint detail
    description: Ball-and-socket joint close-up. Tolerance stack-up listed in source PDF.
    bg: 'linear-gradient(135deg,#171d24 0%,#222930 100%)'
  - src: /works/flex-spine/05.svg
    alt: Flex Spine — Render study
    type: image
    format: tall
    label: Render study
    description: KeyShot pass — matte steel against cool grey backdrop.
    bg: 'linear-gradient(135deg,#141a21 0%,#1e252c 100%)'
intro:
  title: CAD placeholder
  body: 'Кинематический позвоночник-плейсхолдер. Конструкция параметрическая: один управляющий угол гнёт все рёбра. Финальная модель и стенд-рендеры в процессе.'
inline:
  title: Parametrics
  body: 'Параметры: rib_count, rib_thickness, segment_angle. Связаны через Fusion 360 sketches → экспорт в Blender.'
specs:
  tools:
    - Fusion 360
    - Blender
    - KeyShot
  software:
    - Fusion 360 + Blender
  polycount: '496'
  vertices: '258'
  materials: 2
  textures: Procedural (PBR)
modelSrc: /models/flex-spine.glb
cadPlaceholder: true
order: 17
---

Кинематический позвоночник-плейсхолдер. Конструкция параметрическая: один управляющий угол гнёт все рёбра. Финальная модель и стенд-рендеры в процессе.
