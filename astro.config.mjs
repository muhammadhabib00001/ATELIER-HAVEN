import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.atriumlivings.com',
  integrations: [],
  server: {
    port: 3000,
    host: true
  }
});
