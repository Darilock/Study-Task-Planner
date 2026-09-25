import { formatTerm } from "@/lib/format";
import { formatSchedule } from "@/lib/schedule";
import type { SchoolClass } from "@/lib/types";

export function ClassDetails({ schoolClass }: { schoolClass: SchoolClass }) {
  const schedule = formatSchedule(schoolClass.class_meetings);
  const term = formatTerm(schoolClass.start_date, schoolClass.end_date);
  const people = [schoolClass.instructor, schoolClass.location].filter(Boolean).join(" · ");

  return (
    <div className="min-w-0 flex-1 py-1.5">
      <h3 className="flex items-center gap-2 break-words font-semibold">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700"
          style={schoolClass.color ? { backgroundColor: schoolClass.color, borderColor: schoolClass.color } : undefined}
        />
        <span className="min-w-0">{schoolClass.name}</span>
      </h3>
      {schedule.length > 0 ? (
        <ul className="mt-1 text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
          {schedule.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">No meeting times</p>
      )}
      {people && <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-400">{people}</p>}
      {term && <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{term}</p>}
    </div>
  );
}
