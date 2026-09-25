-- Optional longer notes, and a priority level used to sort and highlight tasks.
alter table public.tasks
  add column description text,
  add column priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'extreme'));
