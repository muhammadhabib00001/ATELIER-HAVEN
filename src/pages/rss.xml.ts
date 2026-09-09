import type { APIRoute } from 'astro';
import articles from '../data/articles.json';

export const GET: APIRoute = async () => {
  const siteUrl = "https://atelierhaven.com";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Atelier Haven | Architectural &amp; Interior Design Magazine</title>
    <link>${siteUrl}</link>
    <description>The Definitive Digital Journal of Modern Architecture, Interior Spaces &amp; Artful Living.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
`;

  articles.forEach(art => {
    xml += `    <item>
      <title><![CDATA[${art.title}]]></title>
      <link>${siteUrl}/${art.slug}</link>
      <guid isPermaLink="true">${siteUrl}/${art.slug}</guid>
      <description><![CDATA[${art.subtitle}]]></description>
      <pubDate>${new Date(art.publishedAt).toUTCString()}</pubDate>
      <category><![CDATA[${art.category}]]></category>
    </item>
`;
  });

  xml += `  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};