// Validation for the agent's tool inputs. Everything the model sends is
// untrusted: check shape, types and ranges here before anything reaches the
// database. No Next.js or Supabase imports, and local imports use .ts
// extensions, so `node --test` can load this file directly.
import { isDateKey } from "../calendar/dates.ts";
import { isTaskType, TASK_TYPES, type TaskType } from "../grades.ts";
import {
  DEFAULT_PRIORITY,
  DESCRIPTION_MAX_LENGTH,
  isPriority,
  MAX_POINTS_LIMIT,
  PRIORITIES,
  type TaskPriority,
} from "../types.ts";

/** A tool input problem to report back to the model, which can then retry. */
export class ToolInputError extends Error {}

/** Tasks one agent request may create or update, combined. */
export const MAX_TASK_CHANGES_PER_REQUEST = 15;

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

export function asTaskType(value: unknown, label: string): TaskType {
  if (!isTaskType(value)) throw new ToolInputError(`${label} must be one of: ${TASK_TYPES.join(", ")}.`);
  return value;
}

export function asMaxPoints(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_POINTS_LIMIT) {
    throw new ToolInputError(`${label} must be a number above 0 and at most ${MAX_POINTS_LIMIT}.`);
  }
  return value;
}

/**
 * A planned study day must be today or later, and no later than the due date.
 * `today` is the student's local date.
 */
export function checkScheduledFor(scheduledFor: string | null, dueDate: string | null, today: string, label: string) {
  if (!scheduledFor) return;
  if (scheduledFor < today) {
    throw new ToolInputError(`${label} can't be in the past (today is ${today}).`);
  }
  if (dueDate && scheduledFor > dueDate) {
    throw new ToolInputError(`${label} (${scheduledFor}) must be on or before the due date (${dueDate}).`);
  }
}

export type NewTaskRow = {
  title: string;
  description: string | null;
  subject: string | null;
  class_id: string | null;
  task_type: TaskType | null;
  max_points: number | null;
  due_date: string | null;
  estimated_minutes: number | null;
  scheduled_for: string | null;
  priority: TaskPriority;
};

const CREATE_FIELDS = [
  "title",
  "description",
  "subject",
  "class_id",
  "task_type",
  "max_points",
  "due_date",
  "estimated_minutes",
  "scheduled_for",
  "priority",
];

/**
 * Validates create_tasks input into rows ready to insert. Graded types need a
 * class, only graded types have max points, and study days follow checkScheduledFor.
 */
export function parseCreateTasks(input: unknown, today: string): NewTaskRow[] {
  const obj = asObject(input, ["tasks"]);
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new ToolInputError("tasks must be a non-empty array.");
  }
  if (obj.tasks.length > MAX_TASK_CHANGES_PER_REQUEST) {
    throw new ToolInputError(`Create at most ${MAX_TASK_CHANGES_PER_REQUEST} tasks per request.`);
  }

  return obj.tasks.map((raw, i) => {
    const label = `tasks[${i}]`;
    const t = asObject(raw, CREATE_FIELDS, label);
    const row: NewTaskRow = {
      title: asString(t.title, `${label}.title`, 200),
      description: optional(t.description, (v) => asString(v, `${label}.description`, DESCRIPTION_MAX_LENGTH)),
      subject: optional(t.subject, (v) => asString(v, `${label}.subject`, 100)),
      class_id: optional(t.class_id, (v) => asUuid(v, `${label}.class_id`, "list_classes")),
      task_type: optional(t.task_type, (v) => asTaskType(v, `${label}.task_type`)),
      max_points: optional(t.max_points, (v) => asMaxPoints(v, `${label}.max_points`)),
      due_date: optional(t.due_date, (v) => asDate(v, `${label}.due_date`)),
      estimated_minutes: optional(t.estimated_minutes, (v) => asMinutes(v, `${label}.estimated_minutes`)),
      scheduled_for: optional(t.scheduled_for, (v) => asDate(v, `${label}.scheduled_for`)),
      priority: optional(t.priority, (v) => asPriority(v, `${label}.priority`)) ?? DEFAULT_PRIORITY,
    };
    if (row.task_type && !row.class_id) {
      throw new ToolInputError(`${label}: graded work (task_type ${row.task_type}) needs a class_id from list_classes.`);
    }
    if (row.max_points !== null && !row.task_type) {
      throw new ToolInputError(`${label}: max_points is only for graded work; set a task_type or leave it out.`);
    }
    checkScheduledFor(row.scheduled_for, row.due_date, today, `${label}.scheduled_for`);
    return row;
  });
}

export const TASK_STATUS_FILTERS = ["open", "todo", "in_progress", "done", "all"] as const;
export type TaskStatusFilter = (typeof TASK_STATUS_FILTERS)[number];

export type ListTasksFilter = {
  /** Tasks due or scheduled on or after this date. */
  from: string | null;
  /** Tasks due or scheduled on or before this date. */
  to: string | null;
  /** A class id, "none" for tasks without a class, or null for any. */
  classId: string | null;
  status: TaskStatusFilter;
};

/** Validates list_tasks input. Status defaults to "open" (everything not done). */
export function parseListTasks(input: unknown): ListTasksFilter {
  const obj = asObject(input ?? {}, ["from", "to", "class_id", "status"]);
  const from = optional(obj.from, (v) => asDate(v, "from"));
  const to = optional(obj.to, (v) => asDate(v, "to"));
  if (from && to && to < from) throw new ToolInputError("to must be on or after from.");
  const classId = optional(obj.class_id, (v) => (v === "none" ? "none" : asUuid(v, "class_id", "list_classes")));
  const status = obj.status === undefined || obj.status === null ? "open" : obj.status;
  if (!(TASK_STATUS_FILTERS as readonly unknown[]).includes(status)) {
    throw new ToolInputError(`status must be one of: ${TASK_STATUS_FILTERS.join(", ")}.`);
  }
  return { from, to, classId, status: status as TaskStatusFilter };
}
