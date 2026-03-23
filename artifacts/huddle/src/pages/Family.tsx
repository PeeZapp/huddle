import { useLocation } from "wouter";
import { ArrowLeft, Copy, Users, LogOut } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useFamilyStore } from "@/stores/huddle-stores";

export default function Family() {
  const [, setLocation] = useLocation();
  const { familyGroup, profile, updateFamily, leaveFamily } = useFamilyStore();

  const handleCopy = () => {
    if (familyGroup?.code) {
      navigator.clipboard.writeText(familyGroup.code);
      alert("Family Code copied!");
    }
  };

  const handleLeave = () => {
    if (confirm("Are you sure you want to leave this family group?")) {
      leaveFamily();
      setLocation("/setup");
    }
  };

  if (!familyGroup) return null;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="p-6 bg-white border-b border-border flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-display font-bold">Family Settings</h1>
      </header>

      <div className="p-6 space-y-6">
        <Card className="text-center py-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-1">{familyGroup.name}</h2>
          <p className="text-sm text-muted-foreground mb-6">Manage your shared family hub</p>
          
          <div className="inline-flex items-center gap-3 bg-secondary px-4 py-2 rounded-xl">
            <span className="font-mono font-bold tracking-widest text-lg">{familyGroup.code}</span>
            <button onClick={handleCopy} className="p-2 hover:bg-white rounded-lg transition-colors text-primary">
              <Copy size={18} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Share this code to invite members</p>
        </Card>

        <section>
          <h3 className="font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider text-xs">Your Profile</h3>
          <Card className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full text-white flex items-center justify-center font-bold">
                {profile?.name.charAt(0)}
              </div>
              <span className="font-semibold">{profile?.name}</span>
            </div>
            <Badge variant="outline">You</Badge>
          </Card>
        </section>

        <div className="pt-8">
          <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={handleLeave}>
            <LogOut className="mr-2 w-4 h-4" /> Leave Family Group
          </Button>
        </div>
      </div>
    </div>
  );
}
