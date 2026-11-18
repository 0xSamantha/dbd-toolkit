begin;

create table public.hardcore_runs (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 1048576),
  revision bigint not null check (revision >= 0)
);

alter table public.hardcore_runs enable row level security;
revoke all on public.hardcore_runs from public, anon, authenticated;
grant select, insert, update on public.hardcore_runs to authenticated;

create policy "Owners manage their runs" on public.hardcore_runs
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and (select public.fog_verified_user()));

create function public.hardcore_publish(run_id uuid, run_snapshot jsonb, run_revision bigint)
returns boolean language sql security invoker set search_path = '' as $$
  with saved as (
    insert into public.hardcore_runs (id, snapshot, revision)
    values (run_id, run_snapshot, run_revision)
    on conflict (id) do update set snapshot = excluded.snapshot, revision = excluded.revision
    where public.hardcore_runs.revision < excluded.revision
       or (public.hardcore_runs.revision = excluded.revision and public.hardcore_runs.snapshot = excluded.snapshot)
    returning id
  )
  select exists (select 1 from saved);
$$;

create function public.hardcore_view(run_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select snapshot from public.hardcore_runs where id = run_id;
$$;

revoke all on function public.hardcore_publish(uuid, jsonb, bigint) from public, anon;
grant execute on function public.hardcore_publish(uuid, jsonb, bigint) to authenticated;
revoke all on function public.hardcore_view(uuid) from public;
grant execute on function public.hardcore_view(uuid) to anon, authenticated;

commit;
