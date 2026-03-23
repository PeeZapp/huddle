import { useState } from "react";
import { Check, Plus, Trash2, Wand2, ShoppingCart } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useShoppingStore, useMealPlanStore, useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { ShoppingItem } from "@/lib/types";

// ─── Category config ─────────────────────────────────────────────────────────

interface CategoryDef {
  label: string;
  emoji: string;
  keywords: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  { label: "Bakery",          emoji: "🍞", keywords: ["bakery","bread","baked","pastry","roll"] },
  { label: "Dairy & Eggs",    emoji: "🥛", keywords: ["dairy","egg","milk","cream","cheese","butter","yoghurt","yogurt"] },
  { label: "Deli & Chilled",  emoji: "🧆", keywords: ["deli","chilled","tofu","halloumi","chorizo","prosciutto","pancetta"] },
  { label: "Drinks",          emoji: "🧃", keywords: ["drink","beverage","juice","water","wine","beer","soda","cola","tea","coffee"] },
  { label: "Fish & Seafood",  emoji: "🐟", keywords: ["fish","seafood","salmon","cod","prawn","shrimp","tuna","anchovy","clam","lobster","mussel","squid","sea bass","seabass"] },
  { label: "Frozen",          emoji: "🧊", keywords: ["frozen"] },
  { label: "Fruit",           emoji: "🍎", keywords: ["fruit","apple","banana","lemon","lime","orange","mango","berry","berries","grape","pear","peach","avocado","tomato"] },
  { label: "Grains & Pasta",  emoji: "🍝", keywords: ["grain","pasta","rice","noodle","spaghetti","penne","linguine","fettuccine","couscous","quinoa","oat","flour","breadcrumb","bulgur"] },
  { label: "Herbs & Spices",  emoji: "🌿", keywords: ["herb","spice","basil","parsley","cilantro","coriander","thyme","rosemary","oregano","mint","cumin","paprika","turmeric","ginger","chilli","chili","pepper","salt","bay","saffron","cardamom","cinnamon","clove","nutmeg","allspice","star anise","sumac","za'atar","ras el hanout"] },
  { label: "Meat & Poultry",  emoji: "🥩", keywords: ["meat","beef","pork","chicken","lamb","turkey","veal","mince","sausage","bacon","poultry","steak","rib","brisket","pulled"] },
  { label: "Oils & Condiments", emoji: "🫙", keywords: ["oil","vinegar","sauce","condiment","ketchup","mustard","mayo","mayonnaise","soy","fish sauce","oyster sauce","worcestershire","tahini","miso","paste","stock","broth","harissa","sriracha","tabasco"] },
  { label: "Tins & Jars",     emoji: "🥫", keywords: ["tin","can","jar","canned","tinned","bean","lentil","chickpea","tomato paste","coconut milk","baked bean","kidney bean","black bean"] },
  { label: "Vegetables",      emoji: "🥦", keywords: ["vegetable","veg","onion","garlic","carrot","celery","broccoli","spinach","mushroom","courgette","zucchini","aubergine","eggplant","potato","sweet potato","capsicum","pepper","leek","cabbage","cauliflower","kale","asparagus","pea","corn","sweetcorn","artichoke","fennel","beetroot","beet","radish","cucumber","lettuce","rocket","arugula","spring onion","scallion","shallot","bok choy","pak choi"] },
  { label: "Other",           emoji: "🛒", keywords: [] },
];

function resolveCategory(raw: string | undefined): string {
  if (!raw) return "Other";
  const lower = raw.toLowerCase().trim();

  // Direct match on the label
  const direct = CATEGORY_DEFS.find(c => c.label.toLowerCase() === lower);
  if (direct) return direct.label;

  // Keyword match
  for (const def of CATEGORY_DEFS) {
    if (def.keywords.some(kw => lower.includes(kw))) return def.label;
  }
  return "Other";
}

function categoryEmoji(label: string): string {
  return CATEGORY_DEFS.find(c => c.label === label)?.emoji ?? "🛒";
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

function groupByCategory(items: ShoppingItem[]): Map<string, ShoppingItem[]> {
  const map = new Map<string, ShoppingItem[]>();
  const sorted = [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  for (const item of sorted) {
    const cat = resolveCategory(item.category);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  // Sort categories alphabetically (Other always last)
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    }),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Shopping() {
  const { familyGroup }                                           = useFamilyStore();
  const { items, addItem, toggleItem, deleteItem, clearChecked, generateFromPlan } = useShoppingStore();
  const { getPlan }                                              = useMealPlanStore();
  const { recipes }                                              = useRecipeStore();

  const [newItem, setNewItem]     = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const weekStart = getWeekStart();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    addItem({ name: newItem.trim(), category: newCategory, family_code: familyGroup!.code });
    setNewItem("");
  };

  const handleAutoGenerate = () => {
    const plan = getPlan(weekStart, familyGroup!.code);
    generateFromPlan(plan, recipes);
  };

  const activeItems  = items.filter(i => i.family_code === familyGroup?.code && !i.checked);
  const checkedItems = items.filter(i => i.family_code === familyGroup?.code && i.checked);

  const grouped = groupByCategory(activeItems);
  const isEmpty = activeItems.length === 0 && checkedItems.length === 0;

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Shopping List</p>
            <h1 className="text-3xl font-display font-bold">Groceries</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleAutoGenerate} className="gap-2 h-9 text-xs">
            <Wand2 size={14} /> Sync Plan
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">

        {/* Add item form */}
        <div className="space-y-2">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="Add item…"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" className="shrink-0"><Plus size={20} /></Button>
          </form>

          {/* Category picker */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Category:</span>
            {showCatPicker ? (
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORY_DEFS.map(c => (
                  <button
                    key={c.label}
                    onClick={() => { setNewCategory(c.label); setShowCatPicker(false); }}
                    className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                      newCategory === c.label
                        ? "bg-primary text-white border-primary"
                        : "bg-white border-border hover:border-primary/40"
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setShowCatPicker(true)}
                className="text-xs px-2.5 py-1 rounded-lg bg-secondary border border-border hover:border-primary/30 transition-colors"
              >
                {categoryEmoji(newCategory)} {newCategory} ▾
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Your list is empty</p>
            <p className="text-sm mt-1">Add items above or sync from your meal plan</p>
          </div>
        )}

        {/* Active items grouped by category */}
        {[...grouped.entries()].map(([category, catItems]) => (
          <div key={category}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2 mt-1">
              <span className="text-base leading-none">{categoryEmoji(category)}</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {category}
              </h2>
              <span className="text-xs text-muted-foreground/60">({catItems.length})</span>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {catItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-border shadow-sm"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-6 h-6 rounded-full border-2 border-primary/40 flex items-center justify-center hover:border-primary hover:bg-primary/10 transition-colors shrink-0"
                  />
                  <span className="flex-1 font-medium text-sm">
                    {item.name}
                    {item.amount && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {item.amount}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Checked / ticked off items */}
        {checkedItems.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ticked off
                </h2>
                <span className="text-xs text-muted-foreground/60">({checkedItems.length})</span>
              </div>
              <button
                onClick={() => clearChecked(familyGroup!.code)}
                className="text-xs font-semibold text-destructive hover:underline"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2">
              {[...checkedItems]
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                .map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-secondary/40 p-3 rounded-xl opacity-60"
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className="flex-1 line-through text-sm">
                      {item.name}
                      {item.amount && (
                        <span className="ml-1.5 text-xs font-normal">
                          {item.amount}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
