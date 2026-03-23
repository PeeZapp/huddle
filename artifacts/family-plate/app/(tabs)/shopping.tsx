import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  useColorScheme, RefreshControl, Alert, Modal, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useShoppingStore } from "@/stores/shoppingStore";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { useRecipeStore } from "@/stores/recipeStore";
import { getWeekStart } from "@/lib/mealSlots";

const CATEGORY_ORDER = ["meat","dairy","vegetables","fruit","grains","spices","condiments","canned","frozen","bakery","beverages","other"];
const CATEGORY_LABELS: Record<string, string> = {
  meat: "Meat & Poultry", dairy: "Dairy", vegetables: "Vegetables", fruit: "Fruit",
  grains: "Grains & Pasta", spices: "Spices & Herbs", condiments: "Condiments",
  canned: "Canned Goods", frozen: "Frozen", bakery: "Bakery", beverages: "Beverages", other: "Other",
};

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const weekStart = getWeekStart();

  const { familyGroup, profile } = useFamilyStore();
  const { items, loaded, load, create, toggle, remove, bulkCreate, clearWeek } = useShoppingStore();
  const { getPlan, loaded: planLoaded, load: loadPlan } = useMealPlanStore();
  const { recipes, loaded: recipesLoaded, load: loadRecipes } = useRecipeStore();

  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [showCatPicker, setShowCatPicker] = useState(false);

  useEffect(() => {
    if (familyCode && !loaded) load(familyCode);
  }, [familyCode, loaded]);

  useEffect(() => {
    if (familyCode && !planLoaded) loadPlan(familyCode);
    if (familyCode && !recipesLoaded) loadRecipes(familyCode);
  }, [familyCode, planLoaded, recipesLoaded]);

  const weekItems = items.filter((i) => i.week_start === weekStart);
  const checked = weekItems.filter((i) => i.checked).length;
  const progress = weekItems.length > 0 ? checked / weekItems.length : 0;

  const grouped = useMemo(() => {
    const g: Record<string, typeof weekItems> = {};
    weekItems.forEach((item) => {
      const cat = item.category ?? "other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(item);
    });
    return g;
  }, [weekItems]);

  async function generateList() {
    if (!familyCode) return;
    setGenerating(true);
    try {
      const plan = getPlan(weekStart, familyCode);
      const slotValues = Object.values(plan.slots);
      const recipeIds = [...new Set(slotValues.map((s) => s.recipe_id).filter(Boolean))] as string[];
      if (recipeIds.length === 0) {
        Alert.alert("No Meals", "Add meals to your plan first.");
        setGenerating(false);
        return;
      }
      const weekRecipes = recipes.filter((r) => recipeIds.includes(r.id));
      const ingredientMap: Record<string, { name: string; amounts: string[]; category: string; recipeNames: string[] }> = {};
      weekRecipes.forEach((recipe) => {
        (recipe.ingredients ?? []).forEach((ing) => {
          const key = ing.name.toLowerCase().trim();
          if (!ingredientMap[key]) {
            ingredientMap[key] = { name: ing.name, amounts: [], category: ing.category ?? "other", recipeNames: [] };
          }
          if (ing.amount) ingredientMap[key].amounts.push(ing.amount);
          if (!ingredientMap[key].recipeNames.includes(recipe.name)) ingredientMap[key].recipeNames.push(recipe.name);
        });
      });
      await clearWeek(weekStart);
      const newItems = Object.values(ingredientMap).map((ing) => ({
        name: ing.name,
        amount: ing.amounts.join(", "),
        category: ing.category,
        checked: false,
        shared: ing.recipeNames.length > 1,
        week_start: weekStart,
        recipe_names: ing.recipeNames,
        family_code: familyCode,
      }));
      if (newItems.length > 0) await bulkCreate(newItems);
      Alert.alert("Done!", `${newItems.length} items added to your list.`);
    } catch {
      Alert.alert("Error", "Failed to generate list.");
    }
    setGenerating(false);
  }

  async function addManual() {
    if (!newName.trim() || !familyCode) return;
    await create({ name: newName.trim(), category: newCategory, checked: false, shared: false, week_start: weekStart, recipe_names: [], family_code: familyCode });
    setNewName("");
    setShowAdd(false);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (familyCode) await load(familyCode);
    setRefreshing(false);
  }, [familyCode]);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Shopping List</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() => setShowAdd((v) => !v)}>
            <Feather name="plus" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={generateList} disabled={generating}>
            {generating ? <ActivityIndicator size="small" color={Colors.primary} /> : <Feather name="refresh-cw" size={18} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 80 }}
      >
        {showAdd && (
          <View style={[styles.addForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Item name..."
              placeholderTextColor={colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addManual}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={[styles.catBtn, { backgroundColor: colors.inputBg, flex: 1 }]} onPress={() => setShowCatPicker(true)}>
                <Text style={[styles.catBtnText, { color: colors.text }]}>{CATEGORY_LABELS[newCategory]}</Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: Colors.primary }]} onPress={addManual}>
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {weekItems.length > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.progressLabel, { color: colors.text }]}>Progress</Text>
              <Text style={[styles.progressCount, { color: colors.textSecondary }]}>{checked}/{weekItems.length}</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: colors.inputBg }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: Colors.primary }]} />
            </View>
          </View>
        )}

        {weekItems.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="shopping-cart" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No items yet. Generate from your meal plan!</Text>
          </View>
        ) : (
          CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
            <View key={cat}>
              <Text style={[styles.catHeader, { color: colors.textSecondary }]}>{CATEGORY_LABELS[cat]}</Text>
              <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {grouped[cat].map((item, idx) => (
                  <TouchableOpacity key={item.id} onPress={() => toggle(item.id)} onLongPress={() => Alert.alert("Remove", `Remove "${item.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => remove(item.id) }])}
                    style={[styles.itemRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <View style={[styles.checkbox, { borderColor: item.checked ? Colors.primary : colors.border, backgroundColor: item.checked ? Colors.primary : "transparent" }]}>
                      {item.checked && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text, textDecorationLine: item.checked ? "line-through" : "none", opacity: item.checked ? 0.5 : 1 }]}>{item.name}</Text>
                      {item.amount ? <Text style={[styles.itemAmount, { color: colors.textSecondary }]}>{item.amount}</Text> : null}
                    </View>
                    {item.shared && (
                      <View style={[styles.sharedBadge, { backgroundColor: Colors.primaryLight }]}>
                        <Feather name="users" size={10} color={Colors.primaryDark} />
                        <Text style={[styles.sharedText, { color: Colors.primaryDark }]}>shared</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showCatPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowCatPicker(false)} activeOpacity={1}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Category</Text>
            {CATEGORY_ORDER.map((cat) => (
              <TouchableOpacity key={cat} style={styles.modalItem} onPress={() => { setNewCategory(cat); setShowCatPicker(false); }}>
                <Text style={[styles.modalItemText, { color: newCategory === cat ? Colors.primary : colors.text }]}>{CATEGORY_LABELS[cat]}</Text>
                {newCategory === cat && <Feather name="check" size={16} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addForm: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  catBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  catBtnText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  addItemBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  progressCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  progressLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  progressCount: { fontSize: 14, fontFamily: "Inter_400Regular" },
  progressBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  catHeader: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  listCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 15, fontFamily: "Inter_400Regular" },
  itemAmount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  sharedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sharedText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 2 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  modalItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  modalItemText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
