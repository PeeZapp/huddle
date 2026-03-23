import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, Alert, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useRecipeStore } from "@/stores/recipeStore";
import type { Recipe } from "@/lib/types";
import { MEAL_SLOTS, type MealSlotKey } from "@/lib/mealSlots";

export default function RecipeDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { recipes, update, remove } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id);
  const [editing, setEditing] = useState(false);
  const [editSlots, setEditSlots] = useState<MealSlotKey[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editVeg, setEditVeg] = useState(false);
  const [editExcluded, setEditExcluded] = useState(false);

  useEffect(() => {
    if (recipe) {
      setEditSlots(recipe.meal_slots ?? []);
      setEditNotes(recipe.notes ?? recipe.chef_tip ?? "");
      setEditVeg(recipe.vegetarian ?? false);
      setEditExcluded(recipe.excluded_from_auto ?? false);
    }
  }, [recipe?.id]);

  if (!recipe) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function saveEdit() {
    await update(recipe!.id, {
      meal_slots: editSlots,
      notes: editNotes,
      vegetarian: editVeg,
      excluded_from_auto: editExcluded,
    });
    setEditing(false);
  }

  function toggleSlot(slot: MealSlotKey) {
    setEditSlots((prev) => prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]);
  }

  const bgColor = recipe.photo_color ?? Colors.primaryLight;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{recipe.name}</Text>
        <TouchableOpacity onPress={() => {
          if (editing) { saveEdit(); } else { setEditing(true); }
        }}>
          <Feather name={editing ? "check" : "edit-2"} size={20} color={editing ? Colors.primary : colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: bgColor }]}>
          <Text style={styles.heroEmoji}>{recipe.emoji ?? "🍽️"}</Text>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {/* Name & cuisine */}
          <View>
            <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.name}</Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              {recipe.cuisine && <Tag icon="globe" label={recipe.cuisine} color={colors.textSecondary} />}
              {recipe.cook_time ? <Tag icon="clock" label={`${recipe.cook_time} min`} color={colors.textSecondary} /> : null}
              {recipe.vegetarian && <Tag icon="leaf" label="Vegetarian" color="#22C55E" />}
            </View>
          </View>

          {/* Nutrition */}
          <View style={[styles.nutGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { key: "calories", label: "Calories", value: recipe.calories, unit: "" },
              { key: "protein", label: "Protein", value: recipe.protein, unit: "g" },
              { key: "carbs", label: "Carbs", value: recipe.carbs, unit: "g" },
              { key: "fat", label: "Fat", value: recipe.fat, unit: "g" },
            ].map(({ key, label, value, unit }) => (
              <View key={key} style={styles.nutItem}>
                <Text style={[styles.nutValue, { color: colors.text }]}>{value ?? "—"}{unit}</Text>
                <Text style={[styles.nutLabel, { color: colors.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Meal slots */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Meal Slots</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {MEAL_SLOTS.map((s) => {
                const sc = Colors.mealSlots[s.key];
                const isSelected = editing ? editSlots.includes(s.key) : (recipe.meal_slots ?? []).includes(s.key);
                if (!editing && !isSelected) return null;
                return (
                  <TouchableOpacity key={s.key} onPress={editing ? () => toggleSlot(s.key) : undefined}
                    style={[styles.slotBadge, isSelected ? { backgroundColor: sc.bg, borderColor: sc.border } : { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <View style={[styles.slotDot, { backgroundColor: isSelected ? sc.dot : colors.textSecondary }]} />
                    <Text style={[styles.slotBadgeText, { color: isSelected ? sc.text : colors.textSecondary }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {!editing && (recipe.meal_slots ?? []).length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No slots assigned</Text>
              )}
            </View>
          </View>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ingredients ({recipe.ingredients.length})</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
                {recipe.ingredients.map((ing, i) => (
                  <View key={i} style={[styles.ingRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <View style={[styles.ingDot, { backgroundColor: Colors.primary }]} />
                    <Text style={[styles.ingName, { color: colors.text }]}>{ing.name}</Text>
                    {ing.amount ? <Text style={[styles.ingAmount, { color: colors.textSecondary }]}>{ing.amount}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Method */}
          {recipe.method && recipe.method.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Method</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {recipe.method.map((step, i) => (
                  <View key={i} style={[styles.stepRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.stepNum, { backgroundColor: Colors.primaryLight }]}>
                      <Text style={[styles.stepNumText, { color: Colors.primary }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Chef tip */}
          {(editing ? true : (recipe.chef_tip || recipe.notes)) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notes / Tips</Text>
              {editing ? (
                <TextInput
                  style={[styles.notesInput, { backgroundColor: colors.inputBg, color: colors.text, marginTop: 8 }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  placeholder="Chef tip or notes..."
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <View style={[styles.tipBox, { backgroundColor: Colors.primaryLight, marginTop: 8 }]}>
                  <Feather name="info" size={14} color={Colors.primaryDark} />
                  <Text style={[styles.tipText, { color: Colors.primaryDark }]}>{recipe.notes || recipe.chef_tip}</Text>
                </View>
              )}
            </View>
          )}

          {/* Edit options */}
          {editing && (
            <View style={styles.section}>
              <TouchableOpacity style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setEditVeg((v) => !v)}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Vegetarian</Text>
                <View style={[styles.toggle, { backgroundColor: editVeg ? Colors.primary : colors.inputBg }]}>
                  <View style={[styles.toggleThumb, { left: editVeg ? 22 : 2 }]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setEditExcluded((v) => !v)}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Exclude from AI generation</Text>
                <View style={[styles.toggle, { backgroundColor: editExcluded ? Colors.primary : colors.inputBg }]}>
                  <View style={[styles.toggleThumb, { left: editExcluded ? 22 : 2 }]} />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Delete */}
          <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.destructive }]} onPress={() => Alert.alert("Delete Recipe", `Delete "${recipe.name}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => { await remove(recipe.id); router.back(); } },
          ])}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Recipe</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Tag({ icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={12} color={color} />
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_600SemiBold", marginHorizontal: 12 },
  hero: { height: 160, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 64 },
  recipeName: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  nutGrid: { flexDirection: "row", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  nutItem: { flex: 1, alignItems: "center" },
  nutValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  nutLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: {},
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  slotBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  slotDot: { width: 6, height: 6, borderRadius: 3 },
  slotBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  ingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ingDot: { width: 6, height: 6, borderRadius: 3 },
  ingName: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  ingAmount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  stepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  tipBox: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 14, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  notesInput: { borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 2 },
  toggleThumb: { position: "absolute", top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
