import type { ClassMeeting } from "./types";

export const MAX_MEETINGS_PER_CLASS = 14;

// Indexed by day_of_week (0 = Sunday).
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBREVIATIONS = ["Su", "M", "T", "W", "Th", "F", "Sa"];

// Weeks read Monday first, so Sunday sorts last.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const weekPosition = (day: number) => WEEK_ORDER.indexOf(day);

function to12Hour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { clock: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, meridiem: h < 12 ? "AM" : "PM" };
}

/** "10:00–10:50 AM", or "11:30 AM–12:20 PM" when the range crosses noon. */
export function formatTimeRange(start: string, end: string) {
  const a = to12Hour(start);
  const b = to12Hour(end);
  return a.meridiem === b.meridiem
    ? `${a.clock}–${b.clock} ${b.meridiem}`
    : `${a.clock} ${a.meridiem}–${b.clock} ${b.meridiem}`;
}

/**
 * Groups meetings that share a time slot, e.g. ["MWF 10:00–10:50 AM", "Th 2:00–3:15 PM"].
 * Groups are ordered by their first day of the week, then start time.
 */
export function formatSchedule(meetings: Pick<ClassMeeting, "day_of_week" | "start_time" | "end_time">[]) {
  const slots = new Map<string, { start: string; end: string; days: number[] }>();
  for (const m of meetings) {
    const start = m.start_time.slice(0, 5);
    const end = m.end_time.slice(0, 5);
    const key = `${start}-${end}`;
    const slot = slots.get(key) ?? { start, end, days: [] };
    if (!slot.days.includes(m.day_of_week)) slot.days.push(m.day_of_week);
    slots.set(key, slot);
  }

  return [...slots.values()]
    .map((slot) => ({ ...slot, days: slot.days.sort((a, b) => weekPosition(a) - weekPosition(b)) }))
    .sort((a, b) => weekPosition(a.days[0]) - weekPosition(b.days[0]) || a.start.localeCompare(b.start))
    .map((slot) => `${slot.days.map((d) => DAY_ABBREVIATIONS[d]).join("")} ${formatTimeRange(slot.start, slot.end)}`);
}
