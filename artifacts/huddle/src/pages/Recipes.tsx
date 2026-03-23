import { useState, useRef } from "react";
import { Link } from "wouter";
import { Search, Download, Refrigerator, X, Plus } from "lucide-react";
import { Input, Button } from "@/components/ui";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";
import { Recipe } from "@/lib/types";
import { estimateRecipeCost, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

// ─── Ingredient matching ──────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

// Split a phrase into meaningful words (3+ chars)
function words(s: string): string[] {
  return normalize(s).split(/\s+/).filter(w => w.length >= 3);
}

function scoreRecipe(recipe: Recipe, pantry: string[]): { matched: number; total: number } {
  if (!pantry.length || !recipe.ingredients?.length) {
    return { matched: 0, total: recipe.ingredients?.length ?? 0 };
  }

  // Build a flat set of all significant words from every pantry entry
  const pantryWordSet = new Set(pantry.flatMap(words));
  // Also keep full normalized phrases for phrase-level matching
  const pantryPhrases = pantry.map(normalize);

  let matched = 0;
  for (const ing of recipe.ingredients) {
    const ingNorm  = normalize(ing.name);
    const ingWords = words(ing.name);

    // 1. Any word in the ingredient name matches a pantry word
    const wordMatch   = ingWords.some(w => pantryWordSet.has(w));
    // 2. Full phrase overlap in either direction ("chicken stock" ↔ "chicken")
    const phraseMatch = pantryPhrases.some(p => ingNorm.includes(p) || p.includes(ingNorm));

    if (wordMatch || phraseMatch) matched++;
  }
  return { matched, total: recipe.ingredients.length };
}

// ─── Component ────────────────────────────────────────────────────────────────

type Mode = "search" | "fridge";

export default function Recipes() {
  const { recipes } = useRecipeStore();
  const { familyGroup } = useFamilyStore();
  const currency = getCurrencyConfig(familyGroup?.country);

  const [mode, setMode] = useState<Mode>("search");
  const [search, setSearch] = useState("");

  // Fridge mode state
  const [pantry, setPantry] = useState<string[]>([]);
  const [fridgeInput, setFridgeInput] = useState("");
  const fridgeRef = useRef<HTMLInputElement>(null);

  // ── helpers ──
  const addIngredient = (raw: string) => {
    const val = raw.trim();
    if (!val) return;
    if (!pantry.some(p => normalize(p) === normalize(val))) {
      setPantry(prev => [...prev, val]);
    }
    setFridgeInput("");
    fridgeRef.current?.focus();
  };

  const removeIngredient = (idx: number) => setPantry(prev => prev.filter((_, i) => i !== idx));

  const handleFridgeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient(fridgeInput);
    }
    if (e.key === "Backspace" && !fridgeInput && pantry.length) {
      setPantry(prev => prev.slice(0, -1));
    }
  };

  // ── filtered / scored lists ──
  const searchFiltered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase()) ||
    r.ingredients?.some(i => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const fridgeScored = pantry.length
    ? recipes
        .map(r => ({ recipe: r, ...scoreRecipe(r, pantry) }))
        .filter(r => r.matched > 0)
        .sort((a, b) => b.matched - a.matched || b.matched / (b.total || 1) - a.matched / (a.total || 1))
    : [];

  const displayList = mode === "search" ? searchFiltered : fridgeScored.map(s => s.recipe);
  const scoreMap    = new Map(fridgeScored.map(s => [s.recipe.id, s]));

  return (
    <div className="flex flex-col min-h-full pb-24">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="px-5 pt-12 pb-3 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-display font-bold">Library</h1>
          <Link href="/import">
            <Button variant="ghost" size="icon" className="bg-secondary rounded-full w-10 h-10">
              <Download size={18} className="text-primary" />
            </Button>
          </Link>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-3 p-1 bg-secondary rounded-xl">
          <button
            onClick={() => setMode("search")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-all ${
              mode === "search" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Search size={14} /> Search
          </button>
          <button
            onClick={() => setMode("fridge")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-lg transition-all ${
              mode === "fridge" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            <Refrigerator size={14} /> What's in my fridge?
          </button>
        </div>

        {/* Search bar — search mode */}
        {mode === "search" && (
          <Input
            placeholder="Search recipes, cuisines, ingredients…"
            icon={<Search size={16} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11"
          />
        )}

        {/* Ingredient input — fridge mode */}
        {mode === "fridge" && (
          <div className="flex gap-2">
            <div
              className="flex-1 min-h-[44px] flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border border-input bg-background cursor-text"
              onClick={() => fridgeRef.current?.focus()}
            >
              {pantry.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full"
                >
                  {p}
                  <button
                    onClick={e => { e.stopPropagation(); removeIngredient(i); }}
                    className="hover:text-primary/60 ml-0.5"
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <input
                ref={fridgeRef}
                value={fridgeInput}
                onChange={e => setFridgeInput(e.target.value)}
                onKeyDown={handleFridgeKey}
                placeholder={pantry.length ? "Add another…" : "e.g. chicken, garlic…"}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5"
              />
            </div>
            {/* Tap-to-add button — reliable on mobile */}
            <button
              type="button"
              onClick={() => addIngredient(fridgeInput)}
              disabled={!fridgeInput.trim()}
              className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity self-start mt-0"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Fridge mode helper */}
        {mode === "fridge" && pantry.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Add ingredients you have at home — we'll find matching recipes.
          </p>
        )}
        {mode === "fridge" && pantry.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            {fridgeScored.length === 0
              ? "No recipes match those ingredients."
              : `${fridgeScored.length} recipe${fridgeScored.length !== 1 ? "s" : ""} found — sorted by best match`}
          </p>
        )}
      </header>

      {/* ── Recipe grid ──────────────────────────────────────────────────── */}
      <div className="p-5">

        {/* Empty state — search mode */}
        {mode === "search" && searchFiltered.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <img
                src={`${import.meta.env.BASE_URL}images/empty-plate.png`}
                alt="Empty"
                className="w-16 h-16 opacity-50"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{search ? "No matches" : "No recipes yet"}</h3>
            <p className="text-muted-foreground mb-8">
              {search
                ? `Nothing matched "${search}". Try a different search.`
                : "Import your favorites or create a new one to get started."}
            </p>
            {!search && (
              <Link href="/import">
                <Button className="w-full">Import Recipe via AI</Button>
              </Link>
            )}
          </div>
        )}

        {/* Empty state — fridge mode, no ingredients entered yet */}
        {mode === "fridge" && pantry.length === 0 && (
          <div className="text-center py-20 px-6 text-muted-foreground">
            <Refrigerator className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium">What's in the fridge?</p>
            <p className="text-sm mt-1">Type ingredients above to find recipes you can make right now.</p>
          </div>
        )}

        {/* Empty state — fridge mode, ingredients entered but no matches */}
        {mode === "fridge" && pantry.length > 0 && fridgeScored.length === 0 && (
          <div className="text-center py-20 px-6 text-muted-foreground">
            <Refrigerator className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No recipes found</p>
            <p className="text-sm mt-1">Try adding more ingredients or remove some to broaden results.</p>
          </div>
        )}

        {/* Grid */}
        {displayList.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {displayList.map(recipe => {
              const score = scoreMap.get(recipe.id);
              return (
                <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                  <div className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col h-full active:scale-95 transition-transform cursor-pointer shadow-sm hover:shadow-md">
                    {/* Photo / emoji */}
                    <div
                      className="w-full aspect-square flex items-center justify-center text-4xl"
                      style={{ backgroundColor: recipe.photo_color || "#f3f4f6" }}
                    >
                      {recipe.emoji || "🍲"}
                    </div>

                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{recipe.name}</h3>

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {recipe.cook_time && (
                          <span className="text-[10px] text-muted-foreground">{recipe.cook_time}m</span>
                        )}
                        {recipe.calories && (
                          <span className="text-[10px] text-muted-foreground">{recipe.calories} kcal</span>
                        )}
                      </div>

                      {/* Cost estimate */}
                      {(() => {
                        const cost = estimateRecipeCost(recipe, recipe.servings ?? 4);
                        if (!cost) return null;
                        return (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-primary">
                              {formatCost(cost.perServeUSD, currency)}/serve
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              · {formatCost(cost.totalUSD, currency)} total
                            </span>
                          </div>
                        );
                      })()}

                      {/* Match badge — fridge mode only */}
                      {score && score.matched > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-primary">
                              {score.matched}/{score.total} ingredients
                            </span>
                          </div>
                          <div className="h-1 bg-primary/15 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round((score.matched / score.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
