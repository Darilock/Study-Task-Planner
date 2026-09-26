"use server";

import { revalidatePath } from "next/cache";
import { HEX_COLOR_RE } from "@/lib/class-colors";
import { isValidDate } from "@/lib/dates";
import { TASK_TYPES, type GradingMode, type TaskType } from "@/lib/grades";
import { MAX_MEETINGS_PER_CLASS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

export type ClassFormResult = { error?: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Meeting = { day_of_week: number; start_time: string; end_time: string };
type Weight = { task_type: TaskType; weight: number };

function optionalText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

/** Reads and validates the class form, including its repeated meeting fields. */
function parseClassForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const instructor = optionalText(formData, "instructor");
  const location = optionalText(formData, "location");
  const color = optionalText(formData, "color");
  const startDate = optionalText(formData, "start_date");
  const endDate = optionalText(formData, "end_date");
  const gradingMode: GradingMode = formData.get("grading_mode") === "points" ? "points" : "percent";

  if (!name) return { error: "Give the class a name." };
  if (name.length > 100) return { error: "Name must be 100 characters or fewer." };
  if (instructor && instructor.length > 100) return { error: "Instructor must be 100 characters or fewer." };
  if (location && location.length > 100) return { error: "Location must be 100 characters or fewer." };
  if (color && !HEX_COLOR_RE.test(color)) return { error: "Pick a valid color." };
  if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) {
    return { error: "Term dates are invalid." };
  }
  if (startDate && endDate && endDate < startDate) {
    return { error: "The term can't end before it starts." };
  }

  const days = formData.getAll("meeting_day").map(String);
  const starts = formData.getAll("meeting_start").map(String);
  const ends = formData.getAll("meeting_end").map(String);
  if (starts.length !== days.length || ends.length !== days.length) {
    return { error: "Meeting times are invalid." };
  }
  if (days.length > MAX_MEETINGS_PER_CLASS) {
    return { error: `A class can have at most ${MAX_MEETINGS_PER_CLASS} meeting times.` };
  }

  const meetings: Meeting[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = Number(days[i]);
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: "Pick a day for each meeting." };
    if (!TIME_RE.test(starts[i]) || !TIME_RE.test(ends[i])) {
      return { error: "Enter a start and end time for each meeting." };
    }
    // Zero-padded HH:MM strings compare in time order.
    if (ends[i] <= starts[i]) return { error: "Each meeting must end after it starts." };
    meetings.push({ day_of_week: day, start_time: starts[i], end_time: ends[i] });
  }

  // Weights only apply in percentage mode, and are only sent then. Blank means no weight.
  const weights: Weight[] = [];
  if (gradingMode === "percent") {
    for (const type of TASK_TYPES) {
      const raw = String(formData.get(`weight_${type}`) ?? "").trim();
      if (!raw) continue;
      const weight = Number(raw);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
        return { error: "Each weight must be more than 0% and at most 100%." };
      }
      weights.push({ task_type: type, weight });
    }
  }

  return {
    values: { name, instructor, location, color, start_date: startDate, end_date: endDate, grading_mode: gradingMode },
    meetings,
    weights,
  };
}

function revalidate() {
  revalidatePath("/classes");
  revalidatePath("/grades");
  // Tasks show their class's name and color.
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

// Server actions are public endpoints; RLS limits these to the caller's rows.
export async function createClass(formData: FormData): Promise<ClassFormResult> {
  const parsed = parseClassForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  // user_id is intentionally omitted: the column defaults to auth.uid().
  const { data, error } = await supabase.from("classes").insert(parsed.values).select("id").single();
  if (error) return { error: "Couldn't save the class. Please try again." };

  if (parsed.meetings.length > 0) {
    const { error: meetingsError } = await supabase
      .from("class_meetings")
      .insert(parsed.meetings.map((m) => ({ ...m, class_id: data.id })));
    if (meetingsError) {
      // Don't leave a half-saved class behind.
      await supabase.from("classes").delete().eq("id", data.id);
      return { error: "Couldn't save the meeting times. Please try again." };
    }
  }

  if (parsed.weights.length > 0) {
    const { error: weightsError } = await supabase
      .from("class_weights")
      .insert(parsed.weights.map((w) => ({ ...w, class_id: data.id })));
    if (weightsError) {
      await supabase.from("classes").delete().eq("id", data.id);
      return { error: "Couldn't save the weights. Please try again." };
    }
  }

  revalidate();
  return {};
}

export async function updateClass(id: string, formData: FormData): Promise<ClassFormResult> {
  const parsed = parseClassForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").update(parsed.values).eq("id", id).select("id").maybeSingle();
  if (error) return { error: "Couldn't save the class. Please try again." };
  if (!data) return { error: "This class no longer exists. Refresh the page." };

  // Replace the meeting times: insert the new set first, then remove the old
  // rows, so a failure never leaves the class with no meetings at all.
  const { data: old, error: oldError } = await supabase.from("class_meetings").select("id").eq("class_id", id);
  if (oldError) return { error: "Couldn't update the meeting times. Please try again." };

  if (parsed.meetings.length > 0) {
    const { error: insertError } = await supabase
      .from("class_meetings")
      .insert(parsed.meetings.map((m) => ({ ...m, class_id: id })));
    if (insertError) return { error: "Couldn't update the meeting times. Please try again." };
  }
  if (old.length > 0) {
    const { error: deleteError } = await supabase
      .from("class_meetings")
      .delete()
      .in("id", old.map((m) => m.id));
    if (deleteError) {
      revalidate();
      return { error: "Saved, but some old meeting times couldn't be removed. Edit the class to fix them." };
    }
  }

  // In points mode the weights aren't shown, so keep them for if the class switches back.
  if (parsed.values.grading_mode === "percent") {
    if (parsed.weights.length > 0) {
      const { error: upsertError } = await supabase
        .from("class_weights")
        .upsert(
          parsed.weights.map((w) => ({ ...w, class_id: id })),
          { onConflict: "class_id,task_type" },
        );
      if (upsertError) {
        revalidate();
        return { error: "Saved, but the weights couldn't be updated. Please try again." };
      }
    }
    const cleared = TASK_TYPES.filter((t) => !parsed.weights.some((w) => w.task_type === t));
    if (cleared.length > 0) {
      const { error: clearError } = await supabase
        .from("class_weights")
        .delete()
        .eq("class_id", id)
        .in("task_type", cleared);
      if (clearError) {
        revalidate();
        return { error: "Saved, but some weights couldn't be removed. Please try again." };
      }
    }
  }

  revalidate();
  return {};
}

// Meetings are deleted by the foreign key cascade; tasks keep existing with no class.
export async function deleteClass(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete the class.");
  revalidate();
}
