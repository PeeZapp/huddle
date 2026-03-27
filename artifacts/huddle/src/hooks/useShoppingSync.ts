import { useEffect, useRef } from "react";
import { useShoppingStore } from "@/stores/huddle-stores";
import {
  loadShoppingItems,
  saveShoppingItems,
  subscribeShoppingItems,
} from "@/lib/firestore-sync";
import { ShoppingItem } from "@/lib/types";

const DEBOUNCE_MS = 1200;

export function useShoppingSync(familyCode: string | undefined) {
  const { items, _setItemsFromRemote } = useShoppingStore();

  const skipNextSave = useRef(false);
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saveInFlight = useRef(false);
  const prevItemsRef = useRef<ShoppingItem[]>(items);

  useEffect(() => {
    if (!familyCode || initialized.current) return;
    initialized.current = true;

    loadShoppingItems(familyCode).then((remoteItems) => {
      if (!remoteItems) return;
      if (dirty.current || saveInFlight.current) return;
      skipNextSave.current = true;
      _setItemsFromRemote(remoteItems);
      prevItemsRef.current = remoteItems;
    });
  }, [familyCode, _setItemsFromRemote]);

  useEffect(() => {
    if (!familyCode) return;
    const unsub = subscribeShoppingItems(familyCode, (remoteItems) => {
      if (dirty.current || saveInFlight.current) return;
      skipNextSave.current = true;
      _setItemsFromRemote(remoteItems);
      prevItemsRef.current = remoteItems;
    });
    return unsub;
  }, [familyCode, _setItemsFromRemote]);

  useEffect(() => {
    if (!familyCode) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      prevItemsRef.current = items;
      return;
    }

    if (JSON.stringify(prevItemsRef.current) === JSON.stringify(items)) return;

    prevItemsRef.current = items;
    dirty.current = true;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        saveInFlight.current = true;
        try {
          await saveShoppingItems(familyCode, useShoppingStore.getState().items);
          dirty.current = false;
        } finally {
          saveInFlight.current = false;
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [familyCode, items]);
}
