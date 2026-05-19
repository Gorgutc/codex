---
title: Lumen One
slug: lumen-one
year: 2024
category:
  - Product Viz
role: Client
description: Architectural lighting unit. Photorealistic turntable for pitch deck.
thumb:
  src: /works/lumen-one/thumb.svg
  alt: Lumen One thumbnail
gallery:
  - src: /works/lumen-one/01.svg
    alt: Lumen One — Final render
    type: image
    format: wide
    label: Final render
    description: Architectural lighting unit. Photorealistic turntable deliverable for investor pitch deck.
    bg: 'linear-gradient(135deg,#1e2428 0%,#2c3640 100%)'
  - src: /works/lumen-one/02.svg
    alt: Lumen One — Lighting setup
    type: image
    format: tall
    label: Lighting setup
    description: '3-point HDRI rig with area light fill. Caustics rendered via path-tracing at 4096 samples.'
    bg: 'linear-gradient(135deg,#1a2024 0%,#28303c 100%)'
  - src: /works/lumen-one/03.svg
    alt: Lumen One — Spec sheet
    type: image
    format: tall
    label: Spec sheet
    description: Dimension overlay and material callout sheet generated in Blender Compositing and Inkscape.
    bg: 'linear-gradient(135deg,#161c20 0%,#222c38 100%)'
  - src: /works/lumen-one/04.svg
    alt: Lumen One — Context shot
    type: image
    format: wide
    label: Context shot
    description: 'Hero placement in a modern office environment, shot from client-approved camera angle.'
    bg: 'linear-gradient(135deg,#11181c 0%,#1c2832 100%)'
  - src: /works/lumen-one/05.svg
    alt: Lumen One — Colour variants
    type: image
    format: tall
    label: Colour variants
    description: 'Six finish variants — brass, chrome, matte black, warm white — rendered as catalogue sprites.'
    bg: 'linear-gradient(135deg,#0c1418 0%,#18242e 100%)'
intro:
  title: Light behaviour
  body: The optical housing uses a real IES profile exported from the client’s photometric test. Caustics and beam spread on camera match what the product produces on a physical wall.
inline:
  title: Light model
  body: Filament IES bakes drive the emissive intensity map. Inner diffuser scatters via subsurface approximation — no cheat geometry.
specs:
  tools:
    - Blender
    - Inkscape
  software:
    - Blender + Substance
  polycount: '1,352'
  vertices: '690'
  materials: 1
  textures: '1 × 2 K'
modelSrc: /models/lumen-one.glb
order: 5
---

The optical housing uses a real IES profile exported from the client’s photometric test. Caustics and beam spread on camera match what the product produces on a physical wall.
