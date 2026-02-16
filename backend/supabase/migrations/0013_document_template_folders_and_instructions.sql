alter table public.document_templates
  add column if not exists folder text not null default 'Общее',
  add column if not exists instruction text null;

create index if not exists document_templates_folder_idx on public.document_templates(folder);
