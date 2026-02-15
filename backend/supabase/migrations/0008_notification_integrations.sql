do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'notification_channel'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.notification_channel as enum ('webhook', 'email', 'messenger');
  end if;
end
$$;

create table if not exists public.notification_integrations (
  id bigint generated always as identity primary key,
  name text not null unique,
  channel public.notification_channel not null,
  endpoint_url text not null,
  secret text null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_log (
  id bigint generated always as identity primary key,
  notification_id bigint null references public.notifications(id) on delete set null,
  integration_id bigint null references public.notification_integrations(id) on delete set null,
  channel public.notification_channel not null,
  destination text not null,
  status text not null,
  response_code int null,
  error_text text null,
  created_at timestamptz not null default now()
);

alter table public.notification_integrations enable row level security;
alter table public.notification_delivery_log enable row level security;

drop policy if exists "read admin notification integrations" on public.notification_integrations;
drop policy if exists "read admin notification delivery logs" on public.notification_delivery_log;

create policy "read admin notification integrations" on public.notification_integrations
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin notification delivery logs" on public.notification_delivery_log
for select to authenticated
using (public.is_admin_or_director());
