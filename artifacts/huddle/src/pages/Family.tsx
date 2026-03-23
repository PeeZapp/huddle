import { useState } from "react";
import { ArrowLeft, Copy, Users, LogOut, Plus, Pencil, Trash2, Check, X, Globe } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useFamilyStore } from "@/stores/huddle-stores";
import { FamilyMember } from "@/lib/types";
import { DIETARY_OPTIONS, getDietaryOption } from "@/lib/dietary";
import { generateId } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEMBER_TYPES: { value: FamilyMember["type"]; label: string; emoji: string }[] = [
  { value: "adult",   label: "Adult",   emoji: "👤" },
  { value: "child",   label: "Child",   emoji: "🧒" },
  { value: "toddler", label: "Toddler", emoji: "👶" },
  { value: "baby",    label: "Baby",    emoji: "🍼" },
];

const COUNTRIES = [
  { code: "AU", name: "Australia" }, { code: "NZ", name: "New Zealand" },
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" }, { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" }, { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" }, { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" }, { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" }, { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" }, { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

// ─── Member form ──────────────────────────────────────────────────────────────

interface MemberFormState {
  name: string;
  type: FamilyMember["type"];
  dietary: string[];
}

const emptyForm = (): MemberFormState => ({ name: "", type: "adult", dietary: [] });

function MemberForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: MemberFormState;
  onSave: (m: MemberFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MemberFormState>(initial ?? emptyForm());

  const toggleDietary = (id: string) => {
    setForm(f => ({
      ...f,
      dietary: f.dietary.includes(id) ? f.dietary.filter(d => d !== id) : [...f.dietary, id],
    }));
  };

  // Vegan implies vegetarian
  const effectiveDietary = form.dietary.includes("vegan")
    ? [...new Set([...form.dietary, "vegetarian"])]
    : form.dietary;

  return (
    <div className="bg-secondary/40 rounded-2xl p-4 space-y-4 border border-border">
      {/* Name */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Name
        </label>
        <Input
          placeholder="e.g. Mum, Dad, Emma…"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          autoFocus
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
          Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {MEMBER_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setForm(f => ({ ...f, type: t.value }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                form.type === t.value
                  ? "bg-primary text-white border-primary"
                  : "bg-white border-border text-foreground"
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary restrictions */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
          Dietary Needs &amp; Allergies
        </label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(opt => {
            const active = effectiveDietary.includes(opt.id);
            const implied = !form.dietary.includes(opt.id) && active; // implied by vegan
            return (
              <button
                key={opt.id}
                onClick={() => toggleDietary(opt.id)}
                disabled={implied}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-white border-border text-muted-foreground hover:border-primary/30"
                } ${implied ? "opacity-60 cursor-default" : ""}`}
              >
                {opt.emoji} {opt.label}
                {active && <Check size={10} strokeWidth={3} className="ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={() => { if (form.name.trim()) onSave({ ...form, dietary: effectiveDietary }); }}>
          <Check size={16} className="mr-1.5" /> Save
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X size={16} className="mr-1.5" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeInfo = MEMBER_TYPES.find(t => t.value === member.type);

  return (
    <div className="bg-white border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
            {typeInfo?.emoji ?? "👤"}
          </div>
          <div>
            <p className="font-semibold">{member.name}</p>
            <p className="text-xs text-muted-foreground">{typeInfo?.label}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(member.dietary?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {member.dietary!.map(id => {
            const opt = getDietaryOption(id);
            if (!opt) return null;
            return (
              <span key={id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${opt.color}`}>
                {opt.emoji} {opt.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Family() {
  const { familyGroup, profile, updateFamily, leaveFamily } = useFamilyStore();

  const [addingMember, setAddingMember]   = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);

  if (!familyGroup) return null;

  const members: FamilyMember[] = familyGroup.family_members ?? [];

  const handleCopy = () => {
    navigator.clipboard.writeText(familyGroup.code).catch(() => {});
  };

  const handleLeave = () => {
    if (confirm("Are you sure you want to leave this family group?")) {
      leaveFamily();
      window.location.href = "/setup";
    }
  };

  const saveMember = (form: MemberFormState) => {
    if (editingId) {
      const updated = members.map(m =>
        m.id === editingId ? { ...m, ...form } : m
      );
      updateFamily({ family_members: updated });
      setEditingId(null);
    } else {
      const newMember: FamilyMember = { id: generateId(), ...form };
      updateFamily({ family_members: [...members, newMember] });
      setAddingMember(false);
    }
  };

  const deleteMember = (id: string) => {
    if (confirm("Remove this family member?")) {
      updateFamily({ family_members: members.filter(m => m.id !== id) });
    }
  };

  const editingMember = members.find(m => m.id === editingId);

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <header className="px-6 pt-12 pb-5 bg-white border-b border-border/50 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-2xl font-display font-bold">Family Settings</h1>
        </div>
      </header>

      <div className="p-5 space-y-6">

        {/* Family hub card */}
        <Card className="text-center py-7 px-5">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <Users size={28} />
          </div>
          <h2 className="text-2xl font-bold mb-1">{familyGroup.name}</h2>
          <p className="text-sm text-muted-foreground mb-5">Shared family hub</p>

          <div className="inline-flex items-center gap-3 bg-secondary px-4 py-2.5 rounded-xl">
            <span className="font-mono font-bold tracking-widest text-base">{familyGroup.code}</span>
            <button onClick={handleCopy} className="p-1.5 hover:bg-white rounded-lg transition-colors text-primary">
              <Copy size={16} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this code to invite members</p>
        </Card>

        {/* Country / location (for recipe costing) */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1 flex items-center gap-2">
            <Globe size={13} /> Location
          </h3>
          <div className="bg-white border border-border rounded-2xl p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Used to show recipe costs in your local currency.
            </p>
            <select
              value={familyGroup.country ?? ""}
              onChange={e => updateFamily({ country: e.target.value || undefined })}
              className="w-full text-sm border border-input rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select country…</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Your profile */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Your Profile
          </h3>
          <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-full text-white flex items-center justify-center font-bold text-lg">
                {profile?.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold">{profile?.name}</span>
            </div>
            <Badge variant="outline">You</Badge>
          </Card>
        </section>

        {/* Family members */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Family Members
            </h3>
            {!addingMember && !editingId && (
              <button
                onClick={() => setAddingMember(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus size={13} /> Add member
              </button>
            )}
          </div>

          <div className="space-y-3">
            {members.length === 0 && !addingMember && (
              <div className="text-center py-8 text-muted-foreground bg-secondary/30 rounded-2xl border border-dashed border-border">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No family members added yet</p>
                <p className="text-xs mt-1">Add members to filter recipes by dietary needs</p>
              </div>
            )}

            {members.map(m =>
              editingId === m.id ? (
                <MemberForm
                  key={m.id}
                  initial={{ name: m.name, type: m.type, dietary: m.dietary ?? [] }}
                  onSave={saveMember}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <MemberCard
                  key={m.id}
                  member={m}
                  onEdit={() => { setAddingMember(false); setEditingId(m.id); }}
                  onDelete={() => deleteMember(m.id)}
                />
              )
            )}

            {addingMember && (
              <MemberForm
                onSave={saveMember}
                onCancel={() => setAddingMember(false)}
              />
            )}

            {/* Add button below list if members exist */}
            {members.length > 0 && !addingMember && !editingId && (
              <button
                onClick={() => setAddingMember(true)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-muted-foreground text-sm font-medium hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add another member
              </button>
            )}
          </div>
        </section>

        {/* Dietary summary */}
        {members.some(m => (m.dietary?.length ?? 0) > 0) && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Active Dietary Filters
            </h3>
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-3">
                Recipes conflicting with these needs will be excluded from auto-generated plans.
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(members.flatMap(m => m.dietary ?? []))].map(id => {
                  const opt = getDietaryOption(id);
                  if (!opt) return null;
                  return (
                    <span key={id} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${opt.color}`}>
                      {opt.emoji} {opt.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Danger zone */}
        <div className="pt-4">
          <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={handleLeave}>
            <LogOut className="mr-2 w-4 h-4" /> Leave Family Group
          </Button>
        </div>
      </div>
    </div>
  );
}
