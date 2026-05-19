/**
 * JSON-LD helpers (Stage 10) — sitewide Organization + WebSite +
 * homepage ItemList schemas.  Pages add their own CreativeWork /
 * WebPage / etc. on top via BaseLayout's `schemas` prop.
 *
 * Mirrors the legacy three-schema set from codex/index.html:48-141
 * (Organization, WebSite, ItemList) and the FA WebPage from
 * codex/free-assets.html.
 */

import type { JsonLd } from '@layouts/BaseLayout.astro';

const SITE = 'https://codex.promo';
const SAME_AS = [
  // Two placeholders survive from the legacy until real profile URLs land.
  'https://www.artstation.com/REPLACE_WITH_REAL',
  'https://www.behance.net/REPLACE_WITH_REAL',
  'https://t.me/WhiteCatWeb',
];

export function getOrganizationSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Codex Studio',
    alternateName: 'Codex',
    url: `${SITE}/`,
    logo: `${SITE}/img/og-image.jpg`,
    description:
      'Remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender.',
    sameAs: SAME_AS,
  };
}

export function getWebSiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Codex Studio',
    url: `${SITE}/`,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: 'Codex Studio' },
  };
}

/**
 * Featured ItemList — emitted only on the redirect target so crawlers
 * see the canonical homepage manifest. Mirrors the legacy
 * Orbital Mk.II / Corten Series / Apex Frame / Nightshard order.
 */
export function getFeaturedItemListSchema(
  items: Array<{ slug: string; title: string; about: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Codex Studio — Featured Works',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'CreativeWork',
        name: item.title,
        creator: { '@type': 'Organization', name: 'Codex Studio' },
        about: item.about,
        url: `${SITE}/work/${item.slug}/`,
      },
    })),
  };
}
