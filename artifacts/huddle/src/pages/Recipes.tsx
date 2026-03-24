import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  Search, Download, Refrigerator, X, Plus, Layers,
  ArrowUpDown, ArrowUp, ArrowDown, Salad, ArrowUp as ScrollTop,
  Heart, Users,
} from "lucide-react";
import { Input, Button } from "@/components/ui";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";
import { Recipe } from "@/lib/types";
import { estimateRecipeCost, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

// ─── Module-level fridge state (persists across route changes) ─────────────────
let _fridgeMode: "search" | "fridge" = "search";
let _fridgePantry: string[] = [];

// ─── Constants ────────────────────────────────────────────────────────────────

// Snack slots that are collapsed into one "Snacks" filter chip
const SNACK_SLOTS = ["morning_snack", "afternoon_snack", "night_snack"];

// Display slot options — snacks collapsed to one entry
// "base" is a special value that filters to component/base recipes
const DISPLAY_SLOTS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "dinner",    label: "Dinner" },
  { value: "snack",     label: "Snacks" },   // matches all three snack slots
  { value: "dessert",   label: "Dessert" },
  { value: "base",      label: "Base recipes" },
];

const SLOT_SHORT: Record<string, string> = {
  breakfast:       "Breakfast",
  lunch:           "Lunch",
  dinner:          "Dinner",
  morning_snack:   "Snack",
  afternoon_snack: "Snack",
  night_snack:     "Snack",
  dessert:         "Dessert",
};

type SortKey = "alpha" | "calories" | "cost" | "cook_time" | "protein";
type SortDir = "asc" | "desc";
type Mode = "search" | "fridge";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "alpha",     label: "A–Z" },
  { key: "calories",  label: "Calories" },
  { key: "cost",      label: "Cost/serve" },
  { key: "cook_time", label: "Cook time" },
  { key: "protein",   label: "Protein" },
];

// ─── Ingredient matching (fridge mode) ───────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
function words(s: string): string[] {
  return normalize(s).split(/\s+/).filter(w => w.length >= 3);
}
function scoreRecipe(recipe: Recipe, pantry: string[]): { matched: number; total: number } {
  if (!pantry.length || !recipe.ingredients?.length) {
    return { matched: 0, total: recipe.ingredients?.length ?? 0 };
  }
  const pantryWordSet = new Set(pantry.flatMap(words));
  const pantryPhrases = pantry.map(normalize);
  let matched = 0;
  for (const ing of recipe.ingredients) {
    const ingNorm  = normalize(ing.name);
    const ingWords = words(ing.name);
    const wordMatch   = ingWords.some(w => pantryWordSet.has(w));
    const phraseMatch = pantryPhrases.some(p => ingNorm.includes(p) || p.includes(ingNorm));
    if (wordMatch || phraseMatch) matched++;
  }
  return { matched, total: recipe.ingredients.length };
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortRecipes(list: Recipe[], key: SortKey, dir: SortDir, currency: ReturnType<typeof getCurrencyConfig>): Recipe[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (key) {
      case "alpha":     return mul * a.name.localeCompare(b.name);
      case "calories":  return mul * ((a.calories ?? 0) - (b.calories ?? 0));
      case "protein":   return mul * ((a.protein  ?? 0) - (b.protein  ?? 0));
      case "cook_time": return mul * ((a.cook_time ?? 0) - (b.cook_time ?? 0));
      case "cost": {
        const ca = estimateRecipeCost(a, a.servings ?? 4)?.perServeUSD ?? 0;
        const cb = estimateRecipeCost(b, b.servings ?? 4)?.perServeUSD ?? 0;
        return mul * (ca - cb);
      }
      default: return 0;
    }
  });
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label, active, onClick, icon, baseStyle,
}: {
  label: string; active: boolean; onClick: () => void;
  icon?: React.ReactNode; baseStyle?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
        active
          ? baseStyle
            ? "bg-primary/90 text-white border-primary/90"
            : "bg-primary text-white border-primary"
          : baseStyle
            ? "bg-primary/8 text-primary border-primary/30 hover:border-primary/60"
            : "bg-white text-muted-foreground border-border hover:border-primary/30"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Sort chip ────────────────────────────────────────────────────────────────

function SortChip({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-muted-foreground border-border hover:border-primary/40"
      }`}
    >
      {label}
      <Icon size={11} strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Recipes() {
  const { recipes, favourites, toggleFavourite, loadCommunity, loadSeeds } = useRecipeStore();
  const { familyGroup } = useFamilyStore();
  const currency        = getCurrencyConfig(familyGroup?.country);
  const familyCode      = familyGroup?.code ?? "";
  const myFavs          = favourites[familyCode] ?? [];

  const [mode, setMode]         = useState<Mode>(_fridgeMode);
  const [search, setSearch]     = useState("");
  const [filterSlot, setFilterSlot] = useState<string | null>(null);
  const [filterVeg, setFilterVeg]   = useState(false);
  const [filterFavs, setFilterFavs] = useState(false);
  const [sortKey, setSortKey]       = useState<SortKey | null>(null);
  const [sortDir, setSortDir]       = useState<SortDir>("asc");

  // Fridge mode — seed from module-level, persist back on change
  const [pantry, setPantry]           = useState<string[]>(_fridgePantry);
  const [fridgeInput, setFridgeInput] = useState("");
  const fridgeRef = useRef<HTMLInputElement>(null);

  // Persist fridge state to module-level vars whenever they change
  useEffect(() => { _fridgeMode = mode; }, [mode]);
  useEffect(() => { _fridgePantry = pantry; }, [pantry]);

  // Ensure seeds + community recipes are loaded whenever this page mounts
  // (guards against the store being cleared between sessions)
  useEffect(() => {
    if (familyCode) loadSeeds(familyCode);
    loadCommunity();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-top
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const hasActiveFilters = filterSlot !== null || filterVeg || sortKey !== null || filterFavs;

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setFilterSlot(null);
    setFilterVeg(false);
    setFilterFavs(false);
    setSortKey(null);
    setSortDir("asc");
  };

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
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addIngredient(fridgeInput); }
    if (e.key === "Backspace" && !fridgeInput && pantry.length) setPantry(prev => prev.slice(0, -1));
  };

  // ── Library split — includes community recipes (family_code === "__community__") ──
  const familyRecipes = recipes.filter(r =>
    !r.family_code ||
    r.family_code === familyGroup?.code ||
    r.family_code === "__seed__" ||
    r.family_code === "__community__"
  );
  const mealRecipes   = familyRecipes.filter(r => !r.is_component);
  const baseRecipes   = familyRecipes.filter(r => !!r.is_component);

  // ── Slot filter matching — "snack" matches all three snack slots, "base" handled separately ──
  const slotMatches = (r: Recipe) => {
    if (!filterSlot || filterSlot === "base") return true;
    if (filterSlot === "snack") return r.meal_slots?.some(s => SNACK_SLOTS.includes(s)) ?? false;
    return r.meal_slots?.includes(filterSlot) ?? false;
  };

  const isBaseFilter = filterSlot === "base";

  // ── Apply search + filters ──
  let filteredMeal = mealRecipes.filter(r => {
    const cuisine = Array.isArray(r.cuisine) ? r.cuisine[0] : r.cuisine;
    const q = search.toLowerCase();
    const matchesSearch = !search || (
      r.name.toLowerCase().includes(q) ||
      (typeof cuisine === "string" && cuisine.toLowerCase().includes(q)) ||
      r.ingredients?.some(i => i.name.toLowerCase().includes(q))
    );
    const matchesFav = !filterFavs || myFavs.includes(r.id);
    return matchesSearch && slotMatches(r) && (!filterVeg || r.vegetarian) && matchesFav;
  });

  if (sortKey) filteredMeal = sortRecipes(filteredMeal, sortKey, sortDir, currency);

  const filteredBaseRecipes = baseRecipes.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.ingredients?.some(i => i.name.toLowerCase().includes(q));
  });

  // When "Base recipes" filter is active, show base recipes in the main grid
  const filteredBaseForGrid = filteredBaseRecipes;

  // ── Fridge mode ──
  const fridgeScored = pantry.length
    ? mealRecipes
        .map(r => ({ recipe: r, ...scoreRecipe(r, pantry) }))
        .filter(r => r.matched > 0)
        .sort((a, b) => b.matched - a.matched || b.matched / (b.total || 1) - a.matched / (a.total || 1))
    : [];

  const displayList = mode === "search"
    ? (isBaseFilter ? filteredBaseForGrid : filteredMeal)
    : fridgeScored.map(s => s.recipe);
  const scoreMap    = new Map(fridgeScored.map(s => [s.recipe.id, s]));

  // ── Slot badge label on cards — collapse all snack variants ──
  const cardSlotLabel = (slot: string) => {
    if (SNACK_SLOTS.includes(slot)) return "Snack";
    return SLOT_SHORT[slot] ?? slot;
  };

  // De-dup badge labels on a single card (e.g. 3 snack slots → just one "Snack" badge)
  const cardBadges = (slots: string[]) => {
    const seen = new Set<string>();
    return slots.filter(s => {
      const label = cardSlotLabel(s);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  };

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

        {/* Search bar */}
        {mode === "search" && (
          <Input
            placeholder="Search recipes, cuisines, ingredients…"
            icon={<Search size={16} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11"
          />
        )}

        {/* ── Filter rows — search mode ──────────────────────────────────── */}
        {mode === "search" && (
          <div className="mt-3 space-y-2">

            {/* Row 1 — Meal type filter chips (wrap naturally, no scroll) */}
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All meals"
                active={filterSlot === null}
                onClick={() => setFilterSlot(null)}
              />
              {DISPLAY_SLOTS.map(({ value, label }) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={filterSlot === value}
                  onClick={() => setFilterSlot(filterSlot === value ? null : value)}
                  icon={value === "base" ? <Layers size={11} /> : undefined}
                  baseStyle={value === "base"}
                />
              ))}
            </div>

            {/* Row 2 — Veg toggle + favourites + sort chips (wrap, no scroll) */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {/* Veg toggle */}
              <button
                onClick={() => setFilterVeg(v => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  filterVeg
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-muted-foreground border-border hover:border-primary/30"
                }`}
              >
                <Salad size={11} />
                Veg only
              </button>

              {/* Favourites toggle */}
              <button
                onClick={() => setFilterFavs(v => !v)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  filterFavs
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white text-muted-foreground border-border hover:border-rose-300"
                }`}
              >
                <Heart size={11} fill={filterFavs ? "currentColor" : "none"} />
                Favourites
                {myFavs.length > 0 && !filterFavs && (
                  <span className="ml-0.5 bg-rose-100 text-rose-600 rounded-full px-1.5 py-0 text-[9px] font-bold leading-4">
                    {myFavs.length}
                  </span>
                )}
              </button>

              <div className="h-4 w-px bg-border flex-shrink-0" />

              {SORT_OPTIONS.map(opt => (
                <SortChip
                  key={opt.key}
                  label={opt.label}
                  active={sortKey === opt.key}
                  dir={sortDir}
                  onClick={() => handleSortClick(opt.key)}
                />
              ))}

              {hasActiveFilters && (
                <>
                  <div className="h-4 w-px bg-border flex-shrink-0" />
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-destructive border border-destructive/30 bg-white whitespace-nowrap"
                  >
                    <X size={11} /> Clear all
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Ingredient input — fridge mode */}
        {mode === "fridge" && (
          <div className="flex gap-2">
            <div
              className="flex-1 min-h-[44px] flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border border-input bg-background cursor-text"
              onClick={() => fridgeRef.current?.focus()}
            >
              {pantry.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                  {p}
                  <button onClick={e => { e.stopPropagation(); removeIngredient(i); }} className="hover:text-primary/60 ml-0.5">
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
            <button
              type="button"
              onClick={() => addIngredient(fridgeInput)}
              disabled={!fridgeInput.trim()}
              className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity self-start"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}

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

        {mode === "search" && displayList.length > 0 && (
          <p className="text-xs text-muted-foreground mb-4">
            {displayList.length} recipe{displayList.length !== 1 ? "s" : ""}
            {filterSlot ? ` · ${DISPLAY_SLOTS.find(s => s.value === filterSlot)?.label ?? filterSlot}` : ""}
            {filterVeg && !isBaseFilter ? " · Vegetarian" : ""}
            {sortKey && !isBaseFilter ? ` · Sorted by ${SORT_OPTIONS.find(o => o.key === sortKey)?.label} (${sortDir === "asc" ? "↑" : "↓"})` : ""}
          </p>
        )}

        {/* Empty state — search mode */}
        {mode === "search" && displayList.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <img
                src={`${import.meta.env.BASE_URL}images/empty-plate.png`}
                alt="Empty"
                className="w-16 h-16 opacity-50"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {search || hasActiveFilters ? "No matches" : "No recipes yet"}
            </h3>
            <p className="text-muted-foreground mb-8">
              {search
                ? `Nothing matched "${search}". Try a different search.`
                : hasActiveFilters
                ? "No recipes match the active filters. Try clearing some."
                : "Import your favorites or create a new one to get started."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="mb-3 w-full">Clear filters</Button>
            )}
            {!search && !hasActiveFilters && (
              <Link href="/import"><Button className="w-full">Import Recipe via AI</Button></Link>
            )}
          </div>
        )}

        {/* Empty state — fridge mode */}
        {mode === "fridge" && pantry.length === 0 && (
          <div className="text-center py-20 px-6 text-muted-foreground">
            <Refrigerator className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium">What's in the fridge?</p>
            <p className="text-sm mt-1">Type ingredients above to find recipes you can make right now.</p>
          </div>
        )}
        {mode === "fridge" && pantry.length > 0 && fridgeScored.length === 0 && (
          <div className="text-center py-20 px-6 text-muted-foreground">
            <Refrigerator className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No recipes found</p>
            <p className="text-sm mt-1">Try adding more ingredients or remove some to broaden results.</p>
          </div>
        )}

        {/* Recipe grid */}
        {displayList.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {displayList.map(recipe => {
              const score  = scoreMap.get(recipe.id);
              const badges = cardBadges(recipe.meal_slots ?? []);
              const isFav  = myFavs.includes(recipe.id);
              return (
                <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                  <div className="bg-white border border-border rounded-2xl overflow-hidden flex flex-col h-full active:scale-95 transition-transform cursor-pointer shadow-sm hover:shadow-md">
                    <div
                      className="w-full aspect-square flex items-center justify-center text-4xl relative"
                      style={{ backgroundColor: recipe.photo_color || "#f3f4f6" }}
                    >
                      {recipe.emoji || "🍲"}
                      {/* Favourite button */}
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavourite(familyCode, recipe.id); }}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isFav ? "bg-rose-500 text-white shadow" : "bg-white/70 backdrop-blur-sm text-rose-400 hover:bg-white"
                        }`}
                      >
                        <Heart size={13} fill={isFav ? "currentColor" : "none"} strokeWidth={isFav ? 0 : 2} />
                      </button>
                      {/* Community badge */}
                      {recipe.is_community && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white rounded-full px-1.5 py-0.5">
                          <Users size={9} />
                          <span className="text-[9px] font-bold">Community</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{recipe.name}</h3>

                      {/* Slot badges — de-duped */}
                      {badges.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {badges.map(slot => (
                            <span
                              key={slot}
                              className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                                slotMatches({ ...recipe, meal_slots: [slot] } as Recipe)
                                  ? "bg-primary/15 text-primary"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {cardSlotLabel(slot)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {recipe.cook_time && (
                          <span className="text-[10px] text-muted-foreground">{recipe.cook_time}m</span>
                        )}
                        {recipe.calories && (
                          <span className={`text-[10px] ${sortKey === "calories" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {recipe.calories} kcal
                          </span>
                        )}
                        {recipe.protein && sortKey === "protein" && (
                          <span className="text-[10px] text-primary font-semibold">{recipe.protein}g protein</span>
                        )}
                      </div>

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

                      {recipe.ingredients?.some(i => i.base_recipe_id) && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary">
                          <Layers size={10} />
                          uses base recipe
                        </div>
                      )}

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

        {/* Base recipes section — hidden when base filter active (shown in main grid instead) */}
        {mode === "search" && !filterSlot && !isBaseFilter && filteredBaseRecipes.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={15} className="text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base Recipes</h2>
              <span className="text-xs text-muted-foreground/60">({filteredBaseRecipes.length})</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3 -mt-1">
              Sub-recipes used as ingredients — not included in the meal planner.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {filteredBaseRecipes.map(recipe => {
                const cost       = estimateRecipeCost(recipe, recipe.servings ?? 4);
                const usedByCount = mealRecipes.filter(r =>
                  r.ingredients?.some(ing => ing.base_recipe_id === recipe.id)
                ).length;
                return (
                  <Link key={recipe.id} href={`/recipe/${recipe.id}`}>
                    <div className="bg-white border border-primary/20 rounded-2xl overflow-hidden flex flex-col h-full active:scale-95 transition-transform cursor-pointer shadow-sm hover:shadow-md">
                      <div
                        className="w-full aspect-square flex items-center justify-center text-4xl relative"
                        style={{ backgroundColor: recipe.photo_color || "#f3f4f6" }}
                      >
                        {recipe.emoji || "🍲"}
                        <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          <Layers size={8} /> base
                        </span>
                      </div>
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{recipe.name}</h3>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {recipe.cook_time && (
                            <span className="text-[10px] text-muted-foreground">{recipe.cook_time}m</span>
                          )}
                          {usedByCount > 0 && (
                            <span className="text-[10px] text-primary font-semibold">
                              used in {usedByCount} recipe{usedByCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {cost && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-primary">
                              {formatCost(cost.perServeUSD, currency)}/serve
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating scroll-to-top button ────────────────────────────────── */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`fixed bottom-24 right-5 z-30 w-10 h-10 rounded-full bg-foreground/70 text-white flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-300 ${
          showScrollTop ? "opacity-60 translate-y-0 pointer-events-auto hover:opacity-90" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ScrollTop size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
