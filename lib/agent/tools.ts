import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { averagesByClass, GRADED_TASK_COLUMNS, type GradedTaskRow } from "@/lib/class-averages";
import { RISK_THRESHOLDS, riskLevel } from "@/lib/grades";
import { DAY_NAMES, formatSchedule } from "@/lib/schedule";
import type { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRIORITY,
  DESCRIPTION_MAX_LENGTH,
  PRIORITIES,
  type ClassMeeting,
  type SchoolClass,
} from "@/lib/types";
import type { AgentAction } from "./types";
import {
  asDate,
  asObject,
  asUuid,
  MAX_TASKS_PER_CALL,
  optional,
  parseCreateTasks,
  parseListTasks,
  TASK_STATUS_FILTERS,
  ToolInputError,
} from "./validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TASK_COLUMNS =
  "id, title, description, subject, due_date, estimated_minutes, scheduled_for, priority, status, class_id, task_type, graded_at";

export const tools: Anthropic.Tool[] = [
  {
    name: "list_classes",
    description:
      "List the student's classes: id, name, instructor, location, term dates, weekly meeting times, minutes of class " +
      "per weekday, grading mode and weights, current average and letter, and status (failing, at_risk, on_track, or " +
      "no_average). Call this to match what the student says to a real class and to see which classes need attention.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_tasks",
    description:
      "List the student's tasks. Each has id, title, description, task_type (null means an ungraded study task), " +
      "is_graded_type, has_grade, priority, class_id, class_name, due_date, scheduled_for (the day planned to work on " +
      "it), estimated_minutes and status. By default returns every task that isn't done. Call this before creating or " +
      "moving tasks so you don't make duplicates and can plan around what's already scheduled.",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: ["string", "null"],
          description: "Only tasks due or scheduled on or after this date, YYYY-MM-DD.",
        },
        to: {
          type: ["string", "null"],
          description: "Only tasks due or scheduled on or before this date, YYYY-MM-DD.",
        },
        class_id: {
          type: ["string", "null"],
          description: 'Only tasks in this class (an id from list_classes), or "none" for tasks without a class.',
        },
        status: {
          type: "string",
          enum: [...TASK_STATUS_FILTERS],
          description: '"open" (default) is everything not done; "all" includes done tasks.',
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
      case "list_classes":
        return await listClasses(supabase, input);
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

async function listClasses(supabase: Supabase, input: unknown): Promise<ToolResult> {
  asObject(input ?? {}, []);

  const [{ data: classData, error }, { data: gradedData, error: gradedError }] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, name, instructor, location, start_date, end_date, grading_mode, class_meetings(day_of_week, start_time, end_time), class_weights(task_type, weight)",
      )
      .order("name", { ascending: true }),
    supabase.from("tasks").select(GRADED_TASK_COLUMNS).not("class_id", "is", null).not("graded_at", "is", null),
  ]);
  if (error || gradedError) return { content: "Couldn't load classes.", isError: true };

  const classes = (classData ?? []) as unknown as (Pick<
    SchoolClass,
    "id" | "name" | "instructor" | "location" | "start_date" | "end_date" | "grading_mode" | "class_weights"
  > & { class_meetings: Omit<ClassMeeting, "id">[] })[];
  const averages = averagesByClass(classes, (gradedData ?? []) as GradedTaskRow[]);

  const result = classes.map((c) => {
    const average = averages.get(c.id)!;
    const risk = riskLevel(average);
    const minutesByDay: Record<string, number> = {};
    for (const m of c.class_meetings) {
      const day = DAY_NAMES[m.day_of_week];
      minutesByDay[day] = (minutesByDay[day] ?? 0) + minutesBetween(m.start_time, m.end_time);
    }
    return {
      id: c.id,
      name: c.name,
      instructor: c.instructor,
      location: c.location,
      term_start: c.start_date,
      term_end: c.end_date,
      schedule: formatSchedule(c.class_meetings).join("; ") || null,
      class_minutes_by_day: minutesByDay,
      grading_mode: c.grading_mode,
      weights: c.grading_mode === "percent" ? Object.fromEntries(c.class_weights.map((w) => [w.task_type, w.weight])) : null,
      average_percent: average.percent,
      letter: average.letter,
      graded_count: average.gradedCount,
      status: risk === "failing" ? "failing" : risk === "at-risk" ? "at_risk" : average.percent === null ? "no_average" : "on_track",
    };
  });
  return {
    content: JSON.stringify({
      classes: result,
      thresholds: { at_risk_below: RISK_THRESHOLDS.atRisk, failing_below: RISK_THRESHOLDS.failing },
    }),
    isError: false,
  };
}

function minutesBetween(start: string, end: string) {
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMinutes(end) - toMinutes(start);
}

async function listTasks(supabase: Supabase, input: unknown): Promise<ToolResult> {
  const filter = parseListTasks(input);
  const limit = 200;

  let query = supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  // Dates are validated YYYY-MM-DD strings, so they're safe inside these filters.
  const { from, to } = filter;
  if (from && to) {
    query = query.or(
      `and(due_date.gte.${from},due_date.lte.${to}),and(scheduled_for.gte.${from},scheduled_for.lte.${to})`,
    );
  } else if (from) {
    query = query.or(`due_date.gte.${from},scheduled_for.gte.${from}`);
  } else if (to) {
    query = query.or(`due_date.lte.${to},scheduled_for.lte.${to}`);
  }
  if (filter.classId === "none") query = query.is("class_id", null);
  else if (filter.classId) query = query.eq("class_id", filter.classId);
  if (filter.status === "open") query = query.neq("status", "done");
  else if (filter.status !== "all") query = query.eq("status", filter.status);

  const [{ data, error }, { data: classes, error: classError }] = await Promise.all([
    query,
    supabase.from("classes").select("id, name"),
  ]);
  if (error || classError) return { content: "Couldn't load tasks.", isError: true };

  const classNames = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const tasks = data.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    task_type: t.task_type,
    is_graded_type: t.task_type !== null,
    has_grade: t.graded_at !== null,
    priority: t.priority,
    class_id: t.class_id,
    class_name: t.class_id ? (classNames.get(t.class_id) ?? null) : null,
    due_date: t.due_date,
    scheduled_for: t.scheduled_for,
    estimated_minutes: t.estimated_minutes,
    status: t.status,
  }));
  return {
    content: JSON.stringify({ tasks, ...(tasks.length === limit && { note: `Only the first ${limit} are shown; narrow the filters.` }) }),
    isError: false,
  };
}

async function createTasks(
  supabase: Supabase,
  input: unknown,
  actions: Map<string, AgentAction>,
): Promise<ToolResult> {
  const rows = parseCreateTasks(input);

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
  const id = asUuid(obj.id, "id", "list_tasks");
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
