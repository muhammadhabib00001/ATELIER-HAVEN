import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atriumlivings.com',
  integrations: [
    sitemap({
      changefreq: 'daily',
      priority: 0.8,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === 'https://atriumlivings.com/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        } else if (item.url.includes('/category/')) {
          item.priority = 0.9;
          item.changefreq = 'daily';
        } else if (item.url.includes('/author/')) {
          item.priority = 0.6;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/privacy-policy') || item.url.includes('/terms') || item.url.includes('/disclaimer') || item.url.includes('/cookie-policy')) {
          item.priority = 0.3;
          item.changefreq = 'monthly';
        } else {
          // Articles and guides
          item.priority = 0.85;
          item.changefreq = 'daily';
        }
        item.lastmod = new Date();
        return item;
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  }
});
