import type { APIRoute } from 'astro';
import articles from '../data/articles.json';

export const GET: APIRoute = async () => {
  const siteUrl = "https://www.atriumlivings.com";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom" 
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Atrium Livings | Architectural &amp; Interior Design Magazine</title>
    <link>${siteUrl}</link>
    <description>The Definitive Digital Journal of Modern Architecture, Interior Spaces &amp; Artful Living.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
`;

  articles.forEach(art => {
    const pubDate = new Date(art.publishedAt || Date.now()).toUTCString();
    const rawCover = art.coverImage || `${siteUrl}/favicon.svg`;
    const coverImage = rawCover.replace(/&/g, '&amp;');

    xml += `    <item>
      <title><![CDATA[${art.title}]]></title>
      <link>${siteUrl}/${art.slug}/</link>
      <guid isPermaLink="true">${siteUrl}/${art.slug}/</guid>
      <description><![CDATA[${art.subtitle || ''}]]></description>
      <content:encoded><![CDATA[${art.content || art.subtitle || ''}]]></content:encoded>
      <dc:creator><![CDATA[${art.author || 'Atrium Livings Editorial Board'}]]></dc:creator>
      <pubDate>${pubDate}</pubDate>
      <category><![CDATA[${art.category}]]></category>
      <media:content url="${coverImage}" medium="image" type="image/jpeg" />
    </item>
`;
  });

  xml += `  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    }
  });
};