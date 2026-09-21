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
import { fetchKeywordsFromDrive, normalizeCategory, detectCategoryFromKeyword } from './fetch-keywords.js';
import { submitUrlToGoogleIndexing } from './google-index.js';

// Load official categories from site.json
const siteDataPath = path.resolve("./src/data/site.json");
let SITE_CATEGORIES = [
  "kitchen", "bathroom", "living-room", "bedroom", "home-decor",
  "furniture", "lighting", "renovation", "diy", "garden-outdoor",
  "small-spaces", "design-trends"
];
if (fs.existsSync(siteDataPath)) {
  try {
    const siteJson = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
    if (siteJson.categories && Array.isArray(siteJson.categories)) {
      SITE_CATEGORIES = siteJson.categories.map(c => c.slug);
    }
  } catch (e) {
    // fallback to default list
  }
}

// Fallback curated rotation of high-volume, low-KD architectural topics
const TOPIC_QUEUE = [
  { topic: "Minimalist Master Bathroom Layout Ideas", category: "bathroom" },
  { topic: "Modern Walk-in Pantry Joinery and Storage Solutions", category: "kitchen" },
  { topic: "Architectural Ceiling Beams and Warm Timber Detailing", category: "living-room" },
  { topic: "Quiet Luxury Bedroom Furniture and Organic Materials", category: "bedroom" },
  { topic: "Curated Courtyard Garden Landscape Design", category: "garden-outdoor" },
  { topic: "Micro Luxury Small Space Storage and Pocket Doors", category: "small-spaces" },
  { topic: "Modern Travertine Dining Tables and Stone Craftsmanship", category: "furniture" },
  { topic: "Architectural Wall Sconces and Indirect Living Room Lighting", category: "lighting" },
  { topic: "Artisanal Limewash and Microcement Wall Finishes", category: "diy" },
  { topic: "Structural Wall Removal and Open Concept Renovation Costs", category: "renovation" },
  { topic: "Handcrafted Ceramic Vessels and Woven Textile Styling", category: "home-decor" },
  { topic: "Quiet Luxury and Tactile Biophilic Interior Forecast", category: "design-trends" }
];

async function generateSingleArticle(customTopic, customCategory) {
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

  // 1. If no manual topic provided via GitHub Actions dispatch, select category-wise from Google Drive file!
  if (!targetTopic) {
    try {
      const accessToken = await getDriveAccessToken();
      if (accessToken) {
        console.log(" Checking Google Drive folder for keywords file...");
        const driveKeywords = await fetchKeywordsFromDrive(accessToken);
        
        if (driveKeywords.length > 0) {
          // Filter unpublished keywords
          const unpublishedDriveKeywords = driveKeywords.filter(item => {
            const itemTopicLower = item.topic.toLowerCase();
            const isTitleMatch = publishedTitles.some(t => t.includes(itemTopicLower));
            const isKeywordMatch = publishedKeywords.some(k => k === itemTopicLower);
            return !isTitleMatch && !isKeywordMatch;
          });

          if (unpublishedDriveKeywords.length > 0) {
            console.log(` Found ${unpublishedDriveKeywords.length} unpublished keywords in Google Drive file.`);

            // Category-wise Selection:
            let selectedItem = null;

            if (customCategory) {
              // A specific category was requested by the user
              selectedItem = unpublishedDriveKeywords.find(item => item.category === customCategory);
              if (selectedItem) {
                console.log(` Filtered specifically for requested category "${customCategory}": "${selectedItem.topic}"`);
              }
            }

            if (!selectedItem) {
              // Pick a RANDOM unpublished keyword from the list!
              const randomIndex = Math.floor(Math.random() * unpublishedDriveKeywords.length);
              selectedItem = unpublishedDriveKeywords[randomIndex];
              console.log(` Random selection picked keyword #${randomIndex + 1} of ${unpublishedDriveKeywords.length}: "${selectedItem.topic}" (Category: ${selectedItem.category})`);
            }

            if (selectedItem) {
              console.log(` Selected keyword: "${selectedItem.topic}" (Category: ${selectedItem.category})`);
              targetTopic = selectedItem.topic;
              targetCategory = selectedItem.category;
            }
          } else {
            console.log(" All keywords in Google Drive file have already been published! Falling back to rotation queue.");
          }
        }
      }
    } catch (driveErr) {
      console.warn(" Note: Unable to read keywords from Drive file:", driveErr.message);
    }
  }

  // 2. If still no topic, pick category-wise from the default curated topic queue
  if (!targetTopic) {
    const available = TOPIC_QUEUE.filter(item => 
      !publishedTitles.some(t => t.includes(item.topic.toLowerCase()))
    );

    // Calculate published count per category to balance queue selection
    const categoryCounts = {};
    SITE_CATEGORIES.forEach(cat => { categoryCounts[cat] = 0; });
    existingArticles.forEach(a => {
      const cat = normalizeCategory(a.category) || a.category;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const sortedQueue = [...(available.length > 0 ? available : TOPIC_QUEUE)].sort((a, b) => {
      return (categoryCounts[a.category] || 0) - (categoryCounts[b.category] || 0);
    });

    const chosen = sortedQueue[0];
    targetTopic = chosen.topic;
    targetCategory = chosen.category;
  }

  // Ensure category is a valid site category slug
  targetCategory = normalizeCategory(targetCategory) || targetCategory || 'living-room';

  console.log(`\n Starting Automated Generation Pipeline:`);
  console.log(` Topic: "${targetTopic}"`);
  console.log(` Category: "${targetCategory || 'living-room'}"`);

  // Step 1: Generate article via Gemini / Vertex AI
  const article = await generateArticle(targetTopic, { category: targetCategory });

  // Step 2: Save and enforce locked article standards (links, table, word count, 0 banned words)
  saveArticle(article);

  console.log(` Article saved successfully: ${article.slug}`);

  // Step 4: Notify Google Indexing API for fast indexing
  const articleFullUrl = `https://www.atriumlivings.com/${article.slug}/`;
  await submitUrlToGoogleIndexing(articleFullUrl, 'URL_UPDATED');

  return article;
}

async function run() {
  const args = process.argv.slice(2);
  let customTopic = null;
  let customCategory = null;
  let count = 1;

  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      count = parseInt(arg.split('=')[1], 10) || 1;
    } else if (!isNaN(parseInt(arg, 10)) && parseInt(arg, 10) >= 1 && parseInt(arg, 10) <= 10) {
      count = parseInt(arg, 10);
    } else if (arg.toLowerCase() !== 'auto' && !customTopic && args.indexOf(arg) === 0 && arg.length > 5) {
      customTopic = arg.trim();
    } else if (arg.toLowerCase() !== 'auto' && !customCategory) {
      customCategory = normalizeCategory(arg) || arg.trim();
    }
  }

  count = Math.max(1, Math.min(count, 6));

  console.log(`\n========================================`);
  console.log(` Running Article Pipeline: Target Count = ${count}`);
  console.log(`========================================\n`);

  const publishedArticles = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n--- Generating Article ${i + 1} of ${count} ---`);
    try {
      // If a specific custom topic was passed, only use it for the 1st article to prevent duplicate topics
      const topicForRun = (i === 0) ? customTopic : null;
      const article = await generateSingleArticle(topicForRun, customCategory);
      if (article) {
        publishedArticles.push(article);
      }
    } catch (err) {
      console.error(` Error generating article ${i + 1}:`, err.message);
      // If one fails, continue or throw depending on whether we generated any
      if (count === 1) throw err;
    }

    // Small delay between generations to avoid rate limit spikes
    if (i < count - 1) {
      console.log(" Pausing 3 seconds before next generation...");
      await new Promise(res => setTimeout(res, 3000));
    }
  }

  // Step 4: Backup all articles to Google Drive after batch completes
  if (publishedArticles.length > 0) {
    try {
      const articlesPath = path.resolve("./src/data/articles.json");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await uploadToGoogleDrive(articlesPath, `articles-backup-${timestamp}.json`);
      console.log(` Uploaded updated backup to Google Drive (${publishedArticles.length} new article(s)).`);
    } catch (driveErr) {
      console.warn(" Google Drive backup note:", driveErr.message);
    }
  }

  console.log(`\n Pipeline batch finished. Published ${publishedArticles.length} article(s).`);
}

run().catch(err => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
