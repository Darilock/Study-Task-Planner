// Task dates are plain YYYY-MM-DD values; format in UTC so they never shift a day.
export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDay(date: string, withYear: boolean) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** "Sep 2 – Dec 12, 2026", "From Sep 2, 2026", "Until Dec 12, 2026", or null. */
export function formatTerm(start: string | null, end: string | null) {
  if (start && end) {
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
  }
  if (start) return `From ${formatDay(start, true)}`;
  if (end) return `Until ${formatDay(end, true)}`;
  return null;
}
