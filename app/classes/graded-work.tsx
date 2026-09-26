import { formatDate } from "@/lib/format";
import { formatTaskGrade } from "@/lib/format-grade";
import { TASK_TYPE_LABELS } from "@/lib/grades";
import type { GradedTaskRow } from "@/lib/class-averages";

export type GradedWorkItem = GradedTaskRow & { id: string; title: string; due_date: string | null };

/** A collapsible list of a class's graded tasks and their grades. */
export function GradedWork({ tasks }: { tasks: GradedWorkItem[] }) {
  if (tasks.length === 0) return null;

  return (
    <details className="group mt-2">
      <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden dark:text-zinc-300 dark:hover:bg-zinc-900">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 transition-transform group-open:rotate-90" aria-hidden>
          <path
            fillRule="evenodd"
            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
        Graded work ({tasks.length})
      </summary>
      <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-900">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block break-words">{t.title}</span>
              <span className="text-xs text-zinc-500">
                {t.task_type && TASK_TYPE_LABELS[t.task_type]}
                {t.due_date && ` · Due ${formatDate(t.due_date)}`}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatTaskGrade(t)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
