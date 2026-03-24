import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Plus, Sparkles, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays } from "date-fns";
import { Card } from "@/components/ui";
import { useFamilyStore, useMealPlanStore, useRecipeStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { DAYS, DAY_LABELS, MEAL_SLOTS, Day, MealSlotKey, MealSlotData } from "@/lib/types";
import { recipesForSlot } from "@/lib/generate-plan";
import SlotActionSheet from "@/components/SlotActionSheet";

// Find a recipe that's nutritionally similar but different from the current one
function findSwap(
  currentData: MealSlotData | null,
  slot: MealSlotKey,
  recipes: ReturnType<typeof recipesForSlot>,
): MealSlotData | null {
  const pool = recipes.filter(r => r.id !== currentData?.recipe_id);
  if (pool.length === 0) return null;

  const targetCal  = currentData?.calories  ?? 600;
  const targetProt = currentData?.protein   ?? 30;

  const scored = pool.map(r => ({
    recipe: r,
    score:  Math.abs((r.calories ?? targetCal)  - targetCal)
          + Math.abs((r.protein  ?? targetProt) - targetProt) * 4,
  }));
  scored.sort((a, b) => a.score - b.score);

  // Pick randomly from top-5 so Redo feels different
  const topN   = Math.min(5, scored.length);
  const picked = scored[Math.floor(Math.random() * topN)].recipe;

  return {
    recipe_id:   picked.id,
    recipe_name: picked.name,
    emoji:       picked.emoji,
    calories:    picked.calories,
    protein:     picked.protein,
    carbs:       picked.carbs,
    fat:         picked.fat,
    cook_time:   picked.cook_time,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Plan() {
  const [, setLocation]        = useLocation();
  const { profile, familyGroup } = useFamilyStore();
  const { getPlan, setSlot }   = useMealPlanStore();
  const { recipes }            = useRecipeStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = getWeekStart(currentDate);
  const plan      = getPlan(weekStart, familyGroup?.code || "");

  const [expandedDay, setExpandedDay] = useState<Day | null>(null);

  // Slot action sheet state
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [sheetDay,  setSheetDay]    = useState<Day>("monday");
  const [sheetSlot, setSheetSlot]   = useState<MealSlotKey>("dinner");

  useEffect(() => {
    if (!profile?.family_code) {
      setLocation("/setup");
    } else {
      const today    = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1;
      setExpandedDay(DAYS[dayIndex]);
    }
  }, [profile, setLocation]);

  if (!profile?.family_code) return null;

  const navigateWeek = (dir: "prev" | "next") => {
    setCurrentDate(prev => dir === "prev" ? subDays(prev, 7) : addDays(prev, 7));
  };

  const getDayDates = () => {
    const start = new Date(weekStart);
    return DAYS.map((_, i) => addDays(start, i));
  };
  const dates = getDayDates();

  // Open the action sheet for a slot
  function openSheet(day: Day, slot: MealSlotKey) {
    setSheetDay(day);
    setSheetSlot(slot);
    setSheetOpen(true);
  }

  // Actions wired to the store
  function handleSave(day: Day, slot: MealSlotKey, data: MealSlotData) {
    setSlot(weekStart, familyGroup!.code, day, slot, data);
  }

  function handleRemove(day: Day, slot: MealSlotKey) {
    setSlot(weekStart, familyGroup!.code, day, slot, null);
  }

  function handleSwap(day: Day, slot: MealSlotKey) {
    const currentData = plan.slots[`${day}_${slot}`] ?? null;
    const pool        = recipesForSlot(recipes, slot);
    const swapped     = findSwap(currentData, slot, pool);
    if (swapped) setSlot(weekStart, familyGroup!.code, day, slot, swapped);
  }

  const sheetExisting = plan.slots[`${sheetDay}_${sheetSlot}`] ?? null;
  const sheetRecipes  = recipesForSlot(recipes, sheetSlot);

  return (
    <div className="flex flex-col min-h-full pb-20">
      <header className="px-6 pt-12 pb-6 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {familyGroup?.name}
            </p>
            <h1 className="text-3xl font-display font-bold text-foreground">Weekly Plan</h1>
          </div>
          <Link href="/family">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors">
              <Settings size={20} />
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between bg-background rounded-xl p-1 border border-border">
          <button onClick={() => navigateWeek("prev")} className="p-2 hover:bg-white rounded-lg transition">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-sm">
            {format(dates[0], "MMM d")} – {format(dates[6], "MMM d, yyyy")}
          </span>
          <button onClick={() => navigateWeek("next")} className="p-2 hover:bg-white rounded-lg transition">
            <ChevronRight size={20} />
          </button>
        </div>

        <Link href="/generate">
          <button className="mt-3 w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm rounded-full py-2.5 shadow-sm hover:bg-primary/90 transition-colors">
            <Sparkles size={16} />
            Generate Plan
          </button>
        </Link>
      </header>

      <div className="p-6 space-y-4">
        {DAYS.map((day, idx) => {
          const isExpanded = expandedDay === day;
          const date       = dates[idx];
          const isToday    = format(new Date(), "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
          const filledCount = plan.active_slots.filter(s => plan.slots[`${day}_${s}`]).length;

          return (
            <Card
              key={day}
              className={`p-0 overflow-hidden ${isExpanded ? "border-primary/30 shadow-md ring-1 ring-primary/10" : ""}`}
            >
              {/* Day header */}
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer bg-white"
                onClick={() => setExpandedDay(isExpanded ? null : day)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                    isToday ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-secondary text-secondary-foreground"
                  }`}>
                    <span className="text-[10px] uppercase font-bold opacity-80">{DAY_LABELS[day].slice(0, 3)}</span>
                    <span className="text-lg font-bold leading-none">{format(date, "d")}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{format(date, "EEEE")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {filledCount} / {plan.active_slots.length} meals planned
                    </p>
                  </div>
                </div>

                {/* Mini nutrition summary for day */}
                {filledCount > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {plan.active_slots
                        .reduce((sum, s) => sum + (plan.slots[`${day}_${s}`]?.calories ?? 0), 0)
                        .toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">kcal planned</p>
                  </div>
                )}
              </div>

              {/* Expanded slots */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border/50 bg-background/50"
                  >
                    <div className="p-4 space-y-3">
                      {plan.active_slots.map(slotKey => {
                        const slotDef  = MEAL_SLOTS.find(s => s.key === slotKey)!;
                        const slotData = plan.slots[`${day}_${slotKey}`];

                        return (
                          <div key={slotKey}>
                            <span className="text-[10px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider block mb-1.5">
                              {slotDef.label}
                            </span>

                            {slotData ? (
                              // ── Filled slot ──────────────────────────────────────
                              // Body → view recipe detail (if from library) or open sheet (manual entry)
                              // Pencil button → opens action sheet
                              <div className="bg-white border border-border rounded-xl shadow-sm flex items-center overflow-hidden hover:border-primary/20 transition-colors">
                                {/* Main tappable area */}
                                <button
                                  className="flex-1 flex items-center gap-3 p-3 text-left min-w-0"
                                  onClick={() => {
                                    if (slotData.recipe_id) {
                                      setLocation(`/recipe/${slotData.recipe_id}`);
                                    } else {
                                      openSheet(day, slotKey);
                                    }
                                  }}
                                >
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                                    {slotData.emoji ?? "🍽️"}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-foreground truncate">{slotData.recipe_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {slotData.calories && (
                                        <span className="text-[10px] text-muted-foreground">{slotData.calories} kcal</span>
                                      )}
                                      {slotData.protein && (
                                        <span className="text-[10px] text-muted-foreground">· {slotData.protein}g protein</span>
                                      )}
                                      {slotData.cook_time && (
                                        <span className="text-[10px] text-muted-foreground">· {slotData.cook_time}m</span>
                                      )}
                                    </div>
                                  </div>
                                </button>

                                {/* Edit button */}
                                <button
                                  className="shrink-0 self-stretch px-3 flex items-center justify-center border-l border-border bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openSheet(day, slotKey); }}
                                >
                                  <Pencil size={15} className="text-muted-foreground hover:text-primary" />
                                </button>
                              </div>
                            ) : (
                              // ── Empty slot ──
                              <button
                                className="w-full border-2 border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:bg-white hover:border-primary/30 hover:text-primary transition-all cursor-pointer"
                                onClick={() => openSheet(day, slotKey)}
                              >
                                <Plus size={18} />
                                <span className="text-sm font-medium">Add to {slotDef.label}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Slot action sheet */}
      <SlotActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        slot={sheetSlot}
        day={format(dates[DAYS.indexOf(sheetDay)], "EEEE")}
        existing={sheetExisting}
        recipes={recipes}
        onSave={(data) => {
          handleSave(sheetDay, sheetSlot, data);
        }}
        onRemove={() => {
          handleRemove(sheetDay, sheetSlot);
          setSheetOpen(false);
        }}
        onSwap={() => {
          handleSwap(sheetDay, sheetSlot);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
