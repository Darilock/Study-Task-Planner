import { getDay } from "date-fns";
// The .ts extension lets `node --test` load this file directly.
import { eachDateKey, parseLocalDate } from "./dates.ts";

export type RecurringClass = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  class_meetings: { id: string; day_of_week: number; start_time: string; end_time: string }[];
};

export type MeetingOccurrence = {
  classId: string;
  meetingId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM:SS, as stored. */
  start_time: string;
  end_time: string;
};

/**
 * Every class meeting between start and end (inclusive date keys). Each meeting
 * repeats weekly on its day_of_week (0 = Sunday), but only within the class's
 * term: from start_date through end_date. A missing term date means the class
 * has no limit on that side. Results are sorted by date, then start time.
 */
export function expandClassMeetings(classes: RecurringClass[], start: string, end: string): MeetingOccurrence[] {
  const occurrences: MeetingOccurrence[] = [];

  for (const c of classes) {
    if (c.class_meetings.length === 0) continue;
    // Date keys are zero-padded, so string comparison is date comparison.
    const from = c.start_date && c.start_date > start ? c.start_date : start;
    const to = c.end_date && c.end_date < end ? c.end_date : end;

    for (const date of eachDateKey(from, to)) {
      const day = getDay(parseLocalDate(date));
      for (const m of c.class_meetings) {
        if (m.day_of_week !== day) continue;
        occurrences.push({ classId: c.id, meetingId: m.id, date, start_time: m.start_time, end_time: m.end_time });
      }
    }
  }

  return occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.classId.localeCompare(b.classId),
  );
}
