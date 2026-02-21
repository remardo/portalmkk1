create unique index if not exists crm_calls_provider_external_call_uidx
  on public.crm_calls(provider, external_call_id)
  where external_call_id is not null;
