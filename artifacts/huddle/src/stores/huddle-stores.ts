import { create } from "zustand";
import { persist } from "zustand/middleware";
import { 
  FamilyGroup, UserProfile, Recipe, MealPlan, ShoppingItem, 
  CustomList, NutritionGoals, FoodLog, MealSlotData, MealSlotKey, Day 
} from "@/lib/types";
import { generateId, generateFamilyCode, getWeekStart } from "@/lib/utils";

// --- FAMILY STORE ---
interface FamilyState {
  profile: UserProfile | null;
  familyGroup: FamilyGroup | null;
  setupProfile: (name: string) => void;
  createFamily: (name: string) => string;
  joinFamily: (code: string) => void;
  leaveFamily: () => void;
  updateFamily: (updates: Partial<FamilyGroup>) => void;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      profile: null,
      familyGroup: null,
      setupProfile: (name) => set({ profile: { id: generateId(), name, created_at: new Date().toISOString() } }),
      createFamily: (name) => {
        const code = generateFamilyCode();
        const family: FamilyGroup = { id: generateId(), code, name, family_members: [], created_at: new Date().toISOString() };
        const profile = get().profile;
        if (profile) set({ profile: { ...profile, family_code: code }, familyGroup: family });
        return code;
      },
      joinFamily: (code) => {
        const profile = get().profile;
        if (profile) set({ profile: { ...profile, family_code: code }, familyGroup: { id: generateId(), code, name: "Joined Family", created_at: new Date().toISOString() } });
      },
      leaveFamily: () => {
        const profile = get().profile;
        if (profile) set({ profile: { ...profile, family_code: undefined }, familyGroup: null });
      },
      updateFamily: (updates) => {
        const current = get().familyGroup;
        if (current) set({ familyGroup: { ...current, ...updates } });
      }
    }),
    { name: "huddle-family" }
  )
);

// --- RECIPE STORE ---
interface RecipeState {
  recipes: Recipe[];
  seedsLoaded: boolean;
  addRecipe: (recipe: Omit<Recipe, "id" | "created_at">) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  loadSeeds: (familyCode: string) => Promise<number>;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      seedsLoaded: false,
      addRecipe: (data) => {
        const recipe: Recipe = { ...data, id: generateId(), created_at: new Date().toISOString() };
        set({ recipes: [...get().recipes, recipe] });
        return recipe;
      },
      updateRecipe: (id, updates) => set({ recipes: get().recipes.map((r) => r.id === id ? { ...r, ...updates } : r) }),
      deleteRecipe: (id) => set({ recipes: get().recipes.filter((r) => r.id !== id) }),
      loadSeeds: async (familyCode) => {
        if (get().seedsLoaded) return 0;
        try {
          const base = import.meta.env.BASE_URL ?? "/";
          const res = await fetch(`${base}seed-recipes.json`);
          if (!res.ok) return 0;
          const seeds: Recipe[] = await res.json();
          const stamped = seeds.map((r) => ({ ...r, family_code: familyCode }));
          set({ recipes: stamped, seedsLoaded: true });
          return stamped.length;
        } catch {
          return 0;
        }
      },
    }),
    { name: "huddle-recipes" }
  )
);

// --- MEAL PLAN STORE ---
interface MealPlanState {
  plans: Record<string, MealPlan>;
  getPlan: (weekStart: string, familyCode: string) => MealPlan;
  setSlot: (weekStart: string, familyCode: string, day: Day, slot: MealSlotKey, data: MealSlotData | null) => void;
  setActiveSlots: (weekStart: string, familyCode: string, slots: MealSlotKey[]) => void;
  clearWeek: (weekStart: string) => void;
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      plans: {},
      getPlan: (weekStart, familyCode) => {
        const existing = get().plans[weekStart];
        if (existing) return existing;
        const newPlan: MealPlan = {
          id: generateId(), week_start: weekStart, family_code: familyCode,
          active_slots: ["breakfast", "lunch", "dinner"], slots: {},
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        };
        return newPlan;
      },
      setSlot: (weekStart, familyCode, day, slot, data) => {
        const plan = get().getPlan(weekStart, familyCode);
        const key = `${day}_${slot}`;
        const newSlots = { ...plan.slots };
        if (data === null) delete newSlots[key];
        else newSlots[key] = data;
        
        set((state) => ({
          plans: { ...state.plans, [weekStart]: { ...plan, slots: newSlots, updated_at: new Date().toISOString() } }
        }));
      },
      setActiveSlots: (weekStart, familyCode, slots) => {
        const plan = get().getPlan(weekStart, familyCode);
        set((state) => ({
          plans: { ...state.plans, [weekStart]: { ...plan, active_slots: slots, updated_at: new Date().toISOString() } }
        }));
      },
      clearWeek: (weekStart) => {
        set((state) => {
          const newPlans = { ...state.plans };
          if (newPlans[weekStart]) newPlans[weekStart].slots = {};
          return { plans: newPlans };
        });
      }
    }),
    { name: "huddle-meal-plans" }
  )
);

// --- SHOPPING STORE ---
interface ShoppingState {
  items: ShoppingItem[];
  addItem: (item: Omit<ShoppingItem, "id" | "created_at" | "checked">) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  clearChecked: (familyCode: string) => void;
  generateFromPlan: (plan: MealPlan, recipes: Recipe[]) => void;
}

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (data) => set({ items: [...get().items, { ...data, id: generateId(), checked: false, created_at: new Date().toISOString() }] }),
      toggleItem: (id) => set({ items: get().items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i) }),
      deleteItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clearChecked: (fc) => set({ items: get().items.filter((i) => i.family_code !== fc || !i.checked) }),
      generateFromPlan: (plan, recipes) => {
        const newItems: ShoppingItem[] = [];
        Object.values(plan.slots).forEach(slot => {
          if (slot.recipe_id) {
            const recipe = recipes.find(r => r.id === slot.recipe_id);
            if (recipe?.ingredients) {
              recipe.ingredients.forEach(ing => {
                newItems.push({
                  id: generateId(),
                  name: ing.name,
                  category: ing.category || "other",
                  checked: false,
                  week_start: plan.week_start,
                  family_code: plan.family_code,
                  created_at: new Date().toISOString()
                });
              });
            }
          }
        });
        set({ items: [...get().items, ...newItems] });
      }
    }),
    { name: "huddle-shopping" }
  )
);

// --- NUTRITION STORE ---
interface NutritionState {
  goals: NutritionGoals;
  logs: FoodLog[];
  setGoals: (goals: NutritionGoals) => void;
  addLog: (log: Omit<FoodLog, "id" | "created_at">) => void;
  deleteLog: (id: string) => void;
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      goals: { calories: 2000, protein: 120, carbs: 250, fat: 65 },
      logs: [],
      setGoals: (goals) => set({ goals }),
      addLog: (data) => set({ logs: [...get().logs, { ...data, id: generateId(), created_at: new Date().toISOString() }] }),
      deleteLog: (id) => set({ logs: get().logs.filter(l => l.id !== id) })
    }),
    { name: "huddle-nutrition" }
  )
);

// --- LISTS STORE ---
interface ListsState {
  lists: CustomList[];
  addList: (title: string, familyCode: string) => void;
  deleteList: (id: string) => void;
  addItem: (listId: string, text: string) => void;
  toggleItem: (listId: string, itemId: string) => void;
  deleteItem: (listId: string, itemId: string) => void;
}

export const useListsStore = create<ListsState>()(
  persist(
    (set, get) => ({
      lists: [],
      addList: (title, fc) => set({ lists: [...get().lists, { id: generateId(), family_code: fc, title, items: [], created_at: new Date().toISOString() }] }),
      deleteList: (id) => set({ lists: get().lists.filter(l => l.id !== id) }),
      addItem: (listId, text) => set({
        lists: get().lists.map(l => l.id === listId ? { ...l, items: [...l.items, { id: generateId(), text, checked: false }] } : l)
      }),
      toggleItem: (listId, itemId) => set({
        lists: get().lists.map(l => l.id === listId ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) } : l)
      }),
      deleteItem: (listId, itemId) => set({
        lists: get().lists.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l)
      })
    }),
    { name: "huddle-lists" }
  )
);
