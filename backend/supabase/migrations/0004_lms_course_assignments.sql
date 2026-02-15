create table if not exists public.lms_course_assignments (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.lms_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  due_date date null,
  source_role public.user_role null,
  source_office_id bigint null references public.offices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

alter table public.lms_course_assignments enable row level security;

drop policy if exists "read own lms assignments" on public.lms_course_assignments;
drop policy if exists "read office lms assignments" on public.lms_course_assignments;
drop policy if exists "read admin lms assignments" on public.lms_course_assignments;

create policy "read own lms assignments" on public.lms_course_assignments
for select to authenticated
using (user_id = auth.uid());

create policy "read office lms assignments" on public.lms_course_assignments
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1
    from public.profiles p
    where p.id = public.lms_course_assignments.user_id
      and p.office_id = public.current_profile_office_id()
  )
);

create policy "read admin lms assignments" on public.lms_course_assignments
for select to authenticated
using (public.is_admin_or_director());
