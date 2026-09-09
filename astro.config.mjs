import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atriumlivings.com',
  integrations: [sitemap()],
  server: {
    port: 3000,
    host: true
  }
});
