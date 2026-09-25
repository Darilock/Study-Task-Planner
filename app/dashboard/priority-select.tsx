import { PRIORITIES, type TaskPriority } from "@/lib/types";
import { PRIORITY_LABELS } from "./priority-badge";

export function PrioritySelect({ name, defaultValue }: { name: string; defaultValue: TaskPriority }) {
  return (
    <select name={name} defaultValue={defaultValue} className="input">
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
