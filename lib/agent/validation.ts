// Validation for the agent's tool inputs. Everything the model sends is
// untrusted: check shape, types and ranges here before anything reaches the
// database. No Next.js or Supabase imports, and local imports use .ts
// extensions, so `node --test` can load this file directly.
import { isDateKey } from "../calendar/dates.ts";
import { CLASS_COLORS } from "../class-colors.ts";
import { GRADING_MODES, isTaskType, TASK_TYPES, type GradingMode, type TaskType } from "../grades.ts";
import { MAX_MEETINGS_PER_CLASS } from "../schedule.ts";
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

/** Tasks and classes one agent request may create or update, combined. */
export const MAX_TASK_CHANGES_PER_REQUEST = 15;
/** Classes one agent request may create (these also count toward MAX_TASK_CHANGES_PER_REQUEST). */
export const MAX_CLASSES_PER_REQUEST = 5;

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

/** The only fields update_task may change. Grades, status, type and class are off limits. */
export const UPDATABLE_FIELDS = ["priority", "description", "due_date", "scheduled_for", "estimated_minutes"] as const;
export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

export type TaskUpdate = {
  priority?: TaskPriority;
  description?: string | null;
  due_date?: string | null;
  scheduled_for?: string | null;
  estimated_minutes?: number | null;
};

/** Validates update_task input. Null clears a field (except priority); at least one field must be given. */
export function parseUpdateTask(input: unknown): { id: string; update: TaskUpdate } {
  const obj = asObject(input, ["id", ...UPDATABLE_FIELDS]);
  const id = asUuid(obj.id, "id", "list_tasks or create_tasks");
  const update: TaskUpdate = {};
  if (obj.priority !== undefined) update.priority = asPriority(obj.priority, "priority");
  if (obj.description !== undefined) {
    update.description = optional(obj.description, (v) => asString(v, "description", DESCRIPTION_MAX_LENGTH));
  }
  if (obj.due_date !== undefined) update.due_date = optional(obj.due_date, (v) => asDate(v, "due_date"));
  if (obj.scheduled_for !== undefined) update.scheduled_for = optional(obj.scheduled_for, (v) => asDate(v, "scheduled_for"));
  if (obj.estimated_minutes !== undefined) {
    update.estimated_minutes = optional(obj.estimated_minutes, (v) => asMinutes(v, "estimated_minutes"));
  }
  if (Object.keys(update).length === 0) {
    throw new ToolInputError(`Give at least one field to change: ${UPDATABLE_FIELDS.join(", ")}.`);
  }
  return { id, update };
}

/**
 * Checks an update against the task it changes. Completed tasks are never
 * touched. A new study day follows checkScheduledFor; moving the due date
 * earlier than an existing study day must move the study day too. An
 * existing study day that's already past is left alone when it isn't changing.
 */
export function checkTaskUpdate(
  existing: { status: string; due_date: string | null; scheduled_for: string | null },
  update: TaskUpdate,
  today: string,
) {
  if (existing.status === "done") {
    throw new ToolInputError("That task is completed, and completed tasks can't be changed.");
  }
  const dueDate = update.due_date !== undefined ? update.due_date : existing.due_date;
  if (update.scheduled_for !== undefined) {
    checkScheduledFor(update.scheduled_for, dueDate, today, "scheduled_for");
  } else if (update.due_date !== undefined && existing.scheduled_for && dueDate && existing.scheduled_for > dueDate) {
    throw new ToolInputError(
      `The task is planned for ${existing.scheduled_for}, after the new due date ${dueDate}. Move scheduled_for too.`,
    );
  }
}

/**
 * Enforces MAX_TASK_CHANGES_PER_REQUEST across the whole request. `touched`
 * holds the ids of tasks and classes already created or updated; updating one
 * of those again is free.
 */
export function checkChangeCap(touched: ReadonlySet<string>, change: { newItems: number } | { taskId: string }) {
  const adding = "newItems" in change ? change.newItems : touched.has(change.taskId) ? 0 : 1;
  if (touched.size + adding > MAX_TASK_CHANGES_PER_REQUEST) {
    const left = MAX_TASK_CHANGES_PER_REQUEST - touched.size;
    throw new ToolInputError(
      `One request can create or update at most ${MAX_TASK_CHANGES_PER_REQUEST} tasks and classes in total, and ` +
        `${left} ${left === 1 ? "is" : "are"} left. Do the most important ones and tell the student what's left for next time.`,
    );
  }
}

// --- create_class -------------------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Palette names the model may use, e.g. "blue", mapped to the stored hex value. */
export const CLASS_COLOR_NAMES = CLASS_COLORS.map((c) => c.name.toLowerCase());

/** A color from the app's class palette, by name ("blue") or its hex value. Returns the hex value. */
export function asClassColor(value: unknown, label: string): string {
  const wanted = typeof value === "string" ? value.trim().toLowerCase() : "";
  const match = CLASS_COLORS.find((c) => c.name.toLowerCase() === wanted || c.value === wanted);
  if (!match) throw new ToolInputError(`${label} must be one of: ${CLASS_COLOR_NAMES.join(", ")}.`);
  return match.value;
}

export type NewClass = {
  name: string;
  instructor: string | null;
  location: string | null;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  grading_mode: GradingMode;
  /** Times are HH:MM. */
  meetings: { day_of_week: number; start_time: string; end_time: string }[];
  weights: { task_type: TaskType; weight: number }[];
};

function parseMeeting(raw: unknown, label: string) {
  const m = asObject(raw, ["day", "start_time", "end_time"], label);
  if (typeof m.day !== "number" || !Number.isInteger(m.day) || m.day < 0 || m.day > 6) {
    throw new ToolInputError(`${label}.day must be a whole number from 0 (Sunday) to 6 (Saturday).`);
  }
  for (const key of ["start_time", "end_time"] as const) {
    if (typeof m[key] !== "string" || !TIME_RE.test(m[key])) {
      throw new ToolInputError(`${label}.${key} must be a 24-hour time like "09:30".`);
    }
  }
  const start = m.start_time as string;
  const end = m.end_time as string;
  // Zero-padded HH:MM strings compare in time order.
  if (end <= start) throw new ToolInputError(`${label}: end_time must be after start_time.`);
  return { day_of_week: m.day, start_time: start, end_time: end };
}

function parseWeights(raw: unknown, label: string) {
  const obj = asObject(raw, [...TASK_TYPES], label);
  return TASK_TYPES.flatMap((type) => {
    const value = obj[type];
    if (value === undefined || value === null) return [];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
      throw new ToolInputError(`${label}.${type} must be a percentage above 0 and at most 100 (leave a type out for no weight).`);
    }
    return [{ task_type: type, weight: value }];
  });
}

const CLASS_FIELDS = [
  "name",
  "instructor",
  "location",
  "color",
  "start_date",
  "end_date",
  "grading_mode",
  "meetings",
  "weights",
];

/** Validates create_class input: 1 to MAX_CLASSES_PER_REQUEST classes. */
export function parseCreateClasses(input: unknown): NewClass[] {
  const obj = asObject(input, ["classes"]);
  if (!Array.isArray(obj.classes) || obj.classes.length === 0) {
    throw new ToolInputError("classes must be a non-empty array.");
  }
  if (obj.classes.length > MAX_CLASSES_PER_REQUEST) {
    throw new ToolInputError(`Create at most ${MAX_CLASSES_PER_REQUEST} classes per request.`);
  }

  return obj.classes.map((raw, i) => {
    const label = `classes[${i}]`;
    const c = asObject(raw, CLASS_FIELDS, label);
    const grading_mode = c.grading_mode === undefined || c.grading_mode === null ? "percent" : c.grading_mode;
    if (!(GRADING_MODES as readonly unknown[]).includes(grading_mode)) {
      throw new ToolInputError(`${label}.grading_mode must be "percent" or "points".`);
    }
    const start_date = optional(c.start_date, (v) => asDate(v, `${label}.start_date`));
    const end_date = optional(c.end_date, (v) => asDate(v, `${label}.end_date`));
    if (start_date && end_date && end_date <= start_date) {
      throw new ToolInputError(`${label}: end_date must be after start_date.`);
    }

    const meetingsRaw = c.meetings ?? [];
    if (!Array.isArray(meetingsRaw)) throw new ToolInputError(`${label}.meetings must be a list.`);
    if (meetingsRaw.length > MAX_MEETINGS_PER_CLASS) {
      throw new ToolInputError(`${label}: a class can have at most ${MAX_MEETINGS_PER_CLASS} meeting times.`);
    }
    const weights = optional(c.weights, (v) => parseWeights(v, `${label}.weights`)) ?? [];
    if (grading_mode === "points" && weights.length > 0) {
      throw new ToolInputError(`${label}: weights only apply when grading_mode is "percent".`);
    }

    return {
      name: asString(c.name, `${label}.name`, 100),
      instructor: optional(c.instructor, (v) => asString(v, `${label}.instructor`, 100)),
      location: optional(c.location, (v) => asString(v, `${label}.location`, 100)),
      color: optional(c.color, (v) => asClassColor(v, `${label}.color`)),
      start_date,
      end_date,
      grading_mode: grading_mode as GradingMode,
      meetings: meetingsRaw.map((m, j) => parseMeeting(m, `${label}.meetings[${j}]`)),
      weights,
    };
  });
}

/** Rounded total of a class's weights, and a warning when there are weights that don't total 100%. */
export function weightWarning(weights: NewClass["weights"]): string | null {
  if (weights.length === 0) return null;
  const total = Math.round(weights.reduce((sum, w) => sum + w.weight, 0) * 100) / 100;
  return total === 100 ? null : `The weights total ${total}%, not 100%. It's saved, but tell the student so they can fix it.`;
}

/** Names match ignoring case and extra spaces: "bio 101" is the same class as " BIO  101". */
export function normalizeClassName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Splits requested classes into ones to create and ones that already exist
 * (by name, case-insensitive). A name repeated within the request is only
 * created once.
 */
export function findDuplicateClasses<T extends { name: string }>(requested: T[], existing: { id: string; name: string }[]) {
  const existingByName = new Map(existing.map((c) => [normalizeClassName(c.name), c]));
  const toCreate: T[] = [];
  const alreadyExist: { requested: string; id: string; name: string }[] = [];
  const seen = new Set<string>();

  for (const c of requested) {
    const key = normalizeClassName(c.name);
    const match = existingByName.get(key);
    if (match) alreadyExist.push({ requested: c.name, id: match.id, name: match.name });
    else if (!seen.has(key)) toCreate.push(c);
    seen.add(key);
  }
  return { toCreate, alreadyExist };
}
