-- =============================================================================
-- Fog of the Dragon — Foggy assistant (chat, adventure writing, images, music plans, combat help, voice) and combat requests
--
-- Why new tables (everything else reuses what exists: adventures, homebrew, foggy_content drafts, campaign_combats):
--   foggy_threads / foggy_messages  a conversation must survive a reload and carry context between messages. One thread per
--                                   conversation, standalone (Dashboard) or tied to one campaign (Campaign Foggy, its DM).
--                                   A thread can hold a working draft (workspace: the adventure being written) that is only
--                                   copied into Adventures when the user saves it.
--   foggy_usage                     one row per AI call (text, image, audio) for the daily fair-use caps. Server-written.
--   foggy_images + bucket           generated pictures and maps (private files). Saved into an adventure by copying.
--   campaign_combat_requests        a player's attack is a REQUEST the Dungeon Master applies or rejects: players never
--                                   write the encounter (it stays DM-only, campaign_combats), so nobody can damage a
--                                   creature without the DM. One request per client key (no duplicates).
-- AI-written rows (assistant messages, images, usage) are inserted only by the Edge Functions with the service role.
-- Run after 20261118120300_meeting_in_the_fog.sql. Safe to run again.
-- =============================================================================

do $$
begin
  if to_regclass('public.foggy_content') is null or to_regclass('public.campaign_combat_public') is null then
    raise exception 'Run the earlier migrations first (20261116120000_foggy.sql and 20261112120000_campaign_workspace.sql).';
  end if;
end;
$$;

-- More kinds of drafts (adventure writing and structured generation).
alter table public.foggy_content drop constraint if exists foggy_content_kind_check;
alter table public.foggy_content add constraint foggy_content_kind_check check (kind in (
  'npc', 'portrait', 'map', 'location', 'monster', 'item', 'spell', 'handout', 'outline', 'text',
  'character', 'boss', 'encounter', 'faction', 'quest', 'scene', 'chapter', 'adventure', 'campaign', 'dungeon', 'puzzle', 'trap',
  'treasure', 'dialogue', 'twist', 'music_plan'));

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------
create table if not exists public.foggy_threads (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope       text not null check (scope in ('dashboard', 'campaign')),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  mode        text not null default 'chat' check (mode in ('chat', 'adventure')),
  title       text not null default 'New conversation' check (char_length(title) between 1 and 120),
  workspace   jsonb check (workspace is null or (jsonb_typeof(workspace) = 'object' and octet_length(workspace::text) <= 400000)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint foggy_threads_scope check ((scope = 'campaign') = (campaign_id is not null))
);
create index if not exists foggy_threads_owner on public.foggy_threads (owner_id, updated_at desc);

create table if not exists public.foggy_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.foggy_threads (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) <= 20000),
  data       jsonb check (data is null or (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000)),
  created_at timestamptz not null default now()
);
create index if not exists foggy_messages_thread on public.foggy_messages (thread_id, created_at);

revoke all on public.foggy_threads, public.foggy_messages from anon, authenticated;
grant select, delete on public.foggy_threads to authenticated;
grant update (title, workspace) on public.foggy_threads to authenticated;
grant select on public.foggy_messages to authenticated;
alter table public.foggy_threads enable row level security;
alter table public.foggy_messages enable row level security;
drop policy if exists "Foggy threads: own" on public.foggy_threads;
create policy "Foggy threads: own" on public.foggy_threads for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Foggy threads: update own" on public.foggy_threads;
create policy "Foggy threads: update own" on public.foggy_threads for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Foggy threads: delete own" on public.foggy_threads;
create policy "Foggy threads: delete own" on public.foggy_threads for delete to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Foggy messages: own" on public.foggy_messages;
create policy "Foggy messages: own" on public.foggy_messages for select to authenticated using (owner_id = (select auth.uid()));

drop trigger if exists foggy_threads_touch on public.foggy_threads;
create trigger foggy_threads_touch before update on public.foggy_threads for each row execute function private.foggy_touch();

-- -----------------------------------------------------------------------------
-- Usage ledger (fair-use caps; written by the Edge Functions)
-- -----------------------------------------------------------------------------
create table if not exists public.foggy_usage (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('text', 'image', 'audio')),
  created_at timestamptz not null default now()
);
create index if not exists foggy_usage_owner_day on public.foggy_usage (owner_id, kind, created_at desc);
revoke all on public.foggy_usage from anon, authenticated;
grant select on public.foggy_usage to authenticated;
alter table public.foggy_usage enable row level security;
drop policy if exists "Foggy usage: own" on public.foggy_usage;
create policy "Foggy usage: own" on public.foggy_usage for select to authenticated using (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Generated images and maps
-- -----------------------------------------------------------------------------
create table if not exists public.foggy_images (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  scope       text not null check (scope in ('dashboard', 'campaign')),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  kind        text not null check (kind in ('battle_map', 'dungeon_map', 'region_map', 'world_map', 'city_map', 'location', 'portrait',
                'monster', 'villain', 'item', 'spell', 'cover', 'handout')),
  playable    boolean not null default false,  -- a top-down battle map with a grid; everything else is a visual illustration
  grid        jsonb check (grid is null or jsonb_typeof(grid) = 'object'),
  title       text not null check (char_length(title) between 1 and 120),
  prompt      text not null check (char_length(prompt) <= 2000),
  path        text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  mime        text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  model       text check (model is null or char_length(model) <= 80),
  status      text not null default 'draft' check (status in ('draft', 'saved')),
  saved_to    jsonb check (saved_to is null or jsonb_typeof(saved_to) = 'object'),
  created_at  timestamptz not null default now(),
  constraint foggy_images_scope check ((scope = 'campaign') = (campaign_id is not null))
);
create index if not exists foggy_images_owner on public.foggy_images (owner_id, created_at desc);
revoke all on public.foggy_images from anon, authenticated;
grant select, delete on public.foggy_images to authenticated;
grant update (status, saved_to, title) on public.foggy_images to authenticated;
alter table public.foggy_images enable row level security;
drop policy if exists "Foggy images: own" on public.foggy_images;
create policy "Foggy images: own" on public.foggy_images for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Foggy images: update own" on public.foggy_images;
create policy "Foggy images: update own" on public.foggy_images for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Foggy images: delete own" on public.foggy_images;
create policy "Foggy images: delete own" on public.foggy_images for delete to authenticated using (owner_id = (select auth.uid()));

-- Private files: foggy-images/<owner id>/<image id>.<ext>. Uploaded by the Edge Function; owners read and delete their own.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('foggy-images', 'foggy-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists "Foggy images: read own files" on storage.objects';
    execute 'create policy "Foggy images: read own files" on storage.objects for select to authenticated using (bucket_id = ''foggy-images'' and (storage.foldername(name))[1] = (select auth.uid())::text)';
    execute 'drop policy if exists "Foggy images: delete own files" on storage.objects';
    execute 'create policy "Foggy images: delete own files" on storage.objects for delete to authenticated using (bucket_id = ''foggy-images'' and (storage.foldername(name))[1] = (select auth.uid())::text)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Player attack requests (the DM applies or rejects them)
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_combat_requests (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  requester   uuid not null references auth.users (id) on delete cascade,
  client_key  text not null check (client_key ~ '^[A-Za-z0-9_-]{8,64}$'),
  attacker_id text not null check (char_length(attacker_id) between 1 and 40),
  target_ids  text[] not null check (cardinality(target_ids) between 1 and 12),
  action      jsonb not null check (jsonb_typeof(action) = 'object' and octet_length(action::text) <= 8000),
  status      text not null default 'pending' check (status in ('pending', 'applied', 'rejected', 'cancelled')),
  note        text not null default '' check (char_length(note) <= 300),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (campaign_id, client_key)
);
create index if not exists campaign_combat_requests_campaign on public.campaign_combat_requests (campaign_id, status, created_at);
revoke all on public.campaign_combat_requests from anon, authenticated;
grant select on public.campaign_combat_requests to authenticated;
alter table public.campaign_combat_requests enable row level security;
drop policy if exists "Combat requests: DM or requester" on public.campaign_combat_requests;
create policy "Combat requests: DM or requester" on public.campaign_combat_requests for select to authenticated
  using (requester = (select auth.uid()) or private.is_campaign_owner(campaign_id));

-- A player asks to make an attack with THEIR character during THEIR turn of a running, unpaused combat.
create or replace function public.submit_combat_request(target_campaign uuid, p_client_key text, p_attacker text, p_targets text[], p_action jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pub jsonb;
  me uuid := auth.uid();
  rid uuid;
  t text;
begin
  if not private.is_active_campaign_member(target_campaign) or private.is_campaign_owner(target_campaign) then
    raise exception 'Only players of this campaign send attack requests (the Dungeon Master applies attacks directly).' using errcode = '42501';
  end if;
  if not private.campaign_is_active(target_campaign) then raise exception 'This campaign is archived.' using errcode = 'P0001'; end if;
  select state into pub from public.campaign_combat_public where campaign_id = target_campaign;
  if pub is null or pub ->> 'status' <> 'active' then raise exception 'No combat is running.' using errcode = 'P0001'; end if;
  if coalesce((pub ->> 'paused')::boolean, false) then raise exception 'Combat is paused.' using errcode = 'P0001'; end if;
  if not exists (select 1 from jsonb_array_elements(pub -> 'combatants') c where c ->> 'id' = p_attacker and c ->> 'userId' = me::text) then
    raise exception 'You can only attack with your own character.' using errcode = '42501';
  end if;
  if pub ->> 'turnId' is distinct from p_attacker then raise exception 'Wait for your turn.' using errcode = 'P0001'; end if;
  foreach t in array coalesce(p_targets, '{}') loop
    if not exists (select 1 from jsonb_array_elements(pub -> 'combatants') c where c ->> 'id' = t and not coalesce((c ->> 'defeated')::boolean, false)) then
      raise exception 'Choose a target that is in the fight.' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p_action) <> 'object' or coalesce(p_action ->> 'name', '') = '' then raise exception 'Choose an attack.' using errcode = '22023'; end if;
  if (select count(*) from public.campaign_combat_requests r where r.campaign_id = target_campaign and r.requester = me and r.status = 'pending') >= 3 then
    raise exception 'Wait for the Dungeon Master to answer your earlier requests.' using errcode = 'P0001';
  end if;
  insert into public.campaign_combat_requests (campaign_id, requester, client_key, attacker_id, target_ids, action)
  values (target_campaign, me, p_client_key, p_attacker, p_targets, p_action)
  on conflict (campaign_id, client_key) do nothing
  returning id into rid;
  if rid is null then select id into rid from public.campaign_combat_requests where campaign_id = target_campaign and client_key = p_client_key and requester = me; end if;
  return rid;
end;
$$;

-- The DM marks a request applied (after applying it to the encounter) or rejected; the requester may cancel a pending one.
create or replace function public.decide_combat_request(p_request uuid, p_decision text, p_note text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_combat_requests%rowtype;
begin
  select * into r from public.campaign_combat_requests where id = p_request for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if p_decision = 'cancelled' then
    if r.requester <> auth.uid() then raise exception 'Only the player who asked can cancel.' using errcode = '42501'; end if;
  elsif p_decision in ('applied', 'rejected') then
    if not private.is_campaign_owner(r.campaign_id) then raise exception 'Only the Dungeon Master decides.' using errcode = '42501'; end if;
  else
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if r.status <> 'pending' then return r.status; end if; -- decided already (another tab): no double application
  update public.campaign_combat_requests set status = p_decision, note = left(coalesce(p_note, ''), 300), decided_by = auth.uid(), decided_at = now() where id = p_request;
  return p_decision;
end;
$$;

revoke all on function public.submit_combat_request(uuid, text, text, text[], jsonb), public.decide_combat_request(uuid, text, text) from public, anon;
grant execute on function public.submit_combat_request(uuid, text, text, text[], jsonb), public.decide_combat_request(uuid, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'campaign_combat_requests') then
    alter publication supabase_realtime add table public.campaign_combat_requests;
  end if;
end;
$$;
