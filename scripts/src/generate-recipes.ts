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

type MealSlotKey = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner" | "night_snack" | "dessert";

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
  meal_slots: MealSlotKey[];
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

let recipeCounter = 0;
function makeId(): string {
  return `seed_${++recipeCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Batches to generate (5 recipes each for reliable JSON output) ──────────
const BATCHES: Array<{ slot: MealSlotKey; theme: string }> = [
  // DINNER — 60 total in 12 batches of 5
  { slot: "dinner", theme: "Classic comfort: roast chicken, beef stew, shepherd's pie, pot roast, meatballs in tomato sauce" },
  { slot: "dinner", theme: "Italian classics: spaghetti carbonara, beef lasagna, chicken parmigiana, osso buco, penne arrabiata" },
  { slot: "dinner", theme: "Asian inspired: Thai green curry, Japanese chicken teriyaki, Korean beef bulgogi, Vietnamese pho, Chinese sweet and sour pork" },
  { slot: "dinner", theme: "Indian flavours: butter chicken, lamb rogan josh, prawn masala, saag paneer, chicken biryani" },
  { slot: "dinner", theme: "Seafood dinner: garlic butter prawns, lemon herb baked salmon, fish and chips, seafood linguine, pan-seared cod with capers" },
  { slot: "dinner", theme: "Mexican and Latin: beef tacos, chicken enchiladas, pork carnitas, black bean chili, chicken burrito bowl" },
  { slot: "dinner", theme: "Mediterranean: Greek moussaka, stuffed bell peppers, Moroccan chicken tagine, lamb kofta, shakshuka for dinner" },
  { slot: "dinner", theme: "Grilled and BBQ: grilled ribeye steak, BBQ pork ribs, herb-marinated chicken, honey mustard salmon, grilled lamb chops" },
  { slot: "dinner", theme: "Pasta night: creamy mushroom tagliatelle, pesto gnocchi, prawn linguine, sausage and fennel rigatoni, baked mac and cheese" },
  { slot: "dinner", theme: "Quick weeknight: 20-minute beef stir fry, chicken quesadillas, prawn fried rice, one-pan sausage and veg, egg and bacon pasta" },
  { slot: "dinner", theme: "Vegetarian mains: vegetable wellington, roasted vegetable tart, mushroom risotto, chickpea curry, lentil bolognese" },
  { slot: "dinner", theme: "Family favourites: homemade burgers, chicken schnitzel, fish pie, slow cooker pulled pork, creamy chicken and leek pie" },

  // LUNCH — 40 total in 8 batches of 5
  { slot: "lunch", theme: "Classic soups: French onion soup, chicken noodle soup, minestrone, leek and potato soup, tomato basil bisque" },
  { slot: "lunch", theme: "Hearty salads: Caesar salad with chicken, Greek salad, Niçoise salad, quinoa power bowl, Asian noodle salad" },
  { slot: "lunch", theme: "Sandwiches and toasties: classic BLT, club sandwich, tuna melt, croque monsieur, avocado and egg toast" },
  { slot: "lunch", theme: "Wraps and flatbreads: chicken wrap, falafel pitta, smoked salmon bagel, turkey and avocado wrap, grilled veg flatbread" },
  { slot: "lunch", theme: "Light rice and grain bowls: egg fried rice, tabbouleh bowl, spiced lentil rice, couscous salad, barley vegetable bowl" },
  { slot: "lunch", theme: "Lighter mains: prawn tacos, caprese salad with burrata, smoked salmon pasta, tomato and mozzarella bruschetta platter, Japanese ramen" },
  { slot: "lunch", theme: "Warming winter lunches: black bean soup, split pea soup, vegetable and barley broth, spiced pumpkin soup, baked potato with fillings" },
  { slot: "lunch", theme: "Protein-packed lunches: chicken Caesar wrap, tuna pasta salad, steak and arugula salad, edamame and sesame noodles, Greek chicken pita" },

  // BREAKFAST — 25 total in 5 batches of 5
  { slot: "breakfast", theme: "Classic hot breakfasts: fluffy American pancakes, French toast with maple syrup, full English breakfast, eggs Benedict, Spanish omelette" },
  { slot: "breakfast", theme: "Egg dishes: perfect scrambled eggs, shakshuka with feta, smashed avocado and poached eggs on sourdough, huevos rancheros, soft boiled eggs and soldiers" },
  { slot: "breakfast", theme: "Baked goods: banana bread, blueberry muffins, homemade granola bars, cinnamon French toast bake, almond croissants" },
  { slot: "breakfast", theme: "Healthy start: overnight oats, bircher muesli, acai smoothie bowl, Greek yogurt parfait with granola and berries, chia seed pudding" },
  { slot: "breakfast", theme: "Quick and easy: 5-minute protein oatmeal, smoothie breakfast bowl, cottage cheese and fruit, peanut butter banana toast, 2-ingredient banana pancakes" },

  // MORNING SNACKS — 8 total in 2 batches
  { slot: "morning_snack", count: 4, theme: "Morning snacks: bliss balls, baked oat bars, corn and feta fritters, bruschetta with tomato and basil" },
  { slot: "morning_snack", count: 4, theme: "Morning snacks: apple slices with nut butter, rice cakes with hummus, deviled eggs, cucumber with cream cheese" },

  // AFTERNOON SNACKS — 7 total (batches of 4 and 3)
  { slot: "afternoon_snack", count: 4, theme: "Afternoon dips and nibbles: classic guacamole, hummus with veggie sticks, baked tortilla chips and salsa, tzatziki with pita" },
  { slot: "afternoon_snack", count: 3, theme: "Afternoon snacks: nachos, caprese skewers, spinach and artichoke dip" },

  // DESSERTS — 10 total in 2 batches of 5
  { slot: "dessert", count: 5, theme: "Classic bakes: chewy chocolate chip cookies, classic apple pie, lemon drizzle cake, chocolate brownies, carrot cake with cream cheese frosting" },
  { slot: "dessert", count: 5, theme: "Impressive desserts: tiramisu, chocolate lava cakes, strawberry cheesecake, pavlova with cream and berries, crème brûlée" },
] as Array<{ slot: MealSlotKey; count?: number; theme: string }>;

// ── Claude API call ────────────────────────────────────────────────────────
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
      max_tokens: 8000,
      system: "You are a professional recipe writer. Always respond with valid JSON only — no markdown, no code fences, just raw JSON array.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }
  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content?.[0]?.text ?? "[]";
}

// ── Generate a batch ───────────────────────────────────────────────────────
async function generateBatch(
  slot: MealSlotKey,
  count: number,
  theme: string,
  sources: string,
  existingNames: Set<string>,
): Promise<SeedRecipe[]> {
  const prompt = `Generate ${count} detailed, realistic ${slot.replace("_", " ")} recipes inspired by ${sources}.

Theme: ${theme}

Requirements:
- Each recipe must be UNIQUE and different from these already generated: ${Array.from(existingNames).slice(-20).join(", ")}
- Include recipes from varied cuisines (American, Italian, Asian, Mediterranean, Indian, Mexican, British, etc.)
- Mix vegetarian and non-vegetarian options (about 30% vegetarian)
- All nutritional values must be realistic for the meal type
- Ingredients must include realistic amounts (e.g., "2 cloves", "200g", "1 cup")
- Method must have 4-8 clear, specific cooking steps
- chef_tip must be a practical, genuinely useful tip

Return a JSON array of exactly ${count} recipe objects. Each object must have ALL these fields:
{
  "name": "Recipe Name",
  "emoji": "🍗",
  "cuisine": "Italian",
  "cook_time": 30,
  "calories": 520,
  "protein": 35,
  "carbs": 48,
  "fat": 18,
  "vegetarian": false,
  "ingredients": [
    { "name": "chicken breast", "amount": "400g", "category": "meat" },
    { "name": "olive oil", "amount": "2 tbsp", "category": "condiments" }
  ],
  "method": [
    "Preheat oven to 200°C (400°F).",
    "Season chicken with salt, pepper and herbs.",
    "Heat oil in an oven-safe pan over high heat.",
    "Sear chicken 2-3 minutes per side until golden.",
    "Transfer to oven and bake 15-18 minutes until cooked through.",
    "Rest 5 minutes before serving."
  ],
  "chef_tip": "Letting the chicken rest keeps all the juices inside."
}

ingredient categories: meat, dairy, vegetables, fruit, grains, spices, condiments, canned, frozen, bakery, beverages, other

For meal_slot "${slot}" the calories should be:
- breakfast: 300-500 kcal
- morning_snack: 100-250 kcal  
- lunch: 350-600 kcal
- afternoon_snack: 100-250 kcal
- dinner: 450-750 kcal
- dessert: 200-450 kcal

Return ONLY the JSON array, no other text.`;

  let text = await callClaude(prompt);
  
  // Clean up any markdown fences
  text = text.replace(/^```json?\s*/m, "").replace(/```\s*$/m, "").trim();
  
  let rawRecipes: any[];
  try {
    rawRecipes = JSON.parse(text);
  } catch (e) {
    console.warn("JSON parse error, attempting to extract array...");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse recipe JSON");
    rawRecipes = JSON.parse(match[0]);
  }

  return rawRecipes.map((r: any) => {
    const name = String(r.name || "Recipe").trim();
    existingNames.add(name);
    return {
      id: makeId(),
      name,
      emoji: r.emoji || "🍽️",
      photo_color: pickColor(name),
      cuisine: String(r.cuisine || "International"),
      cook_time: Number(r.cook_time) || 30,
      calories: Number(r.calories) || 400,
      protein: Number(r.protein) || 20,
      carbs: Number(r.carbs) || 40,
      fat: Number(r.fat) || 15,
      vegetarian: Boolean(r.vegetarian),
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => ({
        name: String(i.name || ""),
        amount: String(i.amount || ""),
        category: String(i.category || "other"),
      })) : [],
      method: Array.isArray(r.method) ? r.method.map(String) : [],
      chef_tip: String(r.chef_tip || ""),
      notes: "",
      meal_slots: [slot],
      source_url: "",
      imported: false,
      family_code: "__seed__",
      created_at: new Date().toISOString(),
    } as SeedRecipe;
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🍽  Huddle Recipe Generator (AI-powered)");
  const totalTarget = BATCHES.reduce((s, b) => s + (b.count ?? 5), 0);
  console.log(`   Generating ${totalTarget} recipes across ${BATCHES.length} batches\n`);

  const allRecipes: SeedRecipe[] = [];
  const existingNames = new Set<string>();

  for (let i = 0; i < BATCHES.length; i++) {
    const { slot, count: batchCount, theme } = BATCHES[i];
    const count = batchCount ?? 5;
    console.log(`[Batch ${i + 1}/${BATCHES.length}] ${slot.toUpperCase()} — ${count} recipes`);
    console.log(`  Theme: ${theme.slice(0, 70)}...`);
    try {
      const recipes = await generateBatch(slot, count, theme, "", existingNames);
      allRecipes.push(...recipes);
      console.log(`  ✓ Got ${recipes.length} recipes (total: ${allRecipes.length})`);
      recipes.forEach((r) => console.log(`    • ${r.name} (${r.cuisine}, ${r.cook_time}min, ${r.calories}kcal)`));
    } catch (e: any) {
      console.error(`  ✗ Batch failed: ${e.message}`);
    }
    // Brief pause between batches
    if (i < BATCHES.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  // Summary
  const bySlot: Record<string, number> = {};
  for (const r of allRecipes) {
    const s = r.meal_slots[0];
    bySlot[s] = (bySlot[s] ?? 0) + 1;
  }
  console.log(`\n✅  Generated ${allRecipes.length} recipes total`);
  console.log("   By slot:", JSON.stringify(bySlot, null, 2));

  const outputPath = path.resolve(__dirname, "../../artifacts/huddle/public/seed-recipes.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), "utf8");
  console.log(`\n💾  Saved to: ${outputPath}`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
