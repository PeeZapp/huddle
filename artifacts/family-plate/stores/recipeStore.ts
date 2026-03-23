import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { generateId } from "@/lib/idgen";
import type { Recipe } from "@/lib/types";

interface RecipeState {
  recipes: Recipe[];
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  create: (data: Omit<Recipe, "id" | "created_at">) => Promise<Recipe>;
  update: (id: string, updates: Partial<Recipe>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(recipes: Recipe[], familyCode: string) {
  await setItem(`${STORAGE_KEYS.RECIPES}:${familyCode}`, recipes);
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loaded: false,

  load: async (familyCode: string) => {
    const recipes = (await getItem<Recipe[]>(`${STORAGE_KEYS.RECIPES}:${familyCode}`)) ?? [];
    set({ recipes, loaded: true });
  },

  create: async (data) => {
    const recipe: Recipe = {
      ...data,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    const recipes = [...get().recipes, recipe];
    await persist(recipes, data.family_code);
    set({ recipes });
    return recipe;
  },

  update: async (id: string, updates: Partial<Recipe>) => {
    const recipes = get().recipes.map((r) => (r.id === id ? { ...r, ...updates } : r));
    await persist(recipes, get().recipes.find((r) => r.id === id)?.family_code ?? "");
    set({ recipes });
  },

  remove: async (id: string) => {
    const existing = get().recipes.find((r) => r.id === id);
    const recipes = get().recipes.filter((r) => r.id !== id);
    await persist(recipes, existing?.family_code ?? "");
    set({ recipes });
  },
}));
