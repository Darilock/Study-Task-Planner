import type { GradingMode, LetterGrade, TaskType } from "./grades";

export type TaskStatus = "todo" | "in_progress" | "done";

// Ordered lowest to highest; the index is the sort rank.
export const PRIORITIES = ["low", "medium", "high", "extreme"] as const;
export type TaskPriority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: TaskPriority = "medium";

/** Display names for priorities. */
export const PRIORITY_NAMES: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  extreme: "Extreme",
};

export function isPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export const DESCRIPTION_MAX_LENGTH = 2000;
export const MAX_POINTS_LIMIT = 100000;

/** Every column in Task, for select() calls. */
export const TASK_COLUMNS =
  "id, title, description, subject, due_date, estimated_minutes, scheduled_for, priority, class_id, task_type, max_points, score, letter_grade, graded_at, status, created_at";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  scheduled_for: string | null;
  priority: TaskPriority;
  class_id: string | null;
  task_type: TaskType | null;
  max_points: number | null;
  score: number | null;
  letter_grade: LetterGrade | null;
  graded_at: string | null;
  status: TaskStatus;
  created_at: string;
};

// day_of_week follows Postgres: 0 = Sunday … 6 = Saturday. Times are "HH:MM:SS".
export type ClassMeeting = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/** The parts of a class shown on tasks and in the task form. */
export type ClassSummary = Pick<SchoolClass, "id" | "name" | "color">;

export type SchoolClass = {
  id: string;
  name: string;
  instructor: string | null;
  location: string | null;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  grading_mode: GradingMode;
  created_at: string;
  class_meetings: ClassMeeting[];
  class_weights: ClassWeight[];
};

export type ClassWeight = { task_type: TaskType; weight: number };
