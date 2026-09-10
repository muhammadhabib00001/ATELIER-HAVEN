/**
 * Google Drive / Sheets Keyword Fetcher
 * Reads keywords from an Excel file (.xlsx, .csv) or Google Sheet stored in Google Drive.
 * Automatically detects the right category from the keyword name if category is not provided.
 */

import fs from 'fs';
import path from 'path';

// Intelligent keyword-to-category matcher
export function detectCategoryFromKeyword(keyword) {
  const kw = keyword.toLowerCase();

  // 1. Bathroom
  if (
    kw.includes('bathroom') || kw.includes('bath') || kw.includes('shower') ||
    kw.includes('tub') || kw.includes('vanity') || kw.includes('powder room') ||
    kw.includes('toilet') || kw.includes('faucet') || kw.includes('tile')
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

  // 10. Home Decor
  if (kw.includes('decor') || kw.includes('vase') || kw.includes('vessel') || kw.includes('rug') || kw.includes('textile') || kw.includes('art')) {
    return 'home-decor';
  }

  // Fallback
  return 'living-room';
}

export async function fetchKeywordsFromDrive(accessToken) {
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!folderId) {
    console.log("No GDRIVE_FOLDER_ID set. Skipping Google Drive keyword fetch.");
    return [];
  }

  try {
    const query = `'${folderId}' in parents and (name contains 'keyword' or name contains 'Keyword' or mimeType = 'text/csv' or mimeType = 'application/vnd.google-apps.spreadsheet') and trashed = false`;
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

    let rawContent = "";

    if (targetFile.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}/export?mimeType=text/csv`;
      const exportRes = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!exportRes.ok) throw new Error(`Failed to export Google Sheet as CSV: ${await exportRes.text()}`);
      rawContent = await exportRes.text();
    } else {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`;
      const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) throw new Error(`Failed to download file: ${await downloadRes.text()}`);
      rawContent = await downloadRes.text();
    }

    const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const keywords = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes('keyword') || line.toLowerCase().includes('topic'))) {
        continue;
      }
      
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const rawKeyword = parts[0];
      if (rawKeyword) {
        // Use specified category if present; otherwise intelligently auto-detect category from the keyword text!
        const category = parts[1] || detectCategoryFromKeyword(rawKeyword);
        keywords.push({
          topic: rawKeyword,
          category: category
        });
      }
    }

    console.log(` Loaded ${keywords.length} keywords from Google Drive!`);
    return keywords;
  } catch (err) {
    console.warn(" Warning while fetching keywords from Google Drive:", err.message);
    return [];
  }
}
