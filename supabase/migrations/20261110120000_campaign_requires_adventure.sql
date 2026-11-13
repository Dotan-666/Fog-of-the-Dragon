-- =============================================================================
-- Fog of the Dragon — every campaign runs an adventure
--
-- Needs 20261109120000_adventures.sql. From now on:
--   * a new campaign must name one of its DM's own adventures (campaigns.adventure_id);
--   * the DM can switch to another of their adventures, but cannot clear the link;
--   * start_campaign() refuses to start a campaign without an adventure.
-- Deleting an adventure still empties the link of campaigns that used it (on delete set null), so deleting is never
-- blocked; such a campaign shows "choose an adventure" and cannot be started until the DM picks one.
-- Campaigns created before this migration keep working; they need an adventure only to be started.
-- =============================================================================

create or replace function private.campaigns_check_adventure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.adventure_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Choose the adventure this campaign runs.' using errcode = '23502';
    end if;
    -- pg_trigger_depth() > 1 means this update comes from the foreign key (the adventure was deleted): allowed.
    if old.adventure_id is not null and pg_trigger_depth() < 2 then
      raise exception 'A campaign needs an adventure. Choose another adventure instead of removing it.' using errcode = '23502';
    end if;
    return new;
  end if;
  if not exists (select 1 from public.adventures a where a.id = new.adventure_id and a.owner_id = new.owner_id) then
    raise exception 'You can only link one of your own adventures.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.campaigns_check_adventure() from public, anon, authenticated;

-- Fix: in 20261109120000_adventures.sql a content object without "schema" passed the shape check, because the
-- comparison was NULL (and CHECK accepts NULL). The app always writes schema 1, so existing rows pass.
alter table public.adventures drop constraint adventures_content_shape;
alter table public.adventures add constraint adventures_content_shape check (
  jsonb_typeof(content) = 'object'
  and jsonb_typeof(content -> 'chapters') = 'array'
  and coalesce(content ->> 'schema', '') = '1'
);

-- Same as 20261106120000_campaign_play.sql, plus the adventure check.
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
end;
$$;
