\pset tuples_only on
\pset format unaligned

select 'profiles|' || count(*) from public.profiles;
select 'tasks|' || count(*) from public.tasks;
select 'documents|' || count(*) from public.documents;
select 'notifications|' || count(*) from public.notifications;
select 'lms_courses|' || count(*) from public.lms_courses;
select 'lms_subsections|' || count(*) from public.lms_subsections;
select 'invalid_progress|' || count(*)
from public.lms_subsection_progress
where progress_percent < 0 or progress_percent > 100;
