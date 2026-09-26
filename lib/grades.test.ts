import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  computeClassAverage,
  LETTER_GRADES,
  LETTER_PERCENT,
  letterForPercent,
  riskLevel,
  type GradedTask,
  type LetterGrade,
  type TaskType,
} from "./grades.ts";

function score(task_type: TaskType, earned: number, max: number): GradedTask {
  return { task_type, max_points: max, score: earned, letter_grade: null };
}

function letter(task_type: TaskType, grade: LetterGrade, max: number | null = null): GradedTask {
  return { task_type, max_points: max, score: null, letter_grade: grade };
}

describe("letters", () => {
  test("every letter's percentage converts back to the same letter", () => {
    for (const grade of LETTER_GRADES) {
      assert.equal(letterForPercent(LETTER_PERCENT[grade]), grade);
    }
  });

  test("cutoffs", () => {
    assert.equal(letterForPercent(100), "A+");
    assert.equal(letterForPercent(90), "A-");
    assert.equal(letterForPercent(89.9), "B+");
    assert.equal(letterForPercent(59.9), "F");
    assert.equal(letterForPercent(0), "F");
  });
});

describe("points mode", () => {
  test("sums earned over possible across all graded tasks", () => {
    const result = computeClassAverage([score("homework", 18, 20), score("exam", 70, 100)], "points");
    // 88 / 120
    assert.equal(result.percent, 73.3);
    assert.equal(result.letter, "C");
    assert.equal(result.gradedCount, 2);
  });

  test("letter grades count as their percentage of max points, or of 100", () => {
    const result = computeClassAverage(
      [score("homework", 18, 20), letter("quiz", "B", 10), letter("test", "A")],
      "points",
    );
    // (18 + 8.5 + 95) / (20 + 10 + 100) = 121.5 / 130
    assert.equal(result.percent, 93.5);
    assert.equal(result.letter, "A");
  });

  test("extra credit can push the average over 100%", () => {
    const result = computeClassAverage([score("homework", 12, 10), score("quiz", 10, 10)], "points");
    assert.equal(result.percent, 110);
    assert.equal(result.letter, "A+");
  });

  test("ignores weights", () => {
    const result = computeClassAverage([score("homework", 5, 10), score("exam", 100, 100)], "points", {
      homework: 90,
      exam: 10,
    });
    // 105 / 110
    assert.equal(result.percent, 95.5);
  });
});

describe("percentage mode", () => {
  test("weights each type's points average", () => {
    const result = computeClassAverage(
      [score("homework", 9, 10), score("homework", 8, 10), score("quiz", 45, 50), score("exam", 80, 100)],
      "percent",
      { homework: 20, quiz: 30, exam: 50 },
    );
    // 85% × 20 + 90% × 30 + 80% × 50 = 17 + 27 + 40
    assert.equal(result.percent, 84);
    assert.equal(result.letter, "B");
  });

  test("averages a type by points, not by task", () => {
    const result = computeClassAverage([score("homework", 1, 2), score("homework", 90, 100)], "percent", {
      homework: 40,
    });
    // 91 / 102, not the mean of 50% and 90%
    assert.equal(result.percent, 89.2);
  });

  test("a type with no grades yet is left out and the weights are normalized", () => {
    const result = computeClassAverage(
      [score("homework", 9, 10), score("homework", 8, 10), letter("quiz", "A-", 20)],
      "percent",
      { homework: 20, quiz: 30, exam: 50 },
    );
    // (85% × 20 + 91% × 30) / (20 + 30) = 44.3 / 50
    assert.equal(result.percent, 88.6);
    assert.equal(result.letter, "B+");
  });

  test("letter grades without max points count out of 100", () => {
    const result = computeClassAverage([letter("exam", "C"), score("exam", 45, 50)], "percent", { exam: 100 });
    // (75 + 45) / 150
    assert.equal(result.percent, 80);
  });

  test("extra credit", () => {
    const result = computeClassAverage([score("quiz", 12, 10), score("homework", 8, 10)], "percent", {
      quiz: 50,
      homework: 50,
    });
    assert.equal(result.percent, 100);
    assert.equal(result.letter, "A+");
  });

  test("types with grades but no weight are left out and reported", () => {
    const result = computeClassAverage([score("homework", 10, 10), score("discussion", 0, 10)], "percent", {
      homework: 30,
    });
    assert.equal(result.percent, 100);
    assert.deepEqual(result.unweightedTypes, ["discussion"]);
  });

  test("no average when no graded type has a weight", () => {
    const result = computeClassAverage([score("quiz", 8, 10)], "percent", {});
    assert.equal(result.percent, null);
    assert.equal(result.letter, null);
    assert.equal(result.gradedCount, 1);
    assert.deepEqual(result.unweightedTypes, ["quiz"]);
  });
});

describe("either mode", () => {
  test("no graded tasks means no average", () => {
    for (const mode of ["points", "percent"] as const) {
      const result = computeClassAverage([], mode, { homework: 100 });
      assert.deepEqual(result, { percent: null, letter: null, gradedCount: 0, unweightedTypes: [] });
    }
  });

  test("ignores ungraded tasks and tasks without a type", () => {
    const tasks: GradedTask[] = [
      score("homework", 8, 10),
      { task_type: "homework", max_points: 10, score: null, letter_grade: null },
      { task_type: null, max_points: 10, score: 0, letter_grade: null },
    ];
    assert.equal(computeClassAverage(tasks, "points").percent, 80);
    assert.equal(computeClassAverage(tasks, "percent", { homework: 100 }).gradedCount, 1);
  });

  test("the letter matches the rounded percentage", () => {
    // 89.96% rounds to 90.0%, which is an A−, not a B+.
    const result = computeClassAverage([score("exam", 8996, 10000)], "points");
    assert.equal(result.percent, 90);
    assert.equal(result.letter, "A-");
  });
});

describe("risk levels", () => {
  test("thresholds", () => {
    assert.equal(riskLevel({ percent: 59.9 }), "failing");
    assert.equal(riskLevel({ percent: 60 }), "at-risk");
    assert.equal(riskLevel({ percent: 69.9 }), "at-risk");
    assert.equal(riskLevel({ percent: 70 }), null);
    assert.equal(riskLevel({ percent: 104 }), null);
  });

  test("a class with no grades isn't flagged", () => {
    assert.equal(riskLevel(computeClassAverage([], "points")), null);
  });

  test("uses the computed class average", () => {
    const average = computeClassAverage([score("exam", 55, 100), letter("quiz", "C", 10)], "percent", {
      exam: 50,
      quiz: 50,
    });
    // (55% × 50 + 75% × 50) / 100
    assert.equal(average.percent, 65);
    assert.equal(riskLevel(average), "at-risk");
  });
});
