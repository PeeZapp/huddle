// ─── Recipe cost estimation ───────────────────────────────────────────────────
// Prices are USD per unit. Country multipliers adjust for local grocery costs.
// All estimates are based on typical supermarket pricing — not restaurant prices.

import { parseAmount } from "./amount-utils";
import { Recipe } from "./types";

// ─── Country / currency config ────────────────────────────────────────────────

interface CountryConfig {
  symbol: string;
  code: string;
  multiplier: number; // relative to USD
}

const COUNTRY_MAP: Record<string, CountryConfig> = {
  // Oceania
  AU: { symbol: "$", code: "AUD", multiplier: 1.55 },
  NZ: { symbol: "$", code: "NZD", multiplier: 1.65 },
  // Americas
  US: { symbol: "$", code: "USD", multiplier: 1.00 },
  CA: { symbol: "$", code: "CAD", multiplier: 1.35 },
  MX: { symbol: "$", code: "MXN", multiplier: 17.5 },
  BR: { symbol: "R$", code: "BRL", multiplier: 5.00 },
  // Europe
  GB: { symbol: "£", code: "GBP", multiplier: 0.80 },
  IE: { symbol: "€", code: "EUR", multiplier: 0.95 },
  FR: { symbol: "€", code: "EUR", multiplier: 0.93 },
  DE: { symbol: "€", code: "EUR", multiplier: 0.92 },
  ES: { symbol: "€", code: "EUR", multiplier: 0.88 },
  IT: { symbol: "€", code: "EUR", multiplier: 0.90 },
  NL: { symbol: "€", code: "EUR", multiplier: 0.93 },
  SE: { symbol: "kr", code: "SEK", multiplier: 10.5 },
  NO: { symbol: "kr", code: "NOK", multiplier: 10.8 },
  DK: { symbol: "kr", code: "DKK", multiplier: 7.0 },
  CH: { symbol: "Fr", code: "CHF", multiplier: 0.90 },
  // Asia-Pacific
  JP: { symbol: "¥", code: "JPY", multiplier: 150 },
  KR: { symbol: "₩", code: "KRW", multiplier: 1320 },
  CN: { symbol: "¥", code: "CNY", multiplier: 7.25 },
  SG: { symbol: "$", code: "SGD", multiplier: 1.35 },
  HK: { symbol: "$", code: "HKD", multiplier: 7.80 },
  IN: { symbol: "₹", code: "INR", multiplier: 83 },
  // Middle East & Africa
  AE: { symbol: "د.إ", code: "AED", multiplier: 3.67 },
  ZA: { symbol: "R", code: "ZAR", multiplier: 18.5 },
};

const DEFAULT_CONFIG: CountryConfig = { symbol: "$", code: "USD", multiplier: 1.00 };

export function getCurrencyConfig(countryCode?: string): CountryConfig {
  if (!countryCode) return DEFAULT_CONFIG;
  return COUNTRY_MAP[countryCode.toUpperCase()] ?? DEFAULT_CONFIG;
}

export function formatCost(usd: number, config: CountryConfig): string {
  const local = usd * config.multiplier;
  // Small numbers: 2 decimal places; large: round to integer
  const formatted = local >= 100
    ? Math.round(local).toLocaleString()
    : local.toFixed(2);
  return `${config.symbol}${formatted}`;
}

// ─── Price database (USD per baseAmount of baseUnit) ─────────────────────────

type BaseUnit = "g" | "ml" | "each";

interface PriceEntry {
  keywords: string[];    // all must appear in normalised ingredient name
  anyKeyword?: string[]; // at least one must match (optional secondary filter)
  priceUSD: number;
  baseAmount: number;
  baseUnit: BaseUnit;
}

const PRICE_DB: PriceEntry[] = [
  // ── Meat & Poultry ─────────────────────────────────────────────────────────
  { keywords: ["chicken"], anyKeyword: ["breast", "fillet"],   priceUSD: 0.90, baseAmount: 100, baseUnit: "g" },
  { keywords: ["chicken"], anyKeyword: ["thigh", "drumstick", "leg"], priceUSD: 0.65, baseAmount: 100, baseUnit: "g" },
  { keywords: ["chicken"], anyKeyword: ["whole", "roast"],     priceUSD: 0.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["chicken"],                                      priceUSD: 0.75, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beef"],   anyKeyword: ["mince", "ground"],     priceUSD: 0.90, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beef"],   anyKeyword: ["sirloin", "steak", "tenderloin", "fillet"], priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beef"],   anyKeyword: ["chuck", "brisket", "shin", "short rib"],   priceUSD: 1.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beef"],                                         priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["lamb"],   anyKeyword: ["rack", "cutlet", "chop"],                  priceUSD: 2.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["lamb"],                                         priceUSD: 1.40, baseAmount: 100, baseUnit: "g" },
  { keywords: ["pork"],   anyKeyword: ["belly", "ribs", "rib"],priceUSD: 1.10, baseAmount: 100, baseUnit: "g" },
  { keywords: ["pork"],                                         priceUSD: 0.80, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bacon"],                                        priceUSD: 1.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["sausage"],anyKeyword: ["chorizo", "andouille"],priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["sausage"],                                      priceUSD: 0.90, baseAmount: 100, baseUnit: "g" },
  { keywords: ["chorizo"],                                      priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["prosciutto"],                                   priceUSD: 2.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["pancetta"],                                     priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["mince"],                                        priceUSD: 0.90, baseAmount: 100, baseUnit: "g" },
  { keywords: ["turkey"],                                       priceUSD: 0.85, baseAmount: 100, baseUnit: "g" },

  // ── Seafood ────────────────────────────────────────────────────────────────
  { keywords: ["salmon"],                                       priceUSD: 2.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cod"],                                          priceUSD: 1.60, baseAmount: 100, baseUnit: "g" },
  { keywords: ["tuna"],   anyKeyword: ["canned", "tin"],        priceUSD: 0.45, baseAmount: 100, baseUnit: "g" },
  { keywords: ["tuna"],                                         priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["prawn"],                                        priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["shrimp"],                                       priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["clam"],                                         priceUSD: 1.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["mussel"],                                       priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["squid"],                                        priceUSD: 1.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["lobster"],                                      priceUSD: 4.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["sea bass"], priceUSD: 2.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["seabass"],  priceUSD: 2.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["anchovy"],                                      priceUSD: 1.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["fish"],   anyKeyword: ["canned", "tin"],        priceUSD: 0.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["fish"],                                         priceUSD: 1.50, baseAmount: 100, baseUnit: "g" },

  // ── Dairy & Eggs ───────────────────────────────────────────────────────────
  { keywords: ["butter"],                                       priceUSD: 0.80, baseAmount: 100, baseUnit: "g" },
  { keywords: ["parmesan"],                                     priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cheddar"],                                      priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["mozzarella"],                                   priceUSD: 1.10, baseAmount: 100, baseUnit: "g" },
  { keywords: ["feta"],                                         priceUSD: 1.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["halloumi"],                                     priceUSD: 2.00, baseAmount: 100, baseUnit: "g" },
  { keywords: ["brie"],                                         priceUSD: 2.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cheese"],                                       priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cream"], anyKeyword: ["double", "heavy", "whipping"], priceUSD: 0.55, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["cream"], anyKeyword: ["sour", "creme", "fraiche"],    priceUSD: 0.45, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["cream"],                                        priceUSD: 0.45, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["milk"],                                         priceUSD: 0.12, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["yoghurt"],                                      priceUSD: 0.35, baseAmount: 100, baseUnit: "g" },
  { keywords: ["yogurt"],                                       priceUSD: 0.35, baseAmount: 100, baseUnit: "g" },
  { keywords: ["egg"],                                          priceUSD: 0.35, baseAmount: 1,   baseUnit: "each" },

  // ── Vegetables ─────────────────────────────────────────────────────────────
  { keywords: ["onion"],                                        priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["garlic"],                                       priceUSD: 0.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["tomato"], anyKeyword: ["cherry"],               priceUSD: 0.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["tomato"],                                       priceUSD: 0.35, baseAmount: 100, baseUnit: "g" },
  { keywords: ["capsicum"],                                     priceUSD: 0.55, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bell pepper"],                                  priceUSD: 0.55, baseAmount: 100, baseUnit: "g" },
  { keywords: ["carrot"],                                       priceUSD: 0.15, baseAmount: 100, baseUnit: "g" },
  { keywords: ["celery"],                                       priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["potato"],anyKeyword: ["sweet"],                 priceUSD: 0.22, baseAmount: 100, baseUnit: "g" },
  { keywords: ["potato"],                                       priceUSD: 0.15, baseAmount: 100, baseUnit: "g" },
  { keywords: ["sweet potato"],                                 priceUSD: 0.22, baseAmount: 100, baseUnit: "g" },
  { keywords: ["mushroom"],                                     priceUSD: 0.65, baseAmount: 100, baseUnit: "g" },
  { keywords: ["broccoli"],                                     priceUSD: 0.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["spinach"],                                      priceUSD: 0.55, baseAmount: 100, baseUnit: "g" },
  { keywords: ["kale"],                                         priceUSD: 0.45, baseAmount: 100, baseUnit: "g" },
  { keywords: ["zucchini"],                                     priceUSD: 0.35, baseAmount: 100, baseUnit: "g" },
  { keywords: ["courgette"],                                    priceUSD: 0.35, baseAmount: 100, baseUnit: "g" },
  { keywords: ["aubergine"],                                    priceUSD: 0.32, baseAmount: 100, baseUnit: "g" },
  { keywords: ["eggplant"],                                     priceUSD: 0.32, baseAmount: 100, baseUnit: "g" },
  { keywords: ["leek"],                                         priceUSD: 0.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cabbage"],                                      priceUSD: 0.12, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cauliflower"],                                  priceUSD: 0.28, baseAmount: 100, baseUnit: "g" },
  { keywords: ["asparagus"],                                    priceUSD: 0.80, baseAmount: 100, baseUnit: "g" },
  { keywords: ["corn"],                                         priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["pea"],                                          priceUSD: 0.28, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bok choy"],                                     priceUSD: 0.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["fennel"],                                       priceUSD: 0.40, baseAmount: 100, baseUnit: "g" },
  { keywords: ["artichoke"],                                    priceUSD: 0.70, baseAmount: 100, baseUnit: "g" },
  { keywords: ["cucumber"],                                     priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["shallot"],                                      priceUSD: 0.40, baseAmount: 100, baseUnit: "g" },
  { keywords: ["spring onion"],                                 priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["scallion"],                                     priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beetroot"],                                     priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["beet"],                                         priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["radish"],                                       priceUSD: 0.30, baseAmount: 100, baseUnit: "g" },
  { keywords: ["lettuce"],                                      priceUSD: 0.28, baseAmount: 100, baseUnit: "g" },
  { keywords: ["rocket"],                                       priceUSD: 0.60, baseAmount: 100, baseUnit: "g" },
  { keywords: ["arugula"],                                      priceUSD: 0.60, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bean sprout"],                                  priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["ginger"],                                       priceUSD: 0.60, baseAmount: 100, baseUnit: "g" },

  // ── Fruit ──────────────────────────────────────────────────────────────────
  { keywords: ["lemon"],                                        priceUSD: 0.60, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["lime"],                                         priceUSD: 0.40, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["orange"],                                       priceUSD: 0.70, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["apple"],                                        priceUSD: 0.50, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["avocado"],                                      priceUSD: 1.20, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["mango"],                                        priceUSD: 1.00, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["banana"],                                       priceUSD: 0.20, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["pear"],                                         priceUSD: 0.60, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["peach"],                                        priceUSD: 0.70, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["berry"],                                        priceUSD: 1.50, baseAmount: 100, baseUnit: "g" },
  { keywords: ["grape"],                                        priceUSD: 0.60, baseAmount: 100, baseUnit: "g" },
  { keywords: ["strawberr"],                                    priceUSD: 1.20, baseAmount: 100, baseUnit: "g" },

  // ── Grains, Pasta & Bread ──────────────────────────────────────────────────
  { keywords: ["pasta"],                                        priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["spaghetti"],                                    priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["penne"],                                        priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["linguine"],                                     priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["fettuccine"],                                   priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["noodle"],                                       priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["rice"],   anyKeyword: ["arborio"],              priceUSD: 0.25, baseAmount: 100, baseUnit: "g" },
  { keywords: ["rice"],                                         priceUSD: 0.15, baseAmount: 100, baseUnit: "g" },
  { keywords: ["couscous"],                                     priceUSD: 0.20, baseAmount: 100, baseUnit: "g" },
  { keywords: ["quinoa"],                                       priceUSD: 0.45, baseAmount: 100, baseUnit: "g" },
  { keywords: ["oat"],                                          priceUSD: 0.12, baseAmount: 100, baseUnit: "g" },
  { keywords: ["flour"],                                        priceUSD: 0.08, baseAmount: 100, baseUnit: "g" },
  { keywords: ["breadcrumb"],                                   priceUSD: 0.14, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bread"],  anyKeyword: ["bun", "roll"],          priceUSD: 0.60, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["bread"],                                        priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["tortilla"],                                     priceUSD: 0.40, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["wrap"],                                         priceUSD: 0.40, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["lentil"],                                       priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },
  { keywords: ["bulgur"],                                       priceUSD: 0.18, baseAmount: 100, baseUnit: "g" },

  // ── Tinned & Jarred ────────────────────────────────────────────────────────
  { keywords: ["coconut milk"],                                 priceUSD: 1.50, baseAmount: 400, baseUnit: "ml" },
  { keywords: ["tomato"], anyKeyword: ["canned", "tinned", "diced", "crushed"], priceUSD: 0.90, baseAmount: 400, baseUnit: "g" },
  { keywords: ["chickpea"],                                     priceUSD: 1.00, baseAmount: 400, baseUnit: "g" },
  { keywords: ["black bean"],                                   priceUSD: 1.00, baseAmount: 400, baseUnit: "g" },
  { keywords: ["kidney bean"],                                  priceUSD: 1.00, baseAmount: 400, baseUnit: "g" },
  { keywords: ["bean"],                                         priceUSD: 1.00, baseAmount: 400, baseUnit: "g" },
  { keywords: ["stock"], anyKeyword: ["chicken"],               priceUSD: 0.06, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["stock"], anyKeyword: ["beef", "veal"],          priceUSD: 0.07, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["stock"],                                        priceUSD: 0.05, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["broth"],                                        priceUSD: 0.05, baseAmount: 100, baseUnit: "ml" },

  // ── Oils & Condiments ──────────────────────────────────────────────────────
  { keywords: ["olive oil"],                                    priceUSD: 0.22, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["oil"],                                          priceUSD: 0.08, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["vinegar"], anyKeyword: ["balsamic"],            priceUSD: 0.20, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["vinegar"],                                      priceUSD: 0.08, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["soy sauce"],                                    priceUSD: 0.06, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["fish sauce"],                                   priceUSD: 0.06, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["oyster sauce"],                                 priceUSD: 0.07, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["tomato paste"],                                 priceUSD: 0.12, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["bbq sauce"],                                    priceUSD: 0.08, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["worcestershire"],                               priceUSD: 0.08, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["tahini"],                                       priceUSD: 0.30, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["miso"],                                         priceUSD: 0.35, baseAmount: 15, baseUnit: "g" },
  { keywords: ["harissa"],                                      priceUSD: 0.25, baseAmount: 15, baseUnit: "g" },
  { keywords: ["sriracha"],                                     priceUSD: 0.10, baseAmount: 15, baseUnit: "ml" },
  { keywords: ["honey"],                                        priceUSD: 0.18, baseAmount: 15, baseUnit: "g" },
  { keywords: ["mustard"],                                      priceUSD: 0.10, baseAmount: 15, baseUnit: "g" },
  { keywords: ["mayonnaise"],                                   priceUSD: 0.12, baseAmount: 15, baseUnit: "g" },
  { keywords: ["ketchup"],                                      priceUSD: 0.08, baseAmount: 15, baseUnit: "g" },
  { keywords: ["sugar"],  anyKeyword: ["brown"],                priceUSD: 0.10, baseAmount: 100, baseUnit: "g" },
  { keywords: ["sugar"],                                        priceUSD: 0.08, baseAmount: 100, baseUnit: "g" },
  { keywords: ["salt"],                                         priceUSD: 0.01, baseAmount: 5,   baseUnit: "g" },
  { keywords: ["pepper"], anyKeyword: ["black", "white"],       priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["capers"],                                       priceUSD: 0.30, baseAmount: 15,  baseUnit: "g" },
  { keywords: ["wine"],   anyKeyword: ["red", "white"],         priceUSD: 0.15, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["beer"],                                         priceUSD: 0.20, baseAmount: 100, baseUnit: "ml" },
  { keywords: ["cider"],                                        priceUSD: 0.18, baseAmount: 100, baseUnit: "ml" },

  // ── Herbs & Spices (small quantities — negligible individual cost) ──────────
  { keywords: ["basil"],                                        priceUSD: 0.06, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["parsley"],                                      priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["cilantro"],                                     priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["coriander"],                                    priceUSD: 0.04, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["thyme"],                                        priceUSD: 0.04, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["rosemary"],                                     priceUSD: 0.04, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["oregano"],                                      priceUSD: 0.04, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["mint"],                                         priceUSD: 0.06, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["cumin"],                                        priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["paprika"],                                      priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["turmeric"],                                     priceUSD: 0.04, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["chili"],                                        priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["chilli"],                                       priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["cinnamon"],                                     priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["cardamom"],                                     priceUSD: 0.08, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["bay leaf"],                                     priceUSD: 0.03, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["bay leaves"],                                   priceUSD: 0.03, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["saffron"],                                      priceUSD: 0.30, baseAmount: 0.5, baseUnit: "g" },
  { keywords: ["nutmeg"],                                       priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["allspice"],                                     priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["star anise"],                                   priceUSD: 0.06, baseAmount: 1,   baseUnit: "each" },
  { keywords: ["clove"],  anyKeyword: ["spice", "ground"],      priceUSD: 0.06, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["sumac"],                                        priceUSD: 0.06, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["ras el hanout"],                                priceUSD: 0.06, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["za'atar"],                                      priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["cajun"],                                        priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
  { keywords: ["bbq rub"],                                      priceUSD: 0.05, baseAmount: 2,   baseUnit: "g" },
];

// ─── Unit → grams / ml conversions ────────────────────────────────────────────

// Returns { value, unit: "g"|"ml"|"each" } or null if unknown
function toBaseUnit(value: number, unit: string): { value: number; unit: BaseUnit } | null {
  const u = unit.toLowerCase().trim();

  // Weight
  if (u === "g" || u === "gram" || u === "grams")             return { value, unit: "g" };
  if (u === "kg" || u === "kilogram" || u === "kilograms")     return { value: value * 1000, unit: "g" };
  if (u === "oz" || u === "ounce" || u === "ounces")           return { value: value * 28.35, unit: "g" };
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return { value: value * 453.6, unit: "g" };

  // Volume
  if (u === "ml" || u === "milliliter" || u === "millilitre")  return { value, unit: "ml" };
  if (u === "l" || u === "liter" || u === "litre")             return { value: value * 1000, unit: "ml" };
  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") return { value: value * 15, unit: "ml" };
  if (u === "tsp" || u === "teaspoon" || u === "teaspoons")    return { value: value * 5, unit: "ml" };
  if (u === "cup" || u === "cups")                              return { value: value * 240, unit: "ml" };
  if (u === "floz" || u === "fl oz")                            return { value: value * 29.6, unit: "ml" };

  // Count/each
  if (u === "" || u === "each" || u === "piece" || u === "pieces" ||
      u === "unit" || u === "units" || u === "whole" || u === "serving" ||
      u === "large" || u === "medium" || u === "small")         return { value, unit: "each" };

  // Garlic cloves → ~5g each
  if (u === "clove" || u === "cloves")                          return { value: value * 5, unit: "g" };

  // Herb sprigs → ~2g each
  if (u === "sprig" || u === "sprigs")                          return { value: value * 2, unit: "g" };

  // Bay leaves etc.
  if (u === "leaf" || u === "leaves")                           return { value, unit: "each" };

  // Slices of bread/meat ~30g each
  if (u === "slice" || u === "slices")                          return { value: value * 30, unit: "g" };

  // Cans: treat as 400ml for liquids, 400g for solids — we'll let caller decide
  if (u === "can" || u === "tin" || u === "cans" || u === "tins") return { value: value * 400, unit: "g" };

  return null;
}

// ─── Price lookup ─────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findPrice(ingredientName: string): PriceEntry | null {
  const n = norm(ingredientName);

  let best: PriceEntry | null = null;
  let bestScore = 0;

  for (const entry of PRICE_DB) {
    const allMatch = entry.keywords.every(kw => n.includes(kw));
    if (!allMatch) continue;

    const anyMatch = !entry.anyKeyword || entry.anyKeyword.some(kw => n.includes(kw));
    if (!anyMatch) continue;

    // Score = total chars of all matched keywords (longer = more specific)
    const score = entry.keywords.reduce((s, kw) => s + kw.length, 0)
                + (entry.anyKeyword ? entry.anyKeyword.reduce((s, kw) => s + kw.length, 0) : 0);

    if (score > bestScore) { best = entry; bestScore = score; }
  }

  return best;
}

// ─── Single ingredient cost ───────────────────────────────────────────────────

function estimateIngredientCostUSD(name: string, amount: string | undefined): number | null {
  const entry = findPrice(name);
  if (!entry) return null;

  if (!amount) {
    // No amount given — assume one base unit of the price entry
    return entry.priceUSD;
  }

  const parsed = parseAmount(amount);
  if (!parsed) return entry.priceUSD; // fallback to one unit

  // Convert to base unit
  const converted = toBaseUnit(parsed.value, parsed.unit);
  if (!converted) return entry.priceUSD;

  // If units match the price entry's base unit, calculate
  if (converted.unit === entry.baseUnit) {
    return (converted.value / entry.baseAmount) * entry.priceUSD;
  }

  // Unit mismatch (e.g. ingredient in ml but entry in g) — return one unit estimate
  return entry.priceUSD;
}

// ─── Ingredient catalog (user-facing price overrides) ─────────────────────────

export interface CatalogIngredient {
  key: string;
  label: string;
  category: string;
  emoji: string;
  baseAmount: number;
  baseUnit: BaseUnit;
  defaultPriceUSD: number;
}

export const INGREDIENT_CATALOG: CatalogIngredient[] = [
  // Meat & Poultry
  { key: "chicken breast", label: "Chicken Breast",       category: "Meat & Poultry", emoji: "🍗", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.90 },
  { key: "chicken thigh",  label: "Chicken Thigh",        category: "Meat & Poultry", emoji: "🍗", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.65 },
  { key: "beef mince",     label: "Beef Mince",           category: "Meat & Poultry", emoji: "🥩", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.90 },
  { key: "beef steak",     label: "Beef Steak",           category: "Meat & Poultry", emoji: "🥩", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 2.00 },
  { key: "lamb",           label: "Lamb",                 category: "Meat & Poultry", emoji: "🍖", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 1.40 },
  { key: "pork",           label: "Pork",                 category: "Meat & Poultry", emoji: "🥩", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.80 },
  { key: "bacon",          label: "Bacon",                category: "Meat & Poultry", emoji: "🥓", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 1.30 },
  { key: "sausage",        label: "Sausages",             category: "Meat & Poultry", emoji: "🌭", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.90 },
  // Seafood
  { key: "salmon",         label: "Salmon",               category: "Seafood",        emoji: "🐟", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 2.20 },
  { key: "prawn",          label: "Prawns / Shrimp",      category: "Seafood",        emoji: "🦐", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 2.00 },
  { key: "tuna canned",    label: "Canned Tuna",          category: "Seafood",        emoji: "🐟", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.45 },
  { key: "fish",           label: "White Fish",           category: "Seafood",        emoji: "🐠", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 1.50 },
  // Dairy & Eggs
  { key: "butter",         label: "Butter",               category: "Dairy & Eggs",   emoji: "🧈", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.80 },
  { key: "milk",           label: "Milk",                 category: "Dairy & Eggs",   emoji: "🥛", baseAmount: 100, baseUnit: "ml",   defaultPriceUSD: 0.12 },
  { key: "egg",            label: "Eggs",                 category: "Dairy & Eggs",   emoji: "🥚", baseAmount: 1,   baseUnit: "each", defaultPriceUSD: 0.35 },
  { key: "cheddar",        label: "Cheddar Cheese",       category: "Dairy & Eggs",   emoji: "🧀", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 1.20 },
  { key: "parmesan",       label: "Parmesan",             category: "Dairy & Eggs",   emoji: "🧀", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 2.00 },
  { key: "cream",          label: "Cream",                category: "Dairy & Eggs",   emoji: "🫙", baseAmount: 100, baseUnit: "ml",   defaultPriceUSD: 0.45 },
  { key: "yoghurt",        label: "Yoghurt",              category: "Dairy & Eggs",   emoji: "🫙", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.35 },
  // Vegetables
  { key: "onion",          label: "Onion",                category: "Vegetables",     emoji: "🧅", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.18 },
  { key: "garlic",         label: "Garlic",               category: "Vegetables",     emoji: "🧄", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.50 },
  { key: "tomato",         label: "Tomatoes",             category: "Vegetables",     emoji: "🍅", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.35 },
  { key: "capsicum",       label: "Capsicum / Bell Pepper", category: "Vegetables",   emoji: "🫑", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.55 },
  { key: "carrot",         label: "Carrot",               category: "Vegetables",     emoji: "🥕", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.15 },
  { key: "potato",         label: "Potato",               category: "Vegetables",     emoji: "🥔", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.15 },
  { key: "sweet potato",   label: "Sweet Potato",         category: "Vegetables",     emoji: "🍠", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.22 },
  { key: "mushroom",       label: "Mushrooms",            category: "Vegetables",     emoji: "🍄", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.65 },
  { key: "broccoli",       label: "Broccoli",             category: "Vegetables",     emoji: "🥦", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.30 },
  { key: "spinach",        label: "Spinach",              category: "Vegetables",     emoji: "🥬", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.55 },
  { key: "zucchini",       label: "Zucchini",             category: "Vegetables",     emoji: "🥒", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.35 },
  // Fruit
  { key: "lemon",          label: "Lemon",                category: "Fruit",          emoji: "🍋", baseAmount: 1,   baseUnit: "each", defaultPriceUSD: 0.60 },
  { key: "avocado",        label: "Avocado",              category: "Fruit",          emoji: "🥑", baseAmount: 1,   baseUnit: "each", defaultPriceUSD: 1.20 },
  { key: "mango",          label: "Mango",                category: "Fruit",          emoji: "🥭", baseAmount: 1,   baseUnit: "each", defaultPriceUSD: 1.00 },
  // Pantry
  { key: "pasta",          label: "Pasta (dry)",          category: "Pantry",         emoji: "🍝", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.18 },
  { key: "rice",           label: "Rice",                 category: "Pantry",         emoji: "🍚", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.15 },
  { key: "flour",          label: "Plain Flour",          category: "Pantry",         emoji: "🌾", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.08 },
  { key: "olive oil",      label: "Olive Oil",            category: "Pantry",         emoji: "🫙", baseAmount: 15,  baseUnit: "ml",   defaultPriceUSD: 0.22 },
  { key: "coconut milk",   label: "Coconut Milk",         category: "Pantry",         emoji: "🥥", baseAmount: 400, baseUnit: "ml",   defaultPriceUSD: 1.50 },
  { key: "canned tomato",  label: "Canned Tomatoes",      category: "Pantry",         emoji: "🥫", baseAmount: 400, baseUnit: "g",    defaultPriceUSD: 0.90 },
  { key: "chickpea",       label: "Chickpeas (tin)",      category: "Pantry",         emoji: "🫘", baseAmount: 400, baseUnit: "g",    defaultPriceUSD: 1.00 },
  { key: "stock",          label: "Chicken Stock",        category: "Pantry",         emoji: "🍲", baseAmount: 100, baseUnit: "ml",   defaultPriceUSD: 0.06 },
  { key: "soy sauce",      label: "Soy Sauce",            category: "Pantry",         emoji: "🫙", baseAmount: 15,  baseUnit: "ml",   defaultPriceUSD: 0.06 },
  { key: "tomato paste",   label: "Tomato Paste",         category: "Pantry",         emoji: "🥫", baseAmount: 15,  baseUnit: "ml",   defaultPriceUSD: 0.12 },
  { key: "honey",          label: "Honey",                category: "Pantry",         emoji: "🍯", baseAmount: 15,  baseUnit: "g",    defaultPriceUSD: 0.18 },
  { key: "sugar",          label: "Sugar",                category: "Pantry",         emoji: "🍬", baseAmount: 100, baseUnit: "g",    defaultPriceUSD: 0.08 },
];

// Override price map — user or AI prices keyed by catalog key
export type PriceOverrideMap = Record<string, { priceUSD: number; baseAmount: number; baseUnit: string }>;

// Look up an ingredient name against the catalog and return an override if present
function findOverridePrice(
  ingredientName: string,
  overrides: PriceOverrideMap,
): { entry: CatalogIngredient; priceUSD: number } | null {
  const n = ingredientName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  for (const item of INGREDIENT_CATALOG) {
    // Match if all words of the catalog key are present in the ingredient name
    const keyWords = item.key.split(" ");
    if (keyWords.every(w => n.includes(w)) && overrides[item.key]) {
      return { entry: item, priceUSD: overrides[item.key].priceUSD };
    }
  }
  return null;
}

// ─── Full recipe cost ─────────────────────────────────────────────────────────

export interface RecipeCost {
  totalUSD: number;
  perServeUSD: number;
  coveredIngredients: number;
  totalIngredients: number;
  confidence: "high" | "medium" | "low"; // based on % ingredients priced
}

export interface PriceOverrides {
  userPrices: PriceOverrideMap;
  aiPrices: PriceOverrideMap;
}

export function estimateRecipeCost(
  recipe: Recipe,
  servings = 4,
  overrides?: PriceOverrides,
): RecipeCost | null {
  if (!recipe.ingredients?.length) return null;

  let totalUSD = 0;
  let covered = 0;

  for (const ing of recipe.ingredients) {
    // Check user overrides first, then AI overrides, then static PRICE_DB
    let cost: number | null = null;

    if (overrides) {
      const userMatch = findOverridePrice(ing.name, overrides.userPrices);
      if (userMatch) {
        const parsed = parseAmount(ing.amount ?? "");
        const converted = parsed ? toBaseUnit(parsed.value, parsed.unit) : null;
        if (converted && converted.unit === userMatch.entry.baseUnit) {
          cost = (converted.value / userMatch.entry.baseAmount) * userMatch.priceUSD;
        } else {
          cost = userMatch.priceUSD;
        }
      } else {
        const aiMatch = findOverridePrice(ing.name, overrides.aiPrices);
        if (aiMatch) {
          const parsed = parseAmount(ing.amount ?? "");
          const converted = parsed ? toBaseUnit(parsed.value, parsed.unit) : null;
          if (converted && converted.unit === aiMatch.entry.baseUnit) {
            cost = (converted.value / aiMatch.entry.baseAmount) * aiMatch.priceUSD;
          } else {
            cost = aiMatch.priceUSD;
          }
        }
      }
    }

    if (cost === null) {
      cost = estimateIngredientCostUSD(ing.name, ing.amount);
    }

    if (cost !== null) {
      totalUSD += cost;
      covered++;
    }
  }

  if (covered === 0) return null;

  const pct = covered / recipe.ingredients.length;
  const confidence: RecipeCost["confidence"] =
    pct >= 0.75 ? "high" : pct >= 0.50 ? "medium" : "low";

  return {
    totalUSD,
    perServeUSD: totalUSD / servings,
    coveredIngredients: covered,
    totalIngredients: recipe.ingredients.length,
    confidence,
  };
}
