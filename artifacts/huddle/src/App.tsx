import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/context/auth-context";
import Auth from "@/pages/Auth";
import Setup from "@/pages/Setup";
import Plan from "@/pages/Plan";
import GeneratePlan from "@/pages/GeneratePlan";
import Shopping from "@/pages/Shopping";
import Recipes from "@/pages/Recipes";
import RecipeDetail from "@/pages/RecipeDetail";
import ImportRecipe from "@/pages/ImportRecipe";
import Nutrition from "@/pages/Nutrition";
import Lists from "@/pages/Lists";
import Family from "@/pages/Family";
import PriceSettings from "@/pages/PriceSettings";
import { useFamilyStore, useRecipeStore, usePriceStore } from "@/stores/huddle-stores";
import { useMealPlanSync } from "@/hooks/useMealPlanSync";
import { saveUserProfile } from "@/lib/firestore-sync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false }
  }
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <h2 className="text-4xl font-bold text-primary mb-4">404</h2>
      <p className="text-muted-foreground">Page not found.</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Plan} />
      <Route path="/setup" component={Setup} />
      <Route path="/generate" component={GeneratePlan} />
      <Route path="/shopping" component={Shopping} />
      <Route path="/recipes" component={Recipes} />
      <Route path="/recipe/:id" component={RecipeDetail} />
      <Route path="/import" component={ImportRecipe} />
      <Route path="/nutrition" component={Nutrition} />
      <Route path="/lists" component={Lists} />
      <Route path="/family" component={Family} />
      <Route path="/prices" component={PriceSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

const PROFILE_SAVE_DEBOUNCE = 2000;

function SeedLoader() {
  const { profile, familyGroup } = useFamilyStore();
  const { loadSeeds }            = useRecipeStore();
  const { checkAutoRefresh }     = usePriceStore();
  const { user, profileLoading } = useAuth();

  useEffect(() => {
    const code = profile?.family_code;
    if (code) loadSeeds(code);
  }, [profile?.family_code, loadSeeds]);

  useEffect(() => {
    checkAutoRefresh(familyGroup?.country);
  }, []);

  // Sync meal plans to/from Firestore, scoped to this family group's code
  useMealPlanSync(profile?.family_code);

  // Keep a ref so the save effect can read `profileLoading` without it being
  // a reactive dependency.  This prevents the echo-write that would otherwise
  // happen when `profileLoading` flips false after a remote profile load —
  // the effect should only fire when profile/familyGroup change from a user
  // action, not when the loading flag settles.
  const profileLoadingRef = useRef(profileLoading);
  profileLoadingRef.current = profileLoading;

  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    // Skip if we're in the middle of loading the remote profile, or if
    // there's nothing to save yet.
    if (profileLoadingRef.current || !userRef.current || !profile) return;

    const timer = setTimeout(() => {
      saveUserProfile(userRef.current!.uid, {
        profile,
        familyGroup: familyGroup ?? null,
        updated_at: new Date().toISOString(),
      });
    }, PROFILE_SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
    // Only profile and familyGroup are reactive deps — changes to user or
    // profileLoading alone do not trigger a save.
  }, [profile, familyGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AuthGate() {
  const { user, loading, profileLoading } = useAuth();
  const { profile, setupProfile } = useFamilyStore();
  const [, setLocation] = useLocation();

  // Show spinner while Firebase resolves auth state OR while Firestore profile is loading
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // When Firebase is not configured (local-only mode), skip authentication
  // and go directly to setup or main app based on profile state
  const isLocalMode = !user && !loading;
  
  // Not signed in and Firebase is configured — show the auth page
  if (!user && !isLocalMode) {
    const handleAuth = (displayName: string | null) => {
      // Pre-fill profile name from Firebase if not already set
      if (!profile?.name && displayName) {
        setupProfile(displayName);
      }
    };
    return <Auth onAuth={handleAuth} />;
  }

  // In local mode or signed in but no family set up — go to setup
  if (!profile?.family_code) {
    // Pre-fill name from Firebase user if not set
    if (!profile?.name && user?.displayName) {
      setupProfile(user.displayName);
    }
    return (
      <AppLayout>
        <Setup />
      </AppLayout>
    );
  }

  // Fully authenticated + family set up (or local mode with family set up)
  return (
    <AppLayout>
      <SeedLoader />
      <Router />
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
