import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function mergeItem<T extends object>(key: string, value: Partial<T>): Promise<void> {
  try {
    const existing = await getItem<T>(key);
    await setItem(key, { ...(existing ?? {}), ...value });
  } catch {}
}

export const STORAGE_KEYS = {
  FAMILY: "huddle:family",
  RECIPES: "huddle:recipes",
  MEAL_PLAN: "huddle:mealplan",
  SHOPPING: "huddle:shopping",
  LISTS: "huddle:lists",
  CALENDAR: "huddle:calendar",
  FOOD_LOGS: "huddle:foodlogs",
  NUTRITION_GOALS: "huddle:nutrition_goals",
  USER_PROFILE: "huddle:user_profile",
} as const;
