import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Settings, Plus, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays } from "date-fns";
import { Card, Button, Badge } from "@/components/ui";
import { useFamilyStore, useMealPlanStore, useRecipeStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { DAYS, DAY_LABELS, MEAL_SLOTS, Day, MealSlotKey } from "@/lib/types";

export default function Plan() {
  const [, setLocation] = useLocation();
  const { profile, familyGroup } = useFamilyStore();
  const { getPlan, setSlot } = useMealPlanStore();
  const { recipes } = useRecipeStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = getWeekStart(currentDate);
  const plan = getPlan(weekStart, familyGroup?.code || "");
  
  const [expandedDay, setExpandedDay] = useState<Day | null>(null);

  useEffect(() => {
    if (!profile?.family_code) {
      setLocation("/setup");
    } else {
      // Expand today by default
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 6 : today - 1; // 0 is Sunday in JS, but 6 in our Monday-first array
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

  const handleClearSlot = (day: Day, slot: MealSlotKey, e: React.MouseEvent) => {
    e.stopPropagation();
    setSlot(weekStart, familyGroup.code, day, slot, null);
  };

  return (
    <div className="flex flex-col min-h-full pb-20">
      <header className="px-6 pt-12 pb-6 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{familyGroup?.name}</p>
            <h1 className="text-3xl font-display font-bold text-foreground">Weekly Plan</h1>
          </div>
          <Link href="/family">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors">
              <Settings size={20} />
            </div>
          </Link>
        </div>

        <div className="flex items-center justify-between bg-background rounded-xl p-1 border border-border">
          <button onClick={() => navigateWeek("prev")} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft size={20} /></button>
          <span className="font-semibold text-sm">
            {format(dates[0], "MMM d")} - {format(dates[6], "MMM d, yyyy")}
          </span>
          <button onClick={() => navigateWeek("next")} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {DAYS.map((day, idx) => {
          const isExpanded = expandedDay === day;
          const date = dates[idx];
          const isToday = format(new Date(), "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
          
          // Count filled slots
          const filledCount = plan.active_slots.filter(slot => plan.slots[`${day}_${slot}`]).length;
          
          return (
            <Card 
              key={day} 
              className={`p-0 overflow-hidden ${isExpanded ? 'border-primary/30 shadow-md ring-1 ring-primary/10' : ''}`}
            >
              <div 
                className="px-5 py-4 flex items-center justify-between cursor-pointer bg-white"
                onClick={() => setExpandedDay(isExpanded ? null : day)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${isToday ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-secondary text-secondary-foreground'}`}>
                    <span className="text-[10px] uppercase font-bold opacity-80">{DAY_LABELS[day]}</span>
                    <span className="text-lg font-bold leading-none">{format(date, "d")}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{format(date, "EEEE")}</h3>
                    <p className="text-xs text-muted-foreground">
                      {filledCount} / {plan.active_slots.length} meals planned
                    </p>
                  </div>
                </div>
              </div>

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
                        const slotDef = MEAL_SLOTS.find(s => s.key === slotKey)!;
                        const slotData = plan.slots[`${day}_${slotKey}`];

                        return (
                          <div key={slotKey} className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wider">{slotDef.label}</span>
                            {slotData ? (
                              <div className="bg-white border border-border rounded-xl p-3 flex items-center justify-between group shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
                                    {slotData.emoji || "🍽️"}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm text-foreground">{slotData.recipe_name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      {slotData.calories && <span className="text-[10px] text-muted-foreground">{slotData.calories} cal</span>}
                                      {slotData.cook_time && <span className="text-[10px] text-muted-foreground">{slotData.cook_time}m</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {slotData.recipe_id && (
                                    <Link href={`/recipe/${slotData.recipe_id}`}>
                                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-xs bg-secondary">View</Button>
                                    </Link>
                                  )}
                                  <button onClick={(e) => handleClearSlot(day, slotKey, e)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <Link href="/recipes">
                                <div className="border-2 border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:bg-white hover:border-primary/30 hover:text-primary transition-all cursor-pointer">
                                  <Plus size={18} />
                                  <span className="text-sm font-medium">Add to {slotDef.label}</span>
                                </div>
                              </Link>
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

      <div className="fixed bottom-20 right-6 z-30">
        <Link href="/generate">
          <Button size="icon" className="w-14 h-14 rounded-full shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-primary/80">
            <Sparkles size={24} className="text-white" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
