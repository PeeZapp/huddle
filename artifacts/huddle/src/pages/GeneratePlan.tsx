import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, RefreshCw, Sparkles, Info, ShieldAlert } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { useFamilyStore, useMealPlanStore, useNutritionStore, useRecipeStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { MEAL_SLOTS, MealSlotKey } from "@/lib/types";
import { generateMealPlan, recipesForSlot, SLOT_ASSUMED, CORE_SLOTS, OPTIONAL_SLOTS, GeneratedSlot } from "@/lib/generate-plan";
import { filterRecipesForFamily, familyRestrictions } from "@/lib/dietary";

const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

export default function GeneratePlan() {
  const [, setLocation]       = useLocation();
  const { familyGroup }       = useFamilyStore();
  const { getPlan, setSlot, setActiveSlots } = useMealPlanStore();
  const { goals }             = useNutritionStore();
  const { recipes }           = useRecipeStore();

  const weekStart = getWeekStart();
  const plan      = getPlan(weekStart, familyGroup?.code || "");

  // ── Slot selection state ─────────────────────────────────────────────────
  const [selectedSlots, setSelectedSlots] = useState<Set<MealSlotKey>>(
    () => new Set(plan.active_slots as MealSlotKey[]),
  );

  function toggleSlot(slot: MealSlotKey) {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      next.has(slot) ? next.delete(slot) : next.add(slot);
      return next;
    });
  }

  // ── Dietary filtering ────────────────────────────────────────────────────
  const members = familyGroup?.family_members ?? [];
  const restrictions = familyRestrictions(members);

  // Filter pool: apply family dietary needs + respect excluded_from_auto
  const filteredRecipes = useMemo(() => {
    const safe = filterRecipesForFamily(recipes, members);
    return safe.filter(r => !r.excluded_from_auto);
  }, [recipes, members]);

  const filteredOut = recipes.length - filteredRecipes.length;

  // Recipe count per slot (so user knows what's available)
  const recipeCountPerSlot = useMemo(() =>
    Object.fromEntries(
      MEAL_SLOTS.map(({ key }) => [key, recipesForSlot(filteredRecipes, key).length]),
    ), [filteredRecipes]);

  // ── Generation state ─────────────────────────────────────────────────────
  const [results, setResults]  = useState<GeneratedSlot[]>([]);
  const [isPreview, setIsPreview] = useState(false);

  const existingKeys = useMemo(
    () => new Set(Object.keys(plan.slots)),
    [plan.slots],
  );

  function handleGenerate() {
    const slots = [...selectedSlots];
    const generated = generateMealPlan(slots, existingKeys, filteredRecipes, goals);
    setResults(generated);
    setIsPreview(true);
  }

  function handleApply() {
    const slots = [...selectedSlots];
    // Persist which slots are active so Plan.tsx renders them all
    setActiveSlots(weekStart, familyGroup!.code, slots);
    results.forEach(({ day, slot, recipe }) => {
      setSlot(weekStart, familyGroup!.code, day, slot, {
        recipe_id:   recipe.id,
        recipe_name: recipe.name,
        emoji:       recipe.emoji,
        calories:    recipe.calories,
        protein:     recipe.protein,
        carbs:       recipe.carbs,
        fat:         recipe.fat,
        cook_time:   recipe.cook_time,
      });
    });
    setLocation("/");
  }

  // Nutrition summary of the generated preview
  const previewTotals = useMemo(() => {
    const DAYS_COUNT = 7;
    const totalCal = results.reduce((s, r) => s + (r.recipe.calories ?? 0), 0);
    const totalProt = results.reduce((s, r) => s + (r.recipe.protein ?? 0), 0);
    return {
      avgCal:  Math.round(totalCal  / DAYS_COUNT),
      avgProt: Math.round(totalProt / DAYS_COUNT),
    };
  }, [results]);

  // ── Selected slot nutrition context ─────────────────────────────────────
  // Only CORE unselected slots (breakfast/lunch/dinner) are assumed.
  // Snacks and dessert are optional — no calories assumed when not selected.
  const unselectedAssumedCal = CORE_SLOTS
    .filter(key => !selectedSlots.has(key))
    .reduce((sum, key) => sum + SLOT_ASSUMED[key].calories, 0);

  const remainingBudget = Math.max(goals.calories - unselectedAssumedCal, 0);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
        <button
          onClick={() => isPreview ? setIsPreview(false) : setLocation("/")}
          className="p-2 -ml-2 rounded-full hover:bg-secondary"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-display font-bold">Auto-Fill Plan</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto pb-32">
        {!isPreview ? (
          <div className="space-y-6">

            {/* Hero card */}
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 text-center py-8">
              <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                <Sparkles size={32} />
              </div>
              <h2 className="text-xl font-bold mb-1">Smart Meal Planning</h2>
              <p className="text-muted-foreground text-sm max-w-[260px] mx-auto">
                Pick which meals to fill. The planner will match your nutrition goals as closely as possible.
              </p>
            </Card>

            {/* Dietary filter banner */}
            {(restrictions.length > 0 || filteredOut > 0) && (
              <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <ShieldAlert size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary mb-0.5">
                    Dietary filters active
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {filteredOut > 0
                      ? `${filteredOut} recipe${filteredOut !== 1 ? "s" : ""} excluded based on your family's dietary needs.`
                      : "Family dietary needs will be respected when selecting recipes."}
                    {" "}
                    {restrictions.length > 0 && (
                      <span className="font-medium">{restrictions.join(", ")}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Slot selector */}
            <div className="space-y-4">
              {/* Core meals */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Core meals</p>
                <div className="grid grid-cols-3 gap-2">
                  {MEAL_SLOTS.filter(({ key }) => !OPTIONAL_SLOTS.includes(key)).map(({ key, label }) => {
                    const active = selectedSlots.has(key);
                    const count  = recipeCountPerSlot[key] ?? 0;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleSlot(key)}
                        className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                          active
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                            : "bg-white border-border hover:border-primary/20"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center">
                            <Check size={9} />
                          </span>
                        )}
                        <span className={`text-sm font-bold ${active ? "text-primary" : ""}`}>{label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{count} recipe{count !== 1 ? "s" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional extras */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Optional extras</p>
                <p className="text-[11px] text-muted-foreground mb-2">Snacks and dessert are never assumed in your calorie budget — only add them if you want them planned.</p>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_SLOTS.filter(({ key }) => OPTIONAL_SLOTS.includes(key)).map(({ key, label }) => {
                    const active = selectedSlots.has(key);
                    const count  = recipeCountPerSlot[key] ?? 0;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleSlot(key)}
                        className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                          active
                            ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                            : "bg-white border-border hover:border-primary/20"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center">
                            <Check size={9} />
                          </span>
                        )}
                        <span className={`text-sm font-bold ${active ? "text-primary" : ""}`}>{label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{count} recipe{count !== 1 ? "s" : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Nutrition context */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info size={15} className="text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {CORE_SLOTS.every(s => selectedSlots.has(s))
                    ? "All core meals selected — the plan will target your full daily goal of "
                    : "For any core meal (breakfast/lunch/dinner) not in the plan, a typical intake is assumed. Your selected slots will target "}
                  <span className="font-bold text-foreground">
                    ~{remainingBudget.toLocaleString()} kcal.
                  </span>
                  {" "}Snacks and dessert are never assumed.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-muted-foreground block">Daily goal</span>
                  <span className="font-bold text-foreground">{goals.calories.toLocaleString()} kcal</span>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-muted-foreground block">Slots selected</span>
                  <span className="font-bold text-foreground">
                    {selectedSlots.size} / {MEAL_SLOTS.length}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleGenerate}
              disabled={selectedSlots.size === 0}
            >
              <Sparkles size={16} className="mr-2" />
              Fill {selectedSlots.size > 0 ? `${selectedSlots.size * 7} slots` : "Plan"}
            </Button>
          </div>

        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Preview</h2>
              <Badge variant="success">{results.length} meals</Badge>
            </div>

            {/* Nutrition summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-border rounded-2xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Avg planned cal/day</span>
                <span className="font-bold text-foreground tabular-nums">
                  {previewTotals.avgCal.toLocaleString()} kcal
                </span>
              </div>
              <div className="bg-white border border-border rounded-2xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Avg planned protein/day</span>
                <span className="font-bold text-foreground tabular-nums">
                  {previewTotals.avgProt}g
                </span>
              </div>
            </div>

            {/* Results grouped by day */}
            {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map(day => {
              const dayResults = results.filter(r => r.day === day);
              if (dayResults.length === 0) return null;
              return (
                <div key={day}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    {DAY_SHORT[day]}
                  </h3>
                  <div className="space-y-2">
                    {dayResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-border flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                          {item.recipe.emoji ?? "🍽️"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                              {MEAL_SLOTS.find(s => s.key === item.slot)?.label}
                            </span>
                          </div>
                          <p className="font-semibold text-sm truncate">{item.recipe.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.recipe.calories ?? "—"} kcal · {item.recipe.protein ?? "—"}g protein
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Sticky footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border flex gap-3 max-w-md mx-auto">
              <Button variant="outline" className="flex-1" onClick={handleGenerate}>
                <RefreshCw size={15} className="mr-2" /> Redo
              </Button>
              <Button className="flex-1" onClick={handleApply}>
                <Check size={15} className="mr-2" /> Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
