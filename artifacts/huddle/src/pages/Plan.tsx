import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Sparkles, ChevronLeft, ChevronRight, Pencil, ShoppingCart, X, Check, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays } from "date-fns";
import { Card } from "@/components/ui";
import { useFamilyStore, useMealPlanStore, useRecipeStore, useShoppingStore } from "@/stores/huddle-stores";
import { generateId, getWeekStart } from "@/lib/utils";
import { DAYS, DAY_LABELS, MEAL_SLOTS, Day, MealSlotKey, MealSlotData } from "@/lib/types";
import { recipesForSlot } from "@/lib/generate-plan";
import SlotActionSheet from "@/components/SlotActionSheet";
import { useAuth } from "@/context/auth-context";
import { addDailyNutritionEntry, loadNutritionProfile, removeDailyNutritionEntry } from "@/lib/firestore-sync";

// Persist scroll position and viewed week across route changes so returning to
// the Plan page lands you exactly where you left off.
let _planScrollY    = 0;
let _planCurrentDate: Date | null = null;

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
  const { getPlan, setSlot, setSlotHidden }   = useMealPlanStore();
  const { recipes }            = useRecipeStore();
  const { setSelectedWeek } = useShoppingStore();
  const { user } = useAuth();
  const [servingFactor, setServingFactor] = useState(1);

  const [currentDate, setCurrentDate] = useState(() => _planCurrentDate ?? new Date());
  const currentDateRef = useRef(currentDate);
  useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);
  const weekStart = getWeekStart(currentDate);
  const plan      = getPlan(weekStart, familyGroup?.code || "");

  const [expandedDay, setExpandedDay] = useState<Day | null>(null);
  const [slotPickerDay, setSlotPickerDay] = useState<Day | null>(null);

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

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const p = await loadNutritionProfile(user.uid);
      if (cancelled) return;
      const matchedById = p.linked_family_member_id
        ? familyGroup?.family_members?.find((m) => m.id === p.linked_family_member_id)
        : null;
      const matchedByName = familyGroup?.family_members?.find(
        (m) => m.name.trim().toLowerCase() === (profile?.name ?? "").trim().toLowerCase(),
      );
      const matchedMember = matchedById ?? matchedByName;
      const inferred = matchedMember ? memberFactorFromType(matchedMember.type) : 1;
      setServingFactor(p.serving_factor || inferred || 1);
    })();
    return () => { cancelled = true; };
  }, [familyGroup?.family_members, profile?.name, user?.uid]);

  // Restore scroll on mount; save scroll + viewed week on unmount.
  useEffect(() => {
    const saved = _planScrollY;
    const t = requestAnimationFrame(() => { window.scrollTo(0, saved); });
    return () => {
      cancelAnimationFrame(t);
      _planScrollY    = window.scrollY;
      _planCurrentDate = currentDateRef.current;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile?.family_code) return null;

  const navigateWeek = (dir: "prev" | "next") => {
    setCurrentDate(prev => dir === "prev" ? subDays(prev, 7) : addDays(prev, 7));
  };

  const getDayDates = () => {
    const start = new Date(weekStart);
    return DAYS.map((_, i) => addDays(start, i));
  };
  const dates = getDayDates();
  const slotOrder = MEAL_SLOTS.map((s) => s.key);

  function getSlotFromPlanKey(day: Day, key: string): MealSlotKey | null {
    const prefix = `${day}_`;
    if (!key.startsWith(prefix)) return null;
    const raw = key.slice(prefix.length);
    return slotOrder.includes(raw as MealSlotKey) ? (raw as MealSlotKey) : null;
  }

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

  function memberFactorFromType(type: string) {
    const map: Record<string, number> = {
      adult: 1.0,
      teen: 0.85,
      child: 0.6,
      toddler: 0.35,
      baby: 0,
    };
    return map[type] ?? 1.0;
  }

  function getFamilyTotalFactor() {
    const members = familyGroup?.family_members ?? [];
    if (members.length === 0) return 1;
    const sum = members.reduce((acc, m) => acc + memberFactorFromType(m.type), 0);
    return Math.max(sum, 1);
  }

  async function toggleEaten(day: Day, slot: MealSlotKey, slotData: MealSlotData) {
    if (!user?.uid || !familyGroup) return;
    const key = `${day}_${slot}`;
    const currentlyEaten = Boolean(slotData.eaten_by?.[user.uid]);
    const dateForDay = format(dates[DAYS.indexOf(day)], "yyyy-MM-dd");

    if (currentlyEaten) {
      const entryId = slotData.nutrition_entry_by_user?.[user.uid];
      if (entryId) {
        await removeDailyNutritionEntry(user.uid, dateForDay, entryId);
      }
      const next: MealSlotData = {
        ...slotData,
        eaten_by: { ...(slotData.eaten_by ?? {}), [user.uid]: false },
        nutrition_entry_by_user: { ...(slotData.nutrition_entry_by_user ?? {}), [user.uid]: "" },
      };
      setSlot(weekStart, familyGroup.code, day, slot, next);
      return;
    }

    // Recipe macros in this app are stored as per-serving values.
    // Personal eaten logging should therefore scale only by the user's portion factor.
    const portionRatio = Math.max(0, servingFactor);
    const entryId = generateId();
    await addDailyNutritionEntry(user.uid, dateForDay, {
      id: entryId,
      source: "plan_meal",
      meal_name: slotData.recipe_name ?? `${DAY_LABELS[day]} ${slot}`,
      recipe_id: slotData.recipe_id,
      calories: Math.round((slotData.calories ?? 0) * portionRatio),
      protein: Math.round((slotData.protein ?? 0) * portionRatio),
      carbs: Math.round((slotData.carbs ?? 0) * portionRatio),
      fat: Math.round((slotData.fat ?? 0) * portionRatio),
      portion_factor: portionRatio,
      created_at: new Date().toISOString(),
    });
    const next: MealSlotData = {
      ...slotData,
      eaten_by: { ...(slotData.eaten_by ?? {}), [user.uid]: true },
      nutrition_entry_by_user: { ...(slotData.nutrition_entry_by_user ?? {}), [user.uid]: entryId },
    };
    setSlot(weekStart, familyGroup.code, day, slot, next);
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

        <div className="mt-3 flex gap-2">
          <Link href={`/generate?week=${weekStart}`} className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm rounded-full py-2.5 shadow-sm hover:bg-primary/90 transition-colors">
              <Sparkles size={16} />
              Generate Plan
            </button>
          </Link>
          <button
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-border text-foreground font-semibold text-sm rounded-full py-2.5 shadow-sm hover:bg-secondary transition-colors"
            onClick={() => {
              setSelectedWeek(weekStart);
              setLocation("/shopping");
            }}
          >
            <ShoppingCart size={16} />
            Shop this week
          </button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {DAYS.map((day, idx) => {
          const isExpanded = expandedDay === day;
          const date       = dates[idx];
          const isToday    = format(new Date(), "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
          const dayExtraSlots = Object.keys(plan.slots)
            .map((key) => getSlotFromPlanKey(day, key))
            .filter((slot): slot is MealSlotKey => slot !== null)
            .filter((slot) => !plan.active_slots.includes(slot));
          const hiddenForDay = new Set(
            Object.entries(plan.hidden_slots ?? {})
              .filter(([key, hidden]) => hidden && key.startsWith(`${day}_`))
              .map(([key]) => getSlotFromPlanKey(day, key))
              .filter((slot): slot is MealSlotKey => slot !== null),
          );
          const dayVisibleSlots = slotOrder.filter((slot) =>
            (plan.active_slots.includes(slot) || dayExtraSlots.includes(slot)) &&
            !hiddenForDay.has(slot),
          );
          const remainingSlots = slotOrder.filter((slot) => !dayVisibleSlots.includes(slot));
          const filledCount = dayVisibleSlots.filter((s) => plan.slots[`${day}_${s}`]).length;

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
                      {dayVisibleSlots.map(slotKey => {
                        const slotDef  = MEAL_SLOTS.find(s => s.key === slotKey)!;
                        const slotData = plan.slots[`${day}_${slotKey}`];
                        const isExtraSlot = dayExtraSlots.includes(slotKey) && !plan.active_slots.includes(slotKey);
                        const eatenByMe = Boolean(slotData?.eaten_by?.[user?.uid ?? ""]);

                        return (
                          <div key={slotKey}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider block">
                                {slotDef.label}
                              </span>
                              <button
                                className="text-[10px] font-semibold text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isExtraSlot) {
                                    setSlot(weekStart, familyGroup!.code, day, slotKey, null);
                                  } else {
                                    setSlot(weekStart, familyGroup!.code, day, slotKey, null);
                                    setSlotHidden(weekStart, familyGroup!.code, day, slotKey, true);
                                  }
                                }}
                                title={isExtraSlot ? "Remove this slot" : "Hide this slot for this day"}
                              >
                                <X size={12} />
                                {isExtraSlot ? "Remove slot" : "Hide today"}
                              </button>
                            </div>

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
                                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                      <p className="font-semibold text-sm text-foreground truncate min-w-0 flex-1">{slotData.recipe_name}</p>
                                      {eatenByMe && (
                                        <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                          <CheckCircle2 className="size-3 text-emerald-700" strokeWidth={2.5} aria-hidden />
                                          Eaten
                                        </span>
                                      )}
                                    </div>
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
                                  className={`shrink-0 self-stretch px-3 flex items-center justify-center border-l border-border transition-colors ${
                                    eatenByMe ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-secondary/50 hover:bg-green-50 hover:text-green-700"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void toggleEaten(day, slotKey, slotData);
                                  }}
                                  title={eatenByMe ? "Mark not eaten" : "Mark eaten"}
                                >
                                  <Check size={15} />
                                </button>
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

                      {remainingSlots.length > 0 && (
                        <div className="pt-1">
                          <button
                            className="w-full border border-border rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-white hover:text-primary hover:border-primary/30 transition-colors"
                            onClick={() => setSlotPickerDay(slotPickerDay === day ? null : day)}
                          >
                            <Plus size={16} />
                            Add slot for this day only
                          </button>
                          {slotPickerDay === day && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {remainingSlots.map((slot) => {
                                const def = MEAL_SLOTS.find((s) => s.key === slot)!;
                                return (
                                  <button
                                    key={slot}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-border hover:border-primary/40 hover:text-primary transition-colors"
                                    onClick={() => {
                                      setSlotPickerDay(null);
                                      setSlotHidden(weekStart, familyGroup!.code, day, slot, false);
                                      openSheet(day, slot);
                                    }}
                                  >
                                    {def.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        className="w-full border border-border rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-white hover:text-primary hover:border-primary/30 transition-colors"
                        onClick={() => {
                          const date = format(dates[DAYS.indexOf(day)], "yyyy-MM-dd");
                          setLocation(`/nutrition?tab=log&date=${date}`);
                        }}
                      >
                        <Plus size={16} />
                        Log personal meal for this day
                      </button>
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
