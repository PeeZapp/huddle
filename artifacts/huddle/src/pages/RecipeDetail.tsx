import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Clock, Flame, Globe, Leaf, Trash2 } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useRecipeStore } from "@/stores/huddle-stores";

export default function RecipeDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { recipes, deleteRecipe } = useRecipeStore();
  
  const recipe = recipes.find(r => r.id === id);

  if (!recipe) {
    return <div className="p-6 text-center mt-20">Recipe not found</div>;
  }

  const handleDelete = () => {
    if(confirm("Delete this recipe?")) {
      deleteRecipe(recipe.id);
      setLocation("/recipes");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <div 
        className="h-64 w-full relative flex items-center justify-center text-7xl"
        style={{ backgroundColor: recipe.photo_color || '#e5e7eb' }}
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
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl font-display font-bold leading-tight flex-1 pr-4">{recipe.name}</h1>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.cook_time && <Badge variant="outline"><Clock size={12} className="mr-1"/> {recipe.cook_time}m</Badge>}
          {recipe.calories && <Badge variant="outline"><Flame size={12} className="mr-1"/> {recipe.calories} cal</Badge>}
          {recipe.cuisine && <Badge variant="outline"><Globe size={12} className="mr-1"/> {recipe.cuisine}</Badge>}
          {recipe.vegetarian && <Badge variant="success"><Leaf size={12} className="mr-1"/> Veg</Badge>}
        </div>

        {(recipe.protein || recipe.carbs || recipe.fat) && (
          <div className="flex gap-4 p-4 bg-white rounded-2xl border border-border mb-8">
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Protein</span>
              <span className="text-lg font-bold">{recipe.protein || '-'}g</span>
            </div>
            <div className="w-px bg-border"></div>
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Carbs</span>
              <span className="text-lg font-bold">{recipe.carbs || '-'}g</span>
            </div>
            <div className="w-px bg-border"></div>
            <div className="flex-1 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1">Fat</span>
              <span className="text-lg font-bold">{recipe.fat || '-'}g</span>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">🛒</span>
              Ingredients
            </h3>
            <ul className="space-y-3 bg-white p-5 rounded-2xl border border-border">
              {recipe.ingredients?.map((ing, i) => (
                <li key={i} className="flex justify-between items-center text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <span className="font-medium">{ing.name}</span>
                  <span className="text-muted-foreground">{ing.amount}</span>
                </li>
              ))}
            </ul>
          </section>

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

          {recipe.chef_tip && (
            <section className="bg-accent/10 p-5 rounded-2xl border border-accent/20">
              <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2">💡 Chef's Tip</h4>
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
