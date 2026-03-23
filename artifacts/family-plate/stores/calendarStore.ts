import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { generateId } from "@/lib/idgen";
import type { CalendarEvent } from "@/lib/types";

interface CalendarState {
  events: CalendarEvent[];
  loaded: boolean;
  load: (familyCode: string) => Promise<void>;
  create: (data: Omit<CalendarEvent, "id" | "created_at">) => Promise<void>;
  update: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let currentFamilyCode = "";

async function persist(events: CalendarEvent[]) {
  await setItem(`${STORAGE_KEYS.CALENDAR}:${currentFamilyCode}`, events);
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  loaded: false,

  load: async (familyCode: string) => {
    currentFamilyCode = familyCode;
    const events = (await getItem<CalendarEvent[]>(`${STORAGE_KEYS.CALENDAR}:${familyCode}`)) ?? [];
    set({ events, loaded: true });
  },

  create: async (data) => {
    const event: CalendarEvent = { ...data, id: generateId(), created_at: new Date().toISOString() };
    const events = [...get().events, event];
    await persist(events);
    set({ events });
  },

  update: async (id: string, updates: Partial<CalendarEvent>) => {
    const events = get().events.map((e) => (e.id === id ? { ...e, ...updates } : e));
    await persist(events);
    set({ events });
  },

  remove: async (id: string) => {
    const events = get().events.filter((e) => e.id !== id);
    await persist(events);
    set({ events });
  },
}));
