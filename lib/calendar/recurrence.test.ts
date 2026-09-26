// A US time zone, where parsing "YYYY-MM-DD" as UTC would land on the day before.
process.env.TZ = "America/Los_Angeles";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isDateKey, parseLocalDate, rangeTitle, shiftAnchor, visibleRange } from "./dates.ts";
import { expandClassMeetings, type RecurringClass } from "./recurrence.ts";

function meeting(id: string, day_of_week: number, start: string, end: string) {
  return { id, day_of_week, start_time: `${start}:00`, end_time: `${end}:00` };
}

// Mon/Wed/Fri lecture plus a Tuesday lab.
const MWF_WITH_LAB = [
  meeting("mon", 1, "10:00", "10:50"),
  meeting("wed", 3, "10:00", "10:50"),
  meeting("fri", 5, "10:00", "10:50"),
  meeting("lab", 2, "14:00", "16:50"),
];

function klass(overrides: Partial<RecurringClass> = {}): RecurringClass {
  return { id: "bio", start_date: null, end_date: null, class_meetings: MWF_WITH_LAB, ...overrides };
}

const dates = (occurrences: { date: string }[]) => occurrences.map((o) => o.date);

describe("expandClassMeetings", () => {
  test("multiple meetings per week land on their own weekdays", () => {
    // 2026-09-07 is a Monday.
    const result = expandClassMeetings([klass()], "2026-09-07", "2026-09-13");
    assert.deepEqual(
      result.map((o) => [o.date, o.meetingId, o.start_time]),
      [
        ["2026-09-07", "mon", "10:00:00"],
        ["2026-09-08", "lab", "14:00:00"],
        ["2026-09-09", "wed", "10:00:00"],
        ["2026-09-11", "fri", "10:00:00"],
      ],
    );
  });

  test("the term's start and end dates are both included", () => {
    // Term runs Wednesday 9/9 through Friday 9/11.
    const result = expandClassMeetings(
      [klass({ start_date: "2026-09-09", end_date: "2026-09-11" })],
      "2026-09-07",
      "2026-09-13",
    );
    assert.deepEqual(dates(result), ["2026-09-09", "2026-09-11"]);
  });

  test("nothing before the term starts or after it ends", () => {
    const c = klass({ start_date: "2026-09-14", end_date: "2026-12-11" });
    assert.deepEqual(expandClassMeetings([c], "2026-09-07", "2026-09-13"), []);
    assert.deepEqual(expandClassMeetings([c], "2026-12-12", "2026-12-31"), []);
  });

  test("a class with no term dates repeats every week of the range", () => {
    const c = klass({ class_meetings: [meeting("mon", 1, "09:00", "09:50")] });
    assert.deepEqual(dates(expandClassMeetings([c], "2026-09-01", "2026-09-30")), [
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  test("only a start date, or only an end date", () => {
    const monday = [meeting("mon", 1, "09:00", "09:50")];
    const startsLater = klass({ start_date: "2026-09-15", class_meetings: monday });
    assert.deepEqual(dates(expandClassMeetings([startsLater], "2026-09-01", "2026-09-30")), [
      "2026-09-21",
      "2026-09-28",
    ]);
    const endsEarly = klass({ end_date: "2026-09-14", class_meetings: monday });
    assert.deepEqual(dates(expandClassMeetings([endsEarly], "2026-09-01", "2026-09-30")), [
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  test("dates stay correct across a daylight saving change", () => {
    // US clocks fall back on Sunday 2026-11-01.
    const c = klass({ class_meetings: [meeting("sun", 0, "18:00", "19:00"), meeting("mon", 1, "09:00", "09:50")] });
    assert.deepEqual(dates(expandClassMeetings([c], "2026-10-25", "2026-11-08")), [
      "2026-10-25",
      "2026-10-26",
      "2026-11-01",
      "2026-11-02",
      "2026-11-08",
    ]);
  });

  test("several classes are merged in date and time order", () => {
    const chem = klass({ id: "chem", class_meetings: [meeting("chem-mon", 1, "08:00", "08:50")] });
    const result = expandClassMeetings([klass(), chem], "2026-09-07", "2026-09-07");
    assert.deepEqual(
      result.map((o) => o.classId),
      ["chem", "bio"],
    );
  });

  test("a class with no meeting times has no occurrences", () => {
    assert.deepEqual(expandClassMeetings([klass({ class_meetings: [] })], "2026-09-01", "2026-09-30"), []);
  });
});

describe("calendar dates", () => {
  test("date keys parse as local dates, not UTC", () => {
    const date = parseLocalDate("2026-09-25");
    assert.equal(date.getDate(), 25);
    assert.equal(date.getDay(), 5); // Friday
    // The bug this avoids: native parsing treats the key as UTC midnight.
    assert.equal(new Date("2026-09-25").getDate(), 24);
  });

  test("isDateKey rejects impossible dates", () => {
    assert.equal(isDateKey("2026-02-28"), true);
    assert.equal(isDateKey("2026-02-30"), false);
    assert.equal(isDateKey("2026-9-5"), false);
  });

  test("visible ranges", () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    assert.deepEqual(visibleRange("month", "2026-09-25"), { start: "2026-08-30", end: "2026-10-03" });
    assert.deepEqual(visibleRange("auto", "2026-09-25"), { start: "2026-08-30", end: "2026-10-03" });
    assert.deepEqual(visibleRange("agenda", "2026-09-25"), { start: "2026-09-01", end: "2026-09-30" });
    assert.deepEqual(visibleRange("week", "2026-09-25"), { start: "2026-09-20", end: "2026-09-26" });
  });

  test("moving between periods", () => {
    assert.equal(shiftAnchor("week", "2026-09-25", 1), "2026-10-02");
    assert.equal(shiftAnchor("month", "2026-01-31", 1), "2026-02-28");
    assert.equal(shiftAnchor("agenda", "2026-01-15", -1), "2025-12-15");
  });

  test("titles", () => {
    assert.equal(rangeTitle("month", "2026-09-25"), "September 2026");
    assert.equal(rangeTitle("week", "2026-09-25"), "Sep 20 – 26, 2026");
    assert.equal(rangeTitle("week", "2026-09-30"), "Sep 27 – Oct 3, 2026");
    assert.equal(rangeTitle("week", "2026-12-31"), "Dec 27, 2026 – Jan 2, 2027");
  });
});
