import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  useColorScheme, Alert, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFamilyStore } from "@/stores/familyStore";
import { useListsStore } from "@/stores/listsStore";
import type { FamilyList } from "@/lib/types";

const LIST_COLORS = ["#639922","#3B82F6","#EF4444","#F59E0B","#8B5CF6","#EC4899","#14B8A6"];
const LIST_EMOJIS = ["📋","🛒","🏋️","🎯","✅","📌","🗒️","🎉","🏠","📚"];

export default function ListsScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { familyGroup, profile } = useFamilyStore();
  const { lists, loaded, load, create, remove, addItem, toggleItem, removeItem, clearChecked } = useListsStore();
  const familyCode = familyGroup?.code ?? profile?.family_code ?? "";

  const [selectedList, setSelectedList] = useState<FamilyList | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);
  const [newItemText, setNewItemText] = useState("");

  useEffect(() => {
    if (familyCode && !loaded) load(familyCode);
  }, [familyCode, loaded]);

  async function createList() {
    if (!newTitle.trim() || !familyCode) return;
    const list = await create({ title: newTitle.trim(), emoji: newEmoji, color: newColor, family_code: familyCode });
    setNewTitle("");
    setShowCreate(false);
    setSelectedList(list);
  }

  async function handleAddItem() {
    if (!newItemText.trim() || !selectedList) return;
    await addItem(selectedList.id, newItemText.trim());
    setNewItemText("");
    const updated = lists.find((l) => l.id === selectedList.id);
    if (updated) setSelectedList({ ...updated, items: [...updated.items, { id: "", text: newItemText.trim(), checked: false, created_at: "" }] });
  }

  if (selectedList) {
    const current = lists.find((l) => l.id === selectedList.id) ?? selectedList;
    const unchecked = current.items.filter((i) => !i.checked);
    const checked = current.items.filter((i) => i.checked);
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedList(null)}>
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 12 }}>
            <Text style={{ fontSize: 20 }}>{current.emoji}</Text>
            <Text style={[styles.title, { color: colors.text, fontSize: 18 }]}>{current.title}</Text>
          </View>
          {checked.length > 0 && (
            <TouchableOpacity onPress={() => clearChecked(current.id)}>
              <Feather name="trash-2" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 4, paddingBottom: insets.bottom + 80 }}>
          {unchecked.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => toggleItem(current.id, item.id)} onLongPress={() => Alert.alert("Remove", `Remove "${item.text}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeItem(current.id, item.id) }])}
              style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.checkbox, { borderColor: current.color ?? Colors.primary }]} />
              <Text style={[styles.itemText, { color: colors.text }]}>{item.text}</Text>
            </TouchableOpacity>
          ))}
          {checked.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 12 }]}>Completed ({checked.length})</Text>
              {checked.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => toggleItem(current.id, item.id)} onLongPress={() => removeItem(current.id, item.id)}
                  style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}>
                  <View style={[styles.checkbox, { borderColor: current.color ?? Colors.primary, backgroundColor: current.color ?? Colors.primary }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                  <Text style={[styles.itemText, { color: colors.text, textDecorationLine: "line-through" }]}>{item.text}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
        <View style={[styles.addItemBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.addItemInput, { backgroundColor: colors.inputBg, color: colors.text }]}
            placeholder="Add item..."
            placeholderTextColor={colors.textSecondary}
            value={newItemText}
            onChangeText={setNewItemText}
            returnKeyType="done"
            onSubmitEditing={handleAddItem}
          />
          <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: current.color ?? Colors.primary }]} onPress={handleAddItem}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Lists</Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: Colors.primary }]} onPress={() => setShowCreate(true)}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}>
        {lists.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="list" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No lists yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Create shared lists for groceries, chores, and more</Text>
          </View>
        ) : lists.map((list) => {
          const done = list.items.filter((i) => i.checked).length;
          return (
            <TouchableOpacity key={list.id} onPress={() => setSelectedList(list)} onLongPress={() => Alert.alert("Delete List", `Delete "${list.title}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove(list.id) }])}
              style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.listEmoji, { backgroundColor: `${list.color ?? Colors.primary}22` }]}>
                <Text style={{ fontSize: 24 }}>{list.emoji ?? "📋"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listTitle, { color: colors.text }]}>{list.title}</Text>
                <Text style={[styles.listMeta, { color: colors.textSecondary }]}>{list.items.length} items · {done} done</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCreate(false)} activeOpacity={1}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>New List</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="List name..."
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {LIST_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => setNewEmoji(e)} style={[styles.emojiOption, newEmoji === e && { borderColor: Colors.primary, borderWidth: 2 }]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Color</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {LIST_COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setNewColor(c)} style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotSelected]} />
              ))}
            </View>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: newColor }]} onPress={createList}>
              <Text style={styles.createBtnText}>Create List</Text>
            </TouchableOpacity>
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
  listCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  listEmoji: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  listTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  listMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  addItemBar: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  addItemInput: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  addItemBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
  emojiOption: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  createBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  createBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
