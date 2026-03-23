import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "./BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const hideNav = ["/setup", "/generate", "/import"].some(path => location.startsWith(path));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col font-sans max-w-md mx-auto relative shadow-2xl shadow-black/5 bg-white sm:border-x sm:border-border/50">
      <AnimatePresence mode="wait">
        <motion.main 
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn("flex-1 overflow-x-hidden", hideNav ? "" : "pb-24")}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      
      {!hideNav && <BottomNav />}
    </div>
  );
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}
