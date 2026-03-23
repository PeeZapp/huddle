// ─── Dietary restriction definitions & recipe conflict detection ───────────────

import { Recipe, FamilyMember } from "./types";

export interface DietaryOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string; // tailwind bg colour class
}

export const DIETARY_OPTIONS: DietaryOption[] = [
  { id: "vegetarian",     label: "Vegetarian",     emoji: "🥗", description: "No meat or fish",               color: "bg-green-100 text-green-800" },
  { id: "vegan",          label: "Vegan",           emoji: "🌱", description: "No animal products",           color: "bg-emerald-100 text-emerald-800" },
  { id: "pescatarian",    label: "Pescatarian",     emoji: "🐟", description: "No meat, fish is fine",        color: "bg-cyan-100 text-cyan-800" },
  { id: "gluten-free",    label: "Gluten-Free",     emoji: "🌾", description: "No wheat, gluten or barley",   color: "bg-amber-100 text-amber-800" },
  { id: "dairy-free",     label: "Dairy-Free",      emoji: "🥛", description: "No milk, cheese or butter",   color: "bg-blue-100 text-blue-800" },
  { id: "egg-free",       label: "Egg-Free",        emoji: "🥚", description: "No eggs",                      color: "bg-yellow-100 text-yellow-800" },
  { id: "nut-free",       label: "Nut-Free",        emoji: "🥜", description: "No tree nuts or peanuts",      color: "bg-orange-100 text-orange-800" },
  { id: "shellfish-free", label: "Shellfish-Free",  emoji: "🦐", description: "No prawns, crab or molluscs", color: "bg-red-100 text-red-800" },
  { id: "halal",          label: "Halal",           emoji: "✅", description: "No pork or alcohol",           color: "bg-teal-100 text-teal-800" },
  { id: "kosher",         label: "Kosher",          emoji: "✡️", description: "No pork or shellfish",         color: "bg-violet-100 text-violet-800" },
  { id: "low-carb",       label: "Low Carb",        emoji: "🍞", description: "Avoid high-carb recipes",      color: "bg-pink-100 text-pink-800" },
];

// ─── Ingredient keyword lists ─────────────────────────────────────────────────

const MEAT_KW     = ["chicken","beef","pork","lamb","turkey","veal","duck","goose","venison","bison","mince","minced","bacon","prosciutto","pancetta","chorizo","andouille","pepperoni","salami","ham","sausage","lard","tallow","suet","offal","liver","kidney","oxtail","tripe","ribs","rump","sirloin","brisket","chuck","shank","tenderloin"];
const FISH_KW     = ["salmon","tuna","cod","fish","tilapia","sardine","mackerel","trout","halibut","snapper","mahi","anchovy","bass","sea bass","seabass","haddock","plaice","sole","swordfish","barramundi"];
const SHELLFISH_KW= ["prawn","shrimp","crab","lobster","clam","mussel","oyster","scallop","squid","octopus","crayfish","langoustine","crawfish"];
const DAIRY_KW    = ["milk","cream","butter","cheese","yogurt","yoghurt","ghee","creme fraiche","sour cream","fromage","ricotta","mascarpone","custard","brie","cheddar","feta","mozzarella","parmesan","halloumi","gouda","beurre"];
const EGG_KW      = ["egg "," egg","eggs","egg,","egg.","egg-"]; // careful with "eggplant"
const GLUTEN_KW   = ["flour","bread","pasta","spaghetti","penne","linguine","fettuccine","tagliatelle","rigatoni","orzo","noodle","wheat","couscous","bulgur","barley","semolina","breadcrumb","crouton","batter","roux","sourdough","crumpet","tortilla","wrap","pita","croissant","bagel","ciabatta","focaccia"];
const NUT_KW      = ["almond","cashew","walnut","pecan","peanut","hazelnut","pistachio","macadamia","pine nut","brazil nut","chestnut","praline","marzipan","nut butter","nutella"];
const PORK_KW     = ["pork","bacon","ham","prosciutto","pancetta","chorizo","andouille","lard","pepperoni","salami","mortadella","sausage","gammon","bramble"];
const ALCOHOL_KW  = ["wine","beer","cider","vodka","rum","whiskey","bourbon","brandy","gin","sake","champagne","prosecco","stout","ale","lager","liqueur","sherry","vermouth","port","calvados"];

function ingNames(recipe: Recipe): string[] {
  return (recipe.ingredients ?? []).map(i => ` ${i.name.toLowerCase()} `);
}

function anyMatch(names: string[], keywords: string[]): boolean {
  return keywords.some(kw => names.some(n => n.includes(kw)));
}

// Special egg check — avoid matching "eggplant"
function containsEgg(recipe: Recipe): boolean {
  return (recipe.ingredients ?? []).some(i => {
    const n = i.name.toLowerCase();
    return /\begg(s)?\b/.test(n) && !n.includes("eggplant");
  });
}

// Returns true if a recipe CONFLICTS with (should be excluded for) a restriction
export function hasConflict(recipe: Recipe, restriction: string): boolean {
  const names = ingNames(recipe);

  switch (restriction) {
    case "vegetarian":
      // Use the explicit flag if set, otherwise check ingredients
      if (recipe.vegetarian === true) return false;
      return anyMatch(names, [...MEAT_KW, ...FISH_KW, ...SHELLFISH_KW]);

    case "vegan":
      if (anyMatch(names, [...MEAT_KW, ...FISH_KW, ...SHELLFISH_KW])) return true;
      if (anyMatch(names, DAIRY_KW)) return true;
      if (containsEgg(recipe)) return true;
      return false;

    case "pescatarian":
      // Fish is OK, meat is not
      return anyMatch(names, MEAT_KW);

    case "gluten-free":
      return anyMatch(names, GLUTEN_KW);

    case "dairy-free":
      return anyMatch(names, DAIRY_KW);

    case "egg-free":
      return containsEgg(recipe);

    case "nut-free":
      return anyMatch(names, NUT_KW);

    case "shellfish-free":
      return anyMatch(names, SHELLFISH_KW);

    case "halal":
      return anyMatch(names, [...PORK_KW, ...ALCOHOL_KW]);

    case "kosher":
      return anyMatch(names, [...PORK_KW, ...SHELLFISH_KW]);

    case "low-carb":
      // Exclude if recipe has >50g carbs or contains high-carb staples
      if ((recipe.carbs ?? 0) > 50) return true;
      return anyMatch(names, ["pasta","rice","potato","bread","noodle","couscous","quinoa","oat"]);

    default:
      return false;
  }
}

// Combine all restrictions from all family members
export function familyRestrictions(members: FamilyMember[]): string[] {
  const all = new Set<string>();
  for (const m of members) {
    for (const d of m.dietary ?? []) all.add(d);
  }
  return [...all];
}

// Filter a recipe pool to only recipes safe for all family members
export function filterRecipesForFamily(recipes: Recipe[], members: FamilyMember[]): Recipe[] {
  const restrictions = familyRestrictions(members);
  if (restrictions.length === 0) return recipes;
  return recipes.filter(r => !restrictions.some(res => hasConflict(r, res)));
}

export function getDietaryOption(id: string): DietaryOption | undefined {
  return DIETARY_OPTIONS.find(d => d.id === id);
}
