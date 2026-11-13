-- =============================================================================
-- Fog of the Dragon — campaign workspace (the Campaign SPA, Pages/campaign.html)
--
-- * campaign_messages        feed / chat; members read and write, authors (or the DM) delete
-- * campaign_meetings        scheduler; members read, only the DM writes; completed meetings are kept
-- * campaign_meeting_rsvps   each member's own answer for a meeting
-- * campaign_combats         full encounter state: Dungeon Master only (monster HP, notes)
-- * campaign_combat_public   what the table sees (no monster HP): members read; written with the full state
-- * campaign_progress        which sections of the campaign's adventure the DM is on / has finished: DM only
-- * campaign_reveals         player-facing text of adventure sections the DM chose to show the players
-- * regenerate_invite_code() DM replaces a leaked invite code while the party is still gathering
--
-- Every table has Row Level Security. Combat is written only through save_campaign_combat() so the
-- full state and the public state always change together. Nobody outside a campaign can read any of it.
-- =============================================================================
-- Safe to run again: every object is created only if missing (tables, indexes), recreated in place (functions, policies,
-- triggers) or added only once (Realtime publication). Running it a second time keeps all data. This fixes the
-- "… already exists" error when the file was run more than once (for example pasted again in the SQL Editor, or applied
-- by `supabase db push` after it had been run by hand).

-- A campaign accepts new content only while it is active (archived campaigns are read-only).
create or replace function private.campaign_is_active(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.campaigns c where c.id = target_campaign and c.status = 'active');
$$;

revoke all on function private.campaign_is_active(uuid) from public;
grant execute on function private.campaign_is_active(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_messages (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists campaign_messages_feed_idx on public.campaign_messages (campaign_id, created_at desc);

revoke all on public.campaign_messages from anon, authenticated;
grant select, delete on public.campaign_messages to authenticated;
grant insert (campaign_id, body) on public.campaign_messages to authenticated;

alter table public.campaign_messages enable row level security;

drop policy if exists "Messages: members read" on public.campaign_messages;
create policy "Messages: members read"
  on public.campaign_messages for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

drop policy if exists "Messages: members write as themselves in active campaigns" on public.campaign_messages;
create policy "Messages: members write as themselves in active campaigns"
  on public.campaign_messages for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)))
    and (select private.campaign_is_active(campaign_id))
  );

drop policy if exists "Messages: authors and the DM delete" on public.campaign_messages;
create policy "Messages: authors and the DM delete"
  on public.campaign_messages for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_campaign_owner(campaign_id)));

-- -----------------------------------------------------------------------------
-- Meetings
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_meetings (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  location     text not null default '' check (char_length(location) <= 200),
  description  text not null default '' check (char_length(description) <= 2000),
  status       text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  summary      text not null default '' check (char_length(summary) <= 8000),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint campaign_meetings_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint campaign_meetings_completed_at_matches_status check ((status = 'completed') = (completed_at is not null))
);
create index if not exists campaign_meetings_campaign_idx on public.campaign_meetings (campaign_id, starts_at);

-- A completed meeting is history: it can't go back to "scheduled" and can't be deleted (see policy).
create or replace function private.campaign_meetings_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'completed' and new.status <> 'completed' then
      raise exception 'A completed meeting stays in the campaign history.' using errcode = 'P0001';
    end if;
    if new.status = 'completed' and old.status <> 'completed' then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_meetings_guard on public.campaign_meetings;
create trigger campaign_meetings_guard
  before update on public.campaign_meetings
  for each row execute function private.campaign_meetings_guard();

drop trigger if exists campaign_meetings_set_updated_at on public.campaign_meetings;
create trigger campaign_meetings_set_updated_at
  before update on public.campaign_meetings
  for each row execute function private.set_updated_at();

revoke all on public.campaign_meetings from anon, authenticated;
grant select, delete on public.campaign_meetings to authenticated;
grant insert (campaign_id, title, starts_at, ends_at, location, description) on public.campaign_meetings to authenticated;
grant update (title, starts_at, ends_at, location, description, status, summary) on public.campaign_meetings to authenticated;

alter table public.campaign_meetings enable row level security;

drop policy if exists "Meetings: members read" on public.campaign_meetings;
create policy "Meetings: members read"
  on public.campaign_meetings for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

drop policy if exists "Meetings: the DM schedules in active campaigns" on public.campaign_meetings;
create policy "Meetings: the DM schedules in active campaigns"
  on public.campaign_meetings for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_campaign_owner(campaign_id))
    and (select private.campaign_is_active(campaign_id))
  );

drop policy if exists "Meetings: the DM edits in active campaigns" on public.campaign_meetings;
create policy "Meetings: the DM edits in active campaigns"
  on public.campaign_meetings for update
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) and (select private.campaign_is_active(campaign_id)))
  with check ((select private.is_campaign_owner(campaign_id)));

drop policy if exists "Meetings: the DM deletes meetings that did not happen" on public.campaign_meetings;
create policy "Meetings: the DM deletes meetings that did not happen"
  on public.campaign_meetings for delete
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) and status <> 'completed');

-- The campaign a meeting belongs to, for the RSVP policies.
create or replace function private.meeting_campaign(target_meeting uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.campaign_id from public.campaign_meetings m where m.id = target_meeting;
$$;

revoke all on function private.meeting_campaign(uuid) from public;
grant execute on function private.meeting_campaign(uuid) to authenticated;

-- RSVPs
create table if not exists public.campaign_meeting_rsvps (
  meeting_id uuid not null references public.campaign_meetings (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  response   text not null check (response in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

drop trigger if exists campaign_meeting_rsvps_set_updated_at on public.campaign_meeting_rsvps;
create trigger campaign_meeting_rsvps_set_updated_at
  before update on public.campaign_meeting_rsvps
  for each row execute function private.set_updated_at();

revoke all on public.campaign_meeting_rsvps from anon, authenticated;
grant select, delete on public.campaign_meeting_rsvps to authenticated;
grant insert (meeting_id, response) on public.campaign_meeting_rsvps to authenticated;
grant update (response) on public.campaign_meeting_rsvps to authenticated;

alter table public.campaign_meeting_rsvps enable row level security;

drop policy if exists "RSVPs: members read" on public.campaign_meeting_rsvps;
create policy "RSVPs: members read"
  on public.campaign_meeting_rsvps for select
  to authenticated
  using (
    (select private.is_campaign_owner(private.meeting_campaign(meeting_id)))
    or (select private.is_active_campaign_member(private.meeting_campaign(meeting_id)))
  );

drop policy if exists "RSVPs: members answer for themselves" on public.campaign_meeting_rsvps;
create policy "RSVPs: members answer for themselves"
  on public.campaign_meeting_rsvps for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and ((select private.is_campaign_owner(private.meeting_campaign(meeting_id)))
         or (select private.is_active_campaign_member(private.meeting_campaign(meeting_id))))
    and exists (select 1 from public.campaign_meetings m where m.id = meeting_id and m.status = 'scheduled')
  );

drop policy if exists "RSVPs: members change their own answer" on public.campaign_meeting_rsvps;
create policy "RSVPs: members change their own answer"
  on public.campaign_meeting_rsvps for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "RSVPs: members remove their own answer" on public.campaign_meeting_rsvps;
create policy "RSVPs: members remove their own answer"
  on public.campaign_meeting_rsvps for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Combat: full state (DM only) + public state (members), written together
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_combats (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  state       jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 200000),
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

create table if not exists public.campaign_combat_public (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  state       jsonb not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 100000),
  updated_at  timestamptz not null default now()
);

revoke all on public.campaign_combats from anon, authenticated;
revoke all on public.campaign_combat_public from anon, authenticated;
grant select on public.campaign_combats to authenticated;
grant select on public.campaign_combat_public to authenticated;

alter table public.campaign_combats enable row level security;
alter table public.campaign_combat_public enable row level security;

drop policy if exists "Combat: only the DM reads the full encounter" on public.campaign_combats;
create policy "Combat: only the DM reads the full encounter"
  on public.campaign_combats for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

drop policy if exists "Combat: members read the public encounter" on public.campaign_combat_public;
create policy "Combat: members read the public encounter"
  on public.campaign_combat_public for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

create or replace function public.save_campaign_combat(target_campaign uuid, p_state jsonb, p_public jsonb, expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur integer;
begin
  if not private.is_campaign_owner(target_campaign) then
    raise exception 'Only the Dungeon Master can run combat.' using errcode = '42501';
  end if;
  if not private.campaign_is_active(target_campaign) then
    raise exception 'Restore the campaign before running combat.' using errcode = 'P0001';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or p_public is null or jsonb_typeof(p_public) <> 'object' then
    raise exception 'The encounter is not valid.' using errcode = '22023';
  end if;
  select c.version into cur from public.campaign_combats c where c.campaign_id = target_campaign for update;
  if found then
    if expected_version is not null and expected_version <> cur then
      raise exception 'This encounter was changed somewhere else (another tab or device). Reload to continue.' using errcode = 'P0001';
    end if;
    cur := cur + 1;
    update public.campaign_combats set state = p_state, version = cur, updated_at = now() where campaign_id = target_campaign;
  else
    cur := 1;
    insert into public.campaign_combats (campaign_id, state, version) values (target_campaign, p_state, cur);
  end if;
  insert into public.campaign_combat_public (campaign_id, state) values (target_campaign, p_public)
  on conflict (campaign_id) do update set state = excluded.state, updated_at = now();
  return cur;
end;
$$;

create or replace function public.clear_campaign_combat(target_campaign uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_campaign_owner(target_campaign) then
    raise exception 'Only the Dungeon Master can run combat.' using errcode = '42501';
  end if;
  delete from public.campaign_combats where campaign_id = target_campaign;
  delete from public.campaign_combat_public where campaign_id = target_campaign;
end;
$$;

revoke all on function public.save_campaign_combat(uuid, jsonb, jsonb, integer) from public, anon;
revoke all on function public.clear_campaign_combat(uuid) from public, anon;
grant execute on function public.save_campaign_combat(uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function public.clear_campaign_combat(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Adventure progress (DM only) and content revealed to players
-- -----------------------------------------------------------------------------
create table if not exists public.campaign_progress (
  campaign_id        uuid primary key references public.campaigns (id) on delete cascade,
  current_section    text check (char_length(current_section) <= 64),
  completed_sections text[] not null default '{}' check (cardinality(completed_sections) <= 20000),
  updated_at         timestamptz not null default now()
);

drop trigger if exists campaign_progress_set_updated_at on public.campaign_progress;
create trigger campaign_progress_set_updated_at
  before update on public.campaign_progress
  for each row execute function private.set_updated_at();

revoke all on public.campaign_progress from anon, authenticated;
grant select, delete on public.campaign_progress to authenticated;
grant insert (campaign_id, current_section, completed_sections) on public.campaign_progress to authenticated;
grant update (current_section, completed_sections) on public.campaign_progress to authenticated;

alter table public.campaign_progress enable row level security;

drop policy if exists "Progress: only the DM reads" on public.campaign_progress;
create policy "Progress: only the DM reads"
  on public.campaign_progress for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

drop policy if exists "Progress: the DM records in active campaigns" on public.campaign_progress;
create policy "Progress: the DM records in active campaigns"
  on public.campaign_progress for insert
  to authenticated
  with check ((select private.is_campaign_owner(campaign_id)) and (select private.campaign_is_active(campaign_id)));

drop policy if exists "Progress: the DM updates in active campaigns" on public.campaign_progress;
create policy "Progress: the DM updates in active campaigns"
  on public.campaign_progress for update
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) and (select private.campaign_is_active(campaign_id)))
  with check ((select private.is_campaign_owner(campaign_id)));

drop policy if exists "Progress: the DM deletes" on public.campaign_progress;
create policy "Progress: the DM deletes"
  on public.campaign_progress for delete
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

create table if not exists public.campaign_reveals (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  section_id    text not null check (char_length(section_id) <= 64),
  kind          text not null default 'scene' check (char_length(kind) <= 32),
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  chapter_title text not null default '' check (char_length(chapter_title) <= 160),
  body          text not null default '' check (char_length(body) <= 6000),
  revealed_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (campaign_id, section_id)
);

revoke all on public.campaign_reveals from anon, authenticated;
grant select, delete on public.campaign_reveals to authenticated;
grant insert (campaign_id, section_id, kind, title, chapter_title, body) on public.campaign_reveals to authenticated;

alter table public.campaign_reveals enable row level security;

drop policy if exists "Reveals: members read" on public.campaign_reveals;
create policy "Reveals: members read"
  on public.campaign_reveals for select
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)) or (select private.is_active_campaign_member(campaign_id)));

drop policy if exists "Reveals: the DM shares in active campaigns" on public.campaign_reveals;
create policy "Reveals: the DM shares in active campaigns"
  on public.campaign_reveals for insert
  to authenticated
  with check (
    revealed_by = (select auth.uid())
    and (select private.is_campaign_owner(campaign_id))
    and (select private.campaign_is_active(campaign_id))
  );

drop policy if exists "Reveals: the DM hides again" on public.campaign_reveals;
create policy "Reveals: the DM hides again"
  on public.campaign_reveals for delete
  to authenticated
  using ((select private.is_campaign_owner(campaign_id)));

-- -----------------------------------------------------------------------------
-- Invitations: the DM can replace the invite code while the party is gathering
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_invite_code(target_campaign uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
  c public.campaigns%rowtype;
begin
  select * into c from public.campaigns where id = target_campaign for update;
  if not found or c.owner_id <> auth.uid() then
    raise exception 'Only the Dungeon Master can change the invite code.' using errcode = '42501';
  end if;
  if c.status <> 'active' or c.phase <> 'recruiting' then
    raise exception 'The invite code only matters while the party is gathering.' using errcode = 'P0001';
  end if;
  code := private.new_invite_code();
  -- invite_code is not client-writable, so this function (security definer) is the only way to change it.
  update public.campaigns set invite_code = code where id = c.id;
  return code;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (Supabase only): new rows are pushed to members, filtered by the policies above.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Only when Realtime exists, isn't already publishing every table, and only tables not published yet.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    foreach t in array array['campaign_messages', 'campaign_meetings', 'campaign_combat_public', 'campaign_reveals'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
