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
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { MealPlan, UserProfile, FamilyGroup } from "./types";

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

function planDocRef(familyCode: string) {
  return doc(db, COLLECTION, familyCode);
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveMealPlans(
  familyCode: string,
  plans: Record<string, MealPlan>,
): Promise<void> {
  if (!familyCode) return;
  try {
    await setDoc(
      planDocRef(familyCode),
      { plans, updated_at: new Date().toISOString() },
      { merge: true },
    );
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
