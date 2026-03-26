import { useEffect, useMemo, useState } from "react";
import { Plus, Check, Trash2, List, CircleAlert, CalendarClock, ChevronRight, ChevronDown, CalendarPlus, CalendarCheck } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useCalendarStore, useListsStore, useFamilyStore, useNotificationsStore } from "@/stores/huddle-stores";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const EMOJI_PRESETS = ["🏠", "🎁", "🎉", "🧒", "🔨", "🛒", "📌", "✅", "🎂", "🚗", "📚", "💡"];

export default function Lists() {
  const [, setLocation] = useLocation();
  const { familyGroup, profile } = useFamilyStore();
  const { lists, addList, addItem, updateItem, toggleItem, deleteItem, deleteList, linkItemToCalendar, unlinkItemFromCalendar } = useListsStore();
  const { addNotification, shouldNotify, notifications } = useNotificationsStore();
  const { addEvent, updateEvent, deleteEvent } = useCalendarStore();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("🏠");
  const [newListVisibleIds, setNewListVisibleIds] = useState<string[]>([]);

  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [newItemNotes, setNewItemNotes] = useState<Record<string, string>>({});
  const [newItemDueDates, setNewItemDueDates] = useState<Record<string, string>>({});
  const [newItemPriorities, setNewItemPriorities] = useState<Record<string, "low" | "medium" | "high">>({});
  const [newItemAssignees, setNewItemAssignees] = useState<Record<string, string>>({});
  const [newItemPushToCalendar, setNewItemPushToCalendar] = useState<Record<string, boolean>>({});

  const members = useMemo(() => {
    const familyMembers = familyGroup?.family_members ?? [];
    const self = profile ? [{ id: profile.id, name: `${profile.name} (Me)` }] : [];
    return [...self, ...familyMembers];
  }, [familyGroup?.family_members, profile]);

  useEffect(() => {
    if (members.length && newListVisibleIds.length === 0) {
      setNewListVisibleIds(members.map((m) => m.id));
    }
  }, [members, newListVisibleIds.length]);

  const assigneeNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [members]);

  const visibleLists = useMemo(() => {
    if (!profile) return [];
    return lists.filter((l) => {
      if (!l.visible_to_member_ids || l.visible_to_member_ids.length === 0) return true;
      return l.visible_to_member_ids.includes(profile.id);
    });
  }, [lists, profile]);

  useEffect(() => {
    if (!familyGroup) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasExisting = (recipientId: string, type: "list_due_soon" | "list_overdue", entityId: string) =>
      notifications.some(
        (n) => n.recipient_id === recipientId && n.type === type && n.entity_id === entityId
      );

    lists.forEach((list) => {
      list.items.forEach((item) => {
        if (item.checked || !item.due_date || !item.assignee_id) return;
        const due = new Date(`${item.due_date}T00:00:00`);
        const dayDiff = Math.floor((due.getTime() - today.getTime()) / 86400000);

        if (dayDiff < 0) {
          if (!hasExisting(item.assignee_id, "list_overdue", item.id) && shouldNotify(item.assignee_id, "list_overdue")) {
            addNotification({
              family_code: familyGroup.code,
              recipient_id: item.assignee_id,
              type: "list_overdue",
              title: "Overdue list item",
              body: `${item.text} is overdue`,
              link_path: "/lists",
              entity_type: "list_item",
              entity_id: item.id,
            });
          }
          return;
        }

        if (dayDiff <= 1) {
          if (!hasExisting(item.assignee_id, "list_due_soon", item.id) && shouldNotify(item.assignee_id, "list_due_soon")) {
            addNotification({
              family_code: familyGroup.code,
              recipient_id: item.assignee_id,
              type: "list_due_soon",
              title: "List item due soon",
              body: `${item.text} is due ${dayDiff === 0 ? "today" : "tomorrow"}`,
              link_path: "/lists",
              entity_type: "list_item",
              entity_id: item.id,
            });
          }
        }
      });
    });
  }, [lists, notifications, familyGroup, addNotification, shouldNotify]);

  const priorityClass = (priority?: "low" | "medium" | "high") => {
    if (priority === "high") return "text-red-600 bg-red-50";
    if (priority === "low") return "text-slate-600 bg-slate-100";
    return "text-amber-700 bg-amber-50";
  };

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim() || !familyGroup || !profile) return;
    const visible = newListVisibleIds.includes(profile.id)
      ? newListVisibleIds
      : [profile.id, ...newListVisibleIds];
    addList(newListTitle.trim(), familyGroup.code, {
      emoji: newListEmoji,
      visible_to_member_ids: visible,
      created_by_id: profile.id,
    });
    setNewListTitle("");
    setNewListEmoji("🏠");
    setIsCreateOpen(false);
  };

  const handleAddItem = (listId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemTexts[listId];
    if (!text?.trim()) return;
    const wantsCalendar = Boolean(newItemPushToCalendar[listId]);
    const dueDate = newItemDueDates[listId] || undefined;
    if (wantsCalendar && !dueDate) {
      toast({
        title: "Due date required",
        description: "Add a due date to push this item to calendar.",
      });
      return;
    }
    const assigneeId = newItemAssignees[listId] || undefined;
    const newItemId = addItem(listId, text.trim(), {
      notes: newItemNotes[listId] || undefined,
      due_date: dueDate,
      priority: newItemPriorities[listId] || "medium",
      assignee_id: assigneeId,
    });
    if (wantsCalendar) pushItemToCalendar(listId, newItemId, text.trim(), dueDate);
    if (familyGroup && assigneeId) {
      if (shouldNotify(assigneeId, "list_assigned")) {
        addNotification({
          family_code: familyGroup.code,
          recipient_id: assigneeId,
          type: "list_assigned",
          title: "New assigned list item",
          body: text.trim(),
          link_path: "/lists",
          entity_type: "list_item",
        });
      }
    }
    setNewItemTexts((p) => ({ ...p, [listId]: "" }));
    setNewItemNotes((p) => ({ ...p, [listId]: "" }));
    setNewItemDueDates((p) => ({ ...p, [listId]: "" }));
    setNewItemPriorities((p) => ({ ...p, [listId]: "medium" }));
    setNewItemAssignees((p) => ({ ...p, [listId]: "" }));
    setNewItemPushToCalendar((p) => ({ ...p, [listId]: false }));
    setAddingToListId(null);
  };

  const renderNotes = (notes?: string) => {
    if (!notes) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (
      <p className="text-xs text-muted-foreground mt-1 break-words">
        {notes.split(urlRegex).map((chunk, i) =>
          chunk.match(urlRegex) ? (
            <a key={i} href={chunk} target="_blank" rel="noreferrer" className="text-primary underline">
              {chunk}
            </a>
          ) : (
            <span key={i}>{chunk}</span>
          )
        )}
      </p>
    );
  };

  const pushItemToCalendar = (listId: string, itemId: string, text: string, dueDate?: string) => {
    if (!familyGroup?.code || !profile) return;
    if (!dueDate) {
      toast({
        title: "Add a due date first",
        description: "Set a due date on this list item before pushing it to calendar.",
      });
      return;
    }
    const event = addEvent({
      family_code: familyGroup.code,
      title: text,
      notes: `From list: ${listId}`,
      start_date: dueDate,
      all_day: true,
      recurrence: "none",
      alerts_enabled: true,
      visible_to_member_ids: [],
      created_by_id: profile.id,
      source: "manual",
    });
    linkItemToCalendar(listId, itemId, event.id, true);
    toast({
      title: "Added to calendar",
      description: `${text} is now on ${dueDate} with alerts enabled.`,
    });
  };

  const unlinkItemCalendar = (listId: string, itemId: string, eventId?: string) => {
    if (eventId) deleteEvent(eventId);
    unlinkItemFromCalendar(listId, itemId);
    toast({
      title: "Calendar link removed",
      description: "List item is no longer linked to calendar.",
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Shared Lists</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="relative" onClick={() => setLocation("/alerts")}>
              Alerts
              {profile && notifications.some((n) => n.recipient_id === profile.id && !n.read) && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </Button>
            <Button size="icon" onClick={() => setIsCreateOpen(true)}>
              <Plus size={20} />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-3">
        {visibleLists.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <List className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Create your first list with the + button.</p>
          </div>
        ) : (
          visibleLists.map((list) => {
            const total = list.items.length;
            const completed = list.items.filter((i) => i.checked).length;
            const expanded = expandedListId === list.id;
            const adding = addingToListId === list.id;

            return (
              <Card key={list.id} className="p-0 overflow-hidden">
                <div className="px-4 py-3 bg-secondary/20 border-b border-border flex items-center gap-2">
                  <button
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => setExpandedListId((prev) => (prev === list.id ? null : list.id))}
                  >
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-semibold">{list.emoji || "📝"} {list.title}</span>
                  </button>
                  <span className="text-xs text-muted-foreground">{completed}/{total}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAddingToListId((prev) => (prev === list.id ? null : list.id))}>
                    <Plus size={16} />
                  </Button>
                  <button onClick={() => deleteList(list.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>

                {adding && (
                  <form onSubmit={(e) => handleAddItem(list.id, e)} className="p-4 border-b border-border bg-background space-y-2">
                    <Input
                      placeholder="Main list item"
                      value={newItemTexts[list.id] || ""}
                      onChange={(e) => setNewItemTexts((p) => ({ ...p, [list.id]: e.target.value }))}
                    />
                    <Input
                      placeholder="Notes (links/details)"
                      value={newItemNotes[list.id] || ""}
                      onChange={(e) => setNewItemNotes((p) => ({ ...p, [list.id]: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={newItemPriorities[list.id] || "medium"}
                        onChange={(e) => setNewItemPriorities((p) => ({ ...p, [list.id]: e.target.value as "low" | "medium" | "high" }))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={newItemAssignees[list.id] || ""}
                        onChange={(e) => setNewItemAssignees((p) => ({ ...p, [list.id]: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={newItemDueDates[list.id] || ""}
                        onChange={(e) => setNewItemDueDates((p) => ({ ...p, [list.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit">Add</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={Boolean(newItemPushToCalendar[list.id])}
                          onChange={(e) => setNewItemPushToCalendar((p) => ({ ...p, [list.id]: e.target.checked }))}
                        />
                        Push to calendar
                      </label>
                    </div>
                  </form>
                )}

                {expanded && (
                  <div className="p-4 space-y-2">
                    {list.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No items yet.</p>
                    ) : (
                      list.items.map((item) => (
                        <div key={item.id} className="rounded-md border border-border p-3">
                          {editingItemId === item.id ? (
                            <form
                              className="space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const nextText = newItemTexts[item.id] || item.text;
                                const nextDueDate = newItemDueDates[item.id] || item.due_date;
                                const nextNotes = newItemNotes[item.id] || item.notes;
                                const nextPriority = (newItemPriorities[item.id] || item.priority || "medium");
                                const nextAssignee = newItemAssignees[item.id] || item.assignee_id;
                                updateItem(list.id, item.id, {
                                  text: nextText,
                                  notes: nextNotes,
                                  due_date: nextDueDate,
                                  priority: nextPriority,
                                  assignee_id: nextAssignee,
                                });
                                if (item.calendar_event_id) {
                                  if (nextDueDate) {
                                    updateEvent(item.calendar_event_id, {
                                      title: nextText,
                                      start_date: nextDueDate,
                                      alerts_enabled: item.calendar_alerts_enabled ?? true,
                                    });
                                  } else {
                                    deleteEvent(item.calendar_event_id);
                                    unlinkItemFromCalendar(list.id, item.id);
                                    toast({
                                      title: "Calendar event removed",
                                      description: "Due date was cleared, so the linked calendar event was removed.",
                                    });
                                  }
                                }
                                setEditingItemId(null);
                              }}
                            >
                              <Input value={newItemTexts[item.id] ?? item.text} onChange={(e) => setNewItemTexts((p) => ({ ...p, [item.id]: e.target.value }))} />
                              <Input value={newItemNotes[item.id] ?? item.notes ?? ""} onChange={(e) => setNewItemNotes((p) => ({ ...p, [item.id]: e.target.value }))} />
                              <div className="grid grid-cols-3 gap-2">
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={newItemPriorities[item.id] || item.priority || "medium"}
                                  onChange={(e) => setNewItemPriorities((p) => ({ ...p, [item.id]: e.target.value as "low" | "medium" | "high" }))}
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={newItemAssignees[item.id] || item.assignee_id || ""}
                                  onChange={(e) => setNewItemAssignees((p) => ({ ...p, [item.id]: e.target.value }))}
                                >
                                  <option value="">Unassigned</option>
                                  {members.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="date"
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={newItemDueDates[item.id] || item.due_date || ""}
                                  onChange={(e) => setNewItemDueDates((p) => ({ ...p, [item.id]: e.target.value }))}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setEditingItemId(null)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleItem(list.id, item.id)}
                                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                  item.checked ? "bg-primary border-primary text-white" : "border-border"
                                }`}
                              >
                                {item.checked && <Check size={12} strokeWidth={3} />}
                              </button>
                              <button className="text-left flex-1" onClick={() => setEditingItemId(item.id)}>
                                <p className={`text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}>{item.text}</p>
                                {renderNotes(item.notes)}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {item.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityClass(item.priority)}`}>{item.priority}</span>}
                                  {item.assignee_id && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                                      {assigneeNameById.get(item.assignee_id) ?? "Assigned"}
                                    </span>
                                  )}
                                  {item.due_date && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${
                                      !item.checked && item.due_date < new Date().toISOString().slice(0, 10)
                                        ? "bg-red-50 text-red-700"
                                        : "bg-blue-50 text-blue-700"
                                    }`}>
                                      {!item.checked && item.due_date < new Date().toISOString().slice(0, 10)
                                        ? <CircleAlert size={10} />
                                        : <CalendarClock size={10} />}
                                      {item.due_date}
                                    </span>
                                  )}
                                  {item.calendar_event_id ? (
                                    <>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-green-50 text-green-700">
                                        <CalendarCheck size={10} />
                                        On calendar
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          unlinkItemCalendar(list.id, item.id, item.calendar_event_id);
                                        }}
                                        className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      >
                                        Remove link
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        pushItemToCalendar(list.id, item.id, item.text, item.due_date);
                                      }}
                                      className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-purple-50 text-purple-700 hover:bg-purple-100"
                                    >
                                      <CalendarPlus size={10} />
                                      Push to calendar
                                    </button>
                                  )}
                                </div>
                              </button>
                              <button onClick={() => deleteItem(list.id, item.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>Pick an emoji and choose which family members can see this list.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateList}>
            <Input
              placeholder="List name"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
            />
            <div>
              <p className="text-sm font-medium mb-2">Emoji</p>
              <div className="flex flex-wrap gap-2">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewListEmoji(emoji)}
                    className={`h-10 w-10 rounded-md border text-lg ${
                      newListEmoji === emoji ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Visible to</p>
              <div className="space-y-2">
                {members.map((m) => {
                  const active = newListVisibleIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setNewListVisibleIds((prev) => (active ? prev.filter((id) => id !== m.id) : [...prev, m.id]))
                        }
                      />
                      {m.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
