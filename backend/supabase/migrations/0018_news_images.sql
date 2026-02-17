alter table public.news
  add column if not exists cover_image_data_base64 text null,
  add column if not exists cover_image_mime_type text null;

create table if not exists public.news_images (
  id bigint generated always as identity primary key,
  news_id bigint null references public.news(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  image_data_base64 text not null,
  image_mime_type text not null,
  caption text null,
  created_at timestamptz not null default now()
);

create index if not exists news_images_news_id_idx on public.news_images(news_id);
create index if not exists news_images_created_at_idx on public.news_images(created_at desc);

alter table public.news_images enable row level security;

drop policy if exists "read published news images" on public.news_images;
drop policy if exists "read admin news images" on public.news_images;

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

