"use client";

import Link from "next/link";
import { useState } from "react";
import { TASK_TYPE_LABELS, TASK_TYPES, type TaskType } from "@/lib/grades";
import { MAX_POINTS_LIMIT, type ClassSummary } from "@/lib/types";

type Props = {
  classes: ClassSummary[];
  defaults?: { task_type: TaskType | null; class_id: string | null; max_points: number | null };
};

/** Type, class and max points. Graded types need a class; study tasks don't have points. */
export function GradingFields({ classes, defaults }: Props) {
  const [type, setType] = useState(defaults?.task_type ?? "");
  const graded = type !== "";

  return (
    <div className="grid grid-flow-row-dense grid-cols-2 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Type
        <select name="task_type" value={type} onChange={(e) => setType(e.target.value)} className="input">
          <option value="">Study (not graded)</option>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {classes.length > 0 ? (
        <label className="col-span-2 flex flex-col gap-1.5 text-sm font-medium sm:col-span-1">
          <span>
            Class{" "}
            <span className="font-normal text-zinc-500">{graded ? "(required)" : "(optional)"}</span>
          </span>
          <select name="class_id" defaultValue={defaults?.class_id ?? ""} required={graded} className="input">
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        graded && (
          <p className="col-span-2 self-end text-sm text-amber-800 sm:col-span-1 dark:text-amber-300">
            Graded work needs a class.{" "}
            <Link href="/classes" className="font-medium underline underline-offset-2">
              Add a class
            </Link>{" "}
            first.
          </p>
        )
      )}

      {graded && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            Max points <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <input
            name="max_points"
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_POINTS_LIMIT}
            step="any"
            defaultValue={defaults?.max_points ?? ""}
            placeholder="100"
            className="input"
          />
        </label>
      )}
    </div>
  );
}
