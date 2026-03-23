import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error("Missing AI_INTEGRATIONS_ANTHROPIC_BASE_URL or AI_INTEGRATIONS_ANTHROPIC_API_KEY");
  process.exit(1);
}

interface SeedRecipe {
  id: string;
  name: string;
  emoji: string;
  photo_color: string;
  cuisine: string;
  cook_time: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vegetarian: boolean;
  ingredients: { name: string; amount: string; category: string }[];
  method: string[];
  chef_tip: string;
  notes: string;
  meal_slots: string[];
  source_url: string;
  imported: boolean;
  family_code: string;
  created_at: string;
}

const PHOTO_COLORS = [
  "#E8905A", "#5AADE8", "#E8CA5A", "#5AE8A0", "#E85A5A",
  "#9C5AE8", "#5AE8D8", "#E8705A", "#639922", "#E8B45A",
  "#5A7CE8", "#E87B9E", "#90E85A", "#5AE89C", "#D45AE8",
  "#F4A460", "#8FBC8F", "#DDA0DD", "#87CEEB", "#F0E68C",
];

function pickColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return PHOTO_COLORS[hash % PHOTO_COLORS.length];
}

let counter = 0;
function makeId(): string {
  return `seed_dinner_${++counter}_${Math.random().toString(36).slice(2, 7)}`;
}

// 6 batches of 5 = 30 unique dinners, each batch a different cuisine/style
const BATCHES = [
  "Classic Western comfort food — exactly these 5 dishes: Slow-Roasted Lamb Shoulder, Beef and Guinness Pie, Chicken and Mushroom Casserole, Pork Belly with Apple Sauce, Baked Cod with Herb Crust",
  "Italian and Mediterranean — exactly these 5 dishes: Spaghetti Carbonara, Chicken Parmigiana, Beef Lasagna, Mushroom Risotto, Sicilian Baked Sea Bass",
  "Asian favourites — exactly these 5 dishes: Butter Chicken, Thai Green Prawn Curry, Korean Beef Bulgogi, Japanese Chicken Teriyaki, Pad Thai",
  "Seafood and fish — exactly these 5 dishes: Garlic Butter Prawns with Linguine, Baked Lemon Herb Salmon, Pan-Seared Cod with Capers, Fish Tacos with Mango Salsa, Spanish Seafood Paella",
  "Mexican and Middle Eastern — exactly these 5 dishes: Beef Tacos al Pastor, Chicken Enchiladas Verde, Moroccan Lamb Tagine, Shakshuka with Feta, Lebanese Chicken Shawarma",
  "Vegetarian and quick weeknight — exactly these 5 dishes: Mushroom and Lentil Bolognese, Chickpea and Spinach Curry, Roasted Vegetable Tart, Black Bean Chili, Creamy Tomato Gnocchi",
];

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: "You are a professional recipe writer. Always respond with valid, complete JSON array only — no markdown, no code fences, just raw JSON.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content?.[0]?.text ?? "[]";
}

async function generateBatch(theme: string): Promise<SeedRecipe[]> {
  const prompt = `Generate exactly 5 detailed dinner recipes. Use these EXACT dish names (do not rename or change them): ${theme}.

IMPORTANT: Return exactly 5 recipes, one for each dish listed above, in that order.

For each recipe return a JSON object with ALL these fields:
{
  "name": "Exact dish name from the list above",
  "emoji": "single food emoji",
  "cuisine": "cuisine type",
  "cook_time": number_of_minutes_as_integer,
  "calories": realistic_integer_around_500_700,
  "protein": integer_grams,
  "carbs": integer_grams,
  "fat": integer_grams,
  "vegetarian": true_or_false,
  "ingredients": [
    { "name": "ingredient name", "amount": "realistic amount e.g. 400g or 2 cloves", "category": "one of: meat|dairy|vegetables|fruit|grains|spices|condiments|canned|other" }
  ],
  "method": ["Step 1 text.", "Step 2 text.", "...up to 6 steps"],
  "chef_tip": "One specific, practical cooking tip"
}

Requirements:
- ingredients: 6-10 items with realistic amounts
- method: 4-6 clear, detailed steps
- nutritional values must be realistic for a dinner portion
- chef_tip must be genuinely useful

Return ONLY a valid JSON array of 5 objects, nothing else.`;

  let text = await callClaude(prompt);
  text = text.replace(/^```json?\s*/m, "").replace(/```\s*$/m, "").trim();

  let raw: any[];
  try {
    raw = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found in response");
    raw = JSON.parse(match[0]);
  }

  return raw.map((r: any) => {
    const name = String(r.name || "").trim();
    return {
      id: makeId(),
      name,
      emoji: r.emoji || "🍽️",
      photo_color: pickColor(name),
      cuisine: String(r.cuisine || "International"),
      cook_time: Number(r.cook_time) || 40,
      calories: Number(r.calories) || 550,
      protein: Number(r.protein) || 30,
      carbs: Number(r.carbs) || 50,
      fat: Number(r.fat) || 20,
      vegetarian: Boolean(r.vegetarian),
      ingredients: Array.isArray(r.ingredients)
        ? r.ingredients.map((i: any) => ({
            name: String(i.name || "").trim(),
            amount: String(i.amount || "").trim(),
            category: String(i.category || "other"),
          }))
        : [],
      method: Array.isArray(r.method) ? r.method.map(String).filter(Boolean) : [],
      chef_tip: String(r.chef_tip || ""),
      notes: "",
      meal_slots: ["dinner"],
      source_url: "",
      imported: false,
      family_code: "__seed__",
      created_at: new Date().toISOString(),
    } as SeedRecipe;
  });
}

const OUT_PATH = path.resolve(__dirname, "../../artifacts/huddle/public/seed-recipes.json");

function saveProgress(all: SeedRecipe[]) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2), "utf8");
}

function loadExisting(): { recipes: SeedRecipe[]; seen: Set<string> } {
  try {
    if (fs.existsSync(OUT_PATH)) {
      const data = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) as SeedRecipe[];
      if (Array.isArray(data) && data.length > 0) {
        const seen = new Set(data.map((r) => r.name.toLowerCase()));
        console.log(`📂  Loaded ${data.length} existing recipes from file\n`);
        return { recipes: data, seen };
      }
    }
  } catch { /* ignore */ }
  return { recipes: [], seen: new Set() };
}

async function main() {
  console.log("\n🍽  Generating 30 unique dinner recipes\n");

  // Resume from existing file if present
  const { recipes: all, seen } = loadExisting();

  for (let i = 0; i < BATCHES.length; i++) {
    // Skip batches whose dishes are already fully in the file
    const batchNames = BATCHES[i]
      .split(/[:,]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 5);
    const alreadyDone = batchNames.filter((n) => seen.has(n)).length;
    if (alreadyDone >= 3) {
      console.log(`[Batch ${i + 1}/${BATCHES.length}] ⏭  Already done — skipping`);
      continue;
    }

    console.log(`[Batch ${i + 1}/${BATCHES.length}]`);
    try {
      const recipes = await generateBatch(BATCHES[i]);

      const unique = recipes.filter((r) => {
        const key = r.name.toLowerCase();
        if (seen.has(key)) {
          console.log(`  ⚠ Duplicate skipped: ${r.name}`);
          return false;
        }
        seen.add(key);
        return true;
      });

      all.push(...unique);
      unique.forEach((r) =>
        console.log(`  ✓ ${r.name} | ${r.cuisine} | ${r.cook_time}min | ${r.calories}kcal | ${r.vegetarian ? "🥦 veg" : "🥩 meat"}`)
      );

      // Save after every successful batch
      saveProgress(all);
      console.log(`  💾  Progress saved (${all.length} total)`);
    } catch (e: any) {
      console.error(`  ✗ Failed: ${e.message}`);
    }

    if (i < BATCHES.length - 1) await new Promise((r) => setTimeout(r, 600));
  }

  // Final report
  const dupes = [...new Map(all.map((r) => [r.name.toLowerCase(), r])).values()];
  if (dupes.length < all.length) {
    console.warn(`\n⚠  Removed ${all.length - dupes.length} duplicates`);
  }

  console.log(`\n✅  Total: ${all.length} dinner recipes (${all.filter((r) => r.vegetarian).length} vegetarian)`);
  console.log(`💾  Final file → ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
