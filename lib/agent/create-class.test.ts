import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asClassColor,
  checkChangeCap,
  findDuplicateClasses,
  parseCreateClasses,
  ToolInputError,
  weightWarning,
} from "./validation.ts";

const rejects = (fn: () => unknown, message: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof ToolInputError && message.test(e.message));

const one = (fields: Record<string, unknown>) => parseCreateClasses({ classes: [{ name: "Biology", ...fields }] })[0];
const mwf = [
  { day: 1, start_time: "10:00", end_time: "10:50" },
  { day: 3, start_time: "10:00", end_time: "10:50" },
  { day: 5, start_time: "10:00", end_time: "10:50" },
];

describe("parseCreateClasses", () => {
  test("a name alone gets percent grading and nothing else", () => {
    assert.deepEqual(one({}), {
      name: "Biology",
      instructor: null,
      location: null,
      color: null,
      start_date: null,
      end_date: null,
      grading_mode: "percent",
      meetings: [],
      weights: [],
    });
  });

  test("a full class", () => {
    const c = one({
      instructor: "Dr. Rivera",
      location: "Science Hall 204",
      color: "Blue",
      start_date: "2026-09-01",
      end_date: "2026-12-11",
      meetings: mwf,
      weights: { homework: 20, quiz: 30, exam: 50 },
    });
    assert.equal(c.color, "#2563eb");
    assert.deepEqual(c.meetings[0], { day_of_week: 1, start_time: "10:00", end_time: "10:50" });
    assert.deepEqual(c.weights, [
      { task_type: "homework", weight: 20 },
      { task_type: "quiz", weight: 30 },
      { task_type: "exam", weight: 50 },
    ]);
  });

  test("meeting days are 0 to 6 and end after they start", () => {
    rejects(() => one({ meetings: [{ day: 7, start_time: "10:00", end_time: "11:00" }] }), /0 \(Sunday\) to 6/);
    rejects(() => one({ meetings: [{ day: -1, start_time: "10:00", end_time: "11:00" }] }), /0 \(Sunday\) to 6/);
    rejects(() => one({ meetings: [{ day: "Monday", start_time: "10:00", end_time: "11:00" }] }), /0 \(Sunday\) to 6/);
    rejects(() => one({ meetings: [{ day: 1, start_time: "11:00", end_time: "10:00" }] }), /end_time must be after/);
    rejects(() => one({ meetings: [{ day: 1, start_time: "10:00", end_time: "10:00" }] }), /end_time must be after/);
    rejects(() => one({ meetings: [{ day: 1, start_time: "10am", end_time: "11:00" }] }), /24-hour time/);
  });

  test("the term ends after it starts", () => {
    rejects(() => one({ start_date: "2026-12-11", end_date: "2026-09-01" }), /end_date must be after start_date/);
    rejects(() => one({ start_date: "2026-09-01", end_date: "2026-09-01" }), /end_date must be after start_date/);
  });

  test("weights are above 0 and at most 100, and only in percent mode", () => {
    rejects(() => one({ weights: { exam: 0 } }), /above 0 and at most 100/);
    rejects(() => one({ weights: { exam: 120 } }), /above 0 and at most 100/);
    rejects(() => one({ weights: { midterm: 50 } }), /unexpected fields: midterm/);
    rejects(() => one({ grading_mode: "points", weights: { exam: 50 } }), /only apply when grading_mode is "percent"/);
    assert.equal(one({ grading_mode: "points" }).grading_mode, "points");
    rejects(() => one({ grading_mode: "curve" }), /"percent" or "points"/);
  });

  test("colors come from the app's palette", () => {
    assert.equal(asClassColor("teal", "color"), "#0d9488");
    assert.equal(asClassColor("#DC2626", "color"), "#dc2626");
    rejects(() => one({ color: "chartreuse" }), /must be one of: red, orange/);
    rejects(() => one({ color: "#123456" }), /must be one of/);
  });

  test("at most 5 classes per request, and nothing it can't set", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `Class ${i}` }));
    rejects(() => parseCreateClasses({ classes: six }), /at most 5 classes/);
    rejects(() => parseCreateClasses({ classes: [] }), /non-empty array/);
    rejects(() => one({ user_id: "someone-else" }), /unexpected fields: user_id/);
    rejects(() => one({ name: "  " }), /must not be empty/);
  });
});

describe("weightWarning", () => {
  test("warns, without blocking, when weights don't total 100%", () => {
    assert.equal(weightWarning([]), null);
    assert.equal(weightWarning([{ task_type: "exam", weight: 60 }, { task_type: "quiz", weight: 40 }]), null);
    assert.match(weightWarning([{ task_type: "exam", weight: 60 }, { task_type: "quiz", weight: 30 }])!, /total 90%, not 100%/);
  });
});

describe("findDuplicateClasses", () => {
  const existing = [
    { id: "c1", name: "BIO 101" },
    { id: "c2", name: "World History" },
  ];

  test("matches existing classes by name, ignoring case and extra spaces", () => {
    const { toCreate, alreadyExist } = findDuplicateClasses(
      [{ name: "bio 101" }, { name: "  world   HISTORY " }, { name: "Chemistry" }],
      existing,
    );
    assert.deepEqual(toCreate, [{ name: "Chemistry" }]);
    assert.deepEqual(alreadyExist, [
      { requested: "bio 101", id: "c1", name: "BIO 101" },
      { requested: "  world   HISTORY ", id: "c2", name: "World History" },
    ]);
  });

  test("a name repeated in one request is created once", () => {
    const { toCreate } = findDuplicateClasses([{ name: "Chemistry" }, { name: "chemistry" }], existing);
    assert.deepEqual(toCreate, [{ name: "Chemistry" }]);
  });

  test("similar but different names aren't duplicates", () => {
    const { toCreate } = findDuplicateClasses([{ name: "BIO 102" }, { name: "History" }], existing);
    assert.equal(toCreate.length, 2);
  });
});

describe("classes count toward the 15-change cap", () => {
  test("new classes use up the same budget as tasks", () => {
    const tasks = new Set(Array.from({ length: 12 }, (_, i) => `task-${i}`));
    checkChangeCap(tasks, { newItems: 3 });
    assert.throws(() => checkChangeCap(tasks, { newItems: 4 }), /3 are left/);
  });
});
