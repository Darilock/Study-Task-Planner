import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asDate,
  checkChangeCap,
  checkTaskUpdate,
  MAX_TASK_CHANGES_PER_REQUEST,
  asObject,
  asString,
  asUuid,
  parseCreateTasks,
  parseListTasks,
  parseUpdateTask,
  ToolInputError,
} from "./validation.ts";

const CLASS_ID = "0b0f8e2c-3c55-4b8e-9a39-2b1d7a5f6c11";

const rejects = (fn: () => unknown, message: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof ToolInputError && message.test(e.message));

describe("basic checks", () => {
  test("objects reject unexpected fields", () => {
    rejects(() => asObject({ a: 1, user_id: "x" }, ["a"]), /unexpected fields: user_id/);
    rejects(() => asObject([], ["a"]), /must be an object/);
    rejects(() => asObject(null, ["a"]), /must be an object/);
  });

  test("strings are trimmed, non-empty and length-capped", () => {
    assert.equal(asString("  Quiz 3 ", "title", 200), "Quiz 3");
    rejects(() => asString("   ", "title", 200), /must not be empty/);
    rejects(() => asString("x".repeat(201), "title", 200), /200 characters or fewer/);
    rejects(() => asString(5, "title", 200), /must be a string/);
  });

  test("dates must be real calendar dates", () => {
    assert.equal(asDate("2026-10-01", "due_date"), "2026-10-01");
    rejects(() => asDate("2026-02-30", "due_date"), /real date/);
    rejects(() => asDate("10/01/2026", "due_date"), /real date/);
    rejects(() => asDate("1999-12-31", "due_date"), /out of range/);
  });

  test("ids must be UUIDs", () => {
    assert.equal(asUuid("0b0f8e2c-3c55-4b8e-9a39-2b1d7a5f6c11", "id", "list_tasks"), "0b0f8e2c-3c55-4b8e-9a39-2b1d7a5f6c11");
    rejects(() => asUuid("1; drop table tasks", "id", "list_tasks"), /id from list_tasks/);
  });
});

const TODAY = "2026-09-25";

describe("parseCreateTasks", () => {
  test("fills defaults and nulls", () => {
    assert.deepEqual(parseCreateTasks({ tasks: [{ title: "Read ch. 5" }] }, TODAY), [
      {
        title: "Read ch. 5",
        description: null,
        subject: null,
        class_id: null,
        task_type: null,
        max_points: null,
        due_date: null,
        estimated_minutes: null,
        scheduled_for: null,
        priority: "medium",
      },
    ]);
  });

  test("accepts a graded task with a class, and an ungraded study session for it", () => {
    const [quiz, study] = parseCreateTasks(
      {
        tasks: [
          { title: "Quiz 3", class_id: CLASS_ID, task_type: "quiz", max_points: 20, due_date: "2026-10-01", priority: "high" },
          { title: "Study: Quiz 3", class_id: CLASS_ID, scheduled_for: "2026-09-29", due_date: "2026-10-01", estimated_minutes: 45 },
        ],
      },
      TODAY,
    );
    assert.equal(quiz.task_type, "quiz");
    assert.equal(quiz.max_points, 20);
    assert.equal(study.task_type, null);
    assert.equal(study.scheduled_for, "2026-09-29");
  });

  test("graded work needs a class, and only graded work has max points", () => {
    rejects(() => parseCreateTasks({ tasks: [{ title: "Exam 1", task_type: "exam" }] }, TODAY), /needs a class_id/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "Read", max_points: 10 }] }, TODAY), /only for graded work/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", class_id: CLASS_ID, task_type: "midterm" }] }, TODAY), /task_type must be one of/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", class_id: CLASS_ID, task_type: "quiz", max_points: -5 }] }, TODAY), /above 0/);
  });

  test("never schedules in the past or after the due date", () => {
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", scheduled_for: "2026-09-24" }] }, TODAY), /can't be in the past/);
    rejects(
      () => parseCreateTasks({ tasks: [{ title: "x", due_date: "2026-09-28", scheduled_for: "2026-09-29" }] }, TODAY),
      /on or before the due date/,
    );
    // Today itself and the due date itself are fine.
    assert.equal(parseCreateTasks({ tasks: [{ title: "x", scheduled_for: TODAY }] }, TODAY)[0].scheduled_for, TODAY);
    assert.equal(
      parseCreateTasks({ tasks: [{ title: "x", due_date: "2026-09-28", scheduled_for: "2026-09-28" }] }, TODAY)[0].scheduled_for,
      "2026-09-28",
    );
  });

  test("rejects empty lists, too many tasks, bad fields and fields it can't set", () => {
    rejects(() => parseCreateTasks({ tasks: [] }, TODAY), /non-empty array/);
    const sixteen = Array.from({ length: 16 }, (_, i) => ({ title: `Task ${i}` }));
    rejects(() => parseCreateTasks({ tasks: sixteen }, TODAY), /at most 15/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", priority: "urgent" }] }, TODAY), /priority must be one of/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", estimated_minutes: 0 }] }, TODAY), /between 1 and 10000/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", status: "done" }] }, TODAY), /unexpected fields: status/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", score: 20 }] }, TODAY), /unexpected fields: score/);
  });
});

describe("parseListTasks", () => {
  test("defaults to open tasks with no other filters", () => {
    assert.deepEqual(parseListTasks({}), { from: null, to: null, classId: null, status: "open" });
    assert.deepEqual(parseListTasks(undefined), { from: null, to: null, classId: null, status: "open" });
  });

  test("accepts a date range, a class or no class, and a status", () => {
    assert.deepEqual(parseListTasks({ from: "2026-09-27", to: "2026-10-03", class_id: CLASS_ID, status: "all" }), {
      from: "2026-09-27",
      to: "2026-10-03",
      classId: CLASS_ID,
      status: "all",
    });
    assert.equal(parseListTasks({ class_id: "none" }).classId, "none");
  });

  test("rejects backwards ranges, bad ids and unknown statuses", () => {
    rejects(() => parseListTasks({ from: "2026-10-03", to: "2026-09-27" }), /on or after from/);
    rejects(() => parseListTasks({ class_id: "Biology" }), /id from list_classes/);
    rejects(() => parseListTasks({ status: "overdue" }), /status must be one of/);
    rejects(() => parseListTasks({ include_done: true }), /unexpected fields/);
  });
});

const TASK_ID = "5d9c7a1e-8f2b-4c3d-9e4f-1a2b3c4d5e6f";

describe("parseUpdateTask", () => {
  test("takes only the fields it may change", () => {
    assert.deepEqual(parseUpdateTask({ id: TASK_ID, scheduled_for: "2026-09-30", priority: "high" }), {
      id: TASK_ID,
      update: { scheduled_for: "2026-09-30", priority: "high" },
    });
    // null clears a field.
    assert.deepEqual(parseUpdateTask({ id: TASK_ID, scheduled_for: null }).update, { scheduled_for: null });
  });

  test("can never touch grades, status, type or class", () => {
    for (const field of ["score", "letter_grade", "graded_at", "status", "task_type", "class_id", "max_points", "title"]) {
      rejects(() => parseUpdateTask({ id: TASK_ID, [field]: "x" }), new RegExp(`unexpected fields: ${field}`));
    }
  });

  test("needs an id and at least one change", () => {
    rejects(() => parseUpdateTask({ scheduled_for: "2026-09-30" }), /id must be an id/);
    rejects(() => parseUpdateTask({ id: TASK_ID }), /at least one field/);
    rejects(() => parseUpdateTask({ id: TASK_ID, priority: null }), /priority must be one of/);
  });
});

describe("checkTaskUpdate", () => {
  const open = { status: "todo", due_date: "2026-10-01", scheduled_for: null };

  test("completed tasks are never changed", () => {
    rejects(() => checkTaskUpdate({ ...open, status: "done" }, { priority: "low" }, TODAY), /completed tasks can't be changed/);
  });

  test("a new study day must be today or later and not after the due date", () => {
    checkTaskUpdate(open, { scheduled_for: "2026-09-30" }, TODAY);
    rejects(() => checkTaskUpdate(open, { scheduled_for: "2026-09-20" }, TODAY), /can't be in the past/);
    rejects(() => checkTaskUpdate(open, { scheduled_for: "2026-10-02" }, TODAY), /on or before the due date/);
    // Checked against the new due date when both change.
    checkTaskUpdate(open, { due_date: "2026-10-05", scheduled_for: "2026-10-04" }, TODAY);
  });

  test("moving the due date before the planned day needs the planned day moved too", () => {
    const planned = { ...open, scheduled_for: "2026-09-30" };
    rejects(() => checkTaskUpdate(planned, { due_date: "2026-09-29" }, TODAY), /Move scheduled_for too/);
    checkTaskUpdate(planned, { due_date: "2026-09-29", scheduled_for: "2026-09-28" }, TODAY);
  });

  test("an old planned day doesn't block unrelated changes", () => {
    checkTaskUpdate({ ...open, scheduled_for: "2026-09-01" }, { priority: "extreme" }, TODAY);
  });
});

describe("the 15-task cap per request", () => {
  const ids = (n: number) => new Set(Array.from({ length: n }, (_, i) => `task-${i}`));

  test("is 15 tasks created or updated, combined", () => {
    assert.equal(MAX_TASK_CHANGES_PER_REQUEST, 15);
    checkChangeCap(ids(0), { newTasks: 15 });
    checkChangeCap(ids(10), { newTasks: 5 });
    rejects(() => checkChangeCap(ids(10), { newTasks: 6 }), /at most 15 tasks in total, and 5 are left/);
  });

  test("updating a new task counts once; updating the same task again is free", () => {
    checkChangeCap(ids(14), { taskId: "another" });
    rejects(() => checkChangeCap(ids(15), { taskId: "another" }), /0 are left/);
    checkChangeCap(ids(15), { taskId: "task-3" });
  });
});
