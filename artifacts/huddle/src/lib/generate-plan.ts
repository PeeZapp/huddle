import { DAYS, Day, MealSlotKey, NutritionGoals, Recipe } from "./types";

// ----- Assumed nutrition for slots NOT in the plan -----
// Used to estimate what the user has already eaten so we can
// budget the remaining calories/protein toward the planned slots.

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
  // Any "snack" slot can use morning_snack/afternoon_snack/night_snack tagged recipes
  const isSnackSlot = slot === "morning_snack" || slot === "afternoon_snack" || slot === "night_snack";
  if (isSnackSlot && (rs.includes("morning_snack") || rs.includes("afternoon_snack") || rs.includes("night_snack"))) {
    return true;
  }
  return false;
}

// Return recipes that can fill a slot (falls back to the full library if nothing matches)
export function recipesForSlot(recipes: Recipe[], slot: MealSlotKey): Recipe[] {
  const matched = recipes.filter(r => recipeMatchesSlot(r, slot));
  return matched.length > 0 ? matched : recipes; // graceful fallback
}

// Calculate the calorie/protein target for one slot, given which slots the plan fills
function slotTarget(
  slot: MealSlotKey,
  selectedSlots: MealSlotKey[],
  goals: NutritionGoals,
): { calories: number; protein: number } {
  // Sum assumed nutrition for slots the user fills themselves (not in the plan)
  const unselected = ALL_MEAL_SLOTS.filter(s => !selectedSlots.includes(s));
  const assumedCal  = unselected.reduce((sum, s) => sum + SLOT_ASSUMED[s].calories, 0);
  const assumedProt = unselected.reduce((sum, s) => sum + SLOT_ASSUMED[s].protein,  0);

  // Remaining budget for everything the plan covers
  const budgetCal  = Math.max(goals.calories - assumedCal,   80);
  const budgetProt = Math.max(goals.protein  - assumedProt,  5);

  // This slot's proportion of the selected slots' assumed totals
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

  for (const day of DAYS) {
    for (const slot of selectedSlots) {
      const key = `${day}_${slot}`;
      if (existingSlotKeys.has(key)) continue; // already filled — skip

      const target = slotTarget(slot, selectedSlots, goals);
      const pool   = recipesForSlot(recipes, slot);

      // Prefer recipes not yet used this week in this slot
      const used   = usedPerSlot.get(slot)!;
      const unused = pool.filter(r => !used.has(r.id));
      const candidates = unused.length > 0 ? unused : pool;

      // Score: lower = better match to calorie + protein targets
      const scored = candidates.map(r => {
        const calDiff  = Math.abs((r.calories ?? target.calories) - target.calories);
        const protDiff = Math.abs((r.protein  ?? target.protein)  - target.protein);
        return { recipe: r, score: calDiff + protDiff * 4 };
      });
      scored.sort((a, b) => a.score - b.score);

      // Pick randomly from top-3 to add variety on re-runs
      const topN   = Math.min(3, scored.length);
      const picked = scored[Math.floor(Math.random() * topN)].recipe;

      used.add(picked.id);
      results.push({ day, slot, recipe: picked, targetCalories: target.calories, targetProtein: target.protein });
    }
  }

  return results;
}
