import 'dotenv/config';
import { getDriveAccessToken } from './backup-to-drive.js';

export async function submitUrlToGoogleIndexing(url, type = 'URL_UPDATED') {
  try {
    const accessToken = await getDriveAccessToken();
    if (!accessToken) {
      console.log(' No Google Service Account key found for Indexing API. Skipping direct indexing.');
      return null;
    }
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, type })
    });
    if (res.ok) {
      const data = await res.json();
      console.log(` Google Indexing API Success for ${url}:`, data);
      return data;
    } else {
      const err = await res.text();
      console.warn(` Google Indexing API notice (${res.status}): ${err}`);
      return null;
    }
  } catch (e) {
    console.warn(' Google Indexing API exception:', e.message);
    return null;
  }
}
