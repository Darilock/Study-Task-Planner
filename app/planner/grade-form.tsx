"use client";

import { useState, useTransition, type FormEvent } from "react";
import { displayLetter, LETTER_GRADES } from "@/lib/grades";
import { MAX_POINTS_LIMIT, type Task } from "@/lib/types";
import { clearGrade, saveGrade } from "./actions";

type Format = "score" | "letter";

export function GradeForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const [format, setFormat] = useState<Format>(task.letter_grade ? "letter" : "score");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const graded = task.graded_at !== null;

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    run(() => saveGrade(task.id, formData));
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{graded ? "Edit grade" : "Enter grade"}</legend>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
          {(["score", "letter"] as const).map((f) => (
            <label
              key={f}
              className="flex min-h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-zinc-700 has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-zinc-500 dark:text-zinc-300"
            >
              <input
                type="radio"
                name="format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="sr-only"
              />
              {f === "score" ? "Score" : "Letter grade"}
            </label>
          ))}
        </div>
      </fieldset>

      {format === "score" ? (
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Score
            <input
              name="score"
              type="number"
              inputMode="decimal"
              required
              min={0}
              step="any"
              defaultValue={task.score ?? ""}
              className="input"
            />
          </label>
          <span className="pb-2.5 text-sm text-zinc-500">out of</span>
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Max points
            <input
              name="max_points"
              type="number"
              inputMode="decimal"
              required
              min={0}
              max={MAX_POINTS_LIMIT}
              step="any"
              defaultValue={task.max_points ?? ""}
              placeholder="100"
              className="input"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Letter grade
          <select name="letter_grade" required defaultValue={task.letter_grade ?? ""} className="input">
            <option value="" disabled>
              Choose…
            </option>
            {LETTER_GRADES.map((l) => (
              <option key={l} value={l}>
                {displayLetter(l)}
              </option>
            ))}
          </select>
        </label>
      )}
      {format === "score" && (
        <p className="-mt-1 text-xs text-zinc-500">A score above max points counts as extra credit.</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {graded && (
          <button
            type="button"
            onClick={() => run(() => clearGrade(task.id))}
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-base font-medium text-red-700 hover:bg-red-50 sm:mr-auto sm:w-auto dark:text-red-400 dark:hover:bg-red-950"
          >
            Clear grade
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-zinc-700 hover:bg-zinc-100 sm:flex-none dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary flex-1 sm:flex-none">
          {pending ? "Saving…" : "Save grade"}
        </button>
      </div>
    </form>
  );
}
