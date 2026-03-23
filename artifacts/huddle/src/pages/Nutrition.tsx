import { useState } from "react";
import { Check, Target } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useNutritionStore, useFamilyStore } from "@/stores/huddle-stores";
import { NutritionGoals } from "@/lib/types";
import { format } from "date-fns";

// ─── Presets ────────────────────────────────────────────────────────────────

interface Preset {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const PRESETS: Preset[] = [
  { name: "Weight Loss",   calories: 1600, protein: 140, carbs: 140, fat:  50 },
  { name: "Maintenance",   calories: 2000, protein: 120, carbs: 250, fat:  65 },
  { name: "Muscle Gain",   calories: 2800, protein: 200, carbs: 300, fat:  80 },
  { name: "Athletic",      calories: 3200, protein: 220, carbs: 400, fat:  85 },
  { name: "Low Carb",      calories: 1900, protein: 155, carbs:  75, fat: 115 },
  { name: "High Protein",  calories: 2300, protein: 230, carbs: 185, fat:  65 },
  { name: "Keto",          calories: 1800, protein: 130, carbs:  25, fat: 145 },
  { name: "Vegan",         calories: 2000, protein:  90, carbs: 310, fat:  55 },
];

// ─── Slider row ─────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, unit, value, min, max, step, onChange }: SliderRowProps) {
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

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = "goals" | "summary" | "log";

export default function Nutrition() {
  const { familyGroup } = useFamilyStore();
  const { goals, logs, setGoals, addLog } = useNutritionStore();

  const [tab, setTab]             = useState<Tab>("summary");
  const [draft, setDraft]         = useState<NutritionGoals>(goals);
  const [saved, setSaved]         = useState(false);

  // Food log form
  const [mealName, setMealName]   = useState("");
  const [cal, setCal]             = useState("");
  const [prot, setProt]           = useState("");

  const todayStr  = format(new Date(), "yyyy-MM-dd");
  const todayLogs = logs.filter(l => l.date === todayStr);
  const totalCals = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProt = todayLogs.reduce((s, l) => s + (l.protein  || 0), 0);
  const totalCarbs= todayLogs.reduce((s, l) => s + (l.carbs    || 0), 0);
  const totalFat  = todayLogs.reduce((s, l) => s + (l.fat      || 0), 0);

  function pct(val: number, goal: number) {
    return Math.min(Math.round((val / Math.max(goal, 1)) * 100), 100);
  }

  function applyPreset(p: Preset) {
    setDraft({ calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat });
    setSaved(false);
  }

  function saveGoals() {
    setGoals(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    if (!mealName) return;
    addLog({
      family_code: familyGroup!.code,
      date: todayStr,
      meal_name: mealName,
      calories: Number(cal)  || 0,
      protein:  Number(prot) || 0,
      is_personal: true,
    });
    setMealName(""); setCal(""); setProt("");
  }

  // Which preset currently matches draft?
  const activePreset = PRESETS.find(
    p => p.calories === draft.calories && p.protein === draft.protein &&
         p.carbs === draft.carbs && p.fat === draft.fat
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: "goals",   label: "Goals"   },
    { key: "summary", label: "Today"   },
    { key: "log",     label: "Food Log"},
  ];

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <h1 className="text-3xl font-display font-bold mb-4">Health</h1>
        <div className="flex bg-secondary p-1 rounded-xl">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t.key ? "bg-white shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 pb-32 space-y-6">

        {/* ── GOALS ────────────────────────────────────────────────── */}
        {tab === "goals" && (
          <>
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              Quick Presets
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => {
                const active = p.name === activePreset?.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      active
                        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                        : "bg-white border-border hover:border-primary/30"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center">
                        <Check size={12} />
                      </span>
                    )}
                    <span className={`text-sm font-bold ${active ? "text-primary" : ""}`}>
                      {p.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      {p.calories.toLocaleString()} kcal · {p.protein}g protein
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider pt-2">
              Fine-tune
            </h2>

            <Card className="space-y-6">
              <SliderRow
                label="Calories"
                unit=" kcal"
                value={draft.calories}
                min={800}
                max={5000}
                step={50}
                onChange={v => { setDraft(d => ({ ...d, calories: v })); setSaved(false); }}
              />
              <SliderRow
                label="Protein"
                unit="g"
                value={draft.protein}
                min={20}
                max={350}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, protein: v })); setSaved(false); }}
              />
              <SliderRow
                label="Carbohydrates"
                unit="g"
                value={draft.carbs}
                min={20}
                max={700}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, carbs: v })); setSaved(false); }}
              />
              <SliderRow
                label="Fat"
                unit="g"
                value={draft.fat}
                min={10}
                max={300}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, fat: v })); setSaved(false); }}
              />
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={saveGoals}
              disabled={saved}
            >
              {saved
                ? <><Check size={16} className="mr-2" /> Saved</>
                : <><Target size={16} className="mr-2" /> Save Goals</>
              }
            </Button>
          </>
        )}

        {/* ── SUMMARY ──────────────────────────────────────────────── */}
        {tab === "summary" && (
          <>
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              Today's Progress
            </h2>

            <Card className="space-y-5">
              {[
                { label: "Calories",      val: totalCals,  goal: goals.calories, unit: "kcal", color: "bg-amber-400" },
                { label: "Protein",       val: totalProt,  goal: goals.protein,  unit: "g",    color: "bg-primary"   },
                { label: "Carbohydrates", val: totalCarbs, goal: goals.carbs,    unit: "g",    color: "bg-blue-400"  },
                { label: "Fat",           val: totalFat,   goal: goals.fat,      unit: "g",    color: "bg-rose-400"  },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {row.val} / {row.goal.toLocaleString()}{row.unit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct(row.val, row.goal)}%` }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            <button
              onClick={() => setTab("goals")}
              className="w-full flex items-center justify-between bg-white border border-border rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Target size={20} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">
                    {activePreset?.name ?? "Custom"} — {goals.calories.toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-muted-foreground">Tap to edit goals</p>
                </div>
              </div>
              <span className="text-muted-foreground text-lg">›</span>
            </button>
          </>
        )}

        {/* ── FOOD LOG ─────────────────────────────────────────────── */}
        {tab === "log" && (
          <>
            <form
              onSubmit={handleAddLog}
              className="bg-white p-4 rounded-2xl border border-border space-y-3"
            >
              <input
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="What did you eat?"
                value={mealName}
                onChange={e => setMealName(e.target.value)}
              />
              <div className="flex gap-3">
                <input
                  type="number"
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Calories"
                  value={cal}
                  onChange={e => setCal(e.target.value)}
                />
                <input
                  type="number"
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="Protein (g)"
                  value={prot}
                  onChange={e => setProt(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">Log Food</Button>
            </form>

            <div className="space-y-2">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                Today's Log
              </h3>
              {todayLogs.length === 0 ? (
                <p className="text-sm text-center py-10 text-muted-foreground">Nothing logged today.</p>
              ) : (
                todayLogs.map(log => (
                  <div
                    key={log.id}
                    className="bg-white p-4 rounded-xl border border-border flex justify-between items-center"
                  >
                    <span className="font-medium text-sm">{log.meal_name}</span>
                    <div className="text-right text-xs space-x-2">
                      <span className="font-bold text-amber-500">{log.calories} kcal</span>
                      <span className="font-bold text-primary">{log.protein}g</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
