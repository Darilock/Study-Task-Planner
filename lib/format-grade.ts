import { displayLetter, taskPoints, type GradedTask } from "./grades";

/** 18.5 → "18.5", 20 → "20". */
export function formatPoints(value: number) {
  return String(Math.round(value * 100) / 100);
}

/** "18/20 (90%)", "A−", or null when the task has no grade. */
export function formatTaskGrade(task: GradedTask) {
  if (task.letter_grade) return displayLetter(task.letter_grade);
  const points = taskPoints(task);
  if (!points) return null;
  const percent = Math.round((points.earned / points.possible) * 1000) / 10;
  return `${formatPoints(points.earned)}/${formatPoints(points.possible)} (${percent}%)`;
}
