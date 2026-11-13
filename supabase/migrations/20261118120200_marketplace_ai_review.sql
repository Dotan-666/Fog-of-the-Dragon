-- =============================================================================
-- Fog of the Dragon — Marketplace reviewer: Gemini first opinion, human moderators decide (or Gemini publishes low-risk work)
--
--   marketplace_settings.review_mode
--       'manual'     moderators only; no AI review is requested
--       'ai_assist'  (default) the Edge Function marketplace-review asks Gemini for a verdict on every submitted listing;
--                    moderators see it next to the listing and decide
--       'ai_auto'    as ai_assist, and a listing Gemini approves with LOW risk, whose files and images Gemini could all
--                    inspect and which has no open reports, is published automatically; everything else waits for a human
--     Change it in the SQL Editor:  update public.marketplace_settings set review_mode = 'ai_auto';
--   marketplace_ai_reviews  one verdict per listing (for the version of the listing that was reviewed). Moderators read it;
--                           only the server (service role) writes it. Creators never see the verdict itself.
--   Moderators get a notification whenever a listing enters the review queue.
--   public.ai_publish_listing(id, version)  service role only: publishes when the listing is unchanged since the review.
-- Run after 20261117120000_marketplace.sql. Safe to run again.
-- =============================================================================

do $$
begin
  if to_regclass('public.marketplace_listings') is null then
    raise exception 'Run 20261117120000_marketplace.sql first.';
  end if;
end;
$$;

alter table public.marketplace_settings add column if not exists review_mode text not null default 'ai_assist';
alter table public.marketplace_settings drop constraint if exists marketplace_settings_review_mode;
alter table public.marketplace_settings add constraint marketplace_settings_review_mode check (review_mode in ('manual', 'ai_assist', 'ai_auto'));

create table if not exists public.marketplace_ai_reviews (
  listing_id      uuid primary key references public.marketplace_listings (id) on delete cascade,
  listing_version timestamptz not null,
  decision        text not null check (decision in ('approve', 'reject', 'needs_human')),
  risk            text not null check (risk in ('low', 'medium', 'high')),
  summary         text not null default '' check (char_length(summary) <= 1000),
  reasons         jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array' and jsonb_array_length(reasons) <= 10),
  suggested_note  text not null default '' check (char_length(suggested_note) <= 1000),
  inspected       jsonb not null default '{}'::jsonb check (jsonb_typeof(inspected) = 'object'),
  model           text check (model is null or char_length(model) <= 80),
  auto_published  boolean not null default false,
  requested_by    uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
revoke all on public.marketplace_ai_reviews from anon, authenticated;
grant select on public.marketplace_ai_reviews to authenticated;
alter table public.marketplace_ai_reviews enable row level security;
drop policy if exists "AI reviews: moderators read" on public.marketplace_ai_reviews;
create policy "AI reviews: moderators read" on public.marketplace_ai_reviews for select to authenticated
  using (private.is_moderator((select auth.uid())));
grant execute on function private.is_moderator(uuid) to authenticated;

-- Moderators hear about every listing that enters the queue (submitted, resubmitted, or edited after publishing).
create or replace function private.marketplace_queue_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    for m in select user_id from public.marketplace_moderators where user_id <> new.creator_id loop
      perform private.notify_account(m.user_id, 'marketplace', 'To review: ' || new.title,
        'A listing is waiting for review' || case when new.creator_name <> '' then ' (by ' || new.creator_name || ').' else '.' end,
        'dashboard.html#marketplace/listing/' || new.id::text);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.marketplace_queue_notify() from public, anon, authenticated;
drop trigger if exists marketplace_queue_notify on public.marketplace_listings;
create trigger marketplace_queue_notify after insert or update of status on public.marketplace_listings
  for each row execute function private.marketplace_queue_notify();

-- Automatic publication after a low-risk Gemini approval (review_mode 'ai_auto'). Called by the Edge Function only.
create or replace function public.ai_publish_listing(p_id uuid, p_version timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
  r public.marketplace_ai_reviews%rowtype;
begin
  if coalesce((select review_mode from public.marketplace_settings where id), 'manual') <> 'ai_auto' then return false; end if;
  select * into l from public.marketplace_listings where id = p_id for update;
  if not found or l.status <> 'pending_review' or l.updated_at <> p_version then return false; end if;
  select * into r from public.marketplace_ai_reviews where listing_id = p_id;
  if not found or r.listing_version <> p_version or r.decision <> 'approve' or r.risk <> 'low'
     or coalesce((r.inspected ->> 'complete')::boolean, false) is not true then
    return false;
  end if;
  if exists (select 1 from public.marketplace_reports x where x.listing_id = p_id and x.status = 'open') then return false; end if;
  update public.marketplace_listings set status = 'published', published_at = coalesce(published_at, now()), reviewed_by = null, reviewed_at = now(),
    moderation_note = 'Approved by the automatic review.' where id = p_id;
  update public.marketplace_ai_reviews set auto_published = true where listing_id = p_id;
  perform private.notify_account(l.creator_id, 'marketplace', 'Published: ' || l.title, 'Your listing passed the automatic review and is now in the Community Marketplace.', 'dashboard.html#marketplace/creator');
  return true;
end;
$$;
revoke all on function public.ai_publish_listing(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_publish_listing(uuid, timestamptz) to service_role;

-- The access call also tells the app how listings are reviewed (to word the "submitted" message).
create or replace function public.marketplace_access()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('moderator', private.is_moderator(auth.uid()), 'testOwner', private.is_test_owner(auth.uid()),
    'demoPayments', private.flag('demo_payments'), 'feeBps', (select fee_bps from public.marketplace_settings where id),
    'reviewMode', (select review_mode from public.marketplace_settings where id),
    'plan', private.user_plan(auth.uid()),
    'planProvider', (select a.provider from public.account_plans a where a.user_id = auth.uid()));
$$;
