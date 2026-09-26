// Plain-language lines for what the agent did, e.g. "Created: Quiz 3 (Bio), due Thu"
// or "Moved: History essay → study Wed". Local imports use .ts extensions for `node --test`.
import { differenceInCalendarDays } from "date-fns";
import { formatDateKey, parseLocalDate } from "../calendar/dates.ts";
import { PRIORITY_NAMES } from "../types.ts";
import type { AgentAction, TaskChange } from "./types.ts";

/** "today", "tomorrow", "Thu" within the next week, otherwise "Thu, Oct 8". Dates are local calendar dates. */
export function describeDay(date: string, today: string) {
  const days = differenceInCalendarDays(parseLocalDate(date), parseLocalDate(today));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 7) return formatDateKey(date, "EEE");
  return formatDateKey(date, "EEE, MMM d");
}

function describeChange(change: TaskChange, title: string, today: string) {
  const to = change.to;
  switch (change.field) {
    case "scheduled_for":
      return typeof to === "string" ? `Moved: ${title} → study ${describeDay(to, today)}` : `Unscheduled: ${title}`;
    case "due_date":
      return typeof to === "string" ? `Due date: ${title} → ${describeDay(to, today)}` : `No due date: ${title}`;
    case "priority":
      return `Priority: ${title} → ${PRIORITY_NAMES[to as keyof typeof PRIORITY_NAMES] ?? to}`;
    case "estimated_minutes":
      return typeof to === "number" ? `Estimate: ${title} → ${to} min` : `No estimate: ${title}`;
    case "description":
      return `Updated notes: ${title}`;
  }
}

/** One or more lines per action: a created task is one line, an update is one line per changed field. */
export function describeAction(action: AgentAction, today: string): string[] {
  const title = action.className ? `${action.title} (${action.className})` : action.title;
  if (action.kind === "created") {
    const parts = [`Created: ${title}`];
    if (action.dueDate) parts.push(`due ${describeDay(action.dueDate, today)}`);
    if (action.scheduledFor) parts.push(`study ${describeDay(action.scheduledFor, today)}`);
    return [parts.join(", ")];
  }
  return action.changes.map((change) => describeChange(change, action.title, today));
}
