import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Initialize AI Client:
// Supports direct Vertex AI OR Gemini Developer API with automatic fallback
let ai;
const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID;
const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || "us-central1";
const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey) {
  console.log(" Initializing Google GenAI Client via GEMINI_API_KEY...");
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
} else if (vertexProject) {
  console.log(` Initializing Google Cloud Vertex AI Client (Project: ${vertexProject}, Location: ${vertexLocation})...`);
  ai = new GoogleGenAI({
    vertexAI: {
      project: vertexProject,
      location: vertexLocation
    }
  });
} else {
  console.error("Error: Neither GEMINI_API_KEY nor GOOGLE_CLOUD_PROJECT (Vertex AI) is configured.");
  process.exit(1);
}

const articlesPath = path.resolve("./src/data/articles.json");

const articleSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, SEO-optimized title STRICTLY between 55 and 60 characters in total length, featuring the primary target keyword naturally. Never duplicate existing titles." },
    subtitle: { type: Type.STRING, description: "Engaging editorial summary (under 160 characters) that STRICTLY features the primary target keyword explicitly and naturally. Must focus entirely on the keyword topic." },
    slug: { type: Type.STRING, description: "URL friendly slug in kebab-case" },
    category: { type: Type.STRING, description: "Category name e.g. living-room, kitchen, bathroom, bedroom, garden-outdoor, lighting, furniture" },
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
      description: "Comprehensive, exhaustive semantic HTML content of AT LEAST 1,000 to 1,200 words. Must feature at least 5 in-depth <h2> sections, practical dimension tolerances, material trade-offs, expert quotes, spec cards, and FAQ accordion. CRITICAL: NEVER include hyphens or dashes inside any heading (h1-h6) tags."
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
  
  const systemPrompt = `You are a world-class architectural writer and luxury interior design consultant for "Atrium Livings".
CRITICAL REQUIREMENT: The written HTML article content MUST be a MINIMUM of 1,000 to 1,200 words in length. Never write brief summaries. Be thorough, technical, analytical, and highly descriptive.
Include rich architectural vocabulary, material specifications (psi, DCOF, janka ratings, kelvin color temperatures, clearance dimensions in inches and millimeters).

CRITICAL SEO RULES:
1. Primary Target Keyword: MUST be explicitly and prominently featured in ALL key places:
   - Article Headline (title)
   - Meta Title (seoTitle)
   - Article Summary Subtitle (subtitle): MUST directly start with or feature the primary keyword, describing the essential design takeaway.
   - Meta Description (seoDescription): MUST directly feature the primary keyword within the first 100 characters (max 160 characters total).
   - Cover Image Heading & Description (coverAlt): MUST match the article title exactly.
2. Title and seoTitle: MUST BE STRICTLY BETWEEN 55 AND 60 CHARACTERS IN TOTAL LENGTH. Do not exceed 60 characters and do not be under 55 characters.
3. Headings: NEVER use hyphens or dashes in ANY heading (<h1>, <h2>, <h3>, <h4>) or TOC title. Use words or commas instead (e.g., use "Dim to Warm", "Room by Room", "Zero Threshold").
4. Uniqueness: Ensure every <h2> and <h3> heading is completely unique, creative, and specific to this article topic. Never use generic repeated headings like "Frequently Asked Questions" without prefixing with the topic (e.g. use "${topic} Frequently Asked Questions").
5. Cover Image Heading (coverAlt): STRICTLY match the article title.

Format the HTML content meticulously:
1. <p class="lead-paragraph"> for an authoritative, evocative opening analysis setting the spatial thesis.
2. At least 5 to 6 dedicated <h2> sections with IDs strictly matching the 'toc' array (with 0 hyphens or dashes in the visible heading text).
3. Under each <h2>, provide 2 to 4 detailed paragraphs exploring principles, structural framing, plumbing/electrical considerations, and tactile materiality.
4. At least one prominent editorial quote: <div class="editorial-quote"><blockquote>...</blockquote><cite>— Architect Name, AIA</cite></div>
5. Architectural specification cards: <div class="spec-card"><h4>Architectural Specifications</h4><ul><li><strong>Material / Tolerance:</strong> Detail</li>...</ul></div>
6. High-utility FAQ section: <h2 id="faq-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${topic} Frequently Asked Questions</h2> followed by <div class="faq-accordion"><div class="faq-item"><h3>Precise Question incorporating "${topic}"?</h3><p><strong>Direct Key Info on ${topic}.</strong> 1 to 2 concise sentences providing the direct architectural rule, dimension, or specification directly for ${topic}.</p></div>. CRITICAL: Every single FAQ question (<h3>) and answer (<p>) MUST explicitly focus on and incorporate the target keyword "${topic}". Never write generic questions.`;

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
  ];
  let response = null;

  // Try each model with retries for temporary spikes or transient internal errors
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(` Attempting with model: ${modelName} (attempt ${attempt})...`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: `Write an exhaustive, SEO-dominant architectural guide about: "${topic}". Category: ${options.category || "interior-design"}. Ensure length strictly exceeds 1,100 words with thorough technical and design depth. Output strictly in JSON.`,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: articleSchema
          }
        });
        if (response && response.text) break;
      } catch (err) {
        console.warn(` ${modelName} attempt ${attempt} issue: ${err.message}`);
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

  if (!response || !response.text) {
    throw new Error("Unable to complete generation with available models. Please check API credentials and retry.");
  }

  const generated = JSON.parse(response.text);
  const now = new Date().toISOString();

  let coverImageUrl = options.customImage || "";
  if (!coverImageUrl) {
    let existingArticlesList = [];
    if (fs.existsSync(articlesPath)) {
      try {
        existingArticlesList = JSON.parse(fs.readFileSync(articlesPath, "utf-8"));
      } catch (e) {}
    }
    coverImageUrl = await tryGenerateImage(generated.imagePrompt, generated.slug, generated.keywords, generated.category, existingArticlesList);
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
    content: generated.content
  };

  return article;
}

async function fetchUnsplashImage(keywords, category, existingArticles = []) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  const usedImages = new Set(existingArticles.map(a => a.coverImage).filter(Boolean));

  try {
    const primaryKw = (keywords?.[0] || "").trim();
    // Normalize foreign or raw keywords into English architectural context if needed
    let enrichedTerm = primaryKw;
    if (primaryKw.toLowerCase().includes('baño') || primaryKw.toLowerCase().includes('bano')) {
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
      console.log(` Fetching high-res architectural cover from Unsplash: "${term}"...`);
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=20&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}` }
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Find first image that has NOT been used in ANY published article
        const unusedPhoto = data.results.find(p => {
          const rawUrl = p.urls.raw || p.urls.regular;
          return !Array.from(usedImages).some(used => used.includes(p.id) || used.includes(rawUrl));
        });

        if (unusedPhoto) {
          const imageUrl = `${unusedPhoto.urls.raw || unusedPhoto.urls.regular}&auto=format&fit=crop&w=1400&q=85`;
          console.log(` Retrieved unique Unsplash photo by ${unusedPhoto.user.name}: ${imageUrl}`);
          return imageUrl;
        }
      }
    }
  } catch (err) {
    console.warn(" Unsplash fetch error:", err.message);
  }
  return null;
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
  const existingHeadingTexts = new Set();
  existingArticles.forEach(a => {
    if (a.slug === article.slug) return;
    const matches = [...a.content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
    matches.forEach(m => existingHeadingTexts.add(m[2].replace(/<[^>]+>/g, '').trim().toLowerCase()));
  });

  // 1. Strict title length: 55-60 characters
  let title = (article.title || '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (title.length < 55) {
    const padSuffixes = ['Architectural Guide', 'Modern Design Masterclass', 'Design Ideas & Plans', 'Luxury Spatial Guide'];
    for (const s of padSuffixes) {
      if (!title.includes(s) && (title + ': ' + s).length <= 60 && (title + ': ' + s).length >= 55) {
        title = title + ': ' + s;
        break;
      }
    }
    while (title.length < 55) {
      title = title + ' Ideas';
    }
    if (title.length > 60) {
      title = title.slice(0, 60);
    }
  } else if (title.length > 60) {
    title = title.slice(0, 60);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace >= 50) {
      title = title.slice(0, lastSpace);
    }
    while (title.length < 55) {
      title = title + ' Guide';
    }
    if (title.length > 60) {
      title = title.slice(0, 60);
    }
  }
  article.title = title;
  article.seoTitle = title;

  // 2. Remove all hyphens/dashes from all headings
  article.content = article.content.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, text) => {
    const cleanText = text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    return `<h${level}${attrs}>${cleanText}</h${level}>`;
  });

  if (article.toc && Array.isArray(article.toc)) {
    article.toc.forEach(item => {
      if (item.title) {
        item.title = item.title.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      }
    });
  }

  // 3. Make FAQ and Specification headings unique across the whole site
  const shortTitle = article.title.split(':')[0].trim();
  const uniqueFaqId = `faq-${article.slug}`;
  const uniqueFaqHeading = `${shortTitle} Frequently Asked Questions`;

  if (article.toc && Array.isArray(article.toc)) {
    const faqItem = article.toc.find(item => item.id === 'faq' || item.title.toLowerCase().includes('frequently asked'));
    if (faqItem) {
      faqItem.id = uniqueFaqId;
      faqItem.title = uniqueFaqHeading;
    }
  }

  article.content = article.content.replace(/<h2 id=["']faq["']>Frequently Asked Questions<\/h2>/gi, `<h2 id="${uniqueFaqId}">${uniqueFaqHeading}</h2>`);
  article.content = article.content.replace(/<h4>Architectural Specifications<\/h4>/gi, `<h4>${shortTitle} Specifications</h4>`);
  article.content = article.content.replace(/<h4>Architectural & Material Specifications<\/h4>/gi, `<h4>${shortTitle} Material Specifications</h4>`);
  article.content = article.content.replace(/<h4>Architectural Specification Matrix<\/h4>/gi, `<h4>${shortTitle} Specification Matrix</h4>`);

  // Ensure no other heading duplicates any existing heading
  article.content = article.content.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, text) => {
    const raw = text.replace(/<[^>]+>/g, '').trim();
    const lower = raw.toLowerCase();
    if (existingHeadingTexts.has(lower)) {
      const distinctText = `${raw} for ${shortTitle}`;
      return `<h${level}${attrs}>${distinctText}</h${level}>`;
    }
    return match;
  });

  // 4. STRICT SEO LOCK: Ensure Subtitle (Summary) and Meta Description match with primary target keyword
  const primaryKeyword = (article.keywords && article.keywords[0]) ? article.keywords[0].trim() : shortTitle;
  const primaryKwLower = primaryKeyword.toLowerCase();

  // Lock Subtitle (Summary): Must explicitly feature the primary keyword
  let subtitle = (article.subtitle || '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (!subtitle.toLowerCase().includes(primaryKwLower)) {
    // Lock keyword into the summary seamlessly
    subtitle = `${primaryKeyword}: ${subtitle}`;
  }
  // Trim summary if over 160 characters
  if (subtitle.length > 160) {
    const truncated = subtitle.slice(0, 157);
    const lastSp = truncated.lastIndexOf(' ');
    subtitle = (lastSp > 120 ? truncated.slice(0, lastSp) : truncated) + '...';
  }
  article.subtitle = subtitle;

  // Lock Meta Description: Must explicitly feature the primary keyword within 160 characters
  let seoDescription = (article.seoDescription || '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (!seoDescription.toLowerCase().includes(primaryKwLower)) {
    seoDescription = `Comprehensive guide to ${primaryKeyword}: explore spatial layouts, architectural material specifications, and expert design solutions.`;
  }
  if (seoDescription.length > 160) {
    const truncated = seoDescription.slice(0, 157);
    const lastSp = truncated.lastIndexOf(' ');
    seoDescription = (lastSp > 120 ? truncated.slice(0, lastSp) : truncated) + '...';
  }
  article.seoDescription = seoDescription;

  // 5. STRICT FAQ KEYWORD LOCK: Ensure every FAQ question (<h3>) and answer (<p>) explicitly contains the primary target keyword
  const faqAccordionRegex = /<div class=["']faq-accordion["']>([\s\S]*?)<\/div>/i;
  const faqMatch = article.content.match(faqAccordionRegex);
  if (faqMatch) {
    let faqContent = faqMatch[1];
    faqContent = faqContent.replace(/<div class=["']faq-item["']>([\s\S]*?)<\/div>/gi, (itemMatch, itemInner) => {
      let updatedItem = itemInner;
      // Check <h3>
      const qMatch = updatedItem.match(/<h3>([\s\S]*?)<\/h3>/i);
      if (qMatch) {
        const qText = qMatch[1].trim();
        if (!qText.toLowerCase().includes(primaryKwLower)) {
          // Prepend or integrate primary keyword naturally
          const cleanQ = qText.replace(/\?$/, '');
          const newQ = `In ${primaryKeyword}, ${cleanQ.charAt(0).toLowerCase() + cleanQ.slice(1)}?`;
          updatedItem = updatedItem.replace(qMatch[0], `<h3>${newQ}</h3>`);
        }
      }
      // Check <p>
      const pMatch = updatedItem.match(/<p>([\s\S]*?)<\/p>/i);
      if (pMatch) {
        const pText = pMatch[1].trim();
        if (!pText.toLowerCase().includes(primaryKwLower)) {
          // Append reference to primary keyword naturally if missing
          const newP = pText.replace(/\.$/, '') + ` when planning luxury ${primaryKeyword}.`;
          updatedItem = updatedItem.replace(pMatch[0], `<p>${newP}</p>`);
        }
      }
      return `<div class="faq-item">${updatedItem}</div>`;
    });
    article.content = article.content.replace(faqMatch[0], `<div class="faq-accordion">${faqContent}</div>`);
  }

  // 6. STRICT COVER IMAGE LOCK: Image description and caption strictly match the article title
  article.coverAlt = article.title;

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
