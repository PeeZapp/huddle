import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";

type Mode = null | "name" | "create" | "join";

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveProfile, createFamily, joinFamily, profile } = useFamilyStore();

  const [mode, setMode] = useState<Mode>(profile?.name ? "create" : "name");
  const [name, setName] = useState(profile?.name ?? "");
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSaveName() {
    if (!name.trim()) return;
    await saveProfile(name.trim());
    setMode("create");
  }

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    try {
      const code = await createFamily(familyName || `${name}'s Family`);
      Alert.alert("Family Created!", `Your family code is:\n\n${code}\n\nShare this with family members so they can join.`, [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to create family. Please try again.");
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!joinCode.trim() || loading) return;
    setLoading(true);
    try {
      await joinFamily(joinCode.trim().toUpperCase());
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Not Found", "Family code not found. Check the code and try again.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoBox}>
          <View style={styles.logoCircle}>
            <Feather name="home" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Huddle</Text>
          <Text style={styles.tagline}>Plan family meals together</Text>
        </View>

        {mode === "name" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What's your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoFocus
              onSubmitEditing={handleSaveName}
              returnKeyType="next"
            />
            <TouchableOpacity
              style={[styles.btn, !name.trim() && styles.btnDisabled]}
              onPress={handleSaveName}
              disabled={!name.trim()}
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "create" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hi {name || "there"}!</Text>
            <Text style={styles.cardSubtitle}>Get started by creating or joining a family group</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setMode("create_form")}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.btnText}>Create a Family</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setMode("join")}>
              <Feather name="log-in" size={18} color={Colors.primary} />
              <Text style={[styles.btnText, styles.btnOutlineText]}>Join a Family</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "create_form" && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode("create")}>
              <Feather name="arrow-left" size={20} color="#6B7280" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.cardTitle}>Name your family</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. The Smiths"
              value={familyName}
              onChangeText={setFamilyName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleCreate} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Creating..." : "Create & Get Code"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "join" && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setMode("create")}>
              <Feather name="arrow-left" size={20} color="#6B7280" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.cardTitle}>Enter family code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="e.g. FP-AB4R"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />
            <TouchableOpacity
              style={[styles.btn, (!joinCode.trim() || loading) && styles.btnDisabled]}
              onPress={handleJoin}
              disabled={!joinCode.trim() || loading}
            >
              <Text style={styles.btnText}>{loading ? "Joining..." : "Join Family"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  logoBox: {
    alignItems: "center",
    gap: 8,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginTop: -8,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#111827",
  },
  codeInput: {
    textAlign: "center",
    letterSpacing: 4,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  btnOutlineText: {
    color: Colors.primary,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: -8,
  },
  backText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
});
