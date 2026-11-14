-- =============================================================================
-- Fog of the Dragon — running a session: sessions, session notes, shared maps with tokens
--
--   campaign_sessions        one row per played session (number, title, linked meeting, where the adventure was, encounter
--                            results). At most ONE active session per campaign: Start returns the active one instead of
--                            making a duplicate. Members can read the basics; only the DM starts, updates and ends them.
--   campaign_session_notes   the DM's private side of a session (detailed notes, events, NPCs, decisions, rewards, threads,
--                            hooks…). DM only, always. The player-facing recap stays a Logbook memory (visibility players),
--                            now linked to its session (campaign_memories.session_id). Existing memories are untouched.
--   campaign_maps            maps shared with the campaign: an image the DM published into the campaign bucket's "maps"
--                            folder (members can read it), a grid and the VISIBLE tokens. Players move only their own token,
--                            and only when the DM allows it (public.move_map_token checks).
--   campaign_map_dm          hidden tokens (monsters not revealed yet): DM only, in their own table so Realtime never sends
--                            them to players.
--   campaign_map_view        which map is on screen for the campaign now.
-- Run after 20261119120000_foggy_assistant.sql. Safe to run again.
-- =============================================================================

do $$
begin
  if to_regclass('public.campaign_memories') is null or to_regclass('public.campaign_meetings') is null then
    raise exception 'Run the earlier migrations first (20261113120000_campaign_refinements.sql and the ones after it).';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sessions
-- -----------------------------------------------------------------------------
alter table public.campaign_history drop constraint if exists campaign_history_kind_check;
alter table public.campaign_history add constraint campaign_history_kind_check check (kind in ('started', 'level_up', 'override', 'book_unlocked', 'session'));

create table if not exists public.campaign_sessions (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  number       integer not null check (number between 1 and 10000),
  title        text not null default '' check (char_length(title) <= 120),
  meeting_id   uuid references public.campaign_meetings (id) on delete set null,
  status       text not null default 'active' check (status in ('active', 'ended')),
  adventure_id uuid,
  position     jsonb check (position is null or (jsonb_typeof(position) = 'object' and octet_length(position::text) <= 2000)),
  results      jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array' and octet_length(results::text) <= 60000),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  created_by   uuid not null references auth.users (id) on delete cascade,
  unique (campaign_id, number),
  constraint campaign_sessions_ended check ((status = 'ended') = (ended_at is not null))
);
create unique index if not exists campaign_sessions_one_active on public.campaign_sessions (campaign_id) where status = 'active';

create table if not exists public.campaign_session_notes (
  session_id  uuid primary key references public.campaign_sessions (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  notes       text not null default '' check (char_length(notes) <= 40000),
  details     jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 80000),
  updated_at  timestamptz not null default now()
);

alter table public.campaign_memories add column if not exists session_id uuid references public.campaign_sessions (id) on delete set null;
grant insert (session_id) on public.campaign_memories to authenticated;
grant update (session_id) on public.campaign_memories to authenticated;

revoke all on public.campaign_sessions, public.campaign_session_notes from anon, authenticated;
grant select on public.campaign_sessions to authenticated;
grant select, insert, update on public.campaign_session_notes to authenticated;
alter table public.campaign_sessions enable row level security;
alter table public.campaign_session_notes enable row level security;
drop policy if exists "Sessions: members read" on public.campaign_sessions;
create policy "Sessions: members read" on public.campaign_sessions for select to authenticated
  using (private.is_campaign_owner(campaign_id) or private.is_active_campaign_member(campaign_id));
drop policy if exists "Session notes: the DM only" on public.campaign_session_notes;
create policy "Session notes: the DM only" on public.campaign_session_notes for all to authenticated
  using (private.is_campaign_owner(campaign_id)) with check (private.is_campaign_owner(campaign_id)
    and exists (select 1 from public.campaign_sessions s where s.id = session_id and s.campaign_id = campaign_session_notes.campaign_id));

-- Start (or return the session already running: never two).
create or replace function public.start_session(target_campaign uuid, p_meeting uuid default null, p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  n int;
  adv uuid;
  pos jsonb;
begin
  if not private.is_campaign_owner(target_campaign) then raise exception 'Only the Dungeon Master starts a session.' using errcode = '42501'; end if;
  if not private.campaign_is_active(target_campaign) then raise exception 'This campaign is archived.' using errcode = 'P0001'; end if;
  perform 1 from public.campaigns where id = target_campaign for update;
  select id into sid from public.campaign_sessions where campaign_id = target_campaign and status = 'active';
  if found then return sid; end if;
  if p_meeting is not null and not exists (select 1 from public.campaign_meetings m where m.id = p_meeting and m.campaign_id = target_campaign) then
    raise exception 'That meeting isn''t part of this campaign.' using errcode = '22023';
  end if;
  select coalesce(max(number), 0) + 1 into n from public.campaign_sessions where campaign_id = target_campaign;
  select c.adventure_id into adv from public.campaigns c where c.id = target_campaign;
  select jsonb_build_object('sectionId', p.current_section) into pos from public.campaign_progress p where p.campaign_id = target_campaign;
  insert into public.campaign_sessions (campaign_id, number, title, meeting_id, adventure_id, position, created_by)
  values (target_campaign, n, left(coalesce(nullif(btrim(p_title), ''), 'Session ' || n), 120), p_meeting, adv, pos, auth.uid())
  returning id into sid;
  insert into public.campaign_session_notes (session_id, campaign_id) values (sid, target_campaign);
  perform private.log_campaign(target_campaign, auth.uid(), 'session', 'Session ' || n || ' started.', '{}'::jsonb);
  return sid;
end;
$$;

create or replace function public.update_session(p_session uuid, p_title text default null, p_position jsonb default null, p_result jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.campaign_sessions%rowtype;
begin
  select * into s from public.campaign_sessions where id = p_session for update;
  if not found or not private.is_campaign_owner(s.campaign_id) then raise exception 'Only the Dungeon Master updates a session.' using errcode = '42501'; end if;
  if p_position is not null and (jsonb_typeof(p_position) <> 'object' or octet_length(p_position::text) > 2000) then raise exception 'Invalid position.' using errcode = '22023'; end if;
  if p_result is not null and (jsonb_typeof(p_result) <> 'object' or octet_length(p_result::text) > 6000) then raise exception 'Invalid result.' using errcode = '22023'; end if;
  update public.campaign_sessions set
    title = case when p_title is null then title else left(btrim(p_title), 120) end,
    position = coalesce(p_position, position),
    results = case when p_result is null then results
                   -- one result per combat (the same combat recorded twice replaces itself)
                   else (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(results) x where x ->> 'combatKey' is distinct from p_result ->> 'combatKey') || jsonb_build_array(p_result || jsonb_build_object('recordedAt', now())) end
  where id = p_session;
end;
$$;

create or replace function public.end_session(p_session uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.campaign_sessions%rowtype;
begin
  select * into s from public.campaign_sessions where id = p_session for update;
  if not found or not private.is_campaign_owner(s.campaign_id) then raise exception 'Only the Dungeon Master ends a session.' using errcode = '42501'; end if;
  if s.status = 'ended' then return 'ended'; end if;
  update public.campaign_sessions set status = 'ended', ended_at = now() where id = p_session;
  perform private.log_campaign(s.campaign_id, auth.uid(), 'session', 'Session ' || s.number || ' ended.', '{}'::jsonb);
  return 'ended';
end;
$$;

revoke all on function public.start_session(uuid, uuid, text), public.update_session(uuid, text, jsonb, jsonb), public.end_session(uuid) from public, anon;
grant execute on function public.start_session(uuid, uuid, text), public.update_session(uuid, text, jsonb, jsonb), public.end_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Shared maps and tokens
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_maps (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  key          text not null check (key ~ '^[A-Za-z0-9:_-]{1,160}$'),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  image_path   text not null check (image_path ~ '^[0-9a-f-]{36}/maps/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'),
  grid         jsonb not null default '{"cols":20,"rows":20}'::jsonb check (jsonb_typeof(grid) = 'object'),
  tokens       jsonb not null default '[]'::jsonb check (jsonb_typeof(tokens) = 'array' and jsonb_array_length(tokens) <= 80),
  players_move boolean not null default false,
  version      integer not null default 1,
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users (id) on delete cascade,
  unique (campaign_id, key)
);
create table if not exists public.campaign_map_dm (
  map_id      uuid primary key references public.campaign_maps (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tokens      jsonb not null default '[]'::jsonb check (jsonb_typeof(tokens) = 'array' and jsonb_array_length(tokens) <= 80)
);
create table if not exists public.campaign_map_view (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  map_id      uuid references public.campaign_maps (id) on delete set null,
  shown_at    timestamptz not null default now()
);
revoke all on public.campaign_maps, public.campaign_map_dm, public.campaign_map_view from anon, authenticated;
grant select on public.campaign_maps, public.campaign_map_dm, public.campaign_map_view to authenticated;
alter table public.campaign_maps enable row level security;
alter table public.campaign_map_dm enable row level security;
alter table public.campaign_map_view enable row level security;
drop policy if exists "Maps: members read" on public.campaign_maps;
create policy "Maps: members read" on public.campaign_maps for select to authenticated using (private.is_campaign_owner(campaign_id) or private.is_active_campaign_member(campaign_id));
drop policy if exists "Map hidden tokens: the DM only" on public.campaign_map_dm;
create policy "Map hidden tokens: the DM only" on public.campaign_map_dm for select to authenticated using (private.is_campaign_owner(campaign_id));
drop policy if exists "Map on screen: members read" on public.campaign_map_view;
create policy "Map on screen: members read" on public.campaign_map_view for select to authenticated using (private.is_campaign_owner(campaign_id) or private.is_active_campaign_member(campaign_id));

-- A token: { id, kind: pc|monster|npc|marker, label, userId?, combatantId?, x, y (grid cells), color }
create or replace function private.clean_tokens(t jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', left(x ->> 'id', 40), 'kind', case when x ->> 'kind' in ('pc', 'monster', 'npc', 'marker') then x ->> 'kind' else 'marker' end,
      'label', left(coalesce(x ->> 'label', ''), 40), 'userId', case when (x ->> 'userId') ~ '^[0-9a-f-]{36}$' then x ->> 'userId' end,
      'combatantId', left(x ->> 'combatantId', 40), 'x', greatest(0, least(200, coalesce((x ->> 'x')::numeric, 0))), 'y', greatest(0, least(200, coalesce((x ->> 'y')::numeric, 0))),
      'color', case when (x ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then x ->> 'color' end)), '[]'::jsonb)
  from jsonb_array_elements(coalesce(t, '[]'::jsonb)) x
  where coalesce(x ->> 'id', '') ~ '^[A-Za-z0-9_-]{1,40}$';
$$;

-- The DM publishes or updates a map (image already uploaded to <campaign>/maps/), its grid and tokens.
create or replace function public.save_map(target_campaign uuid, p_key text, p_title text, p_image text, p_grid jsonb, p_tokens jsonb, p_hidden jsonb, p_players_move boolean, p_expected integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.campaign_maps%rowtype;
begin
  if not private.is_campaign_owner(target_campaign) then raise exception 'Only the Dungeon Master shares maps.' using errcode = '42501'; end if;
  if not private.campaign_is_active(target_campaign) then raise exception 'This campaign is archived.' using errcode = 'P0001'; end if;
  if p_image is null or split_part(p_image, '/', 1) <> target_campaign::text then raise exception 'The map image must be in this campaign.' using errcode = '22023'; end if;
  select * into m from public.campaign_maps where campaign_id = target_campaign and key = p_key for update;
  if found then
    if p_expected is not null and p_expected <> m.version then raise exception 'The map was changed somewhere else. Reload it.' using errcode = 'P0001'; end if;
    update public.campaign_maps set title = left(btrim(p_title), 120), image_path = p_image, grid = coalesce(p_grid, grid), tokens = private.clean_tokens(p_tokens),
      players_move = coalesce(p_players_move, players_move), version = version + 1, updated_at = now() where id = m.id returning * into m;
  else
    insert into public.campaign_maps (campaign_id, key, title, image_path, grid, tokens, players_move, created_by)
    values (target_campaign, p_key, left(btrim(p_title), 120), p_image, coalesce(p_grid, '{"cols":20,"rows":20}'), private.clean_tokens(p_tokens), coalesce(p_players_move, false), auth.uid()) returning * into m;
  end if;
  insert into public.campaign_map_dm (map_id, campaign_id, tokens) values (m.id, target_campaign, private.clean_tokens(p_hidden))
  on conflict (map_id) do update set tokens = excluded.tokens;
  return jsonb_build_object('id', m.id, 'version', m.version);
end;
$$;

create or replace function public.show_map(target_campaign uuid, p_map uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_campaign_owner(target_campaign) then raise exception 'Only the Dungeon Master chooses the map.' using errcode = '42501'; end if;
  if p_map is not null and not exists (select 1 from public.campaign_maps where id = p_map and campaign_id = target_campaign) then raise exception 'Map not found.' using errcode = '22023'; end if;
  insert into public.campaign_map_view (campaign_id, map_id, shown_at) values (target_campaign, p_map, now())
  on conflict (campaign_id) do update set map_id = excluded.map_id, shown_at = now();
end;
$$;

-- Moving one token. The DM moves any token (visible or hidden); a player only their own visible token, when allowed.
create or replace function public.move_map_token(p_map uuid, p_token text, p_x numeric, p_y numeric)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.campaign_maps%rowtype;
  dm boolean;
begin
  select * into m from public.campaign_maps where id = p_map for update;
  if not found or not (private.is_campaign_owner(m.campaign_id) or private.is_active_campaign_member(m.campaign_id)) then raise exception 'Map not found.' using errcode = '42501'; end if;
  dm := private.is_campaign_owner(m.campaign_id);
  if not private.campaign_is_active(m.campaign_id) then raise exception 'This campaign is archived.' using errcode = 'P0001'; end if;
  p_x := greatest(0, least(coalesce((m.grid ->> 'cols')::numeric, 200) - 1, round(p_x * 2) / 2));
  p_y := greatest(0, least(coalesce((m.grid ->> 'rows')::numeric, 200) - 1, round(p_y * 2) / 2));
  if exists (select 1 from jsonb_array_elements(m.tokens) t where t ->> 'id' = p_token) then
    if not dm and not (m.players_move and exists (select 1 from jsonb_array_elements(m.tokens) t where t ->> 'id' = p_token and t ->> 'userId' = auth.uid()::text)) then
      raise exception 'You can only move your own token, when the Dungeon Master allows it.' using errcode = '42501';
    end if;
    update public.campaign_maps set tokens = (select jsonb_agg(case when t ->> 'id' = p_token then t || jsonb_build_object('x', p_x, 'y', p_y) else t end) from jsonb_array_elements(tokens) t),
      version = version + 1, updated_at = now() where id = p_map;
  elsif dm and exists (select 1 from public.campaign_map_dm d, jsonb_array_elements(d.tokens) t where d.map_id = p_map and t ->> 'id' = p_token) then
    update public.campaign_map_dm set tokens = (select jsonb_agg(case when t ->> 'id' = p_token then t || jsonb_build_object('x', p_x, 'y', p_y) else t end) from jsonb_array_elements(tokens) t) where map_id = p_map;
  else
    raise exception 'Token not found.' using errcode = '22023';
  end if;
  return (select version from public.campaign_maps where id = p_map);
end;
$$;

revoke all on function public.save_map(uuid, text, text, text, jsonb, jsonb, jsonb, boolean, integer), public.show_map(uuid, uuid), public.move_map_token(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.save_map(uuid, text, text, text, jsonb, jsonb, jsonb, boolean, integer), public.show_map(uuid, uuid), public.move_map_token(uuid, text, numeric, numeric) to authenticated;
revoke all on function private.clean_tokens(jsonb) from public, anon, authenticated;

-- Map images: <campaign>/maps/<file> in the campaign bucket — members read, the DM uploads (not tied to the Logbook plan).
create or replace function private.map_object_campaign(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/maps/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$' then split_part(name, '/', 1)::uuid end;
$$;
grant execute on function private.map_object_campaign(text) to authenticated;
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Map images: members read" on storage.objects';
    execute 'create policy "Map images: members read" on storage.objects for select to authenticated using (bucket_id = ''campaign-memories'' and private.map_object_campaign(name) is not null and ((select private.is_campaign_owner(private.map_object_campaign(name))) or (select private.is_active_campaign_member(private.map_object_campaign(name)))))';
    execute 'drop policy if exists "Map images: the DM uploads" on storage.objects';
    execute 'create policy "Map images: the DM uploads" on storage.objects for insert to authenticated with check (bucket_id = ''campaign-memories'' and private.map_object_campaign(name) is not null and (select private.is_campaign_owner(private.map_object_campaign(name))))';
    execute 'drop policy if exists "Map images: the DM deletes" on storage.objects';
    execute 'create policy "Map images: the DM deletes" on storage.objects for delete to authenticated using (bucket_id = ''campaign-memories'' and private.map_object_campaign(name) is not null and (select private.is_campaign_owner(private.map_object_campaign(name))))';
  end if;
end;
$$;

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    foreach t in array array['campaign_sessions', 'campaign_maps', 'campaign_map_view', 'campaign_map_dm'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
