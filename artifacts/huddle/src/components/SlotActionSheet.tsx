import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X, Sparkles, RefreshCw, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useAiMutation } from "@/hooks/use-ai";
import { MealSlotKey, MEAL_SLOTS, Recipe, MealSlotData } from "@/lib/types";
import { recipesForSlot } from "@/lib/generate-plan";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  slot: MealSlotKey;
  day: string;
  /** If a recipe is already in this slot we start in "actions" mode */
  existing: MealSlotData | null;
  recipes: Recipe[];
  onSave:   (data: MealSlotData) => void;
  onRemove: () => void;
  onSwap:   () => void;
}

type Mode = "actions" | "library" | "manual";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

function macroChip(label: string, value: number | undefined, unit: string, color: string) {
  if (value == null) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${color}`}>
      {Math.round(value)}{unit} {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SlotActionSheet({
  open, onClose, slot, day, existing, recipes, onSave, onRemove, onSwap,
}: Props) {

  const slotLabel = MEAL_SLOTS.find(s => s.key === slot)?.label ?? slot;
  const aiMutation = useAiMutation();

  // Which screen to show
  const [mode, setMode] = useState<Mode>(() => existing ? "actions" : "library");

  // Library search
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Manual entry
  const [manualText, setManualText]         = useState("");
  const [estimatedNutrition, setEstimated]  = useState<Partial<MealSlotData> | null>(null);
  const [estimateError, setEstimateError]   = useState("");

  // Track whether the sheet was already open so we only reset state on the
  // closed→open transition, NOT every time `existing` gets a new reference
  // from a Zustand/Firestore re-render (which was causing the library view
  // to flash then snap back to "actions").
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }

    // Lock body scroll while sheet is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Only reset internal state on the closed→open transition
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setMode(existing ? "actions" : "library");
      setQuery("");
      setManualText("");
      setEstimated(null);
      setEstimateError("");
    }

    return () => { document.body.style.overflow = prev; };
  }, [open, existing]);

  // Focus search input when switching to library
  useEffect(() => {
    if (mode === "library") {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [mode]);

  // ── Recipe candidates for this slot ────────────────────────────────────────
  const candidates = useMemo(
    () => recipesForSlot(recipes, slot),
    [recipes, slot],
  );

  const filteredRecipes = useMemo(() => {
    if (!query.trim()) return candidates.slice(0, 40);
    const q = normalise(query);
    return candidates.filter(r =>
      normalise(r.name).includes(q) ||
      normalise(r.cuisine ?? "").includes(q)
    ).slice(0, 40);
  }, [candidates, query]);

  // ── AI nutrition estimate ───────────────────────────────────────────────────
  async function handleEstimate() {
    if (!manualText.trim()) return;
    setEstimated(null);
    setEstimateError("");

    try {
      const res = await aiMutation.mutateAsync({
        prompt: `Estimate the nutritional details for this meal: "${manualText}".
Return ONLY a valid JSON object with these fields (all numbers, integers):
{"calories":number,"protein":number,"carbs":number,"fat":number,"emoji":"single food emoji"}
No markdown, no explanation — raw JSON only.`,
        responseFormat: "json",
      });

      const raw = res.result.trim();
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : raw);
      setEstimated({
        calories: Math.round(parsed.calories ?? 0),
        protein:  Math.round(parsed.protein  ?? 0),
        carbs:    Math.round(parsed.carbs    ?? 0),
        fat:      Math.round(parsed.fat      ?? 0),
        emoji:    parsed.emoji ?? "🍽️",
      });
    } catch {
      setEstimateError("Could not estimate — please try again.");
    }
  }

  function handleSaveManual() {
    const data: MealSlotData = {
      recipe_name: manualText.trim(),
      emoji:       estimatedNutrition?.emoji   ?? "🍽️",
      calories:    estimatedNutrition?.calories,
      protein:     estimatedNutrition?.protein,
      carbs:       estimatedNutrition?.carbs,
      fat:         estimatedNutrition?.fat,
    };
    onSave(data);
    onClose();
  }

  function handlePickRecipe(recipe: Recipe) {
    onSave({
      recipe_id:   recipe.id,
      recipe_name: recipe.name,
      emoji:       recipe.emoji,
      calories:    recipe.calories,
      protein:     recipe.protein,
      carbs:       recipe.carbs,
      fat:         recipe.fat,
      cook_time:   recipe.cook_time,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop — sits above the bottom nav (z-60) so it covers everything */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex: 60 }}
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Sheet — anchored above the bottom nav bar (4rem = 64px = h-16) */}
      <div
        className="fixed left-0 right-0 mx-auto max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ bottom: "4rem", height: "calc(88dvh - 4rem)", zIndex: 70 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border/50">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{day} · {slotLabel}</p>
            <h2 className="font-bold text-lg leading-tight">
              {mode === "actions" ? "Meal options"   :
               mode === "library" ? "Search recipes" :
                                    "Manual entry"   }
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        {/* ── ACTIONS mode (filled slot) ──────────────────────────────────── */}
        {mode === "actions" && existing && (
          <div className="p-5 space-y-3 overflow-y-auto flex-1" style={{ overscrollBehavior: "contain" }}>
            {/* Current meal summary */}
            <div className="flex items-center gap-3 bg-secondary/50 rounded-2xl p-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shadow-sm shrink-0">
                {existing.emoji ?? "🍽️"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{existing.recipe_name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {macroChip("kcal", existing.calories, "", "bg-amber-100 text-amber-700")}
                  {macroChip("g protein", existing.protein,  "", "bg-green-100 text-green-700")}
                  {macroChip("g carbs",   existing.carbs,    "", "bg-blue-100  text-blue-700" )}
                  {macroChip("g fat",     existing.fat,      "", "bg-rose-100  text-rose-700" )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <ActionRow
              icon={<RefreshCw size={20} className="text-primary" />}
              label="Swap for something similar"
              sublabel="Picks a recipe with similar calories & protein"
              onClick={() => { onSwap(); onClose(); }}
            />
            <ActionRow
              icon={<Search size={20} className="text-primary" />}
              label="Search recipe library"
              sublabel={`${candidates.length} recipes available`}
              onClick={() => setMode("library")}
            />
            <ActionRow
              icon={<Sparkles size={20} className="text-primary" />}
              label="Enter manually"
              sublabel="Type what you had, optionally analyse nutrition"
              onClick={() => setMode("manual")}
            />
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <span className="font-semibold text-sm">Remove meal</span>
            </button>
          </div>
        )}

        {/* ── LIBRARY mode ────────────────────────────────────────────────── */}
        {mode === "library" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search bar */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5">
                <Search size={16} className="text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={`Search ${candidates.length} recipes…`}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery("")} className="text-muted-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Also offer manual entry */}
            <button
              onClick={() => setMode("manual")}
              className="mx-4 mb-2 flex items-center gap-2 text-xs text-primary font-semibold hover:underline shrink-0"
            >
              <Sparkles size={12} /> Not in library? Enter manually
            </button>

            {/* Recipe list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2" style={{ overscrollBehavior: "contain" }}>
              {filteredRecipes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No recipes match "{query}"
                </p>
              ) : (
                filteredRecipes.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => handlePickRecipe(recipe)}
                    className="w-full flex items-center gap-3 bg-white border border-border rounded-xl p-3 hover:border-primary/40 hover:shadow-sm transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl shrink-0">
                      {recipe.emoji ?? "🍽️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{recipe.name}</p>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap">
                        {recipe.calories && (
                          <span className="text-[10px] text-muted-foreground">{recipe.calories} kcal</span>
                        )}
                        {recipe.protein && (
                          <span className="text-[10px] text-muted-foreground">· {recipe.protein}g protein</span>
                        )}
                        {recipe.cook_time && (
                          <span className="text-[10px] text-muted-foreground">· {recipe.cook_time}m</span>
                        )}
                        {recipe.cuisine && (
                          <span className="text-[10px] text-muted-foreground">· {recipe.cuisine}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── MANUAL mode ─────────────────────────────────────────────────── */}
        {mode === "manual" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4" style={{ overscrollBehavior: "contain" }}>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                What did you have?
              </label>
              <textarea
                autoFocus
                rows={3}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none"
                placeholder={`e.g. "Chicken salad with avocado and olive oil dressing"`}
                value={manualText}
                onChange={e => setManualText(e.target.value)}
              />
            </div>

            {/* Estimate nutrition */}
            {!estimatedNutrition ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleEstimate}
                disabled={!manualText.trim() || aiMutation.isPending}
              >
                {aiMutation.isPending
                  ? <><Loader2 size={15} className="mr-2 animate-spin" /> Analysing…</>
                  : <><Sparkles size={15} className="mr-2 text-primary" /> Estimate Nutrition with AI</>
                }
              </Button>
            ) : (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{estimatedNutrition.emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">AI Estimate</p>
                    <p className="text-[11px] text-muted-foreground">Tap below to re-analyse</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Calories", val: estimatedNutrition.calories, unit: "kcal", bg: "bg-amber-50", text: "text-amber-700" },
                    { label: "Protein",  val: estimatedNutrition.protein,  unit: "g",    bg: "bg-green-50", text: "text-green-700" },
                    { label: "Carbs",    val: estimatedNutrition.carbs,    unit: "g",    bg: "bg-blue-50",  text: "text-blue-700"  },
                    { label: "Fat",      val: estimatedNutrition.fat,      unit: "g",    bg: "bg-rose-50",  text: "text-rose-700"  },
                  ].map(m => (
                    <div key={m.label} className={`${m.bg} rounded-xl p-2 text-center`}>
                      <p className={`text-sm font-bold ${m.text}`}>{m.val}{m.unit}</p>
                      <p className="text-[9px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleEstimate}
                  disabled={aiMutation.isPending}
                  className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw size={11} className={aiMutation.isPending ? "animate-spin" : ""} />
                  Re-analyse
                </button>
              </div>
            )}

            {estimateError && (
              <p className="text-xs text-destructive">{estimateError}</p>
            )}

            {/* Save + skip nutrition */}
            <div className="flex gap-3 pb-6">
              <Button
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => {
                  if (!manualText.trim()) return;
                  onSave({ recipe_name: manualText.trim(), emoji: "🍽️" });
                  onClose();
                }}
                disabled={!manualText.trim()}
              >
                Save without nutrition
              </Button>
              <Button
                className="flex-1 text-sm"
                onClick={handleSaveManual}
                disabled={!manualText.trim()}
              >
                Save{estimatedNutrition ? " with nutrition" : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Action row ──────────────────────────────────────────────────────────────

function ActionRow({ icon, label, sublabel, onClick }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white border border-border rounded-2xl hover:border-primary/30 hover:shadow-sm transition-all text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </button>
  );
}
