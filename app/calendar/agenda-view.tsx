"use client";

import { useEffect, useRef } from "react";
import { formatDateKey } from "@/lib/calendar/dates";
import { DayList } from "./day-list";
import { dayItemCount, type ViewProps } from "./items";

/** A day-by-day list of the days that have something on them. */
export function AgendaView({ dates, days, today, classesById, onOpenTask, onOpenDay }: ViewProps) {
  const withItems = dates.filter((d) => dayItemCount(days.get(d)!) > 0);
  const scrolled = useRef(false);
  const firstUpcoming = today ? withItems.find((d) => d >= today) : undefined;

  // Start at today (or the next day with something on it) rather than the 1st.
  useEffect(() => {
    if (scrolled.current || !firstUpcoming || firstUpcoming === withItems[0]) return;
    scrolled.current = true;
    document.getElementById(`agenda-${firstUpcoming}`)?.scrollIntoView({ block: "start" });
  }, [firstUpcoming, withItems]);

  if (withItems.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
        Nothing on the calendar for this period.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {withItems.map((date) => (
        <section
          key={date}
          id={`agenda-${date}`}
          aria-labelledby={`agenda-${date}-heading`}
          className="scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 id={`agenda-${date}-heading`}>
            <button
              type="button"
              onClick={() => onOpenDay(date)}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {formatDateKey(date, "EEEE, MMM d")}
              {date === today && (
                <span className="rounded-full bg-foreground px-2 text-xs leading-5 text-background">Today</span>
              )}
            </button>
          </h2>
          <DayList day={days.get(date)!} today={today} classesById={classesById} onOpenTask={onOpenTask} />
        </section>
      ))}
    </div>
  );
}
