import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Clock, Flame, Globe, Leaf, Trash2,
  DollarSign, Users, FileText, ToggleLeft, ToggleRight, Check,
  Layers, ExternalLink,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useRecipeStore, useFamilyStore, usePriceStore } from "@/stores/huddle-stores";
import { estimateRecipeCost, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

export default function RecipeDetail() {
  const { id }                        = useParams();
  const [, setLocation]               = useLocation();
  const { recipes, updateRecipe, deleteRecipe } = useRecipeStore();
  const { familyGroup }               = useFamilyStore();
  const { userPrices, aiPrices }      = usePriceStore();

  const recipe = recipes.find(r => r.id === id);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft]     = useState("");

  if (!recipe) {
    return <div className="p-6 text-center mt-20">Recipe not found</div>;
  }

  const servings = recipe.servings ?? 4;
  const currency = getCurrencyConfig(familyGroup?.country);
  const cost     = estimateRecipeCost(recipe, servings, { userPrices, aiPrices });

  // Map ingredient → base recipe for quick look-up
  const baseRecipeMap = new Map(
    recipes.filter(r => r.is_component).map(r => [r.id, r])
  );

  const handleDelete = () => {
    if (confirm("Delete this recipe?")) {
      deleteRecipe(recipe.id);
      setLocation("/recipes");
    }
  };

  const startEditNotes = () => {
    setNotesDraft(recipe.user_notes ?? "");
    setEditingNotes(true);
  };

  const saveNotes = () => {
    updateRecipe(recipe.id, { user_notes: notesDraft.trim() || undefined });
    setEditingNotes(false);
  };

  const toggleExcluded = () => {
    updateRecipe(recipe.id, { excluded_from_auto: !recipe.excluded_from_auto });
  };

  // Find which regular recipes use this base recipe (shown on base recipe detail pages)
  const usedByRecipes = recipe.is_component
    ? recipes.filter(r =>
        !r.is_component &&
        r.ingredients?.some(ing => ing.base_recipe_id === recipe.id)
      )
    : [];

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      {/* Hero */}
      <div
        className="h-64 w-full relative flex items-center justify-center text-7xl"
        style={{ backgroundColor: recipe.photo_color || "#e5e7eb" }}
      >
        <button
          onClick={() => window.history.back()}
          className="absolute top-6 left-6 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-black/70 hover:bg-white/70"
        >
          <ArrowLeft size={20} />
        </button>
        {recipe.emoji || "🍲"}

        {/* Base recipe banner */}
        {recipe.is_component && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2 bg-primary/90 backdrop-blur-sm text-white text-xs font-bold tracking-wide uppercase">
            <Layers size={13} />
            Base Recipe
          </div>
        )}
      </div>

      <div className="p-6 -mt-8 relative z-10 bg-background rounded-t-3xl">
        {/* Title */}
        <h1 className="text-3xl font-display font-bold leading-tight mb-3">{recipe.name}</h1>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.cook_time && <Badge variant="outline"><Clock size={12} className="mr-1" /> {recipe.cook_time}m</Badge>}
          {recipe.calories  && <Badge variant="outline"><Flame size={12} className="mr-1" /> {recipe.calories} cal</Badge>}
          {recipe.cuisine   && <Badge variant="outline"><Globe size={12} className="mr-1" /> {recipe.cuisine}</Badge>}
          {recipe.vegetarian && <Badge variant="success"><Leaf size={12} className="mr-1" /> Veg</Badge>}
          <Badge variant="outline"><Users size={12} className="mr-1" /> {servings} serves</Badge>
        </div>

        {/* Plan inclusion toggle — hidden for base recipes (always excluded) */}
        {!recipe.is_component && (
          <button
            onClick={toggleExcluded}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border mb-5 transition-colors ${
              recipe.excluded_from_auto
                ? "bg-muted/50 border-border text-muted-foreground"
                : "bg-primary/5 border-primary/20 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {recipe.excluded_from_auto
                ? <ToggleLeft size={20} className="text-muted-foreground" />
                : <ToggleRight size={20} className="text-primary" />}
              <span className="text-sm font-medium">
                {recipe.excluded_from_auto ? "Excluded from generated plans" : "Included in generated plans"}
              </span>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              recipe.excluded_from_auto ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            }`}>
              {recipe.excluded_from_auto ? "Off" : "On"}
            </span>
          </button>
        )}

        {/* Base recipe — "used by" info */}
        {recipe.is_component && usedByRecipes.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Used in</p>
            <div className="space-y-1.5">
              {usedByRecipes.map(r => (
                <button
                  key={r.id}
                  onClick={() => setLocation(`/recipe/${r.id}`)}
                  className="w-full flex items-center gap-2.5 text-left text-sm font-medium hover:text-primary transition-colors"
                >
                  <span>{r.emoji ?? "🍲"}</span>
                  <span className="flex-1">{r.name}</span>
                  <ExternalLink size={13} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Base recipe note — not in planner */}
        {recipe.is_component && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-border bg-muted/40 text-muted-foreground text-sm mb-5">
            <Layers size={16} className="shrink-0" />
            <span>This is a base recipe — it won't appear in your meal planner.</span>
          </div>
        )}

        {/* Macros */}
        {(recipe.protein || recipe.carbs || recipe.fat) && (
          <div className="flex gap-4 p-4 bg-white rounded-2xl border border-border mb-5">
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Protein</span>
              <span className="text-lg font-bold">{recipe.protein ?? "-"}g</span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Carbs</span>
              <span className="text-lg font-bold">{recipe.carbs ?? "-"}g</span>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fat</span>
              <span className="text-lg font-bold">{recipe.fat ?? "-"}g</span>
            </div>
          </div>
        )}

        {/* Cost estimate */}
        {cost && (
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign size={14} className="text-primary" />
              </div>
              <span className="text-sm font-bold text-primary">Estimated Cost</span>
              {cost.confidence !== "high" && (
                <span className="ml-auto text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {cost.confidence === "medium" ? "approx." : "rough est."}
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-white rounded-xl p-3 border border-border/60 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Total</p>
                <p className="text-2xl font-bold">{formatCost(cost.totalUSD, currency)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{currency.code}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl p-3 border border-border/60 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Per Serve</p>
                <p className="text-2xl font-bold text-primary">{formatCost(cost.perServeUSD, currency)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{servings} serves</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              {currency.code} supermarket estimates · {cost.coveredIngredients}/{cost.totalIngredients} ingredients priced
            </p>
          </div>
        )}

        <div className="space-y-8">
          {/* Ingredients */}
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">🛒</span>
              Ingredients
            </h3>
            <ul className="space-y-3 bg-white p-5 rounded-2xl border border-border">
              {recipe.ingredients?.map((ing, i) => {
                const baseRecipe = ing.base_recipe_id ? baseRecipeMap.get(ing.base_recipe_id) : undefined;
                return (
                  <li key={i} className="flex justify-between items-center text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate">{ing.name}</span>
                      {baseRecipe && (
                        <button
                          onClick={() => setLocation(`/recipe/${baseRecipe.id}`)}
                          title={`View base recipe: ${baseRecipe.name}`}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0 hover:bg-primary/20 transition-colors"
                        >
                          <Layers size={9} />
                          base
                        </button>
                      )}
                    </div>
                    <span className="text-muted-foreground ml-2 shrink-0">{ing.amount}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Method */}
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">👨‍🍳</span>
              Method
            </h3>
            <div className="space-y-4">
              {recipe.method?.map((step, i) => (
                <div key={i} className="flex gap-4 bg-white p-4 rounded-2xl border border-border">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{step}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Chef tip */}
          {recipe.chef_tip && (
            <section className="bg-accent/10 p-5 rounded-2xl border border-accent/20">
              <h4 className="font-bold flex items-center gap-2 mb-2">💡 Chef's Tip</h4>
              <p className="text-sm text-foreground/80 leading-relaxed">{recipe.chef_tip}</p>
            </section>
          )}

          {/* My notes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                  <FileText size={14} className="text-primary" />
                </span>
                My Notes
              </h3>
              {!editingNotes && (
                <button
                  onClick={startEditNotes}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {recipe.user_notes ? "Edit" : "+ Add note"}
                </button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  placeholder="Substitutions, tweaks, family ratings, reminders…"
                  autoFocus
                  rows={4}
                  className="w-full text-sm p-4 rounded-2xl border border-input bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={saveNotes}>
                    <Check size={15} className="mr-1.5" /> Save Note
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : recipe.user_notes ? (
              <div
                className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-yellow-100 transition-colors"
                onClick={startEditNotes}
              >
                {recipe.user_notes}
              </div>
            ) : (
              <button
                onClick={startEditNotes}
                className="w-full py-5 rounded-2xl border-2 border-dashed border-border text-muted-foreground text-sm hover:border-primary/30 hover:text-primary transition-colors"
              >
                Tap to add a note — substitutions, family rating, tips…
              </button>
            )}
          </section>
        </div>

        {/* Delete */}
        <div className="mt-12 pt-6 border-t border-border flex justify-center">
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 size={18} className="mr-2" /> Delete Recipe
          </Button>
        </div>
      </div>
    </div>
  );
}
