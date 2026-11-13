-- =============================================================================
-- Fog of the Dragon — Marketplace (official store + community content), orders, library, demo payments, test tiers
--
-- ONE purchase system. Orders, order items, the buyer's library, account_plans and campaign_entitlements are the real
-- records; only the PAYMENT step is simulated for now (pay_order_demo), and only while the owner has switched
-- app_flags 'demo_payments' on. A real provider later replaces that one step (its webhook marks the order paid and calls
-- the same private.fulfil_order). Card numbers never reach the server: the browser sends only "success" or "decline".
--
--   marketplace_moderators      who may approve / reject / remove listings (filled only by the owner: SQL Editor)
--   dev_test_owners             who may switch their own plan for testing (filled only by the owner)
--   marketplace_settings        FOD's fee on paid community sales (basis points, 5–10%)
--   marketplace_store_products  the official FOD store (demo merchandise; no print-on-demand, nothing is shipped)
--   marketplace_listings        community listings: Draft → Pending Review → Published / Rejected; Removed
--   marketplace_reports         report-content; 3 open reports send a listing back to review
--   marketplace_orders / _items orders with prices decided by the server
--   marketplace_library         what a user may download (bought, claimed for free, or their own)
--   storage bucket 'marketplace' private; <creator>/<listing>/media/* (previews) and <creator>/<listing>/files/* (content)
-- Safe to run again.
-- =============================================================================

-- What this file builds on (earlier migrations). Stops with a clear message instead of a confusing error halfway.
do $$
begin
  if to_regclass('public.account_plans') is null or to_regclass('public.campaign_entitlements') is null or to_regclass('public.campaign_notifications') is null then
    raise exception 'Run 20261113120000_campaign_refinements.sql first (then the later migrations in filename order).';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_plans' and column_name = 'provider_updated_at') then
    raise exception 'Run 20261114120000_payments.sql first (then the later migrations in filename order).';
  end if;
end;
$$;

-- Account-level notifications (marketplace) reuse the notifications table; they have no campaign.
alter table public.campaign_notifications alter column campaign_id drop not null;
create or replace function private.notify_account(who uuid, p_kind text, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.campaign_notifications (user_id, campaign_id, kind, title, body, link)
  values (who, null, p_kind, left(p_title, 200), left(coalesce(p_body, ''), 500), left(p_link, 300));
$$;
revoke all on function private.notify_account(uuid, text, text, text, text) from public, anon, authenticated;

-- Switches per feature (also created by 20261116120000_foggy.sql; created here too so this file doesn't depend on it).
create table if not exists public.app_flags (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  enabled    boolean not null default false,
  note       text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);
revoke all on public.app_flags from anon, authenticated;
grant select on public.app_flags to anon, authenticated;
alter table public.app_flags enable row level security;
drop policy if exists "App flags: anyone can read" on public.app_flags;
create policy "App flags: anyone can read" on public.app_flags for select to anon, authenticated using (true);

insert into public.app_flags (key, enabled, note)
values ('demo_payments', false, 'Simulated card payments at checkout (no money moves). Turn off before real payments go live.')
on conflict (key) do nothing;

create table if not exists public.marketplace_moderators (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
create table if not exists public.dev_test_owners (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on public.marketplace_moderators, public.dev_test_owners from anon, authenticated;
alter table public.marketplace_moderators enable row level security;
alter table public.dev_test_owners enable row level security;

create or replace function private.is_moderator(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.marketplace_moderators m where m.user_id = uid); $$;
create or replace function private.is_test_owner(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.dev_test_owners t where t.user_id = uid); $$;
create or replace function private.flag(p_key text)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select f.enabled from public.app_flags f where f.key = p_key), false); $$;
revoke all on function private.is_moderator(uuid), private.is_test_owner(uuid), private.flag(text) from public, anon, authenticated;
grant execute on function private.is_moderator(uuid) to authenticated; -- used by row-level policies (answers only yes/no)
create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = ''
as $$ begin return p::uuid; exception when others then return null; end; $$;
grant execute on function private.try_uuid(text) to authenticated;

create table if not exists public.marketplace_settings (
  id         boolean primary key default true check (id),
  fee_bps    integer not null default 1000 check (fee_bps between 500 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.marketplace_settings (id) values (true) on conflict (id) do nothing;
revoke all on public.marketplace_settings from anon, authenticated;
grant select on public.marketplace_settings to authenticated;
alter table public.marketplace_settings enable row level security;
drop policy if exists "Marketplace settings: read" on public.marketplace_settings;
create policy "Marketplace settings: read" on public.marketplace_settings for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Official store (demo merchandise)
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_store_products (
  sku         text primary key check (sku ~ '^[a-z0-9-]{3,40}$'),
  category    text not null check (category in ('dice', 'accessories', 'clothing', 'everyday')),
  name        text not null,
  summary     text not null,
  details     jsonb not null default '{}'::jsonb,
  art         text not null,
  price_cents integer not null check (price_cents between 100 and 50000),
  sort        integer not null default 0,
  active      boolean not null default true
);
revoke all on public.marketplace_store_products from anon, authenticated;
grant select on public.marketplace_store_products to authenticated;
alter table public.marketplace_store_products enable row level security;
drop policy if exists "Store: read active" on public.marketplace_store_products;
create policy "Store: read active" on public.marketplace_store_products for select to authenticated using (active);

insert into public.marketplace_store_products (sku, category, name, summary, details, art, price_cents, sort) values
  ('d20-nat1-resin', 'dice', 'The Betrayer D20', 'A single translucent crimson D20. We regret to inform you it remembers every natural 1.', '{"material":"Resin","size":"22 mm","options":["Crimson","Smoke"]}', 'd20', 1299, 10),
  ('dice-set-dragonfire', 'dice', 'Dragonfire Dice Set', 'Seven polyhedral dice with molten-ember swirls. Results not guaranteed, drama guaranteed.', '{"material":"Resin","pieces":7,"includes":"d4, d6, d8, d10, d%, d12, d20"}', 'dice-set', 2499, 20),
  ('dice-set-mimic', 'dice', 'Mimic Dice Set', 'Seven dice in a tiny treasure chest that might be hungry.', '{"material":"Resin + metal box","pieces":7}', 'chest', 3499, 30),
  ('dice-bag-hoard', 'accessories', 'Dragon''s Hoard Dice Bag', 'Drawstring velvet bag that holds 60+ dice and one bad decision.', '{"material":"Velvet, satin lining","capacity":"60+ dice"}', 'bag', 1899, 40),
  ('dice-tower-keep', 'accessories', 'The Keep Dice Tower', 'Fold-flat wooden tower. Dice go in, fate comes out.', '{"material":"Birch plywood","height":"24 cm","flatpack":true}', 'tower', 4499, 50),
  ('dice-tray-fog', 'accessories', 'Fog Rolling Tray', 'Hexagonal tray with a soft leatherette floor. Contains the chaos.', '{"material":"Leatherette, wood frame","width":"25 cm"}', 'tray', 2999, 60),
  ('dm-screen-fog', 'accessories', 'DM Screen: Behind the Fog', 'Four-panel screen with SRD 5.2.1 reference tables on your side and a dragon on theirs.', '{"panels":4,"content":"SRD 5.2.1 tables (CC-BY-4.0)"}', 'screen', 3999, 70),
  ('mini-bases-pack', 'accessories', 'Miniature Bases & Rings', 'Fifty bases and colored condition rings, so everyone knows who is Prone.', '{"pieces":50,"sizes":"25 mm, 50 mm"}', 'rings', 1499, 80),
  ('campaign-notebook', 'accessories', 'Campaign Notebook', 'Dotted A5 notebook with session log pages and an NPC index.', '{"pages":192,"size":"A5"}', 'notebook', 2199, 90),
  ('tee-nat1-club', 'clothing', 'T-Shirt: Nat 1 Club', '"Founding member. Lifetime dues: my dignity."', '{"material":"100% cotton","sizes":["S","M","L","XL","XXL"]}', 'tee:NAT 1 CLUB', 2799, 100),
  ('tee-mimic', 'clothing', 'T-Shirt: It Was A Mimic', 'For the rogue who opened the chest anyway.', '{"material":"100% cotton","sizes":["S","M","L","XL","XXL"]}', 'tee:IT WAS A MIMIC', 2799, 110),
  ('tee-trust-dm', 'clothing', 'T-Shirt: Trust the Dungeon Master', '"Roll for initiative" — a sentence that never ended well.', '{"material":"100% cotton","sizes":["S","M","L","XL","XXL"]}', 'tee:TRUST THE DM', 2799, 120),
  ('hoodie-fog', 'clothing', 'Hoodie: Lost in the Fog', 'Heavy hoodie with the FOD dragon on the back. +2 to Constitution saves against cold tables.', '{"material":"Cotton blend","sizes":["S","M","L","XL","XXL"]}', 'hoodie', 5499, 130),
  ('cap-crit', 'clothing', 'Cap: Critical Hit', 'Embroidered D20 showing a 20. Wear it when you need the luck.', '{"material":"Cotton twill","fit":"Adjustable"}', 'cap', 2499, 140),
  ('beanie-dragon', 'clothing', 'Beanie: Sleeping Dragon', '"Let sleeping dragons lie. Especially on session day."', '{"material":"Acrylic knit","fit":"One size"}', 'beanie', 2199, 150),
  ('mug-tavern', 'everyday', 'Mug: The Prancing Tavern Keeper', '"I cast Coffee. It is super effective." 350 ml ceramic.', '{"material":"Ceramic","volume":"350 ml","dishwasher":true}', 'mug:I CAST COFFEE', 1699, 160),
  ('mug-dm-tears', 'everyday', 'Mug: Player Tears', 'For the Dungeon Master who planned a 4-hour dungeon and watched the party befriend the boss.', '{"material":"Ceramic","volume":"350 ml"}', 'mug:PLAYER TEARS', 1699, 170),
  ('cup-travel-nat20', 'everyday', 'Travel Cup: Nat 20 Morning', 'Insulated cup. Keeps drinks hot until the bard finishes the backstory.', '{"material":"Steel, double wall","volume":"470 ml"}', 'cup', 2499, 180),
  ('poster-dragon-map', 'everyday', 'Poster: Here Be Dragons (Really)', 'A fantasy map where every region is labelled "dragon". Cartographer was tired.', '{"size":"A2","paper":"200 gsm matte"}', 'poster', 1999, 190),
  ('stickers-crit-fails', 'everyday', 'Sticker Pack: Critical Failures', 'Twelve vinyl stickers of spells gone wrong and plans that were "fine".', '{"pieces":12,"material":"Vinyl, water resistant"}', 'stickers', 899, 200),
  ('mousepad-initiative', 'everyday', 'Desk Mat: Initiative Order', 'XL desk mat with an initiative tracker printed on it. Dry-erase not included (we tried).', '{"size":"80 × 30 cm"}', 'mat', 2999, 210),
  ('notebook-spellbook', 'everyday', 'Spellbook Notebook', 'Faux-leather notebook that looks like a spellbook. Contents: your grocery list.', '{"pages":160,"size":"A5"}', 'spellbook', 2399, 220)
on conflict (sku) do update set category = excluded.category, name = excluded.name, summary = excluded.summary, details = excluded.details,
  art = excluded.art, price_cents = excluded.price_cents, sort = excluded.sort;

-- -----------------------------------------------------------------------------
-- Community listings
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_listings (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status          text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected', 'removed')),
  kind            text not null check (kind in ('adventure', 'chapter', 'one_shot', 'module', 'encounter', 'story_hook',
                    'monster', 'npc', 'character', 'map', 'location', 'magic_item', 'spell', 'equipment', 'puzzle', 'trap',
                    'handout', 'illustration', 'token', 'other')),
  title           text not null check (char_length(btrim(title)) between 3 and 100),
  summary         text not null default '' check (char_length(summary) <= 280),
  description     text not null default '' check (char_length(description) <= 8000),
  price_cents     integer not null default 0 check (price_cents = 0 or price_cents between 99 and 50000),
  edition         text not null default '5e-2024' check (edition in ('5e-2024', '5e-2014', 'system-neutral', 'other')),
  origin          text not null default 'original' check (origin in ('original', 'srd-based')),
  license         text not null default 'personal-use' check (license in ('personal-use', 'cc-by-4.0', 'cc-by-sa-4.0', 'cc0')),
  attribution     text not null default '' check (char_length(attribution) <= 1000),
  rights_confirmed boolean not null default false,
  level_min       integer check (level_min between 1 and 20),
  level_max       integer check (level_max between 1 and 20),
  genre           text not null default '' check (char_length(genre) <= 40),
  theme           text not null default '' check (char_length(theme) <= 80),
  tags            text[] not null default '{}' check (cardinality(tags) <= 12),
  cover_path      text check (cover_path is null or char_length(cover_path) <= 300),
  preview_paths   text[] not null default '{}' check (cardinality(preview_paths) <= 6),
  files           jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10),
  content         jsonb check (content is null or (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 1500000)),
  content_kind    text check (content_kind is null or content_kind in ('adventure', 'homebrew')),
  moderation_note text not null default '' check (char_length(moderation_note) <= 1000),
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  submitted_at    timestamptz,
  published_at    timestamptz,
  downloads       integer not null default 0,
  creator_name    text not null default '' check (char_length(creator_name) <= 80),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint marketplace_levels check (level_min is null or level_max is null or level_min <= level_max),
  constraint marketplace_content_kind check ((content is null) = (content_kind is null))
);
alter table public.marketplace_listings add column if not exists creator_name text not null default '' check (char_length(creator_name) <= 80);
create index if not exists marketplace_listings_status on public.marketplace_listings (status, published_at desc);
create index if not exists marketplace_listings_creator on public.marketplace_listings (creator_id, updated_at desc);

revoke all on public.marketplace_listings from anon, authenticated;
grant select, delete on public.marketplace_listings to authenticated;
grant insert (kind, title, summary, description, price_cents, edition, origin, license, attribution, rights_confirmed, level_min, level_max,
  genre, theme, tags, cover_path, preview_paths, files, content, content_kind) on public.marketplace_listings to authenticated;
grant update (kind, title, summary, description, price_cents, edition, origin, license, attribution, rights_confirmed, level_min, level_max,
  genre, theme, tags, cover_path, preview_paths, files, content, content_kind) on public.marketplace_listings to authenticated;
alter table public.marketplace_listings enable row level security;
drop policy if exists "Listings: create own" on public.marketplace_listings;
create policy "Listings: create own" on public.marketplace_listings for insert to authenticated with check (creator_id = (select auth.uid()));
drop policy if exists "Listings: edit own" on public.marketplace_listings;
create policy "Listings: edit own" on public.marketplace_listings for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

-- Paths of uploaded files must sit in the creator's own folder for this listing; a removed listing can't be edited;
-- changing a published or pending listing sends it (back) to review, so nothing changes in public without a moderator.
create or replace function private.marketplace_listing_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prefix text := new.creator_id::text || '/' || new.id::text || '/';
  p text;
  f jsonb;
begin
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    if old.status = 'removed' then
      raise exception 'This listing was removed and can no longer be edited.' using errcode = 'P0001';
    end if;
    if old.status in ('published', 'pending_review') and (new.title, new.summary, new.description, new.price_cents, new.kind, new.files, new.content, new.cover_path, new.preview_paths, new.license, new.origin, new.attribution)
       is distinct from (old.title, old.summary, old.description, old.price_cents, old.kind, old.files, old.content, old.cover_path, old.preview_paths, old.license, old.origin, old.attribution) then
      new.status := 'pending_review';
      new.submitted_at := now();
    end if;
  end if;
  if new.cover_path is not null and left(new.cover_path, length(prefix || 'media/')) <> prefix || 'media/' then
    raise exception 'Images must be uploaded for this listing.' using errcode = '22023';
  end if;
  foreach p in array new.preview_paths loop
    if left(p, length(prefix || 'media/')) <> prefix || 'media/' then
      raise exception 'Images must be uploaded for this listing.' using errcode = '22023';
    end if;
  end loop;
  for f in select * from jsonb_array_elements(new.files) loop
    if jsonb_typeof(f) <> 'object' or left(coalesce(f ->> 'path', ''), length(prefix || 'files/')) <> prefix || 'files/'
       or coalesce(f ->> 'name', '') !~ '^[^/\\]{1,120}\.(pdf|png|jpe?g|webp|json|txt|md)$' then
      raise exception 'Files must be PDF, image, JSON, text or Markdown files uploaded for this listing.' using errcode = '22023';
    end if;
  end loop;
  new.tags := (select coalesce(array_agg(distinct lower(left(btrim(t), 30))), '{}') from unnest(new.tags) t where btrim(t) <> '');
  -- The creator's public name (profiles are private), refreshed whenever the creator saves.
  if tg_op = 'INSERT' or new.creator_id = auth.uid() then
    new.creator_name := coalesce((select left(coalesce(nullif(btrim(p.display_name), ''), p.username, ''), 80) from public.profiles p where p.id = new.creator_id), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists marketplace_listing_guard on public.marketplace_listings;
create trigger marketplace_listing_guard before insert or update on public.marketplace_listings for each row execute function private.marketplace_listing_guard();

-- Creator: send for review (or back to review after a rejection).
create or replace function public.submit_listing(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
begin
  select * into l from public.marketplace_listings where id = p_id for update;
  if not found or l.creator_id <> auth.uid() then
    raise exception 'Only the creator can submit this listing.' using errcode = '42501';
  end if;
  if l.status not in ('draft', 'rejected') then
    raise exception 'This listing is already submitted or published.' using errcode = 'P0001';
  end if;
  if not l.rights_confirmed then
    raise exception 'Confirm that you own this content or have the right to share it.' using errcode = 'P0001';
  end if;
  if char_length(btrim(l.description)) < 20 then
    raise exception 'Describe what is included (at least a sentence).' using errcode = 'P0001';
  end if;
  if l.content is null and jsonb_array_length(l.files) = 0 then
    raise exception 'Add something to download: a file, or content from your library.' using errcode = 'P0001';
  end if;
  if l.origin = 'srd-based' and char_length(btrim(l.attribution)) < 10 then
    raise exception 'SRD-based content needs the SRD 5.2.1 attribution (CC-BY-4.0).' using errcode = 'P0001';
  end if;
  update public.marketplace_listings set status = 'pending_review', submitted_at = now(), moderation_note = '' where id = p_id;
  return 'pending_review';
end;
$$;

-- Creator: take a pending listing back to draft. Creator or moderator: remove (buyers keep what they bought).
create or replace function public.withdraw_listing(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  update public.marketplace_listings set status = 'draft' where id = p_id and creator_id = auth.uid() and status = 'pending_review';
  if not found then raise exception 'Only a pending listing of yours can be taken back to draft.' using errcode = 'P0001'; end if;
  return 'draft';
end;
$$;

create or replace function public.remove_listing(p_id uuid, p_reason text default '')
returns text language plpgsql security definer set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
  as_mod boolean := private.is_moderator(auth.uid());
begin
  select * into l from public.marketplace_listings where id = p_id for update;
  if not found or (l.creator_id <> auth.uid() and not as_mod) then
    raise exception 'Only the creator or a moderator can remove this listing.' using errcode = '42501';
  end if;
  update public.marketplace_listings set status = 'removed', moderation_note = left(coalesce(p_reason, ''), 1000),
    reviewed_by = case when l.creator_id <> auth.uid() then auth.uid() else reviewed_by end,
    reviewed_at = case when l.creator_id <> auth.uid() then now() else reviewed_at end where id = p_id;
  if l.creator_id <> auth.uid() then
    perform private.notify_account(l.creator_id, 'marketplace', 'Your listing was removed: ' || l.title, coalesce(nullif(p_reason, ''), 'A moderator removed it.'), 'dashboard.html#marketplace/creator');
  end if;
  return 'removed';
end;
$$;

-- Moderator: approve, reject (with a reason) or remove.
create or replace function public.moderate_listing(p_id uuid, p_decision text, p_note text default '')
returns text language plpgsql security definer set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
begin
  if not private.is_moderator(auth.uid()) then
    raise exception 'Only marketplace moderators can review listings.' using errcode = '42501';
  end if;
  select * into l from public.marketplace_listings where id = p_id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0002'; end if;
  if p_decision = 'approve' then
    if l.status <> 'pending_review' then raise exception 'Only listings waiting for review can be approved.' using errcode = 'P0001'; end if;
    update public.marketplace_listings set status = 'published', published_at = coalesce(published_at, now()), reviewed_by = auth.uid(), reviewed_at = now(), moderation_note = left(coalesce(p_note, ''), 1000) where id = p_id;
    update public.marketplace_reports set status = 'dismissed' where listing_id = p_id and status = 'open';
    perform private.notify_account(l.creator_id, 'marketplace', 'Published: ' || l.title, 'Your listing passed review and is now in the Community Marketplace.', 'dashboard.html#marketplace/creator');
    return 'published';
  elsif p_decision = 'reject' then
    if l.status <> 'pending_review' then raise exception 'Only listings waiting for review can be rejected.' using errcode = 'P0001'; end if;
    if char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'Tell the creator why (a short reason).' using errcode = 'P0001'; end if;
    update public.marketplace_listings set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), moderation_note = left(p_note, 1000) where id = p_id;
    perform private.notify_account(l.creator_id, 'marketplace', 'Changes needed: ' || l.title, left(p_note, 400), 'dashboard.html#marketplace/creator');
    return 'rejected';
  elsif p_decision = 'remove' then
    perform public.remove_listing(p_id, p_note);
    update public.marketplace_reports set status = 'actioned' where listing_id = p_id and status = 'open';
    return 'removed';
  end if;
  raise exception 'Unknown decision.' using errcode = '22023';
end;
$$;

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.marketplace_listings (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('copyright', 'offensive', 'spam', 'misleading', 'not_working', 'other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at  timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
revoke all on public.marketplace_reports from anon, authenticated;
grant select on public.marketplace_reports to authenticated;
alter table public.marketplace_reports enable row level security;
drop policy if exists "Reports: own or moderator" on public.marketplace_reports;
create policy "Reports: own or moderator" on public.marketplace_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_moderator((select auth.uid())));

create or replace function public.report_listing(p_id uuid, p_reason text, p_details text default '')
returns text language plpgsql security definer set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
  open_reports integer;
begin
  select * into l from public.marketplace_listings where id = p_id and status = 'published';
  if not found then raise exception 'Only published listings can be reported.' using errcode = 'P0001'; end if;
  if l.creator_id = auth.uid() then raise exception 'You can’t report your own listing.' using errcode = 'P0001'; end if;
  insert into public.marketplace_reports (listing_id, reporter_id, reason, details) values (p_id, auth.uid(), p_reason, left(coalesce(p_details, ''), 1000))
  on conflict (listing_id, reporter_id) do update set reason = excluded.reason, details = excluded.details, status = 'open', created_at = now();
  select count(*) into open_reports from public.marketplace_reports where listing_id = p_id and status = 'open';
  if open_reports >= 3 then
    update public.marketplace_listings set status = 'pending_review', moderation_note = 'Sent back to review after several reports.' where id = p_id;
  end if;
  return 'reported';
end;
$$;

-- -----------------------------------------------------------------------------
-- Orders and the library
-- -----------------------------------------------------------------------------
create table if not exists public.marketplace_orders (
  id             uuid primary key default gen_random_uuid(),
  buyer_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reference      text not null unique,
  status         text not null default 'pending' check (status in ('pending', 'paid', 'declined', 'cancelled', 'refunded')),
  provider       text,
  provider_ref   text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents    integer not null check (total_cents >= 0),
  currency       text not null default 'usd',
  customer       jsonb not null default '{}'::jsonb check (jsonb_typeof(customer) = 'object' and octet_length(customer::text) <= 4000),
  has_physical   boolean not null default false,
  fulfilment     text check (fulfilment is null or fulfilment in ('not_fulfilled_demo', 'pending', 'shipped')),
  attempts       integer not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create table if not exists public.marketplace_order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.marketplace_orders (id) on delete cascade,
  item_type    text not null check (item_type in ('listing', 'store', 'plan', 'campaign_book')),
  ref          text not null,
  title        text not null,
  unit_cents   integer not null check (unit_cents >= 0),
  quantity     integer not null default 1 check (quantity between 1 and 10),
  options      jsonb not null default '{}'::jsonb,
  creator_id   uuid references auth.users (id) on delete set null,
  fee_cents    integer not null default 0,
  creator_cents integer not null default 0
);
create index if not exists marketplace_orders_buyer on public.marketplace_orders (buyer_id, created_at desc);
create index if not exists marketplace_order_items_order on public.marketplace_order_items (order_id);
create index if not exists marketplace_order_items_creator on public.marketplace_order_items (creator_id) where creator_id is not null;

create table if not exists public.marketplace_library (
  user_id     uuid not null references auth.users (id) on delete cascade,
  listing_id  uuid not null references public.marketplace_listings (id) on delete cascade,
  source      text not null check (source in ('purchase', 'free', 'own')),
  order_id    uuid references public.marketplace_orders (id) on delete set null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

revoke all on public.marketplace_orders, public.marketplace_order_items, public.marketplace_library from anon, authenticated;
grant select on public.marketplace_orders, public.marketplace_order_items, public.marketplace_library to authenticated;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_library enable row level security;
drop policy if exists "Orders: own" on public.marketplace_orders;
create policy "Orders: own" on public.marketplace_orders for select to authenticated using (buyer_id = (select auth.uid()));
drop policy if exists "Order items: own orders" on public.marketplace_order_items;
create policy "Order items: own orders" on public.marketplace_order_items for select to authenticated
  using (exists (select 1 from public.marketplace_orders o where o.id = order_id and o.buyer_id = (select auth.uid())));
drop policy if exists "Listings: delete own unsold drafts" on public.marketplace_listings;
create policy "Listings: delete own unsold drafts" on public.marketplace_listings for delete to authenticated
  using (creator_id = (select auth.uid()) and status in ('draft', 'rejected')
         and not exists (select 1 from public.marketplace_library l where l.listing_id = marketplace_listings.id and l.source <> 'own'));
-- Listings are readable when published, by their creator and moderators, and by everyone who has them in their library
-- (so a removed listing stays in its buyers' libraries).
drop policy if exists "Listings: read published, own, or as moderator" on public.marketplace_listings;
create policy "Listings: read published, own, or as moderator" on public.marketplace_listings for select to authenticated
  using (status = 'published' or creator_id = (select auth.uid()) or private.is_moderator((select auth.uid()))
         or exists (select 1 from public.marketplace_library b where b.listing_id = marketplace_listings.id and b.user_id = (select auth.uid())));
drop policy if exists "Library: own" on public.marketplace_library;
create policy "Library: own" on public.marketplace_library for select to authenticated using (user_id = (select auth.uid()));

-- Who may download a listing's content (creator, moderators, and anyone with it in their library).
create or replace function private.can_download_listing(uid uuid, p_listing uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.marketplace_listings l where l.id = p_listing and l.creator_id = uid)
      or private.is_moderator(uid)
      or exists (select 1 from public.marketplace_library b where b.user_id = uid and b.listing_id = p_listing);
$$;
create or replace function private.can_view_listing_media(uid uuid, p_listing uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.marketplace_listings l where l.id = p_listing and (l.status = 'published' or l.creator_id = uid))
      or private.is_moderator(uid)
      or exists (select 1 from public.marketplace_library b where b.user_id = uid and b.listing_id = p_listing);
$$;
revoke all on function private.can_download_listing(uuid, uuid), private.can_view_listing_media(uuid, uuid) from public, anon;
grant execute on function private.can_download_listing(uuid, uuid), private.can_view_listing_media(uuid, uuid) to authenticated;

create or replace function public.listing_content(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb;
  k text;
begin
  if not private.can_download_listing(auth.uid(), p_id) then
    raise exception 'Get this listing first to open its content.' using errcode = '42501';
  end if;
  select content, content_kind into c, k from public.marketplace_listings where id = p_id;
  return jsonb_build_object('kind', k, 'content', c);
end;
$$;

-- Free listings go straight into the library.
create or replace function public.claim_free_listing(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  l public.marketplace_listings%rowtype;
begin
  select * into l from public.marketplace_listings where id = p_id and status = 'published';
  if not found then raise exception 'This listing isn’t available.' using errcode = 'P0001'; end if;
  if l.price_cents > 0 then raise exception 'This listing isn’t free: buy it at checkout.' using errcode = 'P0001'; end if;
  insert into public.marketplace_library (user_id, listing_id, source) values (auth.uid(), p_id, case when l.creator_id = auth.uid() then 'own' else 'free' end)
  on conflict do nothing;
  if found and l.creator_id <> auth.uid() then
    update public.marketplace_listings set downloads = downloads + 1 where id = p_id;
  end if;
  return 'in_library';
end;
$$;

-- Plans and the campaign book, shared by the payment webhook and checkout (one implementation, the provider is a label).
create or replace function private.set_account_plan(p_user uuid, p_plan text, p_status text, p_period_end timestamptz, p_provider text, p_ref text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_plan = 'warlord' then
    delete from public.account_plans where user_id = p_user and provider = p_provider;
    return;
  end if;
  insert into public.account_plans (user_id, plan_id, status, current_period_end, provider, provider_ref, provider_updated_at)
  values (p_user, p_plan, p_status, p_period_end, p_provider, p_ref, now())
  on conflict (user_id) do update set plan_id = excluded.plan_id, status = excluded.status, current_period_end = excluded.current_period_end,
    provider = excluded.provider, provider_ref = excluded.provider_ref, provider_updated_at = excluded.provider_updated_at, updated_at = now();
end;
$$;
revoke all on function private.set_account_plan(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;

create or replace function private.unlock_campaign_book(p_campaign uuid, p_user uuid, p_provider text, p_ref text, p_amount integer, p_currency text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  buyer text;
begin
  if exists (select 1 from public.campaign_entitlements e where e.provider = p_provider and e.provider_ref = p_ref) then
    return 'unchanged';
  end if;
  if exists (select 1 from public.campaign_entitlements e where e.campaign_id = p_campaign and e.product = 'campaign_book_digital' and e.status = 'paid') then
    insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency)
    values (p_campaign, 'campaign_book_digital', p_user, 'pending', p_provider, p_ref, p_amount, lower(p_currency));
    return 'duplicate_needs_refund';
  end if;
  insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency)
  values (p_campaign, 'campaign_book_digital', p_user, 'paid', p_provider, p_ref, p_amount, lower(p_currency));
  select coalesce(p.display_name, 'A member') into buyer from public.profiles p where p.id = p_user;
  perform private.log_campaign(p_campaign, p_user, 'book_unlocked', coalesce(buyer, 'A member') || ' bought the campaign book for everyone in the campaign.');
  perform private.notify_campaign(p_campaign, 'book', 'The campaign book is unlocked', coalesce(buyer, 'A member') || ' bought it for the whole campaign. Everyone can read it in the Logbook.', 'logbook/book');
  return 'applied';
end;
$$;
revoke all on function private.unlock_campaign_book(uuid, uuid, text, text, integer, text) from public, anon, authenticated;

-- Plan prices (match the pricing page) and the campaign book's sample price; the server never trusts browser prices.
create or replace function private.plan_price(p_product text)
returns integer language sql immutable set search_path = ''
as $$
  select case p_product when 'plan_dm_monthly' then 399 when 'plan_dm_yearly' then 4549
    when 'plan_fogger_monthly' then 599 when 'plan_fogger_yearly' then 6829 else null end;
$$;

-- Creates a pending order from a cart: [{ type: 'listing'|'store'|'plan'|'campaign_book', ref, quantity, options }].
create or replace function public.create_order(p_items jsonb, p_customer jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  it jsonb;
  oid uuid;
  ref text;
  fee integer := (select fee_bps from public.marketplace_settings where id);
  sub integer := 0;
  phys boolean := false;
  q integer;
  t text;
  l public.marketplace_listings%rowtype;
  p public.marketplace_store_products%rowtype;
  c public.campaigns%rowtype;
  price integer;
  seen text[] := '{}';
begin
  if me is null then raise exception 'Sign in to check out.' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;
  ref := 'FOD-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into public.marketplace_orders (buyer_id, reference, subtotal_cents, total_cents, customer)
  values (me, ref, 0, 0, coalesce(p_customer, '{}'::jsonb) - 'card' - 'cardNumber' - 'cvc') returning id into oid;
  for it in select * from jsonb_array_elements(p_items) loop
    t := it ->> 'type';
    q := greatest(1, least(10, coalesce((it ->> 'quantity')::integer, 1)));
    if (t || ':' || coalesce(it ->> 'ref', '')) = any (seen) then raise exception 'An item is in the cart twice.' using errcode = '22023'; end if;
    seen := seen || (t || ':' || coalesce(it ->> 'ref', ''));
    if t = 'listing' then
      select * into l from public.marketplace_listings where id = (it ->> 'ref')::uuid and status = 'published';
      if not found then raise exception 'A listing in your cart is no longer available.' using errcode = 'P0001'; end if;
      if l.price_cents = 0 then raise exception '“%” is free: get it from its page instead.', l.title using errcode = 'P0001'; end if;
      if l.creator_id = me then raise exception 'You can’t buy your own listing.' using errcode = 'P0001'; end if;
      if exists (select 1 from public.marketplace_library b where b.user_id = me and b.listing_id = l.id) then
        raise exception 'You already have “%”.', l.title using errcode = 'P0001';
      end if;
      insert into public.marketplace_order_items (order_id, item_type, ref, title, unit_cents, quantity, creator_id, fee_cents, creator_cents)
      values (oid, 'listing', l.id::text, l.title, l.price_cents, 1, l.creator_id, (l.price_cents * fee + 5000) / 10000, l.price_cents - (l.price_cents * fee + 5000) / 10000);
      sub := sub + l.price_cents;
    elsif t = 'store' then
      select * into p from public.marketplace_store_products where sku = it ->> 'ref' and active;
      if not found then raise exception 'A product in your cart is no longer available.' using errcode = 'P0001'; end if;
      insert into public.marketplace_order_items (order_id, item_type, ref, title, unit_cents, quantity, options)
      values (oid, 'store', p.sku, p.name, p.price_cents, q, coalesce(it -> 'options', '{}'::jsonb));
      sub := sub + p.price_cents * q;
      phys := true;
    elsif t = 'plan' then
      price := private.plan_price(it ->> 'ref');
      if price is null then raise exception 'Unknown plan.' using errcode = '22023'; end if;
      if not (private.flag('demo_payments') and private.is_test_owner(me)) then
        raise exception 'Plans can’t be bought here yet.' using errcode = '42501';
      end if;
      if exists (select 1 from public.account_plans a where a.user_id = me and coalesce(a.provider, '') <> 'demo') then
        raise exception 'You have a real plan; a demo purchase won’t replace it.' using errcode = 'P0001';
      end if;
      insert into public.marketplace_order_items (order_id, item_type, ref, title, unit_cents, quantity)
      values (oid, 'plan', it ->> 'ref', case when it ->> 'ref' like 'plan_dm%' then 'Dungeon Master' else 'Fogger of the Dragons' end || case when it ->> 'ref' like '%yearly' then ' (yearly)' else ' (monthly)' end, price, 1);
      sub := sub + price;
    elsif t = 'campaign_book' then
      select * into c from public.campaigns where id = (it ->> 'ref')::uuid;
      if not found or not exists (select 1 from public.campaign_members m where m.campaign_id = c.id and m.user_id = me and m.status = 'active') then
        raise exception 'Only members of a campaign can buy its book.' using errcode = '42501';
      end if;
      if exists (select 1 from public.campaign_entitlements e where e.campaign_id = c.id and e.product = 'campaign_book_digital' and e.status = 'paid')
         or private.user_plan(c.owner_id) = 'fogger-of-the-dragons' then
        raise exception 'This campaign’s book is already unlocked.' using errcode = 'P0001';
      end if;
      if private.user_plan(c.owner_id) not in ('dungeon-master', 'fogger-of-the-dragons') then
        raise exception 'The campaign book needs the Logbook (the DM’s plan must include it).' using errcode = 'P0001';
      end if;
      insert into public.marketplace_order_items (order_id, item_type, ref, title, unit_cents, quantity)
      values (oid, 'campaign_book', c.id::text, 'Campaign Book (digital): ' || c.name, 499, 1);
      sub := sub + 499;
    else
      raise exception 'Unknown item in the cart.' using errcode = '22023';
    end if;
  end loop;
  update public.marketplace_orders set subtotal_cents = sub, total_cents = sub, has_physical = phys where id = oid;
  return jsonb_build_object('id', oid, 'reference', ref, 'total', sub, 'currency', 'usd');
end;
$$;

-- Gives the buyer everything in a paid order (library rows, plan, campaign book). Idempotent.
create or replace function private.fulfil_order(p_order uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  o public.marketplace_orders%rowtype;
  it public.marketplace_order_items%rowtype;
begin
  select * into o from public.marketplace_orders where id = p_order;
  for it in select * from public.marketplace_order_items where order_id = p_order loop
    if it.item_type = 'listing' then
      insert into public.marketplace_library (user_id, listing_id, source, order_id) values (o.buyer_id, it.ref::uuid, 'purchase', o.id) on conflict do nothing;
      if found then update public.marketplace_listings set downloads = downloads + 1 where id = it.ref::uuid; end if;
    elsif it.item_type = 'plan' then
      perform private.set_account_plan(o.buyer_id, case when it.ref like 'plan_dm%' then 'dungeon-master' else 'fogger-of-the-dragons' end, 'active',
        now() + case when it.ref like '%yearly' then interval '1 year' else interval '1 month' end, o.provider, o.reference);
    elsif it.item_type = 'campaign_book' then
      perform private.unlock_campaign_book(it.ref::uuid, o.buyer_id, o.provider, o.reference, it.unit_cents, o.currency);
    end if;
  end loop;
  if o.has_physical then
    update public.marketplace_orders set fulfilment = case when o.provider = 'demo' then 'not_fulfilled_demo' else 'pending' end where id = p_order;
  end if;
end;
$$;
revoke all on function private.fulfil_order(uuid) from public, anon, authenticated;

-- The simulated payment. Only an outcome is sent (never card data); only while 'demo_payments' is on.
create or replace function public.pay_order_demo(p_order uuid, p_outcome text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  o public.marketplace_orders%rowtype;
begin
  if not private.flag('demo_payments') then
    raise exception 'Demo payments are switched off.' using errcode = '42501';
  end if;
  select * into o from public.marketplace_orders where id = p_order for update;
  if not found or o.buyer_id <> auth.uid() then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if o.status = 'paid' then return jsonb_build_object('status', 'paid', 'reference', o.reference); end if;
  if o.status not in ('pending', 'declined') then raise exception 'This order can’t be paid.' using errcode = 'P0001'; end if;
  if p_outcome = 'decline' then
    update public.marketplace_orders set status = 'declined', provider = 'demo', attempts = attempts + 1, last_error = 'The (simulated) card was declined.' where id = p_order;
    return jsonb_build_object('status', 'declined', 'reference', o.reference);
  elsif p_outcome = 'success' then
    update public.marketplace_orders set status = 'paid', provider = 'demo', provider_ref = 'demo-' || o.reference, attempts = attempts + 1, last_error = null, paid_at = now() where id = p_order;
    perform private.fulfil_order(p_order);
    return jsonb_build_object('status', 'paid', 'reference', o.reference);
  end if;
  raise exception 'Unknown outcome.' using errcode = '22023';
end;
$$;

-- Test owners: switch their own plan directly (demo-labelled row in account_plans; a real paid plan is never overwritten).
create or replace function public.demo_set_plan(p_plan text)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.flag('demo_payments') and private.is_test_owner(auth.uid())) then
    raise exception 'The tier simulator is only for configured test owners while demo payments are on.' using errcode = '42501';
  end if;
  if p_plan not in ('warlord', 'dungeon-master', 'fogger-of-the-dragons') then raise exception 'Unknown plan.' using errcode = '22023'; end if;
  if exists (select 1 from public.account_plans a where a.user_id = auth.uid() and coalesce(a.provider, '') <> 'demo') then
    raise exception 'You have a real plan; the simulator won’t overwrite it.' using errcode = 'P0001';
  end if;
  perform private.set_account_plan(auth.uid(), p_plan, 'active', null, 'demo', 'tier-simulator');
  return private.user_plan(auth.uid());
end;
$$;

-- What the signed-in person may see of the marketplace tools.
create or replace function public.marketplace_access()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('moderator', private.is_moderator(auth.uid()), 'testOwner', private.is_test_owner(auth.uid()),
    'demoPayments', private.flag('demo_payments'), 'feeBps', (select fee_bps from public.marketplace_settings where id),
    'plan', private.user_plan(auth.uid()),
    'planProvider', (select a.provider from public.account_plans a where a.user_id = auth.uid()));
$$;

-- Creator dashboard numbers: per listing, sales and downloads (paid sales made with demo payments are labelled).
create or replace function public.creator_stats()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'listing', l.id, 'downloads', l.downloads,
    'sales', (select count(*) from public.marketplace_order_items i join public.marketplace_orders o on o.id = i.order_id where i.item_type = 'listing' and i.ref = l.id::text and o.status = 'paid'),
    'demoSales', (select count(*) from public.marketplace_order_items i join public.marketplace_orders o on o.id = i.order_id where i.item_type = 'listing' and i.ref = l.id::text and o.status = 'paid' and o.provider = 'demo'),
    'gross', (select coalesce(sum(i.unit_cents), 0) from public.marketplace_order_items i join public.marketplace_orders o on o.id = i.order_id where i.item_type = 'listing' and i.ref = l.id::text and o.status = 'paid'),
    'net', (select coalesce(sum(i.creator_cents), 0) from public.marketplace_order_items i join public.marketplace_orders o on o.id = i.order_id where i.item_type = 'listing' and i.ref = l.id::text and o.status = 'paid'))), '[]'::jsonb)
  from public.marketplace_listings l where l.creator_id = auth.uid();
$$;

revoke all on function public.submit_listing(uuid), public.withdraw_listing(uuid), public.remove_listing(uuid, text), public.moderate_listing(uuid, text, text),
  public.report_listing(uuid, text, text), public.listing_content(uuid), public.claim_free_listing(uuid), public.create_order(jsonb, jsonb),
  public.pay_order_demo(uuid, text), public.demo_set_plan(text), public.marketplace_access(), public.creator_stats() from public, anon;
grant execute on function public.submit_listing(uuid), public.withdraw_listing(uuid), public.remove_listing(uuid, text), public.moderate_listing(uuid, text, text),
  public.report_listing(uuid, text, text), public.listing_content(uuid), public.claim_free_listing(uuid), public.create_order(jsonb, jsonb),
  public.pay_order_demo(uuid, text), public.demo_set_plan(text), public.marketplace_access(), public.creator_stats() to authenticated;

-- The payment webhook keeps its signature but now shares the book/plan code above.
create or replace function public.apply_provider_book(
  p_campaign uuid, p_user uuid, p_status text, p_provider_ref text, p_amount integer, p_currency text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.campaign_entitlements%rowtype;
begin
  if p_status not in ('pending', 'paid', 'refunded', 'failed') or coalesce(p_provider_ref, '') = '' then
    raise exception 'Unknown status or missing order reference.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.campaigns where id = p_campaign) then
    return 'unknown_campaign';
  end if;
  select * into existing from public.campaign_entitlements e where e.provider = 'lemonsqueezy' and e.provider_ref = p_provider_ref;
  if found then
    if existing.status = p_status then return 'unchanged'; end if;
    update public.campaign_entitlements set status = p_status where id = existing.id;
    return 'updated';
  end if;
  if p_status = 'paid' then
    return private.unlock_campaign_book(p_campaign, p_user, 'lemonsqueezy', p_provider_ref, p_amount, p_currency);
  end if;
  insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency)
  values (p_campaign, 'campaign_book_digital', p_user, p_status, 'lemonsqueezy', p_provider_ref, p_amount, lower(p_currency));
  return 'applied';
end;
$$;
revoke all on function public.apply_provider_book(uuid, uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_provider_book(uuid, uuid, text, text, integer, text) to service_role;

-- -----------------------------------------------------------------------------
-- Storage: private bucket; previews readable when the listing is visible, files only with access; no executables.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', false, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/plain', 'text/markdown'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Marketplace: read" on storage.objects;
create policy "Marketplace: read" on storage.objects for select to authenticated
  using (bucket_id = 'marketplace' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or ((storage.foldername(name))[3] = 'media' and private.can_view_listing_media((select auth.uid()), private.try_uuid((storage.foldername(name))[2])))
    or ((storage.foldername(name))[3] = 'files' and private.can_download_listing((select auth.uid()), private.try_uuid((storage.foldername(name))[2])))));
drop policy if exists "Marketplace: upload own" on storage.objects;
create policy "Marketplace: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'marketplace' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] in ('media', 'files')
    and lower(name) ~ '\.(jpe?g|png|webp|pdf|json|txt|md)$'
    and exists (select 1 from public.marketplace_listings l where l.id::text = (storage.foldername(name))[2] and l.creator_id = (select auth.uid()) and l.status <> 'removed'));
drop policy if exists "Marketplace: delete own" on storage.objects;
create policy "Marketplace: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'marketplace' and (storage.foldername(name))[1] = (select auth.uid())::text);
