/**
 * Google Drive Backup Utility
 * Backs up `src/data/articles.json` to a Google Drive folder.
 * 
 * Supports:
 * - Google Service Account Key (JSON string) in GDRIVE_SERVICE_ACCOUNT_KEY
 * - Or OAuth2 via GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN
 * Target folder: GDRIVE_FOLDER_ID
 */

import fs from 'fs';
import path from 'path';

async function getServiceAccountAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const toBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(claim)}`;

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  sign.end();
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to exchange Service Account JWT: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function getOAuthAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to refresh OAuth token: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function uploadToGoogleDrive(filePath, customName = null) {
  const folderId = process.env.GDRIVE_FOLDER_ID;
  const saKey = process.env.GDRIVE_SERVICE_ACCOUNT_KEY;
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  let accessToken = null;

  if (saKey) {
    console.log(" Authenticating with Google Drive via Service Account...");
    accessToken = await getServiceAccountAccessToken(saKey);
  } else if (clientId && clientSecret && refreshToken) {
    console.log(" Authenticating with Google Drive via OAuth2 Refresh Token...");
    accessToken = await getOAuthAccessToken(clientId, clientSecret, refreshToken);
  } else {
    console.warn("  No Google Drive credentials configured (GDRIVE_SERVICE_ACCOUNT_KEY or OAuth). Skipping Drive upload.");
    return null;
  }

  const fileName = customName || path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  const metadata = {
    name: fileName,
    mimeType: "application/json"
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  console.log(` Uploading "${fileName}" to Google Drive...`);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed: ${errText}`);
  }

  const result = await res.json();
  console.log(` Successfully uploaded to Google Drive! File ID: ${result.id}`);
  return result;
}

if (process.argv[1] && process.argv[1].endsWith('backup-to-drive.js')) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const articlesPath = path.resolve("./src/data/articles.json");
  
  uploadToGoogleDrive(articlesPath, `articles-backup-${timestamp}.json`)
    .catch(err => {
      console.error("Backup failed:", err.message);
      process.exit(1);
    });
}
