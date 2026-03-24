/**
 * useMealPlanSync
 *
 * Keeps the local Zustand meal-plan store in sync with Firestore.
 *
 * Strategy:
 *  1. On mount (once familyCode is known): fetch the remote plan and merge it
 *     into the local store (remote week wins over local on conflict — more recent
 *     updated_at timestamp wins).
 *  2. Subscribe to local store changes and debounce-save them to Firestore
 *     so the plan is persisted after every edit without hammering the API.
 *  3. A real-time Firestore listener keeps other family members' views current.
 *     Guard flag `applyingRemote` prevents write-back loops.
 */

import { useEffect, useRef } from "react";
import { useMealPlanStore } from "@/stores/huddle-stores";
import { loadMealPlans, saveMealPlans, subscribeMealPlans } from "@/lib/firestore-sync";
import { MealPlan } from "@/lib/types";

const DEBOUNCE_MS = 1500;

export function useMealPlanSync(familyCode: string | undefined) {
  const { plans, _setPlansFromRemote } = useMealPlanStore();
  const applyingRemote = useRef(false);
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized    = useRef(false);

  // ── Helper: merge remote into local (latest updated_at wins per week) ──
  function mergePlans(
    local: Record<string, MealPlan>,
    remote: Record<string, MealPlan>,
  ): Record<string, MealPlan> {
    const merged = { ...local };
    for (const [week, remotePlan] of Object.entries(remote)) {
      const localPlan = local[week];
      if (!localPlan) {
        merged[week] = remotePlan;
      } else {
        const remoteDate = new Date(remotePlan.updated_at ?? 0).getTime();
        const localDate  = new Date(localPlan.updated_at  ?? 0).getTime();
        if (remoteDate >= localDate) merged[week] = remotePlan;
      }
    }
    return merged;
  }

  // ── 1. Initial load from Firestore ────────────────────────────────────────
  useEffect(() => {
    if (!familyCode || initialized.current) return;
    initialized.current = true;

    loadMealPlans(familyCode).then((remote) => {
      if (!remote) return;
      const merged = mergePlans(useMealPlanStore.getState().plans, remote);
      applyingRemote.current = true;
      _setPlansFromRemote(merged);
      applyingRemote.current = false;
    });
  }, [familyCode]);

  // ── 2. Real-time listener for changes from other family members ────────────
  useEffect(() => {
    if (!familyCode) return;
    const unsub = subscribeMealPlans(familyCode, (remote) => {
      const merged = mergePlans(useMealPlanStore.getState().plans, remote);
      applyingRemote.current = true;
      _setPlansFromRemote(merged);
      applyingRemote.current = false;
    });
    return unsub;
  }, [familyCode]);

  // ── 3. Debounced save on local plan changes ───────────────────────────────
  useEffect(() => {
    if (!familyCode || applyingRemote.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMealPlans(familyCode, useMealPlanStore.getState().plans);
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [familyCode, plans]);
}
