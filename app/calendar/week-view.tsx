"use client";

import { formatDateKey } from "@/lib/calendar/dates";
import { formatTimeRange } from "@/lib/schedule";
import { classColor, TaskChip } from "./chips";
import { layoutMeetings, minutesOf, needsGrade, type ViewProps } from "./items";

const HOUR_PX = 48;
// The grid always covers at least 8 AM to 6 PM, and grows to fit earlier or later meetings.
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

function hourLabel(hour: number) {
  return `${hour % 12 || 12} ${hour < 12 || hour === 24 ? "AM" : "PM"}`;
}

/**
 * A week time grid: class meetings at their real times, tasks as all-day chips.
 * Scrolls sideways on phones rather than squeezing seven columns.
 */
export function WeekView({ dates, days, today, classesById, onOpenTask, onOpenDay }: ViewProps) {
  const meetings = dates.flatMap((d) => days.get(d)!.meetings);
  const startHour = Math.min(DEFAULT_START_HOUR, ...meetings.map((m) => Math.floor(minutesOf(m.start_time) / 60)));
  const endHour = Math.max(DEFAULT_END_HOUR, ...meetings.map((m) => Math.ceil(minutesOf(m.end_time) / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const columns = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-[44rem]">
        <div className={`${columns} border-b border-zinc-200 dark:border-zinc-800`}>
          <div />
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`${formatDateKey(date, "EEEE, MMMM d")}${date === today ? ", today" : ""}`}
              className="flex min-h-11 flex-col items-center justify-center py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="text-xs text-zinc-500">{formatDateKey(date, "EEE")}</span>
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm ${
                  date === today ? "bg-foreground font-semibold text-background" : ""
                }`}
              >
                {formatDateKey(date, "d")}
              </span>
            </button>
          ))}
        </div>

        {/* All-day row: due dates and study sessions. */}
        <div className={`${columns} border-b border-zinc-200 dark:border-zinc-800`}>
          <div className="px-1 py-1.5 text-right text-[11px] text-zinc-500">All day</div>
          {dates.map((date) => {
            const day = days.get(date)!;
            return (
              <div key={date} className="flex min-w-0 flex-col gap-0.5 border-l border-zinc-100 p-0.5 dark:border-zinc-900">
                {day.due.map((t) => (
                  <TaskChip
                    key={`due-${t.id}`}
                    task={t}
                    kind="due"
                    schoolClass={t.class_id ? classesById.get(t.class_id) : undefined}
                    needsGrade={needsGrade(t, today)}
                    onOpen={() => onOpenTask(t.id)}
                  />
                ))}
                {day.study.map((t) => (
                  <TaskChip
                    key={`study-${t.id}`}
                    task={t}
                    kind="study"
                    schoolClass={t.class_id ? classesById.get(t.class_id) : undefined}
                    needsGrade={false}
                    onOpen={() => onOpenTask(t.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid: class meetings. */}
        <div className={columns}>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="h-12 pr-1 text-right text-[11px] leading-none text-zinc-500">
                <span className="relative -top-1.5">{h === startHour ? "" : hourLabel(h)}</span>
              </div>
            ))}
          </div>
          {dates.map((date) => (
            <div key={date} className="relative border-l border-zinc-100 dark:border-zinc-900">
              {hours.map((h) => (
                <div key={h} className="h-12 border-t border-zinc-100 dark:border-zinc-900" />
              ))}
              {layoutMeetings(days.get(date)!.meetings).map(({ meeting, lane, lanes }) => {
                const c = classesById.get(meeting.classId);
                const color = classColor(c);
                const top = ((minutesOf(meeting.start_time) - startHour * 60) / 60) * HOUR_PX;
                const height = ((minutesOf(meeting.end_time) - minutesOf(meeting.start_time)) / 60) * HOUR_PX;
                const time = formatTimeRange(meeting.start_time, meeting.end_time);
                return (
                  <div
                    key={meeting.meetingId}
                    title={`${c?.name ?? "Class"}, ${time}${c?.location ? `, ${c.location}` : ""}`}
                    className="absolute overflow-hidden rounded-md border-l-[3px] px-1 py-0.5 text-[11px] leading-tight"
                    style={{
                      top,
                      height: Math.max(height, 18),
                      left: `calc(${(lane / lanes) * 100}% + 1px)`,
                      width: `calc(${100 / lanes}% - 2px)`,
                      backgroundColor: `${color}2e`,
                      borderLeftColor: color,
                    }}
                  >
                    <p className="truncate font-semibold">{c?.name ?? "Class"}</p>
                    <p className="truncate tabular-nums text-zinc-600 dark:text-zinc-300">{time}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
