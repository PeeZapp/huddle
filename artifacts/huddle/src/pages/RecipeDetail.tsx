import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Clock, Flame, Globe, Leaf, Trash2, DollarSign, Users, TrendingUp } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";
import { estimateRecipeCost, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

export default function RecipeDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { recipes, deleteRecipe } = useRecipeStore();
  const { familyGroup } = useFamilyStore();

  const recipe = recipes.find(r => r.id === id);

  if (!recipe) {
    return <div className="p-6 text-center mt-20">Recipe not found</div>;
  }

  const servings = recipe.servings ?? 4;
  const currency = getCurrencyConfig(familyGroup?.country);
  const cost     = estimateRecipeCost(recipe, servings);

  const handleDelete = () => {
    if (confirm("Delete this recipe?")) {
      deleteRecipe(recipe.id);
      setLocation("/recipes");
    }
  };

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
      </div>

      <div className="p-6 -mt-8 relative z-10 bg-background rounded-t-3xl">
        {/* Title & badges */}
        <h1 className="text-3xl font-display font-bold leading-tight mb-3">{recipe.name}</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.cook_time && (
            <Badge variant="outline"><Clock size={12} className="mr-1" /> {recipe.cook_time}m</Badge>
          )}
          {recipe.calories && (
            <Badge variant="outline"><Flame size={12} className="mr-1" /> {recipe.calories} cal</Badge>
          )}
          {recipe.cuisine && (
            <Badge variant="outline"><Globe size={12} className="mr-1" /> {recipe.cuisine}</Badge>
          )}
          {recipe.vegetarian && (
            <Badge variant="success"><Leaf size={12} className="mr-1" /> Veg</Badge>
          )}
          <Badge variant="outline"><Users size={12} className="mr-1" /> {servings} serves</Badge>
        </div>

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
                <p className="text-2xl font-bold text-foreground">{formatCost(cost.totalUSD, currency)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{currency.code}</p>
              </div>
              <div className="flex-1 bg-white rounded-xl p-3 border border-border/60 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Per Serve</p>
                <p className="text-2xl font-bold text-primary">{formatCost(cost.perServeUSD, currency)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{servings} serves</p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3 text-center leading-relaxed">
              Prices based on {currency.code} supermarket averages · {cost.coveredIngredients}/{cost.totalIngredients} ingredients priced
            </p>
          </div>
        )}

        <div className="space-y-8">
          {/* Ingredients */}
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">🛒</span>
              Ingredients
            </h3>
            <ul className="space-y-3 bg-white p-5 rounded-2xl border border-border">
              {recipe.ingredients?.map((ing, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-medium">{ing.name}</span>
                  <span className="text-muted-foreground">{ing.amount}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Method */}
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">👨‍🍳</span>
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
              <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2">
                💡 Chef's Tip
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed">{recipe.chef_tip}</p>
            </section>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-border flex justify-center">
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 size={18} className="mr-2" /> Delete Recipe
          </Button>
        </div>
      </div>
    </div>
  );
}
