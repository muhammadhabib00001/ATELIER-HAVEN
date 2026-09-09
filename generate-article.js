import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const articlesPath = path.resolve("./src/data/articles.json");

const articleSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Engaging, SEO-optimized title" },
    subtitle: { type: Type.STRING, description: "Editorial subtitle" },
    slug: { type: Type.STRING, description: "URL friendly slug in kebab-case" },
    category: { type: Type.STRING, description: "Category name e.g. living-room, kitchen, bathroom, bedroom, outdoor" },
    author: { type: Type.STRING, description: "Author slug, e.g., elena-vance, marcus-reid, sophia-chen" },
    readTime: { type: Type.STRING, description: "Estimated read time, e.g. '8 min read'" },
    coverAlt: { type: Type.STRING, description: "Descriptive alt text for cover image" },
    imagePrompt: { type: Type.STRING, description: "High-detail architectural prompt for image generation" },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-8 high intent SEO keywords"
    },
    seoTitle: { type: Type.STRING, description: "SEO Title under 60 chars" },
    seoDescription: { type: Type.STRING, description: "SEO meta description under 160 chars" },
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
          title: { type: Type.STRING }
        },
        required: ["id", "title"]
      },
      description: "Table of contents matching h2 IDs in the content"
    },
    content: {
      type: Type.STRING,
      description: "Comprehensive, exhaustive semantic HTML content of AT LEAST 1,000 to 1,200 words. Must feature at least 5 in-depth <h2> sections, practical dimension tolerances, material trade-offs, expert quotes, spec cards, and FAQ accordion."
    }
  },
  required: [
    "title", "subtitle", "slug", "category", "author", "readTime",
    "coverAlt", "imagePrompt", "keywords", "seoTitle", "seoDescription",
    "keyTakeaways", "toc", "content"
  ]
};

export async function generateArticle(topic, options = {}) {
  console.log(`\n Generating article for topic: "${topic}"...`);
  
  const systemPrompt = `You are a world-class architectural writer and luxury interior design consultant for "Atrium Livings".
CRITICAL REQUIREMENT: The written HTML article content MUST be a MINIMUM of 1,000 to 1,200 words in length. Never write brief summaries. Be thorough, technical, analytical, and highly descriptive.
Include rich architectural vocabulary, material specifications (psi, DCOF, janka ratings, kelvin color temperatures, clearance dimensions in inches and millimeters).

Format the HTML content meticulously:
1. <p class="lead-paragraph"> for an authoritative, evocative opening analysis setting the spatial thesis.
2. At least 5 to 6 dedicated <h2> sections with IDs strictly matching the 'toc' array.
3. Under each <h2>, provide 2 to 4 detailed paragraphs exploring principles, structural framing, plumbing/electrical considerations, and tactile materiality.
4. At least one prominent editorial quote: <div class="editorial-quote"><blockquote>...</blockquote><cite>— Architect Name, AIA</cite></div>
5. Architectural specification cards: <div class="spec-card"><h4>Architectural Specifications</h4><ul><li><strong>Material / Tolerance:</strong> Detail</li>...</ul></div>
7. High-utility FAQ section: <h2 id="faq">Frequently Asked Questions</h2> followed by <div class="faq-accordion"><div class="faq-item"><h3>Precise Question?</h3><p><strong>Direct Key Info.</strong> 1 to 2 concise sentences providing the direct architectural rule, dimension, or specification.</p></div> (3-4 Q&As with short, direct answers).`;

  const modelsToTry = [
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];
  let response = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(` Attempting with model: ${modelName}...`);
      response = await ai.models.generateContent({
        model: modelName,
        contents: `Write an exhaustive, SEO-dominant architectural guide about: "${topic}". Category: ${options.category || "interior-design"}. Ensure length strictly exceeds 1,100 words with thorough technical and design depth.`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: articleSchema
        }
      });
      if (response && response.text) break;
    } catch (err) {
      console.warn(` ${modelName} temporary issue: ${err.message}. Retrying with next available model...`);
    }
  }

  if (!response || !response.text) {
    throw new Error("Unable to complete generation with available models. Please retry shortly.");
  }

  const generated = JSON.parse(response.text);
  const now = new Date().toISOString();

  // Try generating image if supported or fallback to high-quality Unsplash architecture photo
  let coverImageUrl = options.customImage || "";
  if (!coverImageUrl) {
    coverImageUrl = await tryGenerateImage(generated.imagePrompt, generated.slug, generated.keywords, generated.category);
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

async function fetchUnsplashImage(keywords, category) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const searchTerms = [
      keywords?.[0],
      `${category} interior architecture luxury design`,
      'modern architectural interior design'
    ].filter(Boolean);

    for (const term of searchTerms) {
      console.log(` Fetching high-res architectural cover from Unsplash: "${term}"...`);
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=5&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${accessKey}` }
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Pick top relevant architectural photo
        const photo = data.results[0];
        const imageUrl = `${photo.urls.raw || photo.urls.regular}&auto=format&fit=crop&w=1400&q=85`;
        console.log(` Retrieved Unsplash photo by ${photo.user.name}: ${imageUrl}`);
        return imageUrl;
      }
    }
  } catch (err) {
    console.warn(" Unsplash fetch error:", err.message);
  }
  return null;
}

async function tryGenerateImage(prompt, slug, keywords = [], category = "interior-design") {
  // 1. First check if Unsplash API is available for genuine, high-resolution photography
  const unsplashUrl = await fetchUnsplashImage(keywords, category);
  if (unsplashUrl) {
    return unsplashUrl;
  }

  // 2. Try Gemini Image model if available
  console.log(` Attempting AI image generation for prompt: "${prompt}"...`);
  const imageModels = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
  
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

  console.log(" Assigning fallback luxury architectural image.");
  return "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85";
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

  // Remove existing with same slug if updating
  existing = existing.filter(a => a.slug !== article.slug);
  existing.unshift(article);

  fs.writeFileSync(articlesPath, JSON.stringify(existing, null, 2), "utf-8");
  console.log(` Successfully saved "${article.title}" to src/data/articles.json!`);
}

// CLI usage: node generate-article.js "Organic Modern Living Room Ideas"
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
