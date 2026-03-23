import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppLayout>
          <Router />
        </AppLayout>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
