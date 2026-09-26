"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toDateKey } from "@/lib/calendar/dates";
import { describeAction } from "@/lib/agent/describe-actions";
import { ASSISTANT_MESSAGE_MAX_LENGTH } from "@/lib/agent/history";
import {
  AGENT_HISTORY_LIMIT,
  AGENT_INPUT_MAX_LENGTH,
  type AgentAction,
  type AgentResponse,
} from "@/lib/agent/types";

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; actions: AgentAction[]; today: string };

/**
 * What an earlier reply looks like to the model on the next request: its
 * summary plus the changes it made, so "move that to Thursday" has context.
 */
function historyContent(turn: Turn) {
  if (turn.role === "user" || turn.actions.length === 0) return turn.content;
  const lines = turn.actions.flatMap((a) => describeAction(a, turn.today));
  // The server rejects longer replies, so trim rather than break the conversation.
  return `${turn.content}\n\n(Changes made: ${lines.join("; ")})`.slice(0, ASSISTANT_MESSAGE_MAX_LENGTH);
}

export function AgentPanel() {
  const router = useRouter();
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const withMessage: Turn[] = [...conversation, { role: "user", content: trimmed }];
    setConversation(withMessage);
    setMessage("");
    setLoading(true);
    setError(null);

    const restore = (text: string) => {
      // Put the message back so the student can retry it.
      setConversation(conversation);
      setMessage(trimmed);
      setError(text);
    };

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: withMessage
            .slice(-AGENT_HISTORY_LIMIT)
            .map((turn) => ({ role: turn.role, content: historyContent(turn) })),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = (await res.json().catch(() => null)) as AgentResponse | null;

      if (!data || "error" in data) {
        restore(data?.error ?? "Something went wrong. Please try again.");
      } else {
        setConversation([
          ...withMessage,
          { role: "assistant", content: data.summary, actions: data.actions, today: toDateKey(new Date()) },
        ]);
      }
      // Refresh even on error: the agent may have saved some changes first.
      startTransition(() => router.refresh());
    } catch {
      restore("Couldn't reach the planner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setConversation([]);
    setError(null);
    inputRef.current?.focus();
  }

  const remaining = AGENT_INPUT_MAX_LENGTH - message.length;
  const ongoing = conversation.length > 0;

  return (
    <section
      aria-labelledby="agent-heading"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="agent-heading" className="text-sm font-semibold">
            Study planner
          </h2>
          <p className="text-sm text-zinc-500">
            Tell it what&apos;s coming up. It knows your classes and tasks, and adds and schedules work for you.
          </p>
        </div>
        {ongoing && (
          <button
            type="button"
            onClick={startOver}
            disabled={loading}
            className="-mr-2 -mt-2 min-h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            New conversation
          </button>
        )}
      </div>

      {ongoing && (
        <ol aria-label="Conversation" aria-live="polite" className="flex flex-col gap-2">
          {conversation.map((turn, i) =>
            turn.role === "user" ? (
              <li
                key={i}
                className="ml-8 self-end whitespace-pre-line break-words rounded-2xl rounded-br-sm bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                <span className="sr-only">You: </span>
                {turn.content}
              </li>
            ) : (
              <li
                key={i}
                className="mr-8 flex flex-col gap-2 rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <p className="whitespace-pre-line break-words">
                  <span className="sr-only">Planner: </span>
                  {turn.content}
                </p>
                {turn.actions.length > 0 && (
                  <ul aria-label="Changes made" className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                    {turn.actions.flatMap((action) =>
                      describeAction(action, turn.today).map((line, j) => (
                        <li key={`${action.taskId}-${j}`} className="flex gap-2 break-words">
                          <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
                            ✓
                          </span>
                          <span className="min-w-0">{line}</span>
                        </li>
                      )),
                    )}
                  </ul>
                )}
              </li>
            ),
          )}
          {loading && (
            <li className="mr-8 flex items-center gap-2 text-sm text-zinc-500">
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              Looking at your classes and tasks…
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="agent-input" className="sr-only">
          {ongoing ? "Reply to the study planner" : "Message the study planner"}
        </label>
        <textarea
          id="agent-input"
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={AGENT_INPUT_MAX_LENGTH}
          rows={ongoing ? 2 : 3}
          disabled={loading}
          placeholder={
            ongoing
              ? "Reply…"
              : "e.g. Bio quiz on Friday and a history essay due next Tuesday. Plan my week."
          }
          aria-describedby="agent-count"
          className="input resize-y py-2 disabled:opacity-60"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            id="agent-count"
            className={`text-xs ${remaining < 100 ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}
          >
            {remaining} characters left
          </span>
          <button type="submit" disabled={loading || !message.trim()} className="btn-primary gap-2">
            {loading && (
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {loading ? "Planning…" : ongoing ? "Send" : "Plan it"}
          </button>
        </div>
      </form>
    </section>
  );
}
