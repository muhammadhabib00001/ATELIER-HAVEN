import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const robots = `# Atelier Haven Robots Directive
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
# https://atelierhaven.com/llms.txt

# Sitemaps
Sitemap: https://atelierhaven.com/sitemap-index.xml
`;

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};