import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, RefreshCw, Lock, Sparkles, Check, X, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui";
import { usePriceStore, useFamilyStore } from "@/stores/huddle-stores";
import { INGREDIENT_CATALOG, CatalogIngredient, getCurrencyConfig, formatCost } from "@/lib/recipe-costing";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextFirstOfMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Inline price editor ──────────────────────────────────────────────────────

function PriceEditor({
  item,
  currentPriceUSD,
  onSave,
  onCancel,
  currencySymbol,
  multiplier,
}: {
  item: CatalogIngredient;
  currentPriceUSD: number;
  onSave: (priceUSD: number) => void;
  onCancel: () => void;
  currencySymbol: string;
  multiplier: number;
}) {
  const [localVal, setLocalVal] = useState(
    (currentPriceUSD * multiplier).toFixed(2)
  );

  const handleSave = () => {
    const localNum = parseFloat(localVal);
    if (isNaN(localNum) || localNum <= 0) return;
    onSave(localNum / multiplier); // store as USD
  };

  const unitLabel = item.baseUnit === "each"
    ? `per ${item.baseUnit}`
    : `per ${item.baseAmount}${item.baseUnit}`;

  return (
    <div className="mt-2 bg-secondary/50 rounded-xl p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        {item.label} · {unitLabel}
      </p>
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-muted-foreground">{currencySymbol}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          autoFocus
          className="flex-1 text-sm border border-input rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={handleSave} className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/80">
          <Check size={14} />
        </button>
        <button onClick={onCancel} className="p-1.5 bg-secondary text-foreground rounded-lg hover:bg-border">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Ingredient row ───────────────────────────────────────────────────────────

function IngredientRow({
  item,
  userPrices,
  aiPrices,
  isEditing,
  onEditStart,
  onSave,
  onCancel,
  onClear,
  currency,
}: {
  item: CatalogIngredient;
  userPrices: Record<string, { priceUSD: number; baseAmount: number; baseUnit: string }>;
  aiPrices:   Record<string, { priceUSD: number; baseAmount: number; baseUnit: string }>;
  isEditing: boolean;
  onEditStart: () => void;
  onSave: (priceUSD: number) => void;
  onCancel: () => void;
  onClear: () => void;
  currency: ReturnType<typeof getCurrencyConfig>;
}) {
  const userEntry = userPrices[item.key];
  const aiEntry   = aiPrices[item.key];

  const effectivePriceUSD = userEntry?.priceUSD ?? aiEntry?.priceUSD ?? item.defaultPriceUSD;
  const source = userEntry ? "you" : aiEntry ? "ai" : "built-in";

  const sourceBadge = {
    you:       { label: "You",      className: "bg-primary/10 text-primary" },
    ai:        { label: "AI",       className: "bg-blue-50 text-blue-600" },
    "built-in": { label: "Built-in", className: "bg-secondary text-muted-foreground" },
  }[source];

  const unitLabel = item.baseUnit === "each"
    ? `each`
    : `per ${item.baseAmount}${item.baseUnit}`;

  return (
    <div className="border-b border-border/50 last:border-0 py-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onEditStart}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl w-7 text-center">{item.emoji}</span>
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{unitLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sourceBadge.className}`}>
            {sourceBadge.label}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCost(effectivePriceUSD, currency)}
          </span>
          {userEntry ? (
            <button
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="p-1 text-muted-foreground hover:text-destructive rounded"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
        </div>
      </div>

      {isEditing && (
        <PriceEditor
          item={item}
          currentPriceUSD={effectivePriceUSD}
          onSave={onSave}
          onCancel={onCancel}
          currencySymbol={currency.symbol}
          multiplier={currency.multiplier}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PriceSettings() {
  const {
    aiPrices, userPrices, lastAiRefresh, isRefreshing, isSubscribed,
    refreshPrices, setUserPrice, clearUserPrice, checkAutoRefresh,
  } = usePriceStore();
  const { familyGroup } = useFamilyStore();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [search, setSearch]         = useState("");

  const currency = getCurrencyConfig(familyGroup?.country);

  // Auto-refresh check on mount
  useEffect(() => {
    checkAutoRefresh(familyGroup?.country);
  }, []);

  // Group catalog by category, filtered by search
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? INGREDIENT_CATALOG.filter(i =>
          i.label.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      : INGREDIENT_CATALOG;

    const map = new Map<string, CatalogIngredient[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [search]);

  const userOverrideCount = Object.keys(userPrices).length;

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <header className="px-5 pt-12 pb-5 bg-white border-b border-border/50 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-display font-bold">Ingredient Prices</h1>
        </div>
      </header>

      <div className="p-5 space-y-5">

        {/* AI Refresh card */}
        <div className="bg-gradient-to-br from-primary/8 to-transparent border border-primary/20 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles size={18} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">AI Price Refresh</p>
                <p className="text-xs text-muted-foreground">
                  {lastAiRefresh
                    ? `Last updated ${formatDate(lastAiRefresh)}`
                    : "Never refreshed"}
                </p>
              </div>
            </div>

            {isSubscribed ? (
              <Button
                size="sm"
                onClick={() => refreshPrices(familyGroup?.country)}
                disabled={isRefreshing}
                className="shrink-0"
              >
                <RefreshCw size={14} className={`mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Refreshing…" : "Refresh Now"}
              </Button>
            ) : (
              <div className="relative shrink-0">
                <Button size="sm" disabled className="opacity-60">
                  <Lock size={14} className="mr-1.5" />
                  Refresh Now
                </Button>
              </div>
            )}
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/60 rounded-xl px-3 py-2">
            <RefreshCw size={11} />
            <span>Auto-refreshes on the 1st of each month</span>
            <span className="ml-auto font-medium">Next: {nextFirstOfMonth()}</span>
          </div>

          {/* Subscription gate */}
          {!isSubscribed && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Lock size={13} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                <span className="font-semibold">Huddle Pro</span> — upgrade to refresh prices on demand any time.
              </p>
            </div>
          )}
        </div>

        {/* Your overrides summary */}
        {userOverrideCount > 0 && (
          <div className="bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                {userOverrideCount} custom price{userOverrideCount !== 1 ? "s" : ""} set
              </p>
              <p className="text-xs text-muted-foreground">Your prices take priority over AI estimates</p>
            </div>
            <button
              onClick={() => {
                if (confirm("Clear all your custom prices?")) {
                  Object.keys(userPrices).forEach(k => clearUserPrice(k));
                }
              }}
              className="text-xs text-destructive font-medium hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Search */}
        <input
          type="search"
          placeholder="Search ingredients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border border-input rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary/20" /> You — your custom price
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-200" /> AI — AI estimated
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary border border-border" /> Built-in — default
          </span>
        </div>

        {/* Ingredient list */}
        {grouped.size === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No ingredients match your search</p>
        )}

        {[...grouped.entries()].map(([category, items]) => (
          <section key={category}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {category}
            </h3>
            <div className="bg-white border border-border rounded-2xl px-4">
              {items.map(item => (
                <IngredientRow
                  key={item.key}
                  item={item}
                  userPrices={userPrices}
                  aiPrices={aiPrices}
                  isEditing={editingKey === item.key}
                  onEditStart={() => setEditingKey(editingKey === item.key ? null : item.key)}
                  onSave={priceUSD => {
                    setUserPrice(item.key, priceUSD, item.baseAmount, item.baseUnit);
                    setEditingKey(null);
                  }}
                  onCancel={() => setEditingKey(null)}
                  onClear={() => clearUserPrice(item.key)}
                  currency={currency}
                />
              ))}
            </div>
          </section>
        ))}

        <p className="text-xs text-center text-muted-foreground pt-2 px-4">
          Prices shown in {currency.code}. All estimates are for typical supermarket retail — not restaurant pricing.
          Tap any ingredient to set your own price.
        </p>
      </div>
    </div>
  );
}
