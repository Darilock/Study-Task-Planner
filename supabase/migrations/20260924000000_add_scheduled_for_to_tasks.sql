-- Day a task is planned to be worked on (separate from its due date).
alter table public.tasks add column scheduled_for date;
