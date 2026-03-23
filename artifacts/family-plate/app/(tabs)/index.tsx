import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { useRecipeStore } from "@/stores/recipeStore";
import {
  DAYS,
  DAY_LABELS,
  MEAL_SLOTS,
  MEAL_SLOT_KEYS,
  type Day,
  type MealSlotKey,
  getWeekStart,
  todayDayKey,
  getWeekDates,
} from "@/lib/mealSlots";
import type { Recipe } from "@/lib/types";

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { familyGroup, profile, loaded: familyLoaded, load: loadFamily } = useFamilyStore();
  const { load: loadPlan, getPlan, setSlot, setActiveSlots, clearWeek, loaded: planLoaded } = useMealPlanStore();
  const { recipes, load: loadRecipes, loaded: recipesLoaded } = useRecipeStore();

  const weekStart = getWeekStart();
  const today = todayDayKey();
  const [selectedDay, setSelectedDay] = useState<Day>(today);
  const [refreshing, setRefreshing] = useState(false);
  const [pickingSlot, setPickingSlot] = useState<{ day: Day; slot: MealSlotKey } | null>(null);

  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";
  const plan = getPlan(weekStart, familyCode);
  const activeSlots = plan.active_slots;

  useEffect(() => { if (!familyLoaded) loadFamily(); }, [familyLoaded]);

  useEffect(() => {
    if (familyCode) {
      if (!planLoaded) loadPlan(familyCode);
      if (!recipesLoaded) loadRecipes(familyCode);
    }
  }, [familyCode, planLoaded, recipesLoaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (familyCode) await Promise.all([loadPlan(familyCode), loadRecipes(familyCode)]);
    setRefreshing(false);
  }, [familyCode]);

  function getSlotData(day: Day, slot: MealSlotKey) {
    return plan.slots[`${day}_${slot}`] ?? null;
  }

  async function assignRecipe(recipe: Recipe) {
    if (!pickingSlot) return;
    await setSlot(weekStart, familyCode, pickingSlot.day, pickingSlot.slot, {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      emoji: recipe.emoji,
      protein: recipe.protein,
      calories: recipe.calories,
      carbs: recipe.carbs,
      fat: recipe.fat,
      cook_time: recipe.cook_time,
    });
    setPickingSlot(null);
  }

  if (!familyCode) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="home" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No family set up yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Create or join a family to plan meals together</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push("/setup")}>
          <Text style={styles.primaryBtnText}>Set Up Family</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (pickingSlot) {
    const compatible = recipes.filter((r) => !r.meal_slots?.length || r.meal_slots.includes(pickingSlot.slot));
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setPickingSlot(null)}>
            <Feather name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.pickerTitle, { color: colors.text }]}>
            {MEAL_SLOTS.find((s) => s.key === pickingSlot.slot)?.label}
          </Text>
          <TouchableOpacity onPress={() => { setPickingSlot(null); router.push("/import-recipe"); }}>
            <Feather name="plus-circle" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 8 }}>
          {compatible.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>No matching recipes. Import one!</Text>
            </View>
          ) : compatible.map((r) => (
            <TouchableOpacity key={r.id} onPress={() => assignRecipe(r)} style={[styles.recipeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emojiBox, { backgroundColor: r.photo_color ?? Colors.primaryLight }]}>
                <Text style={{ fontSize: 22 }}>{r.emoji ?? "🍽️"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recipeName, { color: colors.text }]}>{r.name}</Text>
                <Text style={[styles.recipeMeta, { color: colors.textSecondary }]}>
                  {r.calories ? `${r.calories} cal` : ""}{r.cook_time ? ` · ${r.cook_time}min` : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  const weekDates = getWeekDates(weekStart);
  const dayNutrition = activeSlots.reduce((acc, slot) => {
    const d = getSlotData(selectedDay, slot);
    if (d) { acc.calories += d.calories ?? 0; acc.protein += d.protein ?? 0; acc.carbs += d.carbs ?? 0; acc.fat += d.fat ?? 0; }
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const hasNutrition = dayNutrition.calories > 0 || dayNutrition.protein > 0;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Meal Plan</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{familyGroup?.name ?? "This week"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() => router.push("/generate")}>
            <Feather name="zap" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() =>
            Alert.alert("Clear Week", "Remove all meals?", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: () => clearWeek(weekStart, familyCode) },
            ])
          }>
            <Feather name="trash-2" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll} style={{ flexGrow: 0 }}>
        {DAYS.map((day, i) => {
          const isSelected = day === selectedDay;
          const isToday = day === today;
          const dateNum = new Date(weekDates[i]).getDate();
          return (
            <TouchableOpacity key={day} onPress={() => setSelectedDay(day)} style={[styles.dayBtn, isSelected ? { backgroundColor: Colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.dayLabel, { color: isSelected ? "#fff" : colors.textSecondary }]}>{DAY_LABELS[day]}</Text>
              <Text style={[styles.dayNum, { color: isSelected ? "#fff" : colors.text }]}>{dateNum}</Text>
              {isToday && <View style={[styles.todayDot, { backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : Colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}
      >
        {hasNutrition && (
          <View style={[styles.nutRow, { backgroundColor: Colors.primaryLight }]}>
            {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
              <View key={k} style={{ alignItems: "center" }}>
                <Text style={styles.nutVal}>{Math.round(dayNutrition[k])}{k !== "calories" ? "g" : ""}</Text>
                <Text style={styles.nutKey}>{k === "calories" ? "Cal" : k[0].toUpperCase() + k.slice(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {activeSlots.map((slotKey) => {
          const slotInfo = MEAL_SLOTS.find((s) => s.key === slotKey)!;
          const sc = Colors.mealSlots[slotKey];
          const data = getSlotData(selectedDay, slotKey);
          return (
            <View key={slotKey} style={[styles.slotCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.slotHead, { backgroundColor: sc.bg }]}>
                <View style={[styles.slotDot, { backgroundColor: sc.dot }]} />
                <Text style={[styles.slotLabel, { color: sc.text }]}>{slotInfo.label}</Text>
                {data && (
                  <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => Alert.alert("Remove", `Remove ${data.recipe_name}?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => setSlot(weekStart, familyCode, selectedDay, slotKey, null) },
                  ])}>
                    <Feather name="x" size={14} color={sc.text} />
                  </TouchableOpacity>
                )}
              </View>
              {data ? (
                <TouchableOpacity style={styles.mealRow} onPress={() => data.recipe_id && router.push(`/recipe/${data.recipe_id}`)}>
                  <View style={[styles.emojiBox, { backgroundColor: Colors.primaryLight }]}>
                    <Text style={{ fontSize: 22 }}>{data.emoji ?? "🍽️"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recipeName, { color: colors.text }]}>{data.recipe_name}</Text>
                    {(data.calories || data.cook_time) ? (
                      <Text style={[styles.recipeMeta, { color: colors.textSecondary }]}>
                        {data.calories ? `${data.calories} cal` : ""}{data.cook_time ? ` · ${data.cook_time}min` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.addBtn} onPress={() => setPickingSlot({ day: selectedDay, slot: slotKey })}>
                  <Feather name="plus" size={15} color={colors.textSecondary} />
                  <Text style={[styles.addBtnText, { color: colors.textSecondary }]}>Add meal</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {MEAL_SLOT_KEYS.filter((k) => !activeSlots.includes(k)).length > 0 && (
          <TouchableOpacity style={[styles.dashedBtn, { borderColor: colors.border }]} onPress={() => {
            const available = MEAL_SLOT_KEYS.filter((k) => !activeSlots.includes(k));
            Alert.alert("Add Meal Slot", "Which slot?",
              available.map((k) => ({ text: MEAL_SLOTS.find((s) => s.key === k)?.label ?? k, onPress: () => setActiveSlots(weekStart, familyCode, [...activeSlots, k]) }))
                .concat([{ text: "Cancel", style: "cancel" } as any])
            );
          }}>
            <Feather name="plus" size={16} color={colors.textSecondary} />
            <Text style={[styles.addBtnText, { color: colors.textSecondary }]}>Add meal slot</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  primaryBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dayScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dayBtn: { width: 48, height: 60, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2 },
  dayLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dayNum: { fontSize: 17, fontFamily: "Inter_700Bold" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  nutRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderRadius: 14 },
  nutVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primaryDark },
  nutKey: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.primaryDark, opacity: 0.7 },
  slotCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  slotHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
  slotLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mealRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  emojiBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  recipeMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  addBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  dashedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed" },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  pickerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  recipeRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
});
