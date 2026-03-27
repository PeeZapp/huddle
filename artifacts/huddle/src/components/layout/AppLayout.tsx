import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "./BottomNav";
import AdSlot from "@/components/ads/AdSlot";
import { usePriceStore } from "@/stores/huddle-stores";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const hideNav = ["/setup", "/generate", "/import"].some(path => location.startsWith(path));
  const isSubscribed = usePriceStore((s) => s.isSubscribed);
  const adsEnabled = import.meta.env.VITE_ADS_ENABLED !== "false";
  const showAds = adsEnabled && !isSubscribed && !hideNav;

  return (
    <div className="min-h-[100dvh] bg-background font-sans relative">
      {showAds && (
        <>
          <div className="hidden xl:block fixed left-6 top-24 z-10">
            <AdSlot placement="rail" />
          </div>
          <div className="hidden xl:block fixed right-6 top-24 z-10">
            <AdSlot placement="rail" />
          </div>
        </>
      )}

      <div className="max-w-md mx-auto relative shadow-2xl shadow-black/5 bg-white sm:border-x sm:border-border/50 flex flex-col min-h-[100dvh]">
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

        {showAds && (
          <div className="px-4 pb-2 md:hidden">
            <AdSlot placement="mobile-bottom" />
          </div>
        )}
        
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}
