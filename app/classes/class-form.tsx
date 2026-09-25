"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { CLASS_COLORS } from "@/lib/class-colors";
import { TASK_TYPE_LABELS, TASK_TYPES, type GradingMode, type TaskType } from "@/lib/grades";
import { DAY_NAMES, MAX_MEETINGS_PER_CLASS, WEEK_ORDER } from "@/lib/schedule";
import type { SchoolClass } from "@/lib/types";
import type { ClassFormResult } from "./actions";

type MeetingRow = { key: string; day: number; start: string; end: string };

function initialRows(schoolClass?: SchoolClass): MeetingRow[] {
  return [...(schoolClass?.class_meetings ?? [])]
    .sort(
      (a, b) =>
        WEEK_ORDER.indexOf(a.day_of_week) - WEEK_ORDER.indexOf(b.day_of_week) ||
        a.start_time.localeCompare(b.start_time),
    )
    .map((m) => ({
      key: m.id,
      day: m.day_of_week,
      start: m.start_time.slice(0, 5),
      end: m.end_time.slice(0, 5),
    }));
}

function initialWeights(schoolClass?: SchoolClass) {
  const weights = Object.fromEntries(TASK_TYPES.map((t) => [t, ""])) as Record<TaskType, string>;
  for (const w of schoolClass?.class_weights ?? []) weights[w.task_type] = String(w.weight);
  return weights;
}

type Props = {
  schoolClass?: SchoolClass;
  action: (formData: FormData) => Promise<ClassFormResult>;
  submitLabel: string;
  pendingLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

export function ClassForm({ schoolClass, action, submitLabel, pendingLabel, onSaved, onCancel }: Props) {
  const [rows, setRows] = useState(() => initialRows(schoolClass));
  const [gradingMode, setGradingMode] = useState<GradingMode>(schoolClass?.grading_mode ?? "percent");
  const [weights, setWeights] = useState(() => initialWeights(schoolClass));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function addRow() {
    setRows((current) => {
      const last = current.at(-1);
      // Most classes repeat the same time on several days, so copy the last
      // row's times onto the next day of the week.
      const day = last ? WEEK_ORDER[(WEEK_ORDER.indexOf(last.day) + 1) % 7] : 1;
      return [...current, { key: crypto.randomUUID(), day, start: last?.start ?? "", end: last?.end ?? "" }];
    });
  }

  function updateRow(key: string, change: Partial<MeetingRow>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!schoolClass) {
        formRef.current?.reset();
        setRows([]);
        setGradingMode("percent");
        setWeights(initialWeights());
      }
      onSaved?.();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={schoolClass?.name}
          placeholder="e.g. BIO 101"
          className="input"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Instructor
          <input
            name="instructor"
            maxLength={100}
            defaultValue={schoolClass?.instructor ?? ""}
            placeholder="Dr. Rivera"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Location
          <input
            name="location"
            maxLength={100}
            defaultValue={schoolClass?.location ?? ""}
            placeholder="Science Hall 204"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Term starts
          <input name="start_date" type="date" defaultValue={schoolClass?.start_date ?? ""} className="input" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Term ends
          <input name="end_date" type="date" defaultValue={schoolClass?.end_date ?? ""} className="input" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-1">
          {[{ name: "No color", value: "" }, ...CLASS_COLORS].map((c) => (
            <label key={c.value || "none"} className="flex size-11 cursor-pointer items-center justify-center">
              <input
                type="radio"
                name="color"
                value={c.value}
                defaultChecked={(schoolClass?.color ?? "") === c.value}
                aria-label={c.name}
                className="peer sr-only"
              />
              <span
                className="size-8 rounded-full border border-zinc-300 ring-offset-2 ring-offset-white peer-checked:ring-2 peer-checked:ring-zinc-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-zinc-500 dark:border-zinc-700 dark:ring-offset-zinc-950 dark:peer-checked:ring-zinc-100"
                style={c.value ? { backgroundColor: c.value, borderColor: c.value } : undefined}
                title={c.name}
              >
                {!c.value && (
                  // Diagonal slash marks "no color".
                  <svg viewBox="0 0 32 32" className="size-full text-zinc-400" aria-hidden>
                    <line x1="8" y1="24" x2="24" y2="8" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Grading</legend>
        <div className="inline-flex self-start rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
          {(["percent", "points"] as const).map((mode) => (
            <label
              key={mode}
              className="flex min-h-10 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-zinc-700 has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-zinc-500 dark:text-zinc-300"
            >
              <input
                type="radio"
                name="grading_mode"
                value={mode}
                checked={gradingMode === mode}
                onChange={() => setGradingMode(mode)}
                className="sr-only"
              />
              {mode === "percent" ? "Percentages" : "Points"}
            </label>
          ))}
        </div>
        {gradingMode === "points" ? (
          <p className="text-sm text-zinc-500">Your average is total points earned out of total points possible.</p>
        ) : (
          <WeightFields weights={weights} onChange={(type, value) => setWeights((w) => ({ ...w, [type]: value }))} />
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Weekly meeting times</legend>
        {rows.length === 0 && <p className="text-sm text-zinc-500">No meeting times yet.</p>}
        {rows.map((row, i) => (
          <div
            key={row.key}
            role="group"
            aria-label={`Meeting ${i + 1}`}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg bg-zinc-50 p-2 sm:grid-cols-[9rem_1fr_1fr_auto] dark:bg-zinc-900/50"
          >
            <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-1 dark:text-zinc-400">
              Day
              <select
                name="meeting_day"
                value={row.day}
                onChange={(e) => updateRow(row.key, { day: Number(e.target.value) })}
                className="input"
              >
                {WEEK_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Starts
              <input
                name="meeting_start"
                type="time"
                required
                value={row.start}
                onChange={(e) => updateRow(row.key, { start: e.target.value })}
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Ends
              <input
                name="meeting_end"
                type="time"
                required
                value={row.end}
                onChange={(e) => updateRow(row.key, { end: e.target.value })}
                className="input"
              />
            </label>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              aria-label={`Remove meeting ${i + 1}`}
              className="col-start-3 row-start-1 flex size-11 items-center justify-center self-end rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 sm:col-start-4 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        ))}
        {rows.length < MAX_MEETINGS_PER_CLASS && (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex min-h-11 items-center justify-center gap-1 self-start rounded-lg border border-dashed border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <span aria-hidden>+</span> Add meeting time
          </button>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2 sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-zinc-700 hover:bg-zinc-100 sm:flex-none dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`btn-primary ${onCancel ? "flex-1 sm:flex-none" : "w-full sm:w-auto"}`}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

function WeightFields({
  weights,
  onChange,
}: {
  weights: Record<TaskType, string>;
  onChange: (type: TaskType, value: string) => void;
}) {
  const entered = TASK_TYPES.map((t) => Number(weights[t])).filter((w) => Number.isFinite(w) && w > 0);
  const total = Math.round(entered.reduce((sum, w) => sum + w, 0) * 100) / 100;

  return (
    <>
      <p className="text-sm text-zinc-500">
        How much each type counts toward your grade. Leave a type blank if the class doesn&apos;t have it.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TASK_TYPES.map((type) => (
          <label key={type} className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {TASK_TYPE_LABELS[type]}
            <span className="relative">
              <input
                name={`weight_${type}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                value={weights[type]}
                onChange={(e) => onChange(type, e.target.value)}
                className="input pr-8"
              />
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
                %
              </span>
            </span>
          </label>
        ))}
      </div>
      {entered.length > 0 && (
        <p
          role="status"
          className={`text-sm ${
            total === 100 ? "text-zinc-600 dark:text-zinc-400" : "font-medium text-amber-800 dark:text-amber-300"
          }`}
        >
          {total === 100
            ? "Weights total 100%."
            : `Weights total ${total}%, not 100%. You can still save; your average uses the weights of the types you have grades for.`}
        </p>
      )}
    </>
  );
}
