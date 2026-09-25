"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  CALENDAR_VIEWS,
  eachDateKey,
  formatDateKey,
  rangeTitle,
  shiftAnchor,
  type CalendarView,
  type ViewSetting,
} from "@/lib/calendar/dates";
import type { MeetingOccurrence } from "@/lib/calendar/recurrence";
import { useLocalToday } from "@/lib/use-local-today";
import type { Task } from "@/lib/types";
import { AddTaskForm } from "../dashboard/add-task-form";
import { TaskItem } from "../dashboard/task-item";
import { AgendaView } from "./agenda-view";
import { DayList } from "./day-list";
import { FilterPanel } from "./filter-panel";
import { DEFAULT_FILTER, dayItemCount, groupByDay, type CalendarClass, type CalendarFilter } from "./items";
import { MonthView } from "./month-view";
import { Sheet } from "./sheet";
import { WeekView } from "./week-view";

const FILTER_STORAGE_KEY = "calendar-filter";
const filterListeners = new Set<() => void>();
// Used when localStorage is unavailable (private windows, blocked site data).
let filterInMemory: string | null = null;

function subscribeToFilter(listener: () => void) {
  filterListeners.add(listener);
  return () => filterListeners.delete(listener);
}

function readStoredFilter(): string | null {
  try {
    return localStorage.getItem(FILTER_STORAGE_KEY) ?? filterInMemory;
  } catch {
    return filterInMemory;
  }
}

function parseFilter(raw: string | null): CalendarFilter {
  try {
    const saved = JSON.parse(raw ?? "null");
    if (saved && Array.isArray(saved.hiddenClasses) && typeof saved.showCompleted === "boolean") {
      return {
        hiddenClasses: saved.hiddenClasses.filter((c: unknown) => typeof c === "string"),
        showCompleted: saved.showCompleted,
      };
    }
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_FILTER;
}

/**
 * The filter, remembered in this browser only. The server render (and the
 * first client render) use the default, so hydration always matches.
 */
function useStoredFilter() {
  const raw = useSyncExternalStore(subscribeToFilter, readStoredFilter, () => null);
  const filter = useMemo(() => parseFilter(raw), [raw]);

  function update(next: CalendarFilter) {
    filterInMemory = JSON.stringify(next);
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, filterInMemory);
    } catch {
      // Still applied for this visit via filterInMemory.
    }
    filterListeners.forEach((listener) => listener());
  }

  return [filter, update] as const;
}

const VIEW_LABELS: Record<CalendarView, string> = { month: "Month", week: "Week", agenda: "Agenda" };

function calendarHref(view: ViewSetting, date?: string) {
  const params = new URLSearchParams();
  if (view !== "auto") params.set("view", view);
  if (date) params.set("date", date);
  const query = params.toString();
  return query ? `/calendar?${query}` : "/calendar";
}

type Props = {
  view: ViewSetting;
  anchor: string;
  /** Whether the URL named a date; if not, the anchor is the server's UTC today. */
  hasDate: boolean;
  range: { start: string; end: string };
  tasks: Task[];
  meetings: MeetingOccurrence[];
  classes: CalendarClass[];
};

export function Calendar({ view, anchor, hasDate, range, tasks, meetings, classes }: Props) {
  const router = useRouter();
  const today = useLocalToday();
  const [filter, setFilter] = useStoredFilter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Without a date in the URL the server guessed today in UTC. If the
  // student's local today is outside what's shown, move there.
  useEffect(() => {
    if (!hasDate && today && (today < range.start || today > range.end)) {
      router.replace(calendarHref(view, today));
    }
  }, [hasDate, today, range.start, range.end, view, router]);

  const dates = useMemo(() => eachDateKey(range.start, range.end), [range.start, range.end]);
  const days = useMemo(() => groupByDay(dates, tasks, meetings, filter), [dates, tasks, meetings, filter]);
  const classesById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const month = anchor.slice(0, 7);
  const hiddenCount = filter.hiddenClasses.length + (filter.showCompleted ? 0 : 1);
  const monthDates = useMemo(() => dates.filter((d) => d.startsWith(month)), [dates, month]);

  // Looked up on every render so the sheet shows fresh data after an edit,
  // and closes by itself if the task is deleted.
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined;

  const viewProps = {
    days,
    today,
    classesById,
    onOpenTask: (id: string) => {
      setOpenDay(null);
      setOpenTaskId(id);
    },
    onOpenDay: setOpenDay,
  };

  const navButton =
    "flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900";

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <h1 className="text-lg font-semibold sm:order-last sm:ml-2 sm:text-xl">{rangeTitle(view, anchor)}</h1>
          <div className="flex gap-1">
            <Link href={calendarHref(view, shiftAnchor(view, anchor, -1))} aria-label="Previous" className={`${navButton} w-11 px-0`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link href={calendarHref(view, today ?? undefined)} className={navButton}>
              Today
            </Link>
            <Link href={calendarHref(view, shiftAnchor(view, anchor, 1))} aria-label="Next" className={`${navButton} w-11 px-0`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav
            aria-label="Calendar view"
            className="flex flex-1 rounded-lg border border-zinc-200 bg-white p-0.5 sm:flex-none dark:border-zinc-800 dark:bg-zinc-950"
          >
            {CALENDAR_VIEWS.map((v) => {
              // With no view chosen, month shows on wide screens and agenda on phones.
              const active =
                view === v
                  ? "bg-foreground text-background"
                  : view === "auto" && v === "month"
                    ? "sm:bg-foreground sm:text-background"
                    : view === "auto" && v === "agenda"
                      ? "max-sm:bg-foreground max-sm:text-background"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900";
              return (
                <Link
                  key={v}
                  href={calendarHref(v, hasDate ? anchor : undefined)}
                  aria-current={view === v ? "page" : undefined}
                  className={`flex min-h-10 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium ${active}`}
                >
                  {VIEW_LABELS[v]}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`${navButton} gap-1.5`}
            aria-label={hiddenCount > 0 ? `Filter, ${hiddenCount} hidden` : "Filter"}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
              <path d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" />
            </svg>
            Filter
            {hiddenCount > 0 && (
              <span aria-hidden className="rounded-full bg-foreground px-1.5 text-xs leading-5 text-background">
                {hiddenCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {view === "week" ? (
        <WeekView dates={dates} {...viewProps} />
      ) : view === "month" ? (
        <MonthView dates={dates} month={month} {...viewProps} />
      ) : view === "agenda" ? (
        <AgendaView dates={monthDates} {...viewProps} />
      ) : (
        <>
          <div className="hidden sm:block">
            <MonthView dates={dates} month={month} {...viewProps} />
          </div>
          <div className="sm:hidden">
            <AgendaView dates={monthDates} {...viewProps} />
          </div>
        </>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-zinc-400" /> Due date
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full border-2 border-dashed border-zinc-400" /> Study session
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="rounded-sm bg-red-600 px-1 text-[10px] font-bold text-white">!</span> Extreme priority
        </span>
      </p>

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter calendar">
        <FilterPanel classes={classes} filter={filter} onChange={setFilter} />
      </Sheet>

      <Sheet
        open={openDay !== null}
        onClose={() => {
          setOpenDay(null);
          setAddingTask(false);
        }}
        title={openDay ? formatDateKey(openDay, "EEEE, MMMM d") : ""}
      >
        {openDay && days.get(openDay) && (
          <>
            {dayItemCount(days.get(openDay)!) === 0 ? (
              <p className="p-2 text-sm text-zinc-500">Nothing scheduled.</p>
            ) : (
              <DayList
                day={days.get(openDay)!}
                today={today}
                classesById={classesById}
                onOpenTask={viewProps.onOpenTask}
              />
            )}
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              {addingTask ? (
                <AddTaskForm
                  key={openDay}
                  classes={classes}
                  defaultDueDate={openDay}
                  onAdded={() => setAddingTask(false)}
                />
              ) : (
                <button type="button" onClick={() => setAddingTask(true)} className="btn-primary w-full">
                  Add a task due {formatDateKey(openDay, "EEE, MMM d")}
                </button>
              )}
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={openTask !== undefined} onClose={() => setOpenTaskId(null)} title={openTask?.title ?? ""}>
        {openTask && (
          <ul>
            <TaskItem
              key={openTask.id}
              task={openTask}
              schoolClass={openTask.class_id ? classesById.get(openTask.class_id) : undefined}
              classes={classes}
              startEditing
            />
          </ul>
        )}
      </Sheet>
    </>
  );
}
