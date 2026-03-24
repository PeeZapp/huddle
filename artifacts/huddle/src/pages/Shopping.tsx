import { useState, useEffect } from "react";
import { Check, Plus, Trash2, Wand2, ShoppingCart, Layers, Info, ChevronDown, ChevronUp, ArrowUp, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button, Input } from "@/components/ui";
import {
  useShoppingStore, useMealPlanStore, useRecipeStore,
  useFamilyStore,
} from "@/stores/huddle-stores";
import { getWeekStart } from "@/lib/utils";
import { ShoppingItem } from "@/lib/types";
import { estimateIngredientCostUSD, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";
import { format, parseISO, addDays, addWeeks, subWeeks } from "date-fns";

// ─── Category config ─────────────────────────────────────────────────────────

interface CategoryDef {
  label: string;
  emoji: string;
  keywords: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  { label: "Bakery",            emoji: "🍞", keywords: ["bakery","bread","baked","pastry","roll"] },
  { label: "Dairy & Eggs",      emoji: "🥛", keywords: ["dairy","egg","milk","cream","cheese","butter","yoghurt","yogurt"] },
  { label: "Deli & Chilled",    emoji: "🧆", keywords: ["deli","chilled","tofu","halloumi","chorizo","prosciutto","pancetta"] },
  { label: "Drinks",            emoji: "🧃", keywords: ["drink","beverage","juice","water","wine","beer","soda","cola","tea","coffee"] },
  { label: "Fish & Seafood",    emoji: "🐟", keywords: ["fish","seafood","salmon","cod","prawn","shrimp","tuna","anchovy","clam","lobster","mussel","squid","sea bass","seabass"] },
  { label: "Frozen",            emoji: "🧊", keywords: ["frozen"] },
  { label: "Fruit",             emoji: "🍎", keywords: ["fruit","apple","banana","lemon","lime","orange","mango","berry","berries","grape","pear","peach","avocado","tomato"] },
  { label: "Grains & Pasta",    emoji: "🍝", keywords: ["grain","pasta","rice","noodle","spaghetti","penne","linguine","fettuccine","couscous","quinoa","oat","flour","breadcrumb","bulgur"] },
  { label: "Herbs & Spices",    emoji: "🌿", keywords: ["herb","spice","basil","parsley","cilantro","coriander","thyme","rosemary","oregano","mint","cumin","paprika","turmeric","ginger","chilli","chili","pepper","salt","bay","saffron","cardamom","cinnamon","clove","nutmeg","allspice","star anise","sumac","za'atar","ras el hanout"] },
  { label: "Meat & Poultry",    emoji: "🥩", keywords: ["meat","beef","pork","chicken","lamb","turkey","veal","mince","sausage","bacon","poultry","steak","rib","brisket","pulled"] },
  { label: "Oils & Condiments", emoji: "🫙", keywords: ["oil","vinegar","sauce","condiment","ketchup","mustard","mayo","mayonnaise","soy","fish sauce","oyster sauce","worcestershire","tahini","miso","paste","stock","broth","harissa","sriracha","tabasco"] },
  { label: "Tins & Jars",       emoji: "🥫", keywords: ["tin","can","jar","canned","tinned","bean","lentil","chickpea","tomato paste","coconut milk","baked bean","kidney bean","black bean"] },
  { label: "Vegetables",        emoji: "🥦", keywords: ["vegetable","veg","onion","garlic","carrot","celery","broccoli","spinach","mushroom","courgette","zucchini","aubergine","eggplant","potato","sweet potato","capsicum","pepper","leek","cabbage","cauliflower","kale","asparagus","pea","corn","sweetcorn","artichoke","fennel","beetroot","beet","radish","cucumber","lettuce","rocket","arugula","spring onion","scallion","shallot","bok choy","pak choi"] },
  { label: "Other",             emoji: "🛒", keywords: [] },
];

function resolveCategory(raw: string | undefined): string {
  if (!raw) return "Other";
  const lower = raw.toLowerCase().trim();
  const direct = CATEGORY_DEFS.find(c => c.label.toLowerCase() === lower);
  if (direct) return direct.label;
  for (const def of CATEGORY_DEFS) {
    if (def.keywords.some(kw => lower.includes(kw))) return def.label;
  }
  return "Other";
}

function categoryEmoji(label: string): string {
  return CATEGORY_DEFS.find(c => c.label === label)?.emoji ?? "🛒";
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

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
  return new Map(
    [...map.entries()].sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    }),
  );
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

interface CostSummary {
  totalUSD: number;
  coveredItems: number;
  totalItems: number;
}

function estimateListCost(items: ShoppingItem[]): CostSummary {
  let totalUSD = 0;
  let covered  = 0;
  for (const item of items) {
    const cost = estimateIngredientCostUSD(item.name, item.amount);
    if (cost !== null) {
      totalUSD += cost;
      covered++;
    }
  }
  return { totalUSD, coveredItems: covered, totalItems: items.length };
}

// ─── Ingredient row with recipe attribution dropdown ──────────────────────────

function IngredientRow({
  item,
  currency,
  onToggle,
  onDelete,
  onRecipeClick,
}: {
  item: ShoppingItem;
  currency: ReturnType<typeof getCurrencyConfig>;
  onToggle: () => void;
  onDelete: () => void;
  onRecipeClick: (recipeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const itemCostUSD = estimateIngredientCostUSD(item.name, item.amount);
  const hasSources  = (item.recipe_sources?.length ?? 0) > 0;

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded-full border-2 border-primary/40 flex items-center justify-center hover:border-primary hover:bg-primary/10 transition-colors shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm">{item.name}</span>
            {item.amount && (
              <span className="text-xs font-normal text-muted-foreground">{item.amount}</span>
            )}
          </div>
          {item.is_base_recipe && item.base_recipe_id && (
            <button
              onClick={() => onRecipeClick(item.base_recipe_id!)}
              className="flex items-center gap-1 text-[10px] font-bold text-primary mt-0.5 hover:underline"
            >
              <Layers size={9} />
              from {item.base_recipe_name ?? "base recipe"}
            </button>
          )}
        </div>

        {itemCostUSD !== null && (
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
            ~{formatCost(itemCostUSD, currency)}
          </span>
        )}

        {hasSources && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors p-1"
            title="See which recipes use this ingredient"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}

        <button
          onClick={onDelete}
          className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && hasSources && (
        <div className="border-t border-border/50 bg-secondary/30 px-3.5 py-2.5 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Used in
          </p>
          {item.recipe_sources!.map(src => (
            <button
              key={src.recipe_id}
              onClick={() => onRecipeClick(src.recipe_id)}
              className="w-full flex items-center gap-2 text-left text-sm font-medium text-primary hover:underline"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
              {src.recipe_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Shopping() {
  const [, setLocation]    = useLocation();
  const { familyGroup }    = useFamilyStore();
  const currency           = getCurrencyConfig(familyGroup?.country);

  const {
    items, addItem, toggleItem, deleteItem, clearChecked, clearAll, clearWeek, generateFromPlan,
    selectedWeekStart, setSelectedWeek,
  } = useShoppingStore();
  const { getPlan }  = useMealPlanStore();
  const { recipes }  = useRecipeStore();

  const [newItem, setNewItem]           = useState("");
  const [newCategory, setNewCategory]   = useState("Other");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showCostInfo, setShowCostInfo] = useState(false);
  const [showScrollTop, setShowScrollTop]       = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm]   = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Use the week selected from the Plan page, falling back to the current week
  const weekStart = selectedWeekStart ?? getWeekStart();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    addItem({ name: newItem.trim(), category: newCategory, family_code: familyGroup!.code, week_start: weekStart });
    setNewItem("");
  };

  const doSync = (replace: boolean) => {
    if (replace) clearWeek(familyGroup!.code, weekStart);
    const plan = getPlan(weekStart, familyGroup!.code);
    generateFromPlan(plan, recipes);
    setShowSyncConfirm(false);
  };

  const handleSyncPlan = () => {
    if (activeItems.length > 0) {
      setShowSyncConfirm(true);
    } else {
      doSync(false);
    }
  };

  const handleRecipeClick = (recipeId: string) => {
    setLocation(`/recipe/${recipeId}?from=shopping`);
  };

  const navigateWeek = (dir: "prev" | "next") => {
    const base = parseISO(weekStart);
    const next = dir === "next" ? addWeeks(base, 1) : subWeeks(base, 1);
    setSelectedWeek(format(next, "yyyy-MM-dd"));
    setShowSyncConfirm(false);
  };

  // Only show items that belong to the currently-viewed week (or items with no
  // week stamp, which can't exist from normal usage but are a safe fallback).
  const activeItems  = items.filter(i =>
    i.family_code === familyGroup?.code && !i.checked &&
    (!i.week_start || i.week_start === weekStart)
  );
  const checkedItems = items.filter(i =>
    i.family_code === familyGroup?.code && i.checked &&
    (!i.week_start || i.week_start === weekStart)
  );

  const grouped = groupByCategory(activeItems);
  const isEmpty  = activeItems.length === 0 && checkedItems.length === 0;

  const costSummary = activeItems.length > 0 ? estimateListCost(activeItems) : null;
  const coveragePct = costSummary
    ? Math.round((costSummary.coveredItems / Math.max(1, costSummary.totalItems)) * 100)
    : 0;

  // Format the week label for the header
  const weekLabel = (() => {
    try {
      const d = parseISO(weekStart);
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${format(d, "MMM d")} – ${format(end, "MMM d")}`;
    } catch {
      return "";
    }
  })();

  return (
    <div className="flex flex-col min-h-full pb-24">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        {/* Row 1: title + trash */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Shopping List</p>
            <h1 className="text-3xl font-display font-bold">Groceries</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && !showClearConfirm && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                aria-label="Clear list"
              >
                <Trash2 size={15} />
              </button>
            )}
            {showClearConfirm && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { clearWeek(familyGroup!.code, weekStart); setShowClearConfirm(false); }}
                  className="h-9 px-3 rounded-xl bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors"
                  aria-label="Cancel"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: week navigator + Sync Plan */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between bg-background rounded-xl p-1 border border-border">
            <button onClick={() => navigateWeek("prev")} className="p-2 hover:bg-white rounded-lg transition">
              <ChevronLeft size={20} />
            </button>
            <span className="font-semibold text-sm">{weekLabel}</span>
            <button onClick={() => navigateWeek("next")} className="p-2 hover:bg-white rounded-lg transition">
              <ChevronRight size={20} />
            </button>
          </div>
          {!showSyncConfirm && (
            <Button variant="outline" size="sm" onClick={handleSyncPlan} className="gap-1.5 h-9 text-xs shrink-0">
              <Wand2 size={13} /> Sync
            </Button>
          )}
        </div>

        {/* Sync confirmation banner */}
        {showSyncConfirm && (
          <div className="mt-3 flex items-center justify-between gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
            <p className="text-xs text-foreground font-medium">Replace current list or add to it?</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => doSync(true)}
                className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Replace
              </button>
              <button
                onClick={() => doSync(false)}
                className="h-8 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-secondary transition-colors"
              >
                Add to list
              </button>
              <button
                onClick={() => setShowSyncConfirm(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="p-6 space-y-6">

        {/* ── Cost estimate banner ──────────────────────────────────────── */}
        {costSummary && costSummary.totalUSD > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={15} className="text-primary" />
                  <span className="text-sm font-bold text-primary">Estimated list total</span>
                </div>
                <button
                  onClick={() => setShowCostInfo(v => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info size={15} />
                </button>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {formatCost(costSummary.totalUSD, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {costSummary.coveredItems} of {costSummary.totalItems} items priced ({coveragePct}%)
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{activeItems.length} item{activeItems.length !== 1 ? "s" : ""}</p>
                  <p>remaining</p>
                </div>
              </div>

              <div className="mt-3 h-1.5 bg-primary/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
            </div>

            {showCostInfo && (
              <div className="px-4 pb-4 pt-0 border-t border-primary/10 mt-0">
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-3">
                  <strong>About these estimates:</strong> Prices are based on typical supermarket prices and are shown in {currency.code} using an estimated exchange rate. Actual prices vary by store, brand, region, and season. Items without a recognised name are excluded from the total. Quantities shown are for the recipes as written — you may already have some ingredients at home. This is a rough guide only and should not be relied upon for budgeting purposes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Add item form ─────────────────────────────────────────────── */}
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

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {isEmpty && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Your list is empty</p>
            <p className="text-sm mt-1">Add items above or sync from your meal plan</p>
          </div>
        )}

        {/* ── Active items grouped by category ─────────────────────────── */}
        {[...grouped.entries()].map(([category, catItems]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2 mt-1">
              <span className="text-base leading-none">{categoryEmoji(category)}</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{category}</h2>
              <span className="text-xs text-muted-foreground/60">({catItems.length})</span>
            </div>

            <div className="space-y-2">
              {catItems.map(item => (
                <IngredientRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  onToggle={() => toggleItem(item.id)}
                  onDelete={() => deleteItem(item.id)}
                  onRecipeClick={handleRecipeClick}
                />
              ))}
            </div>
          </div>
        ))}

        {/* ── Ticked off items ──────────────────────────────────────────── */}
        {checkedItems.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ticked off</h2>
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
                      {item.amount && <span className="ml-1.5 text-xs font-normal">{item.amount}</span>}
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

      {/* ── Scroll-to-top button ─────────────────────────────────────────── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-5 z-40 w-10 h-10 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all"
          aria-label="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}
