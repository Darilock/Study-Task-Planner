import type { MeetingOccurrence } from "@/lib/calendar/recurrence";
import type { ClassSummary, Task } from "@/lib/types";

export type CalendarClass = ClassSummary & { location: string | null };

/** Tasks with no class are filtered under this key. */
export const NO_CLASS = "none";

export type CalendarFilter = { hiddenClasses: string[]; showCompleted: boolean };
export const DEFAULT_FILTER: CalendarFilter = { hiddenClasses: [], showCompleted: true };

export type DayItems = {
  meetings: MeetingOccurrence[];
  /** Tasks due this day. */
  due: Task[];
  /** Tasks planned for this day (scheduled_for): study sessions. */
  study: Task[];
};

export function emptyDay(): DayItems {
  return { meetings: [], due: [], study: [] };
}

export function dayItemCount(day: DayItems) {
  return day.meetings.length + day.due.length + day.study.length;
}

function taskVisible(task: Task, filter: CalendarFilter) {
  if (!filter.showCompleted && task.status === "done") return false;
  return !filter.hiddenClasses.includes(task.class_id ?? NO_CLASS);
}

/**
 * Buckets meetings and tasks by date key. A task shows on its due date and,
 * separately, as a study session on its scheduled_for date.
 */
export function groupByDay(
  dates: string[],
  tasks: Task[],
  meetings: MeetingOccurrence[],
  filter: CalendarFilter,
): Map<string, DayItems> {
  const days = new Map(dates.map((d) => [d, emptyDay()]));
  for (const m of meetings) {
    if (filter.hiddenClasses.includes(m.classId)) continue;
    days.get(m.date)?.meetings.push(m);
  }
  for (const task of tasks) {
    if (!taskVisible(task, filter)) continue;
    if (task.due_date) days.get(task.due_date)?.due.push(task);
    if (task.scheduled_for) days.get(task.scheduled_for)?.study.push(task);
  }
  return days;
}

/** A graded task whose due date has passed and has no grade yet. */
export function needsGrade(task: Task, today: string | null) {
  return (
    today !== null &&
    task.task_type !== null &&
    task.graded_at === null &&
    task.due_date !== null &&
    task.due_date < today
  );
}

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Side-by-side placement for one day's meetings in the week grid. Overlapping
 * meetings share the column: each gets a lane, and `lanes` is how many lanes
 * its overlapping group needs.
 */
export function layoutMeetings(meetings: MeetingOccurrence[]) {
  const sorted = [...meetings].sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
  const placed: { meeting: MeetingOccurrence; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };

  for (const meeting of sorted) {
    const start = minutesOf(meeting.start_time);
    const end = minutesOf(meeting.end_time);
    if (start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    groupEnd = Math.max(groupEnd, end);
    const p = { meeting, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
  }
  closeGroup();
  return placed;
}

/** Props shared by the month, week and agenda views. */
export type ViewProps = {
  dates: string[];
  days: Map<string, DayItems>;
  today: string | null;
  classesById: Map<string, CalendarClass>;
  onOpenTask: (id: string) => void;
  onOpenDay: (date: string) => void;
};
