-- Fog of the Dragon: a player can take part in at most 3 active campaigns at once.
--
-- "Active" = the player's membership is active and the campaign isn't archived (gathering a party or started).
-- Campaigns you run as the Dungeon Master don't count here; they have their own plan limit.
-- Enforced inside join_campaign, so it can't be bypassed from the browser.

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
  playing int;
  player_limit constant int := 3;
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

  -- One join at a time per user, so two parallel joins can't both pass the limit.
  perform pg_advisory_xact_lock(hashtext('join_campaign:' || me::text));
  select count(*) into playing
  from public.campaign_members m
  join public.campaigns pc on pc.id = m.campaign_id
  where m.user_id = me and m.role = 'player' and m.status = 'active' and pc.status = 'active';
  if playing >= player_limit then
    raise exception 'You are already a player in % active campaigns, the most allowed. Leave one before joining another.', player_limit using errcode = 'P0001';
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

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;
