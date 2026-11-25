begin;

create table public.build_presets (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  name text not null check (char_length(name) between 1 and 40),
  role text not null check (role in ('S', 'K')),
  perks text[] not null check (
    array_ndims(perks) = 1 and cardinality(perks) between 1 and 4
    and array_position(perks, null) is null and char_length(array_to_string(perks, '')) <= 480
  ),
  primary key (user_id, slot)
);

alter table public.build_presets enable row level security;
revoke all on public.build_presets from public, anon;
grant select, insert, update, delete on public.build_presets to authenticated;

create policy "Verified owners manage their presets" on public.build_presets
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.fog_verified_user()))
  with check ((select auth.uid()) = user_id and (select public.fog_verified_user()));

commit;
