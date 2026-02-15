create table if not exists public.slo_alert_routing_policies (
  id bigint generated always as identity primary key,
  name text not null unique,
  breach_type text not null check (breach_type in ('any', 'api_error_rate', 'api_latency_p95', 'notification_failure_rate')),
  severity text not null check (severity in ('any', 'warning', 'critical')),
  channels public.notification_channel[] not null check (cardinality(channels) >= 1),
  priority int not null default 100 check (priority >= 0 and priority <= 1000),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists slo_alert_routing_policies_active_priority_idx
  on public.slo_alert_routing_policies (is_active, priority, created_at);

alter table public.slo_alert_routing_policies enable row level security;

drop policy if exists "read admin slo routing policies" on public.slo_alert_routing_policies;

create policy "read admin slo routing policies" on public.slo_alert_routing_policies
for select to authenticated
using (public.is_admin_or_director());
