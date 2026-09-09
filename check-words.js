import fs from "fs";

const articles = JSON.parse(fs.readFileSync("./src/data/articles.json", "utf-8"));

// Clean, high-impact titles optimized for Google Search SERPs (under 60 chars for SEO title)
const titleMapping = {
  "15-essential-kitchen-tools-culinary-sanctuary": {
    title: "15 Essential Kitchen Tools for the Modern Home Chef",
    seoTitle: "15 Essential Kitchen Tools for Modern Home Chefs | Atrium Livings"
  },
  "minimalist-japanese-soaking-tub-design": {
    title: "Minimalist Japanese Soaking Tub Design Guide",
    seoTitle: "Japanese Soaking Tub Design Guide | Atrium Livings"
  },
  "biophilic-minimalism-living-room": {
    title: "Biophilic Minimalism in Modern Living Room Design",
    seoTitle: "Biophilic Minimalism Living Room Guide | Atrium Livings"
  },
  "small-bathroom-floor-tile-ideas-that-maximize-space": {
    title: "15 Small Bathroom Floor Tile Ideas That Maximize Space",
    seoTitle: "15 Small Bathroom Floor Tile Ideas | Atrium Livings"
  },
  "bathroom-layout-ideas-spatial-planning-guide": {
    title: "Master Bathroom Layout Guide: 7 Architectural Floor Plans",
    seoTitle: "Master Bathroom Layout Guide: 7 Floor Plans | Atrium Livings"
  },
  "organic-modern-kitchen-cabinetry-marble-trends": {
    title: "The Organic Modern Kitchen: Cabinetry, Marble & Trends",
    seoTitle: "Organic Modern Kitchen Design & Trends | Atrium Livings"
  },
  "japandi-living-room-styling-organic-modernism": {
    title: "Japandi Living Rooms: Wabi-Sabi Aesthetics & Scandi Coziness",
    seoTitle: "Japandi Living Room Styling & Design | Atrium Livings"
  },
  "curated-gallery-wall-bathroom-art-ideas": {
    title: "Classy Bathroom Wall Art: 12 Curated Gallery Ideas",
    seoTitle: "12 Classy Bathroom Wall Art Ideas | Atrium Livings"
  },
  "primary-bedroom-lighting-layers-and-acoustic-serenity": {
    title: "Primary Bedroom Design: Acoustic Serenity & 2700K Lighting",
    seoTitle: "Primary Bedroom Lighting & Acoustics | Atrium Livings"
  },
  "sustainable-timber-furniture-investment-guide": {
    title: "Sustainable Hardwood Furniture: Walnut, Oak & Joinery Guide",
    seoTitle: "Sustainable Hardwood Furniture Guide | Atrium Livings"
  },
  "small-space-architecture-micro-luxury-solutions": {
    title: "Micro-Luxury: 9 Architectural Ideas for Small Spaces",
    seoTitle: "Micro-Luxury: 9 Small Space Solutions | Atrium Livings"
  },
  "architectural-renovation-budgeting-contractor-guide": {
    title: "The Realistic Home Renovation Budget & Contractor Guide",
    seoTitle: "Realistic Home Renovation Budget Guide | Atrium Livings"
  },
  "limewash-paint-application-diy-masterclass": {
    title: "Roman Plaster & Limewash Paint Application Masterclass",
    seoTitle: "Limewash Paint & Roman Plaster Guide | Atrium Livings"
  },
  "sculptural-lighting-layers-and-alabaster-fixtures": {
    title: "Architectural Lighting: 2700K Warm Dimming & Sconces",
    seoTitle: "Architectural Lighting Design & Fixtures | Atrium Livings"
  },
  "courtyard-gardens-and-alfresco-living-terraces": {
    title: "Courtyard Gardens & Cantilevers: Indoor-Outdoor Living",
    seoTitle: "Courtyard Gardens & Cantilevers Guide | Atrium Livings"
  },
  "design-trends-forecast-quiet-luxury-and-earth-minerals": {
    title: "Interior Design Trends: Quiet Luxury & Earth Minerals",
    seoTitle: "Design Trends: Quiet Luxury & Minerals | Atrium Livings"
  },
  "modern-scullery-butler-pantry-spatial-planning-joinery-stone": {
    title: "Modern Scullery & Butler Pantry Architectural Guide",
    seoTitle: "Modern Scullery & Butler Pantry Guide | Atrium Livings"
  }
};

let count = 0;
articles.forEach(a => {
  if (titleMapping[a.slug]) {
    a.title = titleMapping[a.slug].title;
    a.seoTitle = titleMapping[a.slug].seoTitle;
    count++;
  }
});

fs.writeFileSync("./src/data/articles.json", JSON.stringify(articles, null, 2));
console.log(`Updated ${count} articles with SEO-optimized titles!`);

console.log("\n=== TITLE AUDIT ===");
articles.forEach((a, i) => {
  console.log(`${(i+1).toString().padStart(2, " ")}. H1 (${a.title.length} chars): ${a.title}`);
  console.log(`    SEO (${a.seoTitle.length} chars): ${a.seoTitle}`);
});

