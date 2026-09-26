"use client";

import { formatDateKey } from "@/lib/calendar/dates";
import { classColor, TaskChip } from "./chips";
import { dayItemCount, needsGrade, type CalendarClass, type DayItems, type ViewProps } from "./items";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Chips shown in a cell before "+N more".
const MAX_ITEMS = 4;

/**
 * A month grid. On phones cells only show colored dots (tap a day for
 * details); wider screens show task chips and class meetings.
 */
export function MonthView({
  dates,
  days,
  today,
  classesById,
  onOpenTask,
  onOpenDay,
  month,
}: ViewProps & { month: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            <span className="sm:hidden" aria-hidden>
              {d[0]}
            </span>
            <span className="max-sm:sr-only">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const day = days.get(date)!;
          const count = dayItemCount(day);
          const inMonth = date.startsWith(month);
          const isToday = date === today;
          const chips = [
            ...day.due.map((t) => ({ key: `due-${t.id}`, task: t, kind: "due" as const })),
            ...day.study.map((t) => ({ key: `study-${t.id}`, task: t, kind: "study" as const })),
          ];
          const shownChips = chips.slice(0, MAX_ITEMS);
          const shownMeetings = day.meetings.slice(0, Math.max(0, MAX_ITEMS - shownChips.length));
          const hidden = count - shownChips.length - shownMeetings.length;

          return (
            <div
              key={date}
              onClick={() => onOpenDay(date)}
              className={`flex min-h-16 min-w-0 cursor-pointer flex-col gap-0.5 border-b border-r border-zinc-100 p-1 sm:min-h-28 dark:border-zinc-900 ${
                inMonth ? "" : "bg-zinc-50 text-zinc-400 dark:bg-zinc-900/40"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDay(date);
                }}
                aria-label={`${formatDateKey(date, "EEEE, MMMM d")}${isToday ? ", today" : ""}: ${
                  count === 0 ? "nothing scheduled" : `${count} item${count === 1 ? "" : "s"}`
                }`}
                className={`flex size-7 items-center justify-center self-center rounded-full text-sm sm:self-start ${
                  isToday ? "bg-foreground font-semibold text-background" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {formatDateKey(date, "d")}
              </button>

              {/* Phones: one dot per item, colored by class. Study sessions are hollow. */}
              {count > 0 && (
                <div aria-hidden className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {dotsFor(day, classesById)
                    .slice(0, 6)
                    .map((dot) => (
                      <span
                        key={dot.id}
                        className={`size-1.5 rounded-full ${dot.hollow ? "border" : ""} ${dot.extreme ? "ring-1 ring-red-600" : ""}`}
                        style={dot.hollow ? { borderColor: dot.color } : { backgroundColor: dot.color }}
                      />
                    ))}
                </div>
              )}

              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {shownChips.map(({ key, task, kind }) => (
                  <TaskChip
                    key={key}
                    task={task}
                    kind={kind}
                    schoolClass={task.class_id ? classesById.get(task.class_id) : undefined}
                    needsGrade={kind === "due" && needsGrade(task, today)}
                    onOpen={() => onOpenTask(task.id)}
                  />
                ))}
                {shownMeetings.map((m) => {
                  const c = classesById.get(m.classId);
                  return (
                    <p key={m.meetingId} className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-zinc-500">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: classColor(c) }} />
                      <span className="shrink-0 tabular-nums">{formatMeetingStart(m.start_time)}</span>
                      <span className="truncate">{c?.name}</span>
                    </p>
                  );
                })}
                {hidden > 0 && (
                  <span className="px-1 text-[11px] font-medium text-zinc-500">+{hidden} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "10:00" → "10a", "13:30" → "1:30p", for tight month cells. */
function formatMeetingStart(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "a" : "p"}`;
}

/** Dots for the phone month grid: due tasks, study sessions (hollow), then meetings. */
function dotsFor(day: DayItems, classesById: Map<string, CalendarClass>) {
  const colorOf = (classId: string | null) => classColor(classId ? classesById.get(classId) : undefined);
  return [
    ...day.due.map((t) => ({
      id: `due-${t.id}`,
      color: colorOf(t.class_id),
      hollow: false,
      extreme: t.priority === "extreme" && t.status !== "done",
    })),
    ...day.study.map((t) => ({ id: `study-${t.id}`, color: colorOf(t.class_id), hollow: true, extreme: false })),
    ...day.meetings.map((m) => ({ id: `meet-${m.meetingId}`, color: colorOf(m.classId), hollow: false, extreme: false })),
  ];
}
