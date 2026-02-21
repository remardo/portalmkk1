create table if not exists public.points_action_rules (
  id bigint generated always as identity primary key,
  action_key text not null unique,
  title text not null,
  description text,
  base_points int not null check (base_points between -100000 and 100000),
  is_active boolean not null default true,
  is_auto boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.points_campaigns (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  action_key text null,
  bonus_points int not null default 0 check (bonus_points between -100000 and 100000),
  multiplier numeric(5,2) not null default 1.00 check (multiplier >= 0 and multiplier <= 10),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.points_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null,
  rule_id bigint references public.points_action_rules(id) on delete set null,
  base_points int not null,
  bonus_points int not null default 0,
  multiplier numeric(5,2) not null default 1.00 check (multiplier >= 0 and multiplier <= 10),
  total_points int not null,
  entity_type text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  awarded_by uuid references public.profiles(id) on delete set null,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists points_events_user_created_idx on public.points_events(user_id, created_at desc);
create index if not exists points_events_action_created_idx on public.points_events(action_key, created_at desc);
create index if not exists points_campaigns_active_window_idx on public.points_campaigns(is_active, starts_at, ends_at);

insert into public.points_action_rules (action_key, title, description, base_points, is_active, is_auto)
values
  ('task_completed', 'Задача выполнена', 'Начисляется при переводе задачи в статус done', 5, true, true),
  ('lms_course_passed', 'Курс пройден', 'Начисляется при успешном прохождении курса LMS', 20, true, true),
  ('shop_purchase', 'Покупка в магазине', 'Списание баллов за заказ в магазине', -1, true, true),
  ('manual_bonus', 'Ручное начисление', 'Ручная корректировка баллов руководителем', 0, true, false)
on conflict (action_key) do nothing;
