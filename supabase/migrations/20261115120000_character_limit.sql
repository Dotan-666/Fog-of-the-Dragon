-- =============================================================================
-- Fog of the Dragon — character limit (Free plan: 3 characters per user)
--
-- Characters themselves are stored in the browser (JS/Dashboard/characters/character-store.js). This migration adds a
-- small server-side REGISTRY of which characters each user has (id + owner + deleted flag) so the limit is decided by the
-- database, not by JavaScript:
--   register_character()     hands out a slot for a new character, or refuses when the plan's limit is reached
--   unregister_character()   frees the slot when a character is deleted (deleted characters never count)
--   sync_character_registry() the first time a user's browser checks in, its existing characters are registered (even
--                            above the limit: nobody loses a character), after that only register_character() adds slots
--   character_usage()        { plan, limit, count, ids } for the "2 / 3 Characters" counter
-- Limits follow the pricing page: Warlord (Free) 3; Dungeon Master and Fogger of the Dragons unlimited.
-- Nobody can write the registry tables directly; every change goes through these functions.
-- Safe to run again.
-- =============================================================================

create table if not exists public.character_registry (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  character_id text not null check (character_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  primary key (user_id, character_id)
);

create table if not exists public.character_registry_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  adopted_at timestamptz not null default now()
);

revoke all on public.character_registry, public.character_registry_state from anon, authenticated;
grant select on public.character_registry to authenticated;
alter table public.character_registry enable row level security;
alter table public.character_registry_state enable row level security;
drop policy if exists "Character registry: read own" on public.character_registry;
create policy "Character registry: read own" on public.character_registry for select to authenticated using (user_id = (select auth.uid()));

-- null = unlimited
create or replace function private.character_limit(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case private.user_plan(uid) when 'warlord' then 3 else null end;
$$;
revoke all on function private.character_limit(uuid) from public, anon, authenticated;

create or replace function public.character_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', private.user_plan(auth.uid()),
    'limit', private.character_limit(auth.uid()),
    'count', (select count(*) from public.character_registry r where r.user_id = auth.uid() and r.deleted_at is null),
    'ids', coalesce((select jsonb_agg(r.character_id order by r.created_at) from public.character_registry r where r.user_id = auth.uid() and r.deleted_at is null), '[]'::jsonb),
    'adopted', exists (select 1 from public.character_registry_state s where s.user_id = auth.uid()));
$$;

create or replace function public.register_character(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  lim integer;
  used integer;
begin
  if me is null then
    raise exception 'Sign in to create characters.' using errcode = '28000';
  end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'That is not a valid character id.' using errcode = '22023';
  end if;
  -- One registration at a time per user, so two tabs can't both take the last slot.
  perform pg_advisory_xact_lock(hashtext('character_registry:' || me::text));
  if exists (select 1 from public.character_registry r where r.user_id = me and r.character_id = p_id and r.deleted_at is null) then
    return public.character_usage();
  end if;
  lim := private.character_limit(me);
  select count(*) into used from public.character_registry r where r.user_id = me and r.deleted_at is null;
  if lim is not null and used >= lim then
    raise exception 'Your % plan allows up to % characters. Delete one, or upgrade for unlimited characters.', 'Free', lim
      using errcode = 'P0001', hint = 'character_limit';
  end if;
  insert into public.character_registry (user_id, character_id) values (me, p_id)
  on conflict (user_id, character_id) do update set deleted_at = null, created_at = now();
  return public.character_usage();
end;
$$;

create or replace function public.unregister_character(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.character_registry r set deleted_at = now()
   where r.user_id = auth.uid() and r.character_id = p_id and r.deleted_at is null;
  return public.character_usage();
end;
$$;

create or replace function public.sync_character_registry(p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cid text;
begin
  if me is null then
    raise exception 'Sign in to create characters.' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext('character_registry:' || me::text));
  -- Only the very first check-in adopts what is already in the browser; later, new characters need register_character().
  if not exists (select 1 from public.character_registry_state s where s.user_id = me) then
    foreach cid in array coalesce(p_ids[1:200], '{}'::text[]) loop
      if cid ~ '^[A-Za-z0-9_-]{1,64}$' then
        insert into public.character_registry (user_id, character_id) values (me, cid) on conflict do nothing;
      end if;
    end loop;
    insert into public.character_registry_state (user_id) values (me);
  end if;
  return public.character_usage();
end;
$$;

revoke all on function public.character_usage() from public, anon;
revoke all on function public.register_character(text) from public, anon;
revoke all on function public.unregister_character(text) from public, anon;
revoke all on function public.sync_character_registry(text[]) from public, anon;
grant execute on function public.character_usage() to authenticated;
grant execute on function public.register_character(text) to authenticated;
grant execute on function public.unregister_character(text) to authenticated;
grant execute on function public.sync_character_registry(text[]) to authenticated;
