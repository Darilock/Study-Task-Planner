// Validates the conversation the panel sends with each request. The client
// holds the conversation, so treat every message as untrusted input.
import { AGENT_HISTORY_LIMIT, AGENT_INPUT_MAX_LENGTH } from "./types.ts";

/** Earlier assistant replies are echoed back by the client; cap them too. */
export const ASSISTANT_MESSAGE_MAX_LENGTH = 4000;

export type HistoryMessage = { role: "user" | "assistant"; content: string };

/**
 * The last AGENT_HISTORY_LIMIT messages, ending with the student's new
 * message. Anything malformed is rejected with a message for the student.
 */
export function parseHistory(value: unknown): { messages: HistoryMessage[] } | { error: string } {
  if (!Array.isArray(value) || value.length === 0) return { error: "Tell the planner what you need help with." };

  const messages: HistoryMessage[] = [];
  for (const raw of value.slice(-AGENT_HISTORY_LIMIT)) {
    if (typeof raw !== "object" || raw === null) return { error: "Invalid conversation." };
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { error: "Invalid conversation." };
    }
    const text = content.trim();
    if (!text) return { error: "Invalid conversation." };
    const limit = role === "user" ? AGENT_INPUT_MAX_LENGTH : ASSISTANT_MESSAGE_MAX_LENGTH;
    if (text.length > limit) {
      return {
        error:
          role === "user"
            ? `Keep each message under ${AGENT_INPUT_MAX_LENGTH} characters.`
            : "Invalid conversation.",
      };
    }
    messages.push({ role, content: text });
  }

  // The API needs the conversation to start with the student; trimming to the
  // limit can leave an assistant reply first.
  while (messages[0]?.role === "assistant") messages.shift();
  if (messages.at(-1)?.role !== "user") return { error: "Tell the planner what you need help with." };
  return { messages };
}
