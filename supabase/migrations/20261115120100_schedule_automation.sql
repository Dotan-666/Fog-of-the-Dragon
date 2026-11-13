-- =============================================================================
-- Fog of the Dragon — automatic Scheduler
--
-- Takes the repetitive steps off the DM while keeping every decision with people:
--   * auto_propose   when every answer is in and at least one time works for everyone, the best time is proposed by
--                    itself (most "prefer", then earliest), with the host or link that the DM preset. It is only a
--                    PROPOSAL: everyone still confirms it, and the DM can change or cancel it at any time.
--   * declined times are remembered, so after "I can't make it" the next best time is proposed instead of the same one
--   * reminders      people who haven't answered are reminded once when the deadline is less than a day away
--   * deadlines      requests past their deadline become "expired" (as before)
-- process_schedule_requests() does the reminders and the expiry; any member's browser calls it when it opens Meetings
-- (there is no server-side scheduler in this project), and running it twice changes nothing.
-- Safe to run again.
-- =============================================================================

alter table public.campaign_schedule_requests
  add column if not exists auto_propose boolean not null default false,
  add column if not exists default_link text,
  add column if not exists declined_slots text[] not null default '{}',
  add column if not exists reminded_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaign_schedule_requests_default_link_https') then
    alter table public.campaign_schedule_requests
      add constraint campaign_schedule_requests_default_link_https check (default_link is null or default_link ~ '^https://[^\s]{4,180}$');
  end if;
end;
$$;

-- Best time that works for everyone and wasn't declined: most "prefer" answers first, then the earliest.
create or replace function private.schedule_best_slot(rid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e ->> 'id'
    from public.campaign_schedule_requests r, jsonb_array_elements(r.slots) e
   where r.id = rid
     and not ((e ->> 'id') = any (r.declined_slots))
     and private.schedule_unanimous(rid, e ->> 'id')
   order by (select count(*) from public.campaign_schedule_responses x
              where x.request_id = r.id and x.round = r.round and x.availability ->> (e ->> 'id') = 'preferred') desc,
            (e ->> 'start')::timestamptz asc
   limit 1;
$$;
revoke all on function private.schedule_best_slot(uuid) from public, anon, authenticated;

-- People who can host in person AND agreed to share their location.
create or replace function private.schedule_eligible_hosts(rid uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.user_id), '{}')
    from public.campaign_schedule_requests r
    join public.campaign_schedule_responses x on x.request_id = r.id and x.round = r.round
    join public.campaign_schedule_hosts h on h.request_id = x.request_id and h.round = x.round and h.user_id = x.user_id
   where r.id = rid and x.can_host and h.share_with_party and btrim(h.location) <> '' and x.user_id = any (r.required_users);
$$;
revoke all on function private.schedule_eligible_hosts(uuid) from public, anon, authenticated;

-- Writes a proposal (shared by the DM's propose_schedule and the automatic one). Raises when it isn't allowed.
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
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
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
    if p_host is null or not (p_host = any (private.schedule_eligible_hosts(rid))) then
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
         proposal = jsonb_build_object('version', version, 'slot_id', p_slot, 'format', p_format, 'host_id', p_host, 'link', nullif(link, ''),
                                       'link_kind', case when p_format = 'online' then p_link_kind end, 'auto', coalesce(p_auto, false))
   where id = rid;
  perform private.notify_campaign(r.campaign_id, 'schedule',
    case when p_auto then 'Everyone agrees: please confirm ' || r.title else 'Please confirm: ' || r.title end,
    case when p_auto then 'A time that works for everyone was proposed automatically. Check it and confirm.' else 'The DM proposed a final time. Check it and confirm.' end,
    'meetings/' || rid::text, case when p_auto then null else auth.uid() end);
  return version;
end;
$$;
revoke all on function private.schedule_write_proposal(uuid, text, text, uuid, text, text, boolean) from public, anon, authenticated;

-- The automatic step: only when switched on, everyone has answered, and the format can be settled without guessing.
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
  if not found or not r.auto_propose or r.status <> 'consensus' or (r.responses_due is not null and r.responses_due < now()) then
    return false;
  end if;
  slot := private.schedule_best_slot(rid);
  if slot is null then
    return false; -- no time works for everyone: the DM decides what to do next
  end if;
  hosts := private.schedule_eligible_hosts(rid);
  begin
    if r.format in ('in_person', 'either') and cardinality(hosts) = 1 then
      perform private.schedule_write_proposal(rid, slot, 'in_person', hosts[1], null, null, true);
    elsif r.format in ('online', 'either') and r.default_link is not null then
      perform private.schedule_write_proposal(rid, slot, 'online', null, r.default_link, 'manual', true);
    else
      return false; -- several possible hosts, or no link: the DM chooses
    end if;
  exception when others then
    return false;
  end;
  return true;
end;
$$;
revoke all on function private.schedule_try_auto_propose(uuid) from public, anon, authenticated;

-- The DM's own proposal (same rules as before, now through the shared writer).
create or replace function public.propose_schedule(rid uuid, p_slot text, p_format text, p_host uuid, p_link text, p_link_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
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
  return private.schedule_write_proposal(rid, p_slot, p_format, p_host, p_link, p_link_kind, false);
end;
$$;

-- The DM turns automation on or off and presets the online link (before or while answers come in).
create or replace function public.set_schedule_automation(rid uuid, p_auto boolean, p_link text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  link text := nullif(btrim(coalesce(p_link, '')), '');
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can do that.' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'waiting', 'consensus') then
    raise exception 'Automation can only be changed before a time is proposed.' using errcode = 'P0001';
  end if;
  if link is not null and link !~ '^https://[^\s]{4,180}$' then
    raise exception 'The meeting link must start with https://.' using errcode = '22023';
  end if;
  update public.campaign_schedule_requests set auto_propose = coalesce(p_auto, false), default_link = link where id = rid;
  if r.status = 'consensus' then
    perform private.schedule_try_auto_propose(rid);
  end if;
end;
$$;

-- Answers: as before, plus the automatic proposal once everyone has answered.
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
  end if;
  if new_status = 'consensus' then
    if private.schedule_try_auto_propose(rid) then
      return 'awaiting_confirmation';
    end if;
    if r.status <> 'consensus' then
      perform private.notify_user(r.campaign_id, r.created_by, 'schedule', 'Everyone answered: ' || r.title, 'See which times work for the whole party.', 'meetings/' || rid::text);
    end if;
  end if;
  return new_status;
end;
$$;

-- "I can't make it": the declined time is remembered and the next best one is proposed automatically (when switched on).
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
  update public.campaign_schedule_requests
     set status = 'consensus', proposal = null,
         declined_slots = case when r.proposal ->> 'slot_id' is null then declined_slots else array_append(declined_slots, r.proposal ->> 'slot_id') end
   where id = rid;
  perform private.notify_user(r.campaign_id, r.created_by, 'schedule', 'A time was declined: ' || r.title, 'Someone can''t make the proposed time.', 'meetings/' || rid::text);
  perform private.schedule_try_auto_propose(rid);
end;
$$;

-- A new round also forgets the declined times.
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
     set round = round + 1, proposal = null, responses_due = p_due, declined_slots = '{}', reminded_at = null,
         slots = case when p_slots is null then slots else private.schedule_clean_slots(p_slots) end
   where id = rid;
  perform private.open_schedule(rid);
end;
$$;

-- Reminders and expiry, for the members' browsers to call. Idempotent.
create or replace function public.process_schedule_requests(target_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer;
  reminded integer := 0;
  r record;
  u uuid;
begin
  if not (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign)) then
    return jsonb_build_object('expired', 0, 'reminded', 0);
  end if;
  update public.campaign_schedule_requests
     set status = 'expired'
   where campaign_id = target_campaign and status in ('waiting', 'consensus', 'awaiting_confirmation') and responses_due is not null and responses_due < now();
  get diagnostics expired = row_count;
  for r in
    select * from public.campaign_schedule_requests
     where campaign_id = target_campaign and status = 'waiting' and reminded_at is null
       and responses_due is not null and responses_due > now() and responses_due < now() + interval '1 day'
     for update skip locked
  loop
    foreach u in array r.required_users loop
      if not exists (select 1 from public.campaign_schedule_responses x where x.request_id = r.id and x.round = r.round and x.user_id = u) then
        perform private.notify_user(target_campaign, u, 'schedule', 'Reminder: when can you play? ' || r.title, 'Answers close soon. Tell the party when you are free.', 'meetings/' || r.id::text);
      end if;
    end loop;
    update public.campaign_schedule_requests set reminded_at = now() where id = r.id;
    reminded := reminded + 1;
  end loop;
  return jsonb_build_object('expired', expired, 'reminded', reminded);
end;
$$;

revoke all on function public.set_schedule_automation(uuid, boolean, text) from public, anon;
revoke all on function public.process_schedule_requests(uuid) from public, anon;
grant execute on function public.set_schedule_automation(uuid, boolean, text) to authenticated;
grant execute on function public.process_schedule_requests(uuid) to authenticated;
