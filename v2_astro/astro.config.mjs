// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://preview.codex.promo',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  // Static redirect so the home URL lands on the first sidebar work.
  // Astro emits a meta-refresh + http-equiv redirect at dist/index.html.
  redirects: {
    '/': '/work/orbital-mk-ii/',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});
