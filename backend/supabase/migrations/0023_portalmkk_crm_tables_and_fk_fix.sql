create table if not exists public.portalmkk_crm_clients (
  id bigint generated always as identity primary key,
  full_name text not null,
  phone text not null,
  status text not null default 'sleeping' check (status in ('sleeping', 'in_progress', 'reactivated', 'lost', 'do_not_call')),
  office_id bigint references public.portalmkk_offices(id) on delete set null,
  assigned_user_id uuid references public.portalmkk_profiles(id) on delete set null,
  source text,
  notes text,
  extra jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portalmkk_crm_clients_status_idx on public.portalmkk_crm_clients(status);
create index if not exists portalmkk_crm_clients_phone_idx on public.portalmkk_crm_clients(phone);
create index if not exists portalmkk_crm_clients_office_idx on public.portalmkk_crm_clients(office_id);
create index if not exists portalmkk_crm_clients_assigned_user_idx on public.portalmkk_crm_clients(assigned_user_id);

create table if not exists public.portalmkk_crm_calls (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.portalmkk_crm_clients(id) on delete cascade,
  employee_user_id uuid references public.portalmkk_profiles(id) on delete set null,
  office_id bigint references public.portalmkk_offices(id) on delete set null,
  provider text not null default 'manual' check (provider in ('asterisk', 'fmc', 'manual')),
  external_call_id text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_sec int check (duration_sec is null or duration_sec >= 0),
  recording_url text,
  transcript_raw text,
  transcription_status text not null default 'pending' check (transcription_status in ('pending', 'ready', 'failed')),
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'ready', 'failed')),
  transcript_summary_short text,
  transcript_summary_full text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portalmkk_crm_calls_client_idx on public.portalmkk_crm_calls(client_id);
create index if not exists portalmkk_crm_calls_employee_idx on public.portalmkk_crm_calls(employee_user_id);
create index if not exists portalmkk_crm_calls_created_at_idx on public.portalmkk_crm_calls(created_at desc);

create table if not exists public.portalmkk_crm_call_evaluations (
  id bigint generated always as identity primary key,
  call_id bigint not null unique references public.portalmkk_crm_calls(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  script_compliance_score int not null check (script_compliance_score between 0 and 100),
  delivery_score int not null check (delivery_score between 0 and 100),
  script_findings text not null default '',
  recommendations text[] not null default '{}',
  suggested_tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portalmkk_crm_call_evals_call_idx on public.portalmkk_crm_call_evaluations(call_id);

create table if not exists public.portalmkk_crm_call_tasks (
  id bigint generated always as identity primary key,
  call_id bigint not null references public.portalmkk_crm_calls(id) on delete cascade,
  task_id bigint not null references public.portalmkk_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (call_id, task_id)
);

create index if not exists portalmkk_crm_call_tasks_call_idx on public.portalmkk_crm_call_tasks(call_id);
create index if not exists portalmkk_crm_call_tasks_task_idx on public.portalmkk_crm_call_tasks(task_id);

create unique index if not exists portalmkk_crm_calls_provider_external_call_uidx
  on public.portalmkk_crm_calls(provider, external_call_id)
  where external_call_id is not null;

-- Copy legacy CRM data into portalmkk_* tables if present.
do $$
begin
  if to_regclass('public.crm_clients') is not null then
    insert into public.portalmkk_crm_clients (
      id, full_name, phone, status, office_id, assigned_user_id, source, notes, extra, last_contacted_at, created_at, updated_at
    )
    overriding system value
    select c.id, c.full_name, c.phone, c.status, c.office_id, c.assigned_user_id, c.source, c.notes, c.extra, c.last_contacted_at, c.created_at, c.updated_at
    from public.crm_clients c
    on conflict (id) do nothing;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.crm_calls') is not null then
    insert into public.portalmkk_crm_calls (
      id, client_id, employee_user_id, office_id, provider, external_call_id, started_at, ended_at, duration_sec,
      recording_url, transcript_raw, transcription_status, analysis_status, transcript_summary_short, transcript_summary_full,
      created_at, updated_at
    )
    overriding system value
    select c.id, c.client_id, c.employee_user_id, c.office_id, c.provider, c.external_call_id, c.started_at, c.ended_at, c.duration_sec,
      c.recording_url, c.transcript_raw, c.transcription_status, c.analysis_status, c.transcript_summary_short, c.transcript_summary_full,
      c.created_at, c.updated_at
    from public.crm_calls c
    on conflict (id) do nothing;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.crm_call_evaluations') is not null then
    insert into public.portalmkk_crm_call_evaluations (
      id, call_id, overall_score, script_compliance_score, delivery_score, script_findings, recommendations, suggested_tasks, created_at, updated_at
    )
    overriding system value
    select e.id, e.call_id, e.overall_score, e.script_compliance_score, e.delivery_score, e.script_findings, e.recommendations, e.suggested_tasks, e.created_at, e.updated_at
    from public.crm_call_evaluations e
    on conflict (id) do nothing;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.crm_call_tasks') is not null then
    insert into public.portalmkk_crm_call_tasks (
      id, call_id, task_id, created_at
    )
    overriding system value
    select t.id, t.call_id, t.task_id, t.created_at
    from public.crm_call_tasks t
    on conflict (id) do nothing;
  end if;
end
$$;

-- Align identity sequences after explicit id inserts.
select setval(
  pg_get_serial_sequence('public.portalmkk_crm_clients', 'id'),
  coalesce((select max(id) from public.portalmkk_crm_clients), 1),
  coalesce((select count(*) > 0 from public.portalmkk_crm_clients), false)
);
select setval(
  pg_get_serial_sequence('public.portalmkk_crm_calls', 'id'),
  coalesce((select max(id) from public.portalmkk_crm_calls), 1),
  coalesce((select count(*) > 0 from public.portalmkk_crm_calls), false)
);
select setval(
  pg_get_serial_sequence('public.portalmkk_crm_call_evaluations', 'id'),
  coalesce((select max(id) from public.portalmkk_crm_call_evaluations), 1),
  coalesce((select count(*) > 0 from public.portalmkk_crm_call_evaluations), false)
);
select setval(
  pg_get_serial_sequence('public.portalmkk_crm_call_tasks', 'id'),
  coalesce((select max(id) from public.portalmkk_crm_call_tasks), 1),
  coalesce((select count(*) > 0 from public.portalmkk_crm_call_tasks), false)
);

-- Drop existing FK constraints on portalmkk CRM tables to avoid stale refs to non-prefixed tables.
do $$
declare
  rec record;
begin
  for rec in
    select t.relname as table_name, c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('portalmkk_crm_clients', 'portalmkk_crm_calls', 'portalmkk_crm_call_evaluations', 'portalmkk_crm_call_tasks')
      and c.contype = 'f'
  loop
    execute format('alter table public.%I drop constraint if exists %I', rec.table_name, rec.conname);
  end loop;
end
$$;

-- Re-create FK constraints to renamed portalmkk_* tables.
alter table public.portalmkk_crm_clients
  add constraint portalmkk_crm_clients_office_id_fkey
  foreign key (office_id) references public.portalmkk_offices(id) on delete set null not valid;

alter table public.portalmkk_crm_clients
  add constraint portalmkk_crm_clients_assigned_user_id_fkey
  foreign key (assigned_user_id) references public.portalmkk_profiles(id) on delete set null not valid;

alter table public.portalmkk_crm_calls
  add constraint portalmkk_crm_calls_client_id_fkey
  foreign key (client_id) references public.portalmkk_crm_clients(id) on delete cascade not valid;

alter table public.portalmkk_crm_calls
  add constraint portalmkk_crm_calls_employee_user_id_fkey
  foreign key (employee_user_id) references public.portalmkk_profiles(id) on delete set null not valid;

alter table public.portalmkk_crm_calls
  add constraint portalmkk_crm_calls_office_id_fkey
  foreign key (office_id) references public.portalmkk_offices(id) on delete set null not valid;

alter table public.portalmkk_crm_call_evaluations
  add constraint portalmkk_crm_call_evaluations_call_id_fkey
  foreign key (call_id) references public.portalmkk_crm_calls(id) on delete cascade not valid;

alter table public.portalmkk_crm_call_tasks
  add constraint portalmkk_crm_call_tasks_call_id_fkey
  foreign key (call_id) references public.portalmkk_crm_calls(id) on delete cascade not valid;

alter table public.portalmkk_crm_call_tasks
  add constraint portalmkk_crm_call_tasks_task_id_fkey
  foreign key (task_id) references public.portalmkk_tasks(id) on delete cascade not valid;
