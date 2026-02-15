do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'sla_entity_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.sla_entity_type as enum ('task', 'document');
  end if;
end
$$;

create table if not exists public.sla_escalation_matrix (
  id bigint generated always as identity primary key,
  name text not null unique,
  entity_type public.sla_entity_type not null,
  trigger_status text not null,
  threshold_hours int not null check (threshold_hours >= 0),
  level public.notification_level not null default 'warning',
  target_role public.user_role not null,
  office_scoped boolean not null default false,
  message_template text null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.documents add column if not exists updated_at timestamptz not null default now();
alter table public.sla_escalation_matrix enable row level security;

drop policy if exists "read admin sla matrix" on public.sla_escalation_matrix;
create policy "read admin sla matrix" on public.sla_escalation_matrix
for select to authenticated
using (public.is_admin_or_director());

insert into public.sla_escalation_matrix (
  name,
  entity_type,
  trigger_status,
  threshold_hours,
  level,
  target_role,
  office_scoped,
  message_template,
  is_active,
  created_by
)
select
  'task-new-overdue-office-head',
  'task',
  'new',
  0,
  'warning',
  'office_head',
  true,
  'Просроченная задача в вашем офисе требует внимания руководителя.',
  true,
  p.id
from public.profiles p
where p.role in ('admin', 'director')
order by case when p.role = 'admin' then 0 else 1 end, p.created_at
limit 1
on conflict (name) do nothing;

insert into public.sla_escalation_matrix (
  name,
  entity_type,
  trigger_status,
  threshold_hours,
  level,
  target_role,
  office_scoped,
  message_template,
  is_active,
  created_by
)
select
  'task-inprogress-overdue-director',
  'task',
  'in_progress',
  24,
  'critical',
  'director',
  false,
  'Задача в работе просрочена более 24 часов и требует эскалации директору.',
  true,
  p.id
from public.profiles p
where p.role in ('admin', 'director')
order by case when p.role = 'admin' then 0 else 1 end, p.created_at
limit 1
on conflict (name) do nothing;

insert into public.sla_escalation_matrix (
  name,
  entity_type,
  trigger_status,
  threshold_hours,
  level,
  target_role,
  office_scoped,
  message_template,
  is_active,
  created_by
)
select
  'document-review-office-head',
  'document',
  'review',
  24,
  'warning',
  'office_head',
  true,
  'Документ находится на согласовании более 24 часов.',
  true,
  p.id
from public.profiles p
where p.role in ('admin', 'director')
order by case when p.role = 'admin' then 0 else 1 end, p.created_at
limit 1
on conflict (name) do nothing;

insert into public.sla_escalation_matrix (
  name,
  entity_type,
  trigger_status,
  threshold_hours,
  level,
  target_role,
  office_scoped,
  message_template,
  is_active,
  created_by
)
select
  'document-review-director',
  'document',
  'review',
  48,
  'critical',
  'director',
  false,
  'Документ находится на согласовании более 48 часов и эскалирован директору.',
  true,
  p.id
from public.profiles p
where p.role in ('admin', 'director')
order by case when p.role = 'admin' then 0 else 1 end, p.created_at
limit 1
on conflict (name) do nothing;
