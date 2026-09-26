import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { averagesByClass, GRADED_TASK_COLUMNS, type GradedTaskRow } from "@/lib/class-averages";
import { GRADING_MODES, RISK_THRESHOLDS, riskLevel, TASK_TYPES } from "@/lib/grades";
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
  asObject,
  checkChangeCap,
  checkTaskUpdate,
  CLASS_COLOR_NAMES,
  findDuplicateClasses,
  MAX_CLASSES_PER_REQUEST,
  MAX_TASK_CHANGES_PER_REQUEST,
  parseCreateClasses,
  weightWarning,
  parseCreateTasks,
  parseUpdateTask,
  parseListTasks,
  TASK_STATUS_FILTERS,
  ToolInputError,
  type UpdatableField,
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
      `Create between 1 and ${MAX_TASK_CHANGES_PER_REQUEST} new tasks. Dates are YYYY-MM-DD: due_date is the ` +
      "deadline and scheduled_for is the day the student plans to work on it (today or later, and not after " +
      "due_date). Graded work (a task_type) needs a class_id from list_classes; leave task_type out for ungraded " +
      `study tasks. priority defaults to "${DEFAULT_PRIORITY}". Check list_tasks first so you don't create duplicates.`,
    input_schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TASK_CHANGES_PER_REQUEST,
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short task title, max 200 characters." },
              description: {
                type: ["string", "null"],
                description: `Optional details such as chapters, pages or instructions, max ${DESCRIPTION_MAX_LENGTH} characters.`,
              },
              class_id: { type: ["string", "null"], description: "The task's class, an id from list_classes." },
              task_type: {
                type: ["string", "null"],
                enum: [...TASK_TYPES, null],
                description: "Graded work type. Leave null for ungraded study tasks. Requires class_id.",
              },
              max_points: {
                type: ["number", "null"],
                description: "Points the graded work is out of, if known. Only for graded work.",
              },
              priority: {
                type: "string",
                enum: [...PRIORITIES],
                description: `How important the task is. Defaults to "${DEFAULT_PRIORITY}".`,
              },
              due_date: { type: ["string", "null"], description: "Deadline, YYYY-MM-DD." },
              scheduled_for: {
                type: ["string", "null"],
                description: "Planned work day, YYYY-MM-DD: today or later, and on or before due_date.",
              },
              estimated_minutes: {
                type: ["integer", "null"],
                description: "Estimated effort in minutes, 1 to 10000.",
              },
              subject: { type: ["string", "null"], description: "Free-text subject label, max 100 characters. Prefer class_id." },
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
    name: "create_class",
    description:
      `Create up to ${MAX_CLASSES_PER_REQUEST} new classes. Only for classes the student asked to add or agreed to ` +
      "create; never guess meeting times, ask for them. Classes that already exist (same name, ignoring case) are " +
      "not created again; the result gives their ids to use instead. Existing classes can't be edited or deleted. " +
      "If the result includes a warning, pass it on to the student.",
    input_schema: {
      type: "object",
      properties: {
        classes: {
          type: "array",
          minItems: 1,
          maxItems: MAX_CLASSES_PER_REQUEST,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Class name, e.g. \"BIO 101\". Max 100 characters." },
              instructor: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              color: { type: ["string", "null"], enum: [...CLASS_COLOR_NAMES, null] },
              start_date: { type: ["string", "null"], description: "First day of the term, YYYY-MM-DD." },
              end_date: { type: ["string", "null"], description: "Last day of the term, YYYY-MM-DD, after start_date." },
              grading_mode: {
                type: "string",
                enum: [...GRADING_MODES],
                description: '"percent" (default) weights each task type; "points" totals points earned.',
              },
              meetings: {
                type: "array",
                description: "Weekly meeting times. Leave empty if the student didn't give them.",
                items: {
                  type: "object",
                  properties: {
                    day: { type: "integer", minimum: 0, maximum: 6, description: "0 = Sunday … 6 = Saturday." },
                    start_time: { type: "string", description: "24-hour HH:MM." },
                    end_time: { type: "string", description: "24-hour HH:MM, after start_time." },
                  },
                  required: ["day", "start_time", "end_time"],
                  additionalProperties: false,
                },
              },
              weights: {
                type: ["object", "null"],
                description: "Percent mode only: how much each task type counts, e.g. {\"homework\": 20, \"exam\": 50}.",
                properties: Object.fromEntries(TASK_TYPES.map((t) => [t, { type: "number" }])),
                additionalProperties: false,
              },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["classes"],
      additionalProperties: false,
    },
  },
  {
    name: "update_task",
    description:
      "Change an existing task that isn't completed: its priority, description, due_date, scheduled_for (the planned " +
      "work day) or estimated_minutes. Only include the fields to change; null clears a field. It can't change " +
      "grades, status, type or class, and completed tasks can't be changed. Use an id from list_tasks or create_tasks.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The task id." },
        priority: { type: "string", enum: [...PRIORITIES] },
        description: { type: ["string", "null"], description: `Max ${DESCRIPTION_MAX_LENGTH} characters.` },
        due_date: { type: ["string", "null"], description: "New deadline, YYYY-MM-DD." },
        scheduled_for: {
          type: ["string", "null"],
          description: "New planned work day, YYYY-MM-DD: today or later, and on or before the due date.",
        },
        estimated_minutes: { type: ["integer", "null"], description: "1 to 10000." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

export type ToolResult = { content: string; isError: boolean };

/** Per-request facts the tools need. `today` is the student's local date. */
export type ToolContext = { today: string };

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
  context: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_classes":
        return await listClasses(supabase, input);
      case "list_tasks":
        return await listTasks(supabase, input);
      case "create_tasks":
        return await createTasks(supabase, input, actions, context.today);
      case "create_class":
        return await createClasses(supabase, input, actions);
      case "update_task":
        return await updateTask(supabase, input, actions, context.today);
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
  today: string,
): Promise<ToolResult> {
  const rows = parseCreateTasks(input, today);
  checkChangeCap(new Set(actions.keys()), { newItems: rows.length });

  // Friendlier than a foreign key error: say which class id is wrong.
  const classNames = new Map<string, string>();
  const classIds = [...new Set(rows.map((r) => r.class_id).filter((id): id is string => id !== null))];
  if (classIds.length > 0) {
    const { data: found, error: classError } = await supabase.from("classes").select("id, name").in("id", classIds);
    if (classError) return { content: "Couldn't check the classes.", isError: true };
    const missing = classIds.filter((id) => !found.some((c) => c.id === id));
    if (missing.length > 0) {
      throw new ToolInputError(`Unknown class_id: ${missing.join(", ")}. Use ids from list_classes.`);
    }
    for (const c of found) classNames.set(c.id, c.name);
  }

  // user_id is intentionally omitted: the column defaults to auth.uid().
  const { data, error } = await supabase.from("tasks").insert(rows).select(TASK_COLUMNS);
  if (error) return { content: "Couldn't create the tasks.", isError: true };

  for (const task of data) {
    actions.set(task.id, {
      kind: "created",
      taskId: task.id,
      title: task.title,
      className: task.class_id ? (classNames.get(task.class_id) ?? null) : null,
      dueDate: task.due_date,
      scheduledFor: task.scheduled_for,
    });
  }
  return { content: JSON.stringify({ created: data }), isError: false };
}

async function updateTask(
  supabase: Supabase,
  input: unknown,
  actions: Map<string, AgentAction>,
  today: string,
): Promise<ToolResult> {
  const { id, update } = parseUpdateTask(input);
  checkChangeCap(new Set(actions.keys()), { taskId: id });

  const { data: existing, error: loadError } = await supabase
    .from("tasks")
    .select("id, title, status, class_id, priority, description, due_date, scheduled_for, estimated_minutes")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return { content: "Couldn't load the task.", isError: true };
  if (!existing) return { content: `No task found with id ${id}. Use ids from list_tasks.`, isError: true };
  checkTaskUpdate(existing, update, today);

  // The status filter repeats the completed-task check in the database.
  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", id)
    .neq("status", "done")
    .select(TASK_COLUMNS)
    .maybeSingle();
  if (error) return { content: "Couldn't update the task.", isError: true };
  if (!data) return { content: "That task is completed, and completed tasks can't be changed.", isError: true };

  const className = await classNameOf(supabase, data.class_id);
  const previous = actions.get(id);
  if (previous?.kind === "created") {
    // A task made earlier in this request is still reported as created, with its final dates.
    actions.set(id, { ...previous, title: data.title, dueDate: data.due_date, scheduledFor: data.scheduled_for });
  } else {
    // Record each field's original value, even if it changes twice in one request.
    const changes = new Map((previous?.kind === "updated" ? previous.changes : []).map((c) => [c.field, c]));
    for (const field of Object.keys(update) as UpdatableField[]) {
      const before = changes.get(field)?.from ?? existing[field];
      changes.set(field, { field, from: before, to: data[field] });
    }
    actions.set(id, {
      kind: "updated",
      taskId: id,
      title: data.title,
      className,
      changes: [...changes.values()].filter((c) => c.from !== c.to),
    });
  }
  return { content: JSON.stringify({ updated: data }), isError: false };
}

async function createClasses(
  supabase: Supabase,
  input: unknown,
  actions: Map<string, AgentAction>,
): Promise<ToolResult> {
  const requested = parseCreateClasses(input);

  const { data: existing, error: loadError } = await supabase.from("classes").select("id, name");
  if (loadError) return { content: "Couldn't check the existing classes.", isError: true };
  const { toCreate, alreadyExist } = findDuplicateClasses(requested, existing);

  const createdBefore = [...actions.values()].filter((a) => a.kind === "created_class").length;
  if (createdBefore + toCreate.length > MAX_CLASSES_PER_REQUEST) {
    throw new ToolInputError(
      `One request can create at most ${MAX_CLASSES_PER_REQUEST} classes, and ${MAX_CLASSES_PER_REQUEST - createdBefore} are left.`,
    );
  }
  checkChangeCap(new Set(actions.keys()), { newItems: toCreate.length });

  const created = [];
  for (const { meetings, weights, ...values } of toCreate) {
    // user_id is intentionally omitted: the column defaults to auth.uid().
    const { data: row, error } = await supabase.from("classes").insert(values).select("id").single();
    if (error) return failedClass(values.name, created);

    const meetingsResult = meetings.length
      ? await supabase.from("class_meetings").insert(meetings.map((m) => ({ ...m, class_id: row.id })))
      : { error: null };
    const weightsResult =
      !meetingsResult.error && weights.length
        ? await supabase.from("class_weights").insert(weights.map((w) => ({ ...w, class_id: row.id })))
        : { error: null };
    if (meetingsResult.error || weightsResult.error) {
      // Don't leave a half-created class behind; its meetings and weights cascade.
      await supabase.from("classes").delete().eq("id", row.id);
      return failedClass(values.name, created);
    }

    const schedule = formatSchedule(meetings).join("; ") || null;
    actions.set(row.id, { kind: "created_class", classId: row.id, name: values.name, schedule });
    created.push({
      id: row.id,
      name: values.name,
      schedule,
      grading_mode: values.grading_mode,
      ...(weightWarning(weights) && { warning: weightWarning(weights) }),
    });
  }

  return {
    content: JSON.stringify({
      created,
      already_exist: alreadyExist.map((c) => ({
        ...c,
        note: "A class with this name already exists, so it wasn't created. Tell the student and use this id.",
      })),
    }),
    isError: false,
  };
}

function failedClass(name: string, created: { name: string }[]): ToolResult {
  const done = created.length ? ` These were created: ${created.map((c) => c.name).join(", ")}.` : "";
  return { content: `Couldn't create the class "${name}", so nothing was saved for it.${done}`, isError: true };
}

async function classNameOf(supabase: Supabase, classId: string | null) {
  if (!classId) return null;
  const { data } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
  return data?.name ?? null;
}
