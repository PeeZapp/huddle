import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Users, Sparkles, ArrowRight } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useFamilyStore } from "@/stores/huddle-stores";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { setupProfile, createFamily, joinFamily } = useFamilyStore();
  
  const [step, setStep] = useState<"name" | "action" | "create" | "join">("name");
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const handleSetupName = () => {
    if (name.trim()) {
      setupProfile(name);
      setStep("action");
    }
  };

  const handleCreate = () => {
    if (familyName.trim()) {
      createFamily(familyName);
      setLocation("/");
    }
  };

  const handleJoin = () => {
    if (joinCode.trim()) {
      joinFamily(joinCode.toUpperCase());
      setLocation("/");
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mb-8"
        >
          <Sparkles size={36} />
        </motion.div>

        <h1 className="text-4xl font-display font-bold text-foreground mb-3">Welcome to Huddle</h1>
        <p className="text-muted-foreground mb-12 max-w-[280px]">Your family's collaborative meal planner and grocery list.</p>

        <div className="w-full max-w-sm space-y-4">
          {step === "name" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input 
                placeholder="What's your name?" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                autoFocus
              />
              <Button className="w-full" onClick={handleSetupName} disabled={!name.trim()}>
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}

          {step === "action" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Button className="w-full" onClick={() => setStep("create")}>
                Create New Family
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("join")}>
                Join Existing Family
              </Button>
            </motion.div>
          )}

          {step === "create" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input 
                placeholder="Family Name (e.g. The Smiths)" 
                value={familyName} 
                onChange={(e) => setFamilyName(e.target.value)} 
                icon={<Users size={20} />}
                autoFocus
              />
              <Button className="w-full" onClick={handleCreate} disabled={!familyName.trim()}>
                Start Planning
              </Button>
              <button onClick={() => setStep("action")} className="text-sm text-muted-foreground underline mt-4">Back</button>
            </motion.div>
          )}

          {step === "join" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input 
                placeholder="Enter Code (FP-XXXX)" 
                value={joinCode} 
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
                className="uppercase tracking-widest text-center"
                autoFocus
              />
              <Button className="w-full" onClick={handleJoin} disabled={joinCode.length < 5}>
                Join Family
              </Button>
              <button onClick={() => setStep("action")} className="text-sm text-muted-foreground underline mt-4">Back</button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
