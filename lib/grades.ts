// Grade math. This file has no runtime imports so `node --test` can load it
// directly (see grades.test.ts).

export const TASK_TYPES = ["homework", "quiz", "test", "project", "exam", "discussion"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  homework: "Homework",
  quiz: "Quiz",
  test: "Test",
  project: "Project",
  exam: "Exam",
  discussion: "Discussion",
};

export const GRADING_MODES = ["percent", "points"] as const;
export type GradingMode = (typeof GRADING_MODES)[number];

// Highest first. Stored with an ASCII hyphen, e.g. "A-".
export const LETTER_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"] as const;
export type LetterGrade = (typeof LETTER_GRADES)[number];

/** The percentage each letter counts as when averaging. */
export const LETTER_PERCENT: Record<LetterGrade, number> = {
  "A+": 98,
  A: 95,
  "A-": 91,
  "B+": 88,
  B: 85,
  "B-": 81,
  "C+": 78,
  C: 75,
  "C-": 71,
  "D+": 68,
  D: 65,
  "D-": 61,
  F: 50,
};

// Lowest percentage for each letter, on the usual 10-point scale. Every value
// in LETTER_PERCENT maps back to its own letter.
const LETTER_CUTOFFS: [number, LetterGrade][] = [
  [97, "A+"],
  [93, "A"],
  [90, "A-"],
  [87, "B+"],
  [83, "B"],
  [80, "B-"],
  [77, "C+"],
  [73, "C"],
  [70, "C-"],
  [67, "D+"],
  [63, "D"],
  [60, "D-"],
];

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && (TASK_TYPES as readonly string[]).includes(value);
}

export function isLetterGrade(value: unknown): value is LetterGrade {
  return typeof value === "string" && (LETTER_GRADES as readonly string[]).includes(value);
}

export function letterForPercent(percent: number): LetterGrade {
  return LETTER_CUTOFFS.find(([min]) => percent >= min)?.[1] ?? "F";
}

/** "A-" → "A−" for display. */
export function displayLetter(letter: LetterGrade): string {
  return letter.replace("-", "−");
}

export type GradedTask = {
  task_type: TaskType | null;
  max_points: number | null;
  score: number | null;
  letter_grade: LetterGrade | null;
};

/**
 * Points earned and possible for one task, or null if it has no grade.
 * A letter counts as its percentage of max_points, or of 100 when there's no max.
 * A score above max_points is extra credit and is kept as is.
 */
export function taskPoints(task: GradedTask): { earned: number; possible: number } | null {
  if (task.score !== null && task.max_points !== null) {
    return { earned: task.score, possible: task.max_points };
  }
  if (task.letter_grade !== null) {
    const possible = task.max_points ?? 100;
    return { earned: (LETTER_PERCENT[task.letter_grade] / 100) * possible, possible };
  }
  return null;
}

export type ClassAverage = {
  /** Rounded to one decimal place, or null when nothing counts yet. */
  percent: number | null;
  letter: LetterGrade | null;
  /** Graded tasks that have a type, whether or not they counted. */
  gradedCount: number;
  /** Percentage mode only: types with grades but no weight, so they're left out. */
  unweightedTypes: TaskType[];
};

/**
 * The current average for one class.
 *
 * Points mode: total earned ÷ total possible over every graded task.
 *
 * Percentage mode: each type's average is its earned ÷ possible points; those
 * are combined by the type's weight. Only types that have grades (and a weight)
 * count, and the result is divided by the sum of the weights used, so a type
 * with no grades yet doesn't drag the average down.
 */
export function computeClassAverage(
  tasks: GradedTask[],
  mode: GradingMode,
  weights: Partial<Record<TaskType, number>> = {},
): ClassAverage {
  const totals = new Map<TaskType, { earned: number; possible: number }>();
  for (const task of tasks) {
    if (task.task_type === null) continue;
    const points = taskPoints(task);
    if (!points) continue;
    const total = totals.get(task.task_type) ?? { earned: 0, possible: 0 };
    total.earned += points.earned;
    total.possible += points.possible;
    totals.set(task.task_type, total);
  }

  const gradedCount = tasks.filter((t) => t.task_type !== null && taskPoints(t) !== null).length;
  let percent: number | null = null;
  const unweightedTypes: TaskType[] = [];

  if (mode === "points") {
    let earned = 0;
    let possible = 0;
    for (const total of totals.values()) {
      earned += total.earned;
      possible += total.possible;
    }
    if (possible > 0) percent = (earned / possible) * 100;
  } else {
    let weighted = 0;
    let weightUsed = 0;
    for (const [type, total] of totals) {
      const weight = weights[type] ?? 0;
      if (weight <= 0) {
        unweightedTypes.push(type);
        continue;
      }
      weighted += (total.earned / total.possible) * weight;
      weightUsed += weight;
    }
    if (weightUsed > 0) percent = (weighted / weightUsed) * 100;
  }

  unweightedTypes.sort((a, b) => TASK_TYPES.indexOf(a) - TASK_TYPES.indexOf(b));
  if (percent === null) return { percent: null, letter: null, gradedCount, unweightedTypes };
  const rounded = Math.round(percent * 10) / 10;
  // The letter comes from the rounded value so it always matches what's shown.
  return { percent: rounded, letter: letterForPercent(rounded), gradedCount, unweightedTypes };
}

/** Class averages below these percentages are flagged: at risk, or failing. */
export const RISK_THRESHOLDS = { atRisk: 70, failing: 60 } as const;
export type RiskLevel = "failing" | "at-risk";

/** How worried to be about a class's average. Classes with no average yet are never flagged. */
export function riskLevel(average: Pick<ClassAverage, "percent">): RiskLevel | null {
  if (average.percent === null) return null;
  if (average.percent < RISK_THRESHOLDS.failing) return "failing";
  if (average.percent < RISK_THRESHOLDS.atRisk) return "at-risk";
  return null;
}
