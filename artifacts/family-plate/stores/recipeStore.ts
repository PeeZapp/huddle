import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { fsGet, fsSet } from "@/lib/firestoreSync";
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

function storageKey(familyCode: string) {
  return `${STORAGE_KEYS.RECIPES}:${familyCode}`;
}

async function persist(recipes: Recipe[], familyCode: string) {
  await setItem(storageKey(familyCode), recipes);
  fsSet("recipes", familyCode, { recipes, updated_at: new Date().toISOString() });
}

export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  loaded: false,

  load: async (familyCode: string) => {
    const cached = (await getItem<Recipe[]>(storageKey(familyCode))) ?? [];
    set({ recipes: cached, loaded: true });
    const remote = await fsGet<{ recipes: Recipe[] }>("recipes", familyCode);
    if (remote?.recipes) {
      set({ recipes: remote.recipes });
      await setItem(storageKey(familyCode), remote.recipes);
    }
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
