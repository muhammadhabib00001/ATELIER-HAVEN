# ATRIUM LIVINGS: LOCKED EDITORIAL & SEO SYSTEM STANDARDS

These rules are permanently locked for all current and future articles across Atrium Livings. Any AI assistant or developer working on this codebase MUST follow these requirements unconditionally.

---

## 1. Editorial Voice & Zero AI Detection
* **0% AI Detection Guaranteed**: Content must read like authentic human editorial journalism with high perplexity and natural burstiness (a dynamic mix of short punchy statements and descriptive multi-clause sentences; sentence length standard deviation > 4.5).
* **Strictly Banned AI Words & Phrases**:
  NEVER use the following words or phrases in any heading or body paragraph:
  * `delve`
  * `testament`
  * `tapestry`
  * `game-changer`
  * `more than just`
  * `in conclusion`
  * `furthermore`
  * `architectural`
  * `elevate`
  * `beacon`
  * `realm`
  * `embark`
  * `meticulous`
  * `crucial`
  * `essential`
  * `seamless`
  * `nestled`
  * `whispers of`
  * `symphony`
  * `dance of`
  * `look no further`
  * `let's explore`
  * `in today's world`
* **Zero Em Dashes**: Never use em dashes (`—`) or double hyphens (`--`). Use commas, colons, parentheses, or separate sentences instead.
* **Tone**: Professional interior designer and master craftsman perspective. Practical, high-utility, search-intent-driven, high CTR, high CPC, and 100% human.

---

## 2. Word Count, Hierarchy & Layout Blueprint
* **Strict Word Count**: **1,000 to 1,200 words** total for the article body content. Never under 1,000 words; never over 1,200 words.
* **Title & SEO Title**: Strictly **55 to 60 characters** in length. Never under 55, never over 60.
* **Heading Hierarchy**:
  * `H1`: Page title (rendered by the Astro layout).
  * `H2`: Core thematic sections (NEVER contain hyphens or dashes).
  * `H3`: Subsections nested logically under H2.
  * `H4` & `H5`: Tactical details nested logically under H3.
  * Never skip heading levels. Never include hyphens or dashes in any heading or TOC title.
* **Lead Paragraph Hook**:
  * Every article must open with an immersive, narrative scene setting the tone, wrapped in: `<p class="lead-paragraph">...</p>`.
* **Featured Snippet Target**:
  * The very first H2 MUST be: `<h2 id="the-quick-formula-to-...">The Quick Formula to [Action / Outcome]</h2>`.
  * Directly below it, include a 40–60 word direct, definitive answer targeting Google's Featured Snippet box.
* **Editorial Quote Block**:
  * Every article must contain at least one editorial blockquote:
    `<div class="editorial-quote"><blockquote>...</blockquote><cite>Author Name, Title</cite></div>`.
* **Structured Reference Matrix Table**:
  * Every article must contain at least one high-utility specification / comparison table, preceded by an introductory sentence.
  * Must be wrapped in: `<div class="table-container"><table class="editorial-table">...</table></div>`.
* **FAQ Accordion Section**:
  * Include an FAQ section with exactly 3 targeted questions wrapped in:
    `<div class="faq-accordion"><div class="faq-item"><h3>Question?</h3><p><strong>Direct Bold Answer.</strong> Detailed explanation...</p></div>...</div>`.
* **Concluding Checklist**:
  * The final section must be an actionable checklist: `<h2 id="your-[slug]-checklist">Your [Topic] Checklist</h2>`.

---

## 3. Strict Linking Protocol
* **External Links**:
  * **Exactly 1 External Link** per article.
  * Must point to a high-authority, trusted, non-competing third-party resource (e.g., Sleep Foundation, Architectural Digest, Consumer Reports, standard university or medical journals).
  * Must have `target="_blank" rel="noopener noreferrer"`.
* **Internal Links**:
  * **Exactly 2 Internal Links** per article.
  * Must be 100% natural, contextual, and descriptive.
  * **ZERO 404 Policy**: Only link to articles or categories that are currently published and live on the website. If a related article is not live, link strictly to an existing category page (e.g. `/category/bedroom/`, `/category/furniture/`, `/category/kitchen/`, `/category/living-room/`) or skip. NEVER create dead or broken links.

---

## 4. Slugs, Indexation & Redirects
* **Slug Convention**: Short, clean, lowercase kebab-case, high CTR, SEO-optimized (e.g. `how-to-style-luxury-king-bed-set`).
* **301 Redirect Protection**:
  * Whenever articles are unpublished or slugs are changed, all previously indexed URLs MUST be permanently 301 redirected to `/` (homepage) or the relevant canonical URL in `astro.config.mjs` to protect Google indexation and prevent crawl errors / penalties.

---

## 5. Workflow for Every New Article
1. **Outline First**: Produce an SEO Content Strategy Outline (Primary Keyword, Secondary Keywords, Search Intent, LSI Keywords, Heading Blueprint with word allocations) and obtain user review before generating content.
2. **Draft & Validate**: Write the article and run:
   ```bash
   npm run validate
   ```
   All checks (word count, banned words, em dashes, links, tables) must pass.
3. **Build & Deploy**: Run `npm run build`, commit to git, and push to GitHub `origin/main`.

---

## 6. Locked Category Taxonomy & Semantic Accuracy Standards
* **The 12 Official Categories**: Every article must strictly belong to one of the 12 official category slugs:
  1. `kitchen` (Culinary spaces, cooking appliances, countertop gadgets, pantry storage)
  2. `bathroom` (Hydro-spatial planning, wet rooms, vanities, tiles, fixtures)
  3. `living-room` (Social gathering envelopes, hearths, fireplaces, conversational seating)
  4. `bedroom` (Restorative suites, bedding, mattresses, sleeping sanctuaries)
  5. `home-decor` (Vases, ceramics, textiles, rugs, cushions, wall art, display vignettes)
  6. `furniture` (Tectonic woodcraft, sofas, dining tables, bed frames, credenzas, chairs)
  7. `lighting` (Photometric layering, pendants, sconces, chandeliers, lamps, kelvin formulas)
  8. `renovation` (Structural overhauls, exterior painting, contractor costs, budgeting, siding)
  9. `diy` (Hands-on crafts, artisanal plaster, lime wash, furniture flipping, woodworking)
  10. `garden-outdoor` (Courtyard gardens, patios, outdoor living rooms, pergolas, landscaping)
  11. `small-spaces` (Micro apartments, pocket doors, multifunctional joinery, vertical storage)
  12. `design-trends` (Interior design forecasts, quiet luxury, biophilia, color palettes)
* **Zero Category Mismatch Policy**: An article's category MUST strictly align with its primary topic and search intent. Kitchen appliances (such as air fryers, ovens, or cooktops) must NEVER be categorized under `living-room` or any other non-culinary section.
* **Internal Category Links**: Any internal link pointing to `/category/[slug]/` must link to an existing valid category and reflect the thematic relevance of the article.
