-- Existing sites: run this once in Supabase SQL Editor to enable private observed-build logs.
-- Requires fog_verified_user() from the original supabase-schema.sql setup.
begin;
create or replace function public.fog_valid_observed(doc jsonb, record_id bigint)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(doc) is distinct from 'object' then return false; end if;
  if not (doc ?& array['id','date','role','player','character','perks','notes']) then return false; end if;
  if jsonb_typeof(doc->'id') is distinct from 'number' or doc->>'id' <> record_id::text then return false; end if;
  if jsonb_typeof(doc->'date') is distinct from 'string' or doc->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  if jsonb_typeof(doc->'role') is distinct from 'string' or doc->>'role' not in ('S','K') then return false; end if;
  if jsonb_typeof(doc->'player') is distinct from 'string' or length(doc->>'player') > 80 then return false; end if;
  if jsonb_typeof(doc->'character') is distinct from 'string' or length(doc->>'character') > 80 then return false; end if;
  if jsonb_typeof(doc->'notes') is distinct from 'string' or length(doc->>'notes') > 1000 then return false; end if;
  if jsonb_typeof(doc->'perks') is distinct from 'array' then return false; end if;
  if jsonb_array_length(doc->'perks') > 4 then return false; end if;
  if (select count(distinct value) from jsonb_array_elements(doc->'perks')) <> jsonb_array_length(doc->'perks') then return false; end if;
  for item in select value from jsonb_array_elements(doc->'perks') loop
    if jsonb_typeof(item) is distinct from 'string' or length(item #>> '{}') > 120 then return false; end if;
  end loop;
  return true;
end;
$$;
create table if not exists public.observed_builds (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null check (id > 0 and id <= 9007199254740991),
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  constraint valid_observed_build check(public.fog_valid_observed(data,id))
);
alter table public.observed_builds enable row level security;
revoke all on public.observed_builds from anon;
grant select,insert,update,delete on public.observed_builds to authenticated;
drop policy if exists fog_own_observed on public.observed_builds;
create policy fog_own_observed on public.observed_builds for all to authenticated
  using (user_id = (select auth.uid()) and (select public.fog_verified_user()))
  with check (user_id = (select auth.uid()) and (select public.fog_verified_user()));
commit;
