import { create } from "zustand";
import { getItem, setItem, STORAGE_KEYS } from "@/lib/storage";
import { generateFamilyCode, generateId } from "@/lib/idgen";
import type { FamilyGroup, UserProfile } from "@/lib/types";

interface FamilyState {
  profile: UserProfile | null;
  familyGroup: FamilyGroup | null;
  loaded: boolean;
  load: () => Promise<void>;
  saveProfile: (name: string) => Promise<void>;
  createFamily: (name: string) => Promise<string>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  updateFamily: (updates: Partial<FamilyGroup>) => Promise<void>;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  profile: null,
  familyGroup: null,
  loaded: false,

  load: async () => {
    const profile = await getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE);
    let familyGroup: FamilyGroup | null = null;
    if (profile?.family_code) {
      const family = await getItem<FamilyGroup>(STORAGE_KEYS.FAMILY);
      if (family?.code === profile.family_code) familyGroup = family;
    }
    set({ profile, familyGroup, loaded: true });
  },

  saveProfile: async (name: string) => {
    const existing = get().profile;
    const profile: UserProfile = existing
      ? { ...existing, name }
      : { id: generateId(), name, created_at: new Date().toISOString() };
    await setItem(STORAGE_KEYS.USER_PROFILE, profile);
    set({ profile });
  },

  createFamily: async (name: string) => {
    const code = generateFamilyCode();
    const profile = get().profile!;
    const familyGroup: FamilyGroup = {
      id: generateId(),
      code,
      name: name || "My Family",
      family_members: [],
      created_at: new Date().toISOString(),
    };
    const updatedProfile: UserProfile = { ...profile, family_code: code };
    await setItem(STORAGE_KEYS.FAMILY, familyGroup);
    await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
    set({ familyGroup, profile: updatedProfile });
    return code;
  },

  joinFamily: async (code: string) => {
    const existing = await getItem<FamilyGroup>(STORAGE_KEYS.FAMILY);
    const normalised = code.toUpperCase().trim();
    if (existing?.code === normalised) {
      const profile = get().profile!;
      const updatedProfile: UserProfile = { ...profile, family_code: normalised };
      await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      set({ familyGroup: existing, profile: updatedProfile });
      return;
    }
    throw new Error("Family not found");
  },

  leaveFamily: async () => {
    const profile = get().profile;
    if (!profile) return;
    const updatedProfile: UserProfile = { ...profile, family_code: undefined };
    await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
    set({ profile: updatedProfile, familyGroup: null });
  },

  updateFamily: async (updates: Partial<FamilyGroup>) => {
    const existing = get().familyGroup;
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await setItem(STORAGE_KEYS.FAMILY, updated);
    set({ familyGroup: updated });
  },
}));
