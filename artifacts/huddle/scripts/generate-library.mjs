#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const MEAL_SLOTS = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "night_snack", "dessert"];
const CATEGORIES = ["meat", "seafood", "dairy", "vegetables", "fruit", "grains", "condiments", "herbs", "other"];
const CUISINES = [
  "Mediterranean", "Italian", "French", "Spanish", "Greek", "Middle Eastern",
  "Indian", "Thai", "Vietnamese", "Chinese", "Japanese", "Korean",
  "Mexican", "Latin American", "American", "British", "Nordic", "African",
];

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseSlotArg(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => MEAL_SLOTS.includes(s));
}

function randOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s) {
  return normalizeName(s).replace(/\s+/g, "_").slice(0, 40) || "recipe";
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function parseJsonResult(raw) {
  if (typeof raw === "object" && raw !== null) return raw;
  if (typeof raw !== "string") throw new Error("AI returned non-string/object result");
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const arrMatch = candidate.match(/\[[\s\S]*\]/);
  const objMatch = candidate.match(/\{[\s\S]*\}/);
  const payload = arrMatch ? arrMatch[0] : (objMatch ? objMatch[0] : candidate);
  try {
    return JSON.parse(payload);
  } catch {
    // Common LLM hiccup: trailing commas before } or ]
    const repaired = payload.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired);
  }
}

function normalizeRecipe(raw, i, existingCount, forcedSlots = []) {
  const obj = typeof raw === "object" && raw ? raw : {};
  const name = String(obj.name ?? "").trim();
  if (!name) return null;
  const ingredients = Array.isArray(obj.ingredients) ? obj.ingredients : [];
  const method = Array.isArray(obj.method) ? obj.method : [];
  if (ingredients.length < 4 || method.length < 3) return null;

  const mealSlotsRaw = Array.isArray(obj.meal_slots) ? obj.meal_slots.map((s) => String(s)) : ["dinner"];
  const mealSlots = mealSlotsRaw.filter((s) => MEAL_SLOTS.includes(s));
  const pickSlot = forcedSlots.length
    ? [randOf(forcedSlots)]
    : (mealSlots.length ? mealSlots : [randOf(MEAL_SLOTS)]);

  const recipe = {
    id: `seed_${pickSlot[0]}_${existingCount + i + 1}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    emoji: String(obj.emoji ?? "🍽️"),
    photo_color: String(obj.photo_color ?? "#639922"),
    cuisine: String(obj.cuisine ?? randOf(CUISINES)),
    cook_time: Math.max(5, toInt(obj.cook_time, 30)),
    servings: Math.max(1, toInt(obj.servings, 4)),
    calories: Math.max(60, toInt(obj.calories, 450)),
    protein: Math.max(0, toInt(obj.protein, 20)),
    carbs: Math.max(0, toInt(obj.carbs, 35)),
    fat: Math.max(0, toInt(obj.fat, 15)),
    vegetarian: Boolean(obj.vegetarian),
    ingredients: ingredients
      .map((ing) => {
        const it = typeof ing === "object" && ing ? ing : {};
        const ingName = String(it.name ?? "").trim();
        if (!ingName) return null;
        const cat = String(it.category ?? "other");
        return {
          name: ingName,
          amount: String(it.amount ?? ""),
          category: CATEGORIES.includes(cat) ? cat : "other",
        };
      })
      .filter(Boolean),
    method: method.map((m) => String(m).trim()).filter(Boolean),
    chef_tip: String(obj.chef_tip ?? ""),
    notes: String(obj.notes ?? ""),
    meal_slots: pickSlot,
    source_url: "",
    imported: false,
    family_code: "__seed__",
    created_at: new Date().toISOString(),
  };

  if (recipe.ingredients.length < 4 || recipe.method.length < 3) return null;
  return recipe;
}

async function callAi(apiUrl, prompt) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, responseFormat: "json" }),
  });
  if (!res.ok) {
    throw new Error(`AI HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJsonResult(data.result);
}

function buildPrompt(batchSize, avoidNames, allowedSlots) {
  const cuisines = shuffle(CUISINES).slice(0, 8);
  const slots = allowedSlots.length ? allowedSlots : shuffle(MEAL_SLOTS).slice(0, 5);
  return `Generate ${batchSize} unique family-friendly recipes as a JSON array.

Requirements:
- Diverse cuisines, cooking methods, and ingredient profiles.
- Use meal slots from: ${slots.join(", ")}.
- Prefer cuisines from: ${cuisines.join(", ")}.
- Exclude these existing names (case-insensitive): ${avoidNames.join("; ") || "none"}.

Output schema for EACH recipe object:
{
  "name": string,
  "emoji": "single emoji",
  "photo_color": "hex color",
  "cuisine": string,
  "cook_time": number,
  "servings": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "vegetarian": boolean,
  "ingredients": [{ "name": string, "amount": string, "category": "meat|seafood|dairy|vegetables|fruit|grains|condiments|herbs|other" }],
  "method": [string, string, ...],
  "chef_tip": string,
  "notes": string,
  "meal_slots": [${MEAL_SLOTS.map((s) => `"${s}"`).join(", ")}]
}
Constraints:
- 6-14 ingredients.
- 4-9 method steps.
- No markdown. Return raw JSON array only.`;
}

function buildSinglePrompt(avoidNames, allowedSlots) {
  const slotList = allowedSlots.length ? allowedSlots : MEAL_SLOTS;
  const cuisines = shuffle(CUISINES).slice(0, 6);
  return `Generate ONE unique family-friendly recipe as a single JSON object.

Requirements:
- Use meal slot from: ${slotList.join(", ")}.
- Prefer cuisines from: ${cuisines.join(", ")}.
- Exclude these existing names (case-insensitive): ${avoidNames.join("; ") || "none"}.

Output schema:
{
  "name": string,
  "emoji": "single emoji",
  "photo_color": "hex color",
  "cuisine": string,
  "cook_time": number,
  "servings": number,
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "vegetarian": boolean,
  "ingredients": [{ "name": string, "amount": string, "category": "meat|seafood|dairy|vegetables|fruit|grains|condiments|herbs|other" }],
  "method": [string, string, ...],
  "chef_tip": string,
  "notes": string,
  "meal_slots": [${MEAL_SLOTS.map((s) => `"${s}"`).join(", ")}]
}

Constraints:
- 6-14 ingredients.
- 4-9 method steps.
- No markdown. Return raw JSON object only.`;
}

async function main() {
  const cwd = process.cwd();
  const seedPath = path.resolve(cwd, getArg("--seed", "public/seed-recipes.json"));
  const outPath = path.resolve(cwd, getArg("--out", seedPath));
  const count = Math.max(1, Number(
    getArg("--count", process.env.npm_config_count ?? process.argv[2] ?? "60"),
  ));
  const batchSize = Math.max(1, Math.min(20, Number(
    getArg("--batch-size", process.env.npm_config_batch_size ?? "10"),
  )));
  const apiUrl = getArg("--api-url", "http://localhost:8080/api/ai");
  const dryRun = hasFlag("--dry-run");
  const slotArg = getArg("--slot", process.env.npm_config_slot ?? process.argv[3] ?? "");
  const forcedSlots = parseSlotArg(slotArg);
  if (slotArg && forcedSlots.length === 0) {
    throw new Error(`Invalid --slot value "${slotArg}". Use one or more of: ${MEAL_SLOTS.join(", ")}`);
  }

  const existingRaw = await fs.readFile(seedPath, "utf8");
  const existing = JSON.parse(existingRaw);
  if (!Array.isArray(existing)) {
    throw new Error(`Seed file is not an array: ${seedPath}`);
  }

  const dedupe = new Set(existing.map((r) => normalizeName(r.name)));
  const generated = [];
  const targetTotal = count;

  console.log(`Generating ${count} recipes in batches of ${batchSize}...`);
  console.log(`AI URL: ${apiUrl}`);
  if (forcedSlots.length) {
    console.log(`Forced slot(s): ${forcedSlots.join(", ")}`);
  }

  while (generated.length < targetTotal) {
    const need = Math.min(batchSize, targetTotal - generated.length);
    const avoid = Array.from(dedupe).slice(-120);
    const prompt = buildPrompt(need, avoid, forcedSlots);
    let batch;
    try {
      batch = await callAi(apiUrl, prompt);
    } catch (err) {
      console.error("Batch call failed, falling back to single generation:", err.message || err);
      batch = null;
    }

    const arr = batch == null ? [] : (Array.isArray(batch) ? batch : [batch]);
    let accepted = 0;
    for (let i = 0; i < arr.length; i++) {
      if (generated.length >= targetTotal) break;
      const norm = normalizeRecipe(arr[i], generated.length, existing.length, forcedSlots);
      if (!norm) continue;
      const key = normalizeName(norm.name);
      if (!key || dedupe.has(key)) continue;
      dedupe.add(key);
      norm.id = `seed_${norm.meal_slots[0] || "meal"}_${slug(norm.name)}_${Math.random().toString(36).slice(2, 7)}`;
      generated.push(norm);
      accepted++;
    }

    // Reliability fallback: if batch parsing/quality fails, generate one-by-one.
    if (accepted === 0 && generated.length < targetTotal) {
      const singlesToTry = Math.min(need, targetTotal - generated.length);
      for (let s = 0; s < singlesToTry; s++) {
        const avoidNow = Array.from(dedupe).slice(-120);
        const singlePrompt = buildSinglePrompt(avoidNow, forcedSlots);
        try {
          const one = await callAi(apiUrl, singlePrompt);
          const norm = normalizeRecipe(one, generated.length, existing.length, forcedSlots);
          if (!norm) continue;
          const key = normalizeName(norm.name);
          if (!key || dedupe.has(key)) continue;
          dedupe.add(key);
          norm.id = `seed_${norm.meal_slots[0] || "meal"}_${slug(norm.name)}_${Math.random().toString(36).slice(2, 7)}`;
          generated.push(norm);
          accepted++;
        } catch (err) {
          console.error("Single generation failed:", err.message || err);
        }
      }
    }

    console.log(`Batch accepted: ${accepted}/${need}. Total: ${generated.length}/${targetTotal}`);
    if (accepted === 0) {
      console.log("No valid recipes accepted in this batch. Stopping to avoid loop.");
      break;
    }
  }

  if (generated.length === 0) {
    console.log("No recipes generated. Nothing written.");
    return;
  }

  const merged = [...existing, ...generated];
  const json = `${JSON.stringify(merged, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] Would write ${generated.length} recipes to ${outPath}`);
    return;
  }
  await fs.writeFile(outPath, json, "utf8");
  console.log(`Wrote ${generated.length} new recipes. Total now: ${merged.length}`);
  console.log(`Output: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
