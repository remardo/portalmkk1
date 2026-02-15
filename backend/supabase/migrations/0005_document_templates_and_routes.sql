create table if not exists public.document_approval_routes (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.document_approval_route_steps (
  id bigint generated always as identity primary key,
  route_id bigint not null references public.document_approval_routes(id) on delete cascade,
  step_order int not null,
  required_role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (route_id, step_order)
);

create table if not exists public.document_templates (
  id bigint generated always as identity primary key,
  name text not null unique,
  type public.document_type not null default 'internal',
  title_template text not null,
  body_template text null,
  default_route_id bigint null references public.document_approval_routes(id) on delete set null,
  status public.document_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists body text null;
alter table public.documents add column if not exists template_id bigint null references public.document_templates(id) on delete set null;
alter table public.documents add column if not exists approval_route_id bigint null references public.document_approval_routes(id) on delete set null;
alter table public.documents add column if not exists current_approval_step int null;

alter table public.document_templates enable row level security;
alter table public.document_approval_routes enable row level security;
alter table public.document_approval_route_steps enable row level security;

drop policy if exists "read published document templates" on public.document_templates;
drop policy if exists "read admin document templates" on public.document_templates;
drop policy if exists "read document routes" on public.document_approval_routes;
drop policy if exists "read document route steps" on public.document_approval_route_steps;

create policy "read published document templates" on public.document_templates
for select to authenticated
using (status = 'approved');

create policy "read admin document templates" on public.document_templates
for select to authenticated
using (public.is_admin_or_director());

create policy "read document routes" on public.document_approval_routes
for select to authenticated
using (true);

create policy "read document route steps" on public.document_approval_route_steps
for select to authenticated
using (true);
