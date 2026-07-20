// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL || process.env.URL;

export default defineConfig({
  site,
  integrations: site ? [sitemap()] : [],
  build: {
    inlineStylesheets: 'always',
  },
  image: {
    responsiveStyles: true,
  },
});
