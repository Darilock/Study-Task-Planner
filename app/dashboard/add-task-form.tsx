"use client";

import { useActionState, useEffect, useRef } from "react";
import { DEFAULT_PRIORITY, DESCRIPTION_MAX_LENGTH, type ClassSummary } from "@/lib/types";
import { addTask } from "./actions";
import { PrioritySelect } from "./priority-select";

export function AddTaskForm({ classes }: { classes: ClassSummary[] }) {
  const [state, formAction, pending] = useActionState(addTask, {});
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      titleRef.current?.focus();
    }
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Task
        <input
          ref={titleRef}
          name="title"
          required
          maxLength={200}
          placeholder="e.g. Review chapter 4 notes"
          className="input"
        />
      </label>

      {classes.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            Class <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <select name="class_id" defaultValue="" className="input">
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>
          Description <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={2}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="Notes, links, page numbers…"
          className="input py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Subject
          <input name="subject" maxLength={100} placeholder="Biology" className="input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Due date
          <input name="due_date" type="date" className="input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Minutes
          <input
            name="estimated_minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            placeholder="45"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Priority
          <PrioritySelect name="priority" defaultValue={DEFAULT_PRIORITY} />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary sm:self-end">
        {pending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
