"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toDateKey } from "@/lib/calendar/dates";
import { describeAction } from "@/lib/agent/describe-actions";
import {
  AGENT_INPUT_MAX_LENGTH,
  type AgentAction,
  type AgentResponse,
} from "@/lib/agent/types";

type Result = { summary: string; actions: AgentAction[] };

const localToday = () => toDateKey(new Date());


export function AgentPanel() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [today, setToday] = useState(localToday);
  const [, startTransition] = useTransition();

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const now = localToday();
    setToday(now);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = (await res.json().catch(() => null)) as AgentResponse | null;

      if (!data || "error" in data) {
        setError(data?.error ?? "Something went wrong. Please try again.");
      } else {
        setResult(data);
        setMessage("");
      }
      // Refresh even on error: the agent may have saved some changes first.
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn't reach the planner. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const remaining = AGENT_INPUT_MAX_LENGTH - message.length;

  return (
    <section
      aria-labelledby="agent-heading"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="agent-input" className="flex flex-col gap-0.5">
          <span id="agent-heading" className="text-sm font-semibold">
            Study planner
          </span>
          <span className="text-sm text-zinc-500">
            Describe what&apos;s coming up and it will add and schedule tasks for you.
          </span>
        </label>
        <textarea
          id="agent-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={AGENT_INPUT_MAX_LENGTH}
          rows={3}
          disabled={loading}
          placeholder="e.g. Bio chapter 5 quiz on Friday and a history essay due next Tuesday. Plan my week."
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
            {loading ? "Planning…" : "Plan it"}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="empty:hidden">
        {loading && <p className="text-sm text-zinc-500">Looking at your tasks and making a plan…</p>}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
            <p className="whitespace-pre-line break-words">{result.summary}</p>
            {result.actions.length > 0 && (
              <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
                {result.actions.flatMap((action) =>
                  describeAction(action, today).map((line, i) => (
                    <li key={`${action.taskId}-${i}`} className="flex gap-2 break-words">
                      <span aria-hidden className="text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                      <span className="min-w-0">{line}</span>
                    </li>
                  )),
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
