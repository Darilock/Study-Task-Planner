import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { addDays } from "date-fns";
import { averagesByClass, GRADED_TASK_COLUMNS, type GradedTaskRow } from "@/lib/class-averages";
import {
  CALENDAR_VIEWS,
  isDateKey,
  parseLocalDate,
  toDateKey,
  visibleRange,
  type ViewSetting,
} from "@/lib/calendar/dates";
import { riskLevel } from "@/lib/grades";
import { expandClassMeetings, type RecurringClass } from "@/lib/calendar/recurrence";
import { createClient } from "@/lib/supabase/server";
import { TASK_COLUMNS, type SchoolClass, type Task } from "@/lib/types";
import { Calendar } from "./calendar";
import type { CalendarClass, ClassRisk } from "./items";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const view: ViewSetting = (CALENDAR_VIEWS as readonly unknown[]).includes(params.view)
    ? (params.view as ViewSetting)
    : "auto";
  const hasDate = isDateKey(params.date);
  // The server doesn't know the student's time zone, so without a date it
  // starts from today's UTC date; the client moves to its local today if needed.
  const anchor = hasDate ? (params.date as string) : new Date().toISOString().slice(0, 10);
  const range = visibleRange(view, anchor);

  const supabase = await createClient();
  // proxy.ts already redirects, but check here too so the page is never
  // rendered for a signed-out user.
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  // The This Week box needs incomplete tasks due by the end of the student's
  // week, overdue ones included. Local today is at most a day ahead of UTC, so
  // UTC today + 7 days always covers their Saturday; the client trims the rest.
  const weekLimit = toDateKey(addDays(parseLocalDate(new Date().toISOString().slice(0, 10)), 7));

  const [
    { data: taskData, error: taskError },
    { data: classData, error: classError },
    { data: weekData, error: weekError },
    { data: gradedData, error: gradedError },
  ] = await Promise.all([
    // Only tasks due or planned inside the visible range.
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .or(
        `and(due_date.gte.${range.start},due_date.lte.${range.end}),` +
          `and(scheduled_for.gte.${range.start},scheduled_for.lte.${range.end})`,
      ),
    // Every class, for names, colors and filters; meetings are expanded for the range below.
    supabase
      .from("classes")
      .select(
        "id, name, color, location, start_date, end_date, grading_mode, class_meetings(id, day_of_week, start_time, end_time), class_weights(task_type, weight)",
      )
      .order("name", { ascending: true }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", weekLimit)
      .order("due_date", { ascending: true })
      .limit(200),
    // Graded work, for spotting classes at risk.
    supabase.from("tasks").select(GRADED_TASK_COLUMNS).not("class_id", "is", null).not("graded_at", "is", null),
  ]);

  const classRows = (classData ?? []) as (CalendarClass & RecurringClass & Pick<SchoolClass, "grading_mode" | "class_weights">)[];
  const meetings = expandClassMeetings(classRows, range.start, range.end);
  const classes: CalendarClass[] = classRows.map(({ id, name, color, location }) => ({ id, name, color, location }));
  const averages = averagesByClass(classRows, (gradedData ?? []) as GradedTaskRow[]);
  const risks: ClassRisk[] = classes.flatMap((c) => {
    const average = averages.get(c.id)!;
    const level = riskLevel(average);
    return level ? [{ classId: c.id, level, percent: average.percent!, letter: average.letter! }] : [];
  });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader current="calendar" email={auth.claims.email} wide />

      <main className="app-main mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:py-6">
        {taskError || classError || weekError || gradedError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t load your calendar. Please refresh the page.
          </p>
        ) : (
          <Calendar
            view={view}
            anchor={anchor}
            hasDate={hasDate}
            range={range}
            tasks={(taskData ?? []) as Task[]}
            meetings={meetings}
            classes={classes}
            weekTasks={(weekData ?? []) as Task[]}
            risks={risks}
          />
        )}
      </main>
    </div>
  );
}
