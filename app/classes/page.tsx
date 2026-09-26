import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { averagesByClass } from "@/lib/class-averages";
import type { SchoolClass } from "@/lib/types";
import { ClassCard } from "./class-card";
import type { GradedWorkItem } from "./graded-work";
import { GradesOverview } from "./grades-overview";
import { NewClassPanel } from "./new-class-panel";

const CLASS_COLUMNS =
  "id, name, instructor, location, color, start_date, end_date, grading_mode, created_at, class_meetings(id, day_of_week, start_time, end_time), class_weights(task_type, weight)";

export const metadata: Metadata = { title: "Classes & Grades" };

export default async function ClassesPage() {
  const supabase = await createClient();
  // proxy.ts already redirects, but check here too so the page is never
  // rendered for a signed-out user.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data, error }, { data: taskData, error: taskError }] = await Promise.all([
    supabase.from("classes").select(CLASS_COLUMNS).order("name", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, due_date, class_id, task_type, max_points, score, letter_grade")
      .not("class_id", "is", null)
      .not("graded_at", "is", null)
      .order("due_date", { ascending: false, nullsFirst: false }),
  ]);
  const classes = (data ?? []) as SchoolClass[];
  const gradedTasks = (taskData ?? []) as GradedWorkItem[];
  const averages = averagesByClass(classes, gradedTasks);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader current="classes" email={auth.claims.email} />

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 app-main px-4 py-6">
        <h1 className="sr-only">Classes &amp; Grades</h1>

        {error || taskError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load your classes. Please refresh the page.
          </p>
        ) : (
          <>
            {classes.length > 0 && <GradesOverview classes={classes} averages={averages} />}

            <NewClassPanel startOpen={classes.length === 0} />

            {classes.length > 0 && (
              <section aria-labelledby="classes-heading">
                <h2 id="classes-heading" className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  My classes ({classes.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {classes.map((c) => (
                    <ClassCard
                      key={c.id}
                      schoolClass={c}
                      average={averages.get(c.id)!}
                      gradedTasks={gradedTasks.filter((t) => t.class_id === c.id && t.task_type !== null)}
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
