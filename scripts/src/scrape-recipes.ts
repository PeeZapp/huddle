import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Target URLs by slot ────────────────────────────────────────────────────
// Each entry is [url, slot, emoji_hint, cuisine_hint]
const RECIPE_TARGETS: [string, MealSlotKey, string, string][] = [
  // ── DINNER (60) ──────────────────────────────────────────────────────────
  // AllRecipes
  ["https://www.allrecipes.com/recipe/13742/best-chicken-ever/", "dinner", "🍗", "American"],
  ["https://www.allrecipes.com/recipe/228823/quick-beef-stir-fry/", "dinner", "🥩", "Chinese"],
  ["https://www.allrecipes.com/recipe/234410/world-best-lasagna/", "dinner", "🫕", "Italian"],
  ["https://www.allrecipes.com/recipe/54798/salmon-with-brown-sugar-and-bourbon-glaze/", "dinner", "🐟", "American"],
  ["https://www.allrecipes.com/recipe/16354/easy-meatloaf/", "dinner", "🍖", "American"],
  ["https://www.allrecipes.com/recipe/141520/thai-peanut-chicken/", "dinner", "🍜", "Thai"],
  ["https://www.allrecipes.com/recipe/229960/simple-beef-tacos/", "dinner", "🌮", "Mexican"],
  ["https://www.allrecipes.com/recipe/158968/spinach-and-feta-stuffed-chicken/", "dinner", "🍗", "Mediterranean"],
  ["https://www.allrecipes.com/recipe/219866/classic-beef-stew/", "dinner", "🍲", "American"],
  ["https://www.allrecipes.com/recipe/26317/chicken-and-rice/", "dinner", "🍚", "American"],
  // Epicurious
  ["https://www.epicurious.com/recipes/food/views/roast-chicken-236754", "dinner", "🍗", "French"],
  ["https://www.epicurious.com/recipes/food/views/pasta-with-tomato-cream-sauce-102356", "dinner", "🍝", "Italian"],
  ["https://www.epicurious.com/recipes/food/views/grilled-salmon-with-lemon-caper-sauce-51123420", "dinner", "🐟", "American"],
  ["https://www.epicurious.com/recipes/food/views/beef-tenderloin-with-red-wine-sauce-234079", "dinner", "🥩", "French"],
  ["https://www.epicurious.com/recipes/food/views/spaghetti-carbonara-51154260", "dinner", "🍝", "Italian"],
  // Serious Eats
  ["https://www.seriouseats.com/best-slow-cooker-chicken-tikka-masala-recipe", "dinner", "🍛", "Indian"],
  ["https://www.seriouseats.com/the-best-chili-recipe", "dinner", "🌶️", "American"],
  ["https://www.seriouseats.com/the-food-lab-complete-guide-to-pan-seared-steaks", "dinner", "🥩", "American"],
  ["https://www.seriouseats.com/sheet-pan-roasted-chicken-thighs-vegetables-recipe", "dinner", "🍗", "American"],
  ["https://www.seriouseats.com/the-best-beef-bolognese-sauce-recipe", "dinner", "🍝", "Italian"],
  // BBC Food
  ["https://www.bbc.co.uk/food/recipes/spaghetti_bolognese_with_85421", "dinner", "🍝", "Italian"],
  ["https://www.bbc.co.uk/food/recipes/chicken_tikka_masala_59920", "dinner", "🍛", "Indian"],
  ["https://www.bbc.co.uk/food/recipes/prawn_stir-fry_09547", "dinner", "🍤", "Chinese"],
  ["https://www.bbc.co.uk/food/recipes/beef_and_vegetable_curry_96520", "dinner", "🍛", "Indian"],
  ["https://www.bbc.co.uk/food/recipes/lemon_chicken_stir-fry_28883", "dinner", "🍗", "Chinese"],
  // RecipeTin Eats
  ["https://www.recipetineats.com/chicken-stir-fry/", "dinner", "🍗", "Asian"],
  ["https://www.recipetineats.com/beef-stroganoff/", "dinner", "🥩", "Russian"],
  ["https://www.recipetineats.com/pork-tenderloin-with-honey-garlic-sauce/", "dinner", "🥩", "American"],
  ["https://www.recipetineats.com/pasta-carbonara/", "dinner", "🍝", "Italian"],
  ["https://www.recipetineats.com/creamy-garlic-prawns/", "dinner", "🍤", "Australian"],
  ["https://www.recipetineats.com/butter-chicken/", "dinner", "🍛", "Indian"],
  ["https://www.recipetineats.com/lamb-chops/", "dinner", "🥩", "Australian"],
  ["https://www.recipetineats.com/oven-baked-salmon/", "dinner", "🐟", "American"],
  ["https://www.recipetineats.com/chicken-and-mushroom-pasta/", "dinner", "🍝", "Italian"],
  ["https://www.recipetineats.com/fish-tacos/", "dinner", "🌮", "Mexican"],
  ["https://www.allrecipes.com/recipe/23439/worlds-best-lasagna/", "dinner", "🫕", "Italian"],
  ["https://www.allrecipes.com/recipe/60598/slow-cooker-chicken-cacciatore/", "dinner", "🍗", "Italian"],
  ["https://www.allrecipes.com/recipe/8932/best-marinara-sauce-yet/", "dinner", "🍅", "Italian"],
  ["https://www.allrecipes.com/recipe/229993/easy-chicken-marsala/", "dinner", "🍗", "Italian"],
  ["https://www.allrecipes.com/recipe/76888/easy-baked-tilapia/", "dinner", "🐟", "American"],
  ["https://www.allrecipes.com/recipe/40356/simple-whole-roasted-chicken/", "dinner", "🍗", "American"],
  ["https://www.allrecipes.com/recipe/45669/grilled-chicken-breasts/", "dinner", "🍗", "American"],
  ["https://www.allrecipes.com/recipe/25473/beef-teriyaki/", "dinner", "🥩", "Japanese"],
  ["https://www.allrecipes.com/recipe/109334/absolutely-ultimate-potato-soup/", "dinner", "🥣", "American"],
  ["https://www.allrecipes.com/recipe/12151/amazing-ribs/", "dinner", "🍖", "American"],
  ["https://www.bbc.co.uk/food/recipes/thaigreencurry_73005", "dinner", "🍛", "Thai"],
  ["https://www.bbc.co.uk/food/recipes/fishcakes_72015", "dinner", "🐟", "British"],
  ["https://www.bbc.co.uk/food/recipes/easy_moussaka_11271", "dinner", "🫕", "Greek"],
  ["https://www.bbc.co.uk/food/recipes/sausageandlentilstew_86268", "dinner", "🌭", "British"],
  ["https://www.bbc.co.uk/food/recipes/baked_cod_with_a_herb_01270", "dinner", "🐟", "British"],
  ["https://www.recipetineats.com/shakshuka/", "dinner", "🍳", "Middle Eastern"],
  ["https://www.recipetineats.com/tom-kha-gai-thai-coconut-soup/", "dinner", "🍜", "Thai"],
  ["https://www.recipetineats.com/chicken-burrito-bowls/", "dinner", "🌯", "Mexican"],
  ["https://www.recipetineats.com/creamy-mushroom-pasta/", "dinner", "🍝", "Italian"],
  ["https://www.recipetineats.com/lemon-herb-baked-chicken/", "dinner", "🍗", "American"],
  ["https://www.epicurious.com/recipes/food/views/short-ribs-braised-with-mushrooms-and-tomatoes-234255", "dinner", "🍖", "American"],
  ["https://www.epicurious.com/recipes/food/views/roasted-lamb-leg-with-garlic-and-rosemary-51176600", "dinner", "🥩", "Mediterranean"],

  // ── LUNCH (40) ────────────────────────────────────────────────────────────
  ["https://www.allrecipes.com/recipe/14586/grilled-cheese-sandwich/", "lunch", "🥪", "American"],
  ["https://www.allrecipes.com/recipe/25355/chicken-caesar-salad/", "lunch", "🥗", "American"],
  ["https://www.allrecipes.com/recipe/9023/minestrone-soup-i/", "lunch", "🥣", "Italian"],
  ["https://www.allrecipes.com/recipe/14841/quick-and-easy-chicken-noodle-soup/", "lunch", "🍜", "American"],
  ["https://www.allrecipes.com/recipe/212721/caprese-salad/", "lunch", "🥗", "Italian"],
  ["https://www.allrecipes.com/recipe/77202/classic-blt/", "lunch", "🥪", "American"],
  ["https://www.allrecipes.com/recipe/11966/potato-leek-soup/", "lunch", "🥣", "French"],
  ["https://www.allrecipes.com/recipe/87949/tuna-salad/", "lunch", "🥗", "American"],
  ["https://www.bbc.co.uk/food/recipes/tuna_nicoise_salad_47788", "lunch", "🥗", "French"],
  ["https://www.bbc.co.uk/food/recipes/leek_and_potato_soup_33522", "lunch", "🥣", "British"],
  ["https://www.bbc.co.uk/food/recipes/tomato_soup_73021", "lunch", "🥣", "British"],
  ["https://www.bbc.co.uk/food/recipes/chicken_quesadillas_63092", "lunch", "🌮", "Mexican"],
  ["https://www.recipetineats.com/greek-salad/", "lunch", "🥗", "Greek"],
  ["https://www.recipetineats.com/chicken-wrap/", "lunch", "🌯", "American"],
  ["https://www.recipetineats.com/lentil-soup/", "lunch", "🥣", "Middle Eastern"],
  ["https://www.recipetineats.com/noodle-salad/", "lunch", "🥗", "Asian"],
  ["https://www.recipetineats.com/chicken-salad-sandwich/", "lunch", "🥪", "American"],
  ["https://www.seriouseats.com/classic-egg-salad-recipe", "lunch", "🥗", "American"],
  ["https://www.seriouseats.com/the-best-french-onion-soup-recipe", "lunch", "🥣", "French"],
  ["https://www.seriouseats.com/easy-gazpacho-recipe", "lunch", "🥣", "Spanish"],
  ["https://www.epicurious.com/recipes/food/views/tomato-basil-soup-231228", "lunch", "🥣", "Italian"],
  ["https://www.epicurious.com/recipes/food/views/nicoise-salad-102048", "lunch", "🥗", "French"],
  ["https://www.allrecipes.com/recipe/239047/caesar-salad-supreme/", "lunch", "🥗", "American"],
  ["https://www.allrecipes.com/recipe/237787/broccoli-cheddar-soup/", "lunch", "🥣", "American"],
  ["https://www.allrecipes.com/recipe/62420/slow-cooker-chicken-noodle-soup/", "lunch", "🍜", "American"],
  ["https://www.allrecipes.com/recipe/76326/easy-club-sandwich/", "lunch", "🥪", "American"],
  ["https://www.bbc.co.uk/food/recipes/healthyeggfriedrice_89232", "lunch", "🍚", "Chinese"],
  ["https://www.bbc.co.uk/food/recipes/spiced_lentil_soup_99512", "lunch", "🥣", "Indian"],
  ["https://www.bbc.co.uk/food/recipes/smoked_salmon_and_cream_17459", "lunch", "🥯", "British"],
  ["https://www.recipetineats.com/avocado-chicken-salad/", "lunch", "🥗", "American"],
  ["https://www.recipetineats.com/vietnamese-noodle-salad-with-lemongrass-chicken/", "lunch", "🥗", "Vietnamese"],
  ["https://www.recipetineats.com/caprese-salad/", "lunch", "🥗", "Italian"],
  ["https://www.recipetineats.com/pasta-salad/", "lunch", "🥗", "American"],
  ["https://www.epicurious.com/recipes/food/views/curried-chicken-salad-51163110", "lunch", "🥗", "American"],
  ["https://www.epicurious.com/recipes/food/views/black-bean-soup-107631", "lunch", "🥣", "Mexican"],
  ["https://www.seriouseats.com/tuscan-bean-soup-recipe", "lunch", "🥣", "Italian"],
  ["https://www.seriouseats.com/vegetarian-black-bean-tacos-recipe", "lunch", "🌮", "Mexican"],
  ["https://www.allrecipes.com/recipe/24009/award-winning-soft-chocolate-chip-cookies/", "lunch", "🥗", "American"],
  ["https://www.allrecipes.com/recipe/228823/quick-beef-fried-rice/", "lunch", "🍚", "Chinese"],
  ["https://www.bbc.co.uk/food/recipes/coronation_chicken_wrap_34120", "lunch", "🌯", "British"],

  // ── BREAKFAST (25) ────────────────────────────────────────────────────────
  ["https://www.allrecipes.com/recipe/20166/fluffy-pancakes/", "breakfast", "🥞", "American"],
  ["https://www.allrecipes.com/recipe/17891/best-french-toast/", "breakfast", "🍞", "American"],
  ["https://www.allrecipes.com/recipe/213742/scrambled-eggs-done-right/", "breakfast", "🍳", "American"],
  ["https://www.allrecipes.com/recipe/228823/avocado-toast/", "breakfast", "🥑", "American"],
  ["https://www.allrecipes.com/recipe/162760/quick-oatmeal/", "breakfast", "🥣", "American"],
  ["https://www.bbc.co.uk/food/recipes/full_english_breakfast_45428", "breakfast", "🍳", "British"],
  ["https://www.bbc.co.uk/food/recipes/granola_84210", "breakfast", "🥣", "British"],
  ["https://www.bbc.co.uk/food/recipes/shakshuka_79148", "breakfast", "🍳", "Middle Eastern"],
  ["https://www.bbc.co.uk/food/recipes/blueberry_muffins_67629", "breakfast", "🫐", "American"],
  ["https://www.bbc.co.uk/food/recipes/simpleporridge_77437", "breakfast", "🥣", "British"],
  ["https://www.recipetineats.com/banana-bread/", "breakfast", "🍌", "American"],
  ["https://www.recipetineats.com/blueberry-pancakes/", "breakfast", "🥞", "American"],
  ["https://www.recipetineats.com/healthy-breakfast-bowls/", "breakfast", "🥣", "American"],
  ["https://www.seriouseats.com/the-best-scrambled-eggs-recipe", "breakfast", "🍳", "American"],
  ["https://www.seriouseats.com/classic-eggs-benedict-recipe", "breakfast", "🍳", "American"],
  ["https://www.epicurious.com/recipes/food/views/best-basic-pancakes-232073", "breakfast", "🥞", "American"],
  ["https://www.epicurious.com/recipes/food/views/fruit-and-yogurt-smoothie-51165700", "breakfast", "🥤", "American"],
  ["https://www.allrecipes.com/recipe/24717/worlds-best-waffles/", "breakfast", "🧇", "American"],
  ["https://www.allrecipes.com/recipe/213742/easy-eggs-benedict/", "breakfast", "🍳", "American"],
  ["https://www.allrecipes.com/recipe/92760/greek-yogurt-parfait/", "breakfast", "🍦", "American"],
  ["https://www.bbc.co.uk/food/recipes/bircher_muesli_26699", "breakfast", "🥣", "Swiss"],
  ["https://www.bbc.co.uk/food/recipes/acai_smoothie_bowl_03210", "breakfast", "🫐", "Brazilian"],
  ["https://www.recipetineats.com/soft-boiled-eggs/", "breakfast", "🥚", "American"],
  ["https://www.seriouseats.com/perfect-fried-eggs-recipe", "breakfast", "🍳", "American"],
  ["https://www.epicurious.com/recipes/food/views/overnight-oats-56389842", "breakfast", "🥣", "American"],

  // ── SNACKS (15) ───────────────────────────────────────────────────────────
  ["https://www.allrecipes.com/recipe/23600/worlds-best-guacamole/", "afternoon_snack", "🥑", "Mexican"],
  ["https://www.allrecipes.com/recipe/213742/hummus/", "afternoon_snack", "🫘", "Middle Eastern"],
  ["https://www.allrecipes.com/recipe/23288/tzatziki-sauce/", "afternoon_snack", "🥒", "Greek"],
  ["https://www.bbc.co.uk/food/recipes/houmous_40033", "afternoon_snack", "🫘", "Middle Eastern"],
  ["https://www.bbc.co.uk/food/recipes/nachos_with_tomato_salsa_24982", "afternoon_snack", "🌮", "Mexican"],
  ["https://www.recipetineats.com/guacamole/", "afternoon_snack", "🥑", "Mexican"],
  ["https://www.recipetineats.com/spinach-dip/", "afternoon_snack", "🥬", "American"],
  ["https://www.seriouseats.com/the-best-hummus-recipe", "afternoon_snack", "🫘", "Middle Eastern"],
  ["https://www.allrecipes.com/recipe/84445/garlic-bread/", "afternoon_snack", "🍞", "Italian"],
  ["https://www.bbc.co.uk/food/recipes/bruschetta_14730", "morning_snack", "🍅", "Italian"],
  ["https://www.epicurious.com/recipes/food/views/guacamole-with-charred-jalapeno-51227070", "afternoon_snack", "🥑", "Mexican"],
  ["https://www.recipetineats.com/corn-fritters/", "morning_snack", "🌽", "Australian"],
  ["https://www.allrecipes.com/recipe/16354/deviled-eggs/", "morning_snack", "🥚", "American"],
  ["https://www.bbc.co.uk/food/recipes/simple_energy_balls_45320", "morning_snack", "🍫", "British"],
  ["https://www.seriouseats.com/baked-tortilla-chips-recipe", "afternoon_snack", "🌮", "Mexican"],

  // ── DESSERTS (10) ─────────────────────────────────────────────────────────
  ["https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/", "dessert", "🍪", "American"],
  ["https://www.allrecipes.com/recipe/29363/apple-pie-by-grandma-ople/", "dessert", "🥧", "American"],
  ["https://www.bbc.co.uk/food/recipes/easy_chocolate_fudge_45180", "dessert", "🍫", "British"],
  ["https://www.bbc.co.uk/food/recipes/strawberry_cheesecake_with_10640", "dessert", "🍰", "American"],
  ["https://www.recipetineats.com/chocolate-lava-cake/", "dessert", "🎂", "French"],
  ["https://www.epicurious.com/recipes/food/views/classic-tiramisu-51118620", "dessert", "🍰", "Italian"],
  ["https://www.seriouseats.com/the-best-chocolate-chip-cookies-recipe", "dessert", "🍪", "American"],
  ["https://www.allrecipes.com/recipe/9023/tiramisu-ii/", "dessert", "🍰", "Italian"],
  ["https://www.bbc.co.uk/food/recipes/pavlova_with_mango_34890", "dessert", "🍰", "Australian"],
  ["https://www.recipetineats.com/brownies/", "dessert", "🍫", "American"],
];

// ── Helpers ────────────────────────────────────────────────────────────────
let reqId = 0;

async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} for ${url}`);
        if (res.status === 429 || res.status === 403) {
          await sleep(5000 + i * 3000);
          continue;
        }
        return null;
      }
      return await res.text();
    } catch (e: any) {
      console.warn(`  Fetch error (${i + 1}/${retries}): ${e.message}`);
      if (i < retries - 1) await sleep(2000 + i * 1000);
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonLd(html: string): Record<string, any>[] {
  const $ = cheerio.load(html);
  const results: Record<string, any>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const data = JSON.parse(raw);
      const flatten = (obj: any): void => {
        if (!obj) return;
        if (Array.isArray(obj)) { obj.forEach(flatten); return; }
        if (obj["@type"] === "Recipe") { results.push(obj); return; }
        if (obj["@graph"]) { flatten(obj["@graph"]); return; }
      };
      flatten(data);
    } catch { /* ignore bad JSON */ }
  });
  return results;
}

function parseTime(val: string | undefined): number {
  if (!val) return 30;
  // ISO 8601 duration: PT15M, PT1H30M
  const hours = val.match(/(\d+)H/i)?.[1] ?? "0";
  const minutes = val.match(/(\d+)M/i)?.[1] ?? "0";
  return parseInt(hours) * 60 + parseInt(minutes) || 30;
}

function parseNutrition(nutrition: Record<string, any> | undefined, slotKey: MealSlotKey) {
  if (!nutrition) {
    // Reasonable defaults by slot
    const defaults: Record<MealSlotKey, { calories: number; protein: number; carbs: number; fat: number }> = {
      breakfast: { calories: 380, protein: 14, carbs: 50, fat: 12 },
      morning_snack: { calories: 180, protein: 5, carbs: 22, fat: 8 },
      lunch: { calories: 480, protein: 22, carbs: 55, fat: 15 },
      afternoon_snack: { calories: 200, protein: 6, carbs: 25, fat: 9 },
      dinner: { calories: 580, protein: 32, carbs: 52, fat: 22 },
      night_snack: { calories: 150, protein: 4, carbs: 20, fat: 6 },
      dessert: { calories: 320, protein: 5, carbs: 48, fat: 14 },
    };
    return defaults[slotKey];
  }
  const parseG = (v: any): number => {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
    return isNaN(n) ? 0 : Math.round(n);
  };
  return {
    calories: parseG(nutrition.calories ?? nutrition.kcal),
    protein: parseG(nutrition.proteinContent),
    carbs: parseG(nutrition.carbohydrateContent),
    fat: parseG(nutrition.fatContent),
  };
}

function parseIngredients(raw: string[] | string | undefined): { name: string; amount: string; category: string }[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.slice(0, 20).map((line) => {
    const str = String(line).replace(/<[^>]+>/g, "").trim();
    const catMap: [RegExp, string][] = [
      [/\b(beef|chicken|pork|lamb|turkey|salmon|tuna|shrimp|prawn|fish|bacon|ham|sausage)\b/i, "meat"],
      [/\b(milk|cream|butter|cheese|yogurt|egg)\b/i, "dairy"],
      [/\b(onion|garlic|tomato|pepper|carrot|celery|spinach|kale|broccoli|potato|mushroom|zucchini|courgette|leek|cabbage|lettuce|cucumber|corn|pea|bean)\b/i, "vegetables"],
      [/\b(apple|banana|lemon|lime|orange|berry|mango|pineapple|grape|cherry|avocado)\b/i, "fruit"],
      [/\b(rice|pasta|flour|bread|quinoa|oat|noodle)\b/i, "grains"],
      [/\b(salt|pepper|cumin|coriander|paprika|cinnamon|thyme|rosemary|oregano|basil|curry|chili|turmeric)\b/i, "spices"],
      [/\b(oil|vinegar|sauce|ketchup|mustard|mayo|soy|honey|maple|worcestershire)\b/i, "condiments"],
      [/\b(can|tin|canned|tomatoes|coconut|broth|stock|paste)\b/i, "canned"],
    ];
    let category = "other";
    for (const [re, cat] of catMap) {
      if (re.test(str)) { category = cat; break; }
    }
    // Try to split amount vs name
    const match = str.match(/^([\d\/\s\-]+(?:cup|tbsp|tsp|oz|lb|g|kg|ml|l|pinch|handful|clove|medium|large|small|whole)?s?\.?\s+)/i);
    const amount = match ? match[0].trim() : "";
    const name = amount ? str.slice(amount.length).trim() : str;
    return { name: name || str, amount, category };
  });
}

function parseMethod(raw: any[] | string | undefined): string[] {
  if (!raw) return ["Prepare all ingredients.", "Cook according to your preference.", "Serve and enjoy."];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.slice(0, 12).map((step: any) => {
    if (typeof step === "string") return step.replace(/<[^>]+>/g, "").trim();
    if (step?.text) return String(step.text).replace(/<[^>]+>/g, "").trim();
    if (step?.["@type"] === "HowToStep") return String(step.text || step.name || "").replace(/<[^>]+>/g, "").trim();
    return String(step).trim();
  }).filter(Boolean);
}

function isVegetarian(ingredients: { name: string }[], name: string): boolean {
  const meatWords = /\b(beef|chicken|pork|lamb|turkey|salmon|tuna|shrimp|prawn|fish|bacon|ham|sausage|meat|duck|veal|crab|lobster|anchovy)\b/i;
  return !meatWords.test(name) && !ingredients.some((i) => meatWords.test(i.name));
}

function getCuisineFromKeywords(keywords: string | string[] | undefined, fallback: string): string {
  const kws = Array.isArray(keywords) ? keywords.join(" ") : (keywords ?? "");
  const cuisineMap: [RegExp, string][] = [
    [/italian/i, "Italian"], [/mexican/i, "Mexican"], [/chinese|asian/i, "Chinese"],
    [/indian/i, "Indian"], [/thai/i, "Thai"], [/japanese/i, "Japanese"],
    [/french/i, "French"], [/greek/i, "Greek"], [/spanish/i, "Spanish"],
    [/middle eastern|lebanese|turkish/i, "Middle Eastern"], [/british/i, "British"],
    [/american/i, "American"], [/mediterranean/i, "Mediterranean"],
  ];
  for (const [re, c] of cuisineMap) {
    if (re.test(kws)) return c;
  }
  return fallback || "International";
}

function generateId(): string {
  return `seed_${++reqId}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateChefTip(name: string, slot: MealSlotKey): string {
  const tips: Record<MealSlotKey, string[]> = {
    dinner: [
      "Let meat rest 5 minutes before cutting for juicier results.",
      "Taste and adjust seasoning right before serving.",
      "A splash of lemon juice brightens the whole dish.",
      "Don't overcrowd the pan — cook in batches for better browning.",
    ],
    lunch: [
      "Prep the ingredients the night before for a quick assembly.",
      "Season with salt and pepper as you go for layered flavour.",
      "Add fresh herbs right before serving for the best aroma.",
    ],
    breakfast: [
      "Don't overmix batter — lumps are fine and make things fluffier.",
      "Let your pan fully heat before adding eggs.",
      "Fresh fruit makes a great topping and adds natural sweetness.",
    ],
    morning_snack: [
      "Prep in batches and store in the fridge for the week.",
      "Pair with fresh vegetables for a balanced snack.",
    ],
    afternoon_snack: [
      "These keep well in an airtight container for 3 days.",
      "Serve at room temperature for the best flavour.",
    ],
    night_snack: ["Keep portions light to sleep well.", "A warm drink pairs nicely."],
    dessert: [
      "Room-temperature butter and eggs make a much smoother batter.",
      "Don't open the oven door while baking — it can cause sinking.",
      "A pinch of salt enhances sweetness in any dessert.",
    ],
  };
  const arr = tips[slot] ?? tips.dinner;
  return arr[Math.floor(Math.random() * arr.length)];
}

const PHOTO_COLORS: string[] = [
  "#E8905A", "#5AADE8", "#E8CA5A", "#5AE8A0", "#E85A5A",
  "#9C5AE8", "#5AE8D8", "#E8705A", "#638C22", "#E8B45A",
  "#5A7CE8", "#E87B9E", "#90E85A", "#5AE89C", "#D45AE8",
];

function pickColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return PHOTO_COLORS[hash % PHOTO_COLORS.length];
}

// ── Main scraper ───────────────────────────────────────────────────────────
async function scrapeRecipe(
  url: string,
  slotKey: MealSlotKey,
  emojiHint: string,
  cuisineHint: string,
): Promise<SeedRecipe | null> {
  console.log(`  Fetching: ${url}`);
  const html = await fetchWithRetry(url);
  if (!html) return null;

  const ldItems = extractJsonLd(html);
  const ld = ldItems[0];
  if (!ld) {
    console.warn(`  No JSON-LD Recipe found for ${url}`);
    return null;
  }

  const name = String(ld.name || "").trim();
  if (!name) return null;

  const cookTime = parseTime(ld.totalTime ?? ld.cookTime ?? ld.prepTime);
  const nutrition = parseNutrition(ld.nutrition, slotKey);
  const ingredients = parseIngredients(ld.recipeIngredient);
  const method = parseMethod(ld.recipeInstructions);
  const cuisine = getCuisineFromKeywords(ld.recipeCuisine ?? ld.keywords, cuisineHint);
  const vegetarian = isVegetarian(ingredients, name);

  return {
    id: generateId(),
    name,
    emoji: emojiHint,
    photo_color: pickColor(name),
    cuisine,
    cook_time: cookTime,
    calories: nutrition.calories || 400,
    protein: nutrition.protein || 20,
    carbs: nutrition.carbs || 40,
    fat: nutrition.fat || 15,
    vegetarian,
    ingredients,
    method,
    chef_tip: generateChefTip(name, slotKey),
    notes: "",
    meal_slots: [slotKey],
    source_url: url,
    imported: true,
    family_code: "__seed__",
    created_at: new Date().toISOString(),
  };
}

async function main() {
  console.log(`\n🍽  Huddle Recipe Scraper`);
  console.log(`   Targets: ${RECIPE_TARGETS.length} recipes\n`);

  const recipes: SeedRecipe[] = [];
  const failed: string[] = [];

  for (let i = 0; i < RECIPE_TARGETS.length; i++) {
    const [url, slot, emoji, cuisine] = RECIPE_TARGETS[i];
    console.log(`[${i + 1}/${RECIPE_TARGETS.length}] ${slot.toUpperCase()}`);
    try {
      const recipe = await scrapeRecipe(url, slot, emoji, cuisine);
      if (recipe) {
        recipes.push(recipe);
        console.log(`  ✓ ${recipe.name} (${recipe.cook_time}min, ${recipe.calories}kcal)`);
      } else {
        failed.push(url);
        console.log(`  ✗ Failed to parse`);
      }
    } catch (e: any) {
      failed.push(url);
      console.log(`  ✗ Error: ${e.message}`);
    }
    // Polite delay: 800–1500ms between requests
    if (i < RECIPE_TARGETS.length - 1) {
      await sleep(800 + Math.random() * 700);
    }
  }

  // Slot summary
  const slotCount: Record<string, number> = {};
  for (const r of recipes) {
    const s = r.meal_slots[0];
    slotCount[s] = (slotCount[s] ?? 0) + 1;
  }

  console.log(`\n✅  Scraped ${recipes.length} / ${RECIPE_TARGETS.length} recipes`);
  console.log("   By slot:", JSON.stringify(slotCount, null, 2));
  if (failed.length) console.log(`   Failed (${failed.length}):`, failed);

  const outputPath = path.resolve(__dirname, "../../artifacts/huddle/public/seed-recipes.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2), "utf8");
  console.log(`\n💾  Saved to: ${outputPath}`);
}

main().catch(console.error);
