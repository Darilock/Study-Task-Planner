"use client";

import { useState, useTransition, type FormEvent } from "react";
import { formatDate } from "@/lib/format";
import { TASK_TYPE_LABELS } from "@/lib/grades";
import { DESCRIPTION_MAX_LENGTH, type ClassSummary, type Task } from "@/lib/types";
import { deleteTask, setTaskStatus, updateTaskDetails } from "./actions";
import { GradingFields } from "./grading-fields";
import { PriorityBadge } from "./priority-badge";
import { PrioritySelect } from "./priority-select";

// Descriptions longer than this, or with more lines, start collapsed.
const COLLAPSE_CHARS = 160;
const COLLAPSE_LINES = 3;

function TaskDescription({ text, muted }: { text: string; muted: boolean }) {
  const long = text.length > COLLAPSE_CHARS || text.split("\n").length > COLLAPSE_LINES;
  const [expanded, setExpanded] = useState(false);
  const collapsed = long && !expanded;

  return (
    <div className="mt-1">
      <p
        className={`whitespace-pre-line break-words text-sm ${
          muted ? "text-zinc-500" : "text-zinc-700 dark:text-zinc-300"
        } ${collapsed ? "line-clamp-2" : ""}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="-ml-1 px-1 py-2 text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

type Props = {
  task: Task;
  /** The task's class, if it has one. */
  schoolClass?: ClassSummary;
  /** Every class, for the edit form's class picker. */
  classes: ClassSummary[];
};

export function TaskItem({ task, schoolClass, classes }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const done = task.status === "done";
  const urgent = task.priority === "extreme" && !done;

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function saveDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(async () => {
      await updateTaskDetails(task.id, form);
      setEditing(false);
    });
  }

  return (
    <li
      className={`rounded-xl border border-zinc-200 bg-white p-3 transition-opacity dark:border-zinc-800 dark:bg-zinc-950 ${
        urgent ? "border-l-4 border-l-red-600 dark:border-l-red-500" : ""
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => run(() => setTaskStatus(task.id, done ? "todo" : "done"))}
          disabled={pending}
          aria-pressed={done}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          className="-m-1.5 flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full border-2 ${
              done
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-400 dark:border-zinc-600"
            }`}
          >
            {done && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1 py-1.5">
          <p
            className={`break-words font-medium ${
              done ? "text-zinc-500 line-through dark:text-zinc-500" : ""
            }`}
          >
            {task.title}
          </p>
          {task.description && <TaskDescription text={task.description} muted={done} />}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {schoolClass && (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-zinc-100 px-2 text-xs leading-5 dark:bg-zinc-800">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-zinc-400"
                style={schoolClass.color ? { backgroundColor: schoolClass.color } : undefined}
              />
              <span className="truncate">{schoolClass.name}</span>
            </span>
          )}
          {task.task_type && (
            <span className="rounded border border-zinc-300 px-1.5 text-[11px] font-semibold uppercase leading-[18px] tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {TASK_TYPE_LABELS[task.task_type]}
            </span>
          )}
          <PriorityBadge priority={task.priority} />
            {task.subject && (
              <span className="rounded-full bg-zinc-100 px-2 text-xs leading-5 dark:bg-zinc-800">
                {task.subject}
              </span>
            )}
            {task.status === "in_progress" && (
              <span className="rounded-full bg-amber-100 px-2 text-xs leading-5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                In progress
              </span>
            )}
            {task.scheduled_for && (
              <span className="rounded-full bg-sky-100 px-2 text-xs leading-5 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                Planned {formatDate(task.scheduled_for)}
              </span>
            )}
            {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
            {task.estimated_minutes != null && <span>{task.estimated_minutes} min</span>}
          </div>
          {error && (
            <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="-m-1.5 flex shrink-0">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(!editing);
            }}
            disabled={pending}
            aria-expanded={editing}
            aria-label={`Edit "${task.title}"`}
            className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${task.title}"?`)) run(() => deleteTask(task.id));
            }}
            disabled={pending}
            aria-label={`Delete "${task.title}"`}
            className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.17-2.36.29a.75.75 0 1 0 .22 1.49l.15-.03.84 10.52A2.75 2.75 0 0 0 7.59 19h4.82a2.75 2.75 0 0 0 2.74-2.54l.84-10.52.15.03a.75.75 0 1 0 .22-1.49A41 41 0 0 0 14 4.19v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveDetails} className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Priority
            <PrioritySelect name="priority" defaultValue={task.priority} />
          </label>
          <GradingFields classes={classes} defaults={task} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Description
            <textarea
              name="description"
              rows={3}
              maxLength={DESCRIPTION_MAX_LENGTH}
              defaultValue={task.description ?? ""}
              placeholder="Notes, links, page numbers…"
              className="input py-2"
            />
          </label>
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-zinc-700 hover:bg-zinc-100 sm:flex-none dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary flex-1 sm:flex-none">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
