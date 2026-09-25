import { computeClassAverage, type ClassAverage, type GradedTask, type TaskType } from "./grades";
import type { SchoolClass } from "./types";

/** Columns to select from tasks when computing averages. */
export const GRADED_TASK_COLUMNS = "class_id, task_type, max_points, score, letter_grade";

export type GradedTaskRow = GradedTask & { class_id: string | null };

/** Each class's current average, keyed by class id. */
export function averagesByClass(
  classes: Pick<SchoolClass, "id" | "grading_mode" | "class_weights">[],
  tasks: GradedTaskRow[],
): Map<string, ClassAverage> {
  const result = new Map<string, ClassAverage>();
  for (const c of classes) {
    const weights: Partial<Record<TaskType, number>> = {};
    for (const w of c.class_weights) weights[w.task_type] = w.weight;
    const classTasks = tasks.filter((t) => t.class_id === c.id);
    result.set(c.id, computeClassAverage(classTasks, c.grading_mode, weights));
  }
  return result;
}
