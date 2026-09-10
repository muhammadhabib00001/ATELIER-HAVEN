import type { APIRoute } from 'astro';
import { GET as getSitemapIndex } from './sitemap-index.xml';

export const GET: APIRoute = getSitemapIndex;
