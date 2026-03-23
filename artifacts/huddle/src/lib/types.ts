export type MealSlotKey = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner" | "night_snack" | "dessert";
export type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const DAYS: Day[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const DAY_LABELS: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
export const MEAL_SLOTS: { key: MealSlotKey; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "morning_snack", label: "Morning Snack" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon_snack", label: "Afternoon Snack" },
  { key: "dinner", label: "Dinner" },
  { key: "night_snack", label: "Night Snack" },
  { key: "dessert", label: "Dessert" },
];

export interface Ingredient {
  name: string;
  amount?: string;
  category?: string;
  base_recipe_id?: string; // links to a base recipe (is_component: true) in the library
}

export interface Recipe {
  id: string;
  name: string;
  emoji?: string;
  photo_color?: string;
  cuisine?: string;
  cook_time?: number;
  servings?: number;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  ingredients?: Ingredient[];
  method?: string[];
  chef_tip?: string;
  notes?: string;
  meal_slots?: MealSlotKey[];
  is_component?: boolean;
  excluded_from_auto?: boolean;
  user_notes?: string;
  imported?: boolean;
  source_url?: string;
  family_code: string;
  created_at: string;
}

export interface MealSlotData {
  recipe_id?: string;
  recipe_name?: string;
  emoji?: string;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  cook_time?: number;
}

export interface MealPlan {
  id: string;
  week_start: string;
  family_code: string;
  active_slots: MealSlotKey[];
  slots: Record<string, MealSlotData>; // format: "day_slotkey"
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount?: string;
  category?: string;
  checked?: boolean;
  week_start?: string;
  family_code: string;
  created_at: string;
  is_base_recipe?: boolean;    // ingredient came from a base recipe in the library
  base_recipe_id?: string;     // id of the source base recipe
  base_recipe_name?: string;   // display name of the source base recipe
}

export interface FamilyMember {
  id: string;
  name: string;
  type: "adult" | "child" | "toddler" | "baby";
  dietary?: string[]; // restriction ids from DIETARY_OPTIONS
}

export interface FamilyGroup {
  id: string;
  code: string;
  name: string;
  family_members?: FamilyMember[];
  country?: string;
  currency?: string;
  created_at: string;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodLog {
  id: string;
  family_code: string;
  date: string;
  meal_name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  is_personal?: boolean;
  created_at: string;
}

export interface CustomList {
  id: string;
  family_code: string;
  title: string;
  items: { id: string; text: string; checked: boolean }[];
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  family_code?: string;
  created_at: string;
}
