/**
 * useMealPlanSync
 *
 * Keeps the local Zustand meal-plan store in sync with Firestore.
 *
 * Strategy:
 *  1. On mount (once familyCode is known): fetch the remote plan and merge it
 *     into the local store (most-recent updated_at timestamp wins per week).
 *  2. A real-time Firestore listener keeps other family members' views current.
 *  3. Subscribe to local store changes and debounce-save them to Firestore
 *     so the plan is persisted after every user edit.
 *
 * Write-back loop prevention
 * ──────────────────────────
 * The naive approach of setting `applyingRemote = true` then immediately
 * `= false` doesn't work because React's save effect runs *asynchronously*
 * after the re-render; by then the flag is already cleared.
 *
 * Instead we use `skipNextSave`: set it TRUE before calling
 * `_setPlansFromRemote`, then the save effect checks it, skips the write,
 * and resets it to FALSE.  The next user-driven change will find it FALSE
 * and will save normally.
 */

import { useEffect, useRef } from "react";
import { useMealPlanStore } from "@/stores/huddle-stores";
import { loadMealPlans, saveMealPlans, subscribeMealPlans } from "@/lib/firestore-sync";
import { MealPlan } from "@/lib/types";

const DEBOUNCE_MS = 1500;

export function useMealPlanSync(familyCode: string | undefined) {
  const { plans, _setPlansFromRemote } = useMealPlanStore();

  // Set to true before every remote-driven store update.
  // The save effect reads and clears it synchronously so it never writes
  // back data that originated from Firestore.
  const skipNextSave = useRef(false);

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized  = useRef(false);

  // ── Helper: merge remote into local (latest updated_at wins per week) ──────
  function mergePlans(
    local: Record<string, MealPlan>,
    remote: Record<string, MealPlan>,
  ): Record<string, MealPlan> {
    const merged = { ...local };
    for (const [week, remotePlan] of Object.entries(remote)) {
      const localPlan  = local[week];
      const remoteTime = new Date(remotePlan.updated_at ?? 0).getTime();
      const localTime  = new Date(localPlan?.updated_at  ?? 0).getTime();
      if (!localPlan || remoteTime >= localTime) merged[week] = remotePlan;
    }
    return merged;
  }

  // ── 1. Initial load from Firestore ─────────────────────────────────────────
  useEffect(() => {
    if (!familyCode || initialized.current) return;
    initialized.current = true;

    loadMealPlans(familyCode).then((remote) => {
      if (!remote) return;
      const merged = mergePlans(useMealPlanStore.getState().plans, remote);
      skipNextSave.current = true;
      _setPlansFromRemote(merged);
    });
  }, [familyCode]);

  // ── 2. Real-time listener for changes from other family members ─────────────
  useEffect(() => {
    if (!familyCode) return;
    const unsub = subscribeMealPlans(familyCode, (remote) => {
      const merged = mergePlans(useMealPlanStore.getState().plans, remote);
      skipNextSave.current = true;
      _setPlansFromRemote(merged);
    });
    return unsub;
  }, [familyCode]);

  // ── 3. Debounced save on local plan changes ─────────────────────────────────
  // Skipped whenever the change originated from Firestore (skipNextSave flag).
  useEffect(() => {
    if (!familyCode) return;

    // This change came from a remote sync — don't echo it back to Firestore.
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMealPlans(familyCode, useMealPlanStore.getState().plans);
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [familyCode, plans]);
}
