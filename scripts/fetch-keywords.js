/**
 * Google Drive / Sheets Keyword Fetcher
 * Reads keywords from an Excel file (.xlsx) or Google Sheet stored in Google Drive.
 */

import fs from 'fs';
import path from 'path';

export async function fetchKeywordsFromDrive(accessToken) {
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!folderId) {
    console.log("No GDRIVE_FOLDER_ID set. Skipping Google Drive keyword fetch.");
    return [];
  }

  try {
    // 1. Search for any file with 'keyword' in the name or .csv / .xlsx inside the target Drive folder
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
      // Export Google Sheet as CSV
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}/export?mimeType=text/csv`;
      const exportRes = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!exportRes.ok) throw new Error(`Failed to export Google Sheet as CSV: ${await exportRes.text()}`);
      rawContent = await exportRes.text();
    } else {
      // Download raw file content (CSV / text)
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${targetFile.id}?alt=media`;
      const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) throw new Error(`Failed to download file: ${await downloadRes.text()}`);
      rawContent = await downloadRes.text();
    }

    // Parse CSV lines: supports "Keyword,Category" or just "Keyword"
    const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const keywords = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if present
      if (i === 0 && (line.toLowerCase().includes('keyword') || line.toLowerCase().includes('topic'))) {
        continue;
      }
      
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts[0]) {
        keywords.push({
          topic: parts[0],
          category: parts[1] || 'living-room'
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
