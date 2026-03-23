import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  useColorScheme, Modal, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useMealPlanStore } from "@/stores/mealPlanStore";
import { useNutritionStore } from "@/stores/nutritionStore";
import { DAYS, DAY_LABELS, getWeekStart, todayDayKey, type Day } from "@/lib/mealSlots";
import type { NutritionGoals } from "@/lib/types";

const PRESETS: Record<string, NutritionGoals & { label: string }> = {
  maintenance: { calories: 2000, protein: 120, carbs: 250, fat: 65, label: "Maintenance" },
  weightloss: { calories: 1600, protein: 140, carbs: 150, fat: 55, label: "Weight Loss" },
  aggressivecut: { calories: 1300, protein: 150, carbs: 100, fat: 45, label: "Aggressive Cut" },
  muscle: { calories: 2500, protein: 180, carbs: 300, fat: 70, label: "Muscle Gain" },
  bulk: { calories: 3200, protein: 200, carbs: 400, fat: 90, label: "Bulk" },
  keto: { calories: 1800, protein: 120, carbs: 30, fat: 140, label: "Keto" },
  highprotein: { calories: 2000, protein: 200, carbs: 180, fat: 55, label: "High Protein" },
  plantbased: { calories: 1900, protein: 90, carbs: 280, fat: 60, label: "Plant-Based" },
};

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { familyGroup, profile } = useFamilyStore();
  const { getPlan, loaded: planLoaded, load: loadPlan } = useMealPlanStore();
  const { goals, loaded: nutritionLoaded, load: loadNutrition, saveGoals, logs, addLog, removeLog } = useNutritionStore();

  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";
  const weekStart = getWeekStart();
  const today = todayDayKey();
  const plan = getPlan(weekStart, familyCode);

  const [tab, setTab] = useState<"summary" | "log">("summary");
  const [showGoals, setShowGoals] = useState(false);
  const [editGoals, setEditGoals] = useState<NutritionGoals>(goals);
  const [showAddLog, setShowAddLog] = useState(false);
  const [logMeal, setLogMeal] = useState("");
  const [logCal, setLogCal] = useState("");
  const [logProtein, setLogProtein] = useState("");

  useEffect(() => {
    if (familyCode) {
      if (!planLoaded) loadPlan(familyCode);
      if (!nutritionLoaded) loadNutrition(familyCode);
    }
  }, [familyCode]);

  useEffect(() => {
    setEditGoals(goals);
  }, [goals]);

  function getDayNutrition(day: Day) {
    const totals = { protein: 0, calories: 0, carbs: 0, fat: 0 };
    Object.entries(plan.slots).forEach(([key, meal]) => {
      if (key.startsWith(day)) {
        totals.protein += meal.protein ?? 0;
        totals.calories += meal.calories ?? 0;
        totals.carbs += meal.carbs ?? 0;
        totals.fat += meal.fat ?? 0;
      }
    });
    const todayStr = new Date().toISOString().split("T")[0];
    logs.filter((l) => l.date === todayStr && l.is_personal).forEach((l) => {
      totals.protein += l.protein ?? 0;
      totals.calories += l.calories ?? 0;
      totals.carbs += l.carbs ?? 0;
      totals.fat += l.fat ?? 0;
    });
    return totals;
  }

  const todayNutrition = getDayNutrition(today);
  const weekAvg = DAYS.reduce((acc, day) => {
    const n = getDayNutrition(day);
    acc.protein += n.protein / 7;
    acc.calories += n.calories / 7;
    acc.carbs += n.carbs / 7;
    acc.fat += n.fat / 7;
    return acc;
  }, { protein: 0, calories: 0, carbs: 0, fat: 0 });

  async function addFoodLog() {
    if (!logMeal.trim() || !familyCode) return;
    await addLog({
      family_code: familyCode,
      date: new Date().toISOString().split("T")[0],
      meal_name: logMeal.trim(),
      calories: logCal ? Number(logCal) : undefined,
      protein: logProtein ? Number(logProtein) : undefined,
      is_personal: true,
    });
    setLogMeal("");
    setLogCal("");
    setLogProtein("");
    setShowAddLog(false);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter((l) => l.date === todayStr);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Nutrition</Text>
        <TouchableOpacity onPress={() => setShowGoals(true)}>
          <Feather name="settings" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab toggle */}
      <View style={[styles.tabBar, { backgroundColor: colors.inputBg, margin: 16, marginBottom: 0 }]}>
        {(["summary", "log"] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { backgroundColor: colors.card }]}>
            <Text style={[styles.tabBtnText, { color: tab === t ? colors.text : colors.textSecondary }]}>
              {t === "summary" ? "Summary" : "Food Log"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}>
        {tab === "summary" ? (
          <>
            {/* Today */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Today — {DAY_LABELS[today]}</Text>
              {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                <NutBar key={key} label={key} value={Math.round(todayNutrition[key])} goal={goals[key]} colors={colors} />
              ))}
            </View>

            {/* Week Avg */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly Average</Text>
              {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                <NutBar key={key} label={key} value={Math.round(weekAvg[key])} goal={goals[key]} colors={colors} />
              ))}
            </View>

            {/* Daily Breakdown */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Breakdown</Text>
              {DAYS.map((day, i) => {
                const n = getDayNutrition(day);
                return (
                  <View key={day} style={[styles.dayRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <Text style={[styles.dayLabel, { color: day === today ? Colors.primary : colors.text }]}>{DAY_LABELS[day]}</Text>
                    <View style={styles.dayNut}>
                      <Text style={[styles.dayNutText, { color: colors.textSecondary }]}>{Math.round(n.protein)}g P</Text>
                      <Text style={[styles.dayNutText, { color: colors.textSecondary }]}>{Math.round(n.calories)} cal</Text>
                      <Text style={[styles.dayNutText, { color: colors.textSecondary }]}>{Math.round(n.carbs)}g C</Text>
                      <Text style={[styles.dayNutText, { color: colors.textSecondary }]}>{Math.round(n.fat)}g F</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: Colors.primary }]} onPress={() => setShowAddLog(true)}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Log Food</Text>
            </TouchableOpacity>

            {todayLogs.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="book" size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No food logged today</Text>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Today's Log</Text>
                {todayLogs.map((log, i) => (
                  <TouchableOpacity key={log.id} onLongPress={() => Alert.alert("Remove", `Remove "${log.meal_name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeLog(log.id) }])}
                    style={[styles.logRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.logName, { color: colors.text }]}>{log.meal_name}</Text>
                      {(log.calories || log.protein) ? (
                        <Text style={[styles.logMeta, { color: colors.textSecondary }]}>
                          {log.calories ? `${log.calories} cal` : ""}{log.protein ? ` · ${log.protein}g protein` : ""}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Goals Modal */}
      <Modal visible={showGoals} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowGoals(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Daily Goals</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Quick Presets</Text>
              <View style={styles.presetGrid}>
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <TouchableOpacity key={key} style={[styles.presetBtn, { backgroundColor: colors.inputBg }]} onPress={() => { const { label, ...g } = preset; saveGoals(g); setShowGoals(false); }}>
                    <Text style={[styles.presetText, { color: colors.text }]}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>Custom Goals</Text>
              {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                <View key={key} style={{ marginBottom: 12 }}>
                  <Text style={[styles.goalKey, { color: colors.text }]}>{key.charAt(0).toUpperCase() + key.slice(1)}: {editGoals[key]}{key !== "calories" ? "g" : " cal"}</Text>
                </View>
              ))}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.primary }]} onPress={() => { saveGoals(editGoals); setShowGoals(false); }}>
                <Text style={styles.saveBtnText}>Save Goals</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Log Modal */}
      <Modal visible={showAddLog} animationType="slide" transparent>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowAddLog(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Log Food</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]} placeholder="Meal name..." placeholderTextColor={colors.textSecondary} value={logMeal} onChangeText={setLogMeal} autoFocus />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, flex: 1 }]} placeholder="Calories" placeholderTextColor={colors.textSecondary} value={logCal} onChangeText={setLogCal} keyboardType="numeric" />
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, flex: 1 }]} placeholder="Protein (g)" placeholderTextColor={colors.textSecondary} value={logProtein} onChangeText={setLogProtein} keyboardType="numeric" />
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.primary }]} onPress={addFoodLog}>
              <Text style={styles.saveBtnText}>Add to Log</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function NutBar({ label, value, goal, colors }: { label: string; value: number; goal: number; colors: any }) {
  const pct = Math.min((value / Math.max(goal, 1)) * 100, 100);
  const barColors: Record<string, string> = { calories: "#F97316", protein: "#3B82F6", carbs: "#8B5CF6", fat: "#EF4444" };
  const barColor = barColors[label] ?? Colors.primary;
  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.text }}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary }}>{value} / {goal}{label !== "calories" ? "g" : " cal"}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.inputBg, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: barColor, borderRadius: 4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", borderRadius: 14, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  dayLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 32 },
  dayNut: { flexDirection: "row", gap: 10 },
  dayNutText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  addBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  logRow: { paddingVertical: 10 },
  logName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  logMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, maxHeight: "85%" },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  presetText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  goalKey: { fontSize: 14, fontFamily: "Inter_500Medium" },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
