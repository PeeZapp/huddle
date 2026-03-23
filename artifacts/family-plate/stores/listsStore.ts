import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { generateId } from "@/lib/idgen";
import type { FamilyList, ListItem } from "@/lib/types";

interface ListsState {
  lists: FamilyList[];
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  create: (data: { title: string; emoji?: string; color?: string; family_code: string }) => Promise<FamilyList>;
  remove: (id: string) => Promise<void>;
  addItem: (listId: string, text: string) => Promise<void>;
  toggleItem: (listId: string, itemId: string) => Promise<void>;
  removeItem: (listId: string, itemId: string) => Promise<void>;
  clearChecked: (listId: string) => Promise<void>;
}

let currentFamilyCode = "";

async function persist(lists: FamilyList[]) {
  await setItem(`${STORAGE_KEYS.LISTS}:${currentFamilyCode}`, lists);
}

export const useListsStore = create<ListsState>((set, get) => ({
  lists: [],
  loaded: false,

  load: async (familyCode: string) => {
    currentFamilyCode = familyCode;
    const lists = (await getItem<FamilyList[]>(`${STORAGE_KEYS.LISTS}:${familyCode}`)) ?? [];
    set({ lists, loaded: true });
  },

  create: async (data) => {
    const list: FamilyList = {
      ...data,
      id: generateId(),
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const lists = [...get().lists, list];
    await persist(lists);
    set({ lists });
    return list;
  },

  remove: async (id: string) => {
    const lists = get().lists.filter((l) => l.id !== id);
    await persist(lists);
    set({ lists });
  },

  addItem: async (listId: string, text: string) => {
    const item: ListItem = {
      id: generateId(),
      text,
      checked: false,
      created_at: new Date().toISOString(),
    };
    const lists = get().lists.map((l) =>
      l.id === listId
        ? { ...l, items: [...l.items, item], updated_at: new Date().toISOString() }
        : l
    );
    await persist(lists);
    set({ lists });
  },

  toggleItem: async (listId: string, itemId: string) => {
    const lists = get().lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)),
        updated_at: new Date().toISOString(),
      };
    });
    await persist(lists);
    set({ lists });
  },

  removeItem: async (listId: string, itemId: string) => {
    const lists = get().lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.filter((i) => i.id !== itemId),
        updated_at: new Date().toISOString(),
      };
    });
    await persist(lists);
    set({ lists });
  },

  clearChecked: async (listId: string) => {
    const lists = get().lists.map((l) => {
      if (l.id !== listId) return l;
      return {
        ...l,
        items: l.items.filter((i) => !i.checked),
        updated_at: new Date().toISOString(),
      };
    });
    await persist(lists);
    set({ lists });
  },
}));
