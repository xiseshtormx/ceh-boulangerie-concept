// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL || 'https://xiseshtormx.github.io';

export default defineConfig({
  site,
  base: '/ceh-boulangerie-concept/',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'always',
  },
  image: {
    responsiveStyles: true,
  },
});
