import { Router } from "express";

const router = Router();
const REQUIRE_MEAL_PHOTO_CREDITS = process.env.REQUIRE_MEAL_PHOTO_CREDITS === "true";

function getAiConfig() {
  const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  return { baseUrl, apiKey };
}

router.post("/ai", async (req, res) => {
  const { prompt, responseFormat } = req.body as { prompt: string; responseFormat?: string };
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const { baseUrl, apiKey } = getAiConfig();

  if (!baseUrl || !apiKey) {
    return res.status(500).json({ error: "AI integration not configured" });
  }

  try {
    const systemPrompt = responseFormat === "json"
      ? "You are a helpful assistant. Always respond with valid JSON only — no markdown, no code fences, just raw JSON."
      : "You are a helpful assistant.";

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    let text = data.content?.[0]?.text ?? "";

    if (responseFormat === "json") {
      // Strip markdown code fences Claude sometimes wraps around JSON
      const clean = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      try {
        const parsed = JSON.parse(clean);
        return res.json({ result: parsed });
      } catch {
        return res.json({ result: clean });
      }
    }

    return res.json({ result: text });
  } catch (err) {
    console.error("AI proxy error:", err);
    return res.status(500).json({ error: "AI request failed" });
  }
});

router.get("/barcode/:barcode", async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  if (!barcode) return res.status(400).json({ error: "barcode is required" });

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    if (!response.ok) return res.status(404).json({ error: "Product not found" });
    const data = await response.json() as {
      status: number;
      product?: Record<string, unknown>;
    };
    if (data.status !== 1 || !data.product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const p = data.product;
    const nutriments = (p.nutriments as Record<string, unknown> | undefined) ?? {};
    const servingSize = typeof p.serving_size === "string" ? p.serving_size : undefined;
    const productName = typeof p.product_name === "string" ? p.product_name : "Unknown product";
    const brand = typeof p.brands === "string" ? p.brands : undefined;

    const caloriesKcal = Number(nutriments["energy-kcal_serving"] ?? nutriments["energy-kcal_100g"] ?? 0);
    const protein = Number(nutriments["proteins_serving"] ?? nutriments["proteins_100g"] ?? 0);
    const carbs = Number(nutriments["carbohydrates_serving"] ?? nutriments["carbohydrates_100g"] ?? 0);
    const fat = Number(nutriments["fat_serving"] ?? nutriments["fat_100g"] ?? 0);

    return res.json({
      barcode,
      name: productName,
      brand,
      serving_size: servingSize,
      calories: Number.isFinite(caloriesKcal) ? Math.round(caloriesKcal) : 0,
      protein: Number.isFinite(protein) ? Math.round(protein) : 0,
      carbs: Number.isFinite(carbs) ? Math.round(carbs) : 0,
      fat: Number.isFinite(fat) ? Math.round(fat) : 0,
    });
  } catch {
    return res.status(500).json({ error: "Barcode lookup failed" });
  }
});

router.post("/ai/meal-photo/analyze", async (req, res) => {
  const { imageDataUrl, mealHint, creditsAvailable } = req.body as {
    imageDataUrl?: string;
    mealHint?: string;
    creditsAvailable?: number;
  };

  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "imageDataUrl is required" });
  }

  // Paid-feature wiring: disabled by default for rollout.
  if (REQUIRE_MEAL_PHOTO_CREDITS && (creditsAvailable ?? 0) < 1) {
    return res.status(402).json({ error: "Not enough credits for photo analysis" });
  }

  const { baseUrl, apiKey } = getAiConfig();
  if (!baseUrl || !apiKey) {
    return res.status(500).json({ error: "AI integration not configured" });
  }

  const mimeMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!mimeMatch) return res.status(400).json({ error: "Invalid imageDataUrl format" });
  const mediaType = mimeMatch[1];
  const base64Data = mimeMatch[2];

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
        max_tokens: 1500,
        system: "Estimate meal nutrition from images. Respond with valid JSON only.",
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `Analyze this meal photo. ${mealHint ? `Meal hint: ${mealHint}. ` : ""}Return strict JSON:
{"meal_name":string,"calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number,"notes":string}`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    const raw = data.content?.[0]?.text ?? "";
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return res.json({
      result: {
        meal_name: String(parsed.meal_name ?? mealHint ?? "Scanned meal"),
        calories: Math.round(Number(parsed.calories ?? 0)),
        protein: Math.round(Number(parsed.protein ?? 0)),
        carbs: Math.round(Number(parsed.carbs ?? 0)),
        fat: Math.round(Number(parsed.fat ?? 0)),
        confidence: Number(parsed.confidence ?? 0),
        notes: String(parsed.notes ?? ""),
      },
      creditsRequired: REQUIRE_MEAL_PHOTO_CREDITS,
    });
  } catch (err) {
    console.error("Meal photo analysis error:", err);
    return res.status(500).json({ error: "Meal photo analysis failed" });
  }
});

export default router;
