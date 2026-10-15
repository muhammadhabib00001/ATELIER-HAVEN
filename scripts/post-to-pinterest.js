/**
 * Automated Pinterest Pin Poster
 * Posts freshly published articles directly to Pinterest Board via Pinterest API v5.
 * 
 * Target Board: https://www.pinterest.com/iapkworlds/atrium-livings/
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';
const TARGET_BOARD_NAME = 'atrium-livings';

async function getBoardId(token) {
  // If user provided direct board ID, use it
  if (process.env.PINTEREST_BOARD_ID) {
    return process.env.PINTEREST_BOARD_ID;
  }

  // Otherwise fetch user boards and find matching board by name
  try {
    const res = await fetch(`${PINTEREST_API_BASE}/boards`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch boards (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const boards = data.items || [];
    
    // Search by slug/name match
    const matched = boards.find(b => 
      b.name.toLowerCase().includes('home decor') ||
      b.name.toLowerCase().includes('decor') ||
      b.name.toLowerCase().includes('atrium') || 
      b.name.toLowerCase().includes('living') ||
      b.id === TARGET_BOARD_NAME
    ) || boards[0];

    if (matched) {
      console.log(`📌 Found target Pinterest Board: "${matched.name}" (ID: ${matched.id})`);
      return matched.id;
    }
    
    throw new Error('No boards found on this Pinterest account. Please create a board first.');
  } catch (err) {
    console.error('⚠️ Could not resolve Pinterest Board ID automatically:', err.message);
    throw err;
  }
}

export async function postArticleToPinterest(article) {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) {
    console.log('ℹ️ PINTEREST_ACCESS_TOKEN is not set in environment. Skipping Pinterest auto-post.');
    return null;
  }

  try {
    const boardId = await getBoardId(token);
    const destinationUrl = `https://www.atriumlivings.com/${article.slug}/`;
    
    // Clean, high-impact pin title (max 100 chars for Pinterest)
    const pinTitle = (article.title || article.seoTitle || '').slice(0, 95);
    
    // SEO-rich description (Pinterest allows up to 500 chars)
    const pinDescription = (
      article.seoDescription || 
      article.subtitle || 
      (article.keyTakeaways && article.keyTakeaways.join('. ')) || 
      article.title
    ).slice(0, 480);

    const pinPayload = {
      board_id: boardId,
      title: pinTitle,
      description: pinDescription,
      link: destinationUrl,
      media_source: {
        source_type: 'image_url',
        url: article.coverImage
      }
    };

    console.log(`🚀 Creating Pinterest Pin for "${pinTitle}"...`);

    const res = await fetch(`${PINTEREST_API_BASE}/pins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pinPayload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Pinterest API Error (${res.status}):`, errorText);
      return null;
    }

    const pinData = await res.json();
    console.log(`✅ Successfully published Pin to Pinterest! Pin ID: ${pinData.id}`);
    return pinData;
  } catch (err) {
    console.error('❌ Error posting to Pinterest:', err.message);
    return null;
  }
}

// Standalone execution: post latest article if executed directly
if (process.argv[1] && process.argv[1].endsWith('post-to-pinterest.js')) {
  try {
    const articlesPath = path.resolve('./src/data/articles.json');
    if (fs.existsSync(articlesPath)) {
      const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
      if (articles.length > 0) {
        console.log(`Selecting newest article: "${articles[0].title}"`);
        postArticleToPinterest(articles[0]);
      }
    }
  } catch (e) {
    console.error('Failed to run standalone Pinterest script:', e.message);
  }
}
