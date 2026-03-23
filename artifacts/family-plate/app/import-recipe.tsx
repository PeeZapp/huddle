import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  useColorScheme, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useRecipeStore } from "@/stores/recipeStore";
import { callClaudeJSON } from "@/lib/ai";
import { MEAL_SLOTS, type MealSlotKey } from "@/lib/mealSlots";
import type { Recipe } from "@/lib/types";

type Tab = "url" | "text";

export default function ImportRecipeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { familyGroup, profile } = useFamilyStore();
  const { create } = useRecipeStore();
  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";

  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Partial<Recipe> | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<MealSlotKey[]>(["dinner"]);
  const [isBase, setIsBase] = useState(false);

  function toggleSlot(slot: MealSlotKey) {
    setSelectedSlots((prev) => prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]);
  }

  async function handleImport() {
    const source = tab === "url" ? url.trim() : text.trim();
    if (!source) return;
    setLoading(true);
    try {
      const prompt = `${tab === "url" ? `Import this recipe from the URL: ${source}` : `Extract this recipe from the following text:\n${source}`}

Return JSON with:
- name (string)
- emoji (single emoji)
- photo_color (hex color matching the dish)
- cuisine (Western/Asian/Indian/Italian/Thai/Mexican/Mediterranean/Japanese/Korean/Middle Eastern/Other)
- cook_time (number, minutes)
- protein (number, grams per serving)
- calories (number, per serving)
- carbs (number, grams per serving)
- fat (number, grams per serving)
- vegetarian (boolean)
- ingredients (array of {name, amount, category} where category is one of: meat/dairy/vegetables/fruit/grains/spices/condiments/canned/frozen/bakery/beverages/other)
- method (array of step strings)
- chef_tip (string)

Be thorough. Estimate nutrition if not provided.`;

      const result = await callClaudeJSON<Partial<Recipe>>(prompt);
      setPreview(result);
    } catch (e) {
      Alert.alert("Import Failed", "Could not extract recipe. Try pasting the text directly.");
      console.error(e);
    }
    setLoading(false);
  }

  async function saveRecipe() {
    if (!preview || !familyCode) return;
    try {
      const recipe = await create({
        ...preview as Omit<Recipe, "id" | "created_at">,
        meal_slots: isBase ? [] : selectedSlots,
        is_component: isBase,
        imported: true,
        source_url: tab === "url" ? url : undefined,
        family_code: familyCode,
      });
      Alert.alert("Saved!", `"${recipe.name}" has been added to your recipes.`, [
        { text: "View Recipe", onPress: () => { router.back(); router.push(`/recipe/${recipe.id}`); } },
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save recipe.");
    }
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Import Recipe</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {!preview ? (
          <>
            {/* Tab selector */}
            <View style={[styles.tabBar, { backgroundColor: colors.inputBg }]}>
              {(["url", "text"] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { backgroundColor: colors.card }]}>
                  <Feather name={t === "url" ? "link" : "file-text"} size={15} color={tab === t ? Colors.primary : colors.textSecondary} />
                  <Text style={[styles.tabBtnText, { color: tab === t ? Colors.primary : colors.textSecondary }]}>
                    {t === "url" ? "URL" : "Text"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "url" ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="https://..."
                placeholderTextColor={colors.textSecondary}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
              />
            ) : (
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Paste the recipe text here..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
              />
            )}

            {/* Base recipe toggle */}
            <TouchableOpacity style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setIsBase((v) => !v)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Base Recipe</Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>e.g. sauces, dressings — used in other recipes</Text>
              </View>
              <View style={[styles.toggle, { backgroundColor: isBase ? Colors.primary : colors.inputBg }]}>
                <View style={[styles.toggleThumb, { left: isBase ? 22 : 2 }]} />
              </View>
            </TouchableOpacity>

            {!isBase && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Meal Slots</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {MEAL_SLOTS.map((s) => {
                    const sc = Colors.mealSlots[s.key];
                    const sel = selectedSlots.includes(s.key);
                    return (
                      <TouchableOpacity key={s.key} onPress={() => toggleSlot(s.key)}
                        style={[styles.slotChip, sel ? { backgroundColor: sc.bg, borderColor: sc.border } : { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <View style={[styles.slotDot, { backgroundColor: sel ? sc.dot : colors.textSecondary }]} />
                        <Text style={[styles.slotChipText, { color: sel ? sc.text : colors.textSecondary }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: Colors.primary, opacity: loading || !(tab === "url" ? url : text) ? 0.5 : 1 }]}
              onPress={handleImport}
              disabled={loading || !(tab === "url" ? url : text)}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="download" size={18} color="#fff" />}
              <Text style={styles.importBtnText}>{loading ? "Importing..." : "Import Recipe"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Preview */}
            <View style={[styles.hero, { backgroundColor: preview.photo_color ?? Colors.primaryLight }]}>
              <Text style={styles.heroEmoji}>{preview.emoji ?? "🍽️"}</Text>
            </View>
            <Text style={[styles.previewName, { color: colors.text }]}>{preview.name}</Text>

            <View style={[styles.nutGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: "Calories", value: preview.calories },
                { label: "Protein", value: preview.protein, unit: "g" },
                { label: "Carbs", value: preview.carbs, unit: "g" },
                { label: "Fat", value: preview.fat, unit: "g" },
              ].map(({ label, value, unit = "" }) => (
                <View key={label} style={styles.nutItem}>
                  <Text style={[styles.nutValue, { color: colors.text }]}>{value ?? "—"}{unit}</Text>
                  <Text style={[styles.nutLabel, { color: colors.textSecondary }]}>{label}</Text>
                </View>
              ))}
            </View>

            {preview.ingredients && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ingredients ({preview.ingredients.length})</Text>
                {preview.ingredients.map((ing, i) => (
                  <Text key={i} style={[styles.ingLine, { color: colors.textSecondary }]}>• {ing.amount ? `${ing.amount} ` : ""}{ing.name}</Text>
                ))}
              </View>
            )}

            {preview.method && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Method ({preview.method.length} steps)</Text>
                {preview.method.map((step, i) => (
                  <Text key={i} style={[styles.ingLine, { color: colors.textSecondary }]}>{i + 1}. {step}</Text>
                ))}
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]} onPress={() => setPreview(null)}>
                <Text style={[styles.outlineBtnText, { color: colors.text }]}>Edit Source</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.importBtn, { flex: 1 }]} onPress={saveRecipe}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.importBtnText}>Save Recipe</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", borderRadius: 14, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 180 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  toggleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 2 },
  toggleThumb: { position: "absolute", top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  slotChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  slotDot: { width: 6, height: 6, borderRadius: 3 },
  slotChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  importBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14 },
  importBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  hero: { height: 140, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 56 },
  previewName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  nutGrid: { flexDirection: "row", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  nutItem: { flex: 1, alignItems: "center" },
  nutValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  nutLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  ingLine: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  outlineBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1.5 },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
