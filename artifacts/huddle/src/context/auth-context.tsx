import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { loadNutritionProfile, loadUserProfile } from "@/lib/firestore-sync";
import { useFamilyStore, useNutritionStore } from "@/stores/huddle-stores";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True while the user's Firestore profile is being fetched after sign-in */
  profileLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, profileLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<User | null>(null);
  const [loading, setLoading]               = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const { _applyRemoteProfile } = useFamilyStore();
  const setNutritionGoals = useNutritionStore((s) => s.setGoals);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (!firebaseUser) {
        // Signed out — nothing to load
        setProfileLoading(false);
        return;
      }

      // Signed in — try to restore profile + family group from Firestore
      setProfileLoading(true);
      try {
        const remote = await loadUserProfile(firebaseUser.uid);
        if (remote?.profile) {
          _applyRemoteProfile(remote.profile, remote.familyGroup ?? null);
        }
        // Hydrate nutrition goals immediately after sign-in so all pages
        // read the same goal values without needing to open Nutrition first.
        const nutritionProfile = await loadNutritionProfile(firebaseUser.uid);
        setNutritionGoals(nutritionProfile.goals);
      } finally {
        setProfileLoading(false);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, profileLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
