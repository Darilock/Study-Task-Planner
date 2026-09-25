-- Classes with weekly meeting times, and an optional class on each task.
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

alter table public.tasks
  add column class_id uuid,
  add foreign key (class_id, user_id)
    references public.classes (id, user_id) on delete set null (class_id);

create index on public.class_meetings (class_id);
create index on public.tasks (class_id);

alter table public.classes enable row level security;
alter table public.class_meetings enable row level security;

create policy "Users manage their own classes"
  on public.classes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own class meetings"
  on public.class_meetings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
