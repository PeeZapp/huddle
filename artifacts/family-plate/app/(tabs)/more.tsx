import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { familyGroup, profile } = useFamilyStore();
  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";

  const menuItems = [
    { icon: "bar-chart-2", label: "Nutrition", subtitle: "Track daily goals and food logs", route: "/nutrition" },
    { icon: "users", label: "Family Settings", subtitle: familyCode ? `Code: ${familyCode}` : "Set up your family", route: familyCode ? "/family" : "/setup" },
    { icon: "download", label: "Import Recipe", subtitle: "Import from URL, text, or photo", route: "/import-recipe" },
    { icon: "zap", label: "Generate Recipes", subtitle: "AI-powered meal suggestions", route: "/generate" },
  ] as const;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>More</Text>
      </View>

      {familyGroup && (
        <View style={[styles.familyBanner, { backgroundColor: Colors.primaryLight }]}>
          <View style={styles.familyIcon}>
            <Feather name="home" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.familyName, { color: Colors.primaryDark }]}>{familyGroup.name}</Text>
            <Text style={[styles.familyCode, { color: Colors.primary }]}>{familyCode}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 80 }}>
        {menuItems.map(({ icon, label, subtitle, route }) => (
          <TouchableOpacity key={label} style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
            <View style={[styles.menuIcon, { backgroundColor: Colors.primaryLight }]}>
              <Feather name={icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  familyBanner: { flexDirection: "row", alignItems: "center", gap: 12, margin: 16, borderRadius: 16, padding: 14 },
  familyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  familyName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  familyCode: { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  menuIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  menuSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
