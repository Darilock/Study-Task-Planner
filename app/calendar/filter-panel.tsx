"use client";

import { classColor } from "./chips";
import { NO_CLASS, type CalendarClass, type CalendarFilter } from "./items";

type Props = {
  classes: CalendarClass[];
  filter: CalendarFilter;
  onChange: (filter: CalendarFilter) => void;
};

export function FilterPanel({ classes, filter, onChange }: Props) {
  const toggleClass = (id: string, shown: boolean) =>
    onChange({
      ...filter,
      hiddenClasses: shown ? filter.hiddenClasses.filter((c) => c !== id) : [...filter.hiddenClasses, id],
    });

  const row = "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-zinc-100 dark:hover:bg-zinc-900";
  const checkbox = "size-5 shrink-0 accent-zinc-900 dark:accent-zinc-100";

  return (
    <div className="flex flex-col gap-4">
      <label className={row}>
        <input
          type="checkbox"
          checked={filter.showCompleted}
          onChange={(e) => onChange({ ...filter, showCompleted: e.target.checked })}
          className={checkbox}
        />
        <span className="text-sm font-medium">Show completed tasks</span>
      </label>

      <fieldset>
        <legend className="mb-1 px-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">Classes</legend>
        {[...classes, { id: NO_CLASS, name: "Tasks with no class", color: null, location: null }].map((c) => (
          <label key={c.id} className={row}>
            <input
              type="checkbox"
              checked={!filter.hiddenClasses.includes(c.id)}
              onChange={(e) => toggleClass(c.id, e.target.checked)}
              className={checkbox}
            />
            {c.id !== NO_CLASS && (
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: classColor(c) }} />
            )}
            <span className="min-w-0 break-words text-sm">{c.name}</span>
          </label>
        ))}
      </fieldset>

      {(filter.hiddenClasses.length > 0 || !filter.showCompleted) && (
        <button
          type="button"
          onClick={() => onChange({ hiddenClasses: [], showCompleted: true })}
          className="min-h-11 self-start rounded-lg px-2 text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Show everything
        </button>
      )}
    </div>
  );
}
