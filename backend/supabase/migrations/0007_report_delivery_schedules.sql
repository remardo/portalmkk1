do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'report_frequency'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.report_frequency as enum ('daily', 'weekly', 'monthly');
  end if;
end
$$;

create table if not exists public.report_delivery_schedules (
  id bigint generated always as identity primary key,
  name text not null,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  office_id bigint null references public.offices(id) on delete set null,
  role_filter public.user_role null,
  days_window int not null default 30 check (days_window >= 1 and days_window <= 365),
  frequency public.report_frequency not null default 'weekly',
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.report_delivery_runs (
  id bigint generated always as identity primary key,
  schedule_id bigint not null references public.report_delivery_schedules(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ready',
  format text not null default 'csv',
  generated_at timestamptz not null default now(),
  file_name text null,
  payload_csv text null,
  rows_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.report_delivery_schedules enable row level security;
alter table public.report_delivery_runs enable row level security;

drop policy if exists "read admin report schedules" on public.report_delivery_schedules;
drop policy if exists "read own report runs" on public.report_delivery_runs;
drop policy if exists "read admin report runs" on public.report_delivery_runs;

create policy "read admin report schedules" on public.report_delivery_schedules
for select to authenticated
using (public.is_admin_or_director());

create policy "read own report runs" on public.report_delivery_runs
for select to authenticated
using (recipient_user_id = auth.uid());

create policy "read admin report runs" on public.report_delivery_runs
for select to authenticated
using (public.is_admin_or_director());
