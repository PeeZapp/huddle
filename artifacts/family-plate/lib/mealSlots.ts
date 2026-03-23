export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const DAY_FULL_LABELS: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const MEAL_SLOT_KEYS = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "night_snack",
  "dessert",
] as const;
export type MealSlotKey = (typeof MEAL_SLOT_KEYS)[number];

export const MEAL_SLOTS: { key: MealSlotKey; label: string; shortLabel: string }[] = [
  { key: "breakfast", label: "Breakfast", shortLabel: "Breakfast" },
  { key: "morning_snack", label: "Morning Snack", shortLabel: "AM Snack" },
  { key: "lunch", label: "Lunch", shortLabel: "Lunch" },
  { key: "afternoon_snack", label: "Afternoon Snack", shortLabel: "PM Snack" },
  { key: "dinner", label: "Dinner", shortLabel: "Dinner" },
  { key: "night_snack", label: "Night Snack", shortLabel: "Night" },
  { key: "dessert", label: "Dessert", shortLabel: "Dessert" },
];

export const DEFAULT_ACTIVE_SLOTS: MealSlotKey[] = ["breakfast", "lunch", "dinner"];

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function todayDayKey(): Day {
  const dayIndex = new Date().getDay();
  const map: Day[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return map[dayIndex];
}
