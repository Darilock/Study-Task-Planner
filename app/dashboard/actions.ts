"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRIORITY,
  DESCRIPTION_MAX_LENGTH,
  isPriority,
  type TaskStatus,
} from "@/lib/types";

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
    due_date: dueDate || null,
    estimated_minutes: minutes,
    priority,
  });
  if (error) return { error: "Couldn't save the task. Please try again." };

  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete the task.");
  revalidatePath("/dashboard");
}
