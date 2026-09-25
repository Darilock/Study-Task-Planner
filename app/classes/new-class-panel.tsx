"use client";

import { useState } from "react";
import { createClass } from "./actions";
import { ClassForm } from "./class-form";

// Collapsed once the student has classes, so the list stays near the top on phones.
export function NewClassPanel({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full sm:w-auto sm:self-start">
        Add a class
      </button>
    );
  }

  return (
    <section
      aria-labelledby="new-class-heading"
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 id="new-class-heading" className="mb-3 font-semibold">
        Add a class
      </h2>
      <ClassForm
        action={createClass}
        submitLabel="Add class"
        pendingLabel="Adding…"
        onSaved={() => setOpen(false)}
        onCancel={startOpen ? undefined : () => setOpen(false)}
      />
    </section>
  );
}
