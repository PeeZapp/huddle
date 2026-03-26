import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useFamilyStore, useNotificationsStore } from "@/stores/huddle-stores";

export default function Alerts() {
  const [, setLocation] = useLocation();
  const { profile } = useFamilyStore();
  const {
    notifications,
    markReadForRecipient,
    markAllReadForRecipient,
    clearAllForRecipient,
    clearOneForRecipient,
    getPrefsForRecipient,
    setPrefsForRecipient,
  } = useNotificationsStore();

  if (!profile) return null;

  const myNotifications = notifications.filter((n) => n.recipient_id === profile.id);
  const prefs = getPrefsForRecipient(profile.id);

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <header className="px-6 pt-12 pb-5 bg-white border-b border-border/50 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <button onClick={() => setLocation("/lists")} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-display font-bold">Alerts</h1>
          <div className="flex items-center gap-3">
            <button className="text-xs text-primary font-semibold" onClick={() => markAllReadForRecipient(profile.id)}>
              Mark all read
            </button>
            <button className="text-xs text-destructive font-semibold" onClick={() => clearAllForRecipient(profile.id)}>
              Clear all
            </button>
          </div>
        </div>
      </header>

      <div className="p-5 space-y-4">
        <section className="bg-white border border-border rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Notification Preferences</h2>
          <label className="flex items-center justify-between text-sm">
            <span>Assigned items</span>
            <input
              type="checkbox"
              checked={prefs.list_assigned}
              onChange={(e) => setPrefsForRecipient(profile.id, { list_assigned: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Due soon items</span>
            <input
              type="checkbox"
              checked={prefs.list_due_soon}
              onChange={(e) => setPrefsForRecipient(profile.id, { list_due_soon: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Overdue items</span>
            <input
              type="checkbox"
              checked={prefs.list_overdue}
              onChange={(e) => setPrefsForRecipient(profile.id, { list_overdue: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Enable push (placeholder)</span>
            <input
              type="checkbox"
              checked={prefs.push_enabled}
              onChange={(e) => setPrefsForRecipient(profile.id, { push_enabled: e.target.checked })}
            />
          </label>
        </section>

        <section className="space-y-2">
          {myNotifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-white border border-border rounded-2xl">
              No alerts yet.
            </div>
          ) : (
            myNotifications.map((n) => (
              <div
                key={n.id}
                className={`w-full text-left bg-white border rounded-2xl p-4 ${n.read ? "border-border" : "border-primary/40"}`}
              >
                <button
                  className="w-full text-left"
                  onClick={() => {
                    markReadForRecipient(n.id, profile.id);
                    setLocation(n.link_path || "/lists");
                  }}
                >
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </button>
                <div className="flex justify-end mt-3">
                  <button
                    className="text-xs text-destructive font-semibold"
                    onClick={() => clearOneForRecipient(n.id, profile.id)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
