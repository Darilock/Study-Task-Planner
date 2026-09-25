-- Grading: a type, max points and grade on each task, a grading mode on each
-- class, and per-type weights for classes graded by percentage.
alter table public.tasks
  add column task_type text
    check (task_type in ('homework', 'quiz', 'test', 'project', 'exam', 'discussion')),
  add column max_points numeric check (max_points > 0),
  add column score numeric check (score >= 0),
  add column letter_grade text
    check (letter_grade in ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F')),
  add column graded_at timestamptz,
  add constraint tasks_one_grade_format check (score is null or letter_grade is null),
  add constraint tasks_score_needs_max check (score is null or max_points is not null);

alter table public.classes
  add column grading_mode text not null default 'percent'
    check (grading_mode in ('percent', 'points'));

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

alter table public.class_weights enable row level security;

create policy "Users manage their own class weights"
  on public.class_weights for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
