import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { createClient } from "@/lib/supabase/server";
import { DEFAULT_PRIORITY, DESCRIPTION_MAX_LENGTH, isPriority, PRIORITIES, type TaskPriority } from "@/lib/types";
import type { AgentAction } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_TASKS_PER_CALL = 20;
const TASK_COLUMNS = "id, title, description, subject, due_date, estimated_minutes, scheduled_for, priority, status";

export const tools: Anthropic.Tool[] = [
  {
    name: "list_tasks",
    description:
      "List the student's tasks with their id, title, description, subject, due_date, estimated_minutes, scheduled_for, priority, and status. " +
      "Call this before scheduling so you know which tasks exist and what is already planned. " +
      "Completed tasks are excluded unless include_done is true.",
    input_schema: {
      type: "object",
      properties: {
        include_done: {
          type: "boolean",
          description: "Also return tasks marked done. Defaults to false.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_tasks",
    description:
      `Create between 1 and ${MAX_TASKS_PER_CALL} new tasks for the student. ` +
      "Dates are YYYY-MM-DD. due_date is the deadline; scheduled_for is the day the student plans to work on it. " +
      `priority defaults to "${DEFAULT_PRIORITY}"; reserve "extreme" for urgent, high-stakes work. ` +
      "Check list_tasks first so you don't create duplicates.",
    input_schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TASKS_PER_CALL,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short task title, max 200 characters." },
              description: {
                type: ["string", "null"],
                description: `Optional details such as chapters, pages or instructions, max ${DESCRIPTION_MAX_LENGTH} characters.`,
              },
              subject: { type: ["string", "null"], description: "Course or subject, max 100 characters." },
              due_date: { type: ["string", "null"], description: "Deadline, YYYY-MM-DD." },
              estimated_minutes: {
                type: ["integer", "null"],
                description: "Estimated effort in minutes, 1 to 10000.",
              },
              scheduled_for: { type: ["string", "null"], description: "Planned work day, YYYY-MM-DD." },
              priority: {
                type: "string",
                enum: [...PRIORITIES],
                description: `How important the task is. Defaults to "${DEFAULT_PRIORITY}".`,
              },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_task",
    description:
      "Set the day an existing task is planned to be worked on. Use an id returned by list_tasks or create_tasks. " +
      "Pass scheduled_for as null to unschedule.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The task id (UUID)." },
        scheduled_for: { type: ["string", "null"], description: "Planned work day, YYYY-MM-DD." },
      },
      required: ["id", "scheduled_for"],
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}

export type ToolResult = { content: string; isError: boolean };

/**
 * Validates and runs one tool call. Every query goes through the caller's
 * session-scoped Supabase client, so RLS limits it to the user's own rows.
 * Actions are recorded into `actions` (keyed by task id) for the UI.
 */
export async function runTool(
  supabase: Supabase,
  name: string,
  input: unknown,
  actions: Map<string, AgentAction>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_tasks":
        return await listTasks(supabase, input);
      case "create_tasks":
        return await createTasks(supabase, input, actions);
      case "schedule_task":
        return await scheduleTask(supabase, input, actions);
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (e) {
    if (e instanceof ToolInputError) return { content: e.message, isError: true };
    throw e;
  }
}

async function listTasks(supabase: Supabase, input: unknown): Promise<ToolResult> {
  const obj = asObject(input, ["include_done"]);
  const includeDone = obj.include_done === undefined ? false : asBoolean(obj.include_done, "include_done");

  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(200);
  if (!includeDone) query = query.neq("status", "done");

  const { data, error } = await query;
  if (error) return { content: "Couldn't load tasks.", isError: true };
  return { content: JSON.stringify(data), isError: false };
}

async function createTasks(
  supabase: Supabase,
  input: unknown,
  actions: Map<string, AgentAction>,
): Promise<ToolResult> {
  const obj = asObject(input, ["tasks"]);
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new ToolInputError("tasks must be a non-empty array.");
  }
  if (obj.tasks.length > MAX_TASKS_PER_CALL) {
    throw new ToolInputError(`Create at most ${MAX_TASKS_PER_CALL} tasks per call.`);
  }

  const rows = obj.tasks.map((raw, i) => {
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

  // user_id is intentionally omitted: the column defaults to auth.uid().
  const { data, error } = await supabase.from("tasks").insert(rows).select(TASK_COLUMNS);
  if (error) return { content: "Couldn't create the tasks.", isError: true };

  for (const task of data) {
    actions.set(task.id, {
      kind: "created",
      taskId: task.id,
      title: task.title,
      scheduledFor: task.scheduled_for,
    });
  }
  return { content: JSON.stringify({ created: data }), isError: false };
}

async function scheduleTask(
  supabase: Supabase,
  input: unknown,
  actions: Map<string, AgentAction>,
): Promise<ToolResult> {
  const obj = asObject(input, ["id", "scheduled_for"]);
  const id = asUuid(obj.id, "id");
  if (obj.scheduled_for === undefined) throw new ToolInputError("scheduled_for is required (use null to unschedule).");
  const scheduledFor = optional(obj.scheduled_for, (v) => asDate(v, "scheduled_for"));

  const { data, error } = await supabase
    .from("tasks")
    .update({ scheduled_for: scheduledFor })
    .eq("id", id)
    .select(TASK_COLUMNS)
    .maybeSingle();
  if (error) return { content: "Couldn't schedule the task.", isError: true };
  if (!data) return { content: `No task found with id ${id}.`, isError: true };

  // A task created earlier in this run stays "created", just with the new date.
  const existing = actions.get(data.id);
  actions.set(data.id, {
    kind: existing?.kind ?? "scheduled",
    taskId: data.id,
    title: data.title,
    scheduledFor: data.scheduled_for,
  });
  return { content: JSON.stringify({ updated: data }), isError: false };
}

// --- input validation -------------------------------------------------------

function asObject(value: unknown, allowed: string[], label = "input"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolInputError(`${label} must be an object.`);
  }
  const unknownKeys = Object.keys(value).filter((k) => !allowed.includes(k));
  if (unknownKeys.length > 0) {
    throw new ToolInputError(`${label} has unexpected fields: ${unknownKeys.join(", ")}.`);
  }
  return value as Record<string, unknown>;
}

function optional<T>(value: unknown, parse: (v: unknown) => T): T | null {
  return value === undefined || value === null ? null : parse(value);
}

function asString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new ToolInputError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ToolInputError(`${label} must not be empty.`);
  if (trimmed.length > maxLength) {
    throw new ToolInputError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ToolInputError(`${label} must be true or false.`);
  return value;
}

function asPriority(value: unknown, label: string): TaskPriority {
  if (!isPriority(value)) throw new ToolInputError(`${label} must be one of: ${PRIORITIES.join(", ")}.`);
  return value;
}

function asMinutes(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > 10000) {
    throw new ToolInputError(`${label} must be a whole number between 1 and 10000.`);
  }
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new ToolInputError(`${label} must be a task id from list_tasks.`);
  }
  return value;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Round-trip rejects impossible dates like 2026-02-30.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function asDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !isValidDate(value)) {
    throw new ToolInputError(`${label} must be a real date in YYYY-MM-DD format.`);
  }
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) throw new ToolInputError(`${label} is out of range.`);
  return value;
}
