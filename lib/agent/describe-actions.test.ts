import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { describeAction } from "./describe-actions.ts";

// Friday.
const TODAY = "2026-09-25";

describe("describeAction", () => {
  test("created tasks name the class and the days", () => {
    assert.deepEqual(
      describeAction(
        { kind: "created", taskId: "a", title: "Quiz 3", className: "Bio", dueDate: "2026-10-01", scheduledFor: null },
        TODAY,
      ),
      ["Created: Quiz 3 (Bio), due Thu"],
    );
    assert.deepEqual(
      describeAction(
        { kind: "created", taskId: "b", title: "Study: Quiz 3", className: null, dueDate: null, scheduledFor: "2026-09-26" },
        TODAY,
      ),
      ["Created: Study: Quiz 3, study tomorrow"],
    );
  });

  test("updates get one line per change", () => {
    assert.deepEqual(
      describeAction(
        {
          kind: "updated",
          taskId: "c",
          title: "History essay",
          className: "History",
          changes: [
            { field: "scheduled_for", from: null, to: "2026-09-30" },
            { field: "priority", from: "medium", to: "high" },
          ],
        },
        TODAY,
      ),
      ["Moved: History essay → study Wed", "Priority: History essay → High"],
    );
  });

  test("days further out include the date", () => {
    assert.deepEqual(
      describeAction(
        { kind: "updated", taskId: "d", title: "Lab report", className: null, changes: [{ field: "due_date", from: null, to: "2026-10-09" }] },
        TODAY,
      ),
      ["Due date: Lab report → Fri, Oct 9"],
    );
  });
});
