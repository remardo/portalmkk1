-- Run in Supabase SQL Editor
create extension if not exists pgcrypto;

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

alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.news enable row level security;
alter table public.kb_articles enable row level security;
alter table public.courses enable row level security;
alter table public.attestations enable row level security;
alter table public.tasks enable row level security;
alter table public.documents enable row level security;
alter table public.audit_log enable row level security;
alter table public.kb_article_versions enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_attempts enable row level security;
alter table public.course_questions enable row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_sections enable row level security;
alter table public.lms_subsections enable row level security;
alter table public.lms_media enable row level security;
alter table public.document_approvals enable row level security;
alter table public.notifications enable row level security;

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
