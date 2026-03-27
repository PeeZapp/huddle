/**
 * Firestore sync helpers for meal plans and user profiles.
 *
 * Meal plan layout:
 *   Collection : "family-meal-plans"
 *   Document ID: familyCode (e.g. "FP-1234")
 *   Fields     : { plans: Record<weekStart, MealPlan>, updated_at: string }
 *
 * User profile layout:
 *   Collection : "users"
 *   Document ID: Firebase UID
 *   Fields     : { profile: UserProfile, familyGroup: FamilyGroup | null, updated_at: string }
 *
 * Each family group has exactly one meal-plan document — all members share it.
 * Each user has their own profile document tied to their Firebase UID.
 */

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  MealPlan,
  ShoppingItem,
  UserProfile,
  FamilyGroup,
  Recipe,
  UserNutritionProfile,
  DailyNutritionLog,
  NutritionLogEntry,
  BodyWeightEntry,
  NutritionGoals,
} from "./types";

// ── Community recipes ─────────────────────────────────────────────────────────
// Collection: community_recipes / {recipe_id}
// Firestore rules must allow: read = any signed-in user, write = any signed-in user.

export async function shareCommunityRecipe(recipe: Recipe): Promise<void> {
  try {
    await setDoc(
      doc(db, "community_recipes", recipe.id),
      { ...recipe, family_code: "__community__", is_community: true, shared_at: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.warn("[firestore-sync] shareCommunityRecipe failed:", err);
  }
}

export async function loadCommunityRecipes(): Promise<Recipe[]> {
  try {
    const snap = await getDocs(collection(db, "community_recipes"));
    return snap.docs.map(d => d.data() as Recipe);
  } catch (err) {
    console.warn("[firestore-sync] loadCommunityRecipes failed:", err);
    return [];
  }
}

// ── User profile ──────────────────────────────────────────────────────────────

export interface UserProfileDoc {
  profile: UserProfile;
  familyGroup: FamilyGroup | null;
  updated_at: string;
}

function userDocRef(uid: string) {
  return doc(db, "users", uid);
}

export async function loadUserProfile(uid: string): Promise<UserProfileDoc | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileDoc;
  } catch (err) {
    console.warn("[firestore-sync] loadUserProfile failed:", err);
    return null;
  }
}

export async function saveUserProfile(uid: string, data: UserProfileDoc): Promise<void> {
  if (!uid) return;
  try {
    await setDoc(userDocRef(uid), { ...data, updated_at: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn("[firestore-sync] saveUserProfile failed:", err);
  }
}

const COLLECTION = "family-meal-plans";
const SHOPPING_COLLECTION = "family-shopping";

function planDocRef(familyCode: string) {
  return doc(db, COLLECTION, familyCode);
}

function shoppingDocRef(familyCode: string) {
  return doc(db, SHOPPING_COLLECTION, familyCode);
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveMealPlans(
  familyCode: string,
  plans: Record<string, MealPlan>,
): Promise<void> {
  if (!familyCode) return;
  try {
    // IMPORTANT: overwrite the full plans map.
    // Firestore map-merge does not remove deleted nested keys, which can cause
    // removed slots to reappear after navigation/reload.
    await setDoc(planDocRef(familyCode), {
      plans,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[firestore-sync] saveMealPlans failed:", err);
  }
}

// ── Load (one-time fetch) ──────────────────────────────────────────────────────

export async function loadMealPlans(
  familyCode: string,
): Promise<Record<string, MealPlan> | null> {
  if (!familyCode) return null;
  try {
    const snap = await getDoc(planDocRef(familyCode));
    if (!snap.exists()) return null;
    return (snap.data()?.plans ?? null) as Record<string, MealPlan> | null;
  } catch (err) {
    console.warn("[firestore-sync] loadMealPlans failed:", err);
    return null;
  }
}

// ── Real-time listener ────────────────────────────────────────────────────────

export function subscribeMealPlans(
  familyCode: string,
  onData: (plans: Record<string, MealPlan>) => void,
): Unsubscribe {
  if (!familyCode) return () => {};
  return onSnapshot(
    planDocRef(familyCode),
    (snap) => {
      if (snap.exists()) {
        const plans = snap.data()?.plans as Record<string, MealPlan> | undefined;
        if (plans) onData(plans);
      }
    },
    (err) => {
      console.warn("[firestore-sync] subscribeMealPlans error:", err);
    },
  );
}

// ── Shopping list sync ────────────────────────────────────────────────────────

export async function saveShoppingItems(
  familyCode: string,
  items: ShoppingItem[],
): Promise<void> {
  if (!familyCode) return;
  try {
    await setDoc(shoppingDocRef(familyCode), {
      items,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[firestore-sync] saveShoppingItems failed:", err);
  }
}

export async function loadShoppingItems(
  familyCode: string,
): Promise<ShoppingItem[] | null> {
  if (!familyCode) return null;
  try {
    const snap = await getDoc(shoppingDocRef(familyCode));
    if (!snap.exists()) return null;
    const data = snap.data();
    return Array.isArray(data?.items) ? (data.items as ShoppingItem[]) : null;
  } catch (err) {
    console.warn("[firestore-sync] loadShoppingItems failed:", err);
    return null;
  }
}

export function subscribeShoppingItems(
  familyCode: string,
  onData: (items: ShoppingItem[]) => void,
): Unsubscribe {
  if (!familyCode) return () => {};
  return onSnapshot(
    shoppingDocRef(familyCode),
    (snap) => {
      if (!snap.exists()) return;
      const items = snap.data()?.items;
      if (Array.isArray(items)) onData(items as ShoppingItem[]);
    },
    (err) => {
      console.warn("[firestore-sync] subscribeShoppingItems error:", err);
    },
  );
}

// ── Private user nutrition ────────────────────────────────────────────────────

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
};

function nutritionProfileCacheKey(uid: string) {
  return `huddle:nutrition_profile:${uid}`;
}

function readCachedNutritionProfile(uid: string): UserNutritionProfile | null {
  try {
    const raw = localStorage.getItem(nutritionProfileCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserNutritionProfile;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...parsed, uid };
  } catch {
    return null;
  }
}

function writeCachedNutritionProfile(uid: string, profile: UserNutritionProfile) {
  try {
    localStorage.setItem(nutritionProfileCacheKey(uid), JSON.stringify({ ...profile, uid }));
  } catch {
    // non-fatal
  }
}

function nutritionProfileRef(uid: string) {
  return doc(db, "users", uid, "private", "nutrition_profile");
}

function nutritionDailyRef(uid: string, date: string) {
  return doc(db, "users", uid, "nutrition_daily", date);
}

function nutritionWeightCollection(uid: string) {
  return collection(db, "users", uid, "nutrition_weight");
}

export async function loadNutritionProfile(uid: string): Promise<UserNutritionProfile> {
  if (!uid) {
    return {
      uid: "",
      goals: DEFAULT_GOALS,
      preset: "maintenance",
      serving_factor: 1.0,
      updated_at: new Date().toISOString(),
    };
  }
  try {
    const snap = await getDoc(nutritionProfileRef(uid));
    if (snap.exists()) {
      const profile = snap.data() as UserNutritionProfile;
      writeCachedNutritionProfile(uid, profile);
      return profile;
    }
  } catch (err) {
    console.warn("[firestore-sync] loadNutritionProfile failed:", err);
  }
  const cached = readCachedNutritionProfile(uid);
  if (cached) return cached;
  return {
    uid,
    goals: DEFAULT_GOALS,
    preset: "maintenance",
    serving_factor: 1.0,
    linked_family_member_id: undefined,
    updated_at: new Date().toISOString(),
  };
}

export async function saveNutritionProfile(uid: string, profile: UserNutritionProfile): Promise<void> {
  if (!uid) return;
  // Update local cache immediately so UI state survives fast route changes.
  writeCachedNutritionProfile(uid, profile);
  try {
    await setDoc(nutritionProfileRef(uid), {
      ...profile,
      uid,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn("[firestore-sync] saveNutritionProfile failed:", err);
  }
}

export async function loadDailyNutritionLog(uid: string, date: string): Promise<DailyNutritionLog> {
  if (!uid) {
    return { date, totals: { ...DEFAULT_GOALS, calories: 0, protein: 0, carbs: 0, fat: 0 }, entries: [], updated_at: new Date().toISOString() };
  }
  try {
    const snap = await getDoc(nutritionDailyRef(uid, date));
    if (snap.exists()) return snap.data() as DailyNutritionLog;
  } catch (err) {
    console.warn("[firestore-sync] loadDailyNutritionLog failed:", err);
  }
  return {
    date,
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    entries: [],
    updated_at: new Date().toISOString(),
  };
}

function sumTotals(entries: NutritionLogEntry[]): NutritionGoals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export async function addDailyNutritionEntry(uid: string, date: string, entry: NutritionLogEntry): Promise<void> {
  if (!uid) return;
  try {
    const current = await loadDailyNutritionLog(uid, date);
    const entries = [...current.entries, entry];
    await setDoc(nutritionDailyRef(uid, date), {
      date,
      entries,
      totals: sumTotals(entries),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[firestore-sync] addDailyNutritionEntry failed:", err);
  }
}

export async function removeDailyNutritionEntry(uid: string, date: string, entryId: string): Promise<void> {
  if (!uid || !entryId) return;
  try {
    const current = await loadDailyNutritionLog(uid, date);
    const entries = current.entries.filter((e) => e.id !== entryId);
    await setDoc(nutritionDailyRef(uid, date), {
      date,
      entries,
      totals: sumTotals(entries),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[firestore-sync] removeDailyNutritionEntry failed:", err);
  }
}

export async function updateDailyNutritionEntry(uid: string, date: string, entry: NutritionLogEntry): Promise<void> {
  if (!uid || !entry?.id) return;
  try {
    const current = await loadDailyNutritionLog(uid, date);
    const entries = current.entries.map((e) => (e.id === entry.id ? { ...e, ...entry } : e));
    await setDoc(nutritionDailyRef(uid, date), {
      date,
      entries,
      totals: sumTotals(entries),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[firestore-sync] updateDailyNutritionEntry failed:", err);
  }
}

export async function loadNutritionRange(uid: string, dates: string[]): Promise<Record<string, DailyNutritionLog>> {
  const out: Record<string, DailyNutritionLog> = {};
  await Promise.all(
    dates.map(async (date) => {
      out[date] = await loadDailyNutritionLog(uid, date);
    }),
  );
  return out;
}

export async function saveBodyWeight(uid: string, entry: BodyWeightEntry): Promise<void> {
  if (!uid) return;
  try {
    await setDoc(doc(nutritionWeightCollection(uid), entry.id), entry, { merge: true });
  } catch (err) {
    console.warn("[firestore-sync] saveBodyWeight failed:", err);
  }
}

export async function loadBodyWeight(uid: string, fromDate: string): Promise<BodyWeightEntry[]> {
  if (!uid) return [];
  try {
    const q = query(nutritionWeightCollection(uid), where("date", ">=", fromDate));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as BodyWeightEntry);
  } catch (err) {
    console.warn("[firestore-sync] loadBodyWeight failed:", err);
    return [];
  }
}
