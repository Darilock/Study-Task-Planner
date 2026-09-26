// Shared between the agent route and the planner panel.

export const AGENT_INPUT_MAX_LENGTH = 1000;
/** Messages of conversation history sent with each request, including the new one. */
export const AGENT_HISTORY_LIMIT = 10;

export type TaskChange = {
  field: "priority" | "description" | "due_date" | "scheduled_for" | "estimated_minutes";
  from: string | number | null;
  to: string | number | null;
};

export type AgentAction =
  | {
      kind: "created";
      taskId: string;
      title: string;
      className: string | null;
      dueDate: string | null;
      scheduledFor: string | null;
    }
  | {
      kind: "updated";
      taskId: string;
      title: string;
      className: string | null;
      changes: TaskChange[];
    }
  | {
      kind: "created_class";
      classId: string;
      name: string;
      /** e.g. "MWF 10:00–10:50 AM", or null with no meeting times. */
      schedule: string | null;
    };

/** A stable key for an action (tasks and classes have separate ids). */
export function actionKey(action: AgentAction) {
  return action.kind === "created_class" ? action.classId : action.taskId;
}

export type AgentResponse =
  | { summary: string; actions: AgentAction[] }
  | { error: string };
