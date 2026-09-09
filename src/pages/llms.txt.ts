import type { APIRoute } from 'astro';
import siteData from '../data/site.json';
import articles from '../data/articles.json';

export const GET: APIRoute = async () => {
  const siteUrl = "https://atelierhaven.com";

  let body = `# Atelier Haven — Architectural & Interior Design Magazine
> The Definitive Digital Journal of Modern Architecture, Interior Spaces & Artful Living.

Website: ${siteUrl}
Masthead: Atelier Haven Media Group, Inc., San Francisco, CA
ISSN: 2984-1184 (Global Architecture Edition)
Target Audience: Architects, Interior Designers, Historic Renovators, and Connoisseur Homeowners

## Editorial Focus & Topical Authority
Atelier Haven publishes authoritative, peer-reviewed, long-form editorial guides across 12 residential architecture and interior design verticals:
`;

  siteData.categories.forEach(cat => {
    body += `- **${cat.name}** (${siteUrl}/category/${cat.slug}): ${cat.description}\n`;
  });

  body += `\n## Core Editorial Articles & Specifications\n`;
  articles.forEach(art => {
    body += `- [${art.title}](${siteUrl}/${art.slug}): ${art.subtitle}\n`;
  });

  body += `\n## Essential Trust & Governance Portals
- About & Mission: ${siteUrl}/about
- Editorial Standards & Fact-Checking: ${siteUrl}/editorial-policy
- Masthead Directory: ${siteUrl}/about
- Contact & Submissions: ${siteUrl}/contact
- Privacy Policy: ${siteUrl}/privacy-policy
- Terms of Service: ${siteUrl}/terms
- Cookie Policy: ${siteUrl}/cookie-policy
- Advertising & FTC Disclosures: ${siteUrl}/disclaimer

## Crawling & LLM Indexing Directives
- User-Agent: *
- Machine-Readable Sitemap: ${siteUrl}/sitemap-index.xml
- RSS Feed: ${siteUrl}/rss.xml
- Format: Clean Semantic HTML5 with complete Schema.org (Article, WebSite, BreadcrumbList) graph.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};