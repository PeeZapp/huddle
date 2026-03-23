import { useMutation } from "@tanstack/react-query";

interface AiRequest {
  prompt: string;
  responseFormat?: "json" | "text";
}

interface AiResponse {
  result: string;
}

export function useAiMutation() {
  return useMutation({
    mutationFn: async (data: AiRequest): Promise<AiResponse> => {
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          throw new Error("Failed to connect to AI");
        }
        
        return await res.json();
      } catch (error) {
        console.error("AI Request failed, falling back to mock response", error);
        
        // --- MOCK FALLBACK FOR DEVELOPMENT WITHOUT BACKEND ---
        // If the API isn't available, we simulate a response based on the prompt
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
        
        if (data.prompt.includes("Generate a varied weekly meal plan")) {
          // Mock meal plan generation
          return {
            result: JSON.stringify([
              {
                day: "monday", slot: "dinner", use_existing: false,
                recipe: { name: "Lemon Herb Salmon", emoji: "🐟", cook_time: 25, calories: 450, protein: 35, cuisine: "Mediterranean" }
              },
              {
                day: "tuesday", slot: "dinner", use_existing: false,
                recipe: { name: "Veggie Stir Fry", emoji: "🥦", cook_time: 15, calories: 320, protein: 12, vegetarian: true, cuisine: "Asian" }
              },
              {
                day: "wednesday", slot: "lunch", use_existing: false,
                recipe: { name: "Quinoa Bowl", emoji: "🥗", cook_time: 20, calories: 410, protein: 15, vegetarian: true }
              }
            ])
          };
        } else if (data.prompt.includes("Extract this recipe")) {
          // Mock recipe extraction
          return {
            result: JSON.stringify({
              name: "Spicy Garlic Shrimp",
              emoji: "🍤",
              photo_color: "#FF7F50",
              cuisine: "Seafood",
              cook_time: 20,
              calories: 380,
              protein: 42,
              vegetarian: false,
              ingredients: [
                { name: "Shrimp", amount: "1 lb", category: "meat" },
                { name: "Garlic", amount: "4 cloves", category: "vegetables" },
                { name: "Olive Oil", amount: "2 tbsp", category: "condiments" }
              ],
              method: ["Clean shrimp.", "Minse garlic.", "Sauté in oil until pink."],
              chef_tip: "Don't overcook the shrimp, or they will be rubbery!"
            })
          };
        }
        
        throw new Error("Could not parse AI fallback");
      }
    },
  });
}
