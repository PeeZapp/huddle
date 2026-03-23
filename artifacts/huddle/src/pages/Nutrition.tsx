import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { useNutritionStore, useFamilyStore } from "@/stores/huddle-stores";
import { format } from "date-fns";

export default function Nutrition() {
  const { familyGroup } = useFamilyStore();
  const { goals, logs, addLog } = useNutritionStore();
  
  const [tab, setTab] = useState<"summary" | "log">("summary");
  const [mealName, setMealName] = useState("");
  const [cal, setCal] = useState("");
  const [prot, setProt] = useState("");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLogs = logs.filter(l => l.date === todayStr);

  const totalCals = todayLogs.reduce((sum, l) => sum + (l.calories || 0), 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + (l.protein || 0), 0);

  const calPercent = Math.min((totalCals / goals.calories) * 100, 100);
  const protPercent = Math.min((totalProt / goals.protein) * 100, 100);

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName) return;
    addLog({
      family_code: familyGroup!.code,
      date: todayStr,
      meal_name: mealName,
      calories: Number(cal) || 0,
      protein: Number(prot) || 0,
      is_personal: true
    });
    setMealName(""); setCal(""); setProt("");
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <h1 className="text-3xl font-display font-bold mb-4">Health</h1>
        <div className="flex bg-secondary p-1 rounded-xl">
          <button onClick={() => setTab("summary")} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tab === "summary" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Summary</button>
          <button onClick={() => setTab("log")} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tab === "log" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Food Log</button>
        </div>
      </header>

      <div className="p-6">
        {tab === "summary" ? (
          <div className="space-y-6">
            <h2 className="font-semibold text-muted-foreground">Today's Progress</h2>
            
            <Card className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">Calories</span>
                  <span className="text-sm font-medium text-muted-foreground">{totalCals} / {goals.calories} kcal</span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-500" style={{ width: `${calPercent}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">Protein</span>
                  <span className="text-sm font-medium text-muted-foreground">{totalProt} / {goals.protein}g</span>
                </div>
                <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${protPercent}%` }} />
                </div>
              </div>
            </Card>

            <Card className="bg-primary/5 border-primary/20 flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                  <Target size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Goal: Maintenance</h4>
                  <p className="text-xs text-muted-foreground">Tap to change</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8">Edit</Button>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleAddLog} className="bg-white p-4 rounded-2xl border border-border space-y-3">
              <Input placeholder="What did you eat?" value={mealName} onChange={e=>setMealName(e.target.value)} />
              <div className="flex gap-3">
                <Input type="number" placeholder="Calories" value={cal} onChange={e=>setCal(e.target.value)} />
                <Input type="number" placeholder="Protein (g)" value={prot} onChange={e=>setProt(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">Log Food</Button>
            </form>

            <div className="space-y-3">
              <h3 className="font-semibold text-muted-foreground mt-6 mb-2">Today's Log</h3>
              {todayLogs.length === 0 ? (
                <p className="text-sm text-center py-8 text-muted-foreground">Nothing logged today.</p>
              ) : (
                todayLogs.map(log => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-border flex justify-between items-center">
                    <span className="font-medium">{log.meal_name}</span>
                    <div className="text-right text-sm">
                      <span className="font-bold text-accent mr-2">{log.calories}c</span>
                      <span className="font-bold text-primary">{log.protein}p</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
