import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { fsGet, fsSet } from "@/lib/firestoreSync";
import { generateId } from "@/lib/idgen";
import type { ShoppingItem } from "@/lib/types";

interface ShoppingState {
  items: ShoppingItem[];
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  create: (data: Omit<ShoppingItem, "id" | "created_at">) => Promise<void>;
  bulkCreate: (data: Omit<ShoppingItem, "id" | "created_at">[]) => Promise<void>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearWeek: (weekStart: string) => Promise<void>;
}

function storageKey(familyCode: string) {
  return `${STORAGE_KEYS.SHOPPING}:${familyCode}`;
}

async function persist(items: ShoppingItem[], familyCode: string) {
  await setItem(storageKey(familyCode), items);
  fsSet("shopping", familyCode, { items, updated_at: new Date().toISOString() });
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  items: [],
  loaded: false,

  load: async (familyCode: string) => {
    const cached = (await getItem<ShoppingItem[]>(storageKey(familyCode))) ?? [];
    set({ items: cached, loaded: true });
    const remote = await fsGet<{ items: ShoppingItem[] }>("shopping", familyCode);
    if (remote?.items) {
      set({ items: remote.items });
      await setItem(storageKey(familyCode), remote.items);
    }
  },

  create: async (data) => {
    const item: ShoppingItem = { ...data, id: generateId(), created_at: new Date().toISOString() };
    const items = [...get().items, item];
    await persist(items, data.family_code);
    set({ items });
  },

  bulkCreate: async (data) => {
    const now = new Date().toISOString();
    const fc = data[0]?.family_code ?? "";
    const newItems: ShoppingItem[] = data.map((d) => ({ ...d, id: generateId(), created_at: now }));
    const items = [...get().items, ...newItems];
    await persist(items, fc);
    set({ items });
  },

  toggle: async (id: string) => {
    const items = get().items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    const fc = get().items.find((i) => i.id === id)?.family_code ?? "";
    await persist(items, fc);
    set({ items });
  },

  remove: async (id: string) => {
    const fc = get().items.find((i) => i.id === id)?.family_code ?? "";
    const items = get().items.filter((i) => i.id !== id);
    await persist(items, fc);
    set({ items });
  },

  clearWeek: async (weekStart: string) => {
    const sample = get().items[0];
    const fc = sample?.family_code ?? "";
    const items = get().items.filter((i) => i.week_start !== weekStart);
    await persist(items, fc);
    set({ items });
  },
}));
