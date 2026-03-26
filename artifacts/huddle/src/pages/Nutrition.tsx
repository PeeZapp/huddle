import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check, Target, Trash2, Pencil, Save, Sparkles, Loader2, Scale } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNutritionStore } from "@/stores/huddle-stores";
import { BarcodeNutritionProduct, DailyNutritionLog, MealPhotoAnalysisResult, NutritionGoalPreset, NutritionGoals, NutritionLogEntry, UserNutritionProfile } from "@/lib/types";
import { format, subDays } from "date-fns";
import { useAuth } from "@/context/auth-context";
import {
  addDailyNutritionEntry,
  loadBodyWeight,
  loadDailyNutritionLog,
  loadNutritionProfile,
  loadNutritionRange,
  removeDailyNutritionEntry,
  saveBodyWeight,
  saveNutritionProfile,
  updateDailyNutritionEntry,
} from "@/lib/firestore-sync";
import { generateId } from "@/lib/utils";
import { estimateFromLocalIngredients } from "@/lib/local-nutrition";
import { analyzeMealPhoto, lookupBarcode, useAiMutation } from "@/hooks/use-ai";
import { useFamilyStore, useRecipeStore } from "@/stores/huddle-stores";
import { MEAL_SLOTS } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { BrowserMultiFormatReader } from "@zxing/browser";

// ─── Presets ────────────────────────────────────────────────────────────────

interface Preset {
  id: NutritionGoalPreset;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const PRESETS: Preset[] = [
  { id: "maintenance", name: "Maintenance", calories: 2000, protein: 120, carbs: 250, fat: 65 },
  { id: "muscle_gain", name: "Muscle Gain", calories: 2800, protein: 200, carbs: 320, fat: 80 },
  { id: "weight_loss", name: "Weight Loss", calories: 1600, protein: 140, carbs: 140, fat: 50 },
  { id: "keto", name: "Keto", calories: 1800, protein: 130, carbs: 25, fat: 145 },
  { id: "high_protein_cut", name: "High Protein Cut", calories: 1700, protein: 180, carbs: 120, fat: 55 },
  { id: "low_carb", name: "Low Carb", calories: 1900, protein: 150, carbs: 90, fat: 95 },
  { id: "endurance", name: "Endurance", calories: 2600, protein: 140, carbs: 360, fat: 70 },
  { id: "recomp", name: "Recomp", calories: 2200, protein: 190, carbs: 200, fat: 70 },
  { id: "lean_bulk", name: "Lean Bulk", calories: 3000, protein: 190, carbs: 380, fat: 90 },
];

// ─── Slider row ─────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, unit, value, min, max, step, onChange }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold text-primary tabular-nums">
          {value.toLocaleString()}{unit}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-2 bg-secondary rounded-full" />
        <div
          className="absolute left-0 h-2 bg-primary rounded-full pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-6"
        />
        <div
          className="absolute w-5 h-5 bg-white border-2 border-primary rounded-full shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 10px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

type Tab = "goals" | "summary" | "log" | "weight";
type ManualUnit = "g" | "kg" | "oz" | "lb" | "cup" | "tbsp" | "tsp" | "piece";
interface ManualIngredientRow {
  id: string;
  name: string;
  amount: string;
  unit: ManualUnit;
}

interface BarcodeHistoryItem {
  at: string;
  product: BarcodeNutritionProduct;
}

interface PhotoHistoryItem {
  at: string;
  analysis: MealPhotoAnalysisResult;
}

export default function Nutrition() {
  const [location] = useLocation();
  const { user } = useAuth();
  const setGoals = useNutritionStore((s) => s.setGoals);
  const { familyGroup } = useFamilyStore();
  const { addRecipe } = useRecipeStore();
  const { toast } = useToast();
  const aiMutation = useAiMutation();

  const [tab, setTab]             = useState<Tab>("summary");
  const [draft, setDraft]         = useState<NutritionGoals>({ calories: 2000, protein: 120, carbs: 250, fat: 65 });
  const [saved, setSaved]         = useState(false);
  const [profile, setProfile]     = useState<UserNutritionProfile | null>(null);
  const [servingFactorDraft, setServingFactorDraft] = useState(1);
  const [linkedMemberIdDraft, setLinkedMemberIdDraft] = useState<string>("");
  const [todayLog, setTodayLog]   = useState<DailyNutritionLog | null>(null);
  const [weekLogs, setWeekLogs]   = useState<Record<string, DailyNutritionLog>>({});
  const [loading, setLoading]     = useState(true);

  const [mealName, setMealName]   = useState("");
  const [cal, setCal]             = useState("");
  const [prot, setProt]           = useState("");
  const [carbs, setCarbs]         = useState("");
  const [fat, setFat]             = useState("");
  const [mealNote, setMealNote]   = useState("");
  const [manualIngredients, setManualIngredients] = useState<ManualIngredientRow[]>([
    { id: crypto.randomUUID(), name: "", amount: "100", unit: "g" },
  ]);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [weightHistory, setWeightHistory] = useState<{ id: string; date: string; kg: number }[]>([]);
  const [estimatingError, setEstimatingError] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeLookupBusy, setBarcodeLookupBusy] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [scannedProduct, setScannedProduct] = useState<BarcodeNutritionProduct | null>(null);
  const [barcodeMealName, setBarcodeMealName] = useState("");
  const [barcodeHistory, setBarcodeHistory] = useState<BarcodeHistoryItem[]>([]);
  const [premadeSlot, setPremadeSlot] = useState(MEAL_SLOTS[0].key);
  const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [cameraScanError, setCameraScanError] = useState("");
  const [cameraScanStatus, setCameraScanStatus] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoResult, setPhotoResult] = useState<MealPhotoAnalysisResult | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [photoMealNameDraft, setPhotoMealNameDraft] = useState("");
  const [photoCaloriesDraft, setPhotoCaloriesDraft] = useState("");
  const [photoProteinDraft, setPhotoProteinDraft] = useState("");
  const [photoCarbsDraft, setPhotoCarbsDraft] = useState("");
  const [photoFatDraft, setPhotoFatDraft] = useState("");
  const [photoHistory, setPhotoHistory] = useState<PhotoHistoryItem[]>([]);
  const [photoHint, setPhotoHint] = useState("");
  const [photoFileName, setPhotoFileName] = useState("");
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const PHOTO_ANALYSIS_REQUIRES_CREDITS = false;
  const autoSaveTimerRef = useRef<number | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanInFlightRef = useRef(false);
  const SELF_MEMBER_ID = "__self__";

  const todayStr  = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd")),
    [],
  );

  useEffect(() => {
    try {
      const rawBarcodes = localStorage.getItem("huddle-barcode-history");
      const rawPhotos = localStorage.getItem("huddle-photo-analysis-history");
      if (rawBarcodes) setBarcodeHistory(JSON.parse(rawBarcodes) as BarcodeHistoryItem[]);
      if (rawPhotos) setPhotoHistory(JSON.parse(rawPhotos) as PhotoHistoryItem[]);
    } catch {
      // ignore local storage parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("huddle-barcode-history", JSON.stringify(barcodeHistory.slice(0, 10)));
  }, [barcodeHistory]);

  useEffect(() => {
    localStorage.setItem("huddle-photo-analysis-history", JSON.stringify(photoHistory.slice(0, 10)));
  }, [photoHistory]);

  useEffect(() => {
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    const params = new URLSearchParams(query);
    const tabQ = params.get("tab");
    const dateQ = params.get("date");
    if (tabQ === "goals" || tabQ === "summary" || tabQ === "log" || tabQ === "weight") {
      setTab(tabQ);
    }
    if (dateQ && /^\d{4}-\d{2}-\d{2}$/.test(dateQ)) {
      setSelectedDate(dateQ);
    } else {
      // If no explicit date is provided (normal /nutrition route), default back to today.
      // This avoids carrying a stale planner deep-link date into new personal log entries.
      setSelectedDate(todayStr);
    }
  }, [location, todayStr]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const p = await loadNutritionProfile(user.uid);
      const t = await loadDailyNutritionLog(user.uid, selectedDate);
      const w = await loadNutritionRange(user.uid, weekDates);
      const weights = await loadBodyWeight(user.uid, format(subDays(new Date(), 30), "yyyy-MM-dd"));
      if (cancelled) return;
      setProfile(p);
      setDraft(p.goals);
      setServingFactorDraft(p.serving_factor || 1);
      setLinkedMemberIdDraft(p.linked_family_member_id ?? SELF_MEMBER_ID);
      setGoals(p.goals);
      setTodayLog(t);
      setWeekLogs(w);
      setWeightHistory(weights.sort((a, b) => a.date.localeCompare(b.date)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedDate, user?.uid]);

  const totalCals = todayLog?.totals.calories ?? 0;
  const totalProt = todayLog?.totals.protein ?? 0;
  const totalCarbs= todayLog?.totals.carbs ?? 0;
  const totalFat  = todayLog?.totals.fat ?? 0;

  function pct(val: number, goal: number) {
    return Math.min(Math.round((val / Math.max(goal, 1)) * 100), 100);
  }

  const normalizedLinkedMemberId = linkedMemberIdDraft === SELF_MEMBER_ID ? "" : linkedMemberIdDraft;

  function applyPreset(p: Preset) {
    const nextGoals: NutritionGoals = {
      calories: p.calories,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
    };
    setDraft(nextGoals);
    setGoals(nextGoals);
    setSaved(false);

    // Persist preset selection immediately so quick navigation doesn't lose it.
    if (user?.uid) {
      const next: UserNutritionProfile = {
        uid: user.uid,
        goals: nextGoals,
        preset: p.id,
        serving_factor: servingFactorDraft,
        linked_family_member_id: normalizedLinkedMemberId || undefined,
        updated_at: new Date().toISOString(),
      };
      void saveNutritionProfile(user.uid, next).then(() => {
        setProfile(next);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1200);
      });
    }
  }

  function buildProfileFromDraft(uid: string): UserNutritionProfile {
    const preset = PRESETS.find(
      p => p.calories === draft.calories && p.protein === draft.protein && p.carbs === draft.carbs && p.fat === draft.fat,
    );
    return {
      uid,
      goals: draft,
      preset: preset?.id ?? "custom",
      serving_factor: servingFactorDraft,
      linked_family_member_id: normalizedLinkedMemberId || undefined,
      updated_at: new Date().toISOString(),
    };
  }

  const goalsDirty = useMemo(() => {
    if (!profile) return false;
    return (
      profile.goals.calories !== draft.calories ||
      profile.goals.protein !== draft.protein ||
      profile.goals.carbs !== draft.carbs ||
      profile.goals.fat !== draft.fat ||
      (profile.serving_factor || 1) !== servingFactorDraft ||
      (profile.linked_family_member_id || "") !== (normalizedLinkedMemberId || "")
    );
  }, [draft, normalizedLinkedMemberId, profile, servingFactorDraft]);

  async function saveGoals() {
    if (!user?.uid) return;
    const next = buildProfileFromDraft(user.uid);
    await saveNutritionProfile(user.uid, next);
    setProfile(next);
    setGoals(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  useEffect(() => {
    if (!user?.uid || !profile || !goalsDirty) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      const next = buildProfileFromDraft(user.uid);
      await saveNutritionProfile(user.uid, next);
      setProfile(next);
      setGoals(next.goals);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [buildProfileFromDraft, goalsDirty, profile, setGoals, user?.uid]);

  useEffect(() => {
    return () => {
      if (!user?.uid || !profile || !goalsDirty) return;
      const next = buildProfileFromDraft(user.uid);
      void saveNutritionProfile(user.uid, next);
    };
  }, [buildProfileFromDraft, goalsDirty, profile, user?.uid]);

  function estimateFromIngredients() {
    const unitToGrams: Record<ManualUnit, number> = {
      g: 1, kg: 1000, oz: 28.35, lb: 453.59, cup: 240, tbsp: 15, tsp: 5, piece: 100,
    };
    const totals = estimateFromLocalIngredients(
      manualIngredients.map((i) => ({
        name: i.name,
        grams: Number(i.amount || 0) * unitToGrams[i.unit],
      })),
    );
    if (!totals.calories && !totals.protein && !totals.carbs && !totals.fat) {
      setEstimatingError("Could not estimate from ingredients. Use known ingredient names and amounts.");
      return;
    }
    setEstimatingError("");
    setCal(String(totals.calories));
    setProt(String(totals.protein));
    setCarbs(String(totals.carbs));
    setFat(String(totals.fat));
  }

  async function estimateFromAiPrompt() {
    if (!mealName.trim()) return;
    setEstimatingError("");
    try {
      const res = await aiMutation.mutateAsync({
        prompt: `Estimate nutrition for this meal: "${mealName.trim()}". Return ONLY JSON with integers:
{"calories":number,"protein":number,"carbs":number,"fat":number}`,
        responseFormat: "json",
      });
      const parsed = (() => {
        if (typeof res.result === "string") {
          const raw = res.result.trim();
          const match = raw.match(/\{[\s\S]*\}/);
          return JSON.parse(match ? match[0] : raw) as Record<string, unknown>;
        }
        return res.result as unknown as Record<string, unknown>;
      })();
      setCal(String(Math.round(Number(parsed.calories ?? 0))));
      setProt(String(Math.round(Number(parsed.protein ?? 0))));
      setCarbs(String(Math.round(Number(parsed.carbs ?? 0))));
      setFat(String(Math.round(Number(parsed.fat ?? 0))));
    } catch {
      setEstimatingError("AI estimate failed. Try again.");
    }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    if (!mealName || !user?.uid) return;
    const entry: NutritionLogEntry = {
      id: isEditingId ?? generateId(),
      source: "manual",
      meal_name: mealName,
      calories: Number(cal) || 0,
      protein: Number(prot) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      note: mealNote.trim() || undefined,
      ingredients: manualIngredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), amount: i.amount.trim(), unit: i.unit })),
      created_at: new Date().toISOString(),
    };
    if (isEditingId) {
      await updateDailyNutritionEntry(user.uid, selectedDate, entry);
    } else {
      await addDailyNutritionEntry(user.uid, selectedDate, entry);
    }
    const refreshed = await loadDailyNutritionLog(user.uid, selectedDate);
    setTodayLog(refreshed);
    setWeekLogs((prev) => ({ ...prev, [selectedDate]: refreshed }));
    setMealName(""); setCal(""); setProt(""); setCarbs(""); setFat(""); setMealNote("");
    setIsEditingId(null);
    setManualIngredients([{ id: crypto.randomUUID(), name: "", amount: "100", unit: "g" }]);
  }

  async function handleLookupBarcode() {
    if (!barcode.trim()) return;
    setBarcodeLookupBusy(true);
    setBarcodeError("");
    setBarcodeStatus("Looking up barcode...");
    try {
      const product = await lookupBarcode(barcode.trim());
      setScannedProduct(product);
      setBarcodeMealName(product.name);
      setMealName(product.name);
      setCal(String(product.calories ?? 0));
      setProt(String(product.protein ?? 0));
      setCarbs(String(product.carbs ?? 0));
      setFat(String(product.fat ?? 0));
      setBarcodeHistory((prev) => [{ at: new Date().toISOString(), product }, ...prev.filter((p) => p.product.barcode !== product.barcode)].slice(0, 10));
      setBarcodeStatus(`Found: ${product.name}`);
      toast({ title: "Barcode found", description: `${product.name} loaded into your log form.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Barcode lookup failed.";
      setBarcodeError(message);
      setBarcodeStatus("");
      toast({ title: "Barcode not found", description: "Try another barcode or enter details manually." });
    } finally {
      setBarcodeLookupBusy(false);
    }
  }

  function isLikelyBarcode(raw: string): boolean {
    const trimmed = raw.trim();
    // Common retail barcode lengths (EAN-8, UPC-A, EAN-13, ITF-14)
    return /^\d{8,14}$/.test(trimmed);
  }

  async function handleScannedBarcode(code: string) {
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setBarcodeLookupBusy(true);
    try {
      setBarcode(code);
      const product = await lookupBarcode(code);
      setScannedProduct(product);
      setBarcodeMealName(product.name);
      setMealName(product.name);
      setCal(String(product.calories ?? 0));
      setProt(String(product.protein ?? 0));
      setCarbs(String(product.carbs ?? 0));
      setFat(String(product.fat ?? 0));
      setBarcodeHistory((prev) => [{ at: new Date().toISOString(), product }, ...prev.filter((p) => p.product.barcode !== product.barcode)].slice(0, 10));
      toast({ title: "Barcode scanned", description: `${product.name} loaded.` });
      setCameraScanStatus("Barcode detected");
      setIsCameraScanOpen(false);
    } catch {
      setCameraScanError("Barcode detected but no product match found. Keep scanning or enter barcode manually.");
    } finally {
      setBarcodeLookupBusy(false);
      scanInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (!isCameraScanOpen) {
      if (barcodeStreamRef.current) {
        barcodeStreamRef.current.getTracks().forEach((t) => t.stop());
        barcodeStreamRef.current = null;
      }
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
      if (zxingReaderRef.current) {
        zxingReaderRef.current = null;
      }
      setCameraScanStatus("");
      setCameraScanError("");
      return;
    }

    let intervalId: number | null = null;
    let cancelled = false;

    (async () => {
      try {
        setCameraScanError("");
        setCameraScanStatus("Opening camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) return;
        barcodeStreamRef.current = stream;
        if (barcodeVideoRef.current) {
          barcodeVideoRef.current.srcObject = stream;
          await barcodeVideoRef.current.play();
        }
        setCameraScanStatus("Point camera at barcode");

        const DetectorCtor = (window as Window & { BarcodeDetector?: new () => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
        if (DetectorCtor) {
          const detector = new DetectorCtor();
          intervalId = window.setInterval(async () => {
            if (!barcodeVideoRef.current) return;
            try {
              const codes = await detector.detect(barcodeVideoRef.current);
              const code = codes[0]?.rawValue?.trim();
              if (!code || !isLikelyBarcode(code)) return;
              await handleScannedBarcode(code);
            } catch {
              // keep scanning; errors while detecting are expected frame-to-frame
            }
          }, 700);
          return;
        }

        setCameraScanStatus("Using fallback scanner...");
        setCameraScanError("");
        if (!barcodeVideoRef.current) {
          setCameraScanError("Video preview failed to initialize.");
          return;
        }
        const reader = new BrowserMultiFormatReader();
        zxingReaderRef.current = reader;
        const controls = await reader.decodeFromVideoDevice(undefined, barcodeVideoRef.current, (result) => {
          const code = result?.getText?.().trim();
          if (!code || !isLikelyBarcode(code)) return;
          void handleScannedBarcode(code);
        });
        zxingControlsRef.current = controls;
      } catch {
        toast({ title: "Camera unavailable", description: "Could not access camera. Check permissions and try again." });
        setCameraScanError("Could not access camera. Check browser camera permissions.");
        setIsCameraScanOpen(false);
      } finally {
        setBarcodeLookupBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      if (barcodeStreamRef.current) {
        barcodeStreamRef.current.getTracks().forEach((t) => t.stop());
        barcodeStreamRef.current = null;
      }
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
      if (zxingReaderRef.current) {
        zxingReaderRef.current = null;
      }
    };
  }, [isCameraScanOpen, toast]);

  function addScannedAsPremadeRecipe() {
    if (!scannedProduct || !familyGroup?.code) return;
    const displayName = barcodeMealName.trim() || scannedProduct.name;
    const name = scannedProduct.brand ? `${displayName} (${scannedProduct.brand})` : displayName;
    addRecipe({
      name,
      emoji: "🥡",
      family_code: "global",
      calories: scannedProduct.calories ?? 0,
      protein: scannedProduct.protein ?? 0,
      carbs: scannedProduct.carbs ?? 0,
      fat: scannedProduct.fat ?? 0,
      cook_time: 0,
      meal_slots: [premadeSlot],
      ingredients: [{ name: scannedProduct.name, amount: scannedProduct.serving_size || "1 serving", category: "other" }],
      method: ["Premade item added from barcode scan."],
      imported: true,
    });
    toast({ title: "Premade item added", description: `Added as global premade item for ${MEAL_SLOTS.find((s) => s.key === premadeSlot)?.label}.` });
  }

  async function handleMealPhotoUpload(file: File) {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });

      // Normalize/resize to a browser-friendly JPEG payload for AI vision APIs.
      const normalizedDataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxSize = 1280;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Image processing unavailable in this browser"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const out = canvas.toDataURL("image/jpeg", 0.82);
          resolve(out);
        };
        img.onerror = () => reject(new Error("Unsupported image format. Try JPG or PNG."));
        img.src = dataUrl;
      });
      const analysis = await analyzeMealPhoto(normalizedDataUrl, photoHint, 999999);
      setPhotoResult(analysis.result);
      setPhotoMealNameDraft(analysis.result.meal_name || "");
      setPhotoCaloriesDraft(String(analysis.result.calories || 0));
      setPhotoProteinDraft(String(analysis.result.protein || 0));
      setPhotoCarbsDraft(String(analysis.result.carbs || 0));
      setPhotoFatDraft(String(analysis.result.fat || 0));
      setMealName(analysis.result.meal_name || mealName);
      setCal(String(analysis.result.calories || 0));
      setProt(String(analysis.result.protein || 0));
      setCarbs(String(analysis.result.carbs || 0));
      setFat(String(analysis.result.fat || 0));
      setPhotoHistory((prev) => [{ at: new Date().toISOString(), analysis: analysis.result }, ...prev].slice(0, 10));
      toast({ title: "Meal analyzed", description: "Prediction loaded. Edit values if needed before logging." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try another image or enter values manually.";
      setPhotoError(message);
      toast({ title: "Photo analysis failed", description: message });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleConfirmPhotoAnalysis() {
    if (!selectedPhotoFile) {
      setPhotoError("Select an image first.");
      return;
    }
    await handleMealPhotoUpload(selectedPhotoFile);
  }

  function addBarcodeToFoodLogForm() {
    if (!scannedProduct) return;
    setMealName((barcodeMealName || scannedProduct.name).trim());
    setCal(String(scannedProduct.calories ?? 0));
    setProt(String(scannedProduct.protein ?? 0));
    setCarbs(String(scannedProduct.carbs ?? 0));
    setFat(String(scannedProduct.fat ?? 0));
    setIsBarcodeModalOpen(false);
  }

  function addPhotoAnalysisToFoodLogForm() {
    setMealName(photoMealNameDraft.trim() || photoResult?.meal_name || "Meal");
    setCal(photoCaloriesDraft);
    setProt(photoProteinDraft);
    setCarbs(photoCarbsDraft);
    setFat(photoFatDraft);
    setIsPhotoModalOpen(false);
  }

  async function handleDeleteLog(entryId: string) {
    if (!user?.uid) return;
    await removeDailyNutritionEntry(user.uid, selectedDate, entryId);
    const refreshed = await loadDailyNutritionLog(user.uid, selectedDate);
    setTodayLog(refreshed);
    setWeekLogs((prev) => ({ ...prev, [selectedDate]: refreshed }));
    if (isEditingId === entryId) setIsEditingId(null);
  }

  function handleEditLog(entry: NutritionLogEntry) {
    setIsEditingId(entry.id);
    setMealName(entry.meal_name);
    setCal(String(entry.calories || ""));
    setProt(String(entry.protein || ""));
    setCarbs(String(entry.carbs || ""));
    setFat(String(entry.fat || ""));
    setMealNote(entry.note ?? "");
    setManualIngredients(
      entry.ingredients?.length
        ? entry.ingredients.map((i) => ({
          id: crypto.randomUUID(),
          name: i.name,
          amount: i.amount ?? "",
          unit: (i.unit as ManualUnit) ?? "g",
        }))
        : [{ id: crypto.randomUUID(), name: "", amount: "100", unit: "g" }],
    );
    setTab("log");
  }

  async function handleAddWeight(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid) return;
    const kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg <= 0) return;
    const entry = {
      id: generateId(),
      date: selectedDate,
      kg: Math.round(kg * 10) / 10,
      created_at: new Date().toISOString(),
    };
    await saveBodyWeight(user.uid, entry);
    const refreshed = await loadBodyWeight(user.uid, format(subDays(new Date(), 30), "yyyy-MM-dd"));
    setWeightHistory(refreshed.sort((a, b) => a.date.localeCompare(b.date)));
    setWeightKg("");
  }

  // Which preset currently matches draft?
  const activePreset = PRESETS.find(
    p => p.calories === draft.calories && p.protein === draft.protein &&
         p.carbs === draft.carbs && p.fat === draft.fat
  );

  const ringPct = Math.min(100, Math.round((totalCals / Math.max(draft.calories, 1)) * 100));
  const traffic = totalCals > draft.calories
    ? { label: "Over target", cls: "bg-red-100 text-red-700" }
    : totalCals >= draft.calories * 0.9
      ? { label: "Near target", cls: "bg-amber-100 text-amber-700" }
      : { label: "On track", cls: "bg-green-100 text-green-700" };
  const remaining = {
    calories: Math.max(0, draft.calories - totalCals),
    protein: Math.max(0, draft.protein - totalProt),
    carbs: Math.max(0, draft.carbs - totalCarbs),
    fat: Math.max(0, draft.fat - totalFat),
  };

  const avgWeek = useMemo(() => {
    const sum = weekDates.reduce((acc, d) => {
      const t = weekLogs[d]?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
      return {
        calories: acc.calories + t.calories,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    return {
      calories: Math.round(sum.calories / 7),
      protein: Math.round(sum.protein / 7),
      carbs: Math.round(sum.carbs / 7),
      fat: Math.round(sum.fat / 7),
    };
  }, [weekDates, weekLogs]);

  const proteinStreak = useMemo(() => {
    let streak = 0;
    for (let i = weekDates.length - 1; i >= 0; i--) {
      const protein = weekLogs[weekDates[i]]?.totals.protein ?? 0;
      if (protein >= draft.protein) streak++;
      else break;
    }
    return streak;
  }, [draft.protein, weekDates, weekLogs]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "goals",   label: "Goals"   },
    { key: "summary", label: "Today"   },
    { key: "log",     label: "Food Log"},
    { key: "weight",  label: "Weight"  },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-12 pb-4 bg-white sticky top-0 z-20 border-b border-border/50">
        <h1 className="text-3xl font-display font-bold mb-4">Health</h1>
        <div className="flex bg-secondary p-1 rounded-xl">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t.key ? "bg-white shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 pb-32 space-y-6">

        {loading && <Card>Loading nutrition data...</Card>}

        {/* ── GOALS ────────────────────────────────────────────────── */}
        {tab === "goals" && !loading && (
          <>
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              Quick Presets
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => {
                const active = p.name === activePreset?.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      active
                        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                        : "bg-white border-border hover:border-primary/30"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center">
                        <Check size={12} />
                      </span>
                    )}
                    <span className={`text-sm font-bold ${active ? "text-primary" : ""}`}>
                      {p.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      {p.calories.toLocaleString()} kcal · {p.protein}g protein
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider pt-2">
              Fine-tune
            </h2>

            <Card className="space-y-6">
              <SliderRow
                label="Calories"
                unit=" kcal"
                value={draft.calories}
                min={800}
                max={5000}
                step={50}
                onChange={v => { setDraft(d => ({ ...d, calories: v })); setSaved(false); }}
              />
              <SliderRow
                label="Protein"
                unit="g"
                value={draft.protein}
                min={20}
                max={350}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, protein: v })); setSaved(false); }}
              />
              <SliderRow
                label="Carbohydrates"
                unit="g"
                value={draft.carbs}
                min={20}
                max={700}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, carbs: v })); setSaved(false); }}
              />
              <SliderRow
                label="Fat"
                unit="g"
                value={draft.fat}
                min={10}
                max={300}
                step={5}
                onChange={v => { setDraft(d => ({ ...d, fat: v })); setSaved(false); }}
              />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">My Portion Factor</span>
                  <span className="text-sm font-bold text-primary tabular-nums">{servingFactorDraft.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={servingFactorDraft}
                  onChange={(e) => { setServingFactorDraft(Number(e.target.value)); setSaved(false); }}
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used to split planned meal nutrition into your personal eaten amount.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold block mb-2">Linked Family Member</label>
                <select
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
                  value={linkedMemberIdDraft}
                  onChange={(e) => { setLinkedMemberIdDraft(e.target.value); setSaved(false); }}
                >
                  <option value={SELF_MEMBER_ID}>Me (personal profile)</option>
                  <option value="">Not linked</option>
                  {(familyGroup?.family_members ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.type})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Personal logs stay private. Linking only improves your portion-size defaults.
                </p>
              </div>
            </Card>

            {(draft.calories < 1000 || draft.calories > 4500) && (
              <Card className="text-xs text-amber-700 bg-amber-50 border-amber-200">
                Calories are outside a typical daily range. Double-check this target.
              </Card>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={saveGoals}
              disabled={saved}
            >
              {saved
                ? <><Check size={16} className="mr-2" /> Saved</>
                : <><Target size={16} className="mr-2" /> Save Goals</>
              }
            </Button>
          </>
        )}

        {/* ── SUMMARY ──────────────────────────────────────────────── */}
        {tab === "summary" && !loading && (
          <>
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              {selectedDate === todayStr ? "Today's Progress" : `Progress for ${selectedDate}`}
            </h2>

            <Card className="flex items-center gap-4">
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90">
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="12" className="text-secondary fill-none" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={`${(ringPct / 100) * 314} 314`}
                    className="text-primary fill-none transition-all"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-bold">{ringPct}%</p>
                  <p className="text-[10px] text-muted-foreground">Calories</p>
                </div>
              </div>
              <div className="flex-1">
                <p className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${traffic.cls}`}>{traffic.label}</p>
                <p className="text-sm mt-2">{totalCals.toLocaleString()} / {draft.calories.toLocaleString()} kcal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining: {remaining.calories} kcal, {remaining.protein}g protein, {remaining.carbs}g carbs, {remaining.fat}g fat
                </p>
              </div>
            </Card>

            <Card className="space-y-5">
              {[
                { label: "Calories",      val: totalCals,  goal: draft.calories, unit: "kcal", color: "bg-amber-400" },
                { label: "Protein",       val: totalProt,  goal: draft.protein,  unit: "g",    color: "bg-primary"   },
                { label: "Carbohydrates", val: totalCarbs, goal: draft.carbs,    unit: "g",    color: "bg-blue-400"  },
                { label: "Fat",           val: totalFat,   goal: draft.fat,      unit: "g",    color: "bg-rose-400"  },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {row.val} / {row.goal.toLocaleString()}{row.unit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct(row.val, row.goal)}%` }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            <button
              onClick={() => setTab("goals")}
              className="w-full flex items-center justify-between bg-white border border-border rounded-2xl p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Target size={20} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">
                    {activePreset?.name ?? "Custom"} — {draft.calories.toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-muted-foreground">Tap to edit goals</p>
                </div>
              </div>
              <span className="text-muted-foreground text-lg">›</span>
            </button>

            <Card className="space-y-3">
              <h3 className="font-semibold text-sm">Weekly Overview</h3>
              <p className="text-xs text-muted-foreground">
                Avg/day: {avgWeek.calories} kcal · P {avgWeek.protein}g · C {avgWeek.carbs}g · F {avgWeek.fat}g
              </p>
              <p className="text-xs font-semibold text-primary">Protein goal streak: {proteinStreak} day{proteinStreak === 1 ? "" : "s"}</p>
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map((d) => {
                  const totals = weekLogs[d]?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
                  const calPct = Math.min(100, Math.round((totals.calories / Math.max(draft.calories, 1)) * 100));
                  const protPct = Math.min(100, Math.round((totals.protein / Math.max(draft.protein, 1)) * 100));
                  const hit = totals.calories > 0 && calPct <= 105 && protPct >= 90;
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className={`h-16 rounded-md border px-1 pt-1 flex flex-col justify-end text-[9px] ${
                        selectedDate === d
                          ? "ring-1 ring-primary border-primary/50 bg-primary/5"
                          : hit ? "bg-green-50 border-green-300" : "bg-secondary/40 border-border"
                      }`}
                    >
                      <div className="h-8 bg-white/70 rounded-sm overflow-hidden mb-1">
                        <div className="bg-amber-300" style={{ height: `${Math.max(calPct / 2, 2)}%` }} />
                        <div className="bg-primary/70" style={{ height: `${Math.max(protPct / 2, 2)}%` }} />
                      </div>
                      <span className="text-center">{format(new Date(d), "EEE")}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Delta vs goal: {avgWeek.calories - draft.calories > 0 ? "+" : ""}{avgWeek.calories - draft.calories} kcal,{" "}
                {avgWeek.protein - draft.protein > 0 ? "+" : ""}{avgWeek.protein - draft.protein}g protein.
              </p>
            </Card>
          </>
        )}

        {/* ── FOOD LOG ─────────────────────────────────────────────── */}
        {tab === "log" && !loading && (
          <>
            <Card className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Log Date</label>
              <input
                type="date"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayStr)}
              />
            </Card>
            <form
              onSubmit={handleAddLog}
              className="bg-white p-4 rounded-2xl border border-border space-y-3 min-w-0 max-w-full overflow-x-hidden"
            >
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={() => setIsBarcodeModalOpen(true)}>
                  Scan Barcode
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => setIsPhotoModalOpen(true)}>
                  Upload Meal Photo
                </Button>
              </div>

              <input
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder="What did you eat?"
                value={mealName}
                onChange={e => setMealName(e.target.value)}
              />
              <textarea
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none"
                rows={2}
                placeholder="Optional details or AI prompt context"
                value={mealNote}
                onChange={e => setMealNote(e.target.value)}
              />
              <div className="bg-secondary/30 border border-border rounded-xl p-3 space-y-2 overflow-x-hidden">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ingredient estimator</p>
                {manualIngredients.map((row) => (
                  <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_56px_62px_24px] gap-1.5 items-center">
                    <input
                      className="min-w-0 border border-border rounded-lg px-2.5 py-2 text-sm bg-white"
                      placeholder="Ingredient"
                      value={row.name}
                      onChange={(e) => setManualIngredients((prev) => prev.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                    />
                    <input
                      type="number"
                      className="w-full border border-border rounded-lg px-1.5 py-2 text-sm bg-white"
                      value={row.amount}
                      onChange={(e) => setManualIngredients((prev) => prev.map((r) => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                    />
                    <select
                      className="w-full border border-border rounded-lg px-1 py-2 text-[11px] bg-white"
                      value={row.unit}
                      onChange={(e) => setManualIngredients((prev) => prev.map((r) => r.id === row.id ? { ...r, unit: e.target.value as ManualUnit } : r))}
                    >
                      <option value="g">g</option><option value="kg">kg</option><option value="oz">oz</option><option value="lb">lb</option>
                      <option value="cup">cup</option><option value="tbsp">tbsp</option><option value="tsp">tsp</option><option value="piece">piece</option>
                    </select>
                    <button
                      type="button"
                      className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive"
                      onClick={() => setManualIngredients((prev) => prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="w-full text-xs sm:text-sm" onClick={estimateFromIngredients}>
                    Estimate from ingredients
                  </Button>
                  <Button type="button" variant="outline" className="w-full text-xs sm:text-sm" onClick={() => {
                    void estimateFromAiPrompt();
                  }} disabled={!mealName.trim() || aiMutation.isPending}>
                    {aiMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
                    Use AI prompt
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-xs text-primary font-semibold hover:underline"
                  onClick={() => setManualIngredients((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: "100", unit: "g" }])}
                >
                  + Add ingredient
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 min-w-0">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Calories (kcal)</span>
                  <input
                    type="number"
                    className="min-w-0 w-full border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Calories"
                    value={cal}
                    onChange={e => setCal(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Protein (g)</span>
                  <input
                    type="number"
                    className="min-w-0 w-full border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Protein"
                    value={prot}
                    onChange={e => setProt(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Carbs (g)</span>
                  <input
                    type="number"
                    className="min-w-0 w-full border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Carbs"
                    value={carbs}
                    onChange={e => setCarbs(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fat (g)</span>
                  <input
                    type="number"
                    className="min-w-0 w-full border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-primary"
                    placeholder="Fat"
                    value={fat}
                    onChange={e => setFat(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>
              {estimatingError && <p className="text-xs text-destructive">{estimatingError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {isEditingId ? <><Save size={14} className="mr-1" /> Save Update</> : "Log Food"}
                </Button>
                {isEditingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingId(null);
                      setMealName(""); setCal(""); setProt(""); setCarbs(""); setFat(""); setMealNote("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>

            <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload Meal Photo</DialogTitle>
                  <DialogDescription>
                    AI action: this analysis may consume credits when paid mode is enabled.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <input
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder="Optional hint (e.g. chicken burrito bowl)"
                    value={photoHint}
                    onChange={(e) => setPhotoHint(e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoFileName(file.name);
                      setSelectedPhotoFile(file);
                      setPhotoError("");
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={photoBusy || !selectedPhotoFile}
                    onClick={() => { void handleConfirmPhotoAnalysis(); }}
                  >
                    {photoBusy ? "Analyzing..." : "Use AI to analyze"}
                  </Button>
                  {photoError && <p className="text-xs text-destructive">{photoError}</p>}
                  {photoResult && (
                    <div className="space-y-3 border border-border rounded-xl p-3 bg-secondary/20">
                      <input className="w-full border rounded-xl px-3 py-2 text-sm bg-white" value={photoMealNameDraft} onChange={(e) => setPhotoMealNameDraft(e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Calories" value={photoCaloriesDraft} onChange={(e) => setPhotoCaloriesDraft(e.target.value)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Protein" value={photoProteinDraft} onChange={(e) => setPhotoProteinDraft(e.target.value)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Carbs" value={photoCarbsDraft} onChange={(e) => setPhotoCarbsDraft(e.target.value)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Fat" value={photoFatDraft} onChange={(e) => setPhotoFatDraft(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:justify-center">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsPhotoModalOpen(false)}>Cancel</Button>
                  <Button type="button" className="w-full sm:w-auto" onClick={addPhotoAnalysisToFoodLogForm} disabled={!photoResult}>Add to food log</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isBarcodeModalOpen} onOpenChange={(open) => {
              setIsBarcodeModalOpen(open);
              if (!open) setIsCameraScanOpen(false);
            }}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Scan Barcode</DialogTitle>
                  <DialogDescription>
                    Scan with camera or enter a barcode manually.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white"
                      placeholder="Enter barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={() => { void handleLookupBarcode(); }} disabled={barcodeLookupBusy || !barcode.trim()}>
                      {barcodeLookupBusy ? "Looking..." : "Lookup"}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setIsCameraScanOpen((v) => !v)}>
                    {isCameraScanOpen ? "Stop camera scan" : "Use camera"}
                  </Button>
                  {isCameraScanOpen && (
                    <>
                      <video ref={barcodeVideoRef} className="w-full rounded-lg border border-border bg-black/5" muted playsInline />
                      {cameraScanStatus && <p className="text-xs text-muted-foreground">{cameraScanStatus}</p>}
                      {cameraScanError && <p className="text-xs text-destructive">{cameraScanError}</p>}
                    </>
                  )}
                  {barcodeStatus && <p className="text-xs text-muted-foreground">{barcodeStatus}</p>}
                  {barcodeError && <p className="text-xs text-destructive">{barcodeError}</p>}
                  {scannedProduct && (
                    <div className="space-y-3 border border-border rounded-xl p-3 bg-secondary/20">
                      <input
                        className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                        value={barcodeMealName}
                        onChange={(e) => setBarcodeMealName(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Calories" value={String(scannedProduct.calories ?? 0)} onChange={(e) => setScannedProduct((p) => p ? { ...p, calories: Number(e.target.value) || 0 } : p)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Protein" value={String(scannedProduct.protein ?? 0)} onChange={(e) => setScannedProduct((p) => p ? { ...p, protein: Number(e.target.value) || 0 } : p)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Carbs" value={String(scannedProduct.carbs ?? 0)} onChange={(e) => setScannedProduct((p) => p ? { ...p, carbs: Number(e.target.value) || 0 } : p)} />
                        <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm bg-white" placeholder="Fat" value={String(scannedProduct.fat ?? 0)} onChange={(e) => setScannedProduct((p) => p ? { ...p, fat: Number(e.target.value) || 0 } : p)} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={premadeSlot}
                          onChange={(e) => setPremadeSlot(e.target.value as typeof premadeSlot)}
                        >
                          {MEAL_SLOTS.map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
                        </select>
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addScannedAsPremadeRecipe}>Add as premade recipe</Button>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:justify-center">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsBarcodeModalOpen(false)}>Cancel</Button>
                  <Button type="button" className="w-full sm:w-auto" onClick={addBarcodeToFoodLogForm} disabled={!scannedProduct}>Add to food log</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                {selectedDate === todayStr ? "Today's Log" : `Log for ${selectedDate}`}
              </h3>
              {(todayLog?.entries.length ?? 0) === 0 ? (
                <p className="text-sm text-center py-10 text-muted-foreground">Nothing logged today.</p>
              ) : (
                (todayLog?.entries ?? []).map(log => (
                  <div
                    key={log.id}
                    className="bg-white p-4 rounded-xl border border-border"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="font-medium text-sm">{log.meal_name}</span>
                        {log.note && <p className="text-xs text-muted-foreground mt-1">{log.note}</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">Personal only - does not change family plan.</p>
                      </div>
                      <div className="text-right text-xs space-x-2">
                        <span className="font-bold text-amber-500">{log.calories} kcal</span>
                        <span className="font-bold text-primary">{log.protein}g P</span>
                        <span className="font-bold text-blue-500">{log.carbs}g C</span>
                        <span className="font-bold text-rose-500">{log.fat}g F</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleEditLog(log)}>
                        <Pencil size={13} className="mr-1" /> Edit
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { void handleDeleteLog(log.id); }}>
                        <Trash2 size={13} className="mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "weight" && !loading && (
          <>
            <form onSubmit={handleAddWeight} className="bg-white p-4 rounded-2xl border border-border space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Scale size={16} /> Log today's body weight
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
                  placeholder="kg"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
                <Button type="submit">Save</Button>
              </div>
            </form>
            <Card>
              <h3 className="font-semibold text-sm mb-3">Last 30 Days</h3>
              {weightHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No weight logs yet.</p>
              ) : (
                <div className="space-y-2">
                  {weightHistory.slice(-10).reverse().map((w) => (
                    <div key={w.id} className="flex justify-between text-sm">
                      <span>{format(new Date(w.date), "EEE, MMM d")}</span>
                      <span className="font-semibold">{w.kg} kg</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
