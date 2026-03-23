// ─── Amount parsing, normalisation, combining ─────────────────────────────────
//
// Handles strings like "500g", "1.5 kg", "3 tbsp", "6 cloves", "2", ""

interface ParsedAmount {
  value: number;
  unit: string; // normalised
  raw: string;  // original string, kept for fallback display
}

// Normalise unit strings to a canonical form
const UNIT_MAP: Record<string, string> = {
  // weight
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  // volume
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  // spoon
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  // cup
  cup: "cup", cups: "cup",
};

// Units that can be converted into a common base for summing
const WEIGHT_UNITS   = new Set(["g", "kg"]);
const VOLUME_UNITS   = new Set(["ml", "l"]);
const SPOON_UNITS    = new Set(["tsp", "tbsp"]);

function normaliseUnit(raw: string): string {
  return UNIT_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

// Convert to a base unit for summing (g for weight, ml for volume)
function toBase(value: number, unit: string): { value: number; base: string } | null {
  if (unit === "g")    return { value, base: "g" };
  if (unit === "kg")   return { value: value * 1000, base: "g" };
  if (unit === "ml")   return { value, base: "ml" };
  if (unit === "l")    return { value: value * 1000, base: "ml" };
  return null;
}

// Format a summed value back to a readable string
function formatBase(value: number, base: string): string {
  if (base === "g") {
    return value >= 1000
      ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, "")}kg`
      : `${Math.round(value)}g`;
  }
  if (base === "ml") {
    return value >= 1000
      ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(/\.0$/, "")}l`
      : `${Math.round(value)}ml`;
  }
  return `${value}${base}`;
}

// Parse a single amount string → { value, unit, raw }
export function parseAmount(raw: string | undefined): ParsedAmount | null {
  if (!raw || !raw.trim()) return null;
  const str = raw.trim();
  // Match: optional number (int or decimal), optional unit text
  const m = str.match(/^(\d+\.?\d*)\s*(.*)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;
  const unit = normaliseUnit(m[2].trim());
  return { value, unit, raw: str };
}

// Combine an array of amount strings for the same ingredient name.
// Returns a single display string, or undefined if nothing parseable.
export function combineAmounts(amounts: (string | undefined)[]): string | undefined {
  const parsed = amounts.map(parseAmount).filter(Boolean) as ParsedAmount[];

  if (parsed.length === 0) return undefined;

  // All units the same (or unit-less)
  const units = [...new Set(parsed.map(p => p.unit))];

  if (units.length === 1) {
    const unit = units[0];
    const total = parsed.reduce((s, p) => s + p.value, 0);
    const nice  = Number.isInteger(total) ? `${total}` : `${parseFloat(total.toFixed(2))}`;
    return unit ? `${nice}${unit === "g" || unit === "kg" || unit === "ml" || unit === "l" ? "" : " "}${unit}` : nice;
  }

  // Mixed but all weight — convert to g then format
  if (units.every(u => WEIGHT_UNITS.has(u))) {
    const totalG = parsed.reduce((s, p) => {
      const b = toBase(p.value, p.unit);
      return s + (b ? b.value : 0);
    }, 0);
    return formatBase(totalG, "g");
  }

  // Mixed but all volume — convert to ml then format
  if (units.every(u => VOLUME_UNITS.has(u))) {
    const totalMl = parsed.reduce((s, p) => {
      const b = toBase(p.value, p.unit);
      return s + (b ? b.value : 0);
    }, 0);
    return formatBase(totalMl, "ml");
  }

  // Truly incompatible — just list raw amounts joined
  const distinct = [...new Set(amounts.filter(Boolean) as string[])];
  return distinct.join(" + ");
}

// Deduplicate and combine ingredients from multiple recipes
export interface FlatIngredient {
  name: string;
  amount?: string;
  category?: string;
}

export function deduplicateIngredients(all: FlatIngredient[]): FlatIngredient[] {
  const map = new Map<string, FlatIngredient[]>();

  for (const ing of all) {
    const key = ing.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ing);
  }

  const result: FlatIngredient[] = [];
  for (const [, group] of map) {
    const representative = group[0];
    const combined = combineAmounts(group.map(g => g.amount));
    result.push({
      name:     representative.name,
      amount:   combined,
      category: representative.category,
    });
  }

  return result;
}
