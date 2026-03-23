import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Link as LinkIcon, FileText, Download,
  AlertCircle, Loader2, CheckCircle2, ShieldCheck, Sparkles,
  Clock, Users, UtensilsCrossed, BookOpen, RotateCcw, Save,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useRecipeStore, useFamilyStore } from "@/stores/huddle-stores";

// ── AI helpers ────────────────────────────────────────────────────────────────

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

async function callAi(prompt: string): Promise<Record<string, unknown>> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, responseFormat: "json" }),
  });
  if (!res.ok) throw new Error("AI request failed");
  const data = await res.json() as { result: unknown };
  const result = data.result;
  if (typeof result === "string") return JSON.parse(result);
  return result as Record<string, unknown>;
}

async function extractFromText(content: string) {
  return callAi(
    `You are a recipe extraction expert. Extract the recipe from the following text.\n\n${RECIPE_JSON_SCHEMA}\n\nContent:\n${content}`
  );
}

async function extractFromUrl(url: string) {
  return callAi(
    `A user wants to import a recipe from this URL: ${url}\n\nYou cannot browse the web, but you may recognise this recipe from your training data. Please provide the full recipe.\nIf you recognise it (even partially), include every detail you know.\nIf you do not recognise this specific URL, infer the dish from the URL path and provide a solid version.\n\n${RECIPE_JSON_SCHEMA}`
  );
}

// ── Normaliser ────────────────────────────────────────────────────────────────

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

function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((ing: unknown) => {
    const i = (typeof ing === "object" && ing !== null ? ing : { name: String(ing) }) as Record<string, unknown>;
    return { name: toStr(i.name) ?? "", amount: toStr(i.amount) ?? "", category: toStr(i.category) ?? "other" };
  });
  const method     = (Array.isArray(raw.method) ? raw.method : []).map((s: unknown) => String(s));
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

// ── Source types ──────────────────────────────────────────────────────────────

type Source =
  | "json-ld"        // structured data read directly from the site
  | "text-scraped"   // AI extracted from scraped page text
  | "blocked-ai"     // site blocked us; AI used training knowledge
  | "text-paste";    // AI extracted from user-pasted text

function SourceDisclaimer({ source, domain }: { source: Source; domain?: string }) {
  const configs: Record<Source, { icon: React.ReactNode; label: string; sub: string; cls: string }> = {
    "json-ld": {
      icon: <ShieldCheck size={16} />,
      label: "Exact recipe data",
      sub: `Read directly from ${domain ?? "the original site"} — ingredients and steps match the source.`,
      cls: "bg-green-50 border-green-200 text-green-800",
    },
    "text-scraped": {
      icon: <ShieldCheck size={16} />,
      label: "Extracted from page",
      sub: "AI read the page text and structured it — minor wording differences from the original are possible.",
      cls: "bg-blue-50 border-blue-200 text-blue-800",
    },
    "blocked-ai": {
      icon: <Sparkles size={16} />,
      label: "AI reconstruction",
      sub: `${domain ?? "This site"} doesn't allow direct access. The recipe below is based on AI training knowledge — please check the amounts and steps before cooking.`,
      cls: "bg-amber-50 border-amber-300 text-amber-800",
    },
    "text-paste": {
      icon: <ShieldCheck size={16} />,
      label: "Extracted from your text",
      sub: "AI structured the recipe from what you pasted — review it and edit anything that looks off.",
      cls: "bg-blue-50 border-blue-200 text-blue-800",
    },
  };

  const c = configs[source];
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-sm ${c.cls}`}>
      <span className="mt-0.5 shrink-0">{c.icon}</span>
      <div>
        <p className="font-semibold leading-snug">{c.label}</p>
        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{c.sub}</p>
      </div>
    </div>
  );
}

// ── Recipe preview card ───────────────────────────────────────────────────────

function RecipePreview({ recipe }: { recipe: Record<string, unknown> }) {
  const color   = (recipe.photo_color as string) || "#639922";
  const name    = (recipe.name as string) || "Imported Recipe";
  const emoji   = (recipe.emoji as string) || "🍽";
  const cuisine = recipe.cuisine as string | undefined;
  const cookTime = recipe.cook_time as number | undefined;
  const servings = recipe.servings as number | undefined;
  const ingredients = (recipe.ingredients as unknown[]) ?? [];
  const method      = (recipe.method as unknown[]) ?? [];
  const calories    = recipe.calories as number | undefined;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm">
      {/* Colour header */}
      <div className="flex items-end gap-3 p-5 pb-4" style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
        <span className="text-5xl leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-display font-bold leading-tight">{name}</h2>
          {cuisine && <p className="text-sm text-muted-foreground mt-0.5">{cuisine}</p>}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex border-t border-border divide-x divide-border">
        {cookTime !== undefined && (
          <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
            <Clock size={15} className="text-muted-foreground" />
            <span className="text-xs font-semibold">{cookTime} min</span>
          </div>
        )}
        {servings !== undefined && (
          <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
            <Users size={15} className="text-muted-foreground" />
            <span className="text-xs font-semibold">{servings} serves</span>
          </div>
        )}
        {calories !== undefined && (
          <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
            <span className="text-xs text-muted-foreground leading-none">cal</span>
            <span className="text-xs font-semibold">{calories}</span>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
          <UtensilsCrossed size={15} className="text-muted-foreground" />
          <span className="text-xs font-semibold">{ingredients.length} ingr.</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3 gap-0.5">
          <BookOpen size={15} className="text-muted-foreground" />
          <span className="text-xs font-semibold">{method.length} steps</span>
        </div>
      </div>

      {/* Ingredients preview */}
      {ingredients.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ingredients</p>
          <ul className="space-y-1">
            {(ingredients as Array<{ name: string; amount: string }>).slice(0, 6).map((ing, i) => (
              <li key={i} className="text-sm flex justify-between">
                <span>{ing.name}</span>
                <span className="text-muted-foreground ml-2 shrink-0">{ing.amount}</span>
              </li>
            ))}
            {ingredients.length > 6 && (
              <li className="text-xs text-muted-foreground">+{ingredients.length - 6} more ingredients</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Loading / error bar ───────────────────────────────────────────────────────

type Phase = "idle" | "fetching" | "extracting" | "preview" | "saving" | "done" | "error";

function StatusBar({ phase, error }: { phase: Phase; error?: string }) {
  if (phase === "idle" || phase === "preview") return null;
  const configs = {
    fetching:   { icon: <Loader2 size={16} className="animate-spin" />, msg: "Fetching recipe page…",         cls: "bg-blue-50 border-blue-200 text-blue-700" },
    extracting: { icon: <Loader2 size={16} className="animate-spin" />, msg: "Extracting recipe with AI…",    cls: "bg-primary/5 border-primary/20 text-primary" },
    saving:     { icon: <Loader2 size={16} className="animate-spin" />, msg: "Saving to your library…",       cls: "bg-primary/5 border-primary/20 text-primary" },
    done:       { icon: <CheckCircle2 size={16} />,                      msg: "Recipe saved!",                 cls: "bg-green-50 border-green-200 text-green-700" },
    error:      { icon: <AlertCircle size={16} />,                       msg: error ?? "Something went wrong", cls: "bg-red-50 border-red-200 text-red-700" },
  } as Record<string, { icon: React.ReactNode; msg: string; cls: string }>;

  const c = configs[phase];
  if (!c) return null;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${c.cls}`}>
      {c.icon}
      <span>{c.msg}</span>
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

  // Preview state
  const [previewData,  setPreviewData]  = useState<Record<string, unknown> | null>(null);
  const [previewSource, setPreviewSource] = useState<Source>("text-paste");
  const [previewDomain, setPreviewDomain] = useState<string | undefined>();
  const [sourceUrl, setSourceUrl]       = useState<string | undefined>();

  const isLoading = phase === "fetching" || phase === "extracting" || phase === "saving";

  // ── Reset to the input form ────────────────────────────────────────────────
  const handleStartOver = () => {
    setPhase("idle");
    setPreviewData(null);
    setError(undefined);
  };

  // ── Step 1: extract (no save yet) ─────────────────────────────────────────
  const handleExtract = async () => {
    if (isLoading) return;
    setError(undefined);

    // Text mode
    if (tab === "text") {
      if (!text.trim()) return;
      setPhase("extracting");
      try {
        const raw    = await extractFromText(text.trim());
        const parsed = normalize(raw);
        setPreviewData(parsed);
        setPreviewSource("text-paste");
        setPreviewDomain(undefined);
        setSourceUrl(undefined);
        setPhase("preview");
      } catch {
        setPhase("error");
        setError("Could not extract recipe from that text. Try pasting more of the recipe.");
      }
      return;
    }

    // URL mode
    if (!url.trim() || !/^https?:\/\//i.test(url.trim())) {
      setPhase("error");
      setError("Please enter a valid URL starting with https://");
      return;
    }

    const trimmedUrl = url.trim();
    let domain: string | undefined;
    try { domain = new URL(trimmedUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

    try {
      setPhase("fetching");
      const scrapeRes  = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const scrapeData = await scrapeRes.json() as {
        error?: string;
        recipe?: Record<string, unknown>;
        content?: string;
        blocked?: boolean;
      };

      if (!scrapeRes.ok || scrapeData.error) {
        throw new Error(scrapeData.error ?? "Could not fetch that page");
      }

      let raw: Record<string, unknown>;
      let src: Source;

      if (scrapeData.recipe) {
        raw = scrapeData.recipe;
        src = "json-ld";
        setPhase("extracting");
        await new Promise(r => setTimeout(r, 300)); // brief pause so user sees the step
      } else if (scrapeData.content) {
        setPhase("extracting");
        raw = await extractFromText(scrapeData.content);
        src = "text-scraped";
      } else if (scrapeData.blocked) {
        setPhase("extracting");
        raw = await extractFromUrl(trimmedUrl);
        src = "blocked-ai";
      } else {
        throw new Error("Could not read content from that page. Try pasting the recipe text instead.");
      }

      const parsed = normalize(raw);
      setPreviewData(parsed);
      setPreviewSource(src);
      setPreviewDomain(domain);
      setSourceUrl(trimmedUrl);
      setPhase("preview");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setPhase("error");
      setError(msg);
    }
  };

  // ── Step 2: save (after preview confirmation) ──────────────────────────────
  const handleSave = () => {
    if (!previewData || !familyGroup) return;
    setPhase("saving");
    try {
      const recipe = addRecipe({
        ...previewData,
        family_code: familyGroup.code,
        imported: true,
        source_url: sourceUrl,
      });
      setPhase("done");
      setTimeout(() => setLocation(`/recipe/${recipe.id}`), 500);
    } catch {
      setPhase("error");
      setError("Could not save the recipe. Please try again.");
    }
  };

  // ── Preview screen ─────────────────────────────────────────────────────────
  if (phase === "preview" && previewData) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
          <button onClick={handleStartOver} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-display font-bold">Review Recipe</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-36">
          <SourceDisclaimer source={previewSource} domain={previewDomain} />
          <RecipePreview recipe={previewData} />
        </div>

        {/* Sticky footer with action buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 space-y-2.5 z-20">
          <Button className="w-full" size="lg" onClick={handleSave}>
            <Save size={18} className="mr-2" /> Save to Library
          </Button>
          <button
            onClick={handleStartOver}
            className="w-full py-3 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
          >
            <RotateCcw size={15} /> Discard &amp; start over
          </button>
        </div>
      </div>
    );
  }

  // ── Input screen ──────────────────────────────────────────────────────────
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
              Works with AllRecipes, Taste, BBC Good Food, Serious Eats, NYT Cooking, and many more.
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
              Copy from a website, a message, a screenshot — the more detail, the better.
            </p>
          </div>
        )}

        <StatusBar phase={phase} error={error} />

        {/* How it works */}
        {phase === "idle" && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 border-dashed">
            <h4 className="font-semibold text-primary text-sm mb-1.5">How it works</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {tab === "url" ? (
                <>
                  <li>• We fetch the recipe page and read structured data automatically</li>
                  <li>• If the site blocks access, AI uses its knowledge to fill in the details</li>
                  <li>• You'll see a preview with a source label before anything is saved</li>
                  <li>• You can edit any details from the recipe page after saving</li>
                </>
              ) : (
                <>
                  <li>• Paste any recipe text — structured or free-form</li>
                  <li>• AI identifies ingredients, amounts, and method steps</li>
                  <li>• You'll see a preview before anything is saved</li>
                  <li>• You can edit any details from the recipe page after saving</li>
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
            onClick={handleExtract}
            disabled={isLoading || (tab === "url" ? !url.trim() : !text.trim())}
          >
            {isLoading ? (
              <><Loader2 size={18} className="mr-2 animate-spin" /> {phase === "fetching" ? "Fetching…" : "Extracting…"}</>
            ) : (
              <><Download size={18} className="mr-2" /> Extract Recipe</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
