import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Canonical category list (Title Case, Stage-3 decision).
 * Replaces the legacy kebab-case EXPECTED_TAGS/EXPECTED_FA_TAGS pair.
 * A single work may live in 1..n categories (e.g. nightshard belongs to
 * Hard Surface AND Game Asset). The legacy `prototyping` bucket folds
 * into `Mechanical`; CAD-only placeholders carry just `CAD`.
 */
export const WORK_CATEGORIES = [
  'Hard Surface',
  'Product Viz',
  'Game Asset',
  'Organic',
  'Animation',
  'CAD',
  'Mechanical',
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

/** Author/role indicator for the case readout (mirrors legacy CARDS_DATA.role). */
export const WORK_ROLES = ['Personal', 'Client', 'R&D'] as const;

/** Gallery item — one slide inside case-view 2D. Captions are rich (label + description). */
const galleryItem = z.object({
  src: z.string(),
  alt: z.string(),
  type: z.enum(['image', 'video', 'model']).default('image'),
  format: z.enum(['wide', 'tall']).default('wide'),
  /** Short ALL-CAPS-ish label shown in the readout (e.g. "HERO RENDER"). */
  label: z.string().optional(),
  /** Long-form caption rendered under the label. */
  description: z.string().optional(),
  /** Optional CSS background for the slide frame (legacy `palette` gradients). */
  bg: z.string().optional(),
});

/** Optional intro / inline text blocks rendered alongside the gallery. */
const textBlock = z.object({
  title: z.string(),
  body: z.string(),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    /** URL slug; must match the .md filename and the legacy data-id for parity. */
    slug: z.string(),
    year: z.number().int().min(2015).max(2030),
    category: z.array(z.enum(WORK_CATEGORIES)).min(1),
    role: z.enum(WORK_ROLES).optional(),
    client: z.string().optional(),
    description: z.string(),

    /** Card thumbnail (sidebar list). */
    thumb: z.object({
      src: z.string(),
      alt: z.string(),
    }),

    /** Case-view 2D slides (5 in the legacy data, but schema is open-ended). */
    gallery: z.array(galleryItem),

    /** Optional intro text-block. Renders above the gallery. */
    intro: textBlock.optional(),
    /** Optional inline text-block woven alongside a tall slide. */
    inline: textBlock.optional(),

    /** Render-time + polycount specs surfaced in the 3D-tab readout. */
    specs: z
      .object({
        software: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        polycount: z.string().optional(),
        vertices: z.string().optional(),
        materials: z.union([z.string(), z.number()]).optional(),
        textures: z.string().optional(),
        renderTime: z.string().optional(),
        resolution: z.string().optional(),
      })
      .optional(),

    /** Lazy-loaded GLB for the 3D-tab (Stage 6). External URLs allowed for early stubs. */
    modelSrc: z.string().optional(),

    /** True when no real GLB/textures are shipped yet (legacy data-cad-placeholder). */
    cadPlaceholder: z.boolean().default(false),
    /** True when the work doubles as a real-time/game asset (legacy data-game-asset). */
    gameAsset: z.boolean().default(false),

    /** Cross-links into other works in the collection. Curated, not auto-derived. */
    related: z.array(z.string()).optional(),
    /** Surface in the homepage hero/featured grid. Defaults to false. */
    featured: z.boolean().default(false),
    /** Stable sort key for the sidebar list (1..18 in the legacy order). */
    order: z.number().int().optional(),
  }),
});

export const collections = { works };
