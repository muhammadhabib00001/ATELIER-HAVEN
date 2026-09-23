/**
 * Google Drive / Sheets & Excel Keyword Fetcher
 * Reads keywords from Excel (.xlsx, .xls), CSV (.csv), or Google Sheets stored in Google Drive.
 * Automatically detects the right category from the keyword text.
 */

import * as XLSX from 'xlsx';

// Official 12 site category slugs permanently locked across Atrium Livings
export const LOCKED_CATEGORIES = [
  "kitchen", "bathroom", "living-room", "bedroom", "home-decor",
  "furniture", "lighting", "renovation", "diy", "garden-outdoor",
  "small-spaces", "design-trends"
];

// Normalizes any category string into one of the 12 official site category slugs
export function normalizeCategory(cat) {
  if (!cat) return null;
  const c = String(cat).toLowerCase().trim().replace(/[_\s]+/g, '-');
  
  const categoryMap = {
    'kitchen': 'kitchen',
    'kitchens': 'kitchen',
    'culinary': 'kitchen',
    'cook': 'kitchen',
    'cooking': 'kitchen',
    'appliance': 'kitchen',
    'appliances': 'kitchen',
    'bathroom': 'bathroom',
    'bathrooms': 'bathroom',
    'bath': 'bathroom',
    'restroom': 'bathroom',
    'powder-room': 'bathroom',
    'living-room': 'living-room',
    'living-rooms': 'living-room',
    'living': 'living-room',
    'livingroom': 'living-room',
    'lounge': 'living-room',
    'bedroom': 'bedroom',
    'bedrooms': 'bedroom',
    'bedding': 'bedroom',
    'home-decor': 'home-decor',
    'decor': 'home-decor',
    'homedecor': 'home-decor',
    'decoration': 'home-decor',
    'textiles': 'home-decor',
    'furniture': 'furniture',
    'furnishings': 'furniture',
    'joinery': 'furniture',
    'lighting': 'lighting',
    'lights': 'lighting',
    'illumination': 'lighting',
    'lamps': 'lighting',
    'renovation': 'renovation',
    'renovations': 'renovation',
    'remodel': 'renovation',
    'remodeling': 'renovation',
    'cost': 'renovation',
    'budget': 'renovation',
    'diy': 'diy',
    'craft': 'diy',
    'crafts': 'diy',
    'garden-outdoor': 'garden-outdoor',
    'outdoor': 'garden-outdoor',
    'outdoors': 'garden-outdoor',
    'garden': 'garden-outdoor',
    'gardening': 'garden-outdoor',
    'patio': 'garden-outdoor',
    'courtyard': 'garden-outdoor',
    'landscape': 'garden-outdoor',
    'small-spaces': 'small-spaces',
    'small-space': 'small-spaces',
    'smallspaces': 'small-spaces',
    'compact': 'small-spaces',
    'micro': 'small-spaces',
    'studio': 'small-spaces',
    'design-trends': 'design-trends',
    'trends': 'design-trends',
    'designtrends': 'design-trends',
    'trend': 'design-trends',
    'aesthetic': 'design-trends'
  };

  return categoryMap[c] || (LOCKED_CATEGORIES.includes(c) ? c : null);
}

// Category vocabulary definition for high-precision semantic matching
const CATEGORY_VOCABULARY = {
  'kitchen': [
    'kitchen', 'air fryer', 'airfryer', 'fryer', 'pantry', 'scullery', 'cabinet', 'countertop',
    'cooktop', 'culinary', 'island', 'range', 'oven', 'stove', 'microwave', 'dishwasher',
    'refrigerator', 'fridge', 'freezer', 'cookware', 'bakeware', 'skillet', 'pot', 'pan',
    'knife', 'cutlery', 'cutting board', 'blender', 'toaster', 'food processor', 'baking',
    'cooking', 'recipe', 'roast', 'saute', 'sous vide', 'induction', 'backsplash', 'coffee maker',
    'espresso', 'foil', 'aluminum foil', 'parchment'
  ],
  'bathroom': [
    'bathroom', 'bath', 'shower', 'tub', 'bathtub', 'soaking tub', 'vanity', 'powder room',
    'toilet', 'faucet', 'tile', 'soaking', 'baño', 'bano', 'baños', 'banos', 'bidet',
    'wet room', 'curbless', 'towel bar', 'linear drain', 'medicine cabinet', 'grout'
  ],
  'bedroom': [
    'bedroom', 'bed', 'headboard', 'mattress', 'nightstand', 'wardrobe', 'master suite',
    'bedding', 'duvet', 'sheets', 'pillow', 'comforter', 'footboard', 'canopy bed',
    'sleeping', 'king bed', 'queen bed', 'twin bed', 'bedroom pic'
  ],
  'garden-outdoor': [
    'garden', 'outdoor', 'courtyard', 'patio', 'terrace', 'pergola', 'landscape', 'balcony',
    'deck', 'gazebo', 'planter', 'lawn', 'flagstone', 'paving', 'fire pit', 'outdoor kitchen',
    'outdoor dining', 'porch', 'veranda', 'trellis', 'botanical', 'horticulture', 'soil'
  ],
  'renovation': [
    'renovation', 'remodel', 'remodeling', 'budget', 'contractor', 'cost', 'pricing',
    'estimate', 'square foot', 'drywall', 'framing', 'subfloor', 'load bearing',
    'exterior painting', 'painting cost', 'siding', 'roof', 'roofing', 'permits',
    'hvac', 'plumbing rough', 'electrical rewiring', 'foundation', 'overhaul', 'labor rate'
  ],
  'diy': [
    'diy', 'limewash', 'plaster', 'venetian plaster', 'microcement', 'craft', 'upcycle',
    'woodworking', 'carpentry', 'how to make', 'how to build', 'handmade', 'handcrafted',
    'tutorial', 'chalk paint', 'refurbish', 'furniture flip'
  ],
  'furniture': [
    'furniture', 'chair', 'table', 'desk', 'joinery', 'woodcraft', 'credenza', 'timber',
    'sofa', 'couch', 'armchair', 'sectional', 'coffee table', 'sideboard', 'buffet',
    'bookcase', 'bookshelf', 'bed frame', 'dining table', 'dining chair', 'ottoman', 'bench'
  ],
  'lighting': [
    'lighting', 'light', 'sconce', 'pendant', 'chandelier', 'lamp', 'lampshade', 'cove',
    'led', 'illumination', 'luminaire', 'kelvin', 'downlight', 'recessed', 'dimmer',
    'ceiling light', 'flush mount'
  ],
  'small-spaces': [
    'small space', 'small spaces', 'small apartment', 'studio', 'tiny', 'compact', 'micro',
    'pocket door', 'murphy bed', 'space saving', 'storage hacks', 'micro living'
  ],
  'home-decor': [
    'home decor', 'decor', 'vase', 'vessel', 'rug', 'textile', 'art', 'wall art', 'gallery wall',
    'cushion', 'throw pillow', 'drapes', 'curtains', 'mirror', 'candle', 'sculpture'
  ],
  'design-trends': [
    'trend', 'trends', 'biophilic', 'forecast', 'aesthetic', 'quiet luxury', 'japandi',
    'minimalism', 'maximalism', 'color palette', 'mood board', 'wabi sabi'
  ],
  'living-room': [
    'living room', 'living', 'hearth', 'fireplace', 'mantel', 'seating area',
    'conversational seating', 'media console', 'tv wall'
  ]
};

// Intelligent keyword-to-category matcher with comprehensive scoring
export function detectCategoryFromKeyword(keyword) {
  const kw = (keyword || "").toLowerCase().trim();
  if (!kw) return 'home-decor';

  // 1. Direct priority matching by phrase/word length
  let bestCategory = null;
  let highestScore = 0;

  for (const [category, terms] of Object.entries(CATEGORY_VOCABULARY)) {
    let score = 0;
    for (const term of terms) {
      if (kw.includes(term)) {
        // Longer matching phrases carry much higher confidence
        const termScore = term.includes(' ') ? 10 : (term.length >= 6 ? 5 : 3);
        score += termScore;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestCategory = category;
    }
  }

  if (bestCategory && highestScore > 0) {
    return bestCategory;
  }

  // 2. Fallback heuristic based on generic context
  if (kw.includes('wall') || kw.includes('paint') || kw.includes('floor')) return 'renovation';
  if (kw.includes('room') || kw.includes('house') || kw.includes('home')) return 'home-decor';

  return 'home-decor';
}

export async function fetchKeywordsFromDrive(accessToken) {
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!folderId) {
    console.log("No GDRIVE_FOLDER_ID set. Skipping Google Drive keyword fetch.");
    return [];
  }

  try {
    // Search for Excel (.xlsx, .xls), CSV, Google Sheets, or any file with keyword in name
    const query = `'${folderId}' in parents and (name contains 'keyword' or name contains 'Keyword' or name contains '.xlsx' or name contains '.xls' or name contains '.csv' or mimeType = 'text/csv' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(` Drive keyword search query returned ${res.status}: ${errText}`);
      return [];
    }

    const data = await res.json();
    if (!data.files || data.files.length === 0) {
      console.log(" No keyword file found in Google Drive folder. Falling back to default queue.");
      return [];
    }

    const targetFile = data.files[0];
    console.log(` Found keyword file in Drive: "${targetFile.name}" (ID: ${targetFile.id}, Type: ${targetFile.mimeType})`);

    const keywords = [];

    if (targetFile.mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Export Google Sheet as CSV
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}/export?mimeType=text/csv`;
      const exportRes = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!exportRes.ok) throw new Error(`Failed to export Google Sheet: ${await exportRes.text()}`);
      const rawCsv = await exportRes.text();

      const lines = rawCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        const rawKeyword = parts[0];
        const rawCategory = parts[1] ? String(parts[1]).trim() : null;
        const normalizedCat = normalizeCategory(rawCategory) || detectCategoryFromKeyword(rawKeyword);
        if (rawKeyword) {
          keywords.push({
            topic: rawKeyword,
            category: normalizedCat
          });
        }
      }
    } else {
      // Download binary Excel (.xlsx, .xls) or raw text (.csv)
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`;
      const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) throw new Error(`Failed to download file: ${await downloadRes.text()}`);

      const arrayBuffer = await downloadRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse with XLSX parser (handles both binary Excel .xlsx/.xls and .csv perfectly)
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const rawKeyword = String(row[0] || "").trim();
        if (!rawKeyword) continue;
        
        // Skip header row if it says "keyword", "keywords", "topic"
        if (i === 0 && (rawKeyword.toLowerCase() === 'keywords' || rawKeyword.toLowerCase() === 'keyword' || rawKeyword.toLowerCase() === 'topic')) {
          continue;
        }

        const rawCategory = row[1] ? String(row[1]).trim() : null;
        const normalizedCat = normalizeCategory(rawCategory) || detectCategoryFromKeyword(rawKeyword);
        keywords.push({
          topic: rawKeyword,
          category: normalizedCat
        });
      }
    }

    console.log(` Loaded ${keywords.length} keywords from Google Drive Excel file!`);
    return keywords;
  } catch (err) {
    console.warn(" Warning while fetching keywords from Google Drive:", err.message);
    return [];
  }
}
