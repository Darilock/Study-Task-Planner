/** True for a real calendar date in YYYY-MM-DD form. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Round-trip rejects impossible dates like 2026-02-30.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
