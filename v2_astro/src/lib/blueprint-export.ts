/**
 * Blueprint export — turns a forExport SVG (with embedded grid + title
 * block) into a downloadable, self-contained .svg file.
 *
 * The legacy approach (main.js:2767) walked computed styles per element,
 * which is heavy and produces noisy output.  Here we embed a small
 * static <style> block with the dark-theme blueprint rules instead —
 * blueprint exports always render dark regardless of the user's theme.
 *
 * Caller responsibility:
 *   1. Generate the SVG markup via buildBlueprintSVG(slug, idx,
 *      { forExport: true, title, year }).
 *   2. Pass the string + filename suffix to exportBlueprintSvg().
 */

/**
 * Inline CSS injected into exported SVG. Values are dark-theme tokens
 * from src/styles/tokens.css with all var() references resolved so the
 * file renders identically in any viewer.
 *
 * Keep this block in sync with .blueprint__* rules in
 * src/styles/components/case-blueprints.css. The visual contract is:
 *   – grid: --bp-grid-minor / --bp-grid-major
 *   – parts: stroke --color-primary, no fill
 *   – dim lines + arrows: --color-text-muted
 *   – callouts: --color-primary
 *   – title block: --color-surface frame + --color-text-faint keys +
 *     --color-text values + --color-primary project name
 */
export const EXPORT_STYLES = `
  .blueprint__grid-minor { stroke: rgba(50, 122, 174, 0.08); stroke-width: 0.5; fill: none; }
  .blueprint__grid-major { stroke: rgba(50, 122, 174, 0.18); stroke-width: 1;   fill: none; }
  .blueprint__part {
    fill: none;
    stroke: #327AAE;
    stroke-width: 1.2;
    vector-effect: non-scaling-stroke;
  }
  .blueprint__part-label {
    fill: #a8a6a2;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .blueprint__dim-line,
  .blueprint__dim-ext { stroke: #a8a6a2; stroke-width: 0.8; fill: none; }
  .blueprint__dim-ext { stroke-dasharray: 2 3; opacity: 0.5; }
  .blueprint__dim-arrow { fill: #a8a6a2; stroke: none; }
  .blueprint__dim-label {
    fill: #f0eeeb;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }
  .blueprint__dim-label-bg { fill: #212121; }
  .blueprint__callout-leader { stroke: #327AAE; stroke-width: 0.8; fill: none; }
  .blueprint__callout-circle { fill: #212121; stroke: #327AAE; stroke-width: 1.2; }
  .blueprint__callout-num {
    fill: #327AAE;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 10px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
  }
  .blueprint__callout-label {
    fill: #a8a6a2;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .blueprint__title-block-frame { fill: #2a2a2a; stroke: #4a4a4a; stroke-width: 1; }
  .blueprint__title-block-divider { stroke: #4a4a4a; stroke-width: 0.5; }
  .blueprint__title-block-key {
    fill: #8a8884;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .blueprint__title-block-val {
    fill: #f0eeeb;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }
  .blueprint__title-block-project {
    fill: #327AAE;
    font-family: 'Space Grotesk', 'Clash Display', 'Inter', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
  }
  .blueprint__view-tag {
    fill: #8a8884;
    font-family: 'Inter', 'General Sans', system-ui, sans-serif;
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
`;

const BG_COLOR = '#212121';
const SVG_VIEW_W = 1200;
const SVG_VIEW_H = 800;

/**
 * Wraps the build-time SVG string in an exportable shell: adds xmlns,
 * prepends a background <rect>, and embeds <defs><style>…</style></defs>
 * so the file renders standalone.
 */
export function decorateExportSvg(svgString: string): string {
  // svgString is the entire <svg …>…</svg> built by buildBlueprintSVG.
  // Insert xmlns attributes and our background + style fragment after the
  // opening <svg …> tag.
  const openMatch = svgString.match(/^<svg([^>]*)>/);
  if (!openMatch) return svgString;
  const openAttrs = openMatch[1] ?? '';
  const rest = svgString.slice(openMatch[0].length);

  // Ensure xmlns/xmlns:xlink are present. SVG generated for runtime may
  // omit them since browsers default to the SVG namespace inside HTML.
  const withNs =
    `<svg${openAttrs}` +
    (openAttrs.includes('xmlns=') ? '' : ' xmlns="http://www.w3.org/2000/svg"') +
    (openAttrs.includes('xmlns:xlink=') ? '' : ' xmlns:xlink="http://www.w3.org/1999/xlink"') +
    `>`;

  const bgRect = `<rect x="0" y="0" width="${SVG_VIEW_W}" height="${SVG_VIEW_H}" fill="${BG_COLOR}" />`;

  // <defs><style>…</style></defs> is the canonical way to embed CSS in
  // a standalone SVG. We add a fresh defs block at the start of <svg>
  // so it never collides with the per-marker defs already present.
  const styleDefs = `<defs><style type="text/css"><![CDATA[${EXPORT_STYLES}]]></style></defs>`;

  return withNs + styleDefs + bgRect + rest;
}

/**
 * Browser-only: triggers a .svg download of the given markup.
 * `filenameSuffix` is the slug (+ optional page index suffix), without
 * the "codex-blueprint-" prefix or the ".svg" extension.
 */
export function downloadSvg(svgString: string, filenameSuffix: string): void {
  const prelude = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const blob = new Blob([prelude + svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `codex-blueprint-${filenameSuffix}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation a tick so Safari finishes the download trigger.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Compose the slug → filename suffix mapping. Mirrors legacy
 * bpFileSuffix() in main.js:2808.
 */
export function bpFileSuffix(slug: string, pageIdx: number, total: number): string {
  const safe = slug.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return total > 1 ? `${safe}-p${pageIdx + 1}` : safe;
}
