"use client";

import Link from "next/link";
import { useState } from "react";
import { endOfWeek } from "date-fns";
import { formatDateKey, parseLocalDate, toDateKey } from "@/lib/calendar/dates";
import { displayLetter, RISK_THRESHOLDS, TASK_TYPE_LABELS } from "@/lib/grades";
import { sortTasks, type TaskSort } from "@/lib/sort-tasks";
import type { Task } from "@/lib/types";
import { useStoredValue } from "@/lib/use-stored-value";
import { PriorityBadge } from "../planner/priority-badge";
import { classColor } from "./chips";
import type { CalendarClass, ClassRisk } from "./items";

const SORT_STORAGE_KEY = "week-summary-sort";

function parseSort(raw: string | null): TaskSort {
  try {
    return JSON.parse(raw ?? "null") === "due" ? "due" : "priority";
  } catch {
    return "priority";
  }
}

type Props = {
  /** Incomplete tasks due by the end of this week, overdue ones included. */
  tasks: Task[];
  risks: ClassRisk[];
  classesById: Map<string, CalendarClass>;
  today: string | null;
  onOpenTask: (id: string) => void;
};

/**
 * What needs attention now: overdue tasks, tasks due by Saturday, and classes
 * whose average is slipping. Collapsed by default on phones so the calendar
 * stays near the top.
 */
export function WeekSummary({ tasks, risks, classesById, today, onOpenTask }: Props) {
  const [sort, setSort] = useStoredValue(SORT_STORAGE_KEY, parseSort);
  const [expanded, setExpanded] = useState(false);

  // Until hydration there's no local date, so only the frame renders.
  const weekEnd = today ? toDateKey(endOfWeek(parseLocalDate(today))) : null;
  const overdue = today ? sortTasks(tasks.filter((t) => t.due_date! < today), sort) : [];
  const dueThisWeek =
    today && weekEnd ? sortTasks(tasks.filter((t) => t.due_date! >= today && t.due_date! <= weekEnd), sort) : [];
  const failing = risks.filter((r) => r.level === "failing").length;

  const counts = [
    overdue.length > 0 && `${overdue.length} overdue`,
    `${dueThisWeek.length} due`,
    risks.length > 0 && `${risks.length} at risk`,
  ].filter(Boolean);
  const nothing = today !== null && overdue.length === 0 && dueThisWeek.length === 0 && risks.length === 0;

  return (
    <section
      aria-labelledby="week-summary-heading"
      className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-2 p-1 pl-3">
        <h2 id="week-summary-heading" className="flex min-w-0 items-baseline gap-2 font-semibold">
          This week
          {nothing && <span className="text-xs font-normal text-zinc-500">All clear</span>}
          {today && !nothing && (
            <span
              className={`truncate text-xs font-normal ${
                overdue.length > 0 || failing > 0 ? "text-red-700 dark:text-red-400" : "text-zinc-500"
              }`}
            >
              {counts.join(" · ")}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="week-summary-body"
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {expanded ? "Hide" : "Show"}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div id="week-summary-body" className={`px-1 pb-2 ${expanded ? "" : "max-sm:hidden"}`}>
        {nothing ? (
          <p className="px-2 pb-1 text-sm text-zinc-600 dark:text-zinc-400">
            Nothing due for the rest of the week and every class is on track. Enjoy the breather!
          </p>
        ) : (
          today && (
            <>
              {(overdue.length > 0 || dueThisWeek.length > 0) && (
                <div className="flex items-center justify-between gap-2 px-2 pb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tasks</h3>
                  <div
                    role="group"
                    aria-label="Sort tasks by"
                    className="flex rounded-lg border border-zinc-200 p-0.5 text-xs dark:border-zinc-800"
                  >
                    {(["priority", "due"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSort(s)}
                        aria-pressed={sort === s}
                        className={`min-h-10 rounded-md px-2.5 font-medium ${
                          sort === s
                            ? "bg-foreground text-background"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        }`}
                      >
                        {s === "priority" ? "Priority" : "Due date"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ul>
                {overdue.map((t) => (
                  <SummaryTask key={t.id} task={t} classesById={classesById} overdue onOpen={() => onOpenTask(t.id)} />
                ))}
                {dueThisWeek.map((t) => (
                  <SummaryTask key={t.id} task={t} classesById={classesById} overdue={false} onOpen={() => onOpenTask(t.id)} />
                ))}
              </ul>
              {overdue.length === 0 && dueThisWeek.length === 0 && (
                <p className="px-2 text-sm text-zinc-600 dark:text-zinc-400">Nothing due for the rest of the week.</p>
              )}

              {risks.length > 0 && (
                <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                  <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Courses at risk
                  </h3>
                  <ul>
                    {risks.map((r) => {
                      const c = classesById.get(r.classId);
                      const isFailing = r.level === "failing";
                      return (
                        <li key={r.classId}>
                          <Link
                            href={`/classes#class-${r.classId}`}
                            className={`flex min-h-11 items-center gap-3 rounded-lg px-2 ${
                              isFailing
                                ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: classColor(c) }} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c?.name}</span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {r.percent}% {displayLetter(r.letter)}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 text-xs font-semibold leading-5 ${
                                isFailing ? "bg-red-600 text-white" : "bg-amber-200 text-amber-900"
                              }`}
                            >
                              {isFailing ? "Failing" : "At risk"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="px-2 pt-1 text-xs text-zinc-500">
                    At risk below {RISK_THRESHOLDS.atRisk}%, failing below {RISK_THRESHOLDS.failing}%.
                  </p>
                </div>
              )}
            </>
          )
        )}
      </div>
    </section>
  );
}

function SummaryTask({
  task,
  classesById,
  overdue,
  onOpen,
}: {
  task: Task;
  classesById: Map<string, CalendarClass>;
  overdue: boolean;
  onOpen: () => void;
}) {
  const c = task.class_id ? classesById.get(task.class_id) : undefined;
  const due = formatDateKey(task.due_date!, overdue ? "EEE, MMM d" : "EEEE");

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full min-w-0 items-start gap-3 rounded-lg px-2 py-1.5 text-left ${
          overdue ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
        }`}
      >
        <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: classColor(c) }} />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium">{task.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span className={overdue ? "font-semibold text-red-700 dark:text-red-400" : ""}>
              {overdue ? `Overdue · ${due}` : `Due ${due}`}
            </span>
            {c && <span className="truncate">{c.name}</span>}
            {task.task_type && (
              <span className="rounded border border-zinc-300 px-1.5 text-[11px] font-semibold uppercase leading-[18px] tracking-wide dark:border-zinc-700">
                {TASK_TYPE_LABELS[task.task_type]}
              </span>
            )}
            <PriorityBadge priority={task.priority} />
          </span>
        </span>
      </button>
    </li>
  );
}
