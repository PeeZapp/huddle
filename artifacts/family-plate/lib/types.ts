import type { Day, MealSlotKey } from "./mealSlots";

export interface Ingredient {
  name: string;
  amount?: string;
  category?: string;
  linked_recipe_id?: string;
}

export interface Recipe {
  id: string;
  name: string;
  emoji?: string;
  photo_color?: string;
  cuisine?: string;
  cook_time?: number;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  vegetarian?: boolean;
  ingredients?: Ingredient[];
  method?: string[];
  chef_tip?: string;
  meal_slots?: MealSlotKey[];
  excluded_from_auto?: boolean;
  is_component?: boolean;
  imported?: boolean;
  source_url?: string;
  created_at: string;
  family_code: string;
  notes?: string;
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

export type MealPlanSlots = Partial<Record<`${Day}_${MealSlotKey}`, MealSlotData>>;

export interface MealPlan {
  id: string;
  week_start: string;
  family_code: string;
  active_slots: MealSlotKey[];
  slots: MealPlanSlots;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount?: string;
  category: string;
  checked: boolean;
  shared: boolean;
  week_start: string;
  recipe_names?: string[];
  family_code: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  type: "adult" | "child" | "toddler" | "baby";
}

export interface FamilyGroup {
  id: string;
  code: string;
  name: string;
  family_members: FamilyMember[];
  country?: string;
  currency?: string;
  created_at: string;
}

export interface ListItem {
  id: string;
  text: string;
  checked: boolean;
  created_at: string;
}

export interface FamilyList {
  id: string;
  family_code: string;
  title: string;
  emoji?: string;
  color?: string;
  items: ListItem[];
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  family_code: string;
  title: string;
  date: string;
  emoji?: string;
  color?: string;
  all_day?: boolean;
  start_time?: string;
  end_time?: string;
  notes?: string;
  is_holiday?: boolean;
  created_at: string;
}

export interface FoodLog {
  id: string;
  family_code: string;
  date: string;
  meal_name: string;
  protein?: number;
  calories?: number;
  carbs?: number;
  fat?: number;
  is_personal?: boolean;
  created_at: string;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserProfile {
  id: string;
  name: string;
  family_code?: string;
  nutrition_goals?: NutritionGoals;
  created_at: string;
}
