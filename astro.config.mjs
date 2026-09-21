import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.atriumlivings.com',
  redirects: {
    '/architectural-master-planning-king-bed-set': '/how-to-style-a-luxury-king-bed-set-master-bedroom-guide',
    '/how-to-style-a-luxury-king-bed-set': '/how-to-style-a-luxury-king-bed-set-master-bedroom-guide'
  },
  integrations: [],
  server: {
    port: 3000,
    host: true
  }
});
