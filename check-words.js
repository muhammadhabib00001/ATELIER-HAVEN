import fs from "fs";

const articles = JSON.parse(fs.readFileSync("./src/data/articles.json", "utf-8"));

// 1. Process FAQ answers to be short with key info in bold
articles.forEach(a => {
  const faqIdx = a.content.indexOf('id="faq"');
  if (faqIdx !== -1) {
    const pre = a.content.slice(0, faqIdx);
    let post = a.content.slice(faqIdx);
    post = post.replace(/<p>([\s\S]*?)<\/p>/g, (match, inner) => {
      // Remove existing strong tags if any
      const cleaned = inner.replace(/<\/?strong>/g, "").trim();
      // Split into sentences
      const sentences = cleaned.split(/(?<=[.?!])\s+/);
      if (sentences.length > 0) {
        const keySentence = sentences[0].trim();
        const supporting = sentences[1] ? " " + sentences[1].trim() : "";
        return `<p><strong>${keySentence}</strong>${supporting}</p>`;
      }
      return match;
    });
    a.content = pre + post;
  }
});

fs.writeFileSync("./src/data/articles.json", JSON.stringify(articles, null, 2));

console.log("=== FINAL AUDIT OF ALL ARTICLES AFTER SHORT FAQ UPDATE ===");
let allPass = true;
articles.forEach((a, i) => {
  const text = a.content.replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const status = words >= 1000 ? "PASS" : "FAIL";
  if (words < 1000) allPass = false;
  console.log(`${(i+1).toString().padStart(2, " ")}. [${status}] ${words.toString().padStart(4, " ")} words -> ${a.slug}`);
});
console.log("\nTotal articles:", articles.length);
console.log("All articles satisfy >= 1,000 words:", allPass);

