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

  // Step 2: Ensure 2 internal links and 1 authoritative external link
  // Note: We use canonical trailing slashes /${slug}/ and concise 2-3 word anchor text
  if (existingArticles.length >= 2) {
    const candidate1 = existingArticles[0];
    const candidate2 = existingArticles[1];

    const getConciseAnchor = (cand) => {
      // 1. Prefer primary target keyword if concise
      if (cand.keywords && cand.keywords[0]) {
        const kw = cand.keywords[0].trim().toLowerCase();
        const kwWords = kw.split(/\s+/).filter(Boolean);
        if (kwWords.length <= 3 && kw.length <= 25) {
          return kw;
        }
      }
      // 2. Derive concise 2-3 word phrase from title
      let title = (cand.title || '').split(':')[0].trim();
      title = title.replace(/^(how to|how|guide to|designing|mastering|exploring|architectural|crafting the ultimate|crafting|bespoke|professional)\s+/i, '');
      title = title.replace(/\s+(guide|masterclass|blueprint|ideas|projects|tips|overview|analysis|study|field guide)$/i, '');
      title = title.replace(/\s+(guide|masterclass|blueprint|ideas|projects|tips)$/i, '');
      const words = title.trim().split(/\s+/).filter(Boolean);
      return (words.length > 3 ? words.slice(0, 3) : words).join(' ').toLowerCase();
    };

    if (!article.content.includes(candidate1.slug)) {
      const candAnchor1 = getConciseAnchor(candidate1);
      article.content = article.content.replace(
        /<\/p>/,
        ` Explore further architectural insights in our guide to <a href="/${candidate1.slug}/">${candAnchor1}</a>.</p>`
      );
    }
    if (!article.content.includes(candidate2.slug)) {
      const candAnchor2 = getConciseAnchor(candidate2);
      const pMatches = [...article.content.matchAll(/<\/p>/g)];
      if (pMatches.length >= 3) {
        const thirdPIndex = pMatches[2].index;
        const before = article.content.slice(0, thirdPIndex);
        const after = article.content.slice(thirdPIndex);
        article.content = before + ` Discover related spatial principles in our analysis of <a href="/${candidate2.slug}/">${candAnchor2}</a>.` + after;
      }
    }
  }

  // Step 2: Ensure 1 authoritative external reference if none present using a rotating pool of distinct authority domains
  if (!article.content.includes('http://') && !article.content.includes('https://')) {
    const domainPool = [
      { name: "American Institute of Architects (AIA)", url: "https://www.aia.org" },
      { name: "Architectural Digest", url: "https://www.architecturaldigest.com" },
      { name: "Architectural Record", url: "https://www.architecturalrecord.com" },
      { name: "Dezeen Architecture", url: "https://www.dezeen.com" },
      { name: "American Society of Interior Designers (ASID)", url: "https://www.asid.org" },
      { name: "International Interior Design Association (IIDA)", url: "https://www.iida.org" },
      { name: "Royal Institute of British Architects (RIBA)", url: "https://www.architecture.com" },
      { name: "Dwell Architecture", url: "https://www.dwell.com" },
      { name: "Metropolis Magazine", url: "https://metropolismag.com" },
      { name: "U.S. Green Building Council (USGBC)", url: "https://www.usgbc.org" },
      { name: "Elle Decor", url: "https://www.elledecor.com" },
      { name: "Interior Design Magazine", url: "https://www.interiordesign.net" },
      { name: "House Beautiful", url: "https://www.housebeautiful.com" },
      { name: "Houzz Design", url: "https://www.houzz.com" },
      { name: "Remodelista", url: "https://www.remodelista.com" },
      { name: "Design Milk", url: "https://design-milk.com" },
      { name: "Curbed Architecture", url: "https://www.curbed.com" },
      { name: "Wallpaper Magazine", url: "https://www.wallpaper.com" },
      { name: "Domus Architecture", url: "https://www.domusweb.it" },
      { name: "Frame Magazine", url: "https://www.frame-web.com" },
      { name: "Azure Magazine", url: "https://www.azuremagazine.com" },
      { name: "Habitually Chic", url: "https://www.habituallychic.luxury" },
      { name: "Architectural Lighting", url: "https://www.archlighting.com" }
    ];

    // Pick domain based on total existing articles count to guarantee zero duplicate domains
    const chosenDomain = domainPool[existingArticles.length % domainPool.length];
    if (article.content.includes('</p>')) {
      article.content = article.content.replace(
        /<\/p>/,
        ` Review structural guidelines and architectural standards from the <a href="${chosenDomain.url}" target="_blank" rel="noopener noreferrer">${chosenDomain.name}</a>.</p>`
      );
    }
  }

  // Step 3: Save article
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
