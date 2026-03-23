import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { fsGet, fsSet } from "@/lib/firestoreSync";
import { generateId } from "@/lib/idgen";
import type { MealPlan, MealSlotData } from "@/lib/types";
import type { Day, MealSlotKey } from "@/lib/mealSlots";
import { DEFAULT_ACTIVE_SLOTS, getWeekStart } from "@/lib/mealSlots";

interface MealPlanState {
  plans: Record<string, MealPlan>;
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  getPlan: (weekStart: string, familyCode: string) => MealPlan;
  setSlot: (weekStart: string, familyCode: string, day: Day, slot: MealSlotKey, data: MealSlotData | null) => Promise<void>;
  setActiveSlots: (weekStart: string, familyCode: string, slots: MealSlotKey[]) => Promise<void>;
  clearWeek: (weekStart: string, familyCode: string) => Promise<void>;
}

function storageKey(familyCode: string) {
  return `${STORAGE_KEYS.MEAL_PLAN}:${familyCode}`;
}

function fsDocId(familyCode: string) {
  return familyCode;
}

async function persist(plans: Record<string, MealPlan>, familyCode: string) {
  await setItem(storageKey(familyCode), plans);
  fsSet("meal-plans", fsDocId(familyCode), { plans, updated_at: new Date().toISOString() });
}

function makePlan(weekStart: string, familyCode: string): MealPlan {
  return {
    id: generateId(),
    week_start: weekStart,
    family_code: familyCode,
    active_slots: DEFAULT_ACTIVE_SLOTS,
    slots: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  plans: {},
  loaded: false,

  load: async (familyCode: string) => {
    const cached = (await getItem<Record<string, MealPlan>>(storageKey(familyCode))) ?? {};
    set({ plans: cached, loaded: true });
    const remote = await fsGet<{ plans: Record<string, MealPlan> }>("meal-plans", fsDocId(familyCode));
    if (remote?.plans) {
      set({ plans: remote.plans });
      await setItem(storageKey(familyCode), remote.plans);
    }
  },

  getPlan: (weekStart, familyCode) => {
    return get().plans[weekStart] ?? makePlan(weekStart, familyCode);
  },

  setSlot: async (weekStart, familyCode, day, slot, data) => {
    const existing = get().plans[weekStart] ?? makePlan(weekStart, familyCode);
    const key = `${day}_${slot}` as `${Day}_${MealSlotKey}`;
    const slots = { ...existing.slots };
    if (data === null) {
      delete slots[key];
    } else {
      slots[key] = data;
    }
    const updated: MealPlan = { ...existing, slots, updated_at: new Date().toISOString() };
    const plans = { ...get().plans, [weekStart]: updated };
    await persist(plans, familyCode);
    set({ plans });
  },

  setActiveSlots: async (weekStart, familyCode, activeSlots) => {
    const existing = get().plans[weekStart] ?? makePlan(weekStart, familyCode);
    const updated: MealPlan = { ...existing, active_slots: activeSlots, updated_at: new Date().toISOString() };
    const plans = { ...get().plans, [weekStart]: updated };
    await persist(plans, familyCode);
    set({ plans });
  },

  clearWeek: async (weekStart, familyCode) => {
    const existing = get().plans[weekStart] ?? makePlan(weekStart, familyCode);
    const updated: MealPlan = { ...existing, slots: {}, updated_at: new Date().toISOString() };
    const plans = { ...get().plans, [weekStart]: updated };
    await persist(plans, familyCode);
    set({ plans });
  },
}));
