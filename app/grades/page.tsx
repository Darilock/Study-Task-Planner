import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ClassAverageDisplay } from "@/components/class-average";
import { averagesByClass, type GradedTaskRow } from "@/lib/class-averages";
import { formatDate } from "@/lib/format";
import { formatTaskGrade } from "@/lib/format-grade";
import { TASK_TYPE_LABELS } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import type { SchoolClass } from "@/lib/types";

export const metadata: Metadata = { title: "Grades" };

type GradedTaskWithTitle = GradedTaskRow & { id: string; title: string; due_date: string | null };

export default async function GradesPage() {
  const supabase = await createClient();
  // proxy.ts already redirects, but check here too so the page is never
  // rendered for a signed-out user.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data: classData, error }, { data: taskData, error: taskError }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, color, grading_mode, class_weights(task_type, weight)")
      .order("name", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, due_date, class_id, task_type, max_points, score, letter_grade")
      .not("class_id", "is", null)
      .not("graded_at", "is", null)
      .order("due_date", { ascending: false, nullsFirst: false }),
  ]);
  const classes = (classData ?? []) as Pick<SchoolClass, "id" | "name" | "color" | "grading_mode" | "class_weights">[];
  const tasks = (taskData ?? []) as GradedTaskWithTitle[];
  const averages = averagesByClass(classes, tasks);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader current="grades" email={auth.claims.email} />

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 app-main px-4 py-6">
        <h1 className="sr-only">Grades</h1>

        {error || taskError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load your grades. Please refresh the page.
          </p>
        ) : classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No classes yet.{" "}
            <Link href="/classes" className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
              Add a class
            </Link>{" "}
            to start tracking grades.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => {
              const classTasks = tasks.filter((t) => t.class_id === c.id && t.task_type !== null);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <h2 className="flex items-center gap-2 break-words font-semibold">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700"
                      style={c.color ? { backgroundColor: c.color, borderColor: c.color } : undefined}
                    />
                    <span className="min-w-0">{c.name}</span>
                  </h2>
                  <div className="mt-2">
                    <ClassAverageDisplay average={averages.get(c.id)!} mode={c.grading_mode} size="lg" />
                  </div>

                  {classTasks.length > 0 && (
                    <details className="group mt-2">
                      <summary className="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden rounded-lg px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4 transition-transform group-open:rotate-90"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Graded work ({classTasks.length})
                      </summary>
                      <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-900">
                        {classTasks.map((t) => (
                          <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="block break-words">{t.title}</span>
                              <span className="text-xs text-zinc-500">
                                {TASK_TYPE_LABELS[t.task_type!]}
                                {t.due_date && ` · Due ${formatDate(t.due_date)}`}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium tabular-nums">{formatTaskGrade(t)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
