import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asDate,
  asObject,
  asString,
  asUuid,
  parseCreateTasks,
  parseListTasks,
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

describe("parseCreateTasks", () => {
  test("fills defaults and nulls", () => {
    assert.deepEqual(parseCreateTasks({ tasks: [{ title: "Read ch. 5" }] }), [
      {
        title: "Read ch. 5",
        description: null,
        subject: null,
        due_date: null,
        estimated_minutes: null,
        scheduled_for: null,
        priority: "medium",
      },
    ]);
  });

  test("rejects empty lists, bad fields and fields it can't set", () => {
    rejects(() => parseCreateTasks({ tasks: [] }), /non-empty array/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", priority: "urgent" }] }), /priority must be one of/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", estimated_minutes: 0 }] }), /between 1 and 10000/);
    rejects(() => parseCreateTasks({ tasks: [{ title: "x", status: "done" }] }), /unexpected fields: status/);
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
