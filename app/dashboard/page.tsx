import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { parseSort, sortTasks } from "@/lib/sort-tasks";
import { TASK_COLUMNS, type ClassSummary, type Task } from "@/lib/types";
import { AddTaskForm } from "./add-task-form";
import { AgentPanel } from "./agent-panel";
import { SortControl } from "./sort-control";
import { TaskItem } from "./task-item";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sort = parseSort((await searchParams).sort);
  const supabase = await createClient();
  // proxy.ts already redirects, but check here too so the page is never
  // rendered for a signed-out user.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data, error }, { data: classData }] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS),
    supabase.from("classes").select("id, name, color").order("name", { ascending: true }),
  ]);
  // If classes fail to load, tasks still render, just without class labels.
  const classes = (classData ?? []) as ClassSummary[];
  const classesById = new Map(classes.map((c) => [c.id, c]));

  // Sorted here rather than in SQL because priority is text, not an ordered type.
  const tasks = sortTasks((data ?? []) as Task[], sort);
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader current="dashboard" email={auth.claims.email} />

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 app-main px-4 py-6">
        <h1 className="sr-only">My tasks</h1>
        <AgentPanel />
        <AddTaskForm classes={classes} />

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load your tasks. Please refresh the page.
          </p>
        ) : (
          <>
            {tasks.length > 1 && <SortControl current={sort} />}

            <section aria-labelledby="open-heading">
              <h2 id="open-heading" className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                To do ({open.length})
              </h2>
              {open.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                  {tasks.length === 0 ? "No tasks yet. Add your first one above." : "All caught up!"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {open.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      schoolClass={task.class_id ? classesById.get(task.class_id) : undefined}
                      classes={classes}
                    />
                  ))}
                </ul>
              )}
            </section>

            {done.length > 0 && (
              <section aria-labelledby="done-heading">
                <h2 id="done-heading" className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  Done ({done.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {done.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      schoolClass={task.class_id ? classesById.get(task.class_id) : undefined}
                      classes={classes}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
