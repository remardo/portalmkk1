-- Migration: Add quizzes and tests support to LMS
-- Description: Adds tables for quizzes, quiz questions, and quiz attempts

-- Quiz types: quiz (тест), survey (опрос), exam (экзамен)
create type public.lms_quiz_type as enum ('quiz', 'survey', 'exam');

-- Question types: single_choice, multiple_choice, text_answer, matching, ordering
create type public.lms_question_type as enum ('single_choice', 'multiple_choice', 'text_answer', 'matching', 'ordering');

-- Create quizzes table (can be attached to subsections or standalone)
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

-- Create quiz questions table
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

-- Create quiz question options (for choice-based questions)
create table if not exists public.lms_quiz_options (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.lms_quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

-- Create quiz matching pairs (for matching questions)
create table if not exists public.lms_quiz_matching_pairs (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.lms_quiz_questions(id) on delete cascade,
  left_text text not null,
  right_text text not null,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

-- Create quiz attempts table
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

-- Create quiz progress tracking (for resuming incomplete attempts)
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

-- Create indexes for performance
create index if not exists lms_quizzes_course_idx on public.lms_quizzes(course_id);
create index if not exists lms_quizzes_subsection_idx on public.lms_quizzes(subsection_id);
create index if not exists lms_quizzes_status_idx on public.lms_quizzes(status);
create index if not exists lms_quiz_questions_quiz_idx on public.lms_quiz_questions(quiz_id);
create index if not exists lms_quiz_options_question_idx on public.lms_quiz_options(question_id);
create index if not exists lms_quiz_matching_pairs_question_idx on public.lms_quiz_matching_pairs(question_id);
create index if not exists lms_quiz_attempts_quiz_user_idx on public.lms_quiz_attempts(quiz_id, user_id);
create index if not exists lms_quiz_attempts_user_created_idx on public.lms_quiz_attempts(user_id, created_at desc);
create index if not exists lms_quiz_progress_quiz_user_idx on public.lms_quiz_progress(quiz_id, user_id);

-- Enable RLS
alter table public.lms_quizzes enable row level security;
alter table public.lms_quiz_questions enable row level security;
alter table public.lms_quiz_options enable row level security;
alter table public.lms_quiz_matching_pairs enable row level security;
alter table public.lms_quiz_attempts enable row level security;
alter table public.lms_quiz_progress enable row level security;

-- RLS Policies for lms_quizzes
drop policy if exists "read published lms quizzes" on public.lms_quizzes;
drop policy if exists "read admin lms quizzes" on public.lms_quizzes;

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
drop policy if exists "read published lms quiz questions" on public.lms_quiz_questions;
drop policy if exists "read admin lms quiz questions" on public.lms_quiz_questions;

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
using (
  exists (
    select 1 from public.lms_quizzes q
    where q.id = public.lms_quiz_questions.quiz_id
    and public.is_admin_or_director()
  )
);

-- RLS Policies for lms_quiz_options
drop policy if exists "read published lms quiz options" on public.lms_quiz_options;
drop policy if exists "read admin lms quiz options" on public.lms_quiz_options;

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
drop policy if exists "read published lms quiz matching pairs" on public.lms_quiz_matching_pairs;
drop policy if exists "read admin lms quiz matching pairs" on public.lms_quiz_matching_pairs;

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
drop policy if exists "read own lms quiz attempts" on public.lms_quiz_attempts;
drop policy if exists "read office lms quiz attempts" on public.lms_quiz_attempts;
drop policy if exists "read admin lms quiz attempts" on public.lms_quiz_attempts;
drop policy if exists "write own lms quiz attempts" on public.lms_quiz_attempts;

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
drop policy if exists "read own lms quiz progress" on public.lms_quiz_progress;
drop policy if exists "write own lms quiz progress" on public.lms_quiz_progress;

create policy "read own lms quiz progress" on public.lms_quiz_progress
for select to authenticated
using (user_id = auth.uid());

create policy "write own lms quiz progress" on public.lms_quiz_progress
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Add updated_at trigger for quizzes
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_lms_quizzes_updated_at on public.lms_quizzes;
create trigger update_lms_quizzes_updated_at
before update on public.lms_quizzes
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_lms_quiz_questions_updated_at on public.lms_quiz_questions;
create trigger update_lms_quiz_questions_updated_at
before update on public.lms_quiz_questions
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_lms_quiz_progress_updated_at on public.lms_quiz_progress;
create trigger update_lms_quiz_progress_updated_at
before update on public.lms_quiz_progress
for each row
execute function public.update_updated_at_column();
