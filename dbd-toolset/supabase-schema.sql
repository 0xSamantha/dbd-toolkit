-- Run once in the SQL Editor of your own Supabase project.
-- Authentication > Email: enable Confirm Email and require >= 12-character passwords.
begin;
create or replace function public.fog_verified_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;
revoke all on function public.fog_verified_user() from public, anon;
grant execute on function public.fog_verified_user() to authenticated;

create or replace function public.fog_valid_match(doc jsonb, record_id bigint)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(doc) is distinct from 'object' then return false; end if;
  if not (doc ?& array['id','date','role','character','result','perks','notes']) then return false; end if;
  if jsonb_typeof(doc->'id') is distinct from 'number' or doc->>'id' <> record_id::text then return false; end if;
  if jsonb_typeof(doc->'date') is distinct from 'string' or doc->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  if jsonb_typeof(doc->'character') is distinct from 'string' or length(doc->>'character') > 80 then return false; end if;
  if jsonb_typeof(doc->'notes') is distinct from 'string' or length(doc->>'notes') > 300 then return false; end if;
  if doc->>'role' = 'S' then
    if jsonb_typeof(doc->'result') is distinct from 'string' or doc->>'result' not in ('Escaped','Died') then return false; end if;
  elsif doc->>'role' = 'K' then
    if jsonb_typeof(doc->'result') is distinct from 'number' or doc->>'result' not in ('0','1','2','3','4') then return false; end if;
  else return false;
  end if;
  if jsonb_typeof(doc->'perks') is distinct from 'array' then return false; end if;
  if jsonb_array_length(doc->'perks') > 4 then return false; end if;
  for item in select value from jsonb_array_elements(doc->'perks') loop
    if jsonb_typeof(item) is distinct from 'string' or length(item #>> '{}') > 120 then return false; end if;
  end loop;
  return true;
end;
$$;
create table if not exists public.matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null check (id > 0 and id <= 9007199254740991),
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,id),
  constraint valid_match check(public.fog_valid_match(data,id))
);
alter table public.matches enable row level security;
revoke all on public.matches from anon;
grant select,insert,update,delete on public.matches to authenticated;
drop policy if exists fog_own_matches on public.matches;
create policy fog_own_matches on public.matches for all to authenticated
  using (user_id = (select auth.uid()) and (select public.fog_verified_user()))
  with check (user_id = (select auth.uid()) and (select public.fog_verified_user()));
commit;
