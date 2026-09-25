// Shared between the agent route and the dashboard panel.

export const AGENT_INPUT_MAX_LENGTH = 1000;

export type AgentAction = {
  kind: "created" | "scheduled";
  taskId: string;
  title: string;
  scheduledFor: string | null;
};

export type AgentResponse =
  | { summary: string; actions: AgentAction[] }
  | { error: string };
