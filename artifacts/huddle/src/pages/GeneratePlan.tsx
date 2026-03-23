import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles, ArrowLeft, Check, RefreshCw } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { useFamilyStore, useMealPlanStore, useNutritionStore } from "@/stores/huddle-stores";
import { useAiMutation } from "@/hooks/use-ai";
import { getWeekStart } from "@/lib/utils";
import { DAYS, Day, MealSlotKey, MEAL_SLOTS } from "@/lib/types";

export default function GeneratePlan() {
  const [, setLocation] = useLocation();
  const { familyGroup } = useFamilyStore();
  const { getPlan, setSlot } = useMealPlanStore();
  const { goals } = useNutritionStore();
  const aiMutation = useAiMutation();
  
  const weekStart = getWeekStart();
  const plan = getPlan(weekStart, familyGroup?.code || "");
  
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);
  const [isPreview, setIsPreview] = useState(false);

  // Calculate empty slots
  const emptySlots: { day: Day, slot: MealSlotKey }[] = [];
  DAYS.forEach(day => {
    plan.active_slots.forEach(slot => {
      if (!plan.slots[`${day}_${slot}`]) {
        emptySlots.push({ day, slot });
      }
    });
  });

  const handleGenerate = async () => {
    if (emptySlots.length === 0) return;
    
    const prompt = `Generate a varied weekly meal plan for these empty slots:
    ${emptySlots.map(s => `- ${s.day} ${s.slot}`).join('\n')}
    Target nutrition per day: ${goals.calories} cal.
    Return JSON array of objects with: day, slot, use_existing(bool), recipe(name, emoji, cook_time, calories, protein, cuisine, vegetarian)`;

    try {
      const res = await aiMutation.mutateAsync({ prompt, responseFormat: "json" });
      const parsed = JSON.parse(res.result);
      setGeneratedItems(parsed);
      setIsPreview(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApply = () => {
    generatedItems.forEach(item => {
      setSlot(weekStart, familyGroup!.code, item.day, item.slot, {
        recipe_name: item.recipe.name,
        emoji: item.recipe.emoji,
        calories: item.recipe.calories,
        protein: item.recipe.protein,
        cook_time: item.recipe.cook_time
      });
    });
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-display font-bold">Auto-Fill Plan</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {!isPreview ? (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 text-center py-10">
              <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                <Sparkles size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">Magic Meal Planning</h2>
              <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
                Our AI will analyze your nutrition goals and instantly fill the {emptySlots.length} empty slots in your current week.
              </p>
            </Card>

            <div className="bg-white p-5 rounded-2xl border border-border">
              <h3 className="font-semibold mb-4">Current Targets</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 p-3 rounded-xl">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Calories</span>
                  <span className="text-lg font-bold">{goals.calories}</span>
                </div>
                <div className="bg-secondary/50 p-3 rounded-xl">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block">Protein</span>
                  <span className="text-lg font-bold">{goals.protein}g</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full mt-4" 
              size="lg" 
              onClick={handleGenerate} 
              isLoading={aiMutation.isPending}
              disabled={emptySlots.length === 0}
            >
              {emptySlots.length === 0 ? "Week is Full" : `Fill ${emptySlots.length} Slots`}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold">Preview Plan</h2>
              <Badge variant="success">{generatedItems.length} meals found</Badge>
            </div>
            
            <div className="space-y-3">
              {generatedItems.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-border flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                    {item.recipe.emoji}
                  </div>
                  <div>
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-[10px] font-bold uppercase text-primary tracking-wider">{item.day}</span>
                      <span className="text-[10px] text-muted-foreground">• {item.slot}</span>
                    </div>
                    <h4 className="font-semibold text-foreground">{item.recipe.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.recipe.calories} cal • {item.recipe.protein}g protein • {item.recipe.cook_time}m
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border flex gap-3 max-w-md mx-auto pb-safe">
              <Button variant="outline" className="flex-1" onClick={handleGenerate} isLoading={aiMutation.isPending}>
                <RefreshCw className="w-4 h-4 mr-2" /> Redo
              </Button>
              <Button className="flex-1" onClick={handleApply}>
                <Check className="w-4 h-4 mr-2" /> Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
