export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  scheduled_for: string | null;
  status: TaskStatus;
  created_at: string;
};
