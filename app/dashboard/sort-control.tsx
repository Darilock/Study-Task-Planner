import Link from "next/link";
import type { TaskSort } from "@/lib/sort-tasks";

const LABELS: Record<TaskSort, string> = { due: "Due date", priority: "Priority" };

export function SortControl({ current }: { current: TaskSort }) {
  return (
    <nav aria-label="Sort tasks" className="flex items-center gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">Sort by</span>
      <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
        {(Object.keys(LABELS) as TaskSort[]).map((sort) => {
          const active = sort === current;
          return (
            <Link
              key={sort}
              href={sort === "due" ? "/dashboard" : `/dashboard?sort=${sort}`}
              scroll={false}
              replace
              aria-current={active ? "true" : undefined}
              className={`flex min-h-10 items-center rounded-md px-3 font-medium ${
                active
                  ? "bg-foreground text-background"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {LABELS[sort]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
