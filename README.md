# Study Task Planner

A task planner for students. Sign up, add assignments, readings and revision sessions with a subject, due date and time estimate, and track each one from to-do to done.

A built-in study planner agent can do the planning for you. Describe your coursework in plain language ("I have a lab report due Friday and two chapters to read before Tuesday") and it breaks the work into tasks and spreads them across the days before each deadline.

## Pages

The app has three tabs, in the header on wide screens and in a bar at the bottom of the screen on phones:

- **Calendar** (`/calendar`, the home page after logging in): month, week and agenda views of tasks and class meetings, with a **This Week** box at the top listing overdue tasks, tasks due by Saturday and courses at risk
- **Planner** (`/planner`): the task list with sorting, the add and edit task forms, grade entry and the study planner agent
- **Classes & Grades** (`/classes`): an overview of every class's average, then each class with its details, meeting times, grading mode and weights, current average and graded work

`/dashboard` redirects to the Calendar and `/grades` to Classes & Grades, so old links keep working.

## Features

- Email and password sign-up, login and logout with Supabase Auth, including email confirmation links
- A private task list per user, with a title, optional description, subject, due date, estimated minutes, planned day, priority (`low`, `medium`, `high`, `extreme`) and status (`todo`, `in_progress`, `done`)
- Classes with an instructor, location, color, term dates and weekly meeting times, shown as a compact schedule such as "MWF 10:00–10:50 AM". Tasks can optionally belong to a class
- Grading: give a task a type (homework, quiz, test, project, exam or discussion) and max points, then enter a score or a letter grade once it's due. Each class is graded by weighted percentages or by total points, and the Classes & Grades tab shows each class's current average as a percentage and a letter. Classes below 70% are flagged as at risk, and below 60% as failing, on the Calendar
- A calendar with month, week and agenda views. Tasks show on their due date and, as a study session, on their planned day; class meetings repeat weekly within each class's term. Filter by class or hide completed tasks, tap a task to edit or grade it, and tap a day to add a task due that day
- A study planner agent, powered by Claude, that knows your classes, grades and tasks, and creates and reschedules tasks for you in a conversation
- Row Level Security in the database, so every query, including the agent's, can only reach the signed-in user's own tasks and classes

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Server Actions) with React 19 and TypeScript
- [Supabase](https://supabase.com) for Postgres and auth, via `@supabase/ssr`
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) for the planner agent
- Tailwind CSS 4
- [date-fns](https://date-fns.org) for calendar date math

## Requirements

- Node.js 24 or newer
- A Supabase project
- An Anthropic API key, needed only for the planner agent

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up the database. In the Supabase dashboard, open the SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). It creates the `classes`, `class_meetings`, `class_weights` and `tasks` tables, their indexes and their Row Level Security policies.

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
| `npm test` | Run the unit tests with Node's built-in test runner |

## The study planner agent

The agent lives at `POST /api/agent` ([`app/api/agent/route.ts`](app/api/agent/route.ts)) and is used from the panel on the Planner tab. It's a conversation: the panel keeps the current conversation and sends the last 10 messages with each request (each student message is capped at 1,000 characters). **New conversation** starts over.

**Dates.** The panel also sends the browser's IANA time zone (for example `America/New_York`). The server validates it, falling back to UTC, and works out the student's local date and weekday for the system prompt ([`lib/agent/local-date.ts`](lib/agent/local-date.ts)). So at 10 PM on a Friday in New York, "tomorrow" means Saturday.

**Tools.** Each request runs a tool-use loop with Claude, capped at 12 steps. The tools are defined in [`lib/agent/tools.ts`](lib/agent/tools.ts):

| Tool | What it does |
| --- | --- |
| `list_classes` | Each class with its meeting times and minutes of class per weekday, grading mode and weights, current average and letter, and status (`failing`, `at_risk`, `on_track` or `no_average`, using the same thresholds as the Calendar) |
| `list_tasks` | Tasks with their type, priority, class, due and planned dates, estimated minutes, status and whether they're graded. Optional filters: date range, class, status (defaults to everything not done) |
| `create_tasks` | New tasks with a title, class, type, priority, description, max points, due date, planned day and estimated minutes. Graded types need a class |
| `update_task` | Change a task's priority, description, due date, planned day or estimated minutes. It can't change grades, and never touches completed tasks |

There's no delete tool. One request can create or update at most 15 tasks combined. A planned day can never be in the past or after the task's due date.

**Safety.** Every query runs through the signed-in student's Supabase session, so Row Level Security limits the agent to their own data. Every tool input is validated before it reaches the database ([`lib/agent/validation.ts`](lib/agent/validation.ts), with tests), and so is the conversation the browser sends ([`lib/agent/history.ts`](lib/agent/history.ts)).

**Planning rules.** The system prompt tells the agent to:

- Match the student's wording to their classes, and ask a short question when that's ambiguous.
- Never invent classes, and stay on topic.
- Put lighter study on days with more class time.
- Put Extreme and High priority work and at-risk classes first.
- Create several "Study: …" sessions, spread before the due date, for exams and projects.

When it finishes, the panel shows its reply and each change, like "Created: Quiz 3 (Bio), due Thu" or "Moved: History essay → study Wed". The Planner, the Calendar (with its This Week box) and Classes & Grades show the changes.

## Project structure

```
app/
  api/agent/        Planner agent API route
  auth/             Auth server actions and the email confirmation callback
  calendar/         Calendar page: This Week box, month, week and agenda views, day and task sheets, filters
  classes/          Classes & Grades page: averages overview, class cards and form (meeting times, grading mode, weights), class actions
  planner/          Planner page: task list, add-task form, grade form, agent panel and task actions
  login/, signup/   Auth pages
components/         Shared UI (the auth form, the app header with navigation, class averages)
lib/
  grades.ts         Letter grades and class average calculation (tested in grades.test.ts)
  agent/            Agent tool definitions, validation and shared types
  calendar/         Local date helpers and class meeting recurrence (tested in recurrence.test.ts)
  supabase/         Supabase clients for the browser, the server and the proxy
supabase/
  schema.sql        Full database schema for a new project
  migrations/       Changes for databases created from an older schema
proxy.ts            Refreshes the session and keeps signed-out users out of /calendar, /planner and /classes
```

## Upgrading an existing database

`supabase/schema.sql` always describes the current schema, so a new project needs only that file. For a database created from an older schema, run the files in `supabase/migrations/` that it doesn't have yet, oldest first:

| Migration | Adds |
| --- | --- |
| [`20260924000000_add_scheduled_for_to_tasks.sql`](supabase/migrations/20260924000000_add_scheduled_for_to_tasks.sql) | The `scheduled_for` (planned day) column |
| [`20260925000000_add_description_and_priority_to_tasks.sql`](supabase/migrations/20260925000000_add_description_and_priority_to_tasks.sql) | The `description` and `priority` columns |
| [`20260925120000_add_classes.sql`](supabase/migrations/20260925120000_add_classes.sql) | The `classes` and `class_meetings` tables, and the `class_id` column on tasks |
| [`20260926000000_add_grading.sql`](supabase/migrations/20260926000000_add_grading.sql) | Grading columns on tasks, `grading_mode` on classes, and the `class_weights` table |

Don't run a migration on a database created from the current `schema.sql`, because those columns already exist there.
