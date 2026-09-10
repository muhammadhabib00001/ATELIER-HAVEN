import type { APIRoute } from 'astro';
import articles from '../data/articles.json';
import siteData from '../data/site.json';

export const GET: APIRoute = async () => {
  const siteUrl = "https://atriumlivings.com";
  const now = new Date().toISOString();

  const staticPages = [
    { url: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
    { url: `${siteUrl}/about/`, priority: '0.8', changefreq: 'daily' },
    { url: `${siteUrl}/contact/`, priority: '0.8', changefreq: 'daily' },
    { url: `${siteUrl}/editorial-policy/`, priority: '0.8', changefreq: 'daily' },
    { url: `${siteUrl}/search/`, priority: '0.8', changefreq: 'daily' },
    { url: `${siteUrl}/privacy-policy/`, priority: '0.3', changefreq: 'monthly' },
    { url: `${siteUrl}/terms/`, priority: '0.3', changefreq: 'monthly' },
    { url: `${siteUrl}/disclaimer/`, priority: '0.3', changefreq: 'monthly' },
    { url: `${siteUrl}/cookie-policy/`, priority: '0.3', changefreq: 'monthly' },
  ];

  const categoryPages = siteData.categories.map((cat: { slug: string }) => ({
    url: `${siteUrl}/category/${cat.slug}/`,
    priority: '0.9',
    changefreq: 'daily'
  }));

  const authorPages = siteData.authors.map((author: { slug: string }) => ({
    url: `${siteUrl}/author/${author.slug}/`,
    priority: '0.6',
    changefreq: 'weekly'
  }));

  const articlePages = articles.map((art: { slug: string; updatedAt?: string; publishedAt?: string }) => ({
    url: `${siteUrl}/${art.slug}/`,
    priority: '0.85',
    changefreq: 'daily',
    lastmod: art.updatedAt || art.publishedAt || now
  }));

  const allUrls = [
    ...staticPages,
    ...categoryPages,
    ...authorPages,
    ...articlePages
  ];

  let xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n';
  xml += '<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:news=\"http://www.google.com/schemas/sitemap-news/0.9\" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\" xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\" xmlns:video=\"http://www.google.com/schemas/sitemap-video/1.1\">\n';

  for (const page of allUrls) {
    const pageLastmod = 'lastmod' in page && page.lastmod ? new Date(page.lastmod).toISOString() : now;
    xml += '  <url>\n';
    xml += '    <loc>' + page.url + '</loc>\n';
    xml += '    <lastmod>' + pageLastmod + '</lastmod>\n';
    xml += '    <changefreq>' + page.changefreq + '</changefreq>\n';
    xml += '    <priority>' + page.priority + '</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    }
  });
};
