export type TaskStatus = "todo" | "in_progress" | "done";

// Ordered lowest to highest; the index is the sort rank.
export const PRIORITIES = ["low", "medium", "high", "extreme"] as const;
export type TaskPriority = (typeof PRIORITIES)[number];
export const DEFAULT_PRIORITY: TaskPriority = "medium";

export function isPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

export const DESCRIPTION_MAX_LENGTH = 2000;

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

export type SchoolClass = {
  id: string;
  name: string;
  instructor: string | null;
  location: string | null;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  class_meetings: ClassMeeting[];
};
