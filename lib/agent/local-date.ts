// The agent's idea of "today". No imports, so `node --test` can load it directly.

/** Longest IANA zone names are around 30 characters; anything much longer is junk. */
const MAX_TIME_ZONE_LENGTH = 64;

/**
 * The client's IANA time zone (e.g. "America/New_York") if the runtime
 * recognizes it, otherwise "UTC".
 */
export function resolveTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > MAX_TIME_ZONE_LENGTH) return "UTC";
  try {
    // Throws a RangeError for unknown zones. Keep the client's spelling: some
    // runtimes canonicalize to legacy names (Asia/Kolkata → Asia/Calcutta).
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/**
 * The calendar date (YYYY-MM-DD) and weekday it is right now in `timeZone`.
 * At 10 PM on Friday in New York it's already Saturday in UTC; this returns Friday.
 */
export function localDateInZone(now: Date, timeZone: string): { date: string; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, weekday: part("weekday") };
}
