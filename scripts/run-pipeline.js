/**
 * Automated Article Pipeline Runner
 * Used by GitHub Actions and local scheduler.
 * 
 * Steps:
 * 1. Picks keyword/topic (either from CLI args or from an automated queue of high-intent topics).
 * 2. Invokes Google Gemini API / Vertex AI to write a 1,200-1,600+ word technical guide.
 * 3. Injects internal links to recently published articles and bold external link.
 * 4. Saves article to `src/data/articles.json`.
 * 5. Uploads backup to Google Drive if credentials are configured.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { generateArticle, saveArticle } from './generate-article.js';
import { uploadToGoogleDrive } from './scripts/backup-to-drive.js';

// Pre-curated rotation of high-volume, low-KD architectural & interior topics
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

  // If no custom topic passed via CLI/dispatch, pick next fresh topic from queue
  if (!targetTopic) {
    const publishedTitles = existingArticles.map(a => a.title.toLowerCase());
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

  // Step 1: Generate article via Gemini / Vertex
  const article = await generateArticle(targetTopic, { category: targetCategory });

  // Step 2: Ensure internal links reference existing published articles
  if (existingArticles.length >= 2) {
    const candidate1 = existingArticles[0];
    const candidate2 = existingArticles[1];
    
    // Cross-link into the generated content if not already present
    if (!article.content.includes(candidate1.slug)) {
      article.content = article.content.replace(
        /<\/p>/,
        ` Learn more in our architectural analysis of <strong><a href="/${candidate1.slug}">${candidate1.title}</a></strong>.</p>`
      );
    }
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
