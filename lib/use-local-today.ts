import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The browser's local date as YYYY-MM-DD, or null during server rendering,
 * where the student's time zone isn't known. Returning null there avoids a
 * hydration mismatch; the real value appears right after hydration.
 */
export function useLocalToday(): string | null {
  return useSyncExternalStore(subscribe, localToday, () => null);
}
