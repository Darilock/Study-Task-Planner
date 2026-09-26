import { PRIORITY_NAMES, type TaskPriority } from "@/lib/types";

export const PRIORITY_LABELS = PRIORITY_NAMES;

// Extreme is solid red with bold text so it stands out from the pastel badges.
const STYLES: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  medium: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
  high: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  extreme: "bg-red-600 font-semibold uppercase tracking-wide text-white dark:bg-red-500",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`rounded-full px-2 text-xs leading-5 ${STYLES[priority]}`}>
      {priority === "extreme" && <span aria-hidden>! </span>}
      {PRIORITY_LABELS[priority]}
      <span className="sr-only"> priority</span>
    </span>
  );
}
