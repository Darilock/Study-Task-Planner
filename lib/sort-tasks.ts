import { PRIORITIES, type Task } from "./types";

export const SORT_OPTIONS = ["due", "priority"] as const;
export type TaskSort = (typeof SORT_OPTIONS)[number];

export function parseSort(value: unknown): TaskSort {
  return value === "priority" ? "priority" : "due";
}

// Tasks without a due date go last. Dates are YYYY-MM-DD, so string order is date order.
function byDueDate(a: Task, b: Task) {
  if (a.due_date === b.due_date) return 0;
  if (a.due_date === null) return 1;
  if (b.due_date === null) return -1;
  return a.due_date < b.due_date ? -1 : 1;
}

function byPriority(a: Task, b: Task) {
  return PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
}

function byCreated(a: Task, b: Task) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/** Sorts by the chosen key, breaking ties with the other key, then creation time. */
export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const [first, second] = sort === "priority" ? [byPriority, byDueDate] : [byDueDate, byPriority];
  return [...tasks].sort((a, b) => first(a, b) || second(a, b) || byCreated(a, b));
}
