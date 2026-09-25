-- The composite (id, user_id) foreign keys stop rows from pointing at another user's class.
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  instructor text,
  location text,
  color text,
  start_date date,
  end_date date,
  grading_mode text not null default 'percent' check (grading_mode in ('percent', 'points')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  class_id uuid not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  foreign key (class_id, user_id) references public.classes (id, user_id) on delete cascade
);

-- Per-type weights, used when a class's grading_mode is 'percent'.
create table public.class_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  class_id uuid not null,
  task_type text not null
    check (task_type in ('homework', 'quiz', 'test', 'project', 'exam', 'discussion')),
  weight numeric not null check (weight > 0 and weight <= 100),
  unique (class_id, task_type),
  foreign key (class_id, user_id) references public.classes (id, user_id) on delete cascade
);

create index class_meetings_class_id_idx on public.class_meetings (class_id);

alter table public.classes enable row level security;
alter table public.class_meetings enable row level security;
alter table public.class_weights enable row level security;

create policy "Users manage their own classes"
  on public.classes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own class meetings"
  on public.class_meetings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own class weights"
  on public.class_weights for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  description text,
  due_date date,
  estimated_minutes int,
  scheduled_for date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'extreme')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  class_id uuid,
  -- Grading. A null task_type means a study task that isn't graded.
  task_type text check (task_type in ('homework', 'quiz', 'test', 'project', 'exam', 'discussion')),
  max_points numeric check (max_points > 0),
  score numeric check (score >= 0),
  letter_grade text check (letter_grade in ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F')),
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (class_id, user_id) references public.classes (id, user_id) on delete set null (class_id),
  constraint tasks_one_grade_format check (score is null or letter_grade is null),
  constraint tasks_score_needs_max check (score is null or max_points is not null)
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_class_id_idx on public.tasks (class_id);

alter table public.tasks enable row level security;

create policy "Users can view their own tasks"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tasks"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);
