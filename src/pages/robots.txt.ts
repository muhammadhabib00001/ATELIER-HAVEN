import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const robots = `# Atrium Livings Robots Directive
User-agent: *
Allow: /
Disallow: /search?*

# AI & LLM Bot Directives
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

# LLM Information Endpoint
# https://atriumlivings.com/llms.txt

# Sitemaps
Sitemap: https://atriumlivings.com/sitemap-index.xml
`;

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};