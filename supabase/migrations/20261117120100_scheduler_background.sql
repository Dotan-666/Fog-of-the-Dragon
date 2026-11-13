-- =============================================================================
-- Fog of the Dragon — scheduler: suggestions, deadlines and BACKGROUND processing
--
-- Extends the availability scheduler (20261113120000 + 20261115120100); no second scheduler.
--   suggestions             when answering ends (everyone answered, or the deadline passed with some answers) the
--                           database ranks the times by how many can attend (then "prefer", "possibly", earliest),
--                           checks the slot is long enough for the meeting, lists who can host there and suggests in
--                           person or online from the members' preferences. The DM is told once, with the best option.
--   deadline                now closes ANSWERS only: confirmations of a proposal can still come in after it.
--   propose_schedule_option the DM proposes a suggestion; for a time not everyone can make, the DM can explicitly
--                           leave named people out of THIS meeting (they are told); everyone left must still confirm.
--   process_schedule_*      reminders (answers due within a day; confirmations pending for a day), deadline handling,
--                           and expiry of stale requests (nobody answered; proposed time already passed; 14 days with
--                           no decision). Idempotent: every notification is guarded by a timestamp, rows are locked.
--   background              private.process_all_schedule_requests() runs every 10 minutes with pg_cron when the
--                           extension is available (checked below, never assumed); otherwise the Edge Function
--                           scheduler-tick can call public.run_schedule_processing() on a schedule (README).
-- Safe to run again.
-- =============================================================================

alter table public.campaign_schedule_requests
  add column if not exists suggestions       jsonb,
  add column if not exists suggested_at      timestamptz,
  add column if not exists answers_closed    boolean not null default false,
  add column if not exists dm_notified_at    timestamptz,
  add column if not exists proposed_at       timestamptz,
  add column if not exists confirm_reminded_at timestamptz,
  add column if not exists excluded_users    uuid[] not null default '{}';

-- Ranked options for the current round (best first, at most 5).
create or replace function private.schedule_suggestions(rid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with r as (select * from public.campaign_schedule_requests where id = rid),
  slots as (
    select e ->> 'id' as id, (e ->> 'start')::timestamptz as starts, (e ->> 'end')::timestamptz as ends
      from r, jsonb_array_elements(r.slots) e
     where not ((e ->> 'id') = any (r.declined_slots)) and (e ->> 'start')::timestamptz > now()
  ),
  ans as (
    select s.id as slot_id, u.u as user_id, x.availability ->> s.id as a, x.suggest_format as fmt
      from slots s cross join r cross join lateral unnest(r.required_users) u(u)
      left join public.campaign_schedule_responses x on x.request_id = r.id and x.round = r.round and x.user_id = u.u
  ),
  scored as (
    select s.id, s.starts, s.ends,
           count(*) filter (where a.a in ('available', 'preferred')) as yes,
           count(*) filter (where a.a = 'preferred') as pref,
           count(*) filter (where a.a = 'maybe') as maybe,
           count(*) as total,
           coalesce(jsonb_agg(a.user_id) filter (where coalesce(a.a, 'none') not in ('available', 'preferred')), '[]'::jsonb) as missing,
           count(*) filter (where a.fmt = 'in_person') as want_in_person,
           count(*) filter (where a.fmt in ('online', 'google_meet')) as want_online
      from slots s join ans a on a.slot_id = s.id group by s.id, s.starts, s.ends
  ),
  hosted as (
    select sc.*, coalesce((select jsonb_agg(h) from unnest(private.schedule_eligible_hosts(rid)) h
                            where exists (select 1 from ans a where a.slot_id = sc.id and a.user_id = h and a.a in ('available', 'preferred'))), '[]'::jsonb) as hosts
      from scored sc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_id', h.id, 'start', h.starts, 'end', h.ends, 'yes', h.yes, 'total', h.total, 'preferred', h.pref, 'maybe', h.maybe,
           'everyone', h.yes = h.total, 'missing', h.missing, 'hosts', h.hosts,
           'fits', (select r.duration_minutes is null or h.ends - h.starts >= make_interval(mins => r.duration_minutes) from r),
           'format', (select case when r.format <> 'either' then r.format
                                  when jsonb_array_length(h.hosts) > 0 and h.want_in_person >= h.want_online then 'in_person'
                                  else 'online' end from r))
         order by (select r.duration_minutes is null or h.ends - h.starts >= make_interval(mins => r.duration_minutes) from r) desc,
                  h.yes desc, h.pref desc, h.maybe desc, h.starts asc), '[]'::jsonb)
    from (select * from hosted order by yes desc, pref desc, maybe desc, starts asc limit 5) h;
$$;
revoke all on function private.schedule_suggestions(uuid) from public, anon, authenticated;

-- Answering is over (everyone answered, or the deadline passed): store the suggestions and tell the DM once.
create or replace function private.schedule_finish_collection(rid uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  sug jsonb;
  best jsonb;
  body text;
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or r.status not in ('waiting', 'consensus') then return; end if;
  sug := private.schedule_suggestions(rid);
  best := sug -> 0;
  update public.campaign_schedule_requests
     set status = 'consensus', suggestions = sug, suggested_at = now(), answers_closed = answers_closed or p_reason = 'deadline'
   where id = rid;
  if r.dm_notified_at is null then
    body := case
      when best is null then 'No offered time is still possible. Start another round with new times.'
      when (best ->> 'everyone')::boolean then 'Best time: ' || to_char((best ->> 'start')::timestamptz, 'Dy DD Mon, HH24:MI') || ' UTC. Everyone can come' || case when best ->> 'format' = 'in_person' then ' (in person possible).' else '.' end
      else 'Closest option: ' || to_char((best ->> 'start')::timestamptz, 'Dy DD Mon, HH24:MI') || ' UTC, ' || (best ->> 'yes') || ' of ' || (best ->> 'total') || ' can come. No time works for everyone.' end;
    perform private.notify_user(r.campaign_id, r.created_by, 'schedule',
      case when p_reason = 'deadline' then 'Answers closed: ' else 'Everyone answered: ' end || r.title, body, 'meetings/' || rid::text);
    update public.campaign_schedule_requests set dm_notified_at = now() where id = rid;
  end if;
  perform private.schedule_try_auto_propose(rid);
end;
$$;
revoke all on function private.schedule_finish_collection(uuid, text) from public, anon, authenticated;

-- Automatic proposal (when switched on): the best UNANIMOUS suggestion that fits, before or after the deadline.
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
    return false; -- no time works for everyone: the DM decides what to do next
  end if;
  hosts := private.schedule_eligible_hosts(rid);
  begin
    if r.format in ('in_person', 'either') and cardinality(hosts) = 1 then
      perform private.schedule_write_proposal(rid, slot, 'in_person', hosts[1], null, null, true);
    elsif r.format in ('online', 'either') and r.default_link is not null then
      perform private.schedule_write_proposal(rid, slot, 'online', null, r.default_link, 'manual', true);
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

-- The shared proposal writer: same rules as before, plus when it was proposed (for confirmation reminders).
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
     set status = 'awaiting_confirmation', proposed_at = now(), confirm_reminded_at = null,
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

-- The DM proposes (also after the deadline: it only closed the answers).
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
    raise exception 'Wait until everyone has answered (or the deadline has passed).' using errcode = 'P0001';
  end if;
  return private.schedule_write_proposal(rid, p_slot, p_format, p_host, p_link, p_link_kind, false);
end;
$$;

-- The DM proposes a time some people can't make, explicitly leaving them out of THIS meeting. They are told; the DM
-- (who created the request) can't be left out; everyone who remains must still confirm.
create or replace function public.propose_schedule_option(rid uuid, p_slot text, p_format text, p_host uuid, p_link text, p_link_kind text, p_without uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.campaign_schedule_requests%rowtype;
  u uuid;
  left_out uuid[] := coalesce(p_without, '{}');
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or not private.is_campaign_owner(r.campaign_id) then
    raise exception 'Only the Dungeon Master can propose the final time.' using errcode = '42501';
  end if;
  if r.status not in ('consensus', 'awaiting_confirmation') then
    raise exception 'Wait until everyone has answered (or the deadline has passed).' using errcode = 'P0001';
  end if;
  if r.created_by = any (left_out) then
    raise exception 'The Dungeon Master can’t be left out of the meeting.' using errcode = 'P0001';
  end if;
  foreach u in array left_out loop
    if not (u = any (r.required_users)) then
      raise exception 'Someone in that list isn’t part of this request.' using errcode = '22023';
    end if;
  end loop;
  -- Proposing a time counts as the DM's own yes for it (the DM may not have answered the poll before the deadline).
  if r.created_by = any (r.required_users) then
    insert into public.campaign_schedule_responses (request_id, round, user_id, availability)
    values (rid, r.round, r.created_by, jsonb_build_object(p_slot, 'available'))
    on conflict (request_id, round, user_id) do update
      set availability = public.campaign_schedule_responses.availability || jsonb_build_object(p_slot,
            case when public.campaign_schedule_responses.availability ->> p_slot = 'preferred' then 'preferred' else 'available' end), updated_at = now();
  end if;
  if cardinality(left_out) > 0 then
    if cardinality(r.required_users) - cardinality(left_out) < 2 then
      raise exception 'At least two people must be left to meet.' using errcode = 'P0001';
    end if;
    update public.campaign_schedule_requests
       set required_users = array(select x from unnest(required_users) x where not (x = any (left_out))),
           excluded_users = array(select distinct x from unnest(excluded_users || left_out) x)
     where id = rid;
    foreach u in array left_out loop
      perform private.notify_user(r.campaign_id, u, 'schedule', 'Not this time: ' || r.title,
        'The DM picked a time you said you can''t make, so you aren''t needed to confirm this meeting. You are still in the campaign.', 'meetings/' || rid::text);
    end loop;
  end if;
  return private.schedule_write_proposal(rid, p_slot, p_format, p_host, p_link, p_link_kind, false);
end;
$$;

-- Answers: as before; when everyone has answered, suggestions are made and the DM is told once.
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
begin
  select * into r from public.campaign_schedule_requests where id = rid for update;
  if not found or me is null or not (me = any (r.required_users)) then
    raise exception 'This request isn''t waiting for your answer.' using errcode = '42501';
  end if;
  if r.status not in ('waiting', 'consensus') or r.answers_closed then
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
  if answered >= cardinality(r.required_users) then
    perform private.schedule_finish_collection(rid, 'all_answered');
    -- someone changed an answer after everyone had answered: refresh the suggestions (no new notification)
    update public.campaign_schedule_requests set suggestions = private.schedule_suggestions(rid), suggested_at = now() where id = rid and status = 'consensus';
  end if;
  return (select status from public.campaign_schedule_requests where id = rid);
end;
$$;

-- Confirmations no longer stop at the answer deadline (it only closes answers). Otherwise unchanged: the meeting is
-- created once, under the row lock, when the last required person confirms the exact proposal.
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

-- A new round also resets suggestions, deadline handling and the people left out.
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
         suggestions = null, suggested_at = null, answers_closed = false, dm_notified_at = null, proposed_at = null,
         confirm_reminded_at = null, excluded_users = '{}',
         slots = case when p_slots is null then slots else private.schedule_clean_slots(p_slots) end
   where id = rid;
  perform private.open_schedule(rid);
end;
$$;

-- One campaign's scheduled work (no permission check: callers check). Idempotent.
create or replace function private.process_schedule_campaign(target_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  u uuid;
  reminded integer := 0;
  confirm_reminded integer := 0;
  closed integer := 0;
  expired integer := 0;
  stale integer := 0;
begin
  -- 1. Deadline reached: with answers, move on to suggestions (the DM is told); with none, expire.
  for r in
    select * from public.campaign_schedule_requests
     where campaign_id = target_campaign and status in ('waiting', 'consensus') and not answers_closed
       and responses_due is not null and responses_due < now()
     for update skip locked
  loop
    if exists (select 1 from public.campaign_schedule_responses x where x.request_id = r.id and x.round = r.round and x.user_id = any (r.required_users)) then
      perform private.schedule_finish_collection(r.id, 'deadline');
      closed := closed + 1;
    else
      update public.campaign_schedule_requests set status = 'expired' where id = r.id;
      perform private.notify_user(target_campaign, r.created_by, 'schedule', 'No answers: ' || r.title, 'Nobody answered before the deadline, so the request expired. You can ask again.', 'meetings/' || r.id::text);
      expired := expired + 1;
    end if;
  end loop;
  -- 2. Proposed time already passed before everyone confirmed: expire, tell the DM.
  for r in
    select q.* from public.campaign_schedule_requests q, jsonb_array_elements(q.slots) e
     where q.campaign_id = target_campaign and q.status = 'awaiting_confirmation' and e ->> 'id' = q.proposal ->> 'slot_id' and (e ->> 'start')::timestamptz <= now()
     for update of q skip locked
  loop
    update public.campaign_schedule_requests set status = 'expired' where id = r.id;
    perform private.notify_user(target_campaign, r.created_by, 'schedule', 'Not confirmed in time: ' || r.title, 'The proposed time passed before everyone confirmed. No meeting was created; ask again or start another round.', 'meetings/' || r.id::text);
    expired := expired + 1;
  end loop;
  -- 3. Stale: suggestions made 14+ days ago and no proposal since.
  update public.campaign_schedule_requests set status = 'expired'
   where campaign_id = target_campaign and status = 'consensus' and suggested_at is not null and suggested_at < now() - interval '14 days';
  get diagnostics stale = row_count;
  expired := expired + stale;
  -- 4. Reminders: answers due within a day (once per round); confirmations pending for a day (once per proposal).
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
  for r in
    select * from public.campaign_schedule_requests
     where campaign_id = target_campaign and status = 'awaiting_confirmation' and confirm_reminded_at is null
       and proposed_at is not null and proposed_at < now() - interval '1 day'
     for update skip locked
  loop
    foreach u in array r.required_users loop
      if not exists (select 1 from public.campaign_schedule_confirmations c where c.request_id = r.id and c.round = r.round and c.user_id = u and c.proposal_version = (r.proposal ->> 'version')::int) then
        perform private.notify_user(target_campaign, u, 'schedule', 'Please confirm: ' || r.title, 'The party is waiting for your confirmation of the proposed time.', 'meetings/' || r.id::text);
      end if;
    end loop;
    update public.campaign_schedule_requests set confirm_reminded_at = now() where id = r.id;
    confirm_reminded := confirm_reminded + 1;
  end loop;
  return jsonb_build_object('closed', closed, 'expired', expired, 'reminded', reminded, 'confirmReminded', confirm_reminded);
end;
$$;
revoke all on function private.process_schedule_campaign(uuid) from public, anon, authenticated;

-- Members' browsers may still call this (harmless and idempotent), but they are no longer needed for it to happen.
create or replace function public.process_schedule_requests(target_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_campaign_owner(target_campaign) or private.is_active_campaign_member(target_campaign)) then
    return jsonb_build_object('closed', 0, 'expired', 0, 'reminded', 0, 'confirmReminded', 0);
  end if;
  return private.process_schedule_campaign(target_campaign);
end;
$$;

-- Every campaign with live requests: what the background job runs.
create or replace function private.process_all_schedule_requests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c uuid;
  res jsonb;
  tot jsonb := jsonb_build_object('campaigns', 0, 'closed', 0, 'expired', 0, 'reminded', 0, 'confirmReminded', 0);
begin
  for c in select distinct campaign_id from public.campaign_schedule_requests where status in ('waiting', 'consensus', 'awaiting_confirmation') loop
    res := private.process_schedule_campaign(c);
    tot := jsonb_build_object('campaigns', (tot ->> 'campaigns')::int + 1,
      'closed', (tot ->> 'closed')::int + (res ->> 'closed')::int, 'expired', (tot ->> 'expired')::int + (res ->> 'expired')::int,
      'reminded', (tot ->> 'reminded')::int + (res ->> 'reminded')::int, 'confirmReminded', (tot ->> 'confirmReminded')::int + (res ->> 'confirmReminded')::int);
  end loop;
  return tot;
end;
$$;
revoke all on function private.process_all_schedule_requests() from public, anon, authenticated;

-- For the Edge Function scheduler-tick (service role only), when pg_cron isn't available.
create or replace function public.run_schedule_processing()
returns jsonb language sql security definer set search_path = ''
as $$ select private.process_all_schedule_requests(); $$;
revoke all on function public.run_schedule_processing() from public, anon, authenticated;
grant execute on function public.run_schedule_processing() to service_role;

revoke all on function public.propose_schedule_option(uuid, text, text, uuid, text, text, uuid[]) from public, anon;
grant execute on function public.propose_schedule_option(uuid, text, text, uuid, text, text, uuid[]) to authenticated;

-- Background job: only if the pg_cron extension is available on this database (Supabase: Database → Extensions).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      -- cron.schedule(name, …) replaces a job with the same name, so running this file again keeps one job.
      perform cron.schedule('fod-schedule-processing', '*/10 * * * *', 'select private.process_all_schedule_requests()');
      raise notice 'Scheduler background job: pg_cron job "fod-schedule-processing" runs every 10 minutes.';
    exception when others then
      raise notice 'pg_cron is available but the job could not be scheduled (%). Enable pg_cron in Database → Extensions and run this file again, or deploy the scheduler-tick Edge Function.', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available here: deploy the scheduler-tick Edge Function and call it on a schedule (see README).';
  end if;
end;
$$;
