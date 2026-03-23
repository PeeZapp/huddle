const BASE_URL = process.env.EXPO_PUBLIC_AI_BASE_URL ?? "";
const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY ?? "";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function callClaude(
  prompt: string,
  systemPrompt?: string,
  maxTokens = 4096
): Promise<string> {
  const messages: Message[] = [{ role: "user", content: prompt }];
  const body: Record<string, unknown> = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: maxTokens,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI call failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.content?.[0];
  if (content?.type === "text") return content.text;
  throw new Error("Unexpected AI response format");
}

export async function callClaudeJSON<T>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const fullPrompt = `${prompt}\n\nRespond ONLY with valid JSON, no markdown, no explanation.`;
  const text = await callClaude(fullPrompt, systemPrompt);
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(clean) as T;
}
