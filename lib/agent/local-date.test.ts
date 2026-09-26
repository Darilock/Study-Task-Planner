import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { localDateInZone, resolveTimeZone } from "./local-date.ts";

describe("resolveTimeZone", () => {
  test("accepts real IANA zones", () => {
    assert.equal(resolveTimeZone("America/New_York"), "America/New_York");
    assert.equal(resolveTimeZone("Asia/Kolkata"), "Asia/Kolkata");
    assert.equal(resolveTimeZone("UTC"), "UTC");
  });

  test("falls back to UTC for anything else", () => {
    assert.equal(resolveTimeZone("Mars/Olympus_Mons"), "UTC");
    assert.equal(resolveTimeZone(""), "UTC");
    assert.equal(resolveTimeZone(undefined), "UTC");
    assert.equal(resolveTimeZone(42), "UTC");
    assert.equal(resolveTimeZone("A".repeat(200)), "UTC");
  });
});

describe("localDateInZone", () => {
  test("10 PM in New York is still that day there, though UTC has moved on", () => {
    // 10 PM EDT on Friday 2026-09-25 is 02:00 UTC on Saturday the 26th.
    const now = new Date("2026-09-26T02:00:00Z");
    assert.deepEqual(localDateInZone(now, "America/New_York"), { date: "2026-09-25", weekday: "Friday" });
    assert.deepEqual(localDateInZone(now, "UTC"), { date: "2026-09-26", weekday: "Saturday" });
  });

  test("zones ahead of UTC can already be on the next day", () => {
    // 20:00 UTC on Friday is 05:00 Saturday in Tokyo.
    const now = new Date("2026-09-25T20:00:00Z");
    assert.deepEqual(localDateInZone(now, "Asia/Tokyo"), { date: "2026-09-26", weekday: "Saturday" });
  });

  test("handles a daylight saving change", () => {
    // 11:30 PM Saturday Oct 31 in New York (EDT), just before clocks fall back.
    assert.deepEqual(localDateInZone(new Date("2026-11-01T03:30:00Z"), "America/New_York"), {
      date: "2026-10-31",
      weekday: "Saturday",
    });
  });
});
