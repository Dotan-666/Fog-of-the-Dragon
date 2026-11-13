-- =============================================================================
-- Fog of the Dragon — Foggy (AI content helper): INFRASTRUCTURE ONLY
--
-- Nothing here generates anything. This prepares:
--   app_flags                a server-side switch per feature; 'foggy' starts OFF, so no one can use generation until the
--                            site owner turns it on (service role / SQL Editor), even if the interface exists
--   private.foggy_access()   who may use Foggy, from the existing plans (pricing page):
--                              Dungeon Master        → "Foggie — Campaign Writing Helper"   (Dashboard Foggy)
--                              Fogger of the Dragons → "Foggie+ — Advanced AI Assistant"   (Dashboard Foggy)
--                                                      + Campaign Foggy, for the DM of their own campaigns
--                              Warlord (Free)        → no Foggy
--   public.foggy_access()    the same for the signed-in user (the app and the Edge Function ask this)
--   foggy_content            generated drafts, kept apart from finished content: standalone (scope 'dashboard') or for one
--                            campaign (scope 'campaign'). Only the server (Edge Function foggy-generate with the service
--                            role) will insert rows; users can read, mark as saved and delete their own.
-- No new plans or tiers. Safe to run again.
-- =============================================================================

create table if not exists public.app_flags (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  enabled    boolean not null default false,
  note       text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);
insert into public.app_flags (key, enabled, note)
values ('foggy', false, 'AI generation (Edge Function foggy-generate). Off until the Gemini key is set and generation is built.')
on conflict (key) do nothing;

revoke all on public.app_flags from anon, authenticated;
grant select on public.app_flags to anon, authenticated;
alter table public.app_flags enable row level security;
drop policy if exists "App flags: anyone can read" on public.app_flags;
create policy "App flags: anyone can read" on public.app_flags for select to anon, authenticated using (true);

create table if not exists public.foggy_content (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope       text not null check (scope in ('dashboard', 'campaign')),
  campaign_id uuid references public.campaigns (id) on delete cascade,
  kind        text not null check (kind in ('npc', 'portrait', 'map', 'location', 'monster', 'item', 'spell', 'handout', 'outline', 'text')),
  title       text not null check (char_length(title) between 1 and 120),
  body        jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 100000),
  prompt      text check (prompt is null or char_length(prompt) <= 2000),
  model       text check (model is null or char_length(model) <= 80),
  status      text not null default 'draft' check (status in ('draft', 'saved', 'discarded')),
  saved_to    jsonb check (saved_to is null or jsonb_typeof(saved_to) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint foggy_content_scope check ((scope = 'campaign') = (campaign_id is not null))
);
create index if not exists foggy_content_owner on public.foggy_content (owner_id, created_at desc);
create index if not exists foggy_content_campaign on public.foggy_content (campaign_id) where campaign_id is not null;

revoke all on public.foggy_content from anon, authenticated;
grant select, delete on public.foggy_content to authenticated;
grant update (status, saved_to) on public.foggy_content to authenticated;
alter table public.foggy_content enable row level security;
drop policy if exists "Foggy content: read own" on public.foggy_content;
create policy "Foggy content: read own" on public.foggy_content for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Foggy content: update own" on public.foggy_content;
create policy "Foggy content: update own" on public.foggy_content for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Foggy content: delete own" on public.foggy_content;
create policy "Foggy content: delete own" on public.foggy_content for delete to authenticated using (owner_id = (select auth.uid()));

create or replace function private.foggy_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists foggy_content_touch on public.foggy_content;
create trigger foggy_content_touch before update on public.foggy_content for each row execute function private.foggy_touch();

-- Who may use Foggy (and where). p_campaign: the campaign the request is for (Campaign Foggy), or null (Dashboard).
create or replace function private.foggy_access(uid uuid, p_campaign uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plan text := private.user_plan(uid);
  tier text := case plan when 'dungeon-master' then 'foggie' when 'fogger-of-the-dragons' then 'foggie_plus' else null end;
  on_flag boolean := coalesce((select f.enabled from public.app_flags f where f.key = 'foggy'), false);
  campaign_ok boolean := false;
begin
  if p_campaign is not null then
    campaign_ok := plan = 'fogger-of-the-dragons'
      and exists (select 1 from public.campaigns c where c.id = p_campaign and c.owner_id = uid and c.status = 'active');
  end if;
  return jsonb_build_object(
    'plan', plan,
    'tier', tier,
    'enabled', on_flag,
    'dashboard', tier is not null,
    'campaign', campaign_ok,
    -- What the Edge Function checks before it may generate anything.
    'canGenerate', on_flag and tier is not null and (p_campaign is null or campaign_ok)
  );
end;
$$;
revoke all on function private.foggy_access(uuid, uuid) from public, anon, authenticated;

create or replace function public.foggy_access(p_campaign uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.foggy_access(auth.uid(), p_campaign);
$$;
revoke all on function public.foggy_access(uuid) from public, anon;
grant execute on function public.foggy_access(uuid) to authenticated;
