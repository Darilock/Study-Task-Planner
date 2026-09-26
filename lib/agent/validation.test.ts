import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { asDate, asObject, asString, asUuid, parseCreateTasks, ToolInputError } from "./validation.ts";

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
