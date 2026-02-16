alter table public.tasks
  add column if not exists created_by uuid null references public.profiles(id) on delete set null;

create index if not exists tasks_created_by_idx on public.tasks(created_by);
