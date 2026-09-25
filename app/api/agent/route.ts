import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { isValidDate, runTool, tools } from "@/lib/agent/tools";
import { AGENT_INPUT_MAX_LENGTH, type AgentAction, type AgentResponse } from "@/lib/agent/types";

const MAX_ITERATIONS = 8;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

function json(body: AgentResponse, status = 200) {
  return Response.json(body, { status });
}

/**
 * The client sends its local date so "tomorrow" means the student's tomorrow,
 * not the server's. Only trust it if it's within a day of the server's UTC date.
 */
function resolveToday(clientToday: unknown): string {
  const serverToday = new Date().toISOString().slice(0, 10);
  if (typeof clientToday !== "string" || !isValidDate(clientToday)) return serverToday;
  const diffDays =
    Math.abs(Date.parse(`${clientToday}T00:00:00Z`) - Date.parse(`${serverToday}T00:00:00Z`)) / 86_400_000;
  return diffDays <= 1 ? clientToday : serverToday;
}

function systemPrompt(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `You are a study-planning assistant inside a student's task planner. You help them break down coursework into tasks and decide which day to work on each one.

Today is ${weekday}, ${today}. Resolve relative dates ("Friday", "next week", "in 3 days") against today and always pass dates to tools as YYYY-MM-DD.

How to work:
- Call list_tasks first to see what already exists, so you don't create duplicates and can plan around existing work.
- Use create_tasks to add new tasks and schedule_task to plan existing ones. scheduled_for is the day the student will work on a task; it should be on or before the task's due_date and not in the past.
- Spread work out so no single day is overloaded, and leave a buffer before deadlines when you can.
- You cannot delete tasks. If asked to, say so and suggest the student delete them from the list.
- If the request isn't about planning study tasks, briefly say what you can help with instead.

When you're done, reply with a short, friendly summary (2-4 sentences, plain text, no markdown) of what you did and any advice. Don't repeat every task; the app lists your actions separately.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return json({ error: "You need to be logged in." }, 401);

  let body: { message?: unknown; today?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "Tell the planner what you need help with." }, 400);
  if (message.length > AGENT_INPUT_MAX_LENGTH) {
    return json({ error: `Keep your request under ${AGENT_INPUT_MAX_LENGTH} characters.` }, 400);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return json({ error: "The study planner isn't configured yet." }, 500);
  }

  const client = new Anthropic();
  const system = systemPrompt(resolveToday(body.today));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];
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
        const result = await runTool(supabase, block.name, block.input, actions);
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
    const partial = actions.size > 0 ? " Some changes may have been saved." : "";
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: `The planner is busy right now. Try again in a minute.${partial}` }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `The planner is unavailable right now. Please try again.${partial}` }, 502);
    }
    return json({ error: `Something went wrong while planning.${partial}` }, 500);
  }

  return json({
    summary: summary || "Done.",
    actions: [...actions.values()],
  });
}
