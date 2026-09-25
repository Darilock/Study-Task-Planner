import { displayLetter, TASK_TYPE_LABELS, type ClassAverage, type GradingMode } from "@/lib/grades";

type Props = { average: ClassAverage; mode: GradingMode; size?: "sm" | "lg" };

/** A class's average as "92.4%" plus its letter, or why there isn't one yet. */
export function ClassAverageDisplay({ average, mode, size = "sm" }: Props) {
  const unweighted = average.unweightedTypes.map((t) => TASK_TYPE_LABELS[t]).join(", ");

  if (average.percent === null || average.letter === null) {
    const message =
      average.gradedCount === 0
        ? "No grades yet"
        : "Add weights for your graded types to see an average";
    return <p className="text-sm text-zinc-500">{message}</p>;
  }

  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="sr-only">Current average: </span>
        <span className={`font-semibold tabular-nums ${size === "lg" ? "text-2xl" : "text-base"}`}>
          {average.percent}%
        </span>
        <span
          className={`rounded-md bg-zinc-900 px-1.5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 ${
            size === "lg" ? "text-base" : "text-sm"
          }`}
        >
          {displayLetter(average.letter)}
        </span>
        <span className="text-xs text-zinc-500">
          {average.gradedCount} graded · {mode === "points" ? "by points" : "weighted"}
        </span>
      </p>
      {unweighted && (
        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
          Not counted (no weight set): {unweighted}
        </p>
      )}
    </div>
  );
}
