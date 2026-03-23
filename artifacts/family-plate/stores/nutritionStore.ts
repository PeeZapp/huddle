import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { generateId } from "@/lib/idgen";
import type { FoodLog, NutritionGoals } from "@/lib/types";

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
};

interface NutritionState {
  goals: NutritionGoals;
  logs: FoodLog[];
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  saveGoals: (goals: NutritionGoals) => Promise<void>;
  addLog: (data: Omit<FoodLog, "id" | "created_at">) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
}

let currentFamilyCode = "";

async function persistLogs(logs: FoodLog[]) {
  await setItem(`${STORAGE_KEYS.FOOD_LOGS}:${currentFamilyCode}`, logs);
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  goals: DEFAULT_GOALS,
  logs: [],
  loaded: false,

  load: async (familyCode: string) => {
    currentFamilyCode = familyCode;
    const goals = (await getItem<NutritionGoals>(STORAGE_KEYS.NUTRITION_GOALS)) ?? DEFAULT_GOALS;
    const logs = (await getItem<FoodLog[]>(`${STORAGE_KEYS.FOOD_LOGS}:${familyCode}`)) ?? [];
    set({ goals, logs, loaded: true });
  },

  saveGoals: async (goals: NutritionGoals) => {
    await setItem(STORAGE_KEYS.NUTRITION_GOALS, goals);
    set({ goals });
  },

  addLog: async (data) => {
    const log: FoodLog = { ...data, id: generateId(), created_at: new Date().toISOString() };
    const logs = [...get().logs, log];
    await persistLogs(logs);
    set({ logs });
  },

  removeLog: async (id: string) => {
    const logs = get().logs.filter((l) => l.id !== id);
    await persistLogs(logs);
    set({ logs });
  },
}));
