import { getCollection, type CollectionEntry } from 'astro:content';
import { WORK_CATEGORIES, type WorkCategory } from '~/content.config';

export type WorkEntry = CollectionEntry<'works'>;

/**
 * Sorted-by-order list of every published work.
 * `order` is the legacy sidebar position (1..18); ties break by year desc, then title.
 */
export async function getAllWorks(): Promise<WorkEntry[]> {
  const all = await getCollection('works');
  return all.sort((a, b) => {
    const oa = a.data.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.data.order ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    if (a.data.year !== b.data.year) return b.data.year - a.data.year;
    return a.data.title.localeCompare(b.data.title);
  });
}

/**
 * Featured-only subset for the homepage hero / ItemList JSON-LD.
 * Falls back to the first `limit` entries when fewer than `limit` works
 * are flagged `featured: true` in their frontmatter — guarantees the
 * homepage never renders an empty featured grid in early development.
 */
export async function getFeaturedWorks(limit = 4): Promise<WorkEntry[]> {
  const all = await getAllWorks();
  const featured = all.filter((w) => w.data.featured);
  if (featured.length >= limit) return featured.slice(0, limit);
  // Top up with non-featured entries, preserving order.
  const filler = all.filter((w) => !w.data.featured).slice(0, limit - featured.length);
  return [...featured, ...filler];
}

/**
 * Works that share at least one category with `slug`, excluding `slug` itself.
 * Honors explicit `related: [slug…]` in frontmatter first, then fills with
 * category-matched siblings up to `limit`. Stable: same input → same output.
 */
export async function getRelatedWorks(slug: string, limit = 3): Promise<WorkEntry[]> {
  const all = await getAllWorks();
  const self = all.find((w) => w.data.slug === slug);
  if (!self) return [];

  const out: WorkEntry[] = [];
  const seen = new Set<string>([slug]);

  // 1. Explicit `related` curation wins.
  for (const ref of self.data.related ?? []) {
    if (seen.has(ref)) continue;
    const match = all.find((w) => w.data.slug === ref);
    if (match) {
      out.push(match);
      seen.add(ref);
      if (out.length === limit) return out;
    }
  }

  // 2. Category overlap, ordered by overlap size desc then sidebar order asc.
  const selfCats = new Set(self.data.category);
  const scored = all
    .filter((w) => !seen.has(w.data.slug))
    .map((w) => {
      const overlap = w.data.category.reduce((acc, c) => acc + (selfCats.has(c) ? 1 : 0), 0);
      return { w, overlap };
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => {
      if (a.overlap !== b.overlap) return b.overlap - a.overlap;
      const oa = a.w.data.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.w.data.order ?? Number.MAX_SAFE_INTEGER;
      return oa - ob;
    });

  for (const { w } of scored) {
    out.push(w);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * All works carrying `category` (Title Case). Returns sidebar order.
 */
export async function getWorksByCategory(category: WorkCategory): Promise<WorkEntry[]> {
  const all = await getAllWorks();
  return all.filter((w) => w.data.category.includes(category));
}

/**
 * Distinct category list across the corpus, in canonical order. Useful for
 * generating filter dropdowns without duplicating WORK_CATEGORIES locally.
 */
export async function getCategoriesInUse(): Promise<WorkCategory[]> {
  const all = await getAllWorks();
  const seen = new Set<WorkCategory>();
  for (const w of all) for (const c of w.data.category) seen.add(c);
  return WORK_CATEGORIES.filter((c) => seen.has(c));
}

/**
 * Works flagged `gameAsset: true` — drives the legacy game-switch toggle.
 */
export async function getGameAssets(): Promise<WorkEntry[]> {
  const all = await getAllWorks();
  return all.filter((w) => w.data.gameAsset);
}
