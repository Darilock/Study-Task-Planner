# Study Task Planner

A task planner for students. Sign up, add assignments, readings and revision sessions with a subject, due date and time estimate, and track each one from to-do to done.

A built-in study planner agent can do the planning for you. Describe your coursework in plain language ("I have a lab report due Friday and two chapters to read before Tuesday") and it breaks the work into tasks and spreads them across the days before each deadline.

## Features

- Email and password sign-up, login and logout with Supabase Auth, including email confirmation links
- A private task list per user, with a title, subject, due date, estimated minutes, planned day and status (`todo`, `in_progress`, `done`)
- A study planner agent, powered by Claude, that can list, create and schedule your tasks
- Row Level Security in the database, so every query, including the agent's, can only reach the signed-in user's own tasks

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) with React 19 and TypeScript
- [Supabase](https://supabase.com) for Postgres and auth, via `@supabase/ssr`
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) for the planner agent
- Tailwind CSS 4

## Requirements

- Node.js 24 or newer
- A Supabase project
- An Anthropic API key, needed only for the planner agent

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up the database. In the Supabase dashboard, open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). It creates the `tasks` table, its index and its Row Level Security policies.

3. Configure environment variables. Copy the example file and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Required | Description |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your project URL, from **Project Settings → API** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The project's anon (publishable) key |
   | `ANTHROPIC_API_KEY` | For the agent | Your Anthropic API key. Without it the rest of the app works, but the planner replies that it isn't configured. |
   | `ANTHROPIC_MODEL` | No | The Claude model the agent uses. Defaults to `claude-haiku-4-5`. |

4. Configure auth redirects. In **Authentication → URL Configuration**, set the Site URL to where the app runs (for example `http://localhost:3000`) and add `http://localhost:3000/auth/callback` to the redirect URLs, so email confirmation links come back to the app.

   If you turn off **Confirm email** in the Email provider settings, new users are signed in straight after sign-up.

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## The study planner agent

The agent lives at `POST /api/agent` ([`app/api/agent/route.ts`](app/api/agent/route.ts)). The dashboard sends it the student's message along with their local date, so "tomorrow" means the student's tomorrow. The agent then runs a tool-use loop with Claude, capped at 8 steps. It has three tools, defined in [`lib/agent/tools.ts`](lib/agent/tools.ts):

- `list_tasks`: read the student's current tasks
- `create_tasks`: add up to 20 tasks at once
- `schedule_task`: set or clear the day a task is planned for

The server validates every tool input before it reaches the database. The agent can't delete tasks. When it finishes, it returns a short summary, and the dashboard lists every task it created or scheduled.

## Project structure

```
app/
  api/agent/        Planner agent API route
  auth/             Auth server actions and the email confirmation callback
  dashboard/        Task list, add-task form, agent panel and task actions
  login/, signup/   Auth pages
components/         Shared UI (the auth form)
lib/
  agent/            Agent tool definitions, validation and shared types
  supabase/         Supabase clients for the browser, the server and the proxy
supabase/
  schema.sql        Full database schema for a new project
  migrations/       Changes for databases created from an older schema
proxy.ts            Refreshes the session and keeps signed-out users out of /dashboard
```

## Upgrading an existing database

`supabase/schema.sql` always describes the current schema, so a new project needs only that file. If your database was created before the planned-day feature, run [`supabase/migrations/20260924000000_add_scheduled_for_to_tasks.sql`](supabase/migrations/20260924000000_add_scheduled_for_to_tasks.sql) to add the `scheduled_for` column. Don't run it on a database created from the current `schema.sql`, because the column already exists there.
