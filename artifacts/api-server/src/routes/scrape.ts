import { Router } from "express";

const router = Router();

// ── HTML helpers ──────────────────────────────────────────────────────────────

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(html: string): string {
  // Remove scripts, styles, nav, header, footer sections entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  // Convert block tags to newlines
  text = text.replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode entities, normalise whitespace
  text = decodeEntities(text);
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// Extract JSON-LD Recipe schema from HTML
function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const scriptMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1].trim()) as Record<string, unknown>;
      // Could be an array or have @graph
      const items: unknown[] = Array.isArray(data)
        ? data
        : data["@graph"]
          ? (data["@graph"] as unknown[])
          : [data];

      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t: unknown) => typeof t === "string" && t.toLowerCase().includes("recipe"))) {
          return obj;
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

// Map Schema.org Recipe to our recipe structure
function mapJsonLdToRecipe(ld: Record<string, unknown>): Record<string, unknown> {
  const name = (ld.name as string) ?? "Imported Recipe";

  // Ingredients
  const rawIngredients = (ld.recipeIngredient as string[]) ?? [];
  const ingredients = rawIngredients.map((line: string) => {
    // Try to split "200g chicken breast" into amount + name
    const m = line.match(/^([\d\s½¼¾⅓⅔.,/]+(?:g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|tablespoon|teaspoon|piece|pieces|can|cans|clove|cloves|sprig|sprigs|bunch|slice|slices)?\.?)\s+(.+)$/i);
    if (m) return { amount: m[1].trim(), name: m[2].trim() };
    return { name: line.trim() };
  });

  // Method
  const rawInstructions = ld.recipeInstructions ?? [];
  let method: string[] = [];
  if (Array.isArray(rawInstructions)) {
    method = rawInstructions.map((step: unknown) => {
      if (typeof step === "string") return step;
      const s = step as Record<string, unknown>;
      return (s.text as string) ?? (s.name as string) ?? String(step);
    }).filter(Boolean);
  } else if (typeof rawInstructions === "string") {
    method = rawInstructions.split("\n").filter(Boolean);
  }

  // Nutrition
  const nutrition = (ld.nutrition as Record<string, string>) ?? {};
  const parseNutrition = (val: string | undefined): number | undefined => {
    if (!val) return undefined;
    const m = String(val).match(/[\d.]+/);
    return m ? Math.round(parseFloat(m[0])) : undefined;
  };

  // Cook time (PT15M → 15, PT1H30M → 90)
  const parseDuration = (iso: string | undefined): number | undefined => {
    if (!iso) return undefined;
    const h = iso.match(/(\d+)H/i)?.[1] ?? "0";
    const m = iso.match(/(\d+)M/i)?.[1] ?? "0";
    const total = parseInt(h) * 60 + parseInt(m);
    return total > 0 ? total : undefined;
  };

  const cookTime = parseDuration(ld.cookTime as string ?? ld.totalTime as string);
  const servings = (() => {
    const s = ld.recipeYield;
    if (!s) return undefined;
    const raw = Array.isArray(s) ? s[0] : s;
    const m = String(raw).match(/\d+/);
    return m ? parseInt(m[0]) : undefined;
  })();

  const image = (() => {
    const img = ld.image;
    if (!img) return undefined;
    if (typeof img === "string") return img;
    if (Array.isArray(img)) return (img[0] as string | Record<string, string>);
    if (typeof img === "object") return (img as Record<string, string>).url;
    return undefined;
  })();

  return {
    name,
    cuisine: (ld.recipeCuisine as string) ?? undefined,
    cook_time: cookTime,
    servings,
    calories:  parseNutrition(nutrition.calories),
    protein:   parseNutrition(nutrition.proteinContent),
    carbs:     parseNutrition(nutrition.carbohydrateContent),
    fat:       parseNutrition(nutrition.fatContent),
    ingredients,
    method,
    chef_tip: undefined as string | undefined,
    vegetarian: (ld.suitableForDiet as string)?.toLowerCase().includes("vegetarian"),
    image_url: typeof image === "string" ? image : undefined,
    _source: "json-ld",
  };
}

// POST /api/scrape
// Body: { url: string }
// Returns: { recipe?: object, content?: string, error?: string }
router.post("/scrape", async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A valid http/https URL is required" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      // 401/402/403/429 = bot-blocked; tell the client to try AI-with-URL fallback
      if ([401, 402, 403, 429].includes(response.status)) {
        return res.json({ blocked: true, source: "blocked" });
      }
      return res.status(422).json({ error: `Could not fetch that URL (HTTP ${response.status})` });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return res.status(422).json({ error: "URL does not appear to be a webpage" });
    }

    const html = await response.text();

    // Try JSON-LD first — fast, reliable, no AI needed
    const jsonLd = extractJsonLdRecipe(html);
    if (jsonLd) {
      const recipe = mapJsonLdToRecipe(jsonLd);
      return res.json({ recipe, source: "json-ld" });
    }

    // Fall back: strip HTML and return text for AI extraction
    const text = stripHtml(html);
    // Trim to a sensible size for the AI prompt (approx 6000 chars)
    const trimmed = text.length > 6000 ? text.slice(0, 6000) + "\n[content truncated]" : text;

    return res.json({ content: trimmed, source: "text" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return res.status(504).json({ error: "The page took too long to load. Try pasting the recipe text instead." });
    }
    console.error("Scrape error:", msg);
    return res.status(500).json({ error: "Could not reach that URL. Try pasting the recipe text instead." });
  }
});

export default router;
