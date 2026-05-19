/**
 * Blueprint generator — pure functions that build the SVG markup for the
 * Blueprints tab. Ported from codex/js/main.js:1512-1885 (buildBlueprintSVG)
 * with the same hash-seeded layout so each work renders deterministically
 * across builds.
 *
 * Stage 7a renders a SINGLE page per work (pageIdx=0) without grid +
 * title-block embedded in SVG (the canvas brings the grid as a CSS
 * background, the title-block is an HTML overlay).  Multi-page support
 * + export-SVG land in Stages 7b/7c.
 */

export interface BlueprintPage {
  view: string;
  /** Drawing number (e.g. "CS-001-A") — used in the HTML title block. */
  no: string;
  unit: 'mm' | 'cm';
  /** Overall width × height in `unit` — drives dimension labels. */
  overall: [number, number];
  /** 2-6 named parts; the rect is subdivided into matching cells. */
  parts: string[];
}

/**
 * BLUEPRINT_META mirrors the legacy map at main.js:1520-1547 line-for-line.
 * Two works (orbital-mk-ii, vega-shell) ship three pages each; the rest
 * have one.  Stage 7a only renders pages[0]; Stage 7b will iterate.
 */
export const BLUEPRINT_META: Record<string, { pages: BlueprintPage[] }> = {
  'orbital-mk-ii': {
    pages: [
      { view: 'Front view', no: 'CS-001-A', unit: 'mm', overall: [1820, 1240], parts: ['Chassis', 'Thruster', 'Panel A', 'Panel B', 'Vent'] },
      { view: 'Top view', no: 'CS-001-B', unit: 'mm', overall: [1820, 1640], parts: ['Hub', 'Forward bay', 'Aft bay', 'Stabilizer L', 'Stabilizer R'] },
      { view: 'Section A-A', no: 'CS-001-C', unit: 'mm', overall: [1240, 920], parts: ['Coolant duct', 'Reactor core', 'Plenum'] },
    ],
  },
  'vega-shell': {
    pages: [
      { view: 'Exploded view', no: 'CS-002-A', unit: 'mm', overall: [1640, 1100], parts: ['Shoulder', 'Chest', 'Forearm', 'Greave'] },
      { view: 'Front view', no: 'CS-002-B', unit: 'mm', overall: [820, 1320], parts: ['Pauldron', 'Cuirass', 'Vambrace'] },
      { view: 'Side view', no: 'CS-002-C', unit: 'mm', overall: [640, 1320], parts: ['Spaulder', 'Backplate', 'Tasset'] },
    ],
  },
  'ironclad-frame': { pages: [{ view: 'Top view', no: 'CS-003', unit: 'mm', overall: [2400, 1200], parts: ['Frame', 'Bracket', 'Flange', 'Bolt row'] }] },
  'corten-series': { pages: [{ view: 'Front view', no: 'CS-004', unit: 'cm', overall: [85, 110], parts: ['Seat', 'Back', 'Leg L', 'Leg R'] }] },
  'lumen-one': { pages: [{ view: 'Section A-A', no: 'CS-005', unit: 'mm', overall: [320, 420], parts: ['Shade', 'Stem', 'Base', 'Socket'] }] },
  'flux-capsule': { pages: [{ view: 'Front view', no: 'CS-006', unit: 'mm', overall: [900, 1400], parts: ['Capsule', 'Coil', 'Core', 'Port'] }] },
  'nightshard': { pages: [{ view: 'Front view', no: 'CS-007', unit: 'mm', overall: [640, 1820], parts: ['Blade', 'Guard', 'Grip', 'Pommel'] }] },
  'recon-drone': { pages: [{ view: 'Top view', no: 'CS-008', unit: 'mm', overall: [1280, 1280], parts: ['Hub', 'Rotor NE', 'Rotor SE', 'Rotor SW', 'Rotor NW'] }] },
  'apex-frame': { pages: [{ view: 'Side view', no: 'CS-009', unit: 'mm', overall: [1700, 900], parts: ['Top rail', 'Bottom rail', 'Strut L', 'Strut R'] }] },
  'core-rig': { pages: [{ view: 'Front view', no: 'CS-010', unit: 'mm', overall: [1200, 1600], parts: ['Mount', 'Arm', 'Yoke', 'Clamp'] }] },
  'helix-reveal': { pages: [{ view: 'Exploded view', no: 'CS-011', unit: 'mm', overall: [1440, 1440], parts: ['Ring A', 'Ring B', 'Spine', 'Cap'] }] },
  'arc-motion': { pages: [{ view: 'Side view', no: 'CS-012', unit: 'mm', overall: [2000, 800], parts: ['Arc', 'Pivot', 'Counterweight'] }] },
  'nyx-panther': { pages: [{ view: 'Side view', no: 'CS-013', unit: 'cm', overall: [180, 80], parts: ['Head', 'Torso', 'Foreleg', 'Hindleg', 'Tail'] }] },
  'drift-koi': { pages: [{ view: 'Top view', no: 'CS-014', unit: 'cm', overall: [90, 40], parts: ['Head', 'Body', 'Fin', 'Tail'] }] },
  'glint-owl': { pages: [{ view: 'Front view', no: 'CS-015', unit: 'cm', overall: [55, 70], parts: ['Head', 'Body', 'Wing L', 'Wing R'] }] },
  'mech-link': { pages: [{ view: 'Assembly view', no: 'CS-016', unit: 'mm', overall: [1200, 800], parts: ['Link A', 'Link B', 'Pin', 'Bracket'] }] },
  'flex-spine': { pages: [{ view: 'Side view', no: 'CS-017', unit: 'mm', overall: [1800, 600], parts: ['Rib x8', 'Driver', 'Joint A', 'Joint B'] }] },
  'cad-strut': { pages: [{ view: 'Section A-A', no: 'CS-018', unit: 'mm', overall: [600, 600], parts: ['Hub', 'Strut N', 'Strut E', 'Mount'] }] },
};

export function getBlueprintPages(slug: string): BlueprintPage[] {
  return BLUEPRINT_META[slug]?.pages ?? [];
}

// SVG viewBox + paddings — match the legacy constants verbatim so the
// proportions of grid (CSS bg on canvas) and SVG content line up.
export const BP_VIEW_W = 1200;
export const BP_VIEW_H = 800;
const BP_PAD_LEFT = 80;
const BP_PAD_TOP = 40;
const BP_PAD_RIGHT = 280;
const BP_PAD_BOTTOM = 140;

// ── Hash + seeded RNG, identical to case-rows.ts (kept local to avoid the
//   cross-module re-export so the blueprint module is fully self-contained).
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BuildOptions {
  /** Drawing title shown in the aria-label; HTML title-block uses it too. */
  title: string;
  /** True for download-ready exports — adds grid + title-block inside the SVG. */
  forExport?: boolean;
  /** Used by export to fill the Date column of the title block. */
  year?: number | string;
}

/**
 * Produce the SVG string for one blueprint page. Returns the entire
 * `<svg …>…</svg>` tree, ready to be dropped into the page via
 * `set:html` (server-side).
 */
export function buildBlueprintSVG(
  slug: string,
  pageIdx: number,
  opts: BuildOptions,
): string | null {
  const pages = getBlueprintPages(slug);
  const meta = pages[pageIdx];
  if (!meta) return null;

  const rng = mulberry32(hashStr(`${slug}-bp-${pageIdx}`));
  const uid = `${slug}-${pageIdx}`;
  const forExport = !!opts.forExport;

  // ── Drawing area ─────────────────────────────────────────────────────────
  const ratio = meta.overall[0] / meta.overall[1];
  const frameW = BP_VIEW_W - BP_PAD_LEFT - BP_PAD_RIGHT;
  const frameH = BP_VIEW_H - BP_PAD_TOP - BP_PAD_BOTTOM;
  let drawW: number;
  let drawH: number;
  if (ratio >= 1) {
    drawW = Math.min(frameW, frameH * ratio);
    drawH = drawW / ratio;
  } else {
    drawH = Math.min(frameH, frameW / ratio);
    drawW = drawH * ratio;
  }
  const drawX = BP_PAD_LEFT + (frameW - drawW) / 2;
  const drawY = BP_PAD_TOP + (frameH - drawH) / 2;

  // ── Cell layout for parts ────────────────────────────────────────────────
  const parts = meta.parts;
  const horizontal = ratio >= 1;
  const positions: Cell[] = [];
  if (parts.length <= 3) {
    const cuts: number[] = [];
    for (let c = 1; c < parts.length; c++) {
      cuts.push(0.25 + 0.5 * (c / parts.length) + (rng() - 0.5) * 0.1);
    }
    cuts.sort((a, b) => a - b);
    let prev = 0;
    for (const p of [...cuts, 1]) {
      if (horizontal) {
        positions.push({ x: drawX + drawW * prev, y: drawY, w: drawW * (p - prev), h: drawH });
      } else {
        positions.push({ x: drawX, y: drawY + drawH * prev, w: drawW, h: drawH * (p - prev) });
      }
      prev = p;
    }
  } else {
    const cols = horizontal ? Math.ceil(parts.length / 2) : 2;
    const rows = horizontal ? 2 : Math.ceil(parts.length / 2);
    for (let i = 0; i < parts.length; i++) {
      const cx = i % cols;
      const ry = Math.floor(i / cols);
      positions.push({
        x: drawX + (drawW / cols) * cx,
        y: drawY + (drawH / rows) * ry,
        w: drawW / cols,
        h: drawH / rows,
      });
    }
  }

  // ── SVG fragment builders ────────────────────────────────────────────────
  const ariaLabel = `Technical blueprint of ${opts.title}${
    pages.length > 1 ? ` (page ${pageIdx + 1} of ${pages.length})` : ''
  }`;

  const arrowStartId = `bp-arrow-start-${uid}`;
  const arrowEndId = `bp-arrow-end-${uid}`;

  const defs = `<defs>
    <marker id="${arrowStartId}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path class="blueprint__dim-arrow" d="M 0 5 L 10 0 L 8 5 L 10 10 Z" />
    </marker>
    <marker id="${arrowEndId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path class="blueprint__dim-arrow" d="M 10 5 L 0 0 L 2 5 L 0 10 Z" />
    </marker>
${forExport ? defsGridPatterns(uid) : ''}
  </defs>`;

  const grid = forExport ? gridRects(uid) : '';

  const viewTag = `<g><text class="blueprint__view-tag" x="16" y="28">${esc(meta.view.toUpperCase())}</text></g>`;

  // Main outline + part cells.
  const pad = 6;
  let partsSvg = `<g class="blueprint__parts">`;
  partsSvg += `<rect class="blueprint__part" x="${num(drawX)}" y="${num(drawY)}" width="${num(drawW)}" height="${num(drawH)}" />`;
  parts.forEach((name, idx) => {
    const p = positions[idx];
    if (!p) return;
    const w = Math.max(0, p.w - pad * 2);
    const h = Math.max(0, p.h - pad * 2);
    partsSvg += `<rect class="blueprint__part" x="${num(p.x + pad)}" y="${num(p.y + pad)}" width="${num(w)}" height="${num(h)}" />`;
    partsSvg += `<text class="blueprint__part-label" x="${num(p.x + p.w / 2)}" y="${num(p.y + p.h / 2 + 4)}" text-anchor="middle">${esc(name)}</text>`;
  });
  partsSvg += `</g>`;

  // Dimension lines (overall width below, overall height to the left).
  const yDim = drawY + drawH + 36;
  const xDim = drawX - 36;
  const lblW = `${meta.overall[0]} ${meta.unit}`;
  const lblH = `${meta.overall[1]} ${meta.unit}`;
  let dims = `<g class="blueprint__dimensions">`;
  dims += `<line class="blueprint__dim-ext" x1="${num(drawX)}" y1="${num(drawY + drawH + 4)}" x2="${num(drawX)}" y2="${num(yDim + 6)}" />`;
  dims += `<line class="blueprint__dim-ext" x1="${num(drawX + drawW)}" y1="${num(drawY + drawH + 4)}" x2="${num(drawX + drawW)}" y2="${num(yDim + 6)}" />`;
  dims += `<line class="blueprint__dim-line" x1="${num(drawX)}" y1="${num(yDim)}" x2="${num(drawX + drawW)}" y2="${num(yDim)}" marker-start="url(#${arrowStartId})" marker-end="url(#${arrowEndId})" />`;
  dims += `<rect class="blueprint__dim-label-bg" x="${num(drawX + drawW / 2 - 38)}" y="${num(yDim - 8)}" width="76" height="16" />`;
  dims += `<text class="blueprint__dim-label" x="${num(drawX + drawW / 2)}" y="${num(yDim + 4)}">${esc(lblW)}</text>`;
  dims += `<line class="blueprint__dim-ext" x1="${num(drawX - 4)}" y1="${num(drawY)}" x2="${num(xDim - 6)}" y2="${num(drawY)}" />`;
  dims += `<line class="blueprint__dim-ext" x1="${num(drawX - 4)}" y1="${num(drawY + drawH)}" x2="${num(xDim - 6)}" y2="${num(drawY + drawH)}" />`;
  dims += `<line class="blueprint__dim-line" x1="${num(xDim)}" y1="${num(drawY)}" x2="${num(xDim)}" y2="${num(drawY + drawH)}" marker-start="url(#${arrowStartId})" marker-end="url(#${arrowEndId})" />`;
  dims += `<rect class="blueprint__dim-label-bg" x="${num(xDim - 38)}" y="${num(drawY + drawH / 2 - 8)}" width="76" height="16" />`;
  dims += `<text class="blueprint__dim-label" x="${num(xDim)}" y="${num(drawY + drawH / 2 + 4)}" transform="rotate(-90 ${num(xDim)} ${num(drawY + drawH / 2)})">${esc(lblH)}</text>`;
  dims += `</g>`;

  // Callouts — up to four parts in a column on the right margin.
  const calloutTargets = parts.slice(0, Math.min(4, parts.length));
  const calloutStartX = drawX + drawW + 80;
  const calloutStartY = drawY + 30;
  const calloutStep = 40;
  const midX = drawX + drawW + 30;
  let callouts = `<g class="blueprint__callouts">`;
  calloutTargets.forEach((name, idx) => {
    const p = positions[idx];
    if (!p) return;
    const cxC = p.x + p.w - 6;
    const cyC = p.y + p.h / 2;
    const labelX = calloutStartX;
    const labelY = calloutStartY + idx * calloutStep;
    callouts += `<path class="blueprint__callout-leader" d="M ${num(cxC)} ${num(cyC)} L ${num(midX)} ${num(cyC)} L ${num(labelX - 12)} ${num(labelY)}" />`;
    callouts += `<circle class="blueprint__callout-circle" cx="${num(labelX)}" cy="${num(labelY)}" r="11" />`;
    callouts += `<text class="blueprint__callout-num" x="${num(labelX)}" y="${num(labelY)}">${idx + 1}</text>`;
    callouts += `<text class="blueprint__callout-label" x="${num(labelX + 20)}" y="${num(labelY + 3)}">${esc(name)}</text>`;
  });
  callouts += `</g>`;

  // Title-block for forExport flag — runtime uses an HTML overlay instead.
  const titleBlock = forExport ? buildExportTitleBlock(meta, opts) : '';

  return [
    `<svg viewBox="0 0 ${BP_VIEW_W} ${BP_VIEW_H}" preserveAspectRatio="xMidYMid meet" aria-label="${esc(ariaLabel)}">`,
    defs,
    grid,
    viewTag,
    partsSvg,
    dims,
    callouts,
    titleBlock,
    `</svg>`,
  ].join('');
}

function defsGridPatterns(uid: string): string {
  return `    <pattern id="bp-grid-minor-${uid}" width="20" height="20" patternUnits="userSpaceOnUse">
      <path class="blueprint__grid-minor" d="M 20 0 L 0 0 0 20" />
    </pattern>
    <pattern id="bp-grid-major-${uid}" width="100" height="100" patternUnits="userSpaceOnUse">
      <path class="blueprint__grid-major" d="M 100 0 L 0 0 0 100" />
    </pattern>`;
}

function gridRects(uid: string): string {
  return `<g class="blueprint__grid">
    <rect x="0" y="0" width="${BP_VIEW_W}" height="${BP_VIEW_H}" fill="url(#bp-grid-minor-${uid})" />
    <rect x="0" y="0" width="${BP_VIEW_W}" height="${BP_VIEW_H}" fill="url(#bp-grid-major-${uid})" />
  </g>`;
}

function buildExportTitleBlock(meta: BlueprintPage, opts: BuildOptions): string {
  const tbW = 320;
  const tbH = 96;
  const tbX = BP_VIEW_W - 16 - tbW;
  const tbY = BP_VIEW_H - 16 - tbH;
  const scale = `1:${meta.unit === 'cm' ? '4' : '8'}`;
  const cells = [
    { k: 'Drawing No', v: meta.no },
    { k: 'Scale', v: scale },
    { k: 'Date', v: opts.year != null ? String(opts.year) : '—' },
  ];
  const colW = tbW / 3;
  let g = `<g class="blueprint__title-block">`;
  g += `<rect class="blueprint__title-block-frame" x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" />`;
  g += `<text class="blueprint__title-block-key" x="${tbX + 12}" y="${tbY + 18}">Project</text>`;
  g += `<text class="blueprint__title-block-project" x="${tbX + 12}" y="${tbY + 38}">${esc(opts.title)}</text>`;
  g += `<line class="blueprint__title-block-divider" x1="${tbX}" y1="${tbY + 48}" x2="${tbX + tbW}" y2="${tbY + 48}" />`;
  cells.forEach((cell, idx) => {
    const cxTB = tbX + colW * idx + 12;
    g += `<text class="blueprint__title-block-key" x="${cxTB}" y="${tbY + 64}">${esc(cell.k)}</text>`;
    g += `<text class="blueprint__title-block-val" x="${cxTB}" y="${tbY + 82}">${esc(cell.v)}</text>`;
    if (idx < 2) {
      g += `<line class="blueprint__title-block-divider" x1="${tbX + colW * (idx + 1)}" y1="${tbY + 48}" x2="${tbX + colW * (idx + 1)}" y2="${tbY + tbH}" />`;
    }
  });
  g += `</g>`;
  return g;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function num(n: number): string {
  // Trim trailing zeros from float coords for a cleaner SVG payload.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
