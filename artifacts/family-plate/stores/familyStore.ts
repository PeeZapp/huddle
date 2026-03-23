import { create } from "zustand";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

function familyDocRef(code: string) {
  return doc(db, "families", code);
}

async function fetchFamilyFromFirestore(code: string): Promise<FamilyGroup | null> {
  try {
    const snap = await getDoc(familyDocRef(code));
    if (snap.exists()) return snap.data() as FamilyGroup;
  } catch {}
  return null;
}

async function saveFamilyToFirestore(family: FamilyGroup): Promise<void> {
  try {
    await setDoc(familyDocRef(family.code), family);
  } catch (e) {
    console.warn("Firestore write failed, using local only:", e);
  }
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  profile: null,
  familyGroup: null,
  loaded: false,

  load: async () => {
    const profile = await getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE);
    let familyGroup: FamilyGroup | null = null;

    if (profile?.family_code) {
      const cached = await getItem<FamilyGroup>(STORAGE_KEYS.FAMILY);
      if (cached?.code === profile.family_code) {
        familyGroup = cached;
      }
      const remote = await fetchFamilyFromFirestore(profile.family_code);
      if (remote) {
        familyGroup = remote;
        await setItem(STORAGE_KEYS.FAMILY, remote);
      }
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
    await saveFamilyToFirestore(familyGroup);
    await setItem(STORAGE_KEYS.FAMILY, familyGroup);
    await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
    set({ familyGroup, profile: updatedProfile });
    return code;
  },

  joinFamily: async (code: string) => {
    const normalised = code.toUpperCase().trim();
    const remote = await fetchFamilyFromFirestore(normalised);
    if (remote) {
      const profile = get().profile ?? { id: generateId(), name: "Member", created_at: new Date().toISOString() };
      const updatedProfile: UserProfile = { ...profile, family_code: normalised };
      await setItem(STORAGE_KEYS.FAMILY, remote);
      await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      set({ familyGroup: remote, profile: updatedProfile });
      return;
    }
    const local = await getItem<FamilyGroup>(STORAGE_KEYS.FAMILY);
    if (local?.code === normalised) {
      const profile = get().profile ?? { id: generateId(), name: "Member", created_at: new Date().toISOString() };
      const updatedProfile: UserProfile = { ...profile, family_code: normalised };
      await setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
      set({ familyGroup: local, profile: updatedProfile });
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
    try {
      await updateDoc(familyDocRef(existing.code), updates as Record<string, unknown>);
    } catch {
      await setDoc(familyDocRef(existing.code), updated);
    }
    await setItem(STORAGE_KEYS.FAMILY, updated);
    set({ familyGroup: updated });
  },
}));
