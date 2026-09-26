"use client";

import type { CSSProperties } from "react";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/grades";
import type { MeetingOccurrence } from "@/lib/calendar/recurrence";
import { formatTimeRange } from "@/lib/schedule";
import type { Task } from "@/lib/types";
import { PRIORITY_LABELS, PriorityBadge } from "../planner/priority-badge";
import type { CalendarClass } from "./items";

const NO_CLASS_COLOR = "#71717a";

const TYPE_SHORT: Record<TaskType, string> = {
  homework: "HW",
  quiz: "Quiz",
  test: "Test",
  project: "Proj",
  exam: "Exam",
  discussion: "Disc",
};

export function classColor(c: CalendarClass | undefined) {
  return c?.color ?? NO_CLASS_COLOR;
}

/** Hex color with an alpha suffix, for tinted backgrounds. */
function tint(color: string, alpha: string) {
  return `${color}${alpha}`;
}

type ChipProps = {
  task: Task;
  kind: "due" | "study";
  schoolClass: CalendarClass | undefined;
  needsGrade: boolean;
  onOpen: () => void;
};

/** "Due: …" or "Study session: …" plus priority, type, status and grade state, for screen readers. */
function describe({ task, kind, schoolClass, needsGrade }: Omit<ChipProps, "onOpen">) {
  return [
    kind === "study" ? "Study session" : "Due",
    task.title,
    schoolClass?.name,
    task.task_type && TASK_TYPE_LABELS[task.task_type],
    `${PRIORITY_LABELS[task.priority]} priority`,
    task.status === "done" && "Done",
    needsGrade && "Needs grade",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Compact one-line chip for month cells and the week's all-day row. Due dates
 * are filled with the class color; study sessions are outlined and dashed.
 * Extreme priority gets a red outline and "!" so it stands out at a glance.
 */
export function TaskChip(props: ChipProps) {
  const { task, kind, schoolClass, needsGrade, onOpen } = props;
  const color = classColor(schoolClass);
  const extreme = task.priority === "extreme";
  const done = task.status === "done";
  const style: CSSProperties =
    kind === "due"
      ? { backgroundColor: tint(color, "24"), borderLeftColor: color }
      : { borderColor: color };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label={describe(props)}
      title={describe(props)}
      style={style}
      className={`flex min-h-6 w-full min-w-0 items-center gap-1 rounded px-1 text-left text-xs leading-5 ${
        kind === "due" ? "border-l-[3px]" : "border border-dashed"
      } ${extreme && !done ? "ring-2 ring-red-600 dark:ring-red-500" : ""} ${done ? "opacity-50" : ""}`}
    >
      {extreme && (
        <span aria-hidden className="shrink-0 rounded-sm bg-red-600 px-1 text-[10px] font-bold text-white">
          !
        </span>
      )}
      {kind === "study" && (
        <span aria-hidden className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">
          Study
        </span>
      )}
      {task.task_type && (
        <span aria-hidden className="shrink-0 text-[10px] font-semibold uppercase text-zinc-600 dark:text-zinc-400">
          {TYPE_SHORT[task.task_type]}
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate ${done ? "line-through" : ""}`}>{task.title}</span>
      {needsGrade && (
        <span aria-hidden className="shrink-0 rounded-sm bg-amber-200 px-1 text-[10px] font-semibold text-amber-900">
          Needs grade
        </span>
      )}
    </button>
  );
}

/** Full-width row for the agenda and the day details sheet. */
export function TaskRow(props: ChipProps) {
  const { task, kind, schoolClass, needsGrade, onOpen } = props;
  const color = classColor(schoolClass);
  const done = task.status === "done";
  const extreme = task.priority === "extreme" && !done;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${describe(props)}. Open to edit.`}
      className={`flex w-full min-w-0 items-start gap-3 rounded-lg p-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
        done ? "opacity-50" : ""
      } ${extreme ? "bg-red-50 ring-1 ring-red-600 dark:bg-red-950/40 dark:ring-red-500" : ""}`}
    >
      <span
        aria-hidden
        className={`mt-1 size-3 shrink-0 ${kind === "due" ? "rounded-full" : "rounded-full border-2 border-dashed bg-transparent"}`}
        style={kind === "due" ? { backgroundColor: color } : { borderColor: color }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          {kind === "due" ? "Due" : "Study session"}
          {schoolClass && ` · ${schoolClass.name}`}
        </span>
        <span className={`block break-words font-medium ${done ? "line-through" : ""}`}>{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5" aria-hidden>
          {task.task_type && (
            <span className="rounded border border-zinc-300 px-1.5 text-[11px] font-semibold uppercase leading-[18px] tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {TASK_TYPE_LABELS[task.task_type]}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          {needsGrade && (
            <span className="rounded-full bg-amber-200 px-2 text-xs font-semibold leading-5 text-amber-900">
              Needs grade
            </span>
          )}
          {done && <span className="text-xs text-zinc-500">Done</span>}
        </span>
      </span>
    </button>
  );
}

export function MeetingRow({ meeting, schoolClass }: { meeting: MeetingOccurrence; schoolClass: CalendarClass | undefined }) {
  const color = classColor(schoolClass);
  return (
    <div className="flex items-start gap-3 p-2">
      <span aria-hidden className="mt-1 h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium tabular-nums">{formatTimeRange(meeting.start_time, meeting.end_time)}</span>
        <span className="block break-words text-zinc-600 dark:text-zinc-400">
          {schoolClass?.name ?? "Class"}
          {schoolClass?.location && ` · ${schoolClass.location}`}
        </span>
      </span>
    </div>
  );
}
