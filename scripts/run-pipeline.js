/**
 * Automated Article Pipeline Runner
 * Used by GitHub Actions and local scheduler.
 * 
 * Steps:
 * 1. Checks Google Drive folder for keywords Excel / Sheet file.
 * 2. If present, picks the next unpublished keyword from the Drive file.
 * 3. If not present or all published, falls back to custom CLI input or default queue.
 * 4. Invokes Google Gemini / Vertex AI to write a 1,200-1,600+ word technical guide.
 * 5. Injects internal links and saves to src/data/articles.json.
 * 6. Uploads timestamped JSON backup to Google Drive.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { generateArticle, saveArticle } from '../generate-article.js';
import { uploadToGoogleDrive, getDriveAccessToken } from './backup-to-drive.js';
import { fetchKeywordsFromDrive } from './fetch-keywords.js';

// Fallback curated rotation of high-volume, low-KD architectural topics
const TOPIC_QUEUE = [
  { topic: "Minimalist Master Bathroom Layout Ideas", category: "bathroom" },
  { topic: "Modern Walk-in Pantry Joinery and Storage Solutions", category: "kitchen" },
  { topic: "Architectural Ceiling Beams and Warm Timber Detailing", category: "living-room" },
  { topic: "Quiet Luxury Bedroom Furniture and Organic Materials", category: "bedroom" },
  { topic: "Curated Courtyard Garden Landscape Design", category: "garden-outdoor" },
  { topic: "Micro Luxury Small Space Storage and Pocket Doors", category: "small-spaces" },
  { topic: "Modern Travertine Dining Tables and Stone Craftsmanship", category: "furniture" },
  { topic: "Architectural Wall Sconces and Indirect Living Room Lighting", category: "lighting" }
];

async function run() {
  const customTopic = process.argv[2];
  const customCategory = process.argv[3];

  let targetTopic = customTopic;
  let targetCategory = customCategory;

  const articlesPath = path.resolve("./src/data/articles.json");
  let existingArticles = [];
  if (fs.existsSync(articlesPath)) {
    try {
      existingArticles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
    } catch (e) {
      existingArticles = [];
    }
  }

  const publishedTitles = existingArticles.map(a => (a.title || "").toLowerCase());
  const publishedKeywords = existingArticles.flatMap(a => (a.keywords || []).map(k => k.toLowerCase()));

  // 1. If no manual topic provided via GitHub Actions dispatch, try fetching from Google Drive Excel/Sheet!
  if (!targetTopic) {
    try {
      const accessToken = await getDriveAccessToken();
      if (accessToken) {
        console.log(" Checking Google Drive folder for keywords file...");
        const driveKeywords = await fetchKeywordsFromDrive(accessToken);
        
        if (driveKeywords.length > 0) {
          // Find first keyword from Drive that has not yet been published
          const nextUnpublished = driveKeywords.find(item => {
            const itemTopicLower = item.topic.toLowerCase();
            const isTitleMatch = publishedTitles.some(t => t.includes(itemTopicLower));
            const isKeywordMatch = publishedKeywords.some(k => k === itemTopicLower);
            return !isTitleMatch && !isKeywordMatch;
          });

          if (nextUnpublished) {
            console.log(` Selected next unpublished keyword from Google Drive file: "${nextUnpublished.topic}" (Category: ${nextUnpublished.category})`);
            targetTopic = nextUnpublished.topic;
            targetCategory = nextUnpublished.category;
          } else {
            console.log(" All keywords in Google Drive file have already been published! Falling back to rotation queue.");
          }
        }
      }
    } catch (driveErr) {
      console.warn(" Note: Unable to read keywords from Drive file:", driveErr.message);
    }
  }

  // 2. If still no topic, pick from the default curated topic queue
  if (!targetTopic) {
    const available = TOPIC_QUEUE.filter(item => 
      !publishedTitles.some(t => t.includes(item.topic.toLowerCase()))
    );
    const chosen = available.length > 0 ? available[0] : TOPIC_QUEUE[Math.floor(Math.random() * TOPIC_QUEUE.length)];
    targetTopic = chosen.topic;
    targetCategory = chosen.category;
  }

  console.log(`\n Starting Automated Generation Pipeline:`);
  console.log(` Topic: "${targetTopic}"`);
  console.log(` Category: "${targetCategory || 'living-room'}"`);

  // Step 1: Generate article via Gemini / Vertex AI
  const article = await generateArticle(targetTopic, { category: targetCategory });

  // Step 2: Ensure 2 internal links and 1 authoritative external link
  if (existingArticles.length >= 2) {
    const candidate1 = existingArticles[0];
    const candidate2 = existingArticles[1];

    if (!article.content.includes(candidate1.slug)) {
      const candTitle1 = candidate1.title.split(':')[0].trim().toLowerCase();
      article.content = article.content.replace(
        /<\/p>/,
        ` Explore further architectural insights in our guide to <strong><a href="/${candidate1.slug}">${candTitle1}</a></strong>.</p>`
      );
    }
    if (!article.content.includes(candidate2.slug)) {
      const candTitle2 = candidate2.title.split(':')[0].trim().toLowerCase();
      const pMatches = [...article.content.matchAll(/<\/p>/g)];
      if (pMatches.length >= 3) {
        const thirdPIndex = pMatches[2].index;
        const before = article.content.slice(0, thirdPIndex);
        const after = article.content.slice(thirdPIndex);
        article.content = before + ` Discover related design principles in our analysis of <strong><a href="/${candidate2.slug}">${candTitle2}</a></strong>.` + after;
      }
    }
  }

  // Ensure 1 authoritative external reference if none present
  if (!article.content.includes('http://') && !article.content.includes('https://')) {
    const cleanKw = targetTopic.toLowerCase();
    article.content = article.content.replace(
      new RegExp(`(${cleanKw})`, 'i'),
      `<strong><a href="https://www.architecturaldigest.com" target="_blank" rel="noopener noreferrer">$1</a></strong>`
    );
  }

  // Step 3: Save article
  saveArticle(article);

  // Step 4: Backup to Google Drive
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await uploadToGoogleDrive(articlesPath, `articles-backup-${timestamp}.json`);
  } catch (driveErr) {
    console.warn(" Google Drive backup note:", driveErr.message);
  }

  console.log(` Pipeline completed successfully for: ${article.slug}`);
}

run().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
