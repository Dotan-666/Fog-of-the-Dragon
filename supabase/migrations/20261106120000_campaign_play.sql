-- =============================================================================
-- Fog of the Dragon — 005: joining campaigns, party characters, starting a campaign
--
-- * Every campaign gets a server-generated invite code (FOD-1234-AB).
-- * Players join with that code while the campaign is recruiting and has room.
-- * Each player brings a character: they pick/build one, or the DM builds it for them.
-- * The DM can start the campaign only when everyone is in and every player has a character.
--
-- All of these changes go through SECURITY DEFINER functions that check the caller;
-- none of the new columns are writable by clients directly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
create or replace function private.new_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := 'FOD-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0') || '-'
      || substr(letters, floor(random() * 24)::int + 1, 1)
      || substr(letters, floor(random() * 24)::int + 1, 1);
    exit when not exists (select 1 from public.campaigns where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Used as the column default, which runs as the inserting user. It only returns an unused random code.
revoke all on function private.new_invite_code() from public;
grant execute on function private.new_invite_code() to authenticated;

alter table public.campaigns
  add column invite_code text,
  add column phase text not null default 'recruiting' check (phase in ('recruiting', 'started')),
  add column started_at timestamptz,
  add constraint campaigns_started_at_matches_phase check ((phase = 'started') = (started_at is not null));

update public.campaigns set invite_code = private.new_invite_code() where invite_code is null;

alter table public.campaigns
  alter column invite_code set not null,
  alter column invite_code set default private.new_invite_code(),
  add constraint campaigns_invite_code_format check (invite_code ~ '^FOD-[0-9]{4}-[A-Z]{2}$');

create unique index campaigns_invite_code_idx on public.campaigns (invite_code);

comment on column public.campaigns.phase is 'recruiting: players can join and choose characters. started: set only by start_campaign().';

alter table public.campaign_members
  add column character_data jsonb check (character_data is null or (jsonb_typeof(character_data) = 'object' and octet_length(character_data::text) <= 400000)),
  add column character_name text check (char_length(character_name) between 1 and 80),
  add column character_built_by text check (character_built_by in ('player', 'dm')),
  add column character_updated_at timestamptz,
  add constraint campaign_members_character_fields
    check ((character_data is null) = (character_name is null)
       and (character_data is null) = (character_built_by is null)
       and (character_data is null) = (character_updated_at is null)),
  add constraint campaign_members_owner_no_character check (role <> 'owner' or character_data is null);

comment on column public.campaign_members.character_data is 'Snapshot of the player''s character (choices + narrative). Rules legality is checked by the app''s rules engine when shown.';

-- -----------------------------------------------------------------------------
-- Functions (the only way to join, set characters and start)
-- -----------------------------------------------------------------------------

-- Join a campaign with its invite code. Returns the campaign id.
create or replace function public.join_campaign(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
  members int;
begin
  if me is null then
    raise exception 'Sign in to join a campaign.' using errcode = '28000';
  end if;
  select * into c from public.campaigns where invite_code = upper(btrim(code));
  if not found then
    raise exception 'No campaign has that invite code.' using errcode = 'P0002';
  end if;
  if c.owner_id = me then
    raise exception 'You are the Dungeon Master of this campaign.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.campaign_members m where m.campaign_id = c.id and m.user_id = me and m.status = 'active') then
    return c.id; -- already in
  end if;
  if c.status <> 'active' then
    raise exception 'This campaign is archived and can''t be joined.' using errcode = 'P0001';
  end if;
  if c.phase <> 'recruiting' then
    raise exception 'This campaign has already started.' using errcode = 'P0001';
  end if;
  -- Lock the campaign row so two people can't take the last seat at once.
  perform 1 from public.campaigns where id = c.id for update;
  select count(*) into members from public.campaign_members m where m.campaign_id = c.id and m.status = 'active';
  if members >= c.required_players then
    raise exception 'This campaign is full.' using errcode = 'P0001';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role, status, joined_at)
  values (c.id, me, 'player', 'active', now())
  on conflict (campaign_id, user_id) do update set status = 'active';
  return c.id;
end;
$$;

-- A player sets their own character, or the DM sets one for a player.
create or replace function public.set_member_character(target_campaign uuid, target_user uuid, p_character jsonb, p_character_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
  builder text;
begin
  select * into c from public.campaigns where id = target_campaign;
  if not found then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;
  if me = target_user and exists (select 1 from public.campaign_members m where m.campaign_id = c.id and m.user_id = me and m.role = 'player' and m.status = 'active') then
    builder := 'player';
  elsif c.owner_id = me then
    builder := 'dm';
  else
    raise exception 'Only the player or the Dungeon Master can set this character.' using errcode = '42501';
  end if;
  if c.status <> 'active' or c.phase <> 'recruiting' then
    raise exception 'Characters can only be changed before the campaign starts.' using errcode = 'P0001';
  end if;
  if p_character is null or jsonb_typeof(p_character) <> 'object' or p_character_name is null or btrim(p_character_name) = '' then
    raise exception 'A character with a name is required.' using errcode = '22023';
  end if;
  update public.campaign_members m
     set character_data = p_character,
         character_name = btrim(p_character_name),
         character_built_by = builder,
         character_updated_at = now()
   where m.campaign_id = c.id and m.user_id = target_user and m.role = 'player' and m.status = 'active';
  if not found then
    raise exception 'That player isn''t in this campaign.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.clear_member_character(target_campaign uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c public.campaigns%rowtype;
begin
  select * into c from public.campaigns where id = target_campaign;
  if not found or not (me = target_user or c.owner_id = me) then
    raise exception 'Only the player or the Dungeon Master can change this character.' using errcode = '42501';
  end if;
  if c.phase <> 'recruiting' then
    raise exception 'Characters can only be changed before the campaign starts.' using errcode = 'P0001';
  end if;
  update public.campaign_members m
     set character_data = null, character_name = null, character_built_by = null, character_updated_at = null
   where m.campaign_id = c.id and m.user_id = target_user and m.role = 'player';
end;
$$;

-- The DM starts the campaign: every seat filled and every player has a character.
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
end;
$$;

-- Party roster with display names. Profiles stay private; this returns only names and
-- avatars of people in a campaign the caller belongs to (as DM or active player).
create or replace function public.campaign_roster(target_campaign uuid)
returns table (
  user_id uuid, role text, status text, joined_at timestamptz, display_name text, avatar_url text,
  character_data jsonb, character_name text, character_built_by text, character_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, m.status, m.joined_at, coalesce(p.display_name, 'Player'), p.avatar_url,
         m.character_data, m.character_name, m.character_built_by, m.character_updated_at
    from public.campaign_members m
    left join public.profiles p on p.id = m.user_id
   where m.campaign_id = target_campaign
     and (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign))
   order by (m.role = 'owner') desc, m.joined_at nulls last;
$$;

revoke all on function public.join_campaign(text) from public, anon;
revoke all on function public.set_member_character(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.clear_member_character(uuid, uuid) from public, anon;
revoke all on function public.start_campaign(uuid) from public, anon;
revoke all on function public.campaign_roster(uuid) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;
grant execute on function public.set_member_character(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.clear_member_character(uuid, uuid) to authenticated;
grant execute on function public.start_campaign(uuid) to authenticated;
grant execute on function public.campaign_roster(uuid) to authenticated;

-- Once a campaign has started its party is fixed: nobody can leave or be removed by the
-- ordinary delete policy (the campaign itself can still be deleted by its owner).
drop policy "Members: owners remove players, players leave" on public.campaign_members;
create policy "Members: owners remove players, players leave (before start)"
  on public.campaign_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or (select private.is_campaign_owner(campaign_id))
    )
    and not exists (select 1 from public.campaigns c where c.id = campaign_id and c.phase = 'started')
  );

-- -----------------------------------------------------------------------------
-- Campaign cover images: public read, each user writes only in their own folder.
--   campaign-covers/<user id>/<campaign id>.jpg
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-covers', 'campaign-covers', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Covers: list own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'campaign-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Covers: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campaign-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Covers: replace own files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campaign-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'campaign-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Covers: delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campaign-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
