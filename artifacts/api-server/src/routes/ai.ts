import { Router } from "express";

const router = Router();

router.post("/ai", async (req, res) => {
  const { prompt, responseFormat } = req.body as { prompt: string; responseFormat?: string };
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const baseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

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
        model: "claude-3-5-haiku-20241022",
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
    const text = data.content?.[0]?.text ?? "";

    if (responseFormat === "json") {
      try {
        const parsed = JSON.parse(text);
        return res.json({ result: parsed });
      } catch {
        return res.json({ result: text });
      }
    }

    return res.json({ result: text });
  } catch (err) {
    console.error("AI proxy error:", err);
    return res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
