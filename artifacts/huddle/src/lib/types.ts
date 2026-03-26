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
  is_community?: boolean;
  shared_at?: string;
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
  eaten_by?: Record<string, boolean>;
  nutrition_entry_by_user?: Record<string, string>;
}

export interface MealPlan {
  id: string;
  week_start: string;
  family_code: string;
  active_slots: MealSlotKey[];
  slots: Record<string, MealSlotData>; // format: "day_slotkey"
  hidden_slots?: Record<string, boolean>; // format: "day_slotkey" => true
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
  /** Which meal-plan recipes this ingredient appears in (populated by generateFromPlan) */
  recipe_sources?: Array<{ recipe_id: string; recipe_name: string }>;
}

export interface FamilyMember {
  id: string;
  name: string;
  type: "adult" | "teen" | "child" | "toddler" | "baby";
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

export type NutritionGoalPreset =
  | "maintenance"
  | "muscle_gain"
  | "weight_loss"
  | "keto"
  | "high_protein_cut"
  | "low_carb"
  | "endurance"
  | "recomp"
  | "lean_bulk"
  | "custom";

export interface UserNutritionProfile {
  uid: string;
  goals: NutritionGoals;
  preset: NutritionGoalPreset;
  serving_factor: number;
  linked_family_member_id?: string;
  updated_at: string;
}

export interface NutritionLogEntry {
  id: string;
  source: "plan_meal" | "manual";
  meal_name: string;
  recipe_id?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion_factor?: number;
  ingredients?: Array<{ name: string; amount?: string; unit?: string }>;
  note?: string;
  created_at: string;
}

export interface DailyNutritionLog {
  date: string; // yyyy-mm-dd
  totals: NutritionGoals;
  entries: NutritionLogEntry[];
  updated_at: string;
}

export interface BodyWeightEntry {
  id: string;
  date: string; // yyyy-mm-dd
  kg: number;
  created_at: string;
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
