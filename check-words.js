import fs from "fs";
const articles = JSON.parse(fs.readFileSync("./src/data/articles.json", "utf-8"));
console.log("=== FINAL AUDIT OF ALL ARTICLES ===");
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
