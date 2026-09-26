import { displayLetter, type ClassAverage } from "@/lib/grades";
import type { SchoolClass } from "@/lib/types";

type Props = {
  classes: Pick<SchoolClass, "id" | "name" | "color">[];
  averages: Map<string, ClassAverage>;
};

/** Every class's current average at a glance; each row jumps to its class below. */
export function GradesOverview({ classes, averages }: Props) {
  return (
    <section
      aria-labelledby="overview-heading"
      className="rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 id="overview-heading" className="px-2 pt-1 pb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
        Overview
      </h2>
      <ul>
        {classes.map((c) => {
          const average = averages.get(c.id);
          return (
            <li key={c.id}>
              <a
                href={`#class-${c.id}`}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700"
                  style={c.color ? { backgroundColor: c.color, borderColor: c.color } : undefined}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                {average?.percent != null && average.letter ? (
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="font-semibold tabular-nums">{average.percent}%</span>
                    <span className="w-8 rounded-md bg-zinc-900 text-center text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {displayLetter(average.letter)}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-sm text-zinc-500">No average yet</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
