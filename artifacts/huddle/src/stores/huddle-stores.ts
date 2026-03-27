import { create } from "zustand";
import { persist } from "zustand/middleware";
import { 
  FamilyGroup, UserProfile, Recipe, MealPlan, ShoppingItem, 
  CustomList, NutritionGoals, FoodLog, MealSlotData, MealSlotKey, Day, AppNotification, NotificationPrefs, FamilyCalendarEvent
} from "@/lib/types";
import { generateId, generateFamilyCode, getWeekStart } from "@/lib/utils";
import { deduplicateIngredients } from "@/lib/amount-utils";
import { PriceOverrideMap } from "@/lib/recipe-costing";

// --- FAMILY STORE ---
interface FamilyState {
  profile: UserProfile | null;
  familyGroup: FamilyGroup | null;
  setupProfile: (name: string) => void;
  createFamily: (name: string) => string;
  joinFamily: (code: string) => void;
  leaveFamily: () => void;
  updateFamily: (updates: Partial<FamilyGroup>) => void;
  /** Internal — called by auth-context to restore profile from Firestore on sign-in */
  _applyRemoteProfile: (profile: UserProfile, familyGroup: FamilyGroup | null) => void;
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      profile: null,
      familyGroup: null,
      _applyRemoteProfile: (profile, familyGroup) => set({ profile, familyGroup }),
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

// ── Base-recipe linking helpers ────────────────────────────────────────────────
function normIngName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Walk through `recipes` and, for each ingredient whose normalised name
 * matches one of the `baseRecipes`, attach `base_recipe_id`.
 * Returns a NEW array — no mutation.
 */
function linkBaseRecipesToLibrary(recipes: Recipe[], baseRecipes: Recipe[]): Recipe[] {
  if (baseRecipes.length === 0) return recipes;
  const baseMap = new Map(baseRecipes.map(b => [normIngName(b.name), b.id]));
  return recipes.map(recipe => {
    if (recipe.is_component) return recipe; // base recipes don't link to themselves
    const newIngs = recipe.ingredients?.map(ing => {
      const id = baseMap.get(normIngName(ing.name));
      if (id && ing.base_recipe_id !== id) return { ...ing, base_recipe_id: id };
      return ing;
    });
    if (!newIngs) return recipe;
    return { ...recipe, ingredients: newIngs };
  });
}

// --- RECIPE STORE ---
interface RecipeState {
  recipes: Recipe[];
  seedsLoaded: boolean;
  favourites: Record<string, string[]>;  // familyCode → recipeId[]
  addRecipe: (recipe: Omit<Recipe, "id" | "created_at">) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  loadSeeds: (familyCode: string) => Promise<number>;
  loadCommunity: () => Promise<void>;
  toggleFavourite: (familyCode: string, recipeId: string) => void;
  isFavourite: (familyCode: string, recipeId: string) => boolean;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      seedsLoaded: false,
      favourites: {},
      addRecipe: (data) => {
        const recipe: Recipe = { ...data, id: generateId(), created_at: new Date().toISOString() };
        let updatedLibrary = [...get().recipes, recipe];

        if (recipe.is_component) {
          // New base recipe: link it into ALL existing recipes that mention it by ingredient name
          updatedLibrary = linkBaseRecipesToLibrary(updatedLibrary, [recipe]);
        } else {
          // Regular recipe: link any existing base recipes into its ingredients
          const bases = get().recipes.filter(r => r.is_component);
          if (bases.length > 0) {
            const linked = linkBaseRecipesToLibrary([recipe], bases);
            updatedLibrary = [...get().recipes, linked[0]];
            // Replace the placeholder we pushed with the linked version
            const addedLinked = linked[0];
            set({ recipes: [...get().recipes, addedLinked] });
            return addedLinked;
          }
        }

        set({ recipes: updatedLibrary });
        return recipe;
      },
      updateRecipe: (id, updates) => {
        const current = get().recipes.find(r => r.id === id);
        const updated = { ...current, ...updates } as Recipe;
        let all = get().recipes.map(r => r.id === id ? updated : r);

        // If we're updating a base recipe's name, re-link the whole library
        if (updated.is_component && updates.name) {
          all = linkBaseRecipesToLibrary(all, all.filter(r => r.is_component));
        }
        set({ recipes: all });
      },
      deleteRecipe: (id) => {
        // When a base recipe is deleted, remove its links from all ingredients
        const all = get().recipes.filter(r => r.id !== id);
        const cleaned = all.map(r => ({
          ...r,
          ingredients: r.ingredients?.map(ing =>
            ing.base_recipe_id === id ? { ...ing, base_recipe_id: undefined } : ing
          ),
        }));
        set({ recipes: cleaned });
      },
      loadSeeds: async (_familyCode) => {
        try {
          const base = import.meta.env.BASE_URL ?? "/";
          const res = await fetch(`${base}seed-recipes.json`);
          if (!res.ok) return 0;
          const seeds: Recipe[] = await res.json();
          // Tag all seeds as "global" so they are visible to every family.
          // Also replace any existing seeds that were stored with the wrong code
          // (old sessions used the user's family code or "__seed__").
          const globalSeeds: Recipe[] = seeds.map(r => ({ ...r, family_code: "global" }));
          const seedIds = new Set(globalSeeds.map(r => r.id));
          // Keep non-seed user recipes, then add all global seeds fresh
          const nonSeeds = get().recipes.filter(r => !seedIds.has(r.id));
          set({ recipes: [...nonSeeds, ...globalSeeds], seedsLoaded: true });
          return globalSeeds.length;
        } catch {
          return 0;
        }
      },
      loadCommunity: async () => {
        try {
          const { loadCommunityRecipes } = await import("../lib/firestore-sync");
          const communityRecipes = await loadCommunityRecipes();
          if (!communityRecipes.length) return;
          // Re-read current recipes at write time to avoid overwriting seeds loaded concurrently
          const existingIds = new Set(get().recipes.map((r) => r.id));
          const newOnes = communityRecipes.filter(r => !existingIds.has(r.id));
          if (newOnes.length > 0) {
            set({ recipes: [...get().recipes, ...newOnes] });
          }
        } catch {
          // community load failing silently is fine
        }
      },
      toggleFavourite: (familyCode, recipeId) => {
        const current = get().favourites[familyCode] ?? [];
        const updated = current.includes(recipeId)
          ? current.filter(id => id !== recipeId)
          : [...current, recipeId];
        set({ favourites: { ...get().favourites, [familyCode]: updated } });
      },
      isFavourite: (familyCode, recipeId) => {
        return (get().favourites[familyCode] ?? []).includes(recipeId);
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
  /** Internal — called by useMealPlanSync to apply remote Firestore data */
  _setPlansFromRemote: (plans: Record<string, MealPlan>) => void;
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      plans: {},
      _setPlansFromRemote: (plans) => set({ plans }),
      getPlan: (weekStart, familyCode) => {
        const existing = get().plans[weekStart];
        if (existing) {
          // Guard: ensure the returned plan's own week_start matches the key
          // (stale data from Firestore can sometimes have a mismatched field).
          if (existing.week_start !== weekStart) {
            console.warn("[getPlan] week_start mismatch – key:", weekStart, "plan.week_start:", existing.week_start, "– correcting");
            return { ...existing, week_start: weekStart };
          }
          return existing;
        }
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
  /** The week that the shopping list was last synced from — may differ from "this week" */
  selectedWeekStart: string | null;
  /** Internal — called by shopping sync to apply remote Firestore data */
  _setItemsFromRemote: (items: ShoppingItem[]) => void;
  addItem: (item: Omit<ShoppingItem, "id" | "created_at" | "checked">) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  clearChecked: (familyCode: string) => void;
  clearAll: (familyCode: string) => void;
  clearWeek: (familyCode: string, weekStart: string) => void;
  generateFromPlan: (plan: MealPlan, recipes: Recipe[]) => void;
  setSelectedWeek: (weekStart: string) => void;
}

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedWeekStart: null,
      _setItemsFromRemote: (items) => set({ items }),
      setSelectedWeek: (weekStart) => set({ selectedWeekStart: weekStart }),
      addItem: (data) => set({ items: [...get().items, { ...data, id: generateId(), checked: false, created_at: new Date().toISOString() }] }),
      toggleItem: (id) => set({ items: get().items.map((i) => i.id === id ? { ...i, checked: !i.checked } : i) }),
      deleteItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      clearChecked: (fc) => set({ items: get().items.filter((i) => i.family_code !== fc || !i.checked) }),
      clearAll: (fc) => set({ items: get().items.filter((i) => i.family_code !== fc) }),
      clearWeek: (fc, ws) => set({ items: get().items.filter((i) => i.family_code !== fc || i.week_start !== ws) }),
      generateFromPlan: (plan, recipes) => {
        // Build a map of base-recipe id → Recipe for quick lookup
        const baseRecipeMap = new Map(recipes.filter(r => r.is_component).map(r => [r.id, r]));

        // Collect every ingredient from every ACTIVE slot, tracking the source recipe.
        // Slots that aren't in active_slots may exist from a previous generation but
        // should not appear in the shopping list (they're hidden on the Plan page too).
        const activeSlotSet = new Set(plan.active_slots ?? ["breakfast", "lunch", "dinner"]);

        const raw: {
          name: string; amount?: string; category?: string;
          base_recipe_id?: string;
          recipe_id: string; recipe_name: string;
        }[] = [];

        Object.entries(plan.slots).forEach(([key, slot]) => {
          // key format: "monday_breakfast" or "monday_morning_snack"
          // Keep everything after the first "_" so snack variants remain distinct.
          const mealType = key.slice(key.indexOf("_") + 1) as MealSlotKey;
          if (!activeSlotSet.has(mealType)) return;
          if (slot.recipe_id) {
            const recipe = recipes.find(r => r.id === slot.recipe_id);
            if (recipe?.ingredients) {
              recipe.ingredients.forEach(ing => {
                raw.push({
                  name: ing.name,
                  amount: ing.amount,
                  category: ing.category,
                  base_recipe_id: ing.base_recipe_id,
                  recipe_id: recipe.id,
                  recipe_name: recipe.name,
                });
              });
            }
          }
        });

        // Deduplicate by name and combine amounts (e.g. 3×50g butter → 150g butter)
        const rawPlain = raw.map(({ name, amount, category }) => ({ name, amount, category }));
        const deduped  = deduplicateIngredients(rawPlain);

        // Re-attach metadata keyed by ingredient name
        const baseIdByName = new Map<string, string>();
        const sourcesByName = new Map<string, Array<{ recipe_id: string; recipe_name: string }>>();
        const mealCountByName = new Map<string, number>();
        raw.forEach(r => {
          const key = r.name.toLowerCase().trim();
          mealCountByName.set(key, (mealCountByName.get(key) ?? 0) + 1);
          if (r.base_recipe_id && !baseIdByName.has(key)) baseIdByName.set(key, r.base_recipe_id);
          const sources = sourcesByName.get(key) ?? [];
          if (!sources.some(s => s.recipe_id === r.recipe_id)) {
            sources.push({ recipe_id: r.recipe_id, recipe_name: r.recipe_name });
          }
          sourcesByName.set(key, sources);
        });

        const now = new Date().toISOString();
        const newItems: ShoppingItem[] = deduped.map(ing => {
          const key  = ing.name.toLowerCase().trim();
          const brId = baseIdByName.get(key);
          const br   = brId ? baseRecipeMap.get(brId) : undefined;
          return {
            id: generateId(),
            name: ing.name,
            amount: ing.amount,
            category: ing.category || "other",
            checked: false,
            week_start: plan.week_start,
            family_code: plan.family_code,
            created_at: now,
            recipe_sources: sourcesByName.get(key) ?? [],
            shared_meal_count: mealCountByName.get(key) ?? 0,
            ...(br ? { is_base_recipe: true, base_recipe_id: br.id, base_recipe_name: br.name } : {}),
          };
        });

        // Remove any existing unchecked items from this week before adding fresh ones
        const existing = get().items.filter(
          i => i.family_code !== plan.family_code || i.week_start !== plan.week_start || i.checked
        );
        set({ items: [...existing, ...newItems] });
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

// --- PRICE STORE ---

interface PriceState {
  aiPrices: PriceOverrideMap;
  userPrices: PriceOverrideMap;
  lastAiRefresh: string | null;
  isRefreshing: boolean;
  isSubscribed: boolean; // placeholder — connect to Stripe/RevenueCat during monetisation
  refreshPrices: (country?: string) => Promise<void>;
  setUserPrice: (key: string, priceUSD: number, baseAmount: number, baseUnit: string) => void;
  clearUserPrice: (key: string) => void;
  checkAutoRefresh: (country?: string) => void;
  setSubscribed: (val: boolean) => void; // dev/test helper
}

export const usePriceStore = create<PriceState>()(
  persist(
    (set, get) => ({
      aiPrices: {},
      userPrices: {},
      lastAiRefresh: null,
      isRefreshing: false,
      isSubscribed: false,

      refreshPrices: async (country) => {
        if (get().isRefreshing) return;
        set({ isRefreshing: true });
        try {
          const res = await fetch("/api/prices/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country: country ?? null }),
          });
          if (!res.ok) throw new Error("Refresh failed");
          const { prices, refreshedAt } = await res.json() as {
            prices: PriceOverrideMap;
            refreshedAt: string;
          };
          set({ aiPrices: prices, lastAiRefresh: refreshedAt });
        } catch (err) {
          console.error("Price refresh failed:", err);
        } finally {
          set({ isRefreshing: false });
        }
      },

      setUserPrice: (key, priceUSD, baseAmount, baseUnit) => {
        set(s => ({
          userPrices: { ...s.userPrices, [key]: { priceUSD, baseAmount, baseUnit } },
        }));
      },

      clearUserPrice: (key) => {
        set(s => {
          const next = { ...s.userPrices };
          delete next[key];
          return { userPrices: next };
        });
      },

      setSubscribed: (val) => set({ isSubscribed: val }),

      checkAutoRefresh: (country) => {
        const { lastAiRefresh, isRefreshing, refreshPrices } = get();
        if (isRefreshing) return;
        if (!lastAiRefresh) {
          refreshPrices(country);
          return;
        }
        const last = new Date(lastAiRefresh);
        const now  = new Date();
        const differentMonth =
          now.getFullYear() > last.getFullYear() ||
          now.getMonth()    > last.getMonth();
        if (differentMonth) {
          refreshPrices(country);
        }
      },
    }),
    { name: "huddle-prices" }
  )
);

// --- LISTS STORE ---
interface ListsState {
  lists: CustomList[];
  addList: (
    title: string,
    familyCode: string,
    options?: { emoji?: string; visible_to_member_ids?: string[]; created_by_id?: string }
  ) => void;
  deleteList: (id: string) => void;
  addItem: (
    listId: string,
    text: string,
    options?: {
      assignee_id?: string;
      due_date?: string;
      priority?: "low" | "medium" | "high";
      notes?: string;
      family_code?: string;
      creator_name?: string;
      list_title?: string;
    }
  ) => string;
  updateItem: (
    listId: string,
    itemId: string,
    updates: Partial<CustomList["items"][number]>
  ) => void;
  toggleItem: (listId: string, itemId: string) => void;
  deleteItem: (listId: string, itemId: string) => void;
  linkItemToCalendar: (listId: string, itemId: string, eventId: string, alertsEnabled: boolean) => void;
  unlinkItemFromCalendar: (listId: string, itemId: string) => void;
}

export const useListsStore = create<ListsState>()(
  persist(
    (set, get) => ({
      lists: [],
      addList: (title, fc, options) => set({
        lists: [...get().lists, {
          id: generateId(),
          family_code: fc,
          title,
          emoji: options?.emoji || "📝",
          visible_to_member_ids: options?.visible_to_member_ids,
          created_by_id: options?.created_by_id,
          items: [],
          created_at: new Date().toISOString(),
        }],
      }),
      deleteList: (id) => set({ lists: get().lists.filter(l => l.id !== id) }),
      addItem: (listId, text, options) => {
        const newId = generateId();
        set({
          lists: get().lists.map(l => l.id === listId ? {
            ...l,
            items: [...l.items, {
              id: newId,
              text,
              checked: false,
              notes: options?.notes,
              assignee_id: options?.assignee_id,
              due_date: options?.due_date,
              priority: options?.priority ?? "medium",
              created_at: new Date().toISOString(),
            }]
          } : l)
        });
        return newId;
      },
      updateItem: (listId, itemId, updates) => set({
        lists: get().lists.map((l) => l.id === listId ? {
          ...l,
          items: l.items.map((i) => i.id === itemId ? { ...i, ...updates } : i),
        } : l),
      }),
      toggleItem: (listId, itemId) => set({
        lists: get().lists.map(l => l.id === listId ? {
          ...l,
          items: l.items.map(i => {
            if (i.id !== itemId) return i;
            const nextChecked = !i.checked;
            return {
              ...i,
              checked: nextChecked,
              completed_at: nextChecked ? new Date().toISOString() : undefined,
            };
          }),
        } : l)
      }),
      deleteItem: (listId, itemId) => set({
        lists: get().lists.map(l => l.id === listId ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l)
      }),
      linkItemToCalendar: (listId, itemId, eventId, alertsEnabled) => set({
        lists: get().lists.map((l) => l.id === listId ? {
          ...l,
          items: l.items.map((i) => i.id === itemId ? {
            ...i,
            calendar_event_id: eventId,
            calendar_alerts_enabled: alertsEnabled,
          } : i),
        } : l),
      }),
      unlinkItemFromCalendar: (listId, itemId) => set({
        lists: get().lists.map((l) => l.id === listId ? {
          ...l,
          items: l.items.map((i) => i.id === itemId ? {
            ...i,
            calendar_event_id: undefined,
            calendar_alerts_enabled: undefined,
          } : i),
        } : l),
      }),
    }),
    { name: "huddle-lists" }
  )
);

// --- APP NOTIFICATIONS STORE ---
interface NotificationsState {
  notifications: AppNotification[];
  prefsByRecipient: Record<string, NotificationPrefs>;
  addNotification: (notification: Omit<AppNotification, "id" | "created_at" | "read">) => void;
  markRead: (id: string) => void;
  markReadForRecipient: (id: string, recipientId: string) => void;
  markAllReadForRecipient: (recipientId: string) => void;
  clearAllForRecipient: (recipientId: string) => void;
  clearOneForRecipient: (id: string, recipientId: string) => void;
  getPrefsForRecipient: (recipientId: string) => NotificationPrefs;
  setPrefsForRecipient: (recipientId: string, prefs: Partial<NotificationPrefs>) => void;
  shouldNotify: (recipientId: string, type: AppNotification["type"]) => boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  list_assigned: true,
  list_due_soon: true,
  list_overdue: true,
  push_enabled: false,
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      prefsByRecipient: {},
      addNotification: (notification) => set({
        notifications: [
          {
            id: generateId(),
            read: false,
            created_at: new Date().toISOString(),
            ...notification,
          },
          ...get().notifications,
        ],
      }),
      markRead: (id) => set({
        notifications: get().notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      }),
      markReadForRecipient: (id, recipientId) => set({
        notifications: get().notifications.map((n) =>
          n.id === id && n.recipient_id === recipientId ? { ...n, read: true } : n
        ),
      }),
      markAllReadForRecipient: (recipientId) => set({
        notifications: get().notifications.map((n) =>
          n.recipient_id === recipientId ? { ...n, read: true } : n
        ),
      }),
      clearAllForRecipient: (recipientId) => set({
        notifications: get().notifications.filter((n) => n.recipient_id !== recipientId),
      }),
      clearOneForRecipient: (id, recipientId) => set({
        notifications: get().notifications.filter((n) => !(n.id === id && n.recipient_id === recipientId)),
      }),
      getPrefsForRecipient: (recipientId) => {
        return get().prefsByRecipient[recipientId] ?? DEFAULT_NOTIFICATION_PREFS;
      },
      setPrefsForRecipient: (recipientId, prefs) => set({
        prefsByRecipient: {
          ...get().prefsByRecipient,
          [recipientId]: {
            ...DEFAULT_NOTIFICATION_PREFS,
            ...(get().prefsByRecipient[recipientId] ?? {}),
            ...prefs,
          },
        },
      }),
      shouldNotify: (recipientId, type) => {
        if (type === "general") return true;
        const prefs = get().prefsByRecipient[recipientId] ?? DEFAULT_NOTIFICATION_PREFS;
        if (type === "list_assigned") return prefs.list_assigned;
        if (type === "list_due_soon") return prefs.list_due_soon;
        if (type === "list_overdue") return prefs.list_overdue;
        return true;
      },
    }),
    { name: "huddle-notifications" }
  )
);

// --- FAMILY CALENDAR STORE ---
interface CalendarState {
  events: FamilyCalendarEvent[];
  importedHolidayKeys: string[]; // `${country}:${year}`
  addEvent: (event: Omit<FamilyCalendarEvent, "id" | "created_at" | "updated_at">) => FamilyCalendarEvent;
  updateEvent: (id: string, updates: Partial<FamilyCalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  importPublicAndSchoolHolidays: (familyCode: string, countryCode: string, year: number) => Promise<void>;
  upsertBirthdayEvents: (familyCode: string, members: Array<{ id: string; name: string; birthday?: string }>) => void;
}

const SCHOOL_HOLIDAY_SEEDS: Record<string, Array<{ title: string; start: string; end: string }>> = {
  AU: [
    { title: "School Holidays (Term Break 1)", start: "2026-04-10", end: "2026-04-26" },
    { title: "School Holidays (Winter)", start: "2026-06-26", end: "2026-07-12" },
    { title: "School Holidays (Spring)", start: "2026-09-18", end: "2026-10-04" },
    { title: "School Holidays (Summer)", start: "2026-12-18", end: "2027-01-31" },
  ],
  NZ: [
    { title: "School Holidays (Autumn)", start: "2026-04-03", end: "2026-04-19" },
    { title: "School Holidays (Winter)", start: "2026-07-04", end: "2026-07-19" },
    { title: "School Holidays (Spring)", start: "2026-09-26", end: "2026-10-11" },
    { title: "School Holidays (Summer)", start: "2026-12-19", end: "2027-01-31" },
  ],
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],
      importedHolidayKeys: [],
      addEvent: (event) => {
        const next: FamilyCalendarEvent = {
          id: generateId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...event,
        };
        set({ events: [...get().events, next] });
        return next;
      },
      updateEvent: (id, updates) => set({
        events: get().events.map((e) => e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e),
      }),
      deleteEvent: (id) => set({
        events: get().events.filter((e) => e.id !== id),
      }),
      importPublicAndSchoolHolidays: async (familyCode, countryCode, year) => {
        const key = `${countryCode}:${year}`;
        if (get().importedHolidayKeys.includes(key)) return;

        const publicEvents: FamilyCalendarEvent[] = [];
        try {
          const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
          if (res.ok) {
            const holidays = await res.json() as Array<{ date: string; localName: string; name: string }>;
            holidays.forEach((h) => {
              publicEvents.push({
                id: generateId(),
                family_code: familyCode,
                title: h.localName || h.name,
                start_date: h.date,
                all_day: true,
                recurrence: "none",
                alerts_enabled: false,
                source: "public_holiday",
                external_id: `public:${countryCode}:${h.date}:${h.name}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            });
          }
        } catch {
          // keep calm on network failures
        }

        const schoolSeeds = SCHOOL_HOLIDAY_SEEDS[countryCode] ?? [];
        const schoolEvents: FamilyCalendarEvent[] = schoolSeeds
          .filter((s) => s.start.startsWith(String(year)))
          .map((s) => ({
            id: generateId(),
            family_code: familyCode,
            title: s.title,
            start_date: s.start,
            end_date: s.end,
            all_day: true,
            recurrence: "none",
            alerts_enabled: false,
            source: "school_holiday",
            external_id: `school:${countryCode}:${s.start}:${s.title}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        const existing = get().events;
        const existingExternal = new Set(existing.map((e) => e.external_id).filter(Boolean));
        const merged = [...publicEvents, ...schoolEvents].filter((e) => !existingExternal.has(e.external_id));
        set({
          events: [...existing, ...merged],
          importedHolidayKeys: [...get().importedHolidayKeys, key],
        });
      },
      upsertBirthdayEvents: (familyCode, members) => {
        const existing = get().events.filter((e) => e.family_code === familyCode);
        const nonBirthdays = existing.filter((e) => e.source !== "birthday");
        const birthdays: FamilyCalendarEvent[] = members
          .filter((m) => !!m.birthday)
          .map((m) => ({
            id: generateId(),
            family_code: familyCode,
            title: `${m.name}'s Birthday`,
            start_date: m.birthday!,
            all_day: true,
            recurrence: "yearly",
            alerts_enabled: true,
            source: "birthday",
            external_id: `birthday:${m.id}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        set({
          events: [...nonBirthdays, ...birthdays],
        });
      },
    }),
    { name: "huddle-calendar" }
  )
);
