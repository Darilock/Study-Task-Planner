import { useMemo, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();
// Used when localStorage is unavailable (private windows, blocked site data),
// so a choice still applies for the rest of the visit.
const inMemory = new Map<string, string>();

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => set.delete(listener);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? inMemory.get(key) ?? null;
  } catch {
    return inMemory.get(key) ?? null;
  }
}

/**
 * A per-browser preference kept in localStorage. `parse` turns the stored
 * string (or null) into a value and should fall back to a default for
 * anything unexpected; keep it a stable, module-level function. The server
 * render and the first client render both see null, so hydration matches.
 */
export function useStoredValue<T>(key: string, parse: (raw: string | null) => T) {
  const raw = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => read(key),
    () => null,
  );
  const value = useMemo(() => parse(raw), [parse, raw]);

  function update(next: T) {
    const serialized = JSON.stringify(next);
    inMemory.set(key, serialized);
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // Kept in memory instead.
    }
    listeners.get(key)?.forEach((listener) => listener());
  }

  return [value, update] as const;
}
