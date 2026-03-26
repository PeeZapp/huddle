import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, isAfter, isBefore, isEqual, parseISO, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { useCalendarStore, useFamilyStore, useNotificationsStore } from "@/stores/huddle-stores";
import { FamilyCalendarEvent } from "@/lib/types";

const RECURRENCE_OPTIONS: Array<FamilyCalendarEvent["recurrence"]> = ["none", "daily", "weekly", "monthly", "yearly"];

function occursOnDate(event: FamilyCalendarEvent, date: Date): boolean {
  const start = parseISO(event.start_date);
  const end = event.end_date ? parseISO(event.end_date) : start;
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (event.recurrence === "none") {
    return (isEqual(day, startDay) || isAfter(day, startDay)) && (isEqual(day, endDay) || isBefore(day, endDay));
  }
  if (event.recurrence === "daily") return isEqual(day, startDay) || isAfter(day, startDay);
  if (event.recurrence === "weekly") return day.getDay() === startDay.getDay() && (isEqual(day, startDay) || isAfter(day, startDay));
  if (event.recurrence === "monthly") return day.getDate() === startDay.getDate() && (isEqual(day, startDay) || isAfter(day, startDay));
  if (event.recurrence === "yearly") return day.getDate() === startDay.getDate() && day.getMonth() === startDay.getMonth();
  return false;
}

export default function Calendar() {
  const { familyGroup, profile } = useFamilyStore();
  const { events, addEvent, updateEvent, deleteEvent, importPublicAndSchoolHolidays, upsertBirthdayEvents } = useCalendarStore();
  const { addNotification, notifications } = useNotificationsStore();
  const [month, setMonth] = useState(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<FamilyCalendarEvent["recurrence"]>("none");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const members = useMemo(() => {
    const fam = familyGroup?.family_members ?? [];
    const me = profile ? [{ id: profile.id, name: `${profile.name} (Me)` }] : [];
    return [...me, ...fam];
  }, [familyGroup?.family_members, profile]);

  useEffect(() => {
    if (!familyGroup?.code) return;
    const year = month.getFullYear();
    if (familyGroup.country) void importPublicAndSchoolHolidays(familyGroup.code, familyGroup.country, year);
    upsertBirthdayEvents(familyGroup.code, familyGroup.family_members ?? []);
  }, [familyGroup?.code, familyGroup?.country, familyGroup?.family_members, importPublicAndSchoolHolidays, month, upsertBirthdayEvents]);

  useEffect(() => {
    if (!familyGroup?.code) return;
    (async () => {
      try {
        const res = await fetch(`/api/calendar/google/status?familyCode=${encodeURIComponent(familyGroup.code)}`);
        if (!res.ok) return;
        const data = await res.json() as { connected: boolean; configured: boolean };
        setGoogleConnected(data.connected);
        setGoogleConfigured(data.configured);
      } catch {
        // silent in UI
      }
    })();
  }, [familyGroup?.code]);

  async function connectGoogle() {
    if (!familyGroup?.code) return;
    const returnTo = `${window.location.origin}/calendar`;
    const res = await fetch(`/api/calendar/google/auth-url?familyCode=${encodeURIComponent(familyGroup.code)}&returnTo=${encodeURIComponent(returnTo)}`);
    if (!res.ok) return;
    const data = await res.json() as { url: string };
    window.location.href = data.url;
  }

  async function disconnectGoogle() {
    if (!familyGroup?.code) return;
    await fetch("/api/calendar/google/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyCode: familyGroup.code }),
    });
    setGoogleConnected(false);
  }

  async function syncGoogleTwoWay() {
    if (!familyGroup?.code) return;
    setSyncBusy(true);
    try {
      // Push local manual events first
      const localEvents = events
        .filter((e) => e.family_code === familyGroup.code)
        .filter((e) => e.source === "manual" || e.source === "birthday" || e.source === "public_holiday" || e.source === "school_holiday")
        .map((e) => ({
          id: e.id,
          title: e.title,
          notes: e.notes,
          start_date: e.start_date,
          end_date: e.end_date,
          all_day: e.all_day,
          recurrence: e.recurrence,
        }));
      const pushRes = await fetch("/api/calendar/google/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyCode: familyGroup.code, events: localEvents }),
      });
      if (pushRes.ok) {
        const pushData = await pushRes.json() as {
          mappings?: Array<{ huddleEventId: string; googleEventId: string }>;
        };
        (pushData.mappings ?? []).forEach((m) => {
          updateEvent(m.huddleEventId, { external_id: m.googleEventId });
        });
      }

      // Pull remote events into local store
      const pullRes = await fetch(`/api/calendar/google/pull?familyCode=${encodeURIComponent(familyGroup.code)}`);
      if (!pullRes.ok) return;
      const pulled = await pullRes.json() as {
        events: Array<{
          external_id: string;
          title: string;
          notes?: string;
          start_date: string;
          end_date?: string;
          all_day: boolean;
          recurrence: FamilyCalendarEvent["recurrence"];
          source: "google";
        }>;
      };
      pulled.events.forEach((e) => {
        const existing = events.find((x) => x.external_id === e.external_id && x.family_code === familyGroup.code);
        if (existing) {
          updateEvent(existing.id, {
            title: e.title,
            notes: e.notes,
            start_date: e.start_date,
            end_date: e.end_date,
            all_day: e.all_day,
            recurrence: e.recurrence,
            source: "google",
            external_id: e.external_id,
          });
        } else {
          addEvent({
            family_code: familyGroup.code,
            title: e.title,
            notes: e.notes,
            start_date: e.start_date,
            end_date: e.end_date,
            all_day: e.all_day,
            recurrence: e.recurrence,
            alerts_enabled: false,
            source: "google",
            external_id: e.external_id,
          });
        }
      });
    } finally {
      setSyncBusy(false);
    }
  }

  async function deleteEventWithSync(event: FamilyCalendarEvent) {
    if (googleConnected && familyGroup?.code && event.external_id) {
      await fetch("/api/calendar/google/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyCode: familyGroup.code,
          googleEventIds: [event.external_id],
        }),
      });
    }
    if (event.id) deleteEvent(event.id);
  }

  const monthGrid = useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const leading = first.getDay(); // 0-6, Sunday-based grid
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  // lightweight in-app alerts for event day.
  useEffect(() => {
    if (!profile || !familyGroup) return;
    const today = format(new Date(), "yyyy-MM-dd");
    events
      .filter((e) => e.alerts_enabled && occursOnDate(e, new Date(today)))
      .forEach((e) => {
        const dedupe = notifications.some((n) => n.entity_id === e.id && n.recipient_id === profile.id && n.type === "general");
        if (dedupe) return;
        addNotification({
          family_code: familyGroup.code,
          recipient_id: profile.id,
          type: "general",
          title: `Today: ${e.title}`,
          body: "Calendar reminder",
          link_path: "/calendar",
          entity_type: "list",
          entity_id: e.id,
        });
      });
  }, [events, profile, familyGroup, addNotification, notifications]);

  const visibleEvents = useMemo(() => {
    if (!profile || !familyGroup) return [];
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return events
      .filter((e) => e.family_code === familyGroup.code)
      .filter((e) => !e.visible_to_member_ids || e.visible_to_member_ids.length === 0 || e.visible_to_member_ids.includes(profile.id))
      .flatMap((e) => {
        const expanded: Array<{ date: string; event: FamilyCalendarEvent }> = [];
        let cursor = monthStart;
        while (!isAfter(cursor, monthEnd)) {
          if (occursOnDate(e, cursor)) expanded.push({ date: format(cursor, "yyyy-MM-dd"), event: e });
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
        return expanded;
      })
      .sort((a, b) => (a.date + a.event.title).localeCompare(b.date + b.event.title));
  }, [events, familyGroup, month, profile]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, FamilyCalendarEvent[]>();
    visibleEvents.forEach(({ date, event }) => {
      const arr = map.get(date) ?? [];
      arr.push(event);
      map.set(date, arr);
    });
    return map;
  }, [visibleEvents]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate.get(selectedDate) ?? [];
  }, [eventsByDate, selectedDate]);

  const createOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !familyGroup?.code || !profile) return;
    if (editingId) {
      updateEvent(editingId, {
        title: title.trim(),
        start_date: startDate,
        end_date: endDate || undefined,
        recurrence,
        alerts_enabled: alertsEnabled,
        visible_to_member_ids: memberIds,
      });
      setEditingId(null);
    } else {
      addEvent({
        family_code: familyGroup.code,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate || undefined,
        all_day: true,
        recurrence,
        alerts_enabled: alertsEnabled,
        visible_to_member_ids: memberIds,
        created_by_id: profile.id,
        source: "manual",
      });
    }
    setTitle("");
    setEndDate("");
    setRecurrence("none");
    setAlertsEnabled(true);
    setMemberIds([]);
    setIsCreating(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Family Calendar</h1>
          <Button size="icon" onClick={() => setIsCreating((v) => !v)}>
            <Plus size={18} />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between bg-background border border-border rounded-xl p-1">
          <button className="p-2 hover:bg-white rounded-lg" onClick={() => setMonth((m) => subMonths(m, 1))}><ChevronLeft size={18} /></button>
          <span className="font-semibold text-sm">{format(month, "MMMM yyyy")}</span>
          <button className="p-2 hover:bg-white rounded-lg" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight size={18} /></button>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant={viewMode === "grid" ? "primary" : "outline"}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "primary" : "outline"}
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <Card className="p-3 border-primary/30 bg-primary/5">
          <p className="text-xs text-muted-foreground">
            Public holidays are imported by country automatically. School holidays are seeded for AU/NZ currently.
            Google 2-way sync is available once server OAuth env vars are configured.
          </p>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-semibold">Calendar Integrations</p>
          <div className="flex items-center justify-between text-sm">
            <span>Google Calendar</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${googleConnected ? "text-green-600" : "text-muted-foreground"}`}>
                {googleConfigured ? (googleConnected ? "Connected" : "Not connected") : "Not configured"}
              </span>
              {!googleConnected ? (
                <Button size="sm" onClick={connectGoogle} disabled={!googleConfigured}>Connect</Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={syncGoogleTwoWay} disabled={syncBusy}>
                    {syncBusy ? "Syncing..." : "Sync now"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={disconnectGoogle}>Disconnect</Button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Apple Calendar (CalDAV/iCloud)</span>
            <span className="text-xs text-muted-foreground">Pending provider setup</span>
          </div>
        </Card>

        {isCreating && (
          <Card className="space-y-3">
            <h2 className="font-semibold text-sm">{editingId ? "Edit event" : "Create event"}</h2>
            <form className="space-y-3" onSubmit={createOrUpdate}>
              <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm w-full" value={recurrence} onChange={(e) => setRecurrence(e.target.value as FamilyCalendarEvent["recurrence"])}>
                {RECURRENCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Visible to</p>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const active = memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMemberIds((prev) => active ? prev.filter((id) => id !== m.id) : [...prev, m.id])}
                        className={`px-3 py-1 rounded-full text-xs border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alertsEnabled} onChange={(e) => setAlertsEnabled(e.target.checked)} />
                Alerts enabled
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button type="submit">{editingId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </Card>
        )}

        {viewMode === "grid" ? (
          <Card className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-[11px] font-semibold text-muted-foreground text-center py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cellDate, idx) => {
                if (!cellDate) return <div key={`empty-${idx}`} className="min-h-20 rounded-md bg-secondary/20" />;
                const dateKey = format(cellDate, "yyyy-MM-dd");
                const dayEvents = eventsByDate.get(dateKey) ?? [];
                return (
                  <button
                    key={dateKey}
                    className={`min-h-20 rounded-md border p-1.5 bg-white text-left ${selectedDate === dateKey ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
                    onClick={() => {
                      setSelectedDate(dateKey);
                      setIsCreating(false);
                    }}
                  >
                    <p className="text-[11px] font-semibold">{format(cellDate, "d")}</p>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <button
                          key={`${ev.id}-${dateKey}`}
                          onClick={() => {
                            setSelectedDate(dateKey);
                            if (ev.source !== "manual") return;
                            setEditingId(ev.id);
                            setIsCreating(true);
                            setTitle(ev.title);
                            setStartDate(ev.start_date);
                            setEndDate(ev.end_date || "");
                            setRecurrence(ev.recurrence);
                            setAlertsEnabled(Boolean(ev.alerts_enabled));
                            setMemberIds(ev.visible_to_member_ids ?? []);
                          }}
                          className="block w-full text-left text-[10px] truncate px-1 py-0.5 rounded bg-primary/10 text-primary"
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleEvents.length === 0 ? (
              <Card className="text-center text-muted-foreground py-10">No events this month.</Card>
            ) : (
              visibleEvents.map(({ date, event }, idx) => (
                <Card key={`${event.id}:${date}:${idx}`} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{format(parseISO(date), "EEE, MMM d")}</p>
                      <p className="font-semibold text-sm">{event.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {event.source?.replace("_", " ")} · {event.recurrence}
                      </p>
                    </div>
                    {event.source === "manual" && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(event.id);
                            setIsCreating(true);
                            setTitle(event.title);
                            setStartDate(event.start_date);
                            setEndDate(event.end_date || "");
                            setRecurrence(event.recurrence);
                            setAlertsEnabled(Boolean(event.alerts_enabled));
                            setMemberIds(event.visible_to_member_ids ?? []);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void deleteEventWithSync(event)}>
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {selectedDate && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Events on {format(parseISO(selectedDate), "EEEE, MMM d")}</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setIsCreating(true);
                  setTitle("");
                  setStartDate(selectedDate);
                  setEndDate("");
                  setRecurrence("none");
                  setAlertsEnabled(true);
                }}
              >
                <Plus size={14} className="mr-1" /> Add Event
              </Button>
            </div>

            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events on this day yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => (
                  <div key={`${ev.id}:${selectedDate}`} className="border border-border rounded-lg p-3">
                    <p className="font-medium text-sm">{ev.title}</p>
                    {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {ev.source === "manual" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(ev.id);
                              setIsCreating(true);
                              setTitle(ev.title);
                              setStartDate(ev.start_date);
                              setEndDate(ev.end_date || "");
                              setRecurrence(ev.recurrence);
                              setAlertsEnabled(Boolean(ev.alerts_enabled));
                              setMemberIds(ev.visible_to_member_ids ?? []);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void deleteEventWithSync(ev)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
