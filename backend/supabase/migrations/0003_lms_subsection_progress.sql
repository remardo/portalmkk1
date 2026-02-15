create table if not exists public.lms_subsection_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subsection_id bigint not null references public.lms_subsections(id) on delete cascade,
  completed boolean not null default false,
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (user_id, subsection_id)
);

alter table public.lms_subsection_progress enable row level security;

drop policy if exists "read own lms progress" on public.lms_subsection_progress;
drop policy if exists "read admin lms progress" on public.lms_subsection_progress;
drop policy if exists "write own lms progress" on public.lms_subsection_progress;

create policy "read own lms progress" on public.lms_subsection_progress
for select to authenticated
using (user_id = auth.uid());

create policy "read admin lms progress" on public.lms_subsection_progress
for select to authenticated
using (public.is_admin_or_director());

create policy "write own lms progress" on public.lms_subsection_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
