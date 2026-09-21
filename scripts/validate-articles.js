import fs from 'fs';
import path from 'path';

const articlesPath = path.resolve('src/data/articles.json');
const rawData = fs.readFileSync(articlesPath, 'utf8');
const articles = JSON.parse(rawData);

const BANNED_WORDS = [
  'delve',
  'testament',
  'tapestry',
  'game-changer',
  'more than just',
  'in conclusion',
  'furthermore',
  'architectural',
  'elevate',
  'beacon',
  'realm',
  'embark',
  'meticulous',
  'crucial',
  'essential',
  'seamless',
  'nestled',
  'whispers of',
  'symphony',
  'dance of',
  'look no further',
  'let\'s explore',
  'in today\'s world'
];

let hasErrors = false;

console.log(`\n🔍 Validating ${articles.length} article(s) against Locked Editorial & SEO Standards...\n`);

articles.forEach((article, index) => {
  console.log(`------------------------------------------------------------`);
  console.log(`Article [${index + 1}/${articles.length}]: "${article.title}"`);
  console.log(`Slug: /${article.slug}/`);

  const content = article.content || '';

  // 1. Word Count Check (1000 - 1200 words)
  const plainText = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = plainText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (wordCount < 1000 || wordCount > 1200) {
    console.error(`❌ Word Count VIOLATION: Found ${wordCount} words (Requirement: 1,000 to 1,200 words).`);
    hasErrors = true;
  } else {
    console.log(`✅ Word Count: ${wordCount} words (within 1,000 - 1,200 range).`);
  }

  // 2. Em dash Check (0 allowed)
  if (content.includes('—') || content.includes('&mdash;') || content.includes(' -- ')) {
    console.error(`❌ Em Dash VIOLATION: Found em dashes (—) or unescaped double hyphens. (Requirement: 0 em dashes).`);
    hasErrors = true;
  } else {
    console.log(`✅ Em Dashes: None found (0 em dashes).`);
  }

  // 3. Banned AI Words Check
  const foundBanned = [];
  const lowerContent = content.toLowerCase();
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerContent)) {
      foundBanned.push(word);
    }
  }

  if (foundBanned.length > 0) {
    console.error(`❌ Banned AI Words VIOLATION: Found banned words: ${foundBanned.join(', ')}`);
    hasErrors = true;
  } else {
    console.log(`✅ Banned AI Words: 0 found (Clean human editorial voice).`);
  }

  // 4. External Links Check (Exactly 1)
  const extLinkMatches = content.match(/<a\s+[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi) || [];
  if (extLinkMatches.length !== 1) {
    console.error(`❌ External Link VIOLATION: Found ${extLinkMatches.length} external links (Requirement: Exactly 1).`);
    hasErrors = true;
  } else {
    console.log(`✅ External Links: Exactly 1 external authority link found.`);
  }

  // 5. Internal Links Check (Exactly 2)
  const intLinkMatches = content.match(/<a\s+[^>]*href=["']\/(?!https?)[^"']*["'][^>]*>/gi) || [];
  if (intLinkMatches.length !== 2) {
    console.error(`❌ Internal Link VIOLATION: Found ${intLinkMatches.length} internal links (Requirement: Exactly 2).`);
    hasErrors = true;
  } else {
    console.log(`✅ Internal Links: Exactly 2 natural internal links found.`);
  }

  // 6. Editorial Table Check
  const hasTable = content.includes('<table') && content.includes('editorial-table') && content.includes('table-container');
  if (!hasTable) {
    console.error(`❌ Table VIOLATION: Missing <table class="editorial-table"> inside <div class="table-container">.`);
    hasErrors = true;
  } else {
    console.log(`✅ Editorial Table: High-utility specification matrix table is present.`);
  }

  // 7. Heading Hierarchy
  const hasH2 = /<h2[^>]*>/i.test(content);
  const hasH3 = /<h3[^>]*>/i.test(content);
  if (!hasH2 || !hasH3) {
    console.error(`❌ Heading Hierarchy VIOLATION: Missing structured H2/H3 subheadings.`);
    hasErrors = true;
  } else {
    console.log(`✅ Heading Hierarchy: Structured H2/H3 hierarchy confirmed.`);
  }
});

console.log(`------------------------------------------------------------\n`);
if (hasErrors) {
  console.error(`🚨 VALIDATION FAILED: One or more articles do not meet the locked publishing standards.\n`);
  process.exit(1);
} else {
  console.log(`🎉 ALL CHECKS PASSED: Articles strictly comply with all locked editorial and SEO rules!\n`);
}
