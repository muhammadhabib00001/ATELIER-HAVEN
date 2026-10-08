import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LOCKED_CATEGORIES, normalizeCategory, detectCategoryFromKeyword } from "./scripts/fetch-keywords.js";

// Initialize Multi-Key AI Client Pool:
// Collects GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4, GEMINI_API_KEY_5, etc.
export function getAiClients() {
  const clients = [];
  const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
  const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || "us-central1";

  // 1. Gather all GEMINI_API_KEY variants from process.env
  const keyEnvVars = Object.keys(process.env).filter(k => k.startsWith('GEMINI_API_KEY')).sort();
  for (const envKey of keyEnvVars) {
    const val = process.env[envKey];
    if (val && val.trim()) {
      clients.push({
        name: envKey,
        client: new GoogleGenAI({ apiKey: val.trim() })
      });
    }
  }

  // 2. Vertex AI fallback if no direct Gemini API keys found
  if (clients.length === 0 && vertexProject) {
    clients.push({
      name: `VertexAI (${vertexProject})`,
      client: new GoogleGenAI({
        vertexAI: {
          project: vertexProject,
          location: vertexLocation
        }
      })
    });
  }

  if (clients.length === 0) {
    console.error("Error: Neither GEMINI_API_KEY nor GOOGLE_CLOUD_PROJECT (Vertex AI) is configured.");
    process.exit(1);
  }

  console.log(` Loaded ${clients.length} active AI API Key Client(s) into fallback rotation pool.`);
  return clients;
}

const articlesPath = path.resolve("./src/data/articles.json");

const articleSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, SEO-optimized title STRICTLY between 55 and 60 characters in total length, featuring the primary target keyword naturally. Never duplicate existing titles." },
    subtitle: { type: Type.STRING, description: "Engaging editorial summary (under 160 characters) that STRICTLY features the primary target keyword explicitly and naturally. Must focus entirely on the keyword topic." },
    slug: { type: Type.STRING, description: "URL friendly slug in kebab-case" },
    category: {
      type: Type.STRING,
      description: "Must strictly be one of the 12 official category slugs: kitchen, bathroom, living-room, bedroom, home-decor, furniture, lighting, renovation, diy, garden-outdoor, small-spaces, design-trends",
      enum: [
        "kitchen", "bathroom", "living-room", "bedroom", "home-decor",
        "furniture", "lighting", "renovation", "diy", "garden-outdoor",
        "small-spaces", "design-trends"
      ]
    },
    author: { type: Type.STRING, description: "Author slug, e.g., elena-vance, marcus-reid, sophia-chen" },
    readTime: { type: Type.STRING, description: "Estimated read time, e.g. '8 min read'" },
    coverAlt: { type: Type.STRING, description: "Image description and heading caption STRICTLY matching the article title." },
    imagePrompt: { type: Type.STRING, description: "High-detail architectural prompt for image generation" },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-8 high intent SEO keywords with primary keyword first"
    },
    seoTitle: { type: Type.STRING, description: "SEO Title STRICTLY between 55 and 60 characters featuring the primary target keyword" },
    seoDescription: { type: Type.STRING, description: "SEO meta description under 160 characters that STRICTLY features the primary target keyword explicitly and naturally. Must directly align with the keyword and article focus." },
    keyTakeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "4 concise, actionable takeaways"
    },
    toc: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING, description: "TOC title matching H2. NEVER include hyphens or dashes." }
        },
        required: ["id", "title"]
      },
      description: "Table of contents matching h2 IDs in the content. NEVER contain dashes or hyphens."
    },
    content: {
      type: Type.STRING,
      description: "Comprehensive, high-utility HTML article content STRICTLY between 1,050 and 1,150 words in total length. Never exceed 1,200 words. Never write under 1,000 words. Must strictly follow the locked Atrium Livings editorial blueprint identically: (1) Open with an immersive <p class=\"lead-paragraph\"> hook; (2) First <h2> MUST be 'The Quick Formula to [Action]' immediately followed by a 40-60 word Featured Snippet answer; (3) Feature 5-6 structured <h2> sections with deep nested <h3>, <h4>, and <h5> hierarchy; (4) Include at least one <div class=\"editorial-quote\"><blockquote>...</blockquote><cite>Author Name, Title</cite></div>; (5) Include a high-utility comparison/spec table inside <div class=\"table-container\"><table class=\"editorial-table\">...</table></div> preceded by an intro sentence; (6) Exactly 3 FAQ items wrapped in <div class=\"faq-accordion\"><div class=\"faq-item\"><h3>...</h3><p><strong>Direct Bold Answer.</strong> Rest of answer...</p></div></div>; (7) Conclude with an actionable checklist section <h2 id=\"your-[topic]-checklist\">Your [Topic] Checklist</h2>. CRITICAL: NEVER include hyphens or em dashes in headings or body prose, and never use banned AI words."
    }
  },
  required: [
    "title", "subtitle", "slug", "category", "author", "readTime",
    "coverAlt", "imagePrompt", "keywords", "seoTitle", "seoDescription",
    "keyTakeaways", "toc", "content"
  ]
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export async function generateArticle(topic, options = {}) {
  console.log(`\n Generating article for topic: "${topic}"...`);
  
  const systemPrompt = `You are a professional master craftsman, senior interior designer, and high-level home decor writer for "Atrium Livings".
CRITICAL REQUIREMENT: The written HTML article content MUST be STRICTLY between 1,050 and 1,150 words in total length. Never write less than 1,000 words. Never write more than 1,200 words.
Tone & Perspective: 100% human editorial voice with natural burstiness (a dynamic mix of punchy short statements and descriptive multi-clause sentences; sentence length standard deviation > 4.5). Practical, high-utility, search-intent-driven, high CTR, high CPC, and zero AI fluff.

STRICTLY BANNED WORDS & PHRASES (0 TOLERANCE):
NEVER use any of the following words or phrases in any heading, quote, table, or body paragraph:
- delve
- testament
- tapestry
- game-changer
- more than just
- in conclusion
- furthermore
- architectural
- elevate
- beacon
- realm
- embark
- meticulous
- crucial
- essential
- seamless
- nestled
- whispers of
- symphony
- dance of
- look no further
- let's explore
- in today's world

ZERO EM DASHES (0 TOLERANCE):
NEVER use em dashes (â€”) or double hyphens (--). Use commas, colons, parentheses, or separate sentences instead.

CRITICAL EDITORIAL STRUCTURE BLUEPRINT (MANDATORY FOR EVERY ARTICLE):
Every article MUST follow this exact structural architecture modeled after our benchmark guide:
1. Lead Paragraph Hook: Open with a vivid, evocative narrative scene setting the tone, wrapped in <p class="lead-paragraph">.
2. First <h2> & Featured Snippet: The very first <h2> MUST be titled "The Quick Formula to [Action / Outcome]" followed immediately by a definitive, direct 40 to 60 word answer targeting Google's Featured Snippet box.
3. Deep Heading Hierarchy: Include 5 to 6 dedicated <h2> sections. Under thematic sections, provide deep nested hierarchy (e.g. <h2> -> <h3> -> <h4> -> <h5>). Never skip heading levels. NEVER use hyphens or dashes in any heading.
4. Editorial Quote Block: Include at least one high-authority editorial quote block:
   <div class="editorial-quote">
     <blockquote>A compelling interior installation balances tactile material layers with calm room proportions and soft ambient lighting.</blockquote>
     <cite>Sarah Mitchell, Senior Interior Editor</cite>
   </div>
5. Structured Reference Matrix Table: Include at least one high-utility specification or clearance matrix table, preceded by an introductory sentence, wrapped in:
   <div class="table-container">
     <table class="editorial-table">
       <thead><tr><th>Component / Area</th><th>Recommended Specification</th><th>Practical Application Rule</th></tr></thead>
       <tbody>...</tbody>
     </table>
   </div>
6. FAQ Accordion: Conclude the core discussion with exactly 3 targeted questions using <h3> and bolded direct answers, wrapped in:
   <div class="faq-accordion">
     <div class="faq-item"><h3>Question 1?</h3><p><strong>Direct definitive answer in bold.</strong> Detailed practical explanation...</p></div>
     <div class="faq-item"><h3>Question 2?</h3><p><strong>Direct definitive answer in bold.</strong> Detailed practical explanation...</p></div>
     <div class="faq-item"><h3>Question 3?</h3><p><strong>Direct definitive answer in bold.</strong> Detailed practical explanation...</p></div>
   </div>
7. Concluding Checklist: The final section MUST be an actionable checklist heading: <h2 id="your-[topic]-checklist">Your [Topic] Checklist</h2> providing 3 to 4 clear, practical takeaways.

CRITICAL SEO RULES:
- Primary Target Keyword: MUST be explicitly and prominently featured in:
  * Article Headline (title)
  * Meta Title (seoTitle)
  * Article Summary Subtitle (subtitle)
  * Meta Description (seoDescription): within the first 100 characters (max 160 chars total)
  * Cover Image Description (coverAlt): matches title exactly
- Title and seoTitle: MUST BE STRICTLY BETWEEN 55 AND 60 CHARACTERS IN TOTAL LENGTH.
- Total Word Count: STRICTLY 1,050 to 1,150 words.`;

  const aiClients = getAiClients();
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
  ];
  let response = null;

  // Iterate across available API Key Clients
  for (const clientObj of aiClients) {
    console.log(` Using API Key: [${clientObj.name}]`);
    const ai = clientObj.client;

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(` Attempting with model: ${modelName} (attempt ${attempt})...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: `Write an exhaustive, high-utility home design guide about: "${topic}". Category: ${options.category || "lighting"}. You MUST provide at least 5 to 6 dedicated <h2> sections with 2 to 3 substantive paragraphs each, an editorial table, and 3 detailed FAQ answers to reach between 1,050 and 1,150 total words. Do not write brief summaries. Output strictly in JSON.`,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: "application/json",
              responseSchema: articleSchema
            }
          });
          if (response && response.text) break;
        } catch (err) {
          console.warn(` [${clientObj.name}] ${modelName} attempt ${attempt} issue: ${err.message}`);
          
          // If rate limited or quota exceeded, switch key or retry
          if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("Quota exceeded")) {
            console.warn(` Rate limit / Quota reached for ${clientObj.name}. Switching to next API key...`);
            break; // Break model loop to switch client key
          }

          if (err.message.includes("503") || err.message.includes("500") || err.message.includes("INTERNAL") || err.message.includes("high demand") || err.message.includes("UNAVAILABLE")) {
            console.log(" Waiting 4 seconds before retry...");
            await delay(4000);
          } else {
            break; // For 404 or unsupported models, immediately try next model
          }
        }
      }
      if (response && response.text) break;
    }
    if (response && response.text) break;
  }

  if (!response || !response.text) {
    throw new Error("Unable to complete generation with available API Keys and models. Please check API credentials and retry.");
  }

  const generated = JSON.parse(response.text);
  const now = new Date().toISOString();

  let existingArticlesList = [];
  if (fs.existsSync(articlesPath)) {
    try {
      existingArticlesList = JSON.parse(fs.readFileSync(articlesPath, "utf-8"));
    } catch (e) {}
  }

  let coverImageUrl = options.customImage || "";
  if (!coverImageUrl) {
    coverImageUrl = await tryGenerateImage(generated.imagePrompt, generated.slug, generated.keywords, generated.category, existingArticlesList);
  }

  // Fetch 1-2 unique keyword-aligned body images ensuring strictly NO duplicates
  const extraUsed = new Set([coverImageUrl]);
  const bodyImages = await fetchArticleBodyImages(generated.keywords, generated.category, 2, existingArticlesList, extraUsed);
  
  let finalContent = generated.content;
  if (bodyImages.length > 0) {
    // Insert into content after 2nd and 4th H2 sections
    const h2Regex = /(<h2[^>]*>[\s\S]*?<\/h2>)/gi;
    const parts = finalContent.split(h2Regex);
    const primaryKw = (generated.keywords && generated.keywords[0]) ? generated.keywords[0] : generated.title;

    if (bodyImages[0] && parts.length >= 5) {
      const fig1 = `\n<figure class="editorial-figure"><img src="${bodyImages[0].url}" alt="${bodyImages[0].alt}" loading="lazy" width="1200" height="700" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" /><figcaption><strong>${primaryKw} Architectural Focus:</strong> ${bodyImages[0].caption}</figcaption></figure>\n`;
      parts[4] = fig1 + parts[4];
    }
    if (bodyImages[1]) {
      const fig2 = `\n<figure class="editorial-figure"><img src="${bodyImages[1].url}" alt="${bodyImages[1].alt}" loading="lazy" width="1200" height="700" crossorigin="anonymous" referrerpolicy="no-referrer-when-downgrade" /><figcaption><strong>${primaryKw} Detail View:</strong> ${bodyImages[1].caption}</figcaption></figure>\n`;
      if (parts.length >= 9) {
        parts[8] = fig2 + parts[8];
      } else if (parts.length >= 7) {
        parts[6] = fig2 + parts[6];
      }
    }
    finalContent = parts.join('');
  }

  const article = {
    slug: generated.slug,
    title: generated.title,
    subtitle: generated.subtitle,
    category: generated.category.toLowerCase(),
    author: generated.author,
    publishedAt: now,
    updatedAt: now,
    readTime: generated.readTime,
    featured: options.featured ?? false,
    trending: options.trending ?? false,
    coverImage: coverImageUrl,
    coverAlt: generated.coverAlt,
    keywords: generated.keywords,
    seoTitle: generated.seoTitle.includes("Atrium Livings") ? generated.seoTitle : `${generated.seoTitle} | Atrium Livings`,
    seoDescription: generated.seoDescription,
    keyTakeaways: generated.keyTakeaways,
    toc: generated.toc,
    content: finalContent
  };

  return article;
}

// Helper to extract ALL image URLs used across the entire site (both coverImage and in-content figures)
export function getAllUsedImageUrls(existingArticles = []) {
  const used = new Set();
  for (const art of existingArticles) {
    if (art.coverImage) used.add(art.coverImage);
    if (art.content) {
      const imgMatches = [...art.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
      for (const m of imgMatches) {
        used.add(m[1]);
      }
    }
  }
  return used;
}

// Helper to extract a normalized unique photo key from any image URL or ID
function extractImageKey(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  // Match standard Unsplash photo pattern: photo-1234567890-abcdef
  const photoMatch = urlOrId.match(/photo-[a-zA-Z0-9-]+/i);
  if (photoMatch) return photoMatch[0].toLowerCase();
  // Strip URL query parameters and hashes
  const clean = urlOrId.split('?')[0].split('#')[0].trim().toLowerCase();
  return clean;
}

// Check if an image URL matches any existing used image (by full URL, photo ID, or key)
function isImageAlreadyUsed(urlOrId, usedImagesSet) {
  if (!urlOrId) return false;
  const targetKey = extractImageKey(urlOrId);
  const targetStr = String(urlOrId).toLowerCase();

  for (const used of usedImagesSet) {
    if (!used) continue;
    const usedStr = String(used).toLowerCase();
    // Direct string match or containment
    if (usedStr === targetStr || usedStr.includes(targetStr) || targetStr.includes(usedStr)) {
      return true;
    }
    // Match by normalized photo key
    const usedKey = extractImageKey(used);
    if (targetKey && usedKey && targetKey === usedKey) {
      return true;
    }
  }
  return false;
}

export async function fetchUnsplashImage(keywords, category, existingArticles = [], extraUsedSet = new Set()) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const usedImages = new Set([...getAllUsedImageUrls(existingArticles), ...extraUsedSet]);

  try {
    const primaryKw = (keywords?.[0] || "").trim();
    let enrichedTerm = primaryKw;
    if (primaryKw.toLowerCase().includes('baÃ±o') || primaryKw.toLowerCase().includes('bano')) {
      enrichedTerm = 'modern luxury bathroom architecture';
    }

    const searchTerms = [
      `${enrichedTerm} interior design`,
      `${primaryKw} interior`,
      `${category} modern luxury architectural design`,
      `${category} interior architecture`,
      'modern luxury architectural interior'
    ].filter(Boolean);

    for (const term of searchTerms) {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=20&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}` }
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const unusedPhoto = data.results.find(p => {
          const rawUrl = p.urls.raw || p.urls.regular;
          return !isImageAlreadyUsed(p.id, usedImages) && !isImageAlreadyUsed(rawUrl, usedImages);
        });

        if (unusedPhoto) {
          const imageUrl = `${unusedPhoto.urls.raw || unusedPhoto.urls.regular}&auto=format&fit=crop&w=1400&q=85`;
          console.log(` Retrieved unique Unsplash photo (${unusedPhoto.id}) by ${unusedPhoto.user.name}: ${imageUrl}`);
          return imageUrl;
        }
      }
    }
  } catch (err) {
    console.warn(" Unsplash fetch error:", err.message);
  }
  return null;
}

export async function fetchArticleBodyImages(keywords, category, count = 2, existingArticles = [], extraUsedSet = new Set()) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const primaryKw = (keywords?.[0] || "").trim();
  const secondaryKw = (keywords?.[1] || "").trim();
  const usedImages = new Set([...getAllUsedImageUrls(existingArticles), ...extraUsedSet]);
  const results = [];

  const queries = [
    `${primaryKw} architectural detail`,
    `${primaryKw} modern luxury interior`,
    `${secondaryKw || primaryKw} luxury design`,
    `${category} interior architecture styling`,
    `${category} modern luxury details`
  ];

  if (!accessKey) return results;

  for (const query of queries) {
    if (results.length >= count) break;
    try {
      let cleanQuery = query;
      if (cleanQuery.toLowerCase().includes('baÃ±o') || cleanQuery.toLowerCase().includes('bano')) {
        cleanQuery = cleanQuery.replace(/baÃ±o/gi, 'bathroom').replace(/bano/gi, 'bathroom');
      }

      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleanQuery)}&per_page=15&orientation=landscape&content_filter=high`;
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });
      if (!res.ok) continue;

      const data = await res.json();
      const photo = (data.results || []).find(p => {
        const rawUrl = p.urls.raw || p.urls.regular;
        return !isImageAlreadyUsed(p.id, usedImages) && !isImageAlreadyUsed(rawUrl, usedImages);
      });

      if (photo) {
        const imgUrl = `${photo.urls.raw || photo.urls.regular}&auto=format&fit=crop&w=1200&q=85`;
        usedImages.add(photo.id);
        usedImages.add(imgUrl);
        results.push({
          url: imgUrl,
          alt: `${primaryKw} - ${(photo.alt_description || photo.description || primaryKw).replace(/"/g, '')}`,
          caption: `${primaryKw}: Architectural detailing and spatial materiality curated for modern luxury residences.`
        });
      }
    } catch (e) {
      console.warn(" Body image fetch error:", e.message);
    }
  }

  return results;
}

async function tryGenerateImage(prompt, slug, keywords = [], category = "interior-design", existingArticles = []) {
  const unsplashUrl = await fetchUnsplashImage(keywords, category, existingArticles);
  if (unsplashUrl) {
    return unsplashUrl;
  }

  console.log(` Attempting AI image generation for prompt: "${prompt}"...`);
  const imageModels = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];
  
  for (const model of imageModels) {
    try {
      const imgRes = await ai.models.generateContent({
        model,
        contents: prompt
      });

      const parts = imgRes.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const ext = part.inlineData.mimeType.includes("png") ? "png" : "jpg";
          const relativePath = `/images/generated/${slug}.${ext}`;
          const fullPath = path.resolve(`./public${relativePath}`);
          
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, Buffer.from(part.inlineData.data, "base64"));
          console.log(` Saved AI generated image to: ${relativePath}`);
          return relativePath;
        }
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  console.log(" Assigning unique fallback luxury architectural image.");
  const usedImages = new Set(existingArticles.map(a => a.coverImage).filter(Boolean));
  const fallbackCurated = [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=85"
  ];
  for (const img of fallbackCurated) {
    if (!usedImages.has(img)) {
      return img;
    }
  }
  return `https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85&sig=${Date.now()}`;
}

export function enforceArticleStandards(article, existingArticles = []) {
  // 0. Ensure Category is Strictly One of 12 Locked Categories and Semantically Aligned
  let assignedCat = normalizeCategory(article.category);
  const detectedCat = detectCategoryFromKeyword((article.title || '') + ' ' + (article.keywords || []).join(' '));

  if (!assignedCat || !LOCKED_CATEGORIES.includes(assignedCat)) {
    assignedCat = detectedCat || 'home-decor';
  } else if (detectedCat && assignedCat !== detectedCat) {
    const kwText = ((article.title || '') + ' ' + (article.keywords || []).join(' ')).toLowerCase();
    const isSpecializedTopic = kwText.includes('kitchen') || kwText.includes('air fryer') || kwText.includes('fryer') || kwText.includes('cook') ||
      kwText.includes('bathroom') || kwText.includes('shower') || kwText.includes('toilet') ||
      kwText.includes('bed') || kwText.includes('mattress') || kwText.includes('patio') ||
      kwText.includes('courtyard') || kwText.includes('garden') || kwText.includes('painting cost') ||
      kwText.includes('renovation') || kwText.includes('lighting') || kwText.includes('chandelier');

    if (isSpecializedTopic && assignedCat !== detectedCat) {
      console.log(` Correcting mismatched category "${assignedCat}" -> "${detectedCat}" for topic "${article.title}"`);
      assignedCat = detectedCat;
    }
  }
  article.category = assignedCat;

  const existingHeadingTexts = new Set();
  existingArticles.forEach(a => {
    if (a.slug === article.slug) return;
    const matches = [...a.content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
    matches.forEach(m => existingHeadingTexts.add(m[2].replace(/<[^>]+>/g, '').trim().toLowerCase()));
  });

  // Helper: Remove all em dashes, en dashes, and double hyphens
  const cleanEmDashes = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
      .replace(/[\u2014\u2013—–]/g, ', ')
      .replace(/â€”/g, ', ')
      .replace(/&mdash;/g, ', ')
      .replace(/&ndash;/g, ', ')
      .replace(/\s+--\s+/g, ', ')
      .replace(/--/g, '-');
  };

  // Helper: Replace all banned AI words and inflections
  const BANNED_MAP = [
    { regex: /\barchitectural(?:ly)?\b/gi, replaceWith: 'structural' },
    { regex: /\belevat(?:e|es|ed|ing|ion)\b/gi, replaceWith: 'enhance' },
    { regex: /\brealms?\b/gi, replaceWith: 'space' },
    { regex: /\bmeticulous(?:ly|ness)?\b/gi, replaceWith: 'thorough' },
    { regex: /\bcrucial(?:ly)?\b/gi, replaceWith: 'important' },
    { regex: /\bessential(?:ly|s)?\b/gi, replaceWith: 'recommended' },
    { regex: /\bseamless(?:ly|ness)?\b/gi, replaceWith: 'smooth' },
    { regex: /\bnestl(?:e|es|ed|ing)\b/gi, replaceWith: 'positioned' },
    { regex: /\bgame[- ]?changers?\b/gi, replaceWith: 'major breakthrough' },
    { regex: /\btestaments?\b/gi, replaceWith: 'proof' },
    { regex: /\bdelv(?:e|es|ed|ing)\b/gi, replaceWith: 'explore' },
    { regex: /\btapestr(?:y|ies)\b/gi, replaceWith: 'blend' },
    { regex: /\bmore than just\b/gi, replaceWith: 'beyond' },
    { regex: /\bin conclusion\b/gi, replaceWith: 'in summary' },
    { regex: /\bfurthermore\b/gi, replaceWith: 'in addition' },
    { regex: /\bwhispers of\b/gi, replaceWith: 'hints of' },
    { regex: /\bsymphon(?:y|ies)\b/gi, replaceWith: 'combination' },
    { regex: /\bdance of\b/gi, replaceWith: 'balance of' },
    { regex: /\blook no further\b/gi, replaceWith: 'consider this' },
    { regex: /\blet's explore\b/gi, replaceWith: 'we examine' },
    { regex: /\bin today's world\b/gi, replaceWith: 'today' },
    { regex: /\bbeacons?\b/gi, replaceWith: 'benchmark' },
    { regex: /\bembark(?:s|ed|ing)?\b/gi, replaceWith: 'begin' }
  ];

  const purgeBanned = (str) => {
    if (!str || typeof str !== 'string') return str;
    let res = str.replace(/Architectural\s+Digest/gi, 'Elle Decor');
    for (const item of BANNED_MAP) {
      res = res.replace(item.regex, item.replaceWith);
    }
    return res;
  };

  // Helper to format title strictly between 55 and 60 characters
  const formatTitle = (rawTitle) => {
    let t = purgeBanned(cleanEmDashes(rawTitle || ''))
      .replace(/[-—–]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (t.length >= 55 && t.length <= 60) return t;

    if (t.length > 60) {
      const words = t.split(' ');
      let candidate = '';
      for (const w of words) {
        const next = candidate ? candidate + ' ' + w : w;
        if (next.length <= 60) candidate = next;
        else break;
      }
      t = candidate || t.slice(0, 60).trim();
    }

    if (t.length < 55) {
      const padOptions = [
        ' Master Guide', ' Complete Guide', ' Practical Guide',
        ' Design Guide', ' Editorial Plan', ' Master Plan',
        ' Home Guide', ' Guide', ' Plan'
      ];
      for (const pad of padOptions) {
        if (!t.toLowerCase().includes(pad.trim().toLowerCase()) && (t + pad).length >= 55 && (t + pad).length <= 60) {
          t = t + pad;
          break;
        }
      }
      while (t.length < 55) {
        if ((t + ' Guide').length <= 60) t += ' Guide';
        else if ((t + ' Plan').length <= 60) t += ' Plan';
        else if ((t + ' Home').length <= 60) t += ' Home';
        else t += '.';
      }
      if (t.length > 60) {
        t = t.slice(0, 60).trim();
        while (t.length < 55) t += '.';
      }
    }
    return t;
  };

  article.title = formatTitle(article.title);
  article.seoTitle = article.title;
  article.coverAlt = article.title;

  article.content = purgeBanned(cleanEmDashes(article.content));
  article.subtitle = purgeBanned(cleanEmDashes(article.subtitle || ''));
  article.seoDescription = purgeBanned(cleanEmDashes(article.seoDescription || ''));

  const shortTitle = article.title.split(':')[0].replace(/[-—–]/g, ' ').trim();
  const primaryKeyword = (article.keywords && article.keywords[0]) ? article.keywords[0].trim() : shortTitle;
  const primaryKwLower = primaryKeyword.toLowerCase();

  let subtitle = article.subtitle;
  if (!subtitle.toLowerCase().includes(primaryKwLower)) {
    subtitle = `${primaryKeyword}: ${subtitle}`;
  }
  if (subtitle.length > 160) {
    const truncated = subtitle.slice(0, 157);
    const lastSp = truncated.lastIndexOf(' ');
    subtitle = (lastSp > 120 ? truncated.slice(0, lastSp) : truncated) + '...';
  }
  article.subtitle = subtitle;

  let seoDescription = article.seoDescription;
  if (!seoDescription.toLowerCase().includes(primaryKwLower)) {
    seoDescription = `Comprehensive design guide to ${primaryKeyword}: explore spatial layouts, material recommendations, and practical styling solutions.`;
  }
  if (seoDescription.length > 160) {
    const truncated = seoDescription.slice(0, 157);
    const lastSp = truncated.lastIndexOf(' ');
    seoDescription = (lastSp > 120 ? truncated.slice(0, lastSp) : truncated) + '...';
  }
  article.seoDescription = seoDescription;

  // 6A. Ensure Lead Paragraph class is applied to first <p>
  if (!article.content.includes('class="lead-paragraph"')) {
    article.content = article.content.replace(/<p>/i, '<p class="lead-paragraph">');
  }

  // 6B. Ensure First H2 is 'The Quick Formula to...' with a 40-60 word Featured Snippet answer
  const hasFormulaH2 = /<h2[^>]*id=["'][^"']*quick-formula[^"']*["'][^>]*>/i.test(article.content) || /<h2[^>]*>The Quick Formula/i.test(article.content);
  if (!hasFormulaH2) {
    const formulaId = `the-quick-formula-to-master-${article.slug.replace(/[^a-z0-9]+/g, '-')}`;
    const formulaH2 = `\n<h2 id="${formulaId}">The Quick Formula to Master ${shortTitle}</h2>\n<p>To succeed with ${primaryKeyword}, balance primary dimensions, allow generous walkway clearances, and select durable materials with low-sheen finishes. Layer complementary textures across functional zones, eliminate clutter from visible surfaces, and coordinate warm 2700K lighting to establish immediate visual depth and lasting everyday comfort.</p>\n`;
    
    const firstPEnd = article.content.indexOf('</p>');
    if (firstPEnd !== -1) {
      article.content = article.content.slice(0, firstPEnd + 4) + '\n' + formulaH2 + article.content.slice(firstPEnd + 4);
    } else {
      article.content = formulaH2 + article.content;
    }
  }

  // 6C. Ensure Editorial Quote Block is present
  if (!article.content.includes('editorial-quote')) {
    const quoteHtml = `\n<div class="editorial-quote">\n  <blockquote>A successful master plan balances tactile material layers with calm room proportions and soft ambient lighting.</blockquote>\n  <cite>Sarah Mitchell, Senior Interior Editor</cite>\n</div>\n`;
    const pMatches = [...article.content.matchAll(/<\/p>/g)];
    if (pMatches.length >= 4) {
      const insertAt = pMatches[3].index;
      article.content = article.content.slice(0, insertAt) + quoteHtml + article.content.slice(insertAt);
    }
  }

  // 6D. Ensure Editorial Table is present
  const hasTable = article.content.includes('<table') && article.content.includes('editorial-table') && article.content.includes('table-container');
  if (!hasTable) {
    const tableHtml = `\n<div class="table-container">\n  <table class="editorial-table">\n    <thead>\n      <tr>\n        <th>Design Element</th>\n        <th>Recommended Specification</th>\n        <th>Practical Application</th>\n      </tr>\n    </thead>\n    <tbody>\n      <tr>\n        <td><strong>Clearance Spacing</strong></td>\n        <td>36 inches clear perimeter</td>\n        <td>Maintain comfortable walking paths around all furniture.</td>\n      </tr>\n      <tr>\n        <td><strong>Surface Material</strong></td>\n        <td>Satin or low-sheen finish</td>\n        <td>Provides durable protection with easy maintenance.</td>\n      </tr>\n      <tr>\n        <td><strong>Lighting Warmth</strong></td>\n        <td>2700K to 3000K warm LED</td>\n        <td>Accentuates natural tones without glare.</td>\n      </tr>\n      <tr>\n        <td><strong>Room Proportion</strong></td>\n        <td>60-30-10 distribution rule</td>\n        <td>Balances dominant tones with secondary accents.</td>\n      </tr>\n    </tbody>\n  </table>\n</div>\n`;

    const faqIdx = article.content.search(/<h2[^>]*id=["'][^"']*faq[^"']*["'][^>]*>/i);
    if (faqIdx !== -1) {
      article.content = article.content.slice(0, faqIdx) + tableHtml + article.content.slice(faqIdx);
    } else {
      const lastH2 = article.content.lastIndexOf('<h2');
      if (lastH2 !== -1) {
        article.content = article.content.slice(0, lastH2) + tableHtml + article.content.slice(lastH2);
      } else {
        article.content += tableHtml;
      }
    }
  }

  // 6E. Ensure FAQ Accordion with exactly 3 complete items
  const uniqueFaqId = `faq-${article.slug}`;
  const uniqueFaqHeading = `${shortTitle} Frequently Asked Questions`.replace(/[-—–]/g, ' ');
  const defaultFaqs = [
    {
      q: `What is the most important factor when planning ${shortTitle.toLowerCase()}?`,
      a: `<strong>Maintaining balanced proportions and clear transit clearances is the primary priority.</strong> Preserving open walking buffers ensures that beautiful finishes and fine materials remain functional and comfortable for everyday use.`
    },
    {
      q: `How do you ensure long term durability for ${shortTitle.toLowerCase()}?`,
      a: `<strong>Select high density natural materials and clean with pH neutral solutions.</strong> Avoiding harsh abrasive chemical sprays protects factory protective coatings and preserves natural surface patinas over decades.`
    },
    {
      q: `What lighting warmth best complements ${shortTitle.toLowerCase()}?`,
      a: `<strong>Warm LED illumination between 2700K and 3000K yields the best results.</strong> Soft, warm light flatters natural wood grains and textured textiles without producing harsh glare or unflattering shadows.`
    }
  ];

  if (!article.content.includes('faq-accordion')) {
    let items = '';
    for (let i = 0; i < 3; i++) {
      items += `  <div class="faq-item">\n    <h3>${defaultFaqs[i].q}</h3>\n    <p>${defaultFaqs[i].a}</p>\n  </div>\n`;
    }
    const faqSection = `\n<h2 id="${uniqueFaqId}">${uniqueFaqHeading}</h2>\n<div class="faq-accordion">\n${items}</div>\n`;
    const checklistIdx = article.content.search(/<h2[^>]*id=["'][^"']*checklist[^"']*["'][^>]*>/i);
    if (checklistIdx !== -1) {
      article.content = article.content.slice(0, checklistIdx) + faqSection + article.content.slice(checklistIdx);
    } else {
      article.content += faqSection;
    }
  }

  // Ensure all existing faq-items have both h3 and complete p with bold answer
  article.content = article.content.replace(/<div class=["']faq-item["']>([\s\S]*?)<\/div>/gi, (itemHtml, inner) => {
    let qMatch = inner.match(/<h3>([\s\S]*?)<\/h3>/i);
    let qText = qMatch ? qMatch[1].replace(/<[^>]+>/g, '').replace(/[-—–]/g, ' ').trim() : `Planning ${shortTitle}`;
    let pMatch = inner.match(/<p>([\s\S]*?)<\/p>/i);
    let ansText = pMatch ? pMatch[1].trim() : '';

    if (!ansText || ansText.length < 20) {
      ansText = `<strong>Careful dimension planning and high density material selection are recommended.</strong> Prioritizing clear walkway clearances ensures that daily routines remain comfortable and visually cohesive.`;
    } else if (!ansText.startsWith('<strong>')) {
      const firstDot = ansText.indexOf('.');
      if (firstDot !== -1 && firstDot < 120) {
        ansText = `<strong>${ansText.slice(0, firstDot + 1)}</strong> ${ansText.slice(firstDot + 1).trim()}`;
      } else {
        ansText = `<strong>${ansText.slice(0, 40)}...</strong> ${ansText}`;
      }
    }
    return `  <div class="faq-item">\n    <h3>${qText}</h3>\n    <p>${ansText}</p>\n  </div>\n`;
  });

  // Ensure exactly 3 faq-items
  const faqItemsCount = (article.content.match(/class=["']faq-item["']/g) || []).length;
  if (faqItemsCount < 3) {
    let extraItems = '';
    for (let i = faqItemsCount; i < 3; i++) {
      extraItems += `  <div class="faq-item">\n    <h3>${defaultFaqs[i].q}</h3>\n    <p>${defaultFaqs[i].a}</p>\n  </div>\n`;
    }
    article.content = article.content.replace(/(<div class=["']faq-accordion["']>[\s\S]*?)(<\/div>)/i, `$1${extraItems}$2`);
  }

  // 6F. Ensure Final Section is an Actionable Checklist
  const allH2Matches = [...article.content.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi)];
  const lastH2Match = allH2Matches[allH2Matches.length - 1];
  if (!lastH2Match || !lastH2Match[2].toLowerCase().includes('checklist')) {
    const checklistId = `your-${article.slug}-checklist`;
    const checklistHeading = `Your ${shortTitle} Checklist`.replace(/[-—–]/g, ' ');
    const checklistHtml = `\n<h2 id="${checklistId}">${checklistHeading}</h2>\n<p>Executing a successful ${shortTitle.toLowerCase()} installation comes down to preparation and disciplined execution. Review walkway clearances, verify lighting warmths, and invest in resilient natural materials that provide lasting beauty across your home.</p>\n`;
    article.content += checklistHtml;
  }

  // 7. Ensure EXACTLY 1 External Link
  const extRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const extMatches = [...article.content.matchAll(extRegex)];
  if (extMatches.length === 0) {
    const domainPool = [
      { name: "Sleep Foundation", url: "https://www.sleepfoundation.org" },
      { name: "Elle Decor", url: "https://www.elledecor.com" },
      { name: "American Society of Interior Designers", url: "https://www.asid.org" },
      { name: "Consumer Reports", url: "https://www.consumerreports.org" },
      { name: "Dwell", url: "https://www.dwell.com" }
    ];
    const chosen = domainPool[existingArticles.length % domainPool.length];
    const pMatches = [...article.content.matchAll(/<\/p>/g)];
    if (pMatches.length >= 2) {
      const insertAt = pMatches[1].index;
      article.content = article.content.slice(0, insertAt) +
        ` Industry recommendations from <a href="${chosen.url}" target="_blank" rel="noopener noreferrer">${chosen.name}</a> suggest testing material samples before full installation.` +
        article.content.slice(insertAt);
    }
  } else {
    // Keep first, strip subsequent
    let firstExtFound = false;
    article.content = article.content.replace(extRegex, (fullTag, url, anchorText) => {
      if (!firstExtFound) {
        firstExtFound = true;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${anchorText}</a>`;
      }
      return anchorText;
    });
  }

  // 8. Ensure EXACTLY 2 Natural Internal Links
  const intRegex = /<a\s+[^>]*href=["'](\/(?!https?)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const intMatches = [...article.content.matchAll(intRegex)];
  if (intMatches.length > 2) {
    let intCount = 0;
    article.content = article.content.replace(intRegex, (fullTag, path, anchorText) => {
      intCount++;
      if (intCount <= 2) return fullTag;
      return anchorText;
    });
  } else if (intMatches.length < 2) {
    const targetCategory = article.category || 'bedroom';
    const fallbackOptions = [
      { url: `/category/${targetCategory}/`, text: `${targetCategory} decorating ideas` },
      { url: `/category/furniture/`, text: `furniture layout principles` }
    ];
    if (existingArticles.length > 0 && existingArticles[0].slug !== article.slug) {
      fallbackOptions.unshift({
        url: `/${existingArticles[0].slug}/`,
        text: existingArticles[0].title.split(':')[0].toLowerCase().replace(/[-—–]/g, ' ')
      });
    }

    let pMatches = [...article.content.matchAll(/<\/p>/g)];
    let currentIntCount = intMatches.length;
    for (const opt of fallbackOptions) {
      if (currentIntCount >= 2) break;
      if (article.content.includes(`href="${opt.url}"`)) continue;
      const targetPIdx = pMatches.length > (3 + currentIntCount)
        ? pMatches[2 + currentIntCount].index
        : (pMatches.length > 1 ? pMatches[1].index : -1);

      if (targetPIdx !== -1) {
        article.content = article.content.slice(0, targetPIdx) +
          ` For more ideas, explore our <a href="${opt.url}">${opt.text}</a>.` +
          article.content.slice(targetPIdx);
        currentIntCount++;
        pMatches = [...article.content.matchAll(/<\/p>/g)];
      }
    }
  }

  // 9. Mathematically Guaranteed Word Count: STRICTLY 1,000 to 1,200 words
  const calcWords = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  let currentWords = calcWords(article.content);

  const topicTitle = purgeBanned(cleanEmDashes(article.title.split(':')[0].trim())).replace(/[-—–]/g, ' ');
  const primaryKw = (article.keywords && article.keywords[0]) ? article.keywords[0].replace(/[-—–]/g, ' ') : topicTitle;

  const expansionModules = [
    {
      heading: `Quality Standards and Material Selection for ${topicTitle}`,
      body: `<p>Selecting durable materials is fundamental when planning ${primaryKw}. High-traffic areas demand surfaces with proven resistance to surface wear, moisture exposure, and daily thermal fluctuations. For solid timber installations, prioritize kiln-dried hardwoods with tight grain structures that resist warping. When specifying metal fixtures, solid brass, forged bronze, or marine-grade 316 stainless steel ensure that protective coatings do not chip or corrode over time.</p>\n<p>Finishes also dictate how light interacts with surfaces throughout the day. Low-sheen finishes such as satin, matte, or eggshell soften harsh light reflections and disguise minor surface imperfections. Conversely, high-gloss accents should be reserved for targeted focal points where focused illumination brings out depth without overwhelming the rest of the room.</p>`
    },
    {
      heading: `Spatial Clearances and Installation Tolerances`,
      body: `<p>Proper spacing prevents beautiful designs from feeling cramped or unapproachable. When integrating ${topicTitle}, always maintain comfortable transit corridors of at least 36 to 42 inches between major furniture pieces and adjacent walls. This generous walkway clearance ensures smooth movement, accessible cleaning paths, and unobstructed door swings across the entire room layout.</p>\n<p>Vertical proportions require equal attention. Verify ceiling clearances and suspension heights before securing permanent electrical or structural anchors. Centering statement fixtures relative to primary sightlines from doorways creates an immediate sense of order and visual balance the moment you enter the space.</p>`
    },
    {
      heading: `Preventative Maintenance and Long Term Care Guidelines`,
      body: `<p>Even the finest home installations require systematic upkeep to retain their original appeal. Avoid abrasive chemical cleansers or ammonia-based sprays that can strip protective lacquers and dull natural patinas. Instead, adopt a routine of wiping surfaces with a soft, lint-free microfiber cloth dampened with warm water and mild, pH-neutral soap.</p>\n<p>Periodically inspect mounting hardware, electrical connections, and perimeter seals every twelve months. Addressing minor settling, loose fasteners, or hairline seal separations early preserves the structural integrity of your installation and eliminates costly repairs down the road.</p>`
    },
    {
      heading: `Functional Zoning and Spatial Lighting Coordination`,
      body: `<p>A cohesive master plan balances direct ambient coverage with dedicated accent highlights. Dividing open floor plans into distinct functional zones prevents visual clutter and allows for customized light levels suited to different daily activities. Dimmable circuits provide the flexibility to transition smoothly from bright midday productivity to relaxed evening unwinding.</p>\n<p>Layering decorative wall sconces with low-glare ceiling fixtures creates spatial depth that flatters interior details and premium materials. Positioning fixtures at varying heights draws the eye through the room, making compact areas feel notably more spacious and open.</p>`
    },
    {
      heading: `Energy Efficiency and Smart Control Integration`,
      body: `<p>Modern interior planning pairs timeless aesthetics with smart operational efficiency. High-efficiency LED systems operating at 90+ Color Rendering Index (CRI) accurately render warm wood grains, soft textiles, and custom wall paints without consuming unnecessary power or generating excess ambient heat.</p>\n<p>Integrating programmable wall controllers allows homeowners to establish custom scenes with one-touch convenience. Scheduling automated evening dimming cycles also supports natural circadian rhythms, improving sleep quality while lowering seasonal utility consumption.</p>`
    }
  ];

  // Progressive Expansion Loop if under 1,000 words
  if (currentWords < 1000) {
    for (const mod of expansionModules) {
      if (currentWords >= 1060) break;
      const cleanHeading = mod.heading.replace(/[-—–]/g, ' ').trim();
      const blockHtml = `\n<h2 id="${cleanHeading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${cleanHeading}</h2>\n${mod.body}\n`;
      const faqIdx = article.content.search(/<h2[^>]*id=["'][^"']*faq[^"']*["'][^>]*>/i);
      if (faqIdx !== -1) {
        article.content = article.content.slice(0, faqIdx) + blockHtml + article.content.slice(faqIdx);
      } else {
        const lastH2 = article.content.lastIndexOf('<h2');
        if (lastH2 !== -1) {
          article.content = article.content.slice(0, lastH2) + blockHtml + article.content.slice(lastH2);
        } else {
          article.content += blockHtml;
        }
      }
      currentWords = calcWords(article.content);
    }
  }

  // Micro-Sentence Top-Up if still below 1,040 words
  const microTips = [
    `Establishing dedicated task lighting zones ensures balanced illumination for reading, cooking, or focused workspace routines.`,
    `Verifying rough-in plumbing and electrical junction box specifications prior to closing drywall eliminates unexpected modification costs.`,
    `Selecting sustainable, low-emission materials supports healthy indoor air quality throughout modern residential environments.`,
    `Coordinating hardware finishes across adjacent rooms creates subtle visual continuity that ties the entire floor plan together.`,
    `Testing physical finish swatches in morning and evening sunlight reveals true undertones before committing to full paint purchases.`,
    `Maintaining balanced proportions between furniture silhouettes and open floor space prevents rooms from feeling crowded or heavy.`,
    `Incorporating soft acoustic surfaces like plush area rugs and linen drapes tempers unwanted room echoes and promotes calm relaxation.`,
    `Investing in quality foundation joinery and solid core interior doors provides lasting durability that endures daily household use.`
  ];
  let tipIndex = 0;
  while (currentWords < 1040 && tipIndex < microTips.length) {
    const tip = microTips[tipIndex++];
    const pMatches = [...article.content.matchAll(/<\/p>/g)];
    if (pMatches.length > 3) {
      const idx = pMatches[2].index;
      article.content = article.content.slice(0, idx) + ' ' + tip + article.content.slice(idx);
    } else {
      article.content += `<p>${tip}</p>`;
    }
    currentWords = calcWords(article.content);
  }

  // Precision Trimmer Loop if over 1,200 words
  if (currentWords > 1200) {
    const paragraphs = [...article.content.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    for (let i = paragraphs.length - 2; i >= 1 && currentWords > 1160; i--) {
      const p = paragraphs[i];
      if (p[0].includes('<a ') || p[0].includes('<table') || p[0].includes('class="lead-paragraph"')) continue;
      const sentences = p[1].split(/(?<=[.?!])\s+/);
      if (sentences.length > 2) {
        const shorter = `<p>${sentences.slice(0, 2).join(' ')}</p>`;
        article.content = article.content.replace(p[0], shorter);
      } else if (sentences.length === 2 && currentWords > 1180) {
        const shorter = `<p>${sentences[0]}</p>`;
        article.content = article.content.replace(p[0], shorter);
      }
      currentWords = calcWords(article.content);
    }

    if (currentWords > 1180) {
      const pMatches2 = [...article.content.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
      for (const p of pMatches2) {
        if (currentWords <= 1150) break;
        if (p[0].includes('<a ') || p[0].includes('<table') || p[0].includes('class="lead-paragraph"')) continue;
        const words = p[1].split(/\s+/);
        if (words.length > 15) {
          const cutCount = Math.min(words.length - 12, currentWords - 1140);
          if (cutCount > 0) {
            const trimmedText = words.slice(0, words.length - cutCount).join(' ') + '.';
            article.content = article.content.replace(p[0], `<p>${trimmedText}</p>`);
            currentWords = calcWords(article.content);
          }
        }
      }
    }
  }

  // 10. FINAL GUARANTEE PASS: Clean em dashes, purge banned words, strip ALL heading dashes
  article.content = purgeBanned(cleanEmDashes(article.content));
  article.content = article.content.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, text) => {
    let cleanText = text.replace(/[-—–]/g, ' ').replace(/\s+/g, ' ').trim();
    cleanText = purgeBanned(cleanEmDashes(cleanText));
    return `<h${level}${attrs}>${cleanText}</h${level}>`;
  });

  article.title = formatTitle(article.title);
  article.seoTitle = article.title;
  article.coverAlt = article.title;
  article.subtitle = purgeBanned(cleanEmDashes(article.subtitle));
  article.seoDescription = purgeBanned(cleanEmDashes(article.seoDescription));

  // Re-sync Table of Contents with all actual H2 headings in the content
  const finalH2Matches = [...article.content.matchAll(/<h2[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h2>/gi)];
  if (finalH2Matches.length > 0) {
    article.toc = finalH2Matches.map(m => {
      const id = m[1];
      let h2Title = m[2].replace(/<[^>]+>/g, '').replace(/[-—–]/g, ' ').replace(/\s+/g, ' ').trim();
      h2Title = purgeBanned(cleanEmDashes(h2Title));
      return { id, title: h2Title };
    });
  }

  return article;
}

export function saveArticle(article) {
  let existing = [];
  if (fs.existsSync(articlesPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(articlesPath, "utf-8"));
    } catch (e) {
      existing = [];
    }
  }

  // Enforce all site-wide quality standards before saving
  article = enforceArticleStandards(article, existing);

  existing = existing.filter(a => a.slug !== article.slug);
  existing.unshift(article);

  fs.writeFileSync(articlesPath, JSON.stringify(existing, null, 2), "utf-8");
  console.log(` Successfully saved "${article.title}" to src/data/articles.json!`);
}

// Only execute directly if invoked via CLI `node generate-article.js`, not when imported by run-pipeline.js
const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (executedFilePath === currentFilePath) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const topic = args[0];
    const category = args[1] || "living-room";
    generateArticle(topic, { category }).then(article => {
      saveArticle(article);
      console.log(` Done! View at: http://localhost:3000/${article.slug}`);
    }).catch(err => {
      console.error("Failed to generate article:", err);
    });
  }
}

