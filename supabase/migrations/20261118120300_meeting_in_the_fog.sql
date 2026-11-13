-- =============================================================================
-- Fog of the Dragon — Meeting in the Fog (video meetings inside a campaign)
--
-- Supabase keeps the room METADATA, lifecycle, permissions and events. Audio and video never pass through Supabase: they
-- go through the media provider (LiveKit, an SFU). Join tokens are short-lived and minted only by the Edge Function
-- supabase/functions/meeting-fog after public.meeting_join_grant() has checked the caller here. No recording exists.
--
--   meeting_rooms               one row per room: campaign, optional meeting, status scheduled → open → closed,
--                               provider room name, config, and the DM's shared-audio state (music commands, not audio)
--                               · at most ONE open room per campaign · at most one room per meeting (reopened, never duplicated)
--   meeting_room_participants   who was let in (one row per person and room: re-joining updates it), role, joined/left,
--                               last_seen (heartbeat) so a closed browser drops out of "connected" within minutes
--   campaign_meetings.venue     'in_person' | 'fog' | null (not said). A scheduled meeting with venue 'fog' gets a room
--                               in state 'scheduled'; the DM opens it at meeting time; cancelling the meeting closes it.
--   Scheduler: the "online" format IS Meeting in the Fog now (no link needed, none generated). Existing data keeps its
--   meaning; a link typed by hand earlier stays valid.
--
-- Functions (all check the caller; nobody writes the tables directly):
--   open_meeting_room(campaign, meeting?, title?)  DM, active campaign. Returns the open room (the same one if called twice)
--   close_meeting_room(room)                       DM. Everyone is marked as left
--   meeting_join_grant(room)                       DM or active member, active campaign, open room → what the token needs
--   leave_meeting_room(room) · meeting_heartbeat(room)
--   set_room_audio_state(room, seq, state)         DM. Ordered by seq (stale or repeated commands are ignored)
--   meeting_now()                                  the server clock (to line up timestamps)
-- Run after 20261117120100_scheduler_background.sql. Safe to run again.
-- =============================================================================

do $$
begin
  if to_regprocedure('private.schedule_write_proposal(uuid, text, text, uuid, text, text, boolean)') is null then
    raise exception 'Run 20261117120100_scheduler_background.sql first (and the migrations before it, in filename order).';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Meetings say where they happen
-- -----------------------------------------------------------------------------
alter table public.campaign_meetings add column if not exists venue text;
alter table public.campaign_meetings drop constraint if exists campaign_meetings_venue;
alter table public.campaign_meetings add constraint campaign_meetings_venue check (venue is null or venue in ('in_person', 'fog'));
grant insert (venue) on public.campaign_meetings to authenticated;
grant update (venue) on public.campaign_meetings to authenticated;

-- -----------------------------------------------------------------------------
-- Rooms and participants
-- -----------------------------------------------------------------------------
create table if not exists public.meeting_rooms (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  meeting_id    uuid references public.campaign_meetings (id) on delete set null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'open', 'closed')),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  created_by    uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  opened_at     timestamptz,
  closed_at     timestamptz,
  provider      text not null default 'livekit' check (provider in ('livekit')),
  provider_room text not null unique check (provider_room ~ '^fod-[0-9a-f-]{36}$'),
  config        jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 4000),
  audio_state   jsonb not null default '{}'::jsonb check (jsonb_typeof(audio_state) = 'object' and octet_length(audio_state::text) <= 4000),
  audio_seq     bigint not null default 0,
  updated_at    timestamptz not null default now(),
  constraint meeting_rooms_open_has_time check (status <> 'open' or opened_at is not null),
  constraint meeting_rooms_closed_has_time check (status <> 'closed' or closed_at is not null)
);
create unique index if not exists meeting_rooms_one_open on public.meeting_rooms (campaign_id) where status = 'open';
create unique index if not exists meeting_rooms_one_per_meeting on public.meeting_rooms (meeting_id) where meeting_id is not null;
create index if not exists meeting_rooms_campaign on public.meeting_rooms (campaign_id, created_at desc);

create table if not exists public.meeting_room_participants (
  room_id      uuid not null references public.meeting_rooms (id) on delete cascade,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('dm', 'player')),
  status       text not null default 'joined' check (status in ('joined', 'left')),
  joined_at    timestamptz not null default now(),
  left_at      timestamptz,
  last_seen_at timestamptz not null default now(),
  joins        integer not null default 1,
  primary key (room_id, user_id)
);
create index if not exists meeting_room_participants_campaign on public.meeting_room_participants (campaign_id);

revoke all on public.meeting_rooms, public.meeting_room_participants from anon, authenticated;
grant select on public.meeting_rooms, public.meeting_room_participants to authenticated;
alter table public.meeting_rooms enable row level security;
alter table public.meeting_room_participants enable row level security;
grant execute on function private.is_campaign_owner(uuid) to authenticated;
grant execute on function private.is_active_campaign_member(uuid) to authenticated;
drop policy if exists "Meeting rooms: campaign members read" on public.meeting_rooms;
create policy "Meeting rooms: campaign members read" on public.meeting_rooms for select to authenticated
  using (private.is_campaign_owner(campaign_id) or private.is_active_campaign_member(campaign_id));
drop policy if exists "Meeting participants: campaign members read" on public.meeting_room_participants;
create policy "Meeting participants: campaign members read" on public.meeting_room_participants for select to authenticated
  using (private.is_campaign_owner(campaign_id) or private.is_active_campaign_member(campaign_id));

create or replace function private.meeting_room_touch()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists meeting_rooms_touch on public.meeting_rooms;
create trigger meeting_rooms_touch before update on public.meeting_rooms for each row execute function private.meeting_room_touch();

-- A scheduled meeting held in the Fog has a room waiting (never two); cancelling or finishing the meeting closes it.
create or replace function private.meeting_room_for_meeting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.venue = 'fog' and new.status = 'scheduled' then
    insert into public.meeting_rooms (id, campaign_id, meeting_id, status, title, created_by, provider_room)
    select x.id, new.campaign_id, new.id, 'scheduled', new.title, new.created_by, 'fod-' || x.id::text
      from (select gen_random_uuid() as id) x
    on conflict (meeting_id) where meeting_id is not null do update set title = excluded.title
      where public.meeting_rooms.status <> 'closed';
  elsif tg_op = 'UPDATE' and (new.status <> 'scheduled' or new.venue is distinct from 'fog') then
    update public.meeting_rooms set status = 'closed', closed_at = now() where meeting_id = new.id and status = 'scheduled';
  end if;
  return new;
end;
$$;
revoke all on function private.meeting_room_for_meeting() from public, anon, authenticated;
drop trigger if exists campaign_meetings_fog_room on public.campaign_meetings;
create trigger campaign_meetings_fog_room after insert or update of venue, status, title on public.campaign_meetings
  for each row execute function private.meeting_room_for_meeting();

-- -----------------------------------------------------------------------------
-- Lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.open_meeting_room(p_campaign uuid, p_meeting uuid default null, p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  m public.campaign_meetings%rowtype;
  t text := left(btrim(coalesce(p_title, '')), 120);
begin
  if not private.is_campaign_owner(p_campaign) then
    raise exception 'Only the Dungeon Master can open Meeting in the Fog.' using errcode = '42501';
  end if;
  if not private.campaign_is_active(p_campaign) then
    raise exception 'This campaign is archived.' using errcode = 'P0001';
  end if;
  -- Serialise opens for this campaign (two clicks, two tabs): the second one finds the first room.
  perform 1 from public.campaigns where id = p_campaign for update;
  select id into rid from public.meeting_rooms where campaign_id = p_campaign and status = 'open';
  if found then
    return rid;
  end if;
  if p_meeting is not null then
    select * into m from public.campaign_meetings where id = p_meeting and campaign_id = p_campaign;
    if not found then raise exception 'That meeting isn''t part of this campaign.' using errcode = '22023'; end if;
    if m.status <> 'scheduled' then raise exception 'That meeting is over or cancelled.' using errcode = 'P0001'; end if;
    update public.meeting_rooms set status = 'open', opened_at = now(), closed_at = null where meeting_id = p_meeting returning id into rid;
    if rid is null then
      rid := gen_random_uuid();
      insert into public.meeting_rooms (id, campaign_id, meeting_id, status, title, created_by, opened_at, provider_room)
      values (rid, p_campaign, p_meeting, 'open', m.title, auth.uid(), now(), 'fod-' || rid::text);
    end if;
  else
    rid := gen_random_uuid();
    insert into public.meeting_rooms (id, campaign_id, status, title, created_by, opened_at, provider_room)
    values (rid, p_campaign, 'open', coalesce(nullif(t, ''), 'Meeting in the Fog'), auth.uid(), now(), 'fod-' || rid::text);
  end if;
  perform private.notify_campaign(p_campaign, 'meeting', 'Meeting in the Fog is open',
    'The Dungeon Master opened the room. Join from the Campaign Feed.', 'feed', auth.uid());
  return rid;
end;
$$;

create or replace function public.close_meeting_room(p_room uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.meeting_rooms%rowtype;
begin
  select * into r from public.meeting_rooms where id = p_room for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can close this room.' using errcode = '42501';
  end if;
  if r.status = 'closed' then return 'closed'; end if;
  update public.meeting_rooms set status = 'closed', closed_at = now() where id = p_room;
  update public.meeting_room_participants set status = 'left', left_at = now() where room_id = p_room and status = 'joined';
  return 'closed';
end;
$$;

-- What the Edge Function needs to mint a join token, after checking the caller (called WITH the caller's session).
create or replace function public.meeting_join_grant(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.meeting_rooms%rowtype;
  me uuid := auth.uid();
  is_dm boolean;
  who text;
begin
  select * into r from public.meeting_rooms where id = p_room for update;
  -- Same answer for "doesn't exist" and "not your campaign": room ids can't be probed.
  if not found or me is null or not (private.is_campaign_owner(r.campaign_id) or private.is_active_campaign_member(r.campaign_id)) then
    raise exception 'Room not found.' using errcode = '42501';
  end if;
  if not private.campaign_is_active(r.campaign_id) then
    raise exception 'This campaign is archived.' using errcode = 'P0001';
  end if;
  if r.status <> 'open' then
    raise exception 'The room isn''t open.' using errcode = 'P0001';
  end if;
  is_dm := private.is_campaign_owner(r.campaign_id);
  insert into public.meeting_room_participants (room_id, campaign_id, user_id, role)
  values (p_room, r.campaign_id, me, case when is_dm then 'dm' else 'player' end)
  on conflict (room_id, user_id) do update
    set status = 'joined', left_at = null, last_seen_at = now(),
        joins = public.meeting_room_participants.joins + case when public.meeting_room_participants.status = 'left' then 1 else 0 end;
  select left(coalesce(nullif(btrim(p.display_name), ''), p.username, 'Adventurer'), 60) into who from public.profiles p where p.id = me;
  return jsonb_build_object('roomId', r.id, 'campaignId', r.campaign_id, 'providerRoom', r.provider_room, 'provider', r.provider,
    'title', r.title, 'role', case when is_dm then 'dm' else 'player' end, 'name', coalesce(who, 'Adventurer'), 'userId', me);
end;
$$;

create or replace function public.leave_meeting_room(p_room uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.meeting_room_participants set status = 'left', left_at = now()
   where room_id = p_room and user_id = auth.uid() and status = 'joined';
$$;

create or replace function public.meeting_heartbeat(p_room uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meeting_room_participants p set last_seen_at = now()
    from public.meeting_rooms r
   where p.room_id = p_room and p.user_id = auth.uid() and p.status = 'joined' and r.id = p.room_id and r.status = 'open';
  return found;
end;
$$;

create or replace function public.meeting_now()
returns timestamptz language sql stable set search_path = '' as $$ select now(); $$;

-- The DM's shared music: small commands (which catalog track, play/pause/stop, volume, position) — never audio data.
-- seq orders them: a stale or repeated command is ignored and the current seq is returned.
create or replace function public.set_room_audio_state(p_room uuid, p_seq bigint, p_state jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.meeting_rooms%rowtype;
  act text := p_state ->> 'action';
  vol numeric;
  pos numeric;
begin
  select * into r from public.meeting_rooms where id = p_room for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master controls the room''s music.' using errcode = '42501';
  end if;
  if r.status <> 'open' then raise exception 'The room isn''t open.' using errcode = 'P0001'; end if;
  if p_seq is null or p_seq <= r.audio_seq then return r.audio_seq; end if;
  if jsonb_typeof(p_state) <> 'object' or act is null or act not in ('select', 'play', 'pause', 'stop', 'volume', 'track') then
    raise exception 'Unknown music command.' using errcode = '22023';
  end if;
  if coalesce(p_state ->> 'ref', '') !~ '^[A-Za-z0-9:_./-]{0,160}$' then
    raise exception 'Invalid track.' using errcode = '22023';
  end if;
  vol := case when jsonb_typeof(p_state -> 'volume') = 'number' then (p_state ->> 'volume')::numeric end;
  pos := case when jsonb_typeof(p_state -> 'position') = 'number' then (p_state ->> 'position')::numeric end;
  if (vol is not null and (vol < 0 or vol > 1)) or (pos is not null and (pos < 0 or pos > 86400)) then
    raise exception 'Invalid volume or position.' using errcode = '22023';
  end if;
  update public.meeting_rooms
     set audio_seq = p_seq,
         audio_state = jsonb_strip_nulls(jsonb_build_object('action', act, 'ref', nullif(p_state ->> 'ref', ''), 'title', left(p_state ->> 'title', 120),
           'playing', act in ('play', 'select', 'track', 'volume') and coalesce((p_state ->> 'playing')::boolean, act <> 'volume'),
           'volume', vol, 'position', pos, 'seq', p_seq, 'serverAt', now()))
   where id = p_room;
  return p_seq;
end;
$$;

revoke all on function public.open_meeting_room(uuid, uuid, text), public.close_meeting_room(uuid), public.meeting_join_grant(uuid),
  public.leave_meeting_room(uuid), public.meeting_heartbeat(uuid), public.meeting_now(), public.set_room_audio_state(uuid, bigint, jsonb) from public, anon;
grant execute on function public.open_meeting_room(uuid, uuid, text), public.close_meeting_room(uuid), public.meeting_join_grant(uuid),
  public.leave_meeting_room(uuid), public.meeting_heartbeat(uuid), public.meeting_now(), public.set_room_audio_state(uuid, bigint, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Scheduler: "online" = Meeting in the Fog (no link needed; nothing is generated)
-- -----------------------------------------------------------------------------
create or replace function private.schedule_write_proposal(rid uuid, p_slot text, p_format text, p_host uuid, p_link text, p_link_kind text, p_auto boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  version int;
  link text := btrim(coalesce(p_link, ''));
  kind text := p_link_kind;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not exists (select 1 from jsonb_array_elements(r.slots) e where e ->> 'id' = p_slot) then
    raise exception 'That time slot isn''t part of this request.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(r.slots) e where e ->> 'id' = p_slot and (e ->> 'start')::timestamptz <= now()) then
    raise exception 'That time has already passed.' using errcode = 'P0001';
  end if;
  if not private.schedule_unanimous(rid, p_slot) then
    raise exception 'Not everyone is available at that time. Choose a time that works for all % people, leave someone out of this meeting, or start another round.', cardinality(r.required_users) using errcode = 'P0001';
  end if;
  if p_format not in ('in_person', 'online') or (r.format <> 'either' and r.format <> p_format) then
    raise exception 'Choose a format that matches this request.' using errcode = '22023';
  end if;
  if p_format = 'in_person' then
    if p_host is null or not (p_host = any (private.schedule_eligible_hosts(rid))) then
      raise exception 'An in-person meeting needs a host who can host and agreed to share the location with the party.' using errcode = 'P0001';
    end if;
    link := '';
    kind := null;
  elsif link = '' then
    kind := 'fog'; -- Meeting in the Fog: the room lives in the campaign; nothing to link to
    p_host := null;
  else
    if link !~ '^https://[^\s]{4,180}$' then
      raise exception 'A meeting link must start with https:// (or leave it empty to meet in the Fog).' using errcode = '22023';
    end if;
    kind := 'manual';
    p_host := null;
  end if;
  version := coalesce((r.proposal ->> 'version')::int, 0) + 1;
  delete from public.campaign_schedule_confirmations c where c.request_id = rid and c.round = r.round;
  update public.campaign_schedule_requests
     set status = 'awaiting_confirmation', proposed_at = now(), confirm_reminded_at = null,
         proposal = jsonb_build_object('version', version, 'slot_id', p_slot, 'format', p_format, 'host_id', p_host, 'link', nullif(link, ''),
                                       'link_kind', kind, 'auto', coalesce(p_auto, false))
   where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule',
    case when p_auto then 'Everyone agrees: please confirm ' || r.title else 'Please confirm: ' || r.title end,
    case when p_auto then 'A time that works for everyone was proposed automatically. Check it and confirm.' else 'The DM proposed a final time. Check it and confirm.' end,
    'meetings/' || rid::text, case when p_auto then null else auth.uid() end);
  return version;
end;
$$;
revoke all on function private.schedule_write_proposal(uuid, text, text, uuid, text, text, boolean) from public, anon, authenticated;

-- Automatic proposal: an online meeting needs no link any more (Meeting in the Fog), so it can always be proposed.
create or replace function private.schedule_try_auto_propose(rid uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  slot text;
  hosts uuid[];
begin
  select * into r from public.campaign_schedule_requests where id = rid;
  if not found or not r.auto_propose or r.status <> 'consensus' then
    return false;
  end if;
  slot := private.schedule_best_slot(rid);
  if slot is null then
    return false;
  end if;
  hosts := private.schedule_eligible_hosts(rid);
  begin
    if r.format in ('in_person', 'either') and cardinality(hosts) = 1 then
      perform private.schedule_write_proposal(rid, slot, 'in_person', hosts[1], null, null, true);
    elsif r.format in ('online', 'either') then
      -- a link the DM saved earlier is kept; otherwise the meeting is in the Fog
      perform private.schedule_write_proposal(rid, slot, 'online', null, r.default_link, case when r.default_link is not null then 'manual' end, true);
    else
      return false;
    end if;
  exception when others then
    return false;
  end;
  return true;
end;
$$;
revoke all on function private.schedule_try_auto_propose(uuid) from public, anon, authenticated;

-- Confirmation: a Fog meeting is created with venue 'fog' (its room waits in state 'scheduled'). Re-confirming the same
-- request never makes a second meeting or room: the request is 'confirmed' after the first and the room is unique per meeting.
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
  ven text;
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
  if (r.proposal ->> 'version')::int is distinct from p_version or (r.proposal ->> 'slot_id') is distinct from p_slot then
    raise exception 'The proposal changed. Look at the new proposal before confirming.' using errcode = 'P0001';
  end if;
  if not private.schedule_unanimous(rid, p_slot) then
    raise exception 'Availability changed, so this time no longer works for everyone.' using errcode = 'P0001';
  end if;
  select e into slot from jsonb_array_elements(r.slots) e where e ->> 'id' = p_slot;
  starts := (slot ->> 'start')::timestamptz;
  if starts <= now() then
    raise exception 'That time has already passed.' using errcode = 'P0001';
  end if;
  insert into public.campaign_schedule_confirmations (request_id, round, user_id, proposal_version)
  values (rid, r.round, me, p_version)
  on conflict (request_id, round, user_id) do update set proposal_version = excluded.proposal_version, confirmed_at = now();
  select count(*) into done from public.campaign_schedule_confirmations c
   where c.request_id = rid and c.round = r.round and c.proposal_version = p_version and c.user_id = any (r.required_users);
  if done < cardinality(r.required_users) then
    return null;
  end if;
  ends := case when r.duration_minutes is not null then starts + make_interval(mins => r.duration_minutes) else (slot ->> 'end')::timestamptz end;
  if r.proposal ->> 'format' = 'in_person' then
    select h.location into loc from public.campaign_schedule_hosts h
     where h.request_id = rid and h.round = r.round and h.user_id = (r.proposal ->> 'host_id')::uuid and h.share_with_party;
    descr := 'In person. Agreed by everyone through the availability poll.';
    ven := 'in_person';
  elsif coalesce(r.proposal ->> 'link', '') = '' then
    loc := 'Meeting in the Fog';
    descr := 'Meeting in the Fog: video and voice in the campaign. The Dungeon Master opens the room at meeting time; join from the Campaign Feed. Agreed by everyone through the availability poll.';
    ven := 'fog';
  else
    loc := r.proposal ->> 'link';
    descr := 'Online, at a link the DM entered by hand. Agreed by everyone through the availability poll.';
    ven := null;
  end if;
  insert into public.campaign_meetings (campaign_id, created_by, title, starts_at, ends_at, location, description, venue)
  values (r.campaign_id, r.created_by, r.title, starts, ends, left(coalesce(loc, ''), 200), left(descr || case when r.notes <> '' then ' ' || r.notes else '' end, 2000), ven)
  returning id into mid;
  foreach u in array r.required_users loop
    insert into public.campaign_meeting_rsvps (meeting_id, user_id, response) values (mid, u, 'yes') on conflict do nothing;
  end loop;
  update public.campaign_schedule_requests set status = 'confirmed', meeting_id = mid where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule', 'Meeting confirmed: ' || r.title, 'Everyone agreed. It is now in Meetings.', 'meetings/' || mid::text);
  return mid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: room status, who joined, and the DM's music commands reach members (policies above decide who).
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    foreach t in array array['meeting_rooms', 'meeting_room_participants'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
