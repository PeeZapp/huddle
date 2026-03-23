import { Router } from "express";

const router = Router();

// ── Ingredient catalog sent to Claude ─────────────────────────────────────────
// Each entry: key (used as override ID), label, baseAmount, baseUnit, currentUSD (baseline)
const CATALOG = [
  // Meat & Poultry
  { key: "chicken breast",  label: "Chicken Breast",    baseAmount: 100, baseUnit: "g",    currentUSD: 0.90 },
  { key: "chicken thigh",   label: "Chicken Thigh",     baseAmount: 100, baseUnit: "g",    currentUSD: 0.65 },
  { key: "beef mince",      label: "Beef Mince/Ground", baseAmount: 100, baseUnit: "g",    currentUSD: 0.90 },
  { key: "beef steak",      label: "Beef Steak",        baseAmount: 100, baseUnit: "g",    currentUSD: 2.00 },
  { key: "lamb",            label: "Lamb",              baseAmount: 100, baseUnit: "g",    currentUSD: 1.40 },
  { key: "pork",            label: "Pork",              baseAmount: 100, baseUnit: "g",    currentUSD: 0.80 },
  { key: "bacon",           label: "Bacon",             baseAmount: 100, baseUnit: "g",    currentUSD: 1.30 },
  { key: "sausage",         label: "Sausages",          baseAmount: 100, baseUnit: "g",    currentUSD: 0.90 },
  // Seafood
  { key: "salmon",          label: "Salmon",            baseAmount: 100, baseUnit: "g",    currentUSD: 2.20 },
  { key: "prawn",           label: "Prawns/Shrimp",     baseAmount: 100, baseUnit: "g",    currentUSD: 2.00 },
  { key: "tuna canned",     label: "Canned Tuna",       baseAmount: 100, baseUnit: "g",    currentUSD: 0.45 },
  { key: "fish",            label: "White Fish",        baseAmount: 100, baseUnit: "g",    currentUSD: 1.50 },
  // Dairy & Eggs
  { key: "butter",          label: "Butter",            baseAmount: 100, baseUnit: "g",    currentUSD: 0.80 },
  { key: "milk",            label: "Milk",              baseAmount: 100, baseUnit: "ml",   currentUSD: 0.12 },
  { key: "egg",             label: "Eggs",              baseAmount: 1,   baseUnit: "each", currentUSD: 0.35 },
  { key: "cheddar",         label: "Cheddar Cheese",    baseAmount: 100, baseUnit: "g",    currentUSD: 1.20 },
  { key: "parmesan",        label: "Parmesan",          baseAmount: 100, baseUnit: "g",    currentUSD: 2.00 },
  { key: "cream",           label: "Cream",             baseAmount: 100, baseUnit: "ml",   currentUSD: 0.45 },
  { key: "yoghurt",         label: "Yoghurt",           baseAmount: 100, baseUnit: "g",    currentUSD: 0.35 },
  // Vegetables
  { key: "onion",           label: "Onion",             baseAmount: 100, baseUnit: "g",    currentUSD: 0.18 },
  { key: "garlic",          label: "Garlic",            baseAmount: 100, baseUnit: "g",    currentUSD: 0.50 },
  { key: "tomato",          label: "Tomatoes",          baseAmount: 100, baseUnit: "g",    currentUSD: 0.35 },
  { key: "capsicum",        label: "Capsicum/Bell Pepper", baseAmount: 100, baseUnit: "g", currentUSD: 0.55 },
  { key: "carrot",          label: "Carrot",            baseAmount: 100, baseUnit: "g",    currentUSD: 0.15 },
  { key: "potato",          label: "Potato",            baseAmount: 100, baseUnit: "g",    currentUSD: 0.15 },
  { key: "sweet potato",    label: "Sweet Potato",      baseAmount: 100, baseUnit: "g",    currentUSD: 0.22 },
  { key: "mushroom",        label: "Mushrooms",         baseAmount: 100, baseUnit: "g",    currentUSD: 0.65 },
  { key: "broccoli",        label: "Broccoli",          baseAmount: 100, baseUnit: "g",    currentUSD: 0.30 },
  { key: "spinach",         label: "Spinach",           baseAmount: 100, baseUnit: "g",    currentUSD: 0.55 },
  { key: "zucchini",        label: "Zucchini",          baseAmount: 100, baseUnit: "g",    currentUSD: 0.35 },
  // Fruit
  { key: "lemon",           label: "Lemon",             baseAmount: 1,   baseUnit: "each", currentUSD: 0.60 },
  { key: "avocado",         label: "Avocado",           baseAmount: 1,   baseUnit: "each", currentUSD: 1.20 },
  { key: "mango",           label: "Mango",             baseAmount: 1,   baseUnit: "each", currentUSD: 1.00 },
  // Pantry
  { key: "pasta",           label: "Pasta (dry)",       baseAmount: 100, baseUnit: "g",    currentUSD: 0.18 },
  { key: "rice",            label: "Rice",              baseAmount: 100, baseUnit: "g",    currentUSD: 0.15 },
  { key: "flour",           label: "Plain Flour",       baseAmount: 100, baseUnit: "g",    currentUSD: 0.08 },
  { key: "olive oil",       label: "Olive Oil",         baseAmount: 15,  baseUnit: "ml",   currentUSD: 0.22 },
  { key: "coconut milk",    label: "Coconut Milk",      baseAmount: 400, baseUnit: "ml",   currentUSD: 1.50 },
  { key: "canned tomato",   label: "Canned Tomatoes",   baseAmount: 400, baseUnit: "g",    currentUSD: 0.90 },
  { key: "chickpea",        label: "Chickpeas (tin)",   baseAmount: 400, baseUnit: "g",    currentUSD: 1.00 },
  { key: "stock",           label: "Chicken Stock",     baseAmount: 100, baseUnit: "ml",   currentUSD: 0.06 },
  { key: "soy sauce",       label: "Soy Sauce",         baseAmount: 15,  baseUnit: "ml",   currentUSD: 0.06 },
  { key: "tomato paste",    label: "Tomato Paste",      baseAmount: 15,  baseUnit: "ml",   currentUSD: 0.12 },
  { key: "honey",           label: "Honey",             baseAmount: 15,  baseUnit: "g",    currentUSD: 0.18 },
  { key: "sugar",           label: "Sugar",             baseAmount: 100, baseUnit: "g",    currentUSD: 0.08 },
] as const;

// POST /api/prices/refresh
// Body: { country?: string }
// Returns: { prices: Record<string, { priceUSD, baseAmount, baseUnit }>, refreshedAt: string }
router.post("/prices/refresh", async (req, res) => {
  const { country } = req.body as { country?: string };

  const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (!baseUrl || !apiKey) {
    return res.status(500).json({ error: "AI integration not configured" });
  }

  const countryNote = country
    ? `The family is based in ${country}. Still return prices in USD — the app will apply a local currency multiplier separately. Adjust the USD amounts to reflect typical grocery costs in that region relative to the US.`
    : "Return prices in USD based on typical US supermarket pricing.";

  const ingredientList = CATALOG
    .map(c => `  "${c.key}": { label: "${c.label}", baseAmount: ${c.baseAmount}, baseUnit: "${c.baseUnit}", currentBaselineUSD: ${c.currentUSD} }`)
    .join(",\n");

  const prompt = `You are a grocery pricing expert. Update the price estimates for the following common cooking ingredients.

${countryNote}

Return ONLY a valid JSON object — no markdown, no code fences, no explanation. The JSON must have exactly these keys (one per ingredient), each with a "priceUSD" number field representing the current realistic supermarket price for the given baseAmount and baseUnit.

Ingredients (key → details with current baseline for reference):
{
${ingredientList}
}

Your response must be a JSON object like:
{
  "chicken breast": { "priceUSD": 0.92 },
  "butter": { "priceUSD": 0.83 },
  ...
}

Only include "priceUSD" in each value. Do not change baseAmount or baseUnit — those are fixed.
Reflect realistic current-year grocery pricing. Make modest, realistic adjustments from the baselines.`;

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        system: "You are a grocery pricing expert. Always respond with valid JSON only — no markdown, no code fences, just raw JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", err);
      return res.status(response.status).json({ error: "AI request failed" });
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    const text = data.content?.[0]?.text ?? "";

    let parsed: Record<string, { priceUSD: number }>;
    try {
      // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      const clean = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Failed to parse Claude response:", text.slice(0, 500));
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    // Merge with catalog metadata to produce full price entries
    const prices: Record<string, { priceUSD: number; baseAmount: number; baseUnit: string }> = {};
    for (const item of CATALOG) {
      const aiEntry = parsed[item.key];
      const priceUSD = aiEntry?.priceUSD ?? item.currentUSD;
      prices[item.key] = {
        priceUSD: Math.max(0.001, Number(priceUSD) || item.currentUSD),
        baseAmount: item.baseAmount,
        baseUnit: item.baseUnit,
      };
    }

    return res.json({ prices, refreshedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Price refresh error:", err);
    return res.status(500).json({ error: "Price refresh failed" });
  }
});

export { CATALOG };
export default router;
