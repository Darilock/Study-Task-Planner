import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runTool, tools } from "@/lib/agent/tools";
import { MAX_TASK_CHANGES_PER_REQUEST } from "@/lib/agent/validation";
import { localDateInZone, resolveTimeZone } from "@/lib/agent/local-date";
import { parseHistory } from "@/lib/agent/history";
import type { AgentAction, AgentResponse } from "@/lib/agent/types";

const MAX_ITERATIONS = 12;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

/** Tasks show on the Calendar (and its This Week box), the Planner and Classes & Grades. */
function revalidateChangedPages(actions: Map<string, AgentAction>) {
  if (actions.size === 0) return;
  revalidatePath("/calendar");
  revalidatePath("/planner");
  revalidatePath("/classes");
}

function json(body: AgentResponse, status = 200) {
  return Response.json(body, { status });
}

function systemPrompt(today: string, weekday: string, timeZone: string) {
  return `You are the study planner inside a student's planning app. You help them turn coursework into tasks and decide which day to work on each one. You can see their classes (meeting times, grading and current averages) and their tasks.

Today is ${weekday}, ${today} in the student's time zone (${timeZone}). Resolve relative dates ("Friday", "next week", "in 3 days") against today, and always pass dates to tools as YYYY-MM-DD.

How to work:
- Start with list_classes and list_tasks so you know their classes, what already exists, and what's planned. Don't create duplicates.
- Match what the student says to their existing classes ("bio", "chem lab", "Dr. Rivera's class"). If it could mean more than one class, or none of them, ask one short clarifying question instead of guessing. Never invent a class; if they mention one that doesn't exist, suggest adding it on the Classes & Grades tab.
- Graded work (homework, quiz, test, project, exam, discussion) gets its task_type and class. Study sessions are ungraded tasks: no task_type, titled "Study: …", with the class set.
- For exams and projects, also create several "Study: …" sessions with scheduled_for dates spread across the days before the due date. Size the number of sessions and their estimated minutes to the work.
- Never schedule anything in the past or after its due date.
- Balance the load: put lighter study on days with more class time (list_classes gives minutes of class per weekday), avoid piling several sessions onto one day, and leave a buffer before deadlines when you can.
- Put Extreme and High priority work first, and give extra time to classes marked at_risk or failing.
- Use update_task to move or re-prioritize existing work. It can't change grades or completed tasks, and you can't delete tasks: if asked, say so and suggest deleting from the Planner.
- One request can create or update at most ${MAX_TASK_CHANGES_PER_REQUEST} tasks in total. If more is needed, do the most important ones and say what's left.
- Stay on topic. If the request isn't about planning their studies, say briefly what you can help with.

When you're done, reply with a short, friendly summary (2-4 sentences, plain text, no markdown) of what you did and any advice. Don't list every task; the app shows your changes separately. If you need an answer from the student first, just ask the question.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return json({ error: "You need to be logged in." }, 401);

  let body: { messages?: unknown; timeZone?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // The panel sends the recent conversation, ending with the new message.
  const history = parseHistory(body.messages);
  if ("error" in history) return json({ error: history.error }, 400);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return json({ error: "The study planner isn't configured yet." }, 500);
  }

  const client = new Anthropic();
  // The client sends its IANA time zone so "today" and "tomorrow" are the
  // student's, not the server's.
  const timeZone = resolveTimeZone(body.timeZone);
  const { date: today, weekday } = localDateInZone(new Date(), timeZone);
  const system = systemPrompt(today, weekday, timeZone);
  const messages: Anthropic.MessageParam[] = history.messages.map((m) => ({ role: m.role, content: m.content }));
  const actions = new Map<string, AgentAction>();
  let summary = "";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system,
        tools,
        messages,
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) summary = text;

      if (response.stop_reason === "refusal") {
        return json({ error: "The planner couldn't help with that request." }, 422);
      }
      if (response.stop_reason !== "tool_use") break;

      messages.push({ role: "assistant", content: response.content });

      // All results go back in a single user message.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await runTool(supabase, block.name, block.input, actions, { today });
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.content,
          is_error: result.isError,
        });
      }
      messages.push({ role: "user", content: results });

      if (i === MAX_ITERATIONS - 1) {
        summary = "I ran out of steps before finishing. Here's what I got done — try a smaller request for the rest.";
      }
    }
  } catch (e) {
    console.error("Agent run failed", e);
    revalidateChangedPages(actions);
    const partial = actions.size > 0 ? " Some changes may have been saved." : "";
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: `The planner is busy right now. Try again in a minute.${partial}` }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `The planner is unavailable right now. Please try again.${partial}` }, 502);
    }
    return json({ error: `Something went wrong while planning.${partial}` }, 500);
  }

  revalidateChangedPages(actions);
  return json({
    summary: summary || "Done.",
    actions: [...actions.values()],
  });
}
