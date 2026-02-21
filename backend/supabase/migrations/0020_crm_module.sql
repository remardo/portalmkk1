create table if not exists public.crm_clients (
  id bigint generated always as identity primary key,
  full_name text not null,
  phone text not null,
  status text not null default 'sleeping' check (status in ('sleeping', 'in_progress', 'reactivated', 'lost', 'do_not_call')),
  office_id bigint references public.offices(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  source text,
  notes text,
  extra jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_clients_status_idx on public.crm_clients(status);
create index if not exists crm_clients_phone_idx on public.crm_clients(phone);
create index if not exists crm_clients_office_idx on public.crm_clients(office_id);
create index if not exists crm_clients_assigned_user_idx on public.crm_clients(assigned_user_id);

create table if not exists public.crm_calls (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.crm_clients(id) on delete cascade,
  employee_user_id uuid references public.profiles(id) on delete set null,
  office_id bigint references public.offices(id) on delete set null,
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

create index if not exists crm_calls_client_idx on public.crm_calls(client_id);
create index if not exists crm_calls_employee_idx on public.crm_calls(employee_user_id);
create index if not exists crm_calls_created_at_idx on public.crm_calls(created_at desc);

create table if not exists public.crm_call_evaluations (
  id bigint generated always as identity primary key,
  call_id bigint not null unique references public.crm_calls(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  script_compliance_score int not null check (script_compliance_score between 0 and 100),
  delivery_score int not null check (delivery_score between 0 and 100),
  script_findings text not null default '',
  recommendations text[] not null default '{}',
  suggested_tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_call_evals_call_idx on public.crm_call_evaluations(call_id);

create table if not exists public.crm_call_tasks (
  id bigint generated always as identity primary key,
  call_id bigint not null references public.crm_calls(id) on delete cascade,
  task_id bigint not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (call_id, task_id)
);

create index if not exists crm_call_tasks_call_idx on public.crm_call_tasks(call_id);
create index if not exists crm_call_tasks_task_idx on public.crm_call_tasks(task_id);

