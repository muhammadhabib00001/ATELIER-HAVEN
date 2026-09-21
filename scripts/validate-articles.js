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

  // 8. Lead Paragraph Check
  if (!content.includes('class="lead-paragraph"')) {
    console.error(`❌ Lead Paragraph VIOLATION: Missing <p class="lead-paragraph"> opening hook.`);
    hasErrors = true;
  } else {
    console.log(`✅ Lead Paragraph: <p class="lead-paragraph"> opening hook confirmed.`);
  }

  // 9. Quick Formula Featured Snippet Check
  const hasFormulaH2 = /<h2[^>]*id=["'][^"']*quick-formula[^"']*["'][^>]*>/i.test(content) || /<h2[^>]*>The Quick Formula/i.test(content);
  if (!hasFormulaH2) {
    console.error(`❌ Quick Formula VIOLATION: Missing first H2 'The Quick Formula to...' targeting Featured Snippet.`);
    hasErrors = true;
  } else {
    console.log(`✅ Featured Snippet Formula: 'The Quick Formula to...' H2 confirmed.`);
  }

  // 10. Editorial Quote Check
  if (!content.includes('editorial-quote')) {
    console.error(`❌ Editorial Quote VIOLATION: Missing <div class="editorial-quote"> block.`);
    hasErrors = true;
  } else {
    console.log(`✅ Editorial Quote: <div class="editorial-quote"> block confirmed.`);
  }

  // 11. FAQ Accordion Check (Exactly 3 items)
  const hasFaqAccordion = content.includes('faq-accordion') && content.includes('faq-item');
  const faqItemCount = (content.match(/class=["']faq-item["']/g) || []).length;
  if (!hasFaqAccordion || faqItemCount !== 3) {
    console.error(`❌ FAQ Accordion VIOLATION: Must contain <div class="faq-accordion"> with exactly 3 <div class="faq-item"> blocks (Found: ${faqItemCount}).`);
    hasErrors = true;
  } else {
    console.log(`✅ FAQ Accordion: Exactly 3 FAQ items wrapped in faq-accordion confirmed.`);
  }

  // 12. Concluding Checklist Check
  const hasChecklist = /<h2[^>]*id=["'][^"']*checklist[^"']*["'][^>]*>/i.test(content) || /<h2[^>]*>[^<]*Checklist<\/h2>/i.test(content);
  if (!hasChecklist) {
    console.error(`❌ Checklist VIOLATION: Missing concluding <h2 id="your-...-checklist"> section.`);
    hasErrors = true;
  } else {
    console.log(`✅ Concluding Checklist: Actionable checklist H2 confirmed.`);
  }

  // 13. Title Length Check (Strictly 55 to 60 characters)
  const titleLen = (article.title || '').length;
  if (titleLen < 55 || titleLen > 60) {
    console.error(`❌ Title Length VIOLATION: Title is ${titleLen} characters (Requirement: strictly 55 to 60 characters).`);
    hasErrors = true;
  } else {
    console.log(`✅ Title Length: ${titleLen} characters (within 55 - 60 range).`);
  }

  // 14. Heading Dash Check (0 dashes or hyphens)
  const headingMatches = [...content.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const dashHeadings = headingMatches.filter(m => m[2].includes('-') || m[2].includes('—'));
  if (dashHeadings.length > 0) {
    console.error(`❌ Heading Dash VIOLATION: Found hyphens/dashes in heading text: ${dashHeadings.map(m => m[2]).join(', ')}`);
    hasErrors = true;
  } else {
    console.log(`✅ Heading Text: 0 hyphens or dashes found.`);
  }
});

console.log(`------------------------------------------------------------\n`);
if (hasErrors) {
  console.error(`🚨 VALIDATION FAILED: One or more articles do not meet the locked publishing standards.\n`);
  process.exit(1);
} else {
  console.log(`🎉 ALL CHECKS PASSED: Articles strictly comply with all locked editorial and SEO rules!\n`);
}
