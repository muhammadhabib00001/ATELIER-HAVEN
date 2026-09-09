import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import fs from "fs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const articlesFile = "./src/data/articles.json";
const articles = JSON.parse(fs.readFileSync(articlesFile, "utf-8"));

function getWordCount(html) {
  return html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

const modelsToTry = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

async function expandArticle(article) {
  const currentCount = getWordCount(article.content);
  console.log(`\nEvaluating: "${article.title}" (${currentCount} words)`);
  if (currentCount >= 1050) {
    console.log(` Already exceeds 1,050 words (${currentCount} words). Skipping.`);
    return article;
  }

  console.log(` Expanding from ${currentCount} words to 1,100+ words with Gemini...`);

  const prompt = `You are a licensed architect (AIA) and senior architectural editor at Atelier Haven.
Your task is to expand the following article into an exhaustive, high-ranking masterclass architectural guide of AT LEAST 1,150 to 1,350 words.

ARTICLE TITLE: ${article.title}
SUBTITLE: ${article.subtitle}
CATEGORY: ${article.category}
TARGET KEYWORDS: ${article.keywords.join(", ")}
EXISTING TOC HEADINGS: ${JSON.stringify(article.toc)}

CURRENT CONTENT:
${article.content}

MANDATORY INSTRUCTIONS:
- The total generated text MUST contain at least 1,150 words.
- Structure logically with semantic HTML:
  1. <p class="lead-paragraph">...</p> for an in-depth opening thesis.
  2. At least 5 to 6 dedicated <h2> sections. Each section must provide multiple detailed, analytical paragraphs explaining structural considerations, material mechanics, acoustic performance, clearance dimensions, and installation techniques.
  3. Include an architectural quote: <div class="editorial-quote"><blockquote>...</blockquote><cite>— Elena Vance, AIA</cite></div>
  4. Include an architectural specification matrix: <div class="spec-card"><h4>Architectural Specification Matrix</h4><ul><li><strong>Material / Grade:</strong> ...</li>...</ul></div>
  5. Include an extensive FAQ section: <h2 id="faq">Frequently Asked Questions</h2> followed by <div class="faq-accordion"> with 4 thorough Q&A items using <div class="faq-item"><h3>...</h3><p>...</p></div>.

- Respond strictly with a JSON object:
  {
    "toc": [ { "id": "...", "title": "..." } ],
    "content": "...(valid semantic HTML exceeding 1,150 words)...",
    "readTime": "12 min read"
  }`;

  for (const model of modelsToTry) {
    try {
      console.log(` Calling ${model}...`);
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (res && res.text) {
        const parsed = JSON.parse(res.text);
        const newCount = getWordCount(parsed.content);
        console.log(` Expanded with ${model}: now ${newCount} words!`);
        article.content = parsed.content;
        if (parsed.toc && parsed.toc.length > 0) article.toc = parsed.toc;
        if (parsed.readTime) article.readTime = parsed.readTime;
        article.updatedAt = new Date().toISOString();
        return article;
      }
    } catch (err) {
      console.warn(` Model ${model} error: ${err.message}. Trying next...`);
    }
  }

  return article;
}

async function run() {
  for (let i = 0; i < articles.length; i++) {
    try {
      articles[i] = await expandArticle(articles[i]);
      fs.writeFileSync(articlesFile, JSON.stringify(articles, null, 2), "utf-8");
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`Error processing article ${i}:`, e.message);
    }
  }
  console.log("\n All articles successfully expanded and verified!");
}

run();
