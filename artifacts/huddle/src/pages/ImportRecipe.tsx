import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Link as LinkIcon, FileText, Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";

// ── AI extraction via our proxy ───────────────────────────────────────────────

const RECIPE_JSON_SCHEMA = `Return ONLY a valid JSON object with these fields:
- name (string)
- emoji (1 relevant food emoji)
- photo_color (hex color matching the dish, e.g. "#E8A87C")
- cuisine (string, e.g. "Italian", "Asian")
- cook_time (number, total minutes)
- servings (number)
- calories (number per serving)
- protein (number grams per serving)
- carbs (number grams per serving)
- fat (number grams per serving)
- vegetarian (boolean)
- ingredients (array of { name: string, amount: string, category: string })
  categories: "meat","seafood","dairy","vegetables","fruit","grains","condiments","herbs","other"
- method (array of clear step strings)
- chef_tip (string, a useful tip)
- meal_slots (array of: "breakfast","lunch","dinner")

Return ONLY the JSON. No markdown, no explanation.`;

async function extractRecipeWithAi(content: string): Promise<Record<string, unknown>> {
  const prompt = `You are a recipe extraction expert. Extract the recipe from the following text and return a JSON object.

${RECIPE_JSON_SCHEMA}

Content:
${content}`;

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, responseFormat: "json" }),
  });
  if (!res.ok) throw new Error("AI extraction failed");
  const data = await res.json() as { result: unknown };
  const result = data.result;
  if (typeof result === "string") return JSON.parse(result);
  return result as Record<string, unknown>;
}

async function extractRecipeFromUrlWithAi(url: string): Promise<Record<string, unknown>> {
  const prompt = `A user wants to import a recipe from this URL: ${url}

You cannot browse the web, but you may recognise this recipe from your training data. Please provide the full recipe as a JSON object.
If you recognise the recipe (even partially), include every detail you know.
If you do not recognise this specific URL, try to infer the recipe from the URL path (e.g. "easy-meatloaf" tells you what the dish is) and provide a solid version of that recipe.

${RECIPE_JSON_SCHEMA}`;

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, responseFormat: "json" }),
  });
  if (!res.ok) throw new Error("AI extraction failed");
  const data = await res.json() as { result: unknown };
  const result = data.result;
  if (typeof result === "string") return JSON.parse(result);
  return result as Record<string, unknown>;
}

// ── Normalise AI output so every field has the correct JS type ────────────────
// Claude sometimes returns strings as 1-element arrays, numbers as strings, etc.

function toStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v[0] ? String(v[0]) : undefined;
  return String(v);
}

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : Math.round(n);
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return Boolean(v);
}

function normalizeImported(raw: Record<string, unknown>): Record<string, unknown> {
  // Ingredients: ensure each item is {name, amount, category} with string values
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((ing: unknown) => {
    const i = (typeof ing === "object" && ing !== null ? ing : { name: String(ing) }) as Record<string, unknown>;
    return { name: toStr(i.name) ?? "", amount: toStr(i.amount) ?? "", category: toStr(i.category) ?? "other" };
  });

  // Method: ensure array of strings
  const method = (Array.isArray(raw.method) ? raw.method : []).map((s: unknown) => String(s));

  // meal_slots: ensure array of strings
  const meal_slots = Array.isArray(raw.meal_slots) ? raw.meal_slots.map(String) : ["dinner"];

  return {
    name:        toStr(raw.name)        ?? "Imported Recipe",
    emoji:       toStr(raw.emoji)       ?? "🍽",
    photo_color: toStr(raw.photo_color) ?? "#639922",
    cuisine:     toStr(raw.cuisine),
    cook_time:   toNum(raw.cook_time),
    servings:    toNum(raw.servings),
    calories:    toNum(raw.calories),
    protein:     toNum(raw.protein),
    carbs:       toNum(raw.carbs),
    fat:         toNum(raw.fat),
    vegetarian:  toBool(raw.vegetarian),
    chef_tip:    toStr(raw.chef_tip),
    ingredients,
    method,
    meal_slots,
  };
}

// ── Status indicator ──────────────────────────────────────────────────────────

type Phase = "idle" | "fetching" | "extracting" | "done" | "error";

function StatusBar({ phase, error }: { phase: Phase; error?: string }) {
  if (phase === "idle") return null;

  const config = {
    fetching:   { icon: <Loader2 size={16} className="animate-spin" />, msg: "Fetching recipe page…",         cls: "bg-blue-50 border-blue-200 text-blue-700" },
    extracting: { icon: <Loader2 size={16} className="animate-spin" />, msg: "Extracting recipe with AI…",    cls: "bg-primary/5 border-primary/20 text-primary" },
    done:       { icon: <CheckCircle2 size={16} />,                      msg: "Recipe imported successfully!", cls: "bg-green-50 border-green-200 text-green-700" },
    error:      { icon: <AlertCircle size={16} />,                       msg: error ?? "Something went wrong", cls: "bg-red-50 border-red-200 text-red-700" },
  }[phase];

  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${config.cls}`}>
      {config.icon}
      <span>{config.msg}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportRecipe() {
  const [, setLocation] = useLocation();
  const { familyGroup } = useFamilyStore();
  const { addRecipe }   = useRecipeStore();

  const [tab, setTab]     = useState<"url" | "text">("url");
  const [url, setUrl]     = useState("");
  const [text, setText]   = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | undefined>();

  const isLoading = phase === "fetching" || phase === "extracting";

  const handleImport = async () => {
    if (isLoading) return;
    setError(undefined);

    // ── Text mode: send straight to AI ───────────────────────────────────────
    if (tab === "text") {
      if (!text.trim()) return;
      setPhase("extracting");
      try {
        const parsed = await extractRecipeWithAi(text.trim());
        const recipe = addRecipe({
          ...normalizeImported(parsed),
          family_code: familyGroup!.code,
          imported: true,
        });
        setPhase("done");
        setTimeout(() => setLocation(`/recipe/${recipe.id}`), 600);
      } catch {
        setPhase("error");
        setError("Could not extract recipe from that text. Try pasting more of the recipe.");
      }
      return;
    }

    // ── URL mode: scrape first, then AI if needed ─────────────────────────────
    if (!url.trim() || !/^https?:\/\//i.test(url.trim())) {
      setPhase("error");
      setError("Please enter a valid URL starting with https://");
      return;
    }

    try {
      // Step 1: fetch the page server-side
      setPhase("fetching");
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const scrapeData = await scrapeRes.json() as {
        error?: string;
        recipe?: Record<string, unknown>;
        content?: string;
        blocked?: boolean;
        source?: string;
      };

      if (!scrapeRes.ok || scrapeData.error) {
        throw new Error(scrapeData.error ?? "Could not fetch that page");
      }

      let parsed: Record<string, unknown>;

      if (scrapeData.recipe) {
        // JSON-LD found — no AI call needed
        parsed = scrapeData.recipe;
        setPhase("extracting"); // brief flash to show progress
        await new Promise(r => setTimeout(r, 400));
      } else if (scrapeData.content) {
        // Scraped text — AI extracts
        setPhase("extracting");
        parsed = await extractRecipeWithAi(scrapeData.content);
      } else if (scrapeData.blocked) {
        // Site blocked our scraper — ask Claude from training knowledge
        setPhase("extracting");
        parsed = await extractRecipeFromUrlWithAi(url.trim());
      } else {
        throw new Error("Could not read content from that page. Try pasting the recipe text instead.");
      }

      const recipe = addRecipe({
        ...normalizeImported(parsed),
        family_code: familyGroup!.code,
        imported: true,
        source_url: url.trim(),
      });

      setPhase("done");
      setTimeout(() => setLocation(`/recipe/${recipe.id}`), 600);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setPhase("error");
      setError(msg);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-display font-bold">Import Recipe</h1>
      </header>

      <div className="p-6 flex-1 flex flex-col gap-5">

        {/* Tabs */}
        <div className="flex bg-secondary p-1 rounded-xl">
          <button
            onClick={() => { setTab("url"); setPhase("idle"); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${tab === "url" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            <LinkIcon size={16} /> URL
          </button>
          <button
            onClick={() => { setTab("text"); setPhase("idle"); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${tab === "text" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
          >
            <FileText size={16} /> Paste Text
          </button>
        </div>

        {/* Input */}
        {tab === "url" ? (
          <div className="space-y-2">
            <Input
              placeholder="https://cooking-site.com/recipe"
              value={url}
              onChange={e => { setUrl(e.target.value); if (phase === "error") setPhase("idle"); }}
              autoFocus
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground px-1">
              Works best with popular recipe sites — AllRecipes, Taste, BBC Good Food, Serious Eats, NYT Cooking, and many more.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full h-52 bg-white border-2 border-border rounded-xl p-4 text-sm focus:outline-none focus:border-primary resize-none"
              placeholder="Paste the full recipe text here — ingredients, method steps, any details you have…"
              value={text}
              onChange={e => { setText(e.target.value); if (phase === "error") setPhase("idle"); }}
              autoFocus
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground px-1">
              Copy the recipe from anywhere — a website, a message, a screenshot's text. The more detail, the better.
            </p>
          </div>
        )}

        {/* Status bar */}
        <StatusBar phase={phase} error={error} />

        {/* How it works */}
        {phase === "idle" && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 border-dashed">
            <h4 className="font-semibold text-primary text-sm mb-1.5">How it works</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {tab === "url" ? (
                <>
                  <li>• We fetch the recipe page and read structured recipe data automatically</li>
                  <li>• If the site doesn't allow direct access, AI uses its training knowledge about the recipe</li>
                  <li>• Ingredients, steps, nutrition, and cook time are all extracted</li>
                  <li>• You can edit any details after it's saved to your library</li>
                </>
              ) : (
                <>
                  <li>• Paste any recipe text — structured or free-form</li>
                  <li>• AI identifies ingredients, amounts, and method steps</li>
                  <li>• Nutrition estimates are added automatically</li>
                  <li>• You can edit anything after it's imported</li>
                </>
              )}
            </ul>
          </div>
        )}

        {/* Retry hint */}
        {phase === "error" && tab === "url" && (
          <button
            onClick={() => { setTab("text"); setPhase("idle"); }}
            className="text-sm text-primary underline text-center"
          >
            Try pasting the recipe text instead
          </button>
        )}

        <div className="mt-auto">
          <Button
            className="w-full"
            size="lg"
            onClick={handleImport}
            disabled={isLoading || phase === "done" || (tab === "url" ? !url.trim() : !text.trim())}
          >
            {isLoading ? (
              <><Loader2 size={18} className="mr-2 animate-spin" /> {phase === "fetching" ? "Fetching…" : "Extracting…"}</>
            ) : (
              <><Download size={18} className="mr-2" /> Import Recipe</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
