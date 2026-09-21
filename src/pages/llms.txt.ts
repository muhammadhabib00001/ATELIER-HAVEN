import type { APIRoute } from 'astro';
import siteData from '../data/site.json';
import articles from '../data/articles.json';

export const GET: APIRoute = async () => {
  const siteUrl = "https://www.atriumlivings.com";

  let body = `# Atrium Livings — Home Decor & DIY Magazine
> Your Inspiring Digital Magazine for Home Decor, DIY Projects & Creative Living.

Website: ${siteUrl}
Publisher: Atrium Livings Media Group, Inc., San Francisco, CA
Contact: intouchmagazines26@gmail.com
Update Frequency: Daily (06:00 UTC)
Content Type: Home Decor Inspiration, Step-by-Step DIY Projects, Room Styling Guides
Target Audience: Homeowners, Renters, DIY Enthusiasts, and Decor Lovers

## Editorial Focus & Topical Authority
Atrium Livings publishes practical, inspiring, long-form editorial guides across 12 home decor and lifestyle verticals:
`;

  siteData.categories.forEach(cat => {
    body += `- **${cat.name}** (${siteUrl}/category/${cat.slug}): ${cat.description}\n`;
  });

  body += `\n## Core Editorial Articles & Specifications (Updated Daily)\n`;
  articles.forEach(art => {
    const pubDate = art.publishedAt ? art.publishedAt.split('T')[0] : '';
    body += `- [${art.title}](${siteUrl}/${art.slug}): ${art.subtitle} [Published: ${pubDate} | Category: ${art.category}]\n`;
  });

  body += `\n## Editorial Team & Contributors
`;
  siteData.authors.forEach(author => {
    body += `- **${author.name}** (${author.role} - ${author.credentials}): ${author.bio}\n`;
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
- Update-Frequency: Daily
- Machine-Readable Sitemap: ${siteUrl}/sitemap-index.xml
- RSS Feed: ${siteUrl}/rss.xml
- LLMS.txt Endpoint: ${siteUrl}/llms.txt
- Robots Directive: ${siteUrl}/robots.txt
- Format: Clean Semantic HTML5 with complete Schema.org (Article, WebSite, Organization, BreadcrumbList) graph.
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    }
  });
};