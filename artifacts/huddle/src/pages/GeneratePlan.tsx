import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Check, RefreshCw, Sparkles, Info, ShieldAlert,
  DollarSign, TrendingUp, TrendingDown, Target, RotateCcw,
  Eye, Replace, ExternalLink, Clock,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFamilyStore, useMealPlanStore, useNutritionStore, useRecipeStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { DAYS, MEAL_SLOTS, MealSlotKey, NutritionGoals, Day, Recipe } from "@/lib/types";
import {
  generateMealPlan,
  recipesForSlot,
  SLOT_ASSUMED,
  CORE_SLOTS,
  OPTIONAL_SLOTS,
  GeneratedSlot,
  slotTarget,
  nutritionFitScore,
} from "@/lib/generate-plan";
import { filterRecipesForFamily, familyRestrictions } from "@/lib/dietary";
import { estimateRecipeCost, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

const DAY_SHORT: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

function GoalSliderRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold text-primary tabular-nums">
          {value.toLocaleString()}{unit}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-2 bg-secondary rounded-full" />
        <div
          className="absolute left-0 h-2 bg-primary rounded-full pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-6"
        />
        <div
          className="absolute w-5 h-5 bg-white border-2 border-primary rounded-full shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const GOAL_PRESETS: { name: string; goals: NutritionGoals }[] = [
  { name: "Maintenance", goals: { calories: 2000, protein: 120, carbs: 250, fat: 65 } },
  { name: "Weight Loss", goals: { calories: 1600, protein: 140, carbs: 140, fat: 50 } },
  { name: "Muscle Gain", goals: { calories: 2800, protein: 200, carbs: 320, fat: 80 } },
  { name: "Keto", goals: { calories: 1800, protein: 130, carbs: 25, fat: 145 } },
];

export default function GeneratePlan() {
  const [, setLocation] = useLocation();
  const { familyGroup }       = useFamilyStore();
  const { getPlan, setSlot, setActiveSlots } = useMealPlanStore();
  const { goals, setGoals }   = useNutritionStore();
  const { recipes }           = useRecipeStore();

  const [planGoals, setPlanGoals] = useState<NutritionGoals>(() => ({
    ...useNutritionStore.getState().goals,
  }));
  const goalsTouchedRef = useRef(false);

  useEffect(() => {
    if (goalsTouchedRef.current) return;
    setPlanGoals({ ...goals });
  }, [goals]);

  function markGoalsTouched() {
    goalsTouchedRef.current = true;
  }

  function resetPlanGoalsFromProfile() {
    setPlanGoals({ ...goals });
    goalsTouchedRef.current = false;
  }

  function applyPresetToPlan(p: NutritionGoals) {
    setPlanGoals({ ...p });
    markGoalsTouched();
  }

  function savePlanGoalsToStore() {
    setGoals(planGoals);
  }

  const currency = getCurrencyConfig(familyGroup?.country);

  // Read the target week from the URL query param (?week=YYYY-MM-DD).
  // Falls back to the current week so the page still works when accessed directly.
  const weekStart = (() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const param  = new URLSearchParams(search).get("week");
    return param ?? getWeekStart();
  })();

  const plan = getPlan(weekStart, familyGroup?.code || "");

  // ── Slot selection ───────────────────────────────────────────────────────
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

  // ── Weekly budget ────────────────────────────────────────────────────────
  const [weeklyBudget, setWeeklyBudget] = useState<number | "">("");

  // Convert local-currency budget to USD for comparison
  const budgetUSD = typeof weeklyBudget === "number" && weeklyBudget > 0
    ? weeklyBudget / currency.multiplier
    : null;

  // ── Dietary filtering ────────────────────────────────────────────────────
  const members      = familyGroup?.family_members ?? [];
  const restrictions = familyRestrictions(members);

  const filteredRecipes = useMemo(() => {
    const safe = filterRecipesForFamily(recipes, members);
    return safe.filter(r => !r.excluded_from_auto);
  }, [recipes, members]);

  const filteredOut = recipes.length - filteredRecipes.length;

  const recipeCountPerSlot = useMemo(() =>
    Object.fromEntries(
      MEAL_SLOTS.map(({ key }) => [key, recipesForSlot(filteredRecipes, key).length]),
    ), [filteredRecipes]);

  // ── Generation state ─────────────────────────────────────────────────────
  const [results, setResults]     = useState<GeneratedSlot[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [recipeToView, setRecipeToView] = useState<Recipe | null>(null);
  const [swapFor, setSwapFor] = useState<{ day: Day; slot: MealSlotKey } | null>(null);
  const [swapQuery, setSwapQuery] = useState("");

  const selectedSlotsArray = useMemo(
    () => Array.from(selectedSlots) as MealSlotKey[],
    [selectedSlots],
  );

  const swapAlternatives = useMemo(() => {
    if (!swapFor) return [];
    const { slot } = swapFor;
    const pool = recipesForSlot(filteredRecipes, slot);
    const target = slotTarget(slot, selectedSlotsArray, planGoals);
    const q = swapQuery.trim().toLowerCase();
    const list = q ? pool.filter((r) => r.name.toLowerCase().includes(q)) : pool;
    return [...list].sort((a, b) => nutritionFitScore(a, target) - nutritionFitScore(b, target));
  }, [swapFor, filteredRecipes, selectedSlotsArray, planGoals, swapQuery]);

  // Only skip slots that already have a meal AND are NOT selected for regeneration.
  // If the user has selected a slot to fill, always generate a fresh meal for it.
  const existingKeys = useMemo(() => {
    const all = new Set(Object.keys(plan.slots));
    // Remove every "day_slot" key that belongs to a selected slot
    for (const key of [...all]) {
      const slotPart = key.split("_").slice(1).join("_") as MealSlotKey;
      if (selectedSlots.has(slotPart)) all.delete(key);
    }
    return all;
  }, [plan.slots, selectedSlots]);

  function handleGenerate() {
    const slots = [...selectedSlots];
    setResults(generateMealPlan(slots, existingKeys, filteredRecipes, planGoals));
    setIsPreview(true);
  }

  function handleApply() {
    // Regeneration should replace this week's plan, not merge into previous results.
    // Clear all existing slots first, then apply the newly generated set.
    Object.keys(plan.slots).forEach((key) => {
      const [dayRaw, ...slotParts] = key.split("_");
      const day = dayRaw as typeof DAYS[number];
      const slot = slotParts.join("_") as MealSlotKey;
      if (!DAYS.includes(day) || !MEAL_SLOTS.some((s) => s.key === slot)) return;
      setSlot(weekStart, familyGroup!.code, day, slot, null);
    });

    setActiveSlots(weekStart, familyGroup!.code, [...selectedSlots]);
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

  function applyRecipeSwap(day: Day, slot: MealSlotKey, recipe: Recipe) {
    const target = slotTarget(slot, selectedSlotsArray, planGoals);
    setResults((prev) =>
      prev.map((row) =>
        row.day === day && row.slot === slot
          ? {
              ...row,
              recipe,
              targetCalories: target.calories,
              targetProtein: target.protein,
            }
          : row,
      ),
    );
    setSwapFor(null);
    setSwapQuery("");
  }

  function openSwapDialog(day: Day, slot: MealSlotKey) {
    setSwapQuery("");
    setSwapFor({ day, slot });
  }

  // ── Preview summaries ─────────────────────────────────────────────────────
  const previewTotals = useMemo(() => {
    const DAYS = 7;
    const totalCal  = results.reduce((s, r) => s + (r.recipe.calories ?? 0), 0);
    const totalProt = results.reduce((s, r) => s + (r.recipe.protein ?? 0), 0);

    // Cost estimate: sum every slot's recipe cost (same approach as the shopping
    // list, which accumulates ingredient amounts across all slot uses).
    // We intentionally do NOT deduplicate by recipe ID — if Bolognese fills
    // Tuesday AND Thursday, we need twice the ingredients, hence twice the cost.
    let totalCostUSD = 0;
    let costCovered  = 0;
    for (const { recipe } of results) {
      const cost = estimateRecipeCost(recipe, recipe.servings ?? 4);
      if (cost) {
        totalCostUSD += cost.totalUSD;
        costCovered++;
      }
    }

    return {
      avgCal:       Math.round(totalCal  / DAYS),
      avgProt:      Math.round(totalProt / DAYS),
      weeklyCostUSD: costCovered > 0 ? totalCostUSD : null,
      costCoverage:  costCovered / Math.max(1, results.length),
    };
  }, [results]);

  // Budget comparison
  const budgetStatus = useMemo(() => {
    if (!budgetUSD || !previewTotals.weeklyCostUSD) return null;
    const diff = previewTotals.weeklyCostUSD - budgetUSD;
    const pct  = Math.abs(diff) / budgetUSD;
    return { overBudget: diff > 0, pct, diffUSD: Math.abs(diff) };
  }, [budgetUSD, previewTotals.weeklyCostUSD]);

  // ── Nutrition context ─────────────────────────────────────────────────────
  const unselectedAssumedCal = CORE_SLOTS
    .filter(key => !selectedSlots.has(key))
    .reduce((sum, key) => sum + SLOT_ASSUMED[key].calories, 0);

  const remainingBudget = Math.max(planGoals.calories - unselectedAssumedCal, 0);

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
                Pick which meals to fill and set a budget. The planner will match your nutrition goals as closely as possible.
              </p>
            </Card>

            {/* ── Daily targets (this generation) ───────────────────────── */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold">Daily targets for this plan</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adjust before you generate. Recipe picks prioritize calories and protein; carbs and fat stay on your radar for consistency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {GOAL_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPresetToPlan(p.goals)}
                    className="flex flex-col items-start p-2.5 rounded-xl border border-border bg-secondary/20 hover:bg-primary/5 hover:border-primary/30 text-left transition-colors"
                  >
                    <span className="text-xs font-bold">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.goals.calories.toLocaleString()} kcal · {p.goals.protein}g P
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-5 pt-1">
                <GoalSliderRow
                  label="Calories"
                  unit=" kcal"
                  value={planGoals.calories}
                  min={800}
                  max={5000}
                  step={50}
                  onChange={(v) => {
                    markGoalsTouched();
                    setPlanGoals((d) => ({ ...d, calories: v }));
                  }}
                />
                <GoalSliderRow
                  label="Protein"
                  unit="g"
                  value={planGoals.protein}
                  min={20}
                  max={350}
                  step={5}
                  onChange={(v) => {
                    markGoalsTouched();
                    setPlanGoals((d) => ({ ...d, protein: v }));
                  }}
                />
                <GoalSliderRow
                  label="Carbohydrates"
                  unit="g"
                  value={planGoals.carbs}
                  min={20}
                  max={700}
                  step={5}
                  onChange={(v) => {
                    markGoalsTouched();
                    setPlanGoals((d) => ({ ...d, carbs: v }));
                  }}
                />
                <GoalSliderRow
                  label="Fat"
                  unit="g"
                  value={planGoals.fat}
                  min={10}
                  max={300}
                  step={5}
                  onChange={(v) => {
                    markGoalsTouched();
                    setPlanGoals((d) => ({ ...d, fat: v }));
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={resetPlanGoalsFromProfile}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <RotateCcw size={12} />
                  Reset to saved profile
                </button>
                <button
                  type="button"
                  onClick={savePlanGoalsToStore}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Use these as my app-wide goals
                </button>
              </div>
            </div>

            {/* ── Weekly grocery budget ──────────────────────────────────── */}
            <div className="bg-white border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={15} className="text-primary" />
                <h3 className="text-sm font-bold">Weekly Grocery Budget <span className="text-muted-foreground font-normal">(optional)</span></h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter an estimated weekly budget for groceries. We'll show how this plan compares after generation.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  {currency.symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={`e.g. ${Math.round(150 * currency.multiplier)}`}
                  value={weeklyBudget}
                  onChange={e => setWeeklyBudget(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full pl-8 pr-16 py-2.5 border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-secondary/30"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                  {currency.code}
                </span>
              </div>
              {typeof weeklyBudget === "number" && weeklyBudget > 0 && (
                <p className="text-xs text-primary font-medium">
                  Budget set: {currency.symbol}{weeklyBudget.toLocaleString()} {currency.code}/week
                </p>
              )}
            </div>

            {/* Dietary filter banner */}
            {(restrictions.length > 0 || filteredOut > 0) && (
              <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <ShieldAlert size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary mb-0.5">Dietary filters active</p>
                  <p className="text-xs text-muted-foreground">
                    {filteredOut > 0
                      ? `${filteredOut} recipe${filteredOut !== 1 ? "s" : ""} excluded based on your family's dietary needs.`
                      : "Family dietary needs will be respected when selecting recipes."}
                    {" "}
                    {restrictions.length > 0 && <span className="font-medium">{restrictions.join(", ")}</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Slot selector */}
            <div className="space-y-4">
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
                  <span className="font-bold text-foreground">~{remainingBudget.toLocaleString()} kcal.</span>
                  {" "}Snacks and dessert are never assumed.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-muted-foreground block">Daily goal</span>
                  <span className="font-bold text-foreground">{planGoals.calories.toLocaleString()} kcal</span>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <span className="text-xs text-muted-foreground block">Slots selected</span>
                  <span className="font-bold text-foreground">{selectedSlots.size} / {MEAL_SLOTS.length}</span>
                </div>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleGenerate} disabled={selectedSlots.size === 0}>
              <Sparkles size={16} className="mr-2" />
              Fill {selectedSlots.size > 0 ? `${selectedSlots.size * 7} slots` : "Plan"}
            </Button>
          </div>

        ) : (
          <>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Preview</h2>
              <Badge variant="success">{results.length} meals</Badge>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Tap a meal to read the full recipe, or swap it for another option from your library. Your preview stays until you apply or redo.
            </p>

            {/* Nutrition summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-border rounded-2xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Avg planned cal/day</span>
                <span className="font-bold text-foreground tabular-nums">{previewTotals.avgCal.toLocaleString()} kcal</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Goal {planGoals.calories.toLocaleString()} kcal</span>
              </div>
              <div className="bg-white border border-border rounded-2xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Avg planned protein/day</span>
                <span className="font-bold text-foreground tabular-nums">{previewTotals.avgProt}g</span>
                <span className="text-[10px] text-muted-foreground block mt-1">Goal {planGoals.protein}g</span>
              </div>
            </div>

            {/* ── Cost estimate ──────────────────────────────────────────── */}
            {previewTotals.weeklyCostUSD !== null && (
              <div className={`rounded-2xl border p-4 space-y-3 ${
                budgetStatus
                  ? budgetStatus.overBudget
                    ? "bg-red-50 border-red-200"
                    : "bg-green-50 border-green-200"
                  : "bg-white border-border"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className={budgetStatus ? (budgetStatus.overBudget ? "text-red-600" : "text-green-600") : "text-primary"} />
                    <span className="text-sm font-bold">Estimated weekly groceries</span>
                  </div>
                  {budgetStatus && (
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      budgetStatus.overBudget
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {budgetStatus.overBudget
                        ? <><TrendingUp size={11} /> Over budget</>
                        : <><TrendingDown size={11} /> Under budget</>}
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatCost(previewTotals.weeklyCostUSD, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      estimated · {Math.round(previewTotals.costCoverage * 100)}% ingredients priced
                    </p>
                  </div>
                  {budgetUSD && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Your budget</p>
                      <p className="font-bold text-sm">{currency.symbol}{(typeof weeklyBudget === "number" ? weeklyBudget : 0).toLocaleString()}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${budgetStatus?.overBudget ? "text-red-600" : "text-green-600"}`}>
                        {budgetStatus?.overBudget ? "+" : "-"}{formatCost(budgetStatus?.diffUSD ?? 0, currency)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Budget bar */}
                {budgetUSD && previewTotals.weeklyCostUSD && (
                  <div className="space-y-1">
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${budgetStatus?.overBudget ? "bg-red-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(100, (previewTotals.weeklyCostUSD / budgetUSD) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {Math.round((previewTotals.weeklyCostUSD / budgetUSD) * 100)}% of budget
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-black/5 pt-2">
                  Estimates are based on typical supermarket prices and may vary significantly by store, region, and seasonal availability. Actual cost depends on what you already have at home. This is a guide only.
                </p>
              </div>
            )}

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
                    {dayResults.map((item) => (
                      <div
                        key={`${item.day}_${item.slot}`}
                        className="bg-white p-3 rounded-xl border border-border flex items-start gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => setRecipeToView(item.recipe)}
                          className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0 hover:bg-primary/20 transition-colors"
                          title="View recipe"
                        >
                          {item.recipe.emoji ?? "🍽️"}
                        </button>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                              {MEAL_SLOTS.find(s => s.key === item.slot)?.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRecipeToView(item.recipe)}
                            className="font-semibold text-sm text-left truncate w-full hover:text-primary transition-colors"
                          >
                            {item.recipe.name}
                          </button>
                          <p className="text-[11px] text-muted-foreground">
                            {item.recipe.calories ?? "—"} kcal · {item.recipe.protein ?? "—"}g protein
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Slot target ~{item.targetCalories} kcal · {item.targetProtein}g protein
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setRecipeToView(item.recipe)}
                            title="View recipe"
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openSwapDialog(item.day, item.slot)}
                            title="Swap recipe"
                          >
                            <Replace size={15} />
                          </Button>
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

          <Dialog open={recipeToView !== null} onOpenChange={(open) => { if (!open) setRecipeToView(null); }}>
            <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
              {recipeToView && (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3 pr-6">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                        style={{ backgroundColor: recipeToView.photo_color || "#e5e7eb" }}
                      >
                        {recipeToView.emoji ?? "🍲"}
                      </div>
                      <div className="min-w-0 text-left">
                        <DialogTitle className="text-left leading-tight">{recipeToView.name}</DialogTitle>
                        <DialogDescription className="text-left mt-1 text-xs">
                          {recipeToView.cuisine && <span className="mr-2">{recipeToView.cuisine}</span>}
                          {recipeToView.cook_time != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {recipeToView.cook_time} min
                            </span>
                          )}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-secondary/40 rounded-xl px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground block">Calories</span>
                      <span className="font-bold tabular-nums">{recipeToView.calories ?? "—"}</span>
                    </div>
                    <div className="bg-secondary/40 rounded-xl px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground block">Protein</span>
                      <span className="font-bold tabular-nums">{recipeToView.protein ?? "—"}g</span>
                    </div>
                    <div className="bg-secondary/40 rounded-xl px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground block">Carbs</span>
                      <span className="font-bold tabular-nums">{recipeToView.carbs ?? "—"}g</span>
                    </div>
                    <div className="bg-secondary/40 rounded-xl px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground block">Fat</span>
                      <span className="font-bold tabular-nums">{recipeToView.fat ?? "—"}g</span>
                    </div>
                  </div>

                  {recipeToView.ingredients && recipeToView.ingredients.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold mb-2">Ingredients</h4>
                      <ul className="text-sm space-y-1.5 bg-white border border-border rounded-xl p-3">
                        {recipeToView.ingredients.map((ing, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="min-w-0">{ing.name}</span>
                            {ing.amount != null && ing.amount !== "" && (
                              <span className="text-muted-foreground shrink-0">{ing.amount}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recipeToView.method && recipeToView.method.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold mb-2">Method</h4>
                      <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                        {recipeToView.method.map((step, i) => (
                          <li key={i} className="leading-relaxed">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {recipeToView.chef_tip && (
                    <p className="text-sm bg-primary/5 border border-primary/15 rounded-xl p-3">
                      <span className="font-semibold text-primary">Tip: </span>
                      {recipeToView.chef_tip}
                    </p>
                  )}

                  <a
                    href={`${APP_BASE}/recipe/${recipeToView.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Open full recipe page
                  </a>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={swapFor !== null}
            onOpenChange={(open) => {
              if (!open) {
                setSwapFor(null);
                setSwapQuery("");
              }
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Swap recipe</DialogTitle>
                <DialogDescription className="text-left">
                  {swapFor && (
                    <>
                      {DAY_SHORT[swapFor.day]} · {MEAL_SLOTS.find((s) => s.key === swapFor.slot)?.label}
                      . Options are sorted by closest fit to your slot nutrition target (same logic as auto-fill).
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Search by name…"
                value={swapQuery}
                onChange={(e) => setSwapQuery(e.target.value)}
              />
              <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1 -mr-1">
                {swapFor && swapAlternatives.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recipes match.</p>
                )}
                {swapFor && swapAlternatives.map((r) => {
                  const currentId = results.find(
                    (row) => row.day === swapFor.day && row.slot === swapFor.slot,
                  )?.recipe.id;
                  const isCurrent = r.id === currentId;
                  const target = slotTarget(swapFor.slot, selectedSlotsArray, planGoals);
                  const fit = nutritionFitScore(r, target);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => applyRecipeSwap(swapFor.day, swapFor.slot, r)}
                      className={`w-full text-left p-3 rounded-xl border flex gap-3 transition-colors ${
                        isCurrent
                          ? "border-primary/50 bg-primary/5 opacity-80 cursor-default"
                          : "border-border bg-white hover:border-primary/30 hover:bg-primary/[0.03]"
                      }`}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: r.photo_color || "#f3f4f6" }}
                      >
                        {r.emoji ?? "🍲"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.calories ?? "—"} kcal · {r.protein ?? "—"}g protein · fit score {Math.round(fit)}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Current</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
