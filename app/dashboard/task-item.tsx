"use client";

import { useState, useTransition } from "react";
import type { Task } from "@/lib/types";
import { deleteTask, setTaskStatus } from "./actions";

function formatDueDate(date: string) {
  // due_date is a plain date; format in UTC so it never shifts a day.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function TaskItem({ task }: { task: Task }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = task.status === "done";

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

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-opacity dark:border-zinc-800 dark:bg-zinc-950 ${
        pending ? "opacity-60" : ""
      }`}
    >
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
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
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
          {task.due_date && <span>Due {formatDueDate(task.due_date)}</span>}
          {task.estimated_minutes != null && <span>{task.estimated_minutes} min</span>}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete "${task.title}"?`)) run(() => deleteTask(task.id));
        }}
        disabled={pending}
        aria-label={`Delete "${task.title}"`}
        className="-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.58.17-2.36.29a.75.75 0 1 0 .22 1.49l.15-.03.84 10.52A2.75 2.75 0 0 0 7.59 19h4.82a2.75 2.75 0 0 0 2.74-2.54l.84-10.52.15.03a.75.75 0 1 0 .22-1.49A41 41 0 0 0 14 4.19v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </li>
  );
}
