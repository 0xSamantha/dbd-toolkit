-- Existing installations: run in Supabase SQL Editor to allow Draw and Surrendered.
-- Keeps all current match rows and ownership policies.
begin;
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
    if jsonb_typeof(doc->'result') is distinct from 'string' or doc->>'result' not in ('Escaped','Died','Draw','Surrendered') then return false; end if;
  elsif doc->>'role' = 'K' then
    if not ((jsonb_typeof(doc->'result') = 'number' and doc->>'result' in ('0','1','2','3','4')) or (jsonb_typeof(doc->'result') = 'string' and doc->>'result' in ('Draw','Surrendered'))) then return false; end if;
    if doc->'result' = 'null'::jsonb then return false; end if;
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
commit;
