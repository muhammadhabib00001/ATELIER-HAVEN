/**
 * Google Drive / Sheets & Excel Keyword Fetcher
 * Reads keywords from Excel (.xlsx, .xls), CSV (.csv), or Google Sheets stored in Google Drive.
 * Automatically detects the right category from the keyword text.
 */

import * as XLSX from 'xlsx';

// Normalizes any category string into one of the 12 official site category slugs
export function normalizeCategory(cat) {
  if (!cat) return null;
  const c = String(cat).toLowerCase().trim().replace(/[_\s]+/g, '-');
  
  const categoryMap = {
    'kitchen': 'kitchen',
    'kitchens': 'kitchen',
    'bathroom': 'bathroom',
    'bathrooms': 'bathroom',
    'bath': 'bathroom',
    'living-room': 'living-room',
    'living-rooms': 'living-room',
    'living': 'living-room',
    'livingroom': 'living-room',
    'bedroom': 'bedroom',
    'bedrooms': 'bedroom',
    'home-decor': 'home-decor',
    'decor': 'home-decor',
    'homedecor': 'home-decor',
    'furniture': 'furniture',
    'furnishings': 'furniture',
    'lighting': 'lighting',
    'lights': 'lighting',
    'renovation': 'renovation',
    'renovations': 'renovation',
    'remodel': 'renovation',
    'diy': 'diy',
    'garden-outdoor': 'garden-outdoor',
    'outdoor': 'garden-outdoor',
    'garden': 'garden-outdoor',
    'outdoors': 'garden-outdoor',
    'small-spaces': 'small-spaces',
    'small-space': 'small-spaces',
    'smallspaces': 'small-spaces',
    'design-trends': 'design-trends',
    'trends': 'design-trends',
    'designtrends': 'design-trends',
    'trend': 'design-trends'
  };

  return categoryMap[c] || null;
}

// Intelligent keyword-to-category matcher
export function detectCategoryFromKeyword(keyword) {
  const kw = (keyword || "").toLowerCase();

  // 1. Bathroom
  if (
    kw.includes('bathroom') || kw.includes('bath') || kw.includes('shower') ||
    kw.includes('tub') || kw.includes('vanity') || kw.includes('powder room') ||
    kw.includes('toilet') || kw.includes('faucet') || kw.includes('tile') ||
    kw.includes('soaking')
  ) {
    return 'bathroom';
  }

  // 2. Kitchen
  if (
    kw.includes('kitchen') || kw.includes('pantry') || kw.includes('scullery') ||
    kw.includes('cabinet') || kw.includes('countertop') || kw.includes('cooktop') ||
    kw.includes('culinary') || kw.includes('island') || kw.includes('range')
  ) {
    return 'kitchen';
  }

  // 3. Bedroom
  if (
    kw.includes('bedroom') || kw.includes('bed') || kw.includes('headboard') ||
    kw.includes('mattress') || kw.includes('nightstand') || kw.includes('wardrobe') ||
    kw.includes('master suite')
  ) {
    return 'bedroom';
  }

  // 4. Living Room
  if (
    kw.includes('living room') || kw.includes('living') || kw.includes('sofa') ||
    kw.includes('couch') || kw.includes('hearth') || kw.includes('fireplace') ||
    kw.includes('seating') || kw.includes('lounge') || kw.includes('coffee table')
  ) {
    return 'living-room';
  }

  // 5. Lighting
  if (
    kw.includes('lighting') || kw.includes('light') || kw.includes('sconce') ||
    kw.includes('pendant') || kw.includes('chandelier') || kw.includes('lamp') ||
    kw.includes('cove') || kw.includes('led') || kw.includes('illumination')
  ) {
    return 'lighting';
  }

  // 6. Garden & Outdoor
  if (
    kw.includes('garden') || kw.includes('outdoor') || kw.includes('courtyard') ||
    kw.includes('patio') || kw.includes('terrace') || kw.includes('pergola') ||
    kw.includes('landscape') || kw.includes('balcony')
  ) {
    return 'garden-outdoor';
  }

  // 7. Small Spaces
  if (
    kw.includes('small space') || kw.includes('small apartment') || kw.includes('studio') ||
    kw.includes('tiny') || kw.includes('compact') || kw.includes('micro') ||
    kw.includes('pocket door')
  ) {
    return 'small-spaces';
  }

  // 8. Furniture
  if (
    kw.includes('furniture') || kw.includes('chair') || kw.includes('table') ||
    kw.includes('desk') || kw.includes('joinery') || kw.includes('woodcraft') ||
    kw.includes('credenza') || kw.includes('timber')
  ) {
    return 'furniture';
  }

  // 9. Renovation & DIY
  if (kw.includes('renovation') || kw.includes('remodel') || kw.includes('budget') || kw.includes('contractor')) {
    return 'renovation';
  }
  if (kw.includes('diy') || kw.includes('limewash') || kw.includes('plaster') || kw.includes('paint')) {
    return 'diy';
  }

  // 10. Design Trends
  if (kw.includes('trend') || kw.includes('biophilic') || kw.includes('forecast') || kw.includes('aesthetic') || kw.includes('quiet luxury')) {
    return 'design-trends';
  }

  // 11. Home Decor
  if (kw.includes('decor') || kw.includes('vase') || kw.includes('vessel') || kw.includes('rug') || kw.includes('textile') || kw.includes('art')) {
    return 'home-decor';
  }

  // Default fallback
  return 'living-room';
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
