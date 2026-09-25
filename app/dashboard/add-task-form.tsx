"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTask } from "./actions";

export function AddTaskForm() {
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
