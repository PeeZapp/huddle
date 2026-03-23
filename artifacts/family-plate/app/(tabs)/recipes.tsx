import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  useColorScheme, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useRecipeStore } from "@/stores/recipeStore";
import type { Recipe } from "@/lib/types";

const CUISINES = ["All", "Western", "Asian", "Indian", "Italian", "Thai", "Mexican", "Mediterranean", "Japanese", "Korean", "Middle Eastern", "Other"];

export default function RecipesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { familyGroup, profile } = useFamilyStore();
  const { recipes, loaded, load, remove } = useRecipeStore();

  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";
  const [search, setSearch] = useState("");
  const [filterCuisine, setFilterCuisine] = useState("All");
  const [filterVeg, setFilterVeg] = useState(false);

  useEffect(() => {
    if (familyCode && !loaded) load(familyCode);
  }, [familyCode, loaded]);

  const filtered = useMemo(() => {
    return recipes
      .filter((r) => !r.is_component)
      .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .filter((r) => filterCuisine === "All" || r.cuisine === filterCuisine)
      .filter((r) => !filterVeg || r.vegetarian)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, search, filterCuisine, filterVeg]);

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Recipes</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() => router.push("/import-recipe")}>
            <Feather name="download" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.inputBg }]} onPress={() => router.push("/generate")}>
            <Feather name="zap" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search recipes..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={16} color={colors.textSecondary} /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={{ flexGrow: 0 }}>
        {CUISINES.map((c) => (
          <TouchableOpacity key={c} onPress={() => setFilterCuisine(c)} style={[styles.filterChip, filterCuisine === c ? { backgroundColor: Colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.filterChipText, { color: filterCuisine === c ? "#fff" : colors.text }]}>{c}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setFilterVeg((v) => !v)} style={[styles.filterChip, filterVeg ? { backgroundColor: "#22C55E" } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.filterChipText, { color: filterVeg ? "#fff" : colors.text }]}>Vegetarian</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book-open" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {recipes.length === 0 ? "No recipes yet" : "No results"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {recipes.length === 0 ? "Import recipes from URLs, text, or photos" : "Try a different search or filter"}
            </Text>
            {recipes.length === 0 && (
              <TouchableOpacity style={[styles.importBtn, { backgroundColor: Colors.primary }]} onPress={() => router.push("/import-recipe")}>
                <Text style={styles.importBtnText}>Import Recipe</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filtered.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} colors={colors} onPress={() => router.push(`/recipe/${recipe.id}`)}
            onDelete={() => Alert.alert("Delete Recipe", `Delete "${recipe.name}"?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove(recipe.id) },
            ])}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function RecipeCard({ recipe, colors, onPress, onDelete }: { recipe: Recipe; colors: any; onPress: () => void; onDelete: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onDelete} style={[styles.recipeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.recipeEmoji, { backgroundColor: recipe.photo_color ?? Colors.primaryLight }]}>
        <Text style={{ fontSize: 28 }}>{recipe.emoji ?? "🍽️"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recipeName, { color: colors.text }]}>{recipe.name}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          {recipe.cuisine && <Tag icon="globe" label={recipe.cuisine} color={colors.textSecondary} />}
          {recipe.cook_time ? <Tag icon="clock" label={`${recipe.cook_time}min`} color={colors.textSecondary} /> : null}
          {recipe.calories ? <Tag icon="zap" label={`${recipe.calories} cal`} color={colors.textSecondary} /> : null}
          {recipe.vegetarian && <Tag icon="leaf" label="Veg" color="#22C55E" />}
        </View>
        {recipe.meal_slots && recipe.meal_slots.length > 0 && (
          <View style={{ flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {recipe.meal_slots.map((s) => {
              const sc = Colors.mealSlots[s];
              return (
                <View key={s} style={[styles.slotBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.slotBadgeText, { color: sc.text }]}>{s.replace("_", " ")}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function Tag({ icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Feather name={icon} size={11} color={color} />
      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filters: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  recipeCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 12 },
  recipeEmoji: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  slotBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  slotBadgeText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  importBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  importBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
