create extension if not exists vector;

create table if not exists public.kb_article_chunks (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.kb_articles(id) on delete cascade,
  chunk_no int not null,
  content_chunk text not null,
  embedding vector(1536) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  unique (article_id, chunk_no)
);

create index if not exists kb_article_chunks_article_idx on public.kb_article_chunks(article_id);
create index if not exists kb_article_chunks_embedding_idx
  on public.kb_article_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.kb_article_chunks enable row level security;

drop policy if exists "read published kb chunks" on public.kb_article_chunks;
drop policy if exists "read admin kb chunks" on public.kb_article_chunks;

create policy "read published kb chunks" on public.kb_article_chunks
for select to authenticated
using (
  exists (
    select 1
    from public.kb_articles a
    where a.id = public.kb_article_chunks.article_id
      and a.status = 'published'
  )
);

create policy "read admin kb chunks" on public.kb_article_chunks
for select to authenticated
using (public.is_admin_or_director());

create or replace function public.match_kb_article_chunks(
  query_embedding_text text,
  match_count int default 6,
  min_similarity float default 0.55
)
returns table (
  article_id bigint,
  chunk_id bigint,
  title text,
  category text,
  content_chunk text,
  similarity float4
)
language sql
stable
as $$
  select
    c.article_id,
    c.id as chunk_id,
    a.title,
    a.category,
    c.content_chunk,
    (1 - (c.embedding <=> query_embedding_text::vector(1536)))::real as similarity
  from public.kb_article_chunks c
  join public.kb_articles a on a.id = c.article_id
  where
    a.status = 'published'
    and (1 - (c.embedding <=> query_embedding_text::vector(1536))) >= min_similarity
  order by c.embedding <=> query_embedding_text::vector(1536)
  limit greatest(match_count, 1);
$$;
