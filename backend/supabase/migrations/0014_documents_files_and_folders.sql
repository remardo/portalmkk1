create table if not exists public.document_folders (
  id bigint generated always as identity primary key,
  name text not null,
  parent_id bigint null references public.document_folders(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists document_folders_unique_name_per_parent_idx
  on public.document_folders (coalesce(parent_id, 0), lower(name));
create index if not exists document_folders_parent_idx on public.document_folders(parent_id);

alter table public.documents
  add column if not exists folder_id bigint null references public.document_folders(id) on delete set null;

create index if not exists documents_folder_id_idx on public.documents(folder_id);

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

create index if not exists document_files_document_id_idx on public.document_files(document_id);
