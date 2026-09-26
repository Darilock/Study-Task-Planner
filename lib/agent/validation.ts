// Validation for the agent's tool inputs. Everything the model sends is
// untrusted: check shape, types and ranges here before anything reaches the
// database. No Next.js or Supabase imports, and local imports use .ts
// extensions, so `node --test` can load this file directly.
import { isDateKey } from "../calendar/dates.ts";
import { DEFAULT_PRIORITY, DESCRIPTION_MAX_LENGTH, isPriority, PRIORITIES, type TaskPriority } from "../types.ts";

/** A tool input problem to report back to the model, which can then retry. */
export class ToolInputError extends Error {}

export const MAX_TASKS_PER_CALL = 20;

export function asObject(value: unknown, allowed: string[], label = "input"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolInputError(`${label} must be an object.`);
  }
  const unknownKeys = Object.keys(value).filter((k) => !allowed.includes(k));
  if (unknownKeys.length > 0) {
    throw new ToolInputError(`${label} has unexpected fields: ${unknownKeys.join(", ")}.`);
  }
  return value as Record<string, unknown>;
}

/** null for a missing or null value, otherwise the parsed value. */
export function optional<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === undefined || value === null ? null : parse(value);
}

export function asString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new ToolInputError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ToolInputError(`${label} must not be empty.`);
  if (trimmed.length > maxLength) {
    throw new ToolInputError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

export function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ToolInputError(`${label} must be true or false.`);
  return value;
}

export function asPriority(value: unknown, label: string): TaskPriority {
  if (!isPriority(value)) throw new ToolInputError(`${label} must be one of: ${PRIORITIES.join(", ")}.`);
  return value;
}

export function asMinutes(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > 10000) {
    throw new ToolInputError(`${label} must be a whole number between 1 and 10000.`);
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `source` names the tool the id should come from, for the error message. */
export function asUuid(value: unknown, label: string, source: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new ToolInputError(`${label} must be an id from ${source}.`);
  }
  return value;
}

/** A real calendar date in YYYY-MM-DD form, checked as a local date (never parsed as UTC). */
export function asDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !isDateKey(value)) {
    throw new ToolInputError(`${label} must be a real date in YYYY-MM-DD format.`);
  }
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) throw new ToolInputError(`${label} is out of range.`);
  return value;
}

export type NewTaskRow = {
  title: string;
  description: string | null;
  subject: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  scheduled_for: string | null;
  priority: TaskPriority;
};

/** Validates create_tasks input into rows ready to insert. */
export function parseCreateTasks(input: unknown): NewTaskRow[] {
  const obj = asObject(input, ["tasks"]);
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new ToolInputError("tasks must be a non-empty array.");
  }
  if (obj.tasks.length > MAX_TASKS_PER_CALL) {
    throw new ToolInputError(`Create at most ${MAX_TASKS_PER_CALL} tasks per call.`);
  }

  return obj.tasks.map((raw, i) => {
    const t = asObject(
      raw,
      ["title", "description", "subject", "due_date", "estimated_minutes", "scheduled_for", "priority"],
      `tasks[${i}]`,
    );
    return {
      title: asString(t.title, `tasks[${i}].title`, 200),
      description: optional(t.description, (v) => asString(v, `tasks[${i}].description`, DESCRIPTION_MAX_LENGTH)),
      subject: optional(t.subject, (v) => asString(v, `tasks[${i}].subject`, 100)),
      due_date: optional(t.due_date, (v) => asDate(v, `tasks[${i}].due_date`)),
      estimated_minutes: optional(t.estimated_minutes, (v) => asMinutes(v, `tasks[${i}].estimated_minutes`)),
      scheduled_for: optional(t.scheduled_for, (v) => asDate(v, `tasks[${i}].scheduled_for`)),
      priority: optional(t.priority, (v) => asPriority(v, `tasks[${i}].priority`)) ?? DEFAULT_PRIORITY,
    };
  });
}
