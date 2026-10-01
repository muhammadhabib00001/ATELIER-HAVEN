import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/data/articles.json';
const articles = JSON.parse(readFileSync(filePath, 'utf-8'));

const fixes = [
  {
    slug: 'industrial-style-floor-lamp-guide',
    find: '<div class="faq-item"><h3>Are industrial floor lamps suitable for small living rooms?</h3></div>',
    replace: '<div class="faq-item"><h3>Are industrial floor lamps suitable for small living rooms?</h3><p><strong>Yes, industrial floor lamps work well in small living rooms when positioned in a corner beside a sofa or reading chair.</strong> Choose a slim tripod or single-stem model under 60 inches tall, and keep the base footprint under 12 inches in diameter so the lamp adds vertical drama without consuming precious floor area.</p></div>'
  },
  {
    slug: 'bathroom-storage-planning-guide',
    find: '<div class="faq-item"><h3>How can I maximize storage in a very small bathroom?</h3></div>',
    replace: '<div class="faq-item"><h3>How can I maximize storage in a very small bathroom?</h3><p><strong>Install a recessed medicine cabinet, wall-mounted floating shelves, and an over-toilet storage unit to use vertical and wall space fully.</strong> Replace a freestanding pedestal sink with a vanity cabinet, use drawer organizers inside, and add a slim rolling cart beside the toilet for towels and toiletries.</p></div>'
  },
  {
    slug: 'inspiring-living-room-ideas-for-a-beautiful-modern-home',
    find: '<div class="faq-item"><h3>How do you arrange furniture in a small living room?</h3></div>',
    replace: '<div class="faq-item"><h3>How do you arrange furniture in a small living room?</h3><p><strong>Float all seating pieces away from walls to create an intimate conversation zone anchored by a central rug.</strong> Choose a compact two-seat sofa over a large three-seater, keep a 30-inch clearance along all walking pathways, and use a slim console table behind the sofa instead of a bulky sideboard.</p></div>'
  },
  {
    slug: 'house-exterior-design-guide',
    find: '<div class="faq-item"><h3>How often should I repaint my wood siding?</h3></div>',
    replace: '<div class="faq-item"><h3>How often should I repaint my wood siding?</h3><p><strong>Repaint wood siding every 5 to 7 years in moderate climates, and every 3 to 4 years in harsh sun or coastal salt air environments.</strong> Look for warning signs such as peeling edges, fading color, or wood grain showing through the paint film before the full cycle ends, as early touch-ups prevent costly full-strip repaints.</p></div>'
  },
  {
    slug: 'mastering-modern-gallery-wall-design',
    find: '<div class="faq-item"><h3>How do I mix different frame styles without making the wall look messy?</h3></div>',
    replace: '<div class="faq-item"><h3>How do I mix different frame styles without making the wall look messy?</h3><p><strong>Unify mixed frame styles by limiting your palette to two metal finishes and one wood tone across the entire arrangement.</strong> Keep consistent spacing of one and a half to two inches between all frames, and align the top or center lines of frames in the same row to create visual order even when styles differ.</p></div>'
  },
  {
    slug: 'mastering-modern-gallery-wall-design',
    find: '<div class="faq-item"><h3>What is the best way to hang heavy frames safely on drywall?</h3></div>',
    replace: '<div class="faq-item"><h3>What is the best way to hang heavy frames safely on drywall?</h3><p><strong>Use toggle bolt anchors or locate wall studs with a stud finder for frames heavier than 20 pounds.</strong> For frames under 20 pounds, adhesive picture-hanging strips rated for the specific weight work on smooth painted walls. Always hang frames from two hanging points, never one, to prevent tilting and reduce wall stress.</p></div>'
  }
];

let totalFixed = 0;

for (const article of articles) {
  for (const fix of fixes) {
    if (fix.slug === article.slug && article.content.includes(fix.find)) {
      article.content = article.content.replace(fix.find, fix.replace);
      console.log(`✅ Fixed: [${fix.slug}] "${fix.find.substring(22, 80)}..."`);
      totalFixed++;
    }
  }
}

writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf-8');
console.log(`\n✅ Total fixes applied: ${totalFixed}`);

// Verify no more missing answers
const remaining = articles.filter(a =>
  /<div class="faq-item"><h3>[^<]+<\/h3><\/div>/.test(a.content)
);
if (remaining.length === 0) {
  console.log('✅ VERIFICATION PASSED: All FAQ items now have answers.');
} else {
  console.log(`❌ Still ${remaining.length} articles with missing FAQ answers:`);
  remaining.forEach(a => console.log(`  - ${a.slug}`));
}
