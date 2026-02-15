create table if not exists public.lms_course_versions (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.lms_courses(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  reason text not null default 'manual',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (course_id, version)
);

alter table public.lms_course_versions enable row level security;

drop policy if exists "read admin lms versions" on public.lms_course_versions;
create policy "read admin lms versions" on public.lms_course_versions
for select to authenticated
using (public.is_admin_or_director());
