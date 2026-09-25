// Calendar dates are plain YYYY-MM-DD values with no time zone ("date keys").
// Always parse them as local dates with parseLocalDate. new Date("YYYY-MM-DD")
// reads them as UTC midnight, which is the previous evening in US time zones.
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const CALENDAR_VIEWS = ["month", "week", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
/** No view chosen: month on wide screens, agenda on narrow ones, both over the same month. */
export type ViewSetting = CalendarView | "auto";

const KEY_FORMAT = "yyyy-MM-dd";

/** Local midnight on the given date. */
export function parseLocalDate(key: string): Date {
  return parse(key, KEY_FORMAT, new Date());
}

export function toDateKey(date: Date): string {
  return format(date, KEY_FORMAT);
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseLocalDate(value);
  // Round-trip rejects impossible dates like 2026-02-30.
  return isValid(date) && toDateKey(date) === value;
}

/** Every date key from start to end, inclusive. */
export function eachDateKey(start: string, end: string): string[] {
  if (end < start) return [];
  return eachDayOfInterval({ start: parseLocalDate(start), end: parseLocalDate(end) }).map(toDateKey);
}

/**
 * The inclusive date range a view shows. Weeks start on Sunday. Month views
 * cover whole weeks, so they include a few days from the months either side.
 */
export function visibleRange(view: ViewSetting, anchor: string): { start: string; end: string } {
  const date = parseLocalDate(anchor);
  if (view === "week") {
    return { start: toDateKey(startOfWeek(date)), end: toDateKey(endOfWeek(date)) };
  }
  if (view === "agenda") {
    return { start: toDateKey(startOfMonth(date)), end: toDateKey(endOfMonth(date)) };
  }
  return {
    start: toDateKey(startOfWeek(startOfMonth(date))),
    end: toDateKey(endOfWeek(endOfMonth(date))),
  };
}

/** The anchor one period before or after: a week in week view, otherwise a month. */
export function shiftAnchor(view: ViewSetting, anchor: string, step: 1 | -1): string {
  const date = parseLocalDate(anchor);
  return toDateKey(view === "week" ? addWeeks(date, step) : addMonths(date, step));
}

/** "September 2026", or "Sep 20 – 26, 2026" for a week. */
export function rangeTitle(view: ViewSetting, anchor: string): string {
  if (view !== "week") return format(parseLocalDate(anchor), "MMMM yyyy");
  const start = startOfWeek(parseLocalDate(anchor));
  const end = endOfWeek(start);
  if (start.getFullYear() !== end.getFullYear()) return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  if (start.getMonth() !== end.getMonth()) return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
}

export function formatDateKey(key: string, pattern: string): string {
  return format(parseLocalDate(key), pattern);
}
