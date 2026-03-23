import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function fsGet<T>(collection: string, docId: string): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db, collection, docId));
    if (snap.exists()) return snap.data() as T;
  } catch {}
  return null;
}

export async function fsSet(collection: string, docId: string, data: unknown): Promise<void> {
  try {
    await setDoc(doc(db, collection, docId), data as Record<string, unknown>);
  } catch (e) {
    console.warn(`Firestore write failed (${collection}/${docId}):`, e);
  }
}
