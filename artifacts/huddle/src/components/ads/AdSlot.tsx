import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdPlacement = "inline" | "rail" | "mobile-bottom";

interface AdSlotProps {
  placement: AdPlacement;
  className?: string;
}

function slotClass(placement: AdPlacement): string {
  if (placement === "rail") return "min-h-[600px] w-[160px]";
  if (placement === "mobile-bottom") return "h-[60px] w-full";
  return "h-[90px] w-full";
}

export default function AdSlot({ placement, className }: AdSlotProps) {
  const adsEnabled = import.meta.env.VITE_ADS_ENABLED !== "false";
  const adClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adSlot = placement === "rail"
    ? import.meta.env.VITE_ADSENSE_SLOT_RAIL
    : placement === "mobile-bottom"
      ? import.meta.env.VITE_ADSENSE_SLOT_MOBILE
      : import.meta.env.VITE_ADSENSE_SLOT_INLINE;
  const hasAdSenseConfig = Boolean(adClient && adSlot);

  useEffect(() => {
    if (!adsEnabled || !hasAdSenseConfig) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Non-fatal in local/dev contexts.
    }
  }, [adsEnabled, hasAdSenseConfig, placement]);

  if (!adsEnabled) return null;

  if (hasAdSenseConfig) {
    return (
      <div className={className}>
        <ins
          className={`adsbygoogle block overflow-hidden rounded-xl border border-border/60 bg-white ${slotClass(placement)}`}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`rounded-xl border border-dashed border-border/70 bg-secondary/40 text-center ${slotClass(placement)}`}>
        <div className="h-full w-full flex items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sponsored
        </div>
      </div>
    </div>
  );
}
