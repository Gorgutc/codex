/**
 * Case-row layout — pure function that translates a work's gallery + intro +
 * inline blocks into the row tree the legacy site rendered via buildItems()
 * in codex/js/main.js (lines 1168-1252).
 *
 * The layout is deterministic per slug: hash(slug) seeds a Mulberry32 RNG and
 * we shuffle wides / talls separately, then merge with a no-two-wide-in-a-row
 * guard. Running the algorithm at build time (Astro frontmatter) gives us
 * static HTML — no client-side mutation, View-Transitions-friendly.
 */
import type { WorkEntry } from './works';

export type GalleryItem = WorkEntry['data']['gallery'][number];
export type TextBlock = { title: string; body: string };

export type CaseRow =
  | { kind: 'text-full'; text: TextBlock; meta: TextMeta }
  | { kind: 'wide'; a: GalleryItem }
  | { kind: 'tall-1'; a: GalleryItem }
  | { kind: 'tall-2'; a: GalleryItem; b: GalleryItem }
  | { kind: 'tall-text'; a: GalleryItem; text: TextBlock };

export interface TextMeta {
  role?: string;
  tools?: string[];
  year?: number;
  gameAsset?: boolean;
}

/** FNV-1a style 32-bit hash, mirrors hashStr() in legacy main.js:738. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG, mirrors mulberry32() in legacy main.js:746. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

/**
 * Compose the row tree for a work. Deterministic — identical inputs → identical
 * output across builds.  Text-full intro (when present) always lands first.
 */
export function buildCaseRows(work: WorkEntry): CaseRow[] {
  const d = work.data;
  const rng = mulberry32(hashStr(d.slug));

  const wides = shuffleInPlace(
    d.gallery.filter((g) => g.format === 'wide').slice(),
    rng,
  );
  const talls = shuffleInPlace(
    d.gallery.filter((g) => g.format !== 'wide').slice(),
    rng,
  );

  const tallRows: CaseRow[] = [];
  if (d.inline && talls.length >= 1) {
    const a = talls.shift()!;
    tallRows.push({ kind: 'tall-text', a, text: d.inline });
  }
  while (talls.length >= 2) {
    const a = talls.shift()!;
    const b = talls.shift()!;
    tallRows.push({ kind: 'tall-2', a, b });
  }
  if (talls.length === 1) {
    tallRows.push({ kind: 'tall-1', a: talls.shift()! });
  }

  const wideRows: CaseRow[] = wides.map((a) => ({ kind: 'wide', a }));
  const merged: CaseRow[] = shuffleInPlace([...tallRows, ...wideRows], rng);

  // Anti-double-wide pass — mirrors main.js:1218-1228.
  for (let k = 0; k < merged.length - 1; k++) {
    if (merged[k]!.kind === 'wide' && merged[k + 1]!.kind === 'wide') {
      for (let m = k + 2; m < merged.length; m++) {
        if (merged[m]!.kind !== 'wide') {
          const tmp = merged[k + 1]!;
          merged[k + 1] = merged[m]!;
          merged[m] = tmp;
          break;
        }
      }
    }
  }

  const rows: CaseRow[] = [];
  if (d.intro) {
    rows.push({
      kind: 'text-full',
      text: d.intro,
      meta: {
        role: d.role,
        tools: d.specs?.tools,
        year: d.year,
        gameAsset: d.gameAsset,
      },
    });
  }
  rows.push(...merged);
  return rows;
}
