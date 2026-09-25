import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CALENDAR_VIEWS, isDateKey, visibleRange, type ViewSetting } from "@/lib/calendar/dates";
import { expandClassMeetings, type RecurringClass } from "@/lib/calendar/recurrence";
import { createClient } from "@/lib/supabase/server";
import { TASK_COLUMNS, type Task } from "@/lib/types";
import { Calendar } from "./calendar";
import type { CalendarClass } from "./items";

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

  const [{ data: taskData, error: taskError }, { data: classData, error: classError }] = await Promise.all([
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
      .select("id, name, color, location, start_date, end_date, class_meetings(id, day_of_week, start_time, end_time)")
      .order("name", { ascending: true }),
  ]);

  const classRows = (classData ?? []) as (CalendarClass & RecurringClass)[];
  const meetings = expandClassMeetings(classRows, range.start, range.end);
  const classes: CalendarClass[] = classRows.map(({ id, name, color, location }) => ({ id, name, color, location }));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader current="calendar" email={auth.claims.email} wide />

      <main className="app-main mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:py-6">
        {taskError || classError ? (
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
          />
        )}
      </main>
    </div>
  );
}
