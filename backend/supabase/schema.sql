-- Run in Supabase SQL Editor
-- schema_snapshot_migration: 0018
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role' and typnamespace = 'public'::regnamespace) then
    create type public.user_role as enum ('operator', 'office_head', 'director', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status' and typnamespace = 'public'::regnamespace) then
    create type public.task_status as enum ('new', 'in_progress', 'done', 'overdue');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_type' and typnamespace = 'public'::regnamespace) then
    create type public.task_type as enum ('order', 'checklist', 'auto');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority' and typnamespace = 'public'::regnamespace) then
    create type public.task_priority as enum ('low', 'medium', 'high');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_type' and typnamespace = 'public'::regnamespace) then
    create type public.document_type as enum ('incoming', 'outgoing', 'internal');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_status' and typnamespace = 'public'::regnamespace) then
    create type public.document_status as enum ('draft', 'review', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'news_status' and typnamespace = 'public'::regnamespace) then
    create type public.news_status as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'kb_status' and typnamespace = 'public'::regnamespace) then
    create type public.kb_status as enum ('draft', 'review', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'course_status' and typnamespace = 'public'::regnamespace) then
    create type public.course_status as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_decision' and typnamespace = 'public'::regnamespace) then
    create type public.document_decision as enum ('submitted', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_level' and typnamespace = 'public'::regnamespace) then
    create type public.notification_level as enum ('info', 'warning', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'lms_media_type' and typnamespace = 'public'::regnamespace) then
    create type public.lms_media_type as enum ('image', 'video');
  end if;
  if not exists (select 1 from pg_type where typname = 'sla_entity_type' and typnamespace = 'public'::regnamespace) then
    create type public.sla_entity_type as enum ('task', 'document');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_frequency' and typnamespace = 'public'::regnamespace) then
    create type public.report_frequency as enum ('daily', 'weekly', 'monthly');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_channel' and typnamespace = 'public'::regnamespace) then
    create type public.notification_channel as enum ('webhook', 'email', 'messenger');
  end if;
  if not exists (select 1 from pg_type where typname = 'lms_quiz_type' and typnamespace = 'public'::regnamespace) then
    create type public.lms_quiz_type as enum ('quiz', 'survey', 'exam');
  end if;
  if not exists (select 1 from pg_type where typname = 'lms_question_type' and typnamespace = 'public'::regnamespace) then
    create type public.lms_question_type as enum ('single_choice', 'multiple_choice', 'text_answer', 'matching', 'ordering');
  end if;
end
$$;

create table if not exists public.offices (
  id bigint generated always as identity primary key,
  name text not null,
  city text not null,
  address text not null,
  head_id uuid null,
  rating int not null default 0
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'operator',
  office_id bigint null references public.offices(id) on delete set null,
  email text null,
  phone text null,
  points int not null default 0,
  position text null,
  avatar text null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, office_id, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'operator'),
    nullif(new.raw_user_meta_data ->> 'office_id', '')::bigint,
    new.email
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    role = excluded.role,
    office_id = excluded.office_id,
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.news (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  date date not null,
  pinned boolean not null default false,
  author text not null,
  created_at timestamptz not null default now()
);
alter table public.news add column if not exists status public.news_status not null default 'published';
alter table public.news add column if not exists updated_at timestamptz not null default now();
alter table public.news add column if not exists cover_image_data_base64 text null;
alter table public.news add column if not exists cover_image_mime_type text null;

create table if not exists public.news_images (
  id bigint generated always as identity primary key,
  news_id bigint null references public.news(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  image_data_base64 text not null,
  image_mime_type text not null,
  caption text null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_articles (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,
  content text not null,
  date date not null,
  created_at timestamptz not null default now()
);
alter table public.kb_articles add column if not exists status public.kb_status not null default 'published';
alter table public.kb_articles add column if not exists version int not null default 1;
alter table public.kb_articles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.courses (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,
  questions_count int not null,
  passing_score int not null
);
alter table public.courses add column if not exists status public.course_status not null default 'published';
alter table public.courses add column if not exists updated_at timestamptz not null default now();

create table if not exists public.attestations (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  score int not null,
  passed boolean not null
);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null,
  office_id bigint not null references public.offices(id) on delete restrict,
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid null references public.profiles(id) on delete set null,
  status public.task_status not null default 'new',
  type public.task_type not null,
  priority public.task_priority not null,
  due_date date not null,
  created_date date not null,
  checklist_items jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  title text not null,
  type public.document_type not null,
  status public.document_status not null default 'draft',
  author text not null,
  date date not null,
  office_id bigint not null references public.offices(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.document_folders (
  id bigint generated always as identity primary key,
  name text not null,
  parent_id bigint null references public.document_folders(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
  folder text not null default 'Общее',
  type public.document_type not null default 'internal',
  title_template text not null,
  body_template text null,
  instruction text null,
  default_route_id bigint null references public.document_approval_routes(id) on delete set null,
  status public.document_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.document_templates add column if not exists folder text not null default 'Общее';
alter table public.document_templates add column if not exists instruction text null;
alter table public.documents add column if not exists body text null;
alter table public.documents add column if not exists template_id bigint null references public.document_templates(id) on delete set null;
alter table public.documents add column if not exists approval_route_id bigint null references public.document_approval_routes(id) on delete set null;
alter table public.documents add column if not exists current_approval_step int null;
alter table public.documents add column if not exists folder_id bigint null references public.document_folders(id) on delete set null;
alter table public.documents add column if not exists updated_at timestamptz not null default now();
create table if not exists public.document_files (
  id bigint generated always as identity primary key,
  document_id bigint not null unique references public.documents(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  content_base64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_products (
  id bigint generated always as identity primary key,
  name text not null,
  description text null,
  category text not null,
  is_material boolean not null default true,
  price_points int not null check (price_points > 0),
  stock_qty int null check (stock_qty is null or stock_qty >= 0),
  is_active boolean not null default true,
  image_url text null,
  image_data_base64 text null,
  image_mime_type text null,
  image_emoji text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shop_products add column if not exists image_url text null;
alter table public.shop_products add column if not exists image_data_base64 text null;
alter table public.shop_products add column if not exists image_mime_type text null;

create table if not exists public.shop_orders (
  id bigint generated always as identity primary key,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  office_id bigint null references public.offices(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_points int not null check (total_points > 0),
  delivery_info text null,
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.shop_orders(id) on delete cascade,
  product_id bigint not null references public.shop_products(id) on delete restrict,
  product_name text not null,
  quantity int not null check (quantity > 0),
  price_points int not null check (price_points > 0),
  subtotal_points int not null check (subtotal_points > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.user_role not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.kb_article_versions (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.kb_articles(id) on delete cascade,
  version int not null,
  title text not null,
  category text not null,
  content text not null,
  status public.kb_status not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.course_assignments (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  due_date date null,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create table if not exists public.course_attempts (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null,
  passed boolean not null,
  attempt_no int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.course_questions (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  sort_order int not null,
  question text not null,
  options jsonb not null,
  correct_option int not null,
  explanation text null,
  created_at timestamptz not null default now(),
  unique (course_id, sort_order),
  check (jsonb_typeof(options) = 'array'),
  check (jsonb_array_length(options) >= 2),
  check (correct_option >= 0)
);

create table if not exists public.lms_courses (
  id bigint generated always as identity primary key,
  title text not null,
  description text null,
  status public.course_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_sections (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.lms_courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  unique (course_id, sort_order)
);

create table if not exists public.lms_subsections (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.lms_sections(id) on delete cascade,
  title text not null,
  sort_order int not null default 1,
  markdown_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, sort_order)
);

create table if not exists public.lms_media (
  id bigint generated always as identity primary key,
  subsection_id bigint not null references public.lms_subsections(id) on delete cascade,
  media_type public.lms_media_type not null,
  image_data_base64 text null,
  image_mime_type text null,
  external_url text null,
  caption text null,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  check (
    (media_type = 'image' and image_data_base64 is not null and external_url is null)
    or
    (media_type = 'video' and external_url is not null and image_data_base64 is null)
  )
);

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

create table if not exists public.lms_subsection_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subsection_id bigint not null references public.lms_subsections(id) on delete cascade,
  completed boolean not null default false,
  progress_percent int not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (user_id, subsection_id)
);

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

-- LMS Quizzes tables
create table if not exists public.lms_quizzes (
  id bigint generated always as identity primary key,
  title text not null,
  description text null,
  quiz_type public.lms_quiz_type not null default 'quiz',
  subsection_id bigint null references public.lms_subsections(id) on delete cascade,
  course_id bigint not null references public.lms_courses(id) on delete cascade,
  passing_score int not null default 70 check (passing_score >= 0 and passing_score <= 100),
  max_attempts int null check (max_attempts is null or max_attempts >= 1),
  time_limit_minutes int null check (time_limit_minutes is null or time_limit_minutes >= 1),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  show_correct_answers boolean not null default true,
  show_explanations boolean not null default true,
  is_required boolean not null default true,
  sort_order int not null default 1,
  status public.course_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_quiz_questions (
  id bigint generated always as identity primary key,
  quiz_id bigint not null references public.lms_quizzes(id) on delete cascade,
  question_type public.lms_question_type not null default 'single_choice',
  question_text text not null,
  hint text null,
  explanation text null,
  image_url text null,
  points int not null default 1 check (points >= 1),
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_quiz_options (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.lms_quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_quiz_matching_pairs (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.lms_quiz_questions(id) on delete cascade,
  left_text text not null,
  right_text text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lms_quiz_attempts (
  id bigint generated always as identity primary key,
  quiz_id bigint not null references public.lms_quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_no int not null,
  score int not null default 0,
  max_score int not null default 0,
  score_percent int not null default 0 check (score_percent >= 0 and score_percent <= 100),
  passed boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz null,
  time_spent_seconds int null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (quiz_id, user_id, attempt_no)
);

create table if not exists public.lms_quiz_progress (
  id bigint generated always as identity primary key,
  quiz_id bigint not null references public.lms_quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_question_index int not null default 0,
  answers jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

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

create table if not exists public.document_approvals (
  id bigint generated always as identity primary key,
  document_id bigint not null references public.documents(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role public.user_role not null,
  decision public.document_decision not null,
  comment text null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  level public.notification_level not null default 'info',
  title text not null,
  body text not null,
  entity_type text null,
  entity_id text null,
  dedupe_key text null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);
create unique index if not exists notifications_dedupe_key_uniq on public.notifications(dedupe_key) where dedupe_key is not null;
create index if not exists tasks_status_due_date_idx on public.tasks(status, due_date);
create index if not exists tasks_assignee_status_idx on public.tasks(assignee_id, status);
create index if not exists tasks_office_status_idx on public.tasks(office_id, status);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_created_date_idx on public.tasks(created_date desc);
create index if not exists documents_office_status_date_idx on public.documents(office_id, status, date desc);
create index if not exists documents_author_date_idx on public.documents(author, date desc);
create index if not exists documents_updated_at_idx on public.documents(updated_at desc);
create index if not exists news_status_date_idx on public.news(status, date desc);
create index if not exists news_updated_at_idx on public.news(updated_at desc);
create index if not exists news_images_news_id_idx on public.news_images(news_id);
create index if not exists news_images_created_at_idx on public.news_images(created_at desc);
create index if not exists kb_articles_status_updated_at_idx on public.kb_articles(status, updated_at desc);
create index if not exists courses_status_updated_at_idx on public.courses(status, updated_at desc);
create index if not exists course_assignments_user_created_idx on public.course_assignments(user_id, created_at desc);
create index if not exists course_attempts_user_created_idx on public.course_attempts(user_id, created_at desc);
create index if not exists document_approvals_document_created_idx on public.document_approvals(document_id, created_at desc);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_user_id, is_read, created_at desc);
create index if not exists lms_courses_status_updated_at_idx on public.lms_courses(status, updated_at desc);
create index if not exists lms_subsection_progress_user_updated_idx on public.lms_subsection_progress(user_id, updated_at desc);
create index if not exists lms_course_assignments_user_created_idx on public.lms_course_assignments(user_id, created_at desc);
create index if not exists audit_log_actor_created_idx on public.audit_log(actor_user_id, created_at desc);
create index if not exists audit_log_entity_created_idx on public.audit_log(entity_type, created_at desc);
create index if not exists report_delivery_schedules_active_next_run_idx on public.report_delivery_schedules(is_active, next_run_at);
create index if not exists report_delivery_runs_recipient_generated_idx on public.report_delivery_runs(recipient_user_id, generated_at desc);
create index if not exists slo_alert_routing_policies_active_priority_idx on public.slo_alert_routing_policies(is_active, priority, created_at);
create index if not exists documents_title_trgm_idx on public.documents using gin (title gin_trgm_ops);
create index if not exists documents_body_trgm_idx on public.documents using gin (coalesce(body, '') gin_trgm_ops);
create unique index if not exists document_folders_unique_name_per_parent_idx on public.document_folders (coalesce(parent_id, 0), lower(name));
create index if not exists document_folders_parent_idx on public.document_folders(parent_id);
create index if not exists documents_folder_id_idx on public.documents(folder_id);
create index if not exists document_files_document_id_idx on public.document_files(document_id);
create unique index if not exists shop_products_name_uniq_idx on public.shop_products (lower(name));
create index if not exists shop_products_active_idx on public.shop_products (is_active, category, price_points);
create index if not exists shop_orders_buyer_idx on public.shop_orders (buyer_user_id, created_at desc);
create index if not exists shop_orders_office_idx on public.shop_orders (office_id, created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status, created_at desc);
create index if not exists shop_order_items_order_idx on public.shop_order_items (order_id);
create index if not exists shop_order_items_product_idx on public.shop_order_items (product_id);
insert into public.shop_products (name, description, category, is_material, price_points, stock_qty, is_active, image_emoji)
values
  ('Кружка брендированная', 'Керамическая кружка с логотипом компании', 'Сувениры', true, 300, 120, true, '☕'),
  ('Футболка корпоративная', 'Хлопковая футболка с фирменным принтом', 'Одежда', true, 700, 90, true, '👕'),
  ('Худи корпоративное', 'Теплое худи с логотипом', 'Одежда', true, 1500, 40, true, '🧥'),
  ('Термос металлический', 'Термос 500 мл', 'Сувениры', true, 900, 60, true, '🫖'),
  ('Блокнот А5', 'Брендированный блокнот в твердой обложке', 'Канцелярия', true, 250, 200, true, '📓'),
  ('Рюкзак городской', 'Рюкзак с отделением для ноутбука', 'Аксессуары', true, 1800, 35, true, '🎒'),
  ('Плед офисный', 'Мягкий плед для отдыха', 'Дом', true, 1300, 25, true, '🧶'),
  ('Powerbank 10000 mAh', 'Внешний аккумулятор', 'Техника', true, 2200, 20, true, '🔋'),
  ('Наушники беспроводные', 'Bluetooth-наушники', 'Техника', true, 2500, 18, true, '🎧'),
  ('Флешка 64GB', 'USB накопитель', 'Техника', true, 500, 110, true, '💾'),
  ('Зонт складной', 'Компактный зонт', 'Аксессуары', true, 950, 70, true, '☂️'),
  ('Сумка-шоппер', 'Текстильная сумка с логотипом', 'Аксессуары', true, 450, 140, true, '🛍️'),
  ('Бутылка для воды', 'Спортивная бутылка 700 мл', 'Сувениры', true, 600, 100, true, '🧴'),
  ('Настольная лампа', 'LED лампа для рабочего стола', 'Дом', true, 1700, 22, true, '💡'),
  ('Подарочный набор кофе', 'Набор зернового кофе', 'Подарки', true, 1200, 30, true, '☕'),
  ('Выходной на 1 день', 'Дополнительный оплачиваемый выходной', 'Привилегии', false, 4000, null, true, '🏖️'),
  ('Поздний старт на 2 часа', 'Начало рабочего дня на 2 часа позже', 'Привилегии', false, 900, null, true, '⏰'),
  ('Ранний уход на 2 часа', 'Завершение рабочего дня на 2 часа раньше', 'Привилегии', false, 900, null, true, '🚶'),
  ('Онлайн-курс по выбору', 'Оплата онлайн-курса до 3000 ₽', 'Обучение', false, 2500, null, true, '🎓'),
  ('Сертификат Ozon', 'Электронный сертификат номиналом 3000 ₽', 'Сертификаты', false, 3000, null, true, '🎁'),
  ('Сертификат Яндекс Еда', 'Электронный сертификат номиналом 2000 ₽', 'Сертификаты', false, 2000, null, true, '🍔'),
  ('Билеты в кино', '2 билета в кинотеатр', 'Досуг', false, 1800, null, true, '🎬'),
  ('Абонемент в спортзал', '1 месяц посещений', 'Здоровье', false, 3500, null, true, '🏋️'),
  ('Консультация психолога', 'Онлайн-сессия 60 минут', 'Здоровье', false, 2200, null, true, '🧠'),
  ('День без звонков', 'Рабочий день без входящих звонков', 'Привилегии', false, 1200, null, true, '🔕'),
  ('Сессия с наставником', 'Индивидуальная консультация 1 час', 'Развитие', false, 1500, null, true, '🧭'),
  ('Сессия с директором', 'Персональная встреча 30 минут', 'Развитие', false, 2800, null, true, '💼'),
  ('Доступ к конференции', 'Билет на профильную конференцию', 'Обучение', false, 3200, null, true, '🎤'),
  ('Бонусный обед', 'Корпоративный обед за счет компании', 'Питание', false, 800, null, true, '🍽️'),
  ('Мастер-класс', 'Групповой практический мастер-класс', 'Обучение', false, 1600, null, true, '🛠️')
on conflict do nothing;
create index if not exists document_templates_folder_idx on public.document_templates(folder);
create index if not exists kb_articles_title_trgm_idx on public.kb_articles using gin (title gin_trgm_ops);
create index if not exists kb_articles_content_trgm_idx on public.kb_articles using gin (content gin_trgm_ops);
create index if not exists lms_courses_title_trgm_idx on public.lms_courses using gin (title gin_trgm_ops);
create index if not exists lms_courses_description_trgm_idx on public.lms_courses using gin (coalesce(description, '') gin_trgm_ops);
create index if not exists lms_subsections_markdown_trgm_idx on public.lms_subsections using gin (markdown_content gin_trgm_ops);

alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.news enable row level security;
alter table public.news_images enable row level security;
alter table public.kb_articles enable row level security;
alter table public.courses enable row level security;
alter table public.attestations enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.document_templates enable row level security;
alter table public.document_approval_routes enable row level security;
alter table public.document_approval_route_steps enable row level security;
alter table public.audit_log enable row level security;
alter table public.kb_article_versions enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_attempts enable row level security;
alter table public.course_questions enable row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_sections enable row level security;
alter table public.lms_subsections enable row level security;
alter table public.lms_media enable row level security;
alter table public.lms_course_versions enable row level security;
alter table public.lms_subsection_progress enable row level security;
alter table public.lms_course_assignments enable row level security;
alter table public.sla_escalation_matrix enable row level security;
alter table public.report_delivery_schedules enable row level security;
alter table public.report_delivery_runs enable row level security;
alter table public.notification_integrations enable row level security;
alter table public.notification_delivery_log enable row level security;
alter table public.slo_alert_routing_policies enable row level security;
alter table public.document_approvals enable row level security;
alter table public.notifications enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

-- Backend uses service_role and can bypass RLS.
-- For any direct client-side Supabase access we apply role/office-aware RLS.

create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_profile_office_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.office_id
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.is_admin_or_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('admin', 'director'), false);
$$;

create or replace function public.can_read_office(target_office_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      public.current_profile_role() in ('admin', 'director')
      or (
        public.current_profile_role() in ('office_head', 'operator')
        and target_office_id = public.current_profile_office_id()
      ),
      false
    );
$$;

drop policy if exists "read offices" on public.offices;
drop policy if exists "read profiles" on public.profiles;
drop policy if exists "read news" on public.news;
drop policy if exists "read kb" on public.kb_articles;
drop policy if exists "read courses" on public.courses;
drop policy if exists "read attestations" on public.attestations;
drop policy if exists "read tasks" on public.tasks;
drop policy if exists "read documents" on public.documents;
drop policy if exists "read audit" on public.audit_log;
drop policy if exists "read kb versions" on public.kb_article_versions;
drop policy if exists "read course assignments" on public.course_assignments;
drop policy if exists "read course attempts" on public.course_attempts;
drop policy if exists "read course questions" on public.course_questions;
drop policy if exists "read document approvals" on public.document_approvals;
drop policy if exists "read notifications" on public.notifications;
drop policy if exists "read own profile" on public.profiles;
drop policy if exists "read office profiles" on public.profiles;
drop policy if exists "read admin profiles" on public.profiles;
drop policy if exists "read published news" on public.news;
drop policy if exists "read admin news" on public.news;
drop policy if exists "read published kb" on public.kb_articles;
drop policy if exists "read admin kb" on public.kb_articles;
drop policy if exists "read published courses" on public.courses;
drop policy if exists "read admin courses" on public.courses;
drop policy if exists "read own attestations" on public.attestations;
drop policy if exists "read office attestations" on public.attestations;
drop policy if exists "read admin attestations" on public.attestations;
drop policy if exists "read own tasks" on public.tasks;
drop policy if exists "read office tasks" on public.tasks;
drop policy if exists "read admin tasks" on public.tasks;
drop policy if exists "read own documents" on public.documents;
drop policy if exists "read office documents" on public.documents;
drop policy if exists "read admin documents" on public.documents;
drop policy if exists "read published document templates" on public.document_templates;
drop policy if exists "read admin document templates" on public.document_templates;
drop policy if exists "read document routes" on public.document_approval_routes;
drop policy if exists "read document route steps" on public.document_approval_route_steps;
drop policy if exists "read admin document routes" on public.document_approval_routes;
drop policy if exists "read admin document route steps" on public.document_approval_route_steps;
drop policy if exists "read admin audit only" on public.audit_log;
drop policy if exists "read admin kb versions only" on public.kb_article_versions;
drop policy if exists "read own course assignments" on public.course_assignments;
drop policy if exists "read office course assignments" on public.course_assignments;
drop policy if exists "read admin course assignments" on public.course_assignments;
drop policy if exists "read own course attempts" on public.course_attempts;
drop policy if exists "read office course attempts" on public.course_attempts;
drop policy if exists "read admin course attempts" on public.course_attempts;
drop policy if exists "read published course questions" on public.course_questions;
drop policy if exists "read admin course questions" on public.course_questions;
drop policy if exists "read own document approvals" on public.document_approvals;
drop policy if exists "read office document approvals" on public.document_approvals;
drop policy if exists "read admin document approvals" on public.document_approvals;
drop policy if exists "read own notifications" on public.notifications;
drop policy if exists "read admin notifications" on public.notifications;
drop policy if exists "read published news images" on public.news_images;
drop policy if exists "read admin news images" on public.news_images;

create policy "read offices" on public.offices
for select to authenticated
using (true);

create policy "read own profile" on public.profiles
for select to authenticated
using (id = auth.uid());

create policy "read office profiles" on public.profiles
for select to authenticated
using (
  public.current_profile_role() in ('office_head', 'operator')
  and office_id = public.current_profile_office_id()
);

create policy "read admin profiles" on public.profiles
for select to authenticated
using (public.is_admin_or_director());

create policy "read published news" on public.news
for select to authenticated
using (status = 'published');

create policy "read admin news" on public.news
for select to authenticated
using (public.is_admin_or_director());

create policy "read published news images" on public.news_images
for select to authenticated
using (
  exists (
    select 1
    from public.news n
    where n.id = public.news_images.news_id
      and n.status = 'published'
  )
);

create policy "read admin news images" on public.news_images
for select to authenticated
using (public.is_admin_or_director());

create policy "read published kb" on public.kb_articles
for select to authenticated
using (status = 'published');

create policy "read admin kb" on public.kb_articles
for select to authenticated
using (public.is_admin_or_director());

create policy "read published courses" on public.courses
for select to authenticated
using (status = 'published');

create policy "read admin courses" on public.courses
for select to authenticated
using (public.is_admin_or_director());

create policy "read own attestations" on public.attestations
for select to authenticated
using (user_id = auth.uid());

create policy "read office attestations" on public.attestations
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1
    from public.profiles p
    where p.id = public.attestations.user_id
      and p.office_id = public.current_profile_office_id()
  )
);

create policy "read admin attestations" on public.attestations
for select to authenticated
using (public.is_admin_or_director());

create policy "read own tasks" on public.tasks
for select to authenticated
using (assignee_id = auth.uid());

create policy "read office tasks" on public.tasks
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and office_id = public.current_profile_office_id()
);

create policy "read admin tasks" on public.tasks
for select to authenticated
using (public.is_admin_or_director());

create policy "read own documents" on public.documents
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.full_name = public.documents.author
  )
);

create policy "read office documents" on public.documents
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and office_id = public.current_profile_office_id()
);

create policy "read admin documents" on public.documents
for select to authenticated
using (public.is_admin_or_director());

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

create policy "read admin audit only" on public.audit_log
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin kb versions only" on public.kb_article_versions
for select to authenticated
using (public.is_admin_or_director());

create policy "read own course assignments" on public.course_assignments
for select to authenticated
using (user_id = auth.uid());

create policy "read office course assignments" on public.course_assignments
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1
    from public.profiles p
    where p.id = public.course_assignments.user_id
      and p.office_id = public.current_profile_office_id()
  )
);

create policy "read admin course assignments" on public.course_assignments
for select to authenticated
using (public.is_admin_or_director());

create policy "read own course attempts" on public.course_attempts
for select to authenticated
using (user_id = auth.uid());

create policy "read office course attempts" on public.course_attempts
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1
    from public.profiles p
    where p.id = public.course_attempts.user_id
      and p.office_id = public.current_profile_office_id()
  )
);

create policy "read admin course attempts" on public.course_attempts
for select to authenticated
using (public.is_admin_or_director());

create policy "read published course questions" on public.course_questions
for select to authenticated
using (
  exists (
    select 1
    from public.courses c
    where c.id = public.course_questions.course_id
      and c.status = 'published'
  )
);

create policy "read admin course questions" on public.course_questions
for select to authenticated
using (public.is_admin_or_director());

create policy "read own document approvals" on public.document_approvals
for select to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.profiles p on p.id = auth.uid()
    where d.id = public.document_approvals.document_id
      and d.author = p.full_name
  )
);

create policy "read office document approvals" on public.document_approvals
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1
    from public.documents d
    where d.id = public.document_approvals.document_id
      and d.office_id = public.current_profile_office_id()
  )
);

create policy "read admin document approvals" on public.document_approvals
for select to authenticated
using (public.is_admin_or_director());

create policy "read own notifications" on public.notifications
for select to authenticated
using (recipient_user_id = auth.uid());

create policy "read admin notifications" on public.notifications
for select to authenticated
using (public.is_admin_or_director());

drop policy if exists "read published lms courses" on public.lms_courses;
drop policy if exists "read admin lms courses" on public.lms_courses;
drop policy if exists "read published lms sections" on public.lms_sections;
drop policy if exists "read admin lms sections" on public.lms_sections;
drop policy if exists "read published lms subsections" on public.lms_subsections;
drop policy if exists "read admin lms subsections" on public.lms_subsections;
drop policy if exists "read published lms media" on public.lms_media;
drop policy if exists "read admin lms media" on public.lms_media;
drop policy if exists "read admin lms versions" on public.lms_course_versions;
drop policy if exists "read own lms progress" on public.lms_subsection_progress;
drop policy if exists "read admin lms progress" on public.lms_subsection_progress;
drop policy if exists "write own lms progress" on public.lms_subsection_progress;
drop policy if exists "read own lms assignments" on public.lms_course_assignments;
drop policy if exists "read office lms assignments" on public.lms_course_assignments;
drop policy if exists "read admin lms assignments" on public.lms_course_assignments;
drop policy if exists "read admin sla matrix" on public.sla_escalation_matrix;
drop policy if exists "read admin report schedules" on public.report_delivery_schedules;
drop policy if exists "read own report runs" on public.report_delivery_runs;
drop policy if exists "read admin report runs" on public.report_delivery_runs;
drop policy if exists "read admin notification integrations" on public.notification_integrations;
drop policy if exists "read admin notification delivery logs" on public.notification_delivery_log;
drop policy if exists "read admin slo routing policies" on public.slo_alert_routing_policies;

create policy "read published lms courses" on public.lms_courses
for select to authenticated
using (status = 'published');

create policy "read admin lms courses" on public.lms_courses
for select to authenticated
using (public.is_admin_or_director());

create policy "read published lms sections" on public.lms_sections
for select to authenticated
using (
  exists (
    select 1
    from public.lms_courses c
    where c.id = public.lms_sections.course_id
      and c.status = 'published'
  )
);

create policy "read admin lms sections" on public.lms_sections
for select to authenticated
using (public.is_admin_or_director());

create policy "read published lms subsections" on public.lms_subsections
for select to authenticated
using (
  exists (
    select 1
    from public.lms_sections s
    join public.lms_courses c on c.id = s.course_id
    where s.id = public.lms_subsections.section_id
      and c.status = 'published'
  )
);

create policy "read admin lms subsections" on public.lms_subsections
for select to authenticated
using (public.is_admin_or_director());

create policy "read published lms media" on public.lms_media
for select to authenticated
using (
  exists (
    select 1
    from public.lms_subsections ss
    join public.lms_sections s on s.id = ss.section_id
    join public.lms_courses c on c.id = s.course_id
    where ss.id = public.lms_media.subsection_id
      and c.status = 'published'
  )
);

create policy "read admin lms media" on public.lms_media
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin lms versions" on public.lms_course_versions
for select to authenticated
using (public.is_admin_or_director());

create policy "read own lms progress" on public.lms_subsection_progress
for select to authenticated
using (user_id = auth.uid());

create policy "read admin lms progress" on public.lms_subsection_progress
for select to authenticated
using (public.is_admin_or_director());

create policy "write own lms progress" on public.lms_subsection_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

create policy "read admin sla matrix" on public.sla_escalation_matrix
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin report schedules" on public.report_delivery_schedules
for select to authenticated
using (public.is_admin_or_director());

create policy "read own report runs" on public.report_delivery_runs
for select to authenticated
using (recipient_user_id = auth.uid());

create policy "read admin report runs" on public.report_delivery_runs
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin notification integrations" on public.notification_integrations
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin notification delivery logs" on public.notification_delivery_log
for select to authenticated
using (public.is_admin_or_director());

create policy "read admin slo routing policies" on public.slo_alert_routing_policies
for select to authenticated
using (public.is_admin_or_director());

-- Enable RLS for quiz tables
alter table public.lms_quizzes enable row level security;
alter table public.lms_quiz_questions enable row level security;
alter table public.lms_quiz_options enable row level security;
alter table public.lms_quiz_matching_pairs enable row level security;
alter table public.lms_quiz_attempts enable row level security;
alter table public.lms_quiz_progress enable row level security;

-- RLS Policies for lms_quizzes
create policy "read published lms quizzes" on public.lms_quizzes
for select to authenticated
using (
  status = 'published'
  or exists (
    select 1 from public.lms_courses c
    where c.id = public.lms_quizzes.course_id
    and c.status = 'published'
  )
);

create policy "read admin lms quizzes" on public.lms_quizzes
for select to authenticated
using (public.is_admin_or_director());

-- RLS Policies for lms_quiz_questions
create policy "read published lms quiz questions" on public.lms_quiz_questions
for select to authenticated
using (
  exists (
    select 1 from public.lms_quizzes q
    where q.id = public.lms_quiz_questions.quiz_id
    and q.status = 'published'
  )
);

create policy "read admin lms quiz questions" on public.lms_quiz_questions
for select to authenticated
using (public.is_admin_or_director());

-- RLS Policies for lms_quiz_options
create policy "read published lms quiz options" on public.lms_quiz_options
for select to authenticated
using (
  exists (
    select 1 from public.lms_quiz_questions qq
    join public.lms_quizzes q on q.id = qq.quiz_id
    where qq.id = public.lms_quiz_options.question_id
    and q.status = 'published'
  )
);

create policy "read admin lms quiz options" on public.lms_quiz_options
for select to authenticated
using (public.is_admin_or_director());

-- RLS Policies for lms_quiz_matching_pairs
create policy "read published lms quiz matching pairs" on public.lms_quiz_matching_pairs
for select to authenticated
using (
  exists (
    select 1 from public.lms_quiz_questions qq
    join public.lms_quizzes q on q.id = qq.quiz_id
    where qq.id = public.lms_quiz_matching_pairs.question_id
    and q.status = 'published'
  )
);

create policy "read admin lms quiz matching pairs" on public.lms_quiz_matching_pairs
for select to authenticated
using (public.is_admin_or_director());

-- RLS Policies for lms_quiz_attempts
create policy "read own lms quiz attempts" on public.lms_quiz_attempts
for select to authenticated
using (user_id = auth.uid());

create policy "read office lms quiz attempts" on public.lms_quiz_attempts
for select to authenticated
using (
  public.current_profile_role() = 'office_head'
  and exists (
    select 1 from public.profiles p
    where p.id = public.lms_quiz_attempts.user_id
    and p.office_id = public.current_profile_office_id()
  )
);

create policy "read admin lms quiz attempts" on public.lms_quiz_attempts
for select to authenticated
using (public.is_admin_or_director());

create policy "write own lms quiz attempts" on public.lms_quiz_attempts
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- RLS Policies for lms_quiz_progress
create policy "read own lms quiz progress" on public.lms_quiz_progress
for select to authenticated
using (user_id = auth.uid());

create policy "write own lms quiz progress" on public.lms_quiz_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Indexes for quiz tables
create index if not exists lms_quizzes_course_idx on public.lms_quizzes(course_id);
create index if not exists lms_quizzes_subsection_idx on public.lms_quizzes(subsection_id);
create index if not exists lms_quizzes_status_idx on public.lms_quizzes(status);
create index if not exists lms_quiz_questions_quiz_idx on public.lms_quiz_questions(quiz_id);
create index if not exists lms_quiz_options_question_idx on public.lms_quiz_options(question_id);
create index if not exists lms_quiz_matching_pairs_question_idx on public.lms_quiz_matching_pairs(question_id);
create index if not exists lms_quiz_attempts_quiz_user_idx on public.lms_quiz_attempts(quiz_id, user_id);
create index if not exists lms_quiz_attempts_user_created_idx on public.lms_quiz_attempts(user_id, created_at desc);
create index if not exists lms_quiz_progress_quiz_user_idx on public.lms_quiz_progress(quiz_id, user_id);
