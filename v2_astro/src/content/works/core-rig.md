---
title: Core Rig
slug: core-rig
year: 2024
category:
  - Mechanical
role: 'R&D'
description: Structural assembly prototype. Modeled for 3D-print validation.
thumb:
  src: /works/core-rig/thumb.svg
  alt: Core Rig thumbnail
gallery:
  - src: /works/core-rig/01.svg
    alt: Core Rig — Structural view
    type: image
    format: wide
    label: Structural view
    description: Structural assembly prototype modeled for 3D-print validation and form-factor approval.
    bg: 'linear-gradient(135deg,#1e2830 0%,#28363e 100%)'
  - src: /works/core-rig/02.svg
    alt: Core Rig — Section cut
    type: image
    format: tall
    label: Section cut
    description: Cross-section render exposing interior wall thickness for print clearance verification.
    bg: 'linear-gradient(135deg,#1a2428 0%,#24303a 100%)'
  - src: /works/core-rig/03.svg
    alt: Core Rig — Print validation
    type: image
    format: tall
    label: Print validation
    description: 'Final mesh passed through Meshmixer slicer. Zero errors, overhang angle within tolerance.'
    bg: 'linear-gradient(135deg,#161e24 0%,#202c34 100%)'
  - src: /works/core-rig/04.svg
    alt: Core Rig — Support map
    type: image
    format: wide
    label: Support map
    description: Predicted support regions overlaid in blue. Used to iterate the orientation before slicing.
    bg: 'linear-gradient(135deg,#121a20 0%,#1c2830 100%)'
  - src: /works/core-rig/05.svg
    alt: Core Rig — Fit test render
    type: image
    format: tall
    label: Fit test render
    description: Assembly of the printed prototype with its mating housing. Photogrammetry alignment check.
    bg: 'linear-gradient(135deg,#0e161c 0%,#18242c 100%)'
intro:
  title: Print-first design
  body: 'The geometry is modelled around FDM constraints — 45° overhang rules, wall-thickness minimums and bridging limits — so the file can go straight to a slicer without manual repair.'
inline:
  title: Joint library
  body: Custom IK handle with stretch-and-squash limits. Retargets to Mixamo and Mannequin out of the box.
specs:
  tools:
    - Blender
    - Meshmixer
    - Cura
  software:
    - Blender + Fusion 360
  polycount: '464'
  vertices: '240'
  materials: 2
  textures: Procedural (PBR)
modelSrc: /models/core-rig.glb
order: 10
---

The geometry is modelled around FDM constraints — 45° overhang rules, wall-thickness minimums and bridging limits — so the file can go straight to a slicer without manual repair.
