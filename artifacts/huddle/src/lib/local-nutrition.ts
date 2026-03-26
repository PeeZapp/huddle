export interface LocalNutritionProfile {
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface LocalIngredientInput {
  name: string;
  grams: number;
}

const CATALOG: Record<string, LocalNutritionProfile> = {
  chicken: { emoji: "🍗", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  beef: { emoji: "🥩", calories: 250, protein: 26, carbs: 0, fat: 15 },
  salmon: { emoji: "🐟", calories: 208, protein: 20, carbs: 0, fat: 13 },
  tuna: { emoji: "🐟", calories: 132, protein: 29, carbs: 0, fat: 1.3 },
  egg: { emoji: "🥚", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  rice: { emoji: "🍚", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  pasta: { emoji: "🍝", calories: 157, protein: 5.8, carbs: 31, fat: 0.9 },
  potato: { emoji: "🥔", calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  bread: { emoji: "🍞", calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  avocado: { emoji: "🥑", calories: 160, protein: 2, carbs: 9, fat: 15 },
  "olive oil": { emoji: "🫒", calories: 884, protein: 0, carbs: 0, fat: 100 },
  butter: { emoji: "🧈", calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  cheese: { emoji: "🧀", calories: 402, protein: 25, carbs: 1.3, fat: 33 },
  milk: { emoji: "🥛", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  yoghurt: { emoji: "🥣", calories: 63, protein: 5.3, carbs: 7, fat: 1.6 },
  broccoli: { emoji: "🥦", calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  spinach: { emoji: "🥬", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  carrot: { emoji: "🥕", calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  tomato: { emoji: "🍅", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  onion: { emoji: "🧅", calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  apple: { emoji: "🍎", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  banana: { emoji: "🍌", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
};

export function resolveLocalNutrition(name: string): LocalNutritionProfile | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  if (CATALOG[q]) return CATALOG[q];
  const found = Object.entries(CATALOG).find(([key]) => q.includes(key) || key.includes(q));
  return found ? found[1] : null;
}

export function estimateFromLocalIngredients(inputs: LocalIngredientInput[]) {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let topEmoji = "🍽️";
  let topCalories = 0;

  for (const item of inputs) {
    const grams = Number(item.grams);
    if (!item.name.trim() || !Number.isFinite(grams) || grams <= 0) continue;
    const profile = resolveLocalNutrition(item.name);
    if (!profile) continue;
    const ratio = grams / 100;
    const itemCalories = profile.calories * ratio;
    calories += itemCalories;
    protein += profile.protein * ratio;
    carbs += profile.carbs * ratio;
    fat += profile.fat * ratio;
    if (itemCalories > topCalories) {
      topCalories = itemCalories;
      topEmoji = profile.emoji;
    }
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    emoji: topEmoji,
  };
}
