import type { APIRoute } from 'astro';
import { GET as getRssFeed } from './rss.xml';

export const GET: APIRoute = getRssFeed;
