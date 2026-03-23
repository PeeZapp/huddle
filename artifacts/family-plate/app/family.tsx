import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  useColorScheme, Alert, Modal, Clipboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import type { FamilyMember } from "@/lib/types";
import { generateId } from "@/lib/idgen";

const MEMBER_TYPES: { value: FamilyMember["type"]; label: string; emoji: string }[] = [
  { value: "adult", label: "Adult", emoji: "🧑" },
  { value: "child", label: "Child", emoji: "👧" },
  { value: "toddler", label: "Toddler", emoji: "🧒" },
  { value: "baby", label: "Baby", emoji: "👶" },
];

const COUNTRIES = ["Australia","United States","United Kingdom","Canada","New Zealand","Germany","France","Italy","Spain","Netherlands","Japan","India","Brazil","Mexico","South Africa","Singapore","South Korea","Sweden","Norway","Denmark","Switzerland","China","Israel","UAE","Saudi Arabia","Argentina","Chile"];

const CURRENCY_MAP: Record<string, string> = {
  "Australia": "A$", "United States": "$", "United Kingdom": "£", "Canada": "C$", "New Zealand": "NZ$",
  "Germany": "€", "France": "€", "Italy": "€", "Spain": "€", "Netherlands": "€", "Japan": "¥",
  "India": "₹", "Brazil": "R$", "Mexico": "$", "South Africa": "R", "Singapore": "S$",
  "South Korea": "₩", "Sweden": "kr", "Norway": "kr", "Denmark": "kr", "Switzerland": "CHF",
  "China": "¥", "Israel": "₪", "UAE": "AED", "Saudi Arabia": "SAR", "Argentina": "$", "Chile": "$",
};

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { familyGroup, profile, updateFamily, leaveFamily, joinFamily } = useFamilyStore();
  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";

  const [copied, setCopied] = useState(false);
  const [editName, setEditName] = useState(familyGroup?.name ?? "");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberType, setNewMemberType] = useState<FamilyMember["type"]>("adult");
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showCountry, setShowCountry] = useState(false);

  useEffect(() => {
    if (familyGroup?.name) setEditName(familyGroup.name);
  }, [familyGroup?.name]);

  function copyCode() {
    Clipboard.setString(familyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveName() {
    if (!editName.trim()) return;
    await updateFamily({ name: editName.trim() });
    Alert.alert("Saved", "Family name updated.");
  }

  async function addMember() {
    if (!newMemberName.trim()) return;
    const existing = familyGroup?.family_members ?? [];
    await updateFamily({ family_members: [...existing, { id: generateId(), name: newMemberName.trim(), type: newMemberType }] });
    setNewMemberName("");
    setShowAddMember(false);
  }

  async function removeMember(id: string) {
    const existing = familyGroup?.family_members ?? [];
    await updateFamily({ family_members: existing.filter((m) => m.id !== id) });
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await joinFamily(joinCode.trim().toUpperCase());
      setShowJoin(false);
      Alert.alert("Joined!", "You've joined the family group.");
    } catch {
      Alert.alert("Not Found", "Family code not found. Make sure it's correct.");
    }
    setJoining(false);
  }

  async function setCountry(country: string) {
    await updateFamily({ country, currency: CURRENCY_MAP[country] ?? "$" });
    setShowCountry(false);
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Family Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}>
        {/* Family Code */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Family Group</Text>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Family Name</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, flex: 1 }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. The Smiths"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
                <TouchableOpacity style={[styles.saveBtn, { borderColor: Colors.primary }]} onPress={saveName}>
                  <Text style={[styles.saveBtnText, { color: Colors.primary }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Share this code to invite family members</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={[styles.codeBox, { backgroundColor: colors.inputBg, flex: 1 }]}>
                  <Text style={[styles.codeText, { color: colors.text }]}>{familyCode}</Text>
                </View>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: Colors.primaryLight }]} onPress={copyCode}>
                  <Feather name={copied ? "check" : "copy"} size={18} color={copied ? "#22C55E" : Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Country */}
            <View style={{ gap: 4 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Country (for cost estimates)</Text>
              <TouchableOpacity style={[styles.input, { backgroundColor: colors.inputBg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]} onPress={() => setShowCountry(true)}>
                <Text style={[{ color: familyGroup?.country ? colors.text : colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {familyGroup?.country ?? "Select country..."}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Switch family */}
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8 }} onPress={() => setShowJoin((v) => !v)}>
              <Feather name="link" size={16} color={colors.textSecondary} />
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>Switch to a different family code</Text>
            </TouchableOpacity>
            {showJoin && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, flex: 1, textAlign: "center", fontFamily: "Inter_600SemiBold", letterSpacing: 2 }]} placeholder="FP-XXXX" placeholderTextColor={colors.textSecondary} value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
                <TouchableOpacity style={[styles.saveBtn, { borderColor: Colors.primary, opacity: joining ? 0.5 : 1 }]} onPress={handleJoin} disabled={joining}>
                  <Text style={[styles.saveBtnText, { color: Colors.primary }]}>{joining ? "..." : "Join"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Leave */}
            <TouchableOpacity onPress={() => Alert.alert("Leave Family", "You'll lose access to this family's data. Continue?", [
              { text: "Cancel", style: "cancel" },
              { text: "Leave", style: "destructive", onPress: async () => { await leaveFamily(); router.replace("/setup"); } },
            ])}>
              <Text style={[styles.linkText, { color: colors.destructive }]}>
                <Feather name="log-out" size={14} color={colors.destructive} /> Leave this family group
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Family Members */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Family Members</Text>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: Colors.primaryLight }]} onPress={() => setShowAddMember((v) => !v)}>
              <Feather name="plus" size={14} color={Colors.primary} />
              <Text style={[styles.smallBtnText, { color: Colors.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>

          {showAddMember && (
            <View style={[styles.addForm, { backgroundColor: colors.inputBg }]}>
              <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} placeholder="Name..." placeholderTextColor={colors.textSecondary} value={newMemberName} onChangeText={setNewMemberName} autoFocus returnKeyType="done" onSubmitEditing={addMember} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {MEMBER_TYPES.map((t) => (
                  <TouchableOpacity key={t.value} onPress={() => setNewMemberType(t.value)}
                    style={[styles.typeBtn, { backgroundColor: newMemberType === t.value ? Colors.primary : colors.card }]}>
                    <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                    <Text style={[styles.typeBtnText, { color: newMemberType === t.value ? "#fff" : colors.textSecondary }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.saveBtn, { borderColor: Colors.primary, flex: 1 }]} onPress={addMember}>
                  <Text style={[styles.saveBtnText, { color: Colors.primary }]}>Add Member</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, { borderColor: colors.border }]} onPress={() => setShowAddMember(false)}>
                  <Text style={[styles.saveBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(familyGroup?.family_members ?? []).length === 0 && !showAddMember ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No members added yet. Add your family!</Text>
          ) : (familyGroup?.family_members ?? []).map((member) => {
            const typeInfo = MEMBER_TYPES.find((t) => t.value === member.type) ?? MEMBER_TYPES[0];
            return (
              <View key={member.id} style={[styles.memberRow, { backgroundColor: colors.inputBg }]}>
                <Text style={{ fontSize: 28 }}>{typeInfo.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
                  <Text style={[styles.memberType, { color: colors.textSecondary }]}>{typeInfo.label}</Text>
                </View>
                <TouchableOpacity onPress={() => Alert.alert("Remove", `Remove ${member.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeMember(member.id) }])}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Country Picker */}
      <Modal visible={showCountry} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCountry(false)} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Country</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map((country) => (
                <TouchableOpacity key={country} style={[styles.countryRow, { borderBottomColor: colors.border }]} onPress={() => setCountry(country)}>
                  <Text style={[styles.countryText, { color: colors.text }]}>{country}</Text>
                  {familyGroup?.country === country && <Feather name="check" size={16} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 14 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 12, fontFamily: "Inter_400Regular" },
  input: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  codeBox: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  codeText: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  copyBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveBtn: { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  smallBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  addForm: { borderRadius: 12, padding: 12, gap: 10 },
  typeBtn: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, borderRadius: 10 },
  typeBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  memberName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  memberType: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: "80%" },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  countryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  countryText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
