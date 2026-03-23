import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useColorScheme, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { useRecipeStore } from "@/stores/recipeStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { callClaudeJSON } from "@/lib/ai";
import { DAYS, MEAL_SLOTS, type Day, type MealSlotKey, getWeekStart, DAY_FULL_LABELS } from "@/lib/mealSlots";
import type { Recipe } from "@/lib/types";

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { familyGroup, profile } = useFamilyStore();
  const { getPlan, setSlot, loaded: planLoaded, load: loadPlan } = useMealPlanStore();
  const { recipes, loaded: recipesLoaded, load: loadRecipes, create: createRecipe } = useRecipeStore();
  const { goals } = useNutritionStore();

  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";
  const weekStart = getWeekStart();
  const plan = getPlan(weekStart, familyCode);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [generated, setGenerated] = useState<Array<{ day: Day; slot: MealSlotKey; recipe: Partial<Recipe> }>>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (familyCode) {
      if (!planLoaded) loadPlan(familyCode);
      if (!recipesLoaded) loadRecipes(familyCode);
    }
  }, [familyCode]);

  async function generate() {
    if (!familyCode) { Alert.alert("No Family", "Set up a family first."); return; }
    setLoading(true);
    setProgress("Preparing your preferences...");
    try {
      const activeSlots = plan.active_slots;
      const existingRecipeNames = recipes
        .filter((r) => !r.excluded_from_auto && !r.is_component)
        .map((r) => ({ name: r.name, slots: r.meal_slots?.join(",") ?? "", cuisine: r.cuisine ?? "" }))
        .slice(0, 40);

      const slotsNeeded: { day: string; slot: string; label: string }[] = [];
      DAYS.forEach((day) => {
        activeSlots.forEach((slot) => {
          if (!plan.slots[`${day}_${slot}`]) {
            slotsNeeded.push({ day, slot, label: `${DAY_FULL_LABELS[day]} ${MEAL_SLOTS.find((s) => s.key === slot)?.label}` });
          }
        });
      });

      if (slotsNeeded.length === 0) {
        Alert.alert("Week Full", "All meal slots for this week are already filled.");
        setLoading(false);
        return;
      }

      setProgress(`Generating ${slotsNeeded.length} meals...`);

      const prompt = `Generate a varied weekly meal plan. Fill these empty slots:
${slotsNeeded.map((s) => `- ${s.label} (slot type: ${s.slot})`).join("\n")}

Nutrition targets per day: ${goals.calories} cal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat
${existingRecipeNames.length > 0 ? `Try to use some of these existing recipes if they fit the slot:\n${existingRecipeNames.map((r) => `- ${r.name} (${r.slots || "any"})`).join("\n")}\n\nIf you use one of these, set use_existing=true and name it exactly.` : ""}

Return a JSON array of objects, one per slot:
[{
  "day": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  "slot": "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner" | "night_snack" | "dessert",
  "use_existing": boolean,
  "recipe": {
    "name": string,
    "emoji": string (single emoji),
    "photo_color": string (hex color),
    "cuisine": string,
    "cook_time": number (minutes),
    "protein": number (grams),
    "calories": number,
    "carbs": number (grams),
    "fat": number (grams),
    "vegetarian": boolean,
    "ingredients": [{"name": string, "amount": string, "category": string}],
    "method": [string],
    "chef_tip": string
  }
}]`;

      type GeneratedItem = {
        day: Day;
        slot: MealSlotKey;
        use_existing: boolean;
        recipe: Partial<Recipe>;
      };

      const result = await callClaudeJSON<GeneratedItem[]>(prompt);
      setGenerated(result.map((item) => ({ day: item.day, slot: item.slot, recipe: item.recipe })));
      setShowPreview(true);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to generate meal plan. Please try again.");
    }
    setLoading(false);
    setProgress("");
  }

  async function applyPlan() {
    setLoading(true);
    setProgress("Saving meal plan...");
    try {
      for (const item of generated) {
        let recipeId: string | undefined;
        const existing = recipes.find((r) => r.name.toLowerCase() === item.recipe.name?.toLowerCase());
        if (existing) {
          recipeId = existing.id;
        } else {
          const saved = await createRecipe({
            ...item.recipe as Omit<Recipe, "id" | "created_at">,
            family_code: familyCode,
            meal_slots: [item.slot],
          });
          recipeId = saved.id;
        }
        await setSlot(weekStart, familyCode, item.day, item.slot, {
          recipe_id: recipeId,
          recipe_name: item.recipe.name,
          emoji: item.recipe.emoji,
          protein: item.recipe.protein,
          calories: item.recipe.calories,
          carbs: item.recipe.carbs,
          fat: item.recipe.fat,
          cook_time: item.recipe.cook_time,
        });
      }
      setShowPreview(false);
      Alert.alert("Done!", "Meal plan generated!", [
        { text: "View Plan", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save meal plan.");
    }
    setLoading(false);
    setProgress("");
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Generate Meal Plan</Text>
        <View style={{ width: 24 }} />
      </View>

      {!showPreview ? (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 40 }}>
          <View style={[styles.infoCard, { backgroundColor: Colors.primaryLight }]}>
            <Feather name="zap" size={24} color={Colors.primary} />
            <Text style={[styles.infoTitle, { color: Colors.primaryDark }]}>AI Meal Plan Generator</Text>
            <Text style={[styles.infoText, { color: Colors.primaryDark }]}>
              Fill your week with varied, nutritious meals tailored to your goals. Empty slots will be filled — existing meals are kept.
            </Text>
          </View>

          <View style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.goalTitle, { color: colors.text }]}>Current Nutrition Goals</Text>
            <View style={styles.goalGrid}>
              {[
                { label: "Calories", value: goals.calories, unit: "cal" },
                { label: "Protein", value: goals.protein, unit: "g" },
                { label: "Carbs", value: goals.carbs, unit: "g" },
                { label: "Fat", value: goals.fat, unit: "g" },
              ].map(({ label, value, unit }) => (
                <View key={label} style={styles.goalItem}>
                  <Text style={[styles.goalValue, { color: Colors.primary }]}>{value}{unit}</Text>
                  <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statsTitle, { color: colors.text }]}>This Week</Text>
            <Text style={[styles.statsValue, { color: colors.textSecondary }]}>
              {Object.keys(plan.slots).length} / {plan.active_slots.length * 7} slots filled
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: Colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={generate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Feather name="zap" size={20} color="#fff" />}
            <Text style={styles.generateBtnText}>{loading ? progress || "Generating..." : "Generate Plan"}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Generated {generated.length} meals</Text>
            {generated.map((item, i) => {
              const sc = Colors.mealSlots[item.slot];
              return (
                <View key={i} style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.previewHead, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.previewDay, { color: sc.text }]}>{DAY_FULL_LABELS[item.day]}</Text>
                    <Text style={[styles.previewSlot, { color: sc.text }]}>{MEAL_SLOTS.find((s) => s.key === item.slot)?.label}</Text>
                  </View>
                  <View style={styles.previewBody}>
                    <View style={[styles.previewEmoji, { backgroundColor: item.recipe.photo_color ?? Colors.primaryLight }]}>
                      <Text style={{ fontSize: 24 }}>{item.recipe.emoji ?? "🍽️"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewName, { color: colors.text }]}>{item.recipe.name}</Text>
                      <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>
                        {item.recipe.calories ? `${item.recipe.calories} cal` : ""}{item.recipe.cook_time ? ` · ${item.recipe.cook_time}min` : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]} onPress={() => setShowPreview(false)}>
              <Text style={[styles.outlineBtnText, { color: colors.text }]}>Regenerate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.applyBtn, { flex: 1 }]} onPress={applyPlan} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text style={styles.applyBtnText}>{loading ? "Saving..." : "Apply Plan"}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 20, padding: 20, gap: 8, alignItems: "center", textAlign: "center" },
  infoTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  goalCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  goalTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  goalGrid: { flexDirection: "row", justifyContent: "space-around" },
  goalItem: { alignItems: "center" },
  goalValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  goalLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statsCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  statsValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 16 },
  generateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  previewTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  previewCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  previewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8 },
  previewDay: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  previewSlot: { fontSize: 12, fontFamily: "Inter_400Regular" },
  previewBody: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  previewEmoji: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  previewName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  previewMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  footer: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  outlineBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1.5 },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  applyBtn: { flexDirection: "row", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  applyBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
