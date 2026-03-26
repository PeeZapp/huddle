export interface IngredientSubstitute {
  name: string;
  ratio?: string;
  notes?: string;
}

interface IngredientSubRule {
  match: string[];
  substitutes: IngredientSubstitute[];
}

const RULES: IngredientSubRule[] = [
  {
    match: ["andouille sausage", "andouille"],
    substitutes: [
      { name: "Chorizo (smoked)", ratio: "1:1", notes: "Closest smoky/spicy profile." },
      { name: "Kielbasa + pinch cayenne", ratio: "1:1", notes: "Add heat to mimic andouille." },
      { name: "Smoked bratwurst", ratio: "1:1", notes: "Milder, still smoky." },
    ],
  },
  {
    match: ["buttermilk"],
    substitutes: [
      { name: "Milk + lemon juice", ratio: "1 cup + 1 tbsp", notes: "Rest 5-10 min before use." },
      { name: "Plain yoghurt thinned with milk", ratio: "1:1", notes: "Great for baking and marinades." },
    ],
  },
  {
    match: ["heavy cream", "thickened cream"],
    substitutes: [
      { name: "Half-and-half + butter", ratio: "3/4 cup + 1/4 cup", notes: "Good for sauces." },
      { name: "Evaporated milk", ratio: "1:1", notes: "Lighter texture." },
    ],
  },
  {
    match: ["fish sauce"],
    substitutes: [
      { name: "Soy sauce + dash lime", ratio: "1:1", notes: "Less funky, still savory." },
      { name: "Worcestershire sauce", ratio: "1:1", notes: "Use for depth in cooked dishes." },
    ],
  },
  {
    match: ["soy sauce"],
    substitutes: [
      { name: "Tamari", ratio: "1:1", notes: "Usually gluten-free." },
      { name: "Coconut aminos", ratio: "1:1", notes: "Slightly sweeter and less salty." },
    ],
  },
  {
    match: ["coriander", "cilantro"],
    substitutes: [
      { name: "Flat-leaf parsley", ratio: "1:1", notes: "Fresh herb replacement." },
      { name: "Fresh basil", ratio: "1:1", notes: "Different flavor, still aromatic." },
    ],
  },
  {
    match: ["shallot"],
    substitutes: [
      { name: "Red onion", ratio: "1:1", notes: "Slightly sharper." },
      { name: "Spring onion + garlic", ratio: "2:1", notes: "Closer aromatic profile." },
    ],
  },
  {
    match: ["rice vinegar"],
    substitutes: [
      { name: "Apple cider vinegar", ratio: "1:1", notes: "Add pinch sugar if needed." },
      { name: "White wine vinegar", ratio: "1:1", notes: "Mild, clean acidity." },
    ],
  },
  {
    match: ["sour cream"],
    substitutes: [
      { name: "Greek yoghurt", ratio: "1:1", notes: "Similar tang and body." },
      { name: "Creme fraiche", ratio: "1:1", notes: "Richer and less tangy." },
    ],
  },
];

export function getIngredientSubstitutes(name: string): IngredientSubstitute[] {
  const query = name.trim().toLowerCase();
  if (!query) return [];
  const rule = RULES.find((r) => r.match.some((m) => query.includes(m)));
  return rule?.substitutes ?? [];
}
