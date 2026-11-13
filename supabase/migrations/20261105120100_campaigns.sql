-- =============================================================================
-- Fog of the Dragon — 002: campaigns and campaign members
--
-- A campaign has exactly one owner (its Dungeon Master). The owner's membership
-- row is created by a trigger, never by a client. Other users can only be added
-- by the owner, as invited players, and only they can accept their invitation.
-- Columns mirror what the existing Create Campaign / campaign pages already use.
-- =============================================================================

create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  description      text not null default '' check (char_length(description) <= 2000),
  image_url        text check (char_length(image_url) <= 1024),
  status           text not null default 'active' check (status in ('active', 'archived')),
  game_system      text not null default 'dnd5e' check (game_system in ('dnd5e')),
  content_source   text not null default 'homebrew' check (content_source in ('homebrew', 'existing')),
  starting_level   smallint not null default 1 check (starting_level between 1 and 20),
  required_players smallint not null default 4 check (required_players between 1 and 50),
  visibility       text not null default 'private' check (visibility in ('public', 'private')),
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint campaigns_archived_at_matches_status
    check ((status = 'archived') = (archived_at is not null))
);

create index campaigns_owner_id_idx on public.campaigns (owner_id);

comment on table public.campaigns is 'Campaigns. owner_id is the Dungeon Master and can never be changed by clients.';
comment on column public.campaigns.visibility is 'Stored setting only. Public discovery is not implemented, so public campaigns are not readable by non-members.';

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'player' check (role in ('owner', 'player')),
  status      text not null default 'invited' check (status in ('invited', 'active')),
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, user_id),
  constraint campaign_members_joined_at_matches_status
    check ((status = 'active') = (joined_at is not null)),
  constraint campaign_members_owner_is_active
    check (role <> 'owner' or status = 'active')
);

-- At most one owner row per campaign.
create unique index campaign_members_one_owner_idx on public.campaign_members (campaign_id) where role = 'owner';
create index campaign_members_user_id_idx on public.campaign_members (user_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function private.set_updated_at();

-- archived_at follows status, so clients only ever change status.
create or replace function private.campaigns_sync_archived_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'archived' and (tg_op = 'INSERT' or old.status is distinct from 'archived') then
    new.archived_at := now();
  elsif new.status = 'active' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create trigger campaigns_sync_archived_at
  before insert or update of status on public.campaigns
  for each row execute function private.campaigns_sync_archived_at();

-- The owner becomes an active 'owner' member. SECURITY DEFINER because clients
-- are not allowed to insert owner rows themselves.
create or replace function private.campaigns_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'owner', 'active', now());
  return new;
end;
$$;

revoke all on function private.campaigns_add_owner_member() from public;

create trigger campaigns_add_owner_member
  after insert on public.campaigns
  for each row execute function private.campaigns_add_owner_member();

-- joined_at is set when an invitation is accepted.
create or replace function private.campaign_members_set_joined_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

create trigger campaign_members_set_joined_at
  before update of status on public.campaign_members
  for each row execute function private.campaign_members_set_joined_at();

-- -----------------------------------------------------------------------------
-- Helper functions for policies
-- SECURITY DEFINER so the policies on the two tables don't recursively apply
-- each other's RLS. They only answer yes/no about the *calling* user.
-- -----------------------------------------------------------------------------
create or replace function private.is_campaign_owner(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = target_campaign and c.owner_id = (select auth.uid())
  );
$$;

-- Active members (including the owner) can see the campaign and its roster.
create or replace function private.is_active_campaign_member(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = target_campaign and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

-- Invited users may see the campaign they were invited to (so they can decide to accept).
create or replace function private.is_invited_to_campaign(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    where m.campaign_id = target_campaign and m.user_id = (select auth.uid()) and m.status = 'invited'
  );
$$;

revoke all on function private.is_campaign_owner(uuid) from public;
revoke all on function private.is_active_campaign_member(uuid) from public;
revoke all on function private.is_invited_to_campaign(uuid) from public;
grant execute on function private.is_campaign_owner(uuid) to authenticated;
grant execute on function private.is_active_campaign_member(uuid) to authenticated;
grant execute on function private.is_invited_to_campaign(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges (column level): owner_id, archived_at and timestamps are never
-- client-writable; members can only change their own invitation status.
-- -----------------------------------------------------------------------------
revoke all on public.campaigns from anon, authenticated;
grant select, delete on public.campaigns to authenticated;
grant insert (owner_id, name, description, image_url, game_system, content_source, starting_level, required_players, visibility)
  on public.campaigns to authenticated;
grant update (name, description, image_url, status, content_source, starting_level, required_players, visibility)
  on public.campaigns to authenticated;

revoke all on public.campaign_members from anon, authenticated;
grant select, delete on public.campaign_members to authenticated;
grant insert (campaign_id, user_id) on public.campaign_members to authenticated;
grant update (status) on public.campaign_members to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: campaigns
-- -----------------------------------------------------------------------------
alter table public.campaigns enable row level security;

create policy "Campaigns: owners and members can read"
  on public.campaigns for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (select private.is_active_campaign_member(id))
    or (select private.is_invited_to_campaign(id))
  );

create policy "Campaigns: users create campaigns they own"
  on public.campaigns for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and status = 'active');

create policy "Campaigns: owners update"
  on public.campaigns for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Campaigns: owners delete"
  on public.campaigns for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Row Level Security: campaign members
-- -----------------------------------------------------------------------------
alter table public.campaign_members enable row level security;

create policy "Members: read own membership, roster of own or joined campaigns"
  on public.campaign_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_campaign_owner(campaign_id))
    or (select private.is_active_campaign_member(campaign_id))
  );

-- Only the owner may invite, only as a player, never themselves.
-- (role and status can't even be supplied by clients: see column privileges.)
create policy "Members: owners invite players"
  on public.campaign_members for insert
  to authenticated
  with check (
    (select private.is_campaign_owner(campaign_id))
    and user_id <> (select auth.uid())
    and role = 'player'
    and status = 'invited'
  );

-- An invited user may accept their own invitation, and nothing else.
create policy "Members: invitees accept their invitation"
  on public.campaign_members for update
  to authenticated
  using (user_id = (select auth.uid()) and role = 'player' and status = 'invited')
  with check (user_id = (select auth.uid()) and role = 'player' and status = 'active');

-- Owners remove players; players leave (or decline). The owner row can't be deleted
-- this way; it goes away only when the campaign itself is deleted.
create policy "Members: owners remove players, players leave"
  on public.campaign_members for delete
  to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or (select private.is_campaign_owner(campaign_id))
    )
  );
