"use server";

import { revalidatePath } from "next/cache";
import { isLetterGrade, isTaskType } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRIORITY,
  DESCRIPTION_MAX_LENGTH,
  isPriority,
  MAX_POINTS_LIMIT,
  type TaskStatus,
} from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Type, class and max points, shared by the add and edit forms. */
function parseGradingFields(formData: FormData) {
  const taskType = String(formData.get("task_type") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  const maxRaw = String(formData.get("max_points") ?? "").trim();

  if (taskType && !isTaskType(taskType)) return { error: "Pick a valid type." };
  if (classId && !UUID_RE.test(classId)) return { error: "Pick a valid class." };
  if (taskType && !classId) return { error: "Graded work needs a class." };
  const maxPoints = taskType && maxRaw ? Number(maxRaw) : null;
  if (maxPoints !== null && (!Number.isFinite(maxPoints) || maxPoints <= 0 || maxPoints > MAX_POINTS_LIMIT)) {
    return { error: `Max points must be more than 0 and at most ${MAX_POINTS_LIMIT}.` };
  }

  return {
    values: {
      task_type: isTaskType(taskType) ? taskType : null,
      // The (class_id, user_id) foreign key rejects another user's class.
      class_id: classId || null,
      max_points: maxPoints,
    },
  };
}

export type AddTaskState = { error?: string; ok?: number };

export async function addTask(
  prev: AddTaskState,
  formData: FormData,
): Promise<AddTaskState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? DEFAULT_PRIORITY);
  const subject = String(formData.get("subject") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "");
  const minutesRaw = String(formData.get("estimated_minutes") ?? "").trim();

  if (!title) return { error: "Give the task a title." };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer." };
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return { error: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.` };
  }
  if (!isPriority(priority)) return { error: "Pick a valid priority." };
  const grading = parseGradingFields(formData);
  if ("error" in grading) return { error: grading.error };
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: "Due date is invalid." };
  }
  const minutes = minutesRaw ? Number(minutesRaw) : null;
  if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > 10000)) {
    return { error: "Estimated minutes must be a whole number between 1 and 10000." };
  }

  const supabase = await createClient();
  // user_id is intentionally omitted: the column defaults to auth.uid().
  const { error } = await supabase.from("tasks").insert({
    title,
    description: description || null,
    subject: subject || null,
    ...grading.values,
    due_date: dueDate || null,
    estimated_minutes: minutes,
    priority,
  });
  if (error) return { error: "Couldn't save the task. Please try again." };

  revalidatePath("/planner");

  revalidatePath("/calendar");
  // Changing counter lets the form know to reset itself.
  return { ok: (prev.ok ?? 0) + 1 };
}

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

// Server actions are public endpoints; RLS limits these to the caller's rows.
export async function setTaskStatus(id: string, status: TaskStatus) {
  if (!STATUSES.includes(status)) throw new Error("Invalid status.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) throw new Error("Couldn't update the task.");
  revalidatePath("/planner");
  revalidatePath("/calendar");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete the task.");
  revalidatePath("/planner");
  revalidatePath("/calendar");
}

export async function updateTaskDetails(id: string, formData: FormData) {
  const priority = formData.get("priority");
  if (!isPriority(priority)) throw new Error("Pick a valid priority.");
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`);
  }
  const grading = parseGradingFields(formData);
  if ("error" in grading) throw new Error(grading.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ priority, description: description || null, ...grading.values })
    .eq("id", id);
  // 23514 is a check violation: here, removing max points from a task with a score.
  if (error?.code === "23514") throw new Error("A score needs max points. Clear the grade first.");
  if (error) throw new Error("Couldn't update the task.");
  revalidatePath("/planner");
  revalidatePath("/calendar");
}

const SCORE_LIMIT = 1_000_000;

function revalidateGrades() {
  revalidatePath("/planner");
  revalidatePath("/calendar");
  revalidatePath("/classes");
  revalidatePath("/grades");
}

/**
 * Saves a score (out of max points) or a letter grade, and marks the task done.
 * Only graded types can have a grade, and only once the due date has passed.
 */
export async function saveGrade(id: string, formData: FormData) {
  const format = formData.get("format");
  const supabase = await createClient();
  const { data: task, error: loadError } = await supabase
    .from("tasks")
    .select("task_type, due_date")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error("Couldn't save the grade.");
  if (!task) throw new Error("This task no longer exists. Refresh the page.");
  if (!task.task_type) throw new Error("Only graded work can have a grade. Set the task's type first.");
  // The browser uses the student's local date. The server only knows UTC, so
  // compare with the UTC date, which is never behind a due date that has passed locally.
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (task.due_date && task.due_date > todayUtc) throw new Error("You can enter a grade after the due date.");

  let grade: { score: number | null; letter_grade: string | null; max_points?: number };
  if (format === "letter") {
    const letter = formData.get("letter_grade");
    if (!isLetterGrade(letter)) throw new Error("Pick a letter grade.");
    grade = { score: null, letter_grade: letter };
  } else if (format === "score") {
    const scoreRaw = String(formData.get("score") ?? "").trim();
    const maxRaw = String(formData.get("max_points") ?? "").trim();
    const score = Number(scoreRaw);
    const maxPoints = Number(maxRaw);
    if (!scoreRaw || !Number.isFinite(score) || score < 0 || score > SCORE_LIMIT) {
      throw new Error("Enter a score of 0 or more.");
    }
    if (!maxRaw || !Number.isFinite(maxPoints) || maxPoints <= 0 || maxPoints > MAX_POINTS_LIMIT) {
      throw new Error(`Max points must be more than 0 and at most ${MAX_POINTS_LIMIT}.`);
    }
    grade = { score, letter_grade: null, max_points: maxPoints };
  } else {
    throw new Error("Choose a score or a letter grade.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ ...grade, graded_at: new Date().toISOString(), status: "done" })
    .eq("id", id);
  if (error) throw new Error("Couldn't save the grade.");
  revalidateGrades();
}

export async function clearGrade(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ score: null, letter_grade: null, graded_at: null })
    .eq("id", id);
  if (error) throw new Error("Couldn't clear the grade.");
  revalidateGrades();
}
