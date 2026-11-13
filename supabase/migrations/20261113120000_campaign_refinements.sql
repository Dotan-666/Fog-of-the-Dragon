-- =============================================================================
-- Fog of the Dragon — campaign workspace refinements
--
-- 1. campaign_history           audit log (start, level-ups, DM overrides); written only by the functions below
-- 2. Campaign locking           after a campaign starts: adventure, starting level, people needed, content source and the
--                               party's characters can't be changed by clients; level_up_member_character() allows one
--                               legitimate level at a time; override_campaign_lock() is the logged DM correction path
-- 3. campaign_notifications     in-app notifications for campaign members (created only by private functions)
-- 4. Availability scheduler     campaign_schedule_* tables; every change goes through a function that enforces the rules
--                               (unanimity, host consent, explicit confirmation of the same proposal by everyone)
-- 5. campaign_homebrew          homebrew monsters/NPCs/spells the DM shared with the campaign (a copy; dedupe by source)
-- 6. Memories & Recaps          campaign_memories (+ private image bucket), gated by the campaign owner's plan
-- 7. Entitlements               account_plans (a user's subscription) and campaign_entitlements (a campaign-wide book
--                               purchase). Neither can be written by clients: only a payment integration (service role) may.
-- 8. campaign_book()            the campaign book's data, only for members and only when the book is unlocked
-- 9. campaign_book_orders       physical-book orders (data model only; no provider is integrated)
-- =============================================================================
-- Safe to run again: every object is created only if missing (tables, indexes), recreated in place (functions, policies,
-- triggers) or added only once (Realtime publication). Running it a second time keeps all data. This fixes the
-- "… already exists" error when the file was run more than once (for example pasted again in the SQL Editor, or applied
-- by `supabase db push` after it had been run by hand).

-- -----------------------------------------------------------------------------
-- 1. History
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_history (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('started', 'level_up', 'override', 'book_unlocked')),
  summary     text not null check (char_length(summary) between 1 and 500),
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_history_campaign_idx on public.campaign_history (campaign_id, created_at desc);

revoke all on public.campaign_history from anon, authenticated;
grant select on public.campaign_history to authenticated;
alter table public.campaign_history enable row level security;
drop policy if exists "History: members read" on public.campaign_history;
create policy "History: members read"
  on public.campaign_history for select to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

create or replace function private.log_campaign(target uuid, actor uuid, p_kind text, p_summary text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.campaign_history (campaign_id, actor_id, kind, summary, details) values (target, actor, p_kind, p_summary, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function private.log_campaign(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Locking after the campaign starts
-- -----------------------------------------------------------------------------
-- Runs as the caller (not security definer): ordinary clients (role authenticated) are refused, while the functions
-- below (security definer, running as the table owner) and the foreign key that clears a deleted adventure are not.
create or replace function private.campaigns_lock_after_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.phase = 'started' and current_user in ('authenticated', 'anon') and pg_trigger_depth() < 2 then
    if new.adventure_id is distinct from old.adventure_id then
      raise exception 'The adventure is locked once the campaign has started.' using errcode = 'P0001';
    end if;
    if new.starting_level is distinct from old.starting_level
       or new.required_players is distinct from old.required_players
       or new.content_source is distinct from old.content_source then
      raise exception 'The starting setup is locked once the campaign has started.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_lock_after_start on public.campaigns;
create trigger campaigns_lock_after_start
  before update on public.campaigns
  for each row execute function private.campaigns_lock_after_start();

-- start_campaign: unchanged rules, plus a history entry.
create or replace function public.start_campaign(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
  members int;
  missing int;
begin
  select * into c from public.campaigns where id = target_campaign for update;
  if not found or c.owner_id <> me then
    raise exception 'Only the Dungeon Master can start this campaign.' using errcode = '42501';
  end if;
  if c.status <> 'active' then
    raise exception 'Restore the campaign before starting it.' using errcode = 'P0001';
  end if;
  if c.phase = 'started' then
    return;
  end if;
  if c.adventure_id is null then
    raise exception 'Choose the adventure this campaign runs before starting it.' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where m.role = 'player' and m.character_data is null)
    into members, missing
    from public.campaign_members m where m.campaign_id = c.id and m.status = 'active';
  if members < c.required_players then
    raise exception 'Waiting for players: % of % people have joined.', members, c.required_players using errcode = 'P0001';
  end if;
  if missing > 0 then
    raise exception '% player(s) still need a character.', missing using errcode = 'P0001';
  end if;
  update public.campaigns set phase = 'started', started_at = now() where id = c.id;
  perform private.log_campaign(c.id, me, 'started', 'The campaign started. Its adventure, party and starting setup are now locked.');
end;
$$;

-- One legitimate level at a time, by the player, for the character already in the campaign.
-- (The rules engine checks that the new level's choices are legal; the database checks that it is the same character
-- and exactly one level higher, so levels can't be set arbitrarily or the character swapped.)
create or replace function public.level_up_member_character(target_campaign uuid, p_character jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
  m public.campaign_members%rowtype;
  old_level int;
  new_level int;
begin
  select * into c from public.campaigns where id = target_campaign;
  if not found then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;
  if c.status <> 'active' or c.phase <> 'started' then
    raise exception 'Level-ups are recorded once the campaign has started.' using errcode = 'P0001';
  end if;
  select * into m from public.campaign_members x where x.campaign_id = c.id and x.user_id = me and x.role = 'player' and x.status = 'active' for update;
  if not found or m.character_data is null then
    raise exception 'You don''t have a character in this campaign.' using errcode = '42501';
  end if;
  if p_character is null or jsonb_typeof(p_character) <> 'object' or jsonb_typeof(p_character -> 'choices') <> 'object' then
    raise exception 'The character is not valid.' using errcode = '22023';
  end if;
  old_level := (m.character_data -> 'choices' ->> 'level')::int;
  new_level := (p_character -> 'choices' ->> 'level')::int;
  if new_level is distinct from old_level + 1 or new_level > 20 then
    raise exception 'A character can only gain one level at a time (from level % to %).', old_level, old_level + 1 using errcode = 'P0001';
  end if;
  if (p_character ->> 'sourceCharacterId') is distinct from (m.character_data ->> 'sourceCharacterId')
     or (p_character -> 'choices' ->> 'classId') is distinct from (m.character_data -> 'choices' ->> 'classId')
     or (p_character -> 'choices' ->> 'speciesId') is distinct from (m.character_data -> 'choices' ->> 'speciesId')
     or (p_character -> 'choices' ->> 'backgroundId') is distinct from (m.character_data -> 'choices' ->> 'backgroundId') then
    raise exception 'A level-up must be the same character (same class, species and background), not a replacement.' using errcode = 'P0001';
  end if;
  update public.campaign_members x
     set character_data = p_character, character_updated_at = now()
   where x.campaign_id = c.id and x.user_id = me;
  perform private.log_campaign(c.id, me, 'level_up', m.character_name || ' reached level ' || new_level || '.',
    jsonb_build_object('user_id', me, 'character', m.character_name, 'from', old_level, 'to', new_level));
  return new_level;
end;
$$;

-- The DM's correction path after the start: explicit reason, logged, only these actions.
create or replace function public.override_campaign_lock(target_campaign uuid, p_action text, p_payload jsonb, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
  reason text := btrim(coalesce(p_reason, ''));
  target uuid;
  who text;
begin
  select * into c from public.campaigns where id = target_campaign for update;
  if not found or c.owner_id <> me then
    raise exception 'Only the Dungeon Master can override a locked setting.' using errcode = '42501';
  end if;
  if c.status <> 'active' then
    raise exception 'Restore the campaign before changing it.' using errcode = 'P0001';
  end if;
  if c.phase <> 'started' then
    raise exception 'Nothing is locked yet: change it normally.' using errcode = 'P0001';
  end if;
  if char_length(reason) < 10 then
    raise exception 'Write a reason (at least 10 characters). It is saved in the campaign history.' using errcode = '22023';
  end if;
  if p_action = 'set_adventure' then
    update public.campaigns set adventure_id = (p_payload ->> 'adventure_id')::uuid where id = c.id;
    perform private.log_campaign(c.id, me, 'override', 'The DM switched the campaign''s adventure. Reason: ' || reason, jsonb_build_object('action', p_action, 'reason', reason, 'adventure_id', p_payload ->> 'adventure_id'));
  elsif p_action = 'set_starting_level' then
    update public.campaigns set starting_level = (p_payload ->> 'level')::smallint where id = c.id;
    perform private.log_campaign(c.id, me, 'override', 'The DM changed the starting level to ' || (p_payload ->> 'level') || '. Reason: ' || reason, jsonb_build_object('action', p_action, 'reason', reason, 'level', p_payload ->> 'level'));
  elsif p_action = 'replace_character' then
    target := (p_payload ->> 'user_id')::uuid;
    if p_payload -> 'character' is null or jsonb_typeof(p_payload -> 'character') <> 'object' or btrim(coalesce(p_payload ->> 'name', '')) = '' then
      raise exception 'A character with a name is required.' using errcode = '22023';
    end if;
    update public.campaign_members x
       set character_data = p_payload -> 'character', character_name = btrim(p_payload ->> 'name'), character_built_by = 'dm', character_updated_at = now()
     where x.campaign_id = c.id and x.user_id = target and x.role = 'player' and x.status = 'active';
    if not found then
      raise exception 'That player isn''t in this campaign.' using errcode = 'P0002';
    end if;
    select coalesce(p.display_name, 'a player') into who from public.profiles p where p.id = target;
    perform private.log_campaign(c.id, me, 'override', 'The DM replaced ' || coalesce(who, 'a player') || '''s character with ' || btrim(p_payload ->> 'name') || '. Reason: ' || reason, jsonb_build_object('action', p_action, 'reason', reason, 'user_id', target, 'character', btrim(p_payload ->> 'name')));
  elsif p_action = 'remove_member' then
    target := (p_payload ->> 'user_id')::uuid;
    select coalesce(p.display_name, 'a player') into who from public.profiles p where p.id = target;
    delete from public.campaign_members x where x.campaign_id = c.id and x.user_id = target and x.role <> 'owner';
    if not found then
      raise exception 'That player isn''t in this campaign.' using errcode = 'P0002';
    end if;
    perform private.log_campaign(c.id, me, 'override', 'The DM removed ' || coalesce(who, 'a player') || ' from the campaign. Reason: ' || reason, jsonb_build_object('action', p_action, 'reason', reason, 'user_id', target));
  else
    raise exception 'Unknown override.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.level_up_member_character(uuid, jsonb) from public, anon;
revoke all on function public.override_campaign_lock(uuid, text, jsonb, text) from public, anon;
grant execute on function public.level_up_member_character(uuid, jsonb) to authenticated;
grant execute on function public.override_campaign_lock(uuid, text, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Notifications
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind        text not null check (char_length(kind) <= 32),
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null default '' check (char_length(body) <= 500),
  link        text check (char_length(link) <= 300),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_notifications_user_idx on public.campaign_notifications (user_id, created_at desc);

revoke all on public.campaign_notifications from anon, authenticated;
grant select, delete on public.campaign_notifications to authenticated;
grant update (read) on public.campaign_notifications to authenticated;
alter table public.campaign_notifications enable row level security;
drop policy if exists "Notifications: read own" on public.campaign_notifications;
create policy "Notifications: read own" on public.campaign_notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Notifications: mark own read" on public.campaign_notifications;
create policy "Notifications: mark own read" on public.campaign_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Notifications: delete own" on public.campaign_notifications;
create policy "Notifications: delete own" on public.campaign_notifications for delete to authenticated using (user_id = (select auth.uid()));

-- Tells every active member of a campaign (optionally except one person).
create or replace function private.notify_campaign(target uuid, p_kind text, p_title text, p_body text, link_hash text, skip uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.campaign_notifications (user_id, campaign_id, kind, title, body, link)
  select m.user_id, target, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 500), 'campaign.html?c=' || target::text || '#' || link_hash
    from public.campaign_members m
   where m.campaign_id = target and m.status = 'active' and (skip is null or m.user_id <> skip);
$$;
revoke all on function private.notify_campaign(uuid, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function private.notify_user(target uuid, who uuid, p_kind text, p_title text, p_body text, link_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.campaign_notifications (user_id, campaign_id, kind, title, body, link)
  values (who, target, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 500), 'campaign.html?c=' || target::text || '#' || link_hash);
$$;
revoke all on function private.notify_user(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Availability scheduler
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_schedule_requests (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns (id) on delete cascade,
  created_by       uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  notes            text not null default '' check (char_length(notes) <= 1000),
  format           text not null check (format in ('in_person', 'online', 'either')),
  duration_minutes integer check (duration_minutes between 15 and 1440),
  slots            jsonb not null check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) between 1 and 60),
  responses_due    timestamptz,
  status           text not null default 'draft' check (status in ('draft', 'waiting', 'consensus', 'awaiting_confirmation', 'confirmed', 'cancelled', 'expired')),
  round            integer not null default 1,
  required_users   uuid[] not null default '{}',
  proposal         jsonb,
  meeting_id       uuid references public.campaign_meetings (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists campaign_schedule_requests_idx on public.campaign_schedule_requests (campaign_id, created_at desc);
drop trigger if exists campaign_schedule_requests_set_updated_at on public.campaign_schedule_requests;
create trigger campaign_schedule_requests_set_updated_at before update on public.campaign_schedule_requests for each row execute function private.set_updated_at();

create table if not exists public.campaign_schedule_responses (
  request_id     uuid not null references public.campaign_schedule_requests (id) on delete cascade,
  round          integer not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  availability   jsonb not null default '{}'::jsonb check (jsonb_typeof(availability) = 'object'),
  can_host       boolean not null default false,
  host_note      text not null default '' check (char_length(host_note) <= 500),
  suggest_format text check (suggest_format in ('in_person', 'online', 'google_meet')),
  suggestion     text not null default '' check (char_length(suggestion) <= 1000),
  updated_at     timestamptz not null default now(),
  primary key (request_id, round, user_id)
);

-- A host's address: visible only to the host, until they agreed to share it AND they are the proposed host.
create table if not exists public.campaign_schedule_hosts (
  request_id       uuid not null references public.campaign_schedule_requests (id) on delete cascade,
  round            integer not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  location         text not null check (char_length(btrim(location)) between 1 and 200),
  share_with_party boolean not null default false,
  primary key (request_id, round, user_id)
);

create table if not exists public.campaign_schedule_confirmations (
  request_id       uuid not null references public.campaign_schedule_requests (id) on delete cascade,
  round            integer not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  proposal_version integer not null,
  confirmed_at     timestamptz not null default now(),
  primary key (request_id, round, user_id)
);

revoke all on public.campaign_schedule_requests, public.campaign_schedule_responses, public.campaign_schedule_hosts, public.campaign_schedule_confirmations from anon, authenticated;
grant select on public.campaign_schedule_requests, public.campaign_schedule_responses, public.campaign_schedule_confirmations to authenticated;
grant select on public.campaign_schedule_hosts to authenticated;
alter table public.campaign_schedule_requests enable row level security;
alter table public.campaign_schedule_responses enable row level security;
alter table public.campaign_schedule_hosts enable row level security;
alter table public.campaign_schedule_confirmations enable row level security;

create or replace function private.schedule_campaign(rid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select r.campaign_id from public.campaign_schedule_requests r where r.id = rid;
$$;
create or replace function private.schedule_proposed_host(rid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select nullif(r.proposal ->> 'host_id', '')::uuid from public.campaign_schedule_requests r where r.id = rid and r.status in ('awaiting_confirmation', 'confirmed');
$$;
revoke all on function private.schedule_campaign(uuid), private.schedule_proposed_host(uuid) from public, anon;
grant execute on function private.schedule_campaign(uuid), private.schedule_proposed_host(uuid) to authenticated;

-- Drafts are the DM's alone; once published, every member can read the request, the answers and who has confirmed.
drop policy if exists "Schedule: read" on public.campaign_schedule_requests;
create policy "Schedule: read" on public.campaign_schedule_requests for select to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (status <> 'draft' and (select private.is_active_campaign_member(campaign_id))));
drop policy if exists "Schedule responses: read" on public.campaign_schedule_responses;
create policy "Schedule responses: read" on public.campaign_schedule_responses for select to authenticated
  using ((select private.is_campaign_owner(private.schedule_campaign(request_id))) or (select private.is_active_campaign_member(private.schedule_campaign(request_id))));
drop policy if exists "Schedule confirmations: read" on public.campaign_schedule_confirmations;
create policy "Schedule confirmations: read" on public.campaign_schedule_confirmations for select to authenticated
  using ((select private.is_campaign_owner(private.schedule_campaign(request_id))) or (select private.is_active_campaign_member(private.schedule_campaign(request_id))));
drop policy if exists "Schedule hosts: the host, or the party once the host agreed and was proposed" on public.campaign_schedule_hosts;
create policy "Schedule hosts: the host, or the party once the host agreed and was proposed" on public.campaign_schedule_hosts for select to authenticated
  using (
    user_id = (select auth.uid())
    or (share_with_party
        and private.schedule_proposed_host(request_id) = user_id
        and ((select private.is_campaign_owner(private.schedule_campaign(request_id))) or (select private.is_active_campaign_member(private.schedule_campaign(request_id)))))
  );

-- Checks and normalizes the slot list: [{ "id": "s1", "start": ts, "end": ts }, …]
create or replace function private.schedule_clean_slots(p_slots jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s jsonb;
  out jsonb := '[]'::jsonb;
  ids text[] := '{}';
  st timestamptz;
  en timestamptz;
  sid text;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 60 then
    raise exception 'Offer between 1 and 60 possible time slots.' using errcode = '22023';
  end if;
  for s in select * from jsonb_array_elements(p_slots) loop
    sid := s ->> 'id';
    if jsonb_typeof(s) <> 'object' or sid is null or sid !~ '^[A-Za-z0-9_-]{1,16}$' or sid = any (ids) then
      raise exception 'Every time slot needs its own short id.' using errcode = '22023';
    end if;
    st := (s ->> 'start')::timestamptz;
    en := (s ->> 'end')::timestamptz;
    if st is null or en is null or en <= st then
      raise exception 'Every time slot must end after it starts.' using errcode = '22023';
    end if;
    ids := ids || sid;
    out := out || jsonb_build_array(jsonb_build_object('id', sid, 'start', st, 'end', en));
  end loop;
  return out;
end;
$$;

create or replace function private.open_schedule(rid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  update public.campaign_schedule_requests
     set status = 'waiting',
         required_users = coalesce((select array_agg(m.user_id) from public.campaign_members m where m.campaign_id = r.campaign_id and m.status = 'active'), '{}')
   where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule', 'Availability needed: ' || r.title, 'Tell the party when you can play.', 'meetings', auth.uid());
end;
$$;
revoke all on function private.open_schedule(uuid) from public, anon, authenticated;

create or replace function public.create_schedule_request(target_campaign uuid, p_title text, p_notes text, p_format text, p_duration integer, p_slots jsonb, p_due timestamptz, p_publish boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  if not private.is_campaign_owner(target_campaign) then
    raise exception 'Only the Dungeon Master can ask for availability.' using errcode = '42501';
  end if;
  if not private.campaign_is_active(target_campaign) then
    raise exception 'Restore the campaign before scheduling.' using errcode = 'P0001';
  end if;
  if p_due is not null and p_due <= now() then
    raise exception 'The deadline must be in the future.' using errcode = '22023';
  end if;
  insert into public.campaign_schedule_requests (campaign_id, created_by, title, notes, format, duration_minutes, slots, responses_due)
  values (target_campaign, auth.uid(), btrim(p_title), coalesce(p_notes, ''), p_format, p_duration, private.schedule_clean_slots(p_slots), p_due)
  returning id into rid;
  if p_publish then
    perform private.open_schedule(rid);
  end if;
  return rid;
end;
$$;

create or replace function public.publish_schedule_request(rid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can do that.' using errcode = '42501';
  end if;
  if r.status <> 'draft' then
    raise exception 'This request was already sent.' using errcode = 'P0001';
  end if;
  perform private.open_schedule(rid);
end;
$$;

-- A member's answer: per-slot availability, whether they can host (and where, privately), and suggestions.
create or replace function public.submit_schedule_response(
  rid uuid, p_availability jsonb, p_can_host boolean, p_host_location text, p_share_location boolean,
  p_host_note text, p_suggest_format text, p_suggestion text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.campaign_schedule_requests%rowtype;
  k text;
  v text;
  slot_ids text[];
  answered int;
  new_status text;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or me is null or not (me = any (r.required_users)) then
    raise exception 'This request isn''t waiting for your answer.' using errcode = '42501';
  end if;
  if r.status not in ('waiting', 'consensus') then
    raise exception 'This request is no longer collecting answers.' using errcode = 'P0001';
  end if;
  if r.responses_due is not null and r.responses_due < now() then
    raise exception 'The deadline for answers has passed.' using errcode = 'P0001';
  end if;
  if not private.campaign_is_active(r.campaign_id) then
    raise exception 'This campaign is archived.' using errcode = 'P0001';
  end if;
  if p_availability is null or jsonb_typeof(p_availability) <> 'object' then
    raise exception 'Answer for the time slots.' using errcode = '22023';
  end if;
  select array_agg(e ->> 'id') into slot_ids from jsonb_array_elements(r.slots) e;
  for k, v in select key, value #>> '{}' from jsonb_each(p_availability) loop
    if not (k = any (slot_ids)) or v not in ('available', 'preferred', 'maybe', 'unavailable') then
      raise exception 'That answer doesn''t match this request.' using errcode = '22023';
    end if;
  end loop;
  insert into public.campaign_schedule_responses (request_id, round, user_id, availability, can_host, host_note, suggest_format, suggestion)
  values (rid, r.round, me, p_availability, coalesce(p_can_host, false), left(coalesce(p_host_note, ''), 500), nullif(p_suggest_format, ''), left(coalesce(p_suggestion, ''), 1000))
  on conflict (request_id, round, user_id) do update
    set availability = excluded.availability, can_host = excluded.can_host, host_note = excluded.host_note,
        suggest_format = excluded.suggest_format, suggestion = excluded.suggestion, updated_at = now();
  if coalesce(p_can_host, false) and btrim(coalesce(p_host_location, '')) <> '' then
    insert into public.campaign_schedule_hosts (request_id, round, user_id, location, share_with_party)
    values (rid, r.round, me, btrim(p_host_location), coalesce(p_share_location, false))
    on conflict (request_id, round, user_id) do update set location = excluded.location, share_with_party = excluded.share_with_party;
  else
    delete from public.campaign_schedule_hosts h where h.request_id = rid and h.round = r.round and h.user_id = me;
  end if;
  select count(*) into answered from public.campaign_schedule_responses x where x.request_id = rid and x.round = r.round and x.user_id = any (r.required_users);
  new_status := case when answered >= cardinality(r.required_users) then 'consensus' else 'waiting' end;
  if new_status <> r.status then
    update public.campaign_schedule_requests set status = new_status where id = rid;
    if new_status = 'consensus' then
      perform private.notify_user(r.campaign_id, r.created_by, 'schedule', 'Everyone answered: ' || r.title, 'See which times work for the whole party.', 'meetings/' || rid::text);
    end if;
  end if;
  return new_status;
end;
$$;

-- Does a slot work for every required person? ('maybe' is not a yes.)
create or replace function private.schedule_unanimous(rid uuid, slot text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select r.status is not null and not exists (
    select 1 from unnest(r.required_users) u
    where not exists (
      select 1 from public.campaign_schedule_responses x
      where x.request_id = r.id and x.round = r.round and x.user_id = u and x.availability ->> slot in ('available', 'preferred')
    )
  )
  from public.campaign_schedule_requests r where r.id = rid;
$$;
revoke all on function private.schedule_unanimous(uuid, text) from public, anon, authenticated;

-- The DM proposes ONE final option. Nothing is scheduled yet: everyone must confirm exactly this proposal.
create or replace function public.propose_schedule(rid uuid, p_slot text, p_format text, p_host uuid, p_link text, p_link_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  version int;
  host_ok boolean;
  link text := btrim(coalesce(p_link, ''));
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can propose the final time.' using errcode = '42501';
  end if;
  if r.status not in ('consensus', 'awaiting_confirmation') then
    raise exception 'Wait until everyone has answered.' using errcode = 'P0001';
  end if;
  if r.responses_due is not null and r.responses_due < now() then
    raise exception 'The deadline has passed. Start another round.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from jsonb_array_elements(r.slots) e where e ->> 'id' = p_slot) then
    raise exception 'That time slot isn''t part of this request.' using errcode = '22023';
  end if;
  if not private.schedule_unanimous(rid, p_slot) then
    raise exception 'Not everyone is available at that time. Choose a time that works for all % people, or start another round.', cardinality(r.required_users) using errcode = 'P0001';
  end if;
  if p_format not in ('in_person', 'online') or (r.format <> 'either' and r.format <> p_format) then
    raise exception 'Choose a format that matches this request.' using errcode = '22023';
  end if;
  if p_format = 'in_person' then
    select exists (
      select 1 from public.campaign_schedule_responses x
      join public.campaign_schedule_hosts h on h.request_id = x.request_id and h.round = x.round and h.user_id = x.user_id
      where x.request_id = rid and x.round = r.round and x.user_id = p_host and x.can_host
        and h.share_with_party and btrim(h.location) <> ''
    ) into host_ok;
    if p_host is null or not (p_host = any (r.required_users)) or not host_ok then
      raise exception 'An in-person meeting needs a host who can host and agreed to share the location with the party.' using errcode = 'P0001';
    end if;
    link := '';
  else
    if link !~ '^https://[^\s]{4,180}$' then
      raise exception 'Enter the online meeting link (it must start with https://).' using errcode = '22023';
    end if;
    if p_link_kind not in ('manual', 'generated') then
      raise exception 'Say whether the link was entered by hand or generated.' using errcode = '22023';
    end if;
    p_host := null;
  end if;
  version := coalesce((r.proposal ->> 'version')::int, 0) + 1;
  delete from public.campaign_schedule_confirmations c where c.request_id = rid and c.round = r.round;
  update public.campaign_schedule_requests
     set status = 'awaiting_confirmation',
         proposal = jsonb_build_object('version', version, 'slot_id', p_slot, 'format', p_format, 'host_id', p_host, 'link', nullif(link, ''), 'link_kind', case when p_format = 'online' then p_link_kind end)
   where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule', 'Please confirm: ' || r.title, 'The DM proposed a final time. Check it and confirm.', 'meetings/' || rid::text, auth.uid());
  return version;
end;
$$;

-- Each person confirms the exact proposal they saw (version + slot). When everyone has, the meeting is created.
create or replace function public.confirm_schedule(rid uuid, p_version integer, p_slot text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.campaign_schedule_requests%rowtype;
  slot jsonb;
  done int;
  mid uuid;
  loc text;
  descr text;
  starts timestamptz;
  ends timestamptz;
  u uuid;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or me is null or not (me = any (r.required_users)) then
    raise exception 'This request isn''t waiting for your confirmation.' using errcode = '42501';
  end if;
  if r.status <> 'awaiting_confirmation' or r.proposal is null then
    raise exception 'There is nothing to confirm right now.' using errcode = 'P0001';
  end if;
  if r.responses_due is not null and r.responses_due < now() then
    raise exception 'The deadline has passed.' using errcode = 'P0001';
  end if;
  if (r.proposal ->> 'version')::int is distinct from p_version or (r.proposal ->> 'slot_id') is distinct from p_slot then
    raise exception 'The proposal changed. Look at the new proposal before confirming.' using errcode = 'P0001';
  end if;
  if not private.schedule_unanimous(rid, p_slot) then
    raise exception 'Availability changed, so this time no longer works for everyone.' using errcode = 'P0001';
  end if;
  insert into public.campaign_schedule_confirmations (request_id, round, user_id, proposal_version)
  values (rid, r.round, me, p_version)
  on conflict (request_id, round, user_id) do update set proposal_version = excluded.proposal_version, confirmed_at = now();
  select count(*) into done from public.campaign_schedule_confirmations c
   where c.request_id = rid and c.round = r.round and c.proposal_version = p_version and c.user_id = any (r.required_users);
  if done < cardinality(r.required_users) then
    return null;
  end if;
  -- Everyone confirmed the same proposal: create the real meeting.
  select e into slot from jsonb_array_elements(r.slots) e where e ->> 'id' = p_slot;
  starts := (slot ->> 'start')::timestamptz;
  ends := case when r.duration_minutes is not null then starts + make_interval(mins => r.duration_minutes) else (slot ->> 'end')::timestamptz end;
  if r.proposal ->> 'format' = 'in_person' then
    select h.location into loc from public.campaign_schedule_hosts h
     where h.request_id = rid and h.round = r.round and h.user_id = (r.proposal ->> 'host_id')::uuid and h.share_with_party;
    descr := 'In person. Agreed by everyone through the availability poll.';
  else
    loc := r.proposal ->> 'link';
    descr := 'Online. Meeting link ' || case when r.proposal ->> 'link_kind' = 'generated' then 'generated automatically' else 'entered by hand by the DM (not generated)' end || '. Agreed by everyone through the availability poll.';
  end if;
  insert into public.campaign_meetings (campaign_id, created_by, title, starts_at, ends_at, location, description)
  values (r.campaign_id, r.created_by, r.title, starts, ends, left(coalesce(loc, ''), 200), left(descr || case when r.notes <> '' then ' ' || r.notes else '' end, 2000))
  returning id into mid;
  foreach u in array r.required_users loop
    insert into public.campaign_meeting_rsvps (meeting_id, user_id, response) values (mid, u, 'yes') on conflict do nothing;
  end loop;
  update public.campaign_schedule_requests set status = 'confirmed', meeting_id = mid where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule', 'Meeting confirmed: ' || r.title, 'Everyone agreed. It is now in Meetings.', 'meetings/' || mid::text);
  return mid;
end;
$$;

-- "I can't make this one": clears the proposal so nobody can confirm a time that isn't agreed.
create or replace function public.decline_schedule(rid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r public.campaign_schedule_requests%rowtype;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or me is null or not (me = any (r.required_users)) or r.status <> 'awaiting_confirmation' then
    raise exception 'There is nothing for you to decline.' using errcode = '42501';
  end if;
  delete from public.campaign_schedule_confirmations c where c.request_id = rid and c.round = r.round;
  update public.campaign_schedule_requests set status = 'consensus', proposal = null where id = rid;
  perform private.notify_user(r.campaign_id, r.created_by, 'schedule', 'A time was declined: ' || r.title, 'Someone can''t make the proposed time. Propose another or start a new round.', 'meetings/' || rid::text);
end;
$$;

create or replace function public.cancel_schedule(rid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can do that.' using errcode = '42501';
  end if;
  if r.status in ('confirmed', 'cancelled') then
    raise exception 'This request can''t be cancelled (a confirmed one is a meeting now: cancel the meeting instead).' using errcode = 'P0001';
  end if;
  update public.campaign_schedule_requests set status = 'cancelled' where id = rid;
  if r.status <> 'draft' then
    perform private.notify_campaign(r.campaign_id, 'schedule', 'Scheduling cancelled: ' || r.title, '', 'meetings', auth.uid());
  end if;
end;
$$;

-- A new round: answers and proposal are cleared, the same slots stay (or new ones replace them).
create or replace function public.reopen_schedule(rid uuid, p_slots jsonb default null, p_due timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can do that.' using errcode = '42501';
  end if;
  if r.status in ('confirmed', 'draft', 'waiting') then
    raise exception 'This request can''t be reopened.' using errcode = 'P0001';
  end if;
  if not private.campaign_is_active(r.campaign_id) then
    raise exception 'Restore the campaign before scheduling.' using errcode = 'P0001';
  end if;
  if p_due is not null and p_due <= now() then
    raise exception 'The deadline must be in the future.' using errcode = '22023';
  end if;
  update public.campaign_schedule_requests
     set round = round + 1, proposal = null, responses_due = p_due,
         slots = case when p_slots is null then slots else private.schedule_clean_slots(p_slots) end
   where id = rid;
  perform private.open_schedule(rid);
end;
$$;

-- Any member's browser may mark requests whose deadline passed as expired (idempotent).
create or replace function public.expire_schedule_requests(target_campaign uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign)) then
    return 0;
  end if;
  update public.campaign_schedule_requests
     set status = 'expired'
   where campaign_id = target_campaign and status in ('waiting', 'consensus', 'awaiting_confirmation') and responses_due is not null and responses_due < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.create_schedule_request(uuid, text, text, text, integer, jsonb, timestamptz, boolean) from public, anon;
revoke all on function public.publish_schedule_request(uuid) from public, anon;
revoke all on function public.submit_schedule_response(uuid, jsonb, boolean, text, boolean, text, text, text) from public, anon;
revoke all on function public.propose_schedule(uuid, text, text, uuid, text, text) from public, anon;
revoke all on function public.confirm_schedule(uuid, integer, text) from public, anon;
revoke all on function public.decline_schedule(uuid) from public, anon;
revoke all on function public.cancel_schedule(uuid) from public, anon;
revoke all on function public.reopen_schedule(uuid, jsonb, timestamptz) from public, anon;
revoke all on function public.expire_schedule_requests(uuid) from public, anon;
grant execute on function public.create_schedule_request(uuid, text, text, text, integer, jsonb, timestamptz, boolean) to authenticated;
grant execute on function public.publish_schedule_request(uuid) to authenticated;
grant execute on function public.submit_schedule_response(uuid, jsonb, boolean, text, boolean, text, text, text) to authenticated;
grant execute on function public.propose_schedule(uuid, text, text, uuid, text, text) to authenticated;
grant execute on function public.confirm_schedule(uuid, integer, text) to authenticated;
grant execute on function public.decline_schedule(uuid) to authenticated;
grant execute on function public.cancel_schedule(uuid) to authenticated;
grant execute on function public.reopen_schedule(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.expire_schedule_requests(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Campaign homebrew (a copy of the DM's entry, shared with the whole campaign)
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_homebrew (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  source_id   uuid not null,
  kind        text not null check (kind in ('monster', 'npc', 'spell')),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
  shared_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (campaign_id, source_id)
);
revoke all on public.campaign_homebrew from anon, authenticated;
grant select, delete on public.campaign_homebrew to authenticated;
grant insert (campaign_id, source_id, kind, name, data) on public.campaign_homebrew to authenticated;
alter table public.campaign_homebrew enable row level security;
drop policy if exists "Campaign homebrew: members read" on public.campaign_homebrew;
create policy "Campaign homebrew: members read" on public.campaign_homebrew for select to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));
drop policy if exists "Campaign homebrew: the DM shares from their own library" on public.campaign_homebrew;
create policy "Campaign homebrew: the DM shares from their own library" on public.campaign_homebrew for insert to authenticated
  with check (
    shared_by = (select auth.uid()) and (select private.is_campaign_owner(campaign_id)) and (select private.campaign_is_active(campaign_id))
    and exists (select 1 from public.homebrew h where h.id = source_id and h.owner_id = (select auth.uid()) and h.kind = campaign_homebrew.kind)
  );
drop policy if exists "Campaign homebrew: the DM stops sharing" on public.campaign_homebrew;
create policy "Campaign homebrew: the DM stops sharing" on public.campaign_homebrew for delete to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

-- -----------------------------------------------------------------------------
-- 7. Subscriptions and campaign-wide purchases (written only by a payment integration)
-- -----------------------------------------------------------------------------
create table if not exists public.account_plans (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan_id            text not null check (plan_id in ('warlord', 'dungeon-master', 'fogger-of-the-dragons')),
  status             text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  provider           text,
  provider_ref       text,
  updated_at         timestamptz not null default now()
);
revoke all on public.account_plans from anon, authenticated;
grant select on public.account_plans to authenticated;
alter table public.account_plans enable row level security;
drop policy if exists "Plans: read own" on public.account_plans;
create policy "Plans: read own" on public.account_plans for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.campaign_entitlements (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  product      text not null check (product in ('campaign_book_digital', 'campaign_book_print')),
  purchased_by uuid references auth.users (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  provider     text,
  provider_ref text,
  amount_cents integer check (amount_cents >= 0),
  currency     text check (char_length(currency) = 3),
  created_at   timestamptz not null default now()
);
create unique index if not exists campaign_entitlements_paid_digital on public.campaign_entitlements (campaign_id, product) where status = 'paid';
revoke all on public.campaign_entitlements from anon, authenticated;
grant select on public.campaign_entitlements to authenticated;
alter table public.campaign_entitlements enable row level security;
drop policy if exists "Entitlements: members read their campaign's" on public.campaign_entitlements;
create policy "Entitlements: members read their campaign's" on public.campaign_entitlements for select to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

create table if not exists public.campaign_book_orders (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  entitlement_id uuid references public.campaign_entitlements (id) on delete set null,
  purchased_by   uuid not null references auth.users (id) on delete cascade,
  status         text not null default 'requested' check (status in ('requested', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled')),
  shipping       jsonb,
  provider       text,
  provider_ref   text,
  created_at     timestamptz not null default now()
);
revoke all on public.campaign_book_orders from anon, authenticated;
grant select on public.campaign_book_orders to authenticated;
alter table public.campaign_book_orders enable row level security;
-- Shipping details are private to the person who ordered.
drop policy if exists "Book orders: the purchaser reads" on public.campaign_book_orders;
create policy "Book orders: the purchaser reads" on public.campaign_book_orders for select to authenticated using (purchased_by = (select auth.uid()));

create or replace function private.user_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.plan_id from public.account_plans a
                    where a.user_id = uid and a.status = 'active' and (a.current_period_end is null or a.current_period_end > now())), 'warlord');
$$;
revoke all on function private.user_plan(uuid) from public, anon, authenticated;

-- Memories & Recaps: the campaign DM's plan must be Dungeon Master or Fogger of the Dragons.
create or replace function private.campaign_has_memories(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.user_plan(c.owner_id) in ('dungeon-master', 'fogger-of-the-dragons') from public.campaigns c where c.id = target;
$$;
grant execute on function private.campaign_has_memories(uuid) to authenticated;
revoke all on function private.campaign_has_memories(uuid) from public;

-- The digital book: a paid campaign-wide purchase by any member, or the campaign DM's top tier (included).
create or replace function private.campaign_book_unlocked(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.campaign_entitlements e where e.campaign_id = target and e.product = 'campaign_book_digital' and e.status = 'paid')
      or coalesce((select private.user_plan(c.owner_id) = 'fogger-of-the-dragons' from public.campaigns c where c.id = target), false);
$$;
revoke all on function private.campaign_book_unlocked(uuid) from public, anon, authenticated;

-- What the interface needs to show locks, purchases and the book.
create or replace function public.campaign_feature_access(target_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner_plan text;
  paid boolean;
  by_name text;
begin
  if not (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign)) then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;
  select private.user_plan(c.owner_id) into owner_plan from public.campaigns c where c.id = target_campaign;
  select exists (select 1 from public.campaign_entitlements e where e.campaign_id = target_campaign and e.product = 'campaign_book_digital' and e.status = 'paid') into paid;
  select p.display_name into by_name from public.campaign_entitlements e left join public.profiles p on p.id = e.purchased_by
   where e.campaign_id = target_campaign and e.product = 'campaign_book_digital' and e.status = 'paid' limit 1;
  return jsonb_build_object(
    'owner_plan', owner_plan,
    'memories', private.campaign_has_memories(target_campaign),
    'book_unlocked', private.campaign_book_unlocked(target_campaign),
    'book_included_by_plan', owner_plan = 'fogger-of-the-dragons',
    'book_purchased', paid,
    'book_purchased_by', by_name);
end;
$$;
revoke all on function public.campaign_feature_access(uuid) from public, anon;
grant execute on function public.campaign_feature_access(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Memories & Recaps
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_memories (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  kind         text not null default 'event' check (kind in (
    'recap', 'event', 'character', 'npc', 'quote', 'location', 'discovery', 'decision', 'battle', 'milestone', 'map', 'image', 'note')),
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  content      text not null default '' check (char_length(content) <= 20000),
  occurred_on  date,
  meeting_id   uuid references public.campaign_meetings (id) on delete set null,
  subject      text not null default '' check (char_length(subject) <= 120),
  image_path   text check (char_length(image_path) <= 200),
  recap        jsonb check (recap is null or (jsonb_typeof(recap) = 'object' and octet_length(recap::text) <= 60000)),
  visibility   text not null default 'dm' check (visibility in ('players', 'dm')),
  status       text not null default 'draft' check (status in ('draft', 'published')),
  created_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  constraint campaign_memories_published_at check ((status = 'published') = (published_at is not null))
);
create index if not exists campaign_memories_idx on public.campaign_memories (campaign_id, occurred_on desc nulls last, created_at desc);
drop trigger if exists campaign_memories_set_updated_at on public.campaign_memories;
create trigger campaign_memories_set_updated_at before update on public.campaign_memories for each row execute function private.set_updated_at();

create or replace function private.campaign_memories_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists campaign_memories_stamp on public.campaign_memories;
create trigger campaign_memories_stamp before insert or update of status on public.campaign_memories for each row execute function private.campaign_memories_stamp();

revoke all on public.campaign_memories from anon, authenticated;
grant select, delete on public.campaign_memories to authenticated;
grant insert (campaign_id, kind, title, content, occurred_on, meeting_id, subject, image_path, recap, visibility, status) on public.campaign_memories to authenticated;
grant update (kind, title, content, occurred_on, meeting_id, subject, image_path, recap, visibility, status) on public.campaign_memories to authenticated;
alter table public.campaign_memories enable row level security;

-- Players read only what the DM published for players; the DM reads everything (including private notes).
drop policy if exists "Memories: DM reads all, players read published player-visible ones" on public.campaign_memories;
create policy "Memories: DM reads all, players read published player-visible ones" on public.campaign_memories for select to authenticated
  using (
    (select private.is_campaign_owner(campaign_id))
    or (visibility = 'players' and status = 'published' and (select private.is_active_campaign_member(campaign_id)))
  );
drop policy if exists "Memories: the DM writes (plan permitting)" on public.campaign_memories;
create policy "Memories: the DM writes (plan permitting)" on public.campaign_memories for insert to authenticated
  with check (
    created_by = (select auth.uid()) and (select private.is_campaign_owner(campaign_id))
    and (select private.campaign_is_active(campaign_id)) and (select private.campaign_has_memories(campaign_id))
  );
drop policy if exists "Memories: the DM edits (plan permitting)" on public.campaign_memories;
create policy "Memories: the DM edits (plan permitting)" on public.campaign_memories for update to authenticated
  using ((select private.is_campaign_owner(campaign_id)) and (select private.campaign_is_active(campaign_id)) and (select private.campaign_has_memories(campaign_id)))
  with check ((select private.is_campaign_owner(campaign_id)));
drop policy if exists "Memories: the DM deletes" on public.campaign_memories;
create policy "Memories: the DM deletes" on public.campaign_memories for delete to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

-- Private image bucket: <campaign id>/players/<file> (members read) and <campaign id>/dm/<file> (DM only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-memories', 'campaign-memories', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.memory_object_campaign(name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(players|dm)/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$' then split_part(name, '/', 1)::uuid end;
$$;
grant execute on function private.memory_object_campaign(text) to authenticated;

drop policy if exists "Memory images: DM reads all, members read the players folder" on storage.objects;
create policy "Memory images: DM reads all, members read the players folder" on storage.objects for select to authenticated
  using (bucket_id = 'campaign-memories' and private.memory_object_campaign(name) is not null and (
    (select private.is_campaign_owner(private.memory_object_campaign(name)))
    or (split_part(name, '/', 2) = 'players' and (select private.is_active_campaign_member(private.memory_object_campaign(name))))));
drop policy if exists "Memory images: the DM uploads (plan permitting)" on storage.objects;
create policy "Memory images: the DM uploads (plan permitting)" on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-memories' and private.memory_object_campaign(name) is not null
    and (select private.is_campaign_owner(private.memory_object_campaign(name))) and (select private.campaign_has_memories(private.memory_object_campaign(name))));
drop policy if exists "Memory images: the DM deletes" on storage.objects;
create policy "Memory images: the DM deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-memories' and private.memory_object_campaign(name) is not null and (select private.is_campaign_owner(private.memory_object_campaign(name))));

-- -----------------------------------------------------------------------------
-- 8. The campaign book's data (members only, only when unlocked)
-- -----------------------------------------------------------------------------
create or replace function public.campaign_book(target_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.campaigns%rowtype;
begin
  if not (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign)) then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;
  if not private.campaign_book_unlocked(target_campaign) then
    raise exception 'The campaign book isn''t unlocked for this campaign.' using errcode = '42501';
  end if;
  select * into c from public.campaigns where id = target_campaign;
  return jsonb_build_object(
    'campaign', jsonb_build_object('name', c.name, 'description', c.description, 'cover_url', c.image_url, 'started_at', c.started_at, 'created_at', c.created_at),
    'dm', (select p.display_name from public.profiles p where p.id = c.owner_id),
    'party', coalesce((select jsonb_agg(jsonb_build_object('player', coalesce(p.display_name, 'Player'), 'character', m.character_name) order by m.joined_at)
                         from public.campaign_members m left join public.profiles p on p.id = m.user_id
                        where m.campaign_id = c.id and m.status = 'active' and m.role = 'player'), '[]'::jsonb),
    'meetings', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'starts_at', t.starts_at, 'summary', t.summary) order by t.starts_at)
                            from public.campaign_meetings t where t.campaign_id = c.id and t.status = 'completed'), '[]'::jsonb),
    'memories', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'title', x.title, 'content', x.content, 'occurred_on', x.occurred_on,
                              'meeting_id', x.meeting_id, 'subject', x.subject, 'image_path', x.image_path, 'recap', x.recap)
                              order by x.occurred_on nulls last, x.created_at)
                            from public.campaign_memories x where x.campaign_id = c.id and x.status = 'published' and x.visibility = 'players'), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('kind', h.kind, 'summary', h.summary, 'at', h.created_at) order by h.created_at)
                            from public.campaign_history h where h.campaign_id = c.id and h.kind in ('started', 'level_up')), '[]'::jsonb));
end;
$$;
revoke all on function public.campaign_book(uuid) from public, anon;
grant execute on function public.campaign_book(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Only when Realtime exists, isn't already publishing every table, and only tables not published yet.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    foreach t in array array['campaign_schedule_requests', 'campaign_schedule_responses', 'campaign_schedule_confirmations', 'campaign_notifications', 'campaign_memories'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
