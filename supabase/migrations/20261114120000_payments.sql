-- =============================================================================
-- Fog of the Dragon — payments (Lemon Squeezy), server side
--
-- The payment provider tells us what happened through a signed webhook (Edge Function payments-webhook). That function
-- is the ONLY writer of subscriptions and purchases, and it writes through the two functions below, which only the
-- service role may call. Browsers can't call them, so a button click can never create a plan or an entitlement.
--
--   apply_provider_plan()  one row per user in account_plans; events can arrive late or twice, so an older event
--                          never overwrites a newer one (provider_updated_at)
--   apply_provider_book()  a campaign-wide book purchase in campaign_entitlements; idempotent per provider order;
--                          unlocking is recorded in the campaign history and every member is told
--   private.user_plan()    now honours the paid period of a cancelled / past-due subscription
-- =============================================================================
-- Safe to run again: every object is created only if missing (tables, indexes), recreated in place (functions, policies,
-- triggers) or added only once (Realtime publication). Running it a second time keeps all data. This fixes the
-- "… already exists" error when the file was run more than once (for example pasted again in the SQL Editor, or applied
-- by `supabase db push` after it had been run by hand).

alter table public.account_plans
  add column if not exists customer_id         text,
  add column if not exists portal_url          text check (portal_url is null or portal_url ~ '^https://'),
  add column if not exists provider_updated_at timestamptz;

-- One provider order = one purchase row (the webhook may be delivered more than once).
create unique index if not exists campaign_entitlements_provider_order
  on public.campaign_entitlements (provider, provider_ref) where provider is not null and provider_ref is not null;

-- A subscription gives its plan while it is active, and until the end of the paid period when it was cancelled,
-- expired later or is being retried after a failed payment.
create or replace function private.user_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.plan_id from public.account_plans a
     where a.user_id = uid
       and ((a.status = 'active' and (a.current_period_end is null or a.current_period_end > now()))
         or (a.status in ('canceled', 'past_due') and a.current_period_end > now()))
  ), 'warlord');
$$;

-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------
create or replace function public.apply_provider_plan(
  p_user uuid, p_plan text, p_status text, p_period_end timestamptz, p_provider_ref text,
  p_customer text, p_portal_url text, p_updated_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur timestamptz;
begin
  if p_plan not in ('warlord', 'dungeon-master', 'fogger-of-the-dragons') or p_status not in ('active', 'canceled', 'past_due') then
    raise exception 'Unknown plan or status.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    return 'unknown_user';
  end if;
  select a.provider_updated_at into cur from public.account_plans a where a.user_id = p_user;
  if found and cur is not null and p_updated_at is not null and p_updated_at < cur then
    return 'stale';
  end if;
  insert into public.account_plans (user_id, plan_id, status, current_period_end, provider, provider_ref, customer_id, portal_url, provider_updated_at)
  values (p_user, p_plan, p_status, p_period_end, 'lemonsqueezy', p_provider_ref, p_customer, p_portal_url, p_updated_at)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id, status = excluded.status, current_period_end = excluded.current_period_end,
        provider = excluded.provider, provider_ref = excluded.provider_ref, customer_id = excluded.customer_id,
        portal_url = coalesce(excluded.portal_url, public.account_plans.portal_url),
        provider_updated_at = excluded.provider_updated_at, updated_at = now();
  return 'applied';
end;
$$;

-- -----------------------------------------------------------------------------
-- Campaign book purchases (one purchase unlocks the book for every member)
-- -----------------------------------------------------------------------------
create or replace function public.apply_provider_book(
  p_campaign uuid, p_user uuid, p_status text, p_provider_ref text, p_amount integer, p_currency text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns%rowtype;
  existing public.campaign_entitlements%rowtype;
  buyer text;
begin
  if p_status not in ('pending', 'paid', 'refunded', 'failed') or coalesce(p_provider_ref, '') = '' then
    raise exception 'Unknown status or missing order reference.' using errcode = '22023';
  end if;
  select * into c from public.campaigns where id = p_campaign;
  if not found then
    return 'unknown_campaign';
  end if;
  select * into existing from public.campaign_entitlements e where e.provider = 'lemonsqueezy' and e.provider_ref = p_provider_ref;
  if found then
    if existing.status = p_status then
      return 'unchanged';
    end if;
    update public.campaign_entitlements set status = p_status where id = existing.id;
    return 'updated';
  end if;
  -- A second paid copy for the same campaign (two members buying at once) is kept as a record but flagged for a refund.
  if p_status = 'paid' and exists (select 1 from public.campaign_entitlements e where e.campaign_id = p_campaign and e.product = 'campaign_book_digital' and e.status = 'paid') then
    insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency)
    values (p_campaign, 'campaign_book_digital', p_user, 'pending', 'lemonsqueezy', p_provider_ref, p_amount, lower(p_currency));
    return 'duplicate_needs_refund';
  end if;
  insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency)
  values (p_campaign, 'campaign_book_digital', p_user, p_status, 'lemonsqueezy', p_provider_ref, p_amount, lower(p_currency));
  if p_status = 'paid' then
    select coalesce(p.display_name, 'A member') into buyer from public.profiles p where p.id = p_user;
    perform private.log_campaign(p_campaign, p_user, 'book_unlocked', coalesce(buyer, 'A member') || ' bought the campaign book for everyone in the campaign.');
    perform private.notify_campaign(p_campaign, 'book', 'The campaign book is unlocked', coalesce(buyer, 'A member') || ' bought it for the whole campaign. Everyone can read it in the Logbook.', 'logbook/book');
  end if;
  return 'applied';
end;
$$;

revoke all on function public.apply_provider_plan(uuid, text, text, timestamptz, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_provider_book(uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_provider_plan(uuid, text, text, timestamptz, text, text, text, timestamptz) to service_role;
grant execute on function public.apply_provider_book(uuid, uuid, text, text, integer, text) to service_role;
