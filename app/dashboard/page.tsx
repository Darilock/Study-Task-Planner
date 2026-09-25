import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { parseSort, sortTasks } from "@/lib/sort-tasks";
import type { Task } from "@/lib/types";
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

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, subject, due_date, estimated_minutes, scheduled_for, priority, status, created_at");

  // Sorted here rather than in SQL because priority is text, not an ordered type.
  const tasks = sortTasks((data ?? []) as Task[], sort);
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">My tasks</h1>
            <p className="truncate text-xs text-zinc-500">{auth.claims.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <AgentPanel />
        <AddTaskForm />

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
                    <TaskItem key={task.id} task={task} />
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
                    <TaskItem key={task.id} task={task} />
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
