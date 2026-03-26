import { DAYS, Day, MealSlotKey, NutritionGoals, Recipe } from "./types";

// ── Core meals — the only slots assumed when NOT selected ─────────────────────
// Snacks and dessert are purely optional: no calories assumed if not in the plan.

export const CORE_SLOTS: MealSlotKey[] = ["breakfast", "lunch", "dinner"];

export const OPTIONAL_SLOTS: MealSlotKey[] = [
  "morning_snack",
  "afternoon_snack",
  "night_snack",
  "dessert",
];

// Typical nutrition for each slot (used for proportional budgeting)
export const SLOT_ASSUMED: Record<MealSlotKey, { calories: number; protein: number }> = {
  breakfast:       { calories: 380, protein: 20 },
  morning_snack:   { calories: 140, protein:  7 },
  lunch:           { calories: 560, protein: 30 },
  afternoon_snack: { calories: 180, protein:  8 },
  dinner:          { calories: 660, protein: 38 },
  night_snack:     { calories: 140, protein:  7 },
  dessert:         { calories: 220, protein:  5 },
};

export const ALL_MEAL_SLOTS: MealSlotKey[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "night_snack",
  "dessert",
];

// Which slot can a recipe fill?
function recipeMatchesSlot(recipe: Recipe, slot: MealSlotKey): boolean {
  const rs = recipe.meal_slots ?? [];
  if (rs.includes(slot)) return true;
  // Any snack slot accepts any other snack-tagged recipe
  const isSnackSlot = slot === "morning_snack" || slot === "afternoon_snack" || slot === "night_snack";
  if (isSnackSlot && (rs.includes("morning_snack") || rs.includes("afternoon_snack") || rs.includes("night_snack"))) {
    return true;
  }
  return false;
}

// Return recipes that can fill a slot (falls back to the full library if nothing matches)
// Base recipes (is_component) and excluded recipes are never picked for auto-generation.
export function recipesForSlot(recipes: Recipe[], slot: MealSlotKey): Recipe[] {
  const eligible = recipes.filter(r => !r.is_component && !r.excluded_from_auto);
  const matched  = eligible.filter(r => recipeMatchesSlot(r, slot));
  return matched.length > 0 ? matched : eligible;
}

// Calculate calorie/protein target for one slot.
//
// Rule:
//   - Only unselected CORE slots (breakfast/lunch/dinner) count as "assumed eaten"
//   - Unselected optional slots (snacks, dessert) are NOT assumed — the user just
//     isn't having them, so no calories are subtracted from the budget for them
//   - The remaining budget is distributed across all selected slots proportionally
function slotTarget(
  slot: MealSlotKey,
  selectedSlots: MealSlotKey[],
  goals: NutritionGoals,
): { calories: number; protein: number } {
  // Only unselected CORE meals are assumed
  const unselectedCore = CORE_SLOTS.filter(s => !selectedSlots.includes(s));
  const assumedCal  = unselectedCore.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0);
  const assumedProt = unselectedCore.reduce((sum, s) => sum + SLOT_ASSUMED[s].protein,  0);

  // Remaining budget for every slot the plan covers (core + optional if selected)
  const budgetCal  = Math.max(goals.calories - assumedCal,  80);
  const budgetProt = Math.max(goals.protein  - assumedProt,  5);

  // This slot's share of the budget, weighted by its typical calorie contribution
  const totalSelectedCal  = selectedSlots.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0);
  const totalSelectedProt = selectedSlots.reduce((sum, s) => sum + SLOT_ASSUMED[s].protein,  0);

  const shareCal  = totalSelectedCal  > 0 ? SLOT_ASSUMED[slot].calories / totalSelectedCal  : 1 / selectedSlots.length;
  const shareProt = totalSelectedProt > 0 ? SLOT_ASSUMED[slot].protein  / totalSelectedProt : 1 / selectedSlots.length;

  return {
    calories: Math.round(budgetCal  * shareCal),
    protein:  Math.round(budgetProt * shareProt),
  };
}

export interface GeneratedSlot {
  day:    Day;
  slot:   MealSlotKey;
  recipe: Recipe;
  targetCalories: number;
  targetProtein:  number;
}

const STAPLE_INGREDIENTS = new Set([
  "salt",
  "pepper",
  "black pepper",
  "water",
  "olive oil",
  "vegetable oil",
  "canola oil",
  "butter",
]);

function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function recipeIngredientSet(recipe: Recipe): Set<string> {
  return new Set(
    (recipe.ingredients ?? [])
      .map((i) => normalizeIngredientName(i.name || ""))
      .filter((n) => n && !STAPLE_INGREDIENTS.has(n)),
  );
}

function dominantProtein(recipe: Recipe): string {
  const names = (recipe.ingredients ?? []).map((i) => normalizeIngredientName(i.name || ""));
  const has = (terms: string[]) => names.some((n) => terms.some((t) => n.includes(t)));
  if (has(["chicken"])) return "chicken";
  if (has(["beef", "steak", "mince"])) return "beef";
  if (has(["pork", "bacon", "ham"])) return "pork";
  if (has(["salmon", "tuna", "fish", "prawn", "shrimp"])) return "seafood";
  if (has(["tofu", "tempeh", "lentil", "bean", "chickpea"])) return "plant";
  if (has(["egg"])) return "egg";
  if (has(["turkey"])) return "turkey";
  return "other";
}

export function generateMealPlan(
  selectedSlots: MealSlotKey[],
  existingSlotKeys: Set<string>,   // "day_slot" keys already in the plan
  recipes: Recipe[],
  goals: NutritionGoals,
): GeneratedSlot[] {
  if (selectedSlots.length === 0 || recipes.length === 0) return [];

  const results: GeneratedSlot[] = [];

  // Track ids used per slot this week to maximise variety
  const usedPerSlot = new Map<MealSlotKey, Set<string>>(
    selectedSlots.map(s => [s, new Set<string>()]),
  );
  const ingredientUsage = new Map<string, number>();
  const proteinUsage = new Map<string, number>();
  const cuisineUsage = new Map<string, number>();

  const PROTEIN_HARD_CAP = 3;
  const CUISINE_HARD_CAP = 3;

  for (const day of DAYS) {
    for (const slot of selectedSlots) {
      const key = `${day}_${slot}`;
      if (existingSlotKeys.has(key)) continue;

      const target = slotTarget(slot, selectedSlots, goals);
      const pool   = recipesForSlot(recipes, slot);

      const used       = usedPerSlot.get(slot)!;
      const unused     = pool.filter(r => !used.has(r.id));
      const candidates = unused.length > 0 ? unused : pool;

      const eligibleByHardCaps = candidates.filter((r) => {
        const proteinKey = dominantProtein(r);
        const cuisineKey = (r.cuisine || "unknown").toLowerCase();
        return (proteinUsage.get(proteinKey) ?? 0) < PROTEIN_HARD_CAP &&
          (cuisineUsage.get(cuisineKey) ?? 0) < CUISINE_HARD_CAP;
      });
      const scoringPool = eligibleByHardCaps.length > 0 ? eligibleByHardCaps : candidates;

      const scored = scoringPool.map(r => {
        const calDiff  = Math.abs((r.calories ?? target.calories) - target.calories);
        const protDiff = Math.abs((r.protein  ?? target.protein)  - target.protein);
        const nutritionScore = calDiff + protDiff * 4;

        // Encourage some overlap to reduce waste and simplify shopping.
        const ingSet = recipeIngredientSet(r);
        let overlapHits = 0;
        ingSet.forEach((ing) => {
          if (ingredientUsage.has(ing)) overlapHits += 1;
        });
        const overlapBoost = Math.min(overlapHits, 4) * 35;

        const proteinKey = dominantProtein(r);
        const proteinPenalty = (proteinUsage.get(proteinKey) ?? 0) * 55;

        const cuisineKey = (r.cuisine || "unknown").toLowerCase();
        const cuisinePenalty = (cuisineUsage.get(cuisineKey) ?? 0) * 30;

        return { recipe: r, score: nutritionScore + proteinPenalty + cuisinePenalty - overlapBoost };
      });
      scored.sort((a, b) => a.score - b.score);

      const topN   = Math.min(3, scored.length);
      const picked = scored[Math.floor(Math.random() * topN)].recipe;

      used.add(picked.id);
      recipeIngredientSet(picked).forEach((ing) => {
        ingredientUsage.set(ing, (ingredientUsage.get(ing) ?? 0) + 1);
      });
      const proteinKey = dominantProtein(picked);
      proteinUsage.set(proteinKey, (proteinUsage.get(proteinKey) ?? 0) + 1);
      const cuisineKey = (picked.cuisine || "unknown").toLowerCase();
      cuisineUsage.set(cuisineKey, (cuisineUsage.get(cuisineKey) ?? 0) + 1);

      results.push({ day, slot, recipe: picked, targetCalories: target.calories, targetProtein: target.protein });
    }
  }

  return results;
}
