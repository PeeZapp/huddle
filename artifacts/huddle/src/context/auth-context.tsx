import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { loadUserProfile } from "@/lib/firestore-sync";
import { useFamilyStore } from "@/stores/huddle-stores";

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

  useEffect(() => {
    // If Firebase is not configured, skip auth state monitoring
    if (!auth) {
      setUser(null);
      setLoading(false);
      setProfileLoading(false);
      return;
    }

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
