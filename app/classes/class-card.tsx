"use client";

import { useState, useTransition } from "react";
import { ClassAverageDisplay } from "@/components/class-average";
import { formatTerm } from "@/lib/format";
import type { ClassAverage } from "@/lib/grades";
import { formatSchedule } from "@/lib/schedule";
import type { SchoolClass } from "@/lib/types";
import { deleteClass, updateClass } from "./actions";
import { ClassForm } from "./class-form";

function ClassDetails({ schoolClass, average }: { schoolClass: SchoolClass; average: ClassAverage }) {
  const schedule = formatSchedule(schoolClass.class_meetings);
  const term = formatTerm(schoolClass.start_date, schoolClass.end_date);
  const people = [schoolClass.instructor, schoolClass.location].filter(Boolean).join(" · ");

  return (
    <div className="min-w-0 flex-1 py-1.5">
      <h3 className="flex items-center gap-2 break-words font-semibold">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700"
          style={schoolClass.color ? { backgroundColor: schoolClass.color, borderColor: schoolClass.color } : undefined}
        />
        <span className="min-w-0">{schoolClass.name}</span>
      </h3>
      <div className="mt-1">
        <ClassAverageDisplay average={average} mode={schoolClass.grading_mode} />
      </div>
      {schedule.length > 0 ? (
        <ul className="mt-1 text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
          {schedule.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">No meeting times</p>
      )}
      {people && <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">{people}</p>}
      {term && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{term}</p>}
    </div>
  );
}

export function ClassCard({ schoolClass, average }: { schoolClass: SchoolClass; average: ClassAverage }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Delete "${schoolClass.name}"? Its tasks will be kept but no longer linked to a class.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteClass(schoolClass.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-3 font-semibold">Edit {schoolClass.name}</h3>
        <ClassForm
          schoolClass={schoolClass}
          action={(formData) => updateClass(schoolClass.id, formData)}
          submitLabel="Save"
          pendingLabel="Saving…"
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className={`rounded-xl border border-zinc-200 bg-white p-3 transition-opacity dark:border-zinc-800 dark:bg-zinc-950 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <ClassDetails schoolClass={schoolClass} average={average} />
        <div className="-m-1.5 flex shrink-0">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            disabled={pending}
            aria-label={`Edit "${schoolClass.name}"`}
            className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
              <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`Delete "${schoolClass.name}"`}
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
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
