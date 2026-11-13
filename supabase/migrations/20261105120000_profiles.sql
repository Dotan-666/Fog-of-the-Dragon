-- =============================================================================
-- Fog of the Dragon — 001: user profiles
--
-- One row per auth user, created automatically by a trigger on auth.users.
-- Users can read and update only their own row (RLS + column privileges).
-- =============================================================================

-- Functions that must not be callable through the REST API live in a private schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text unique
                 check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name   text
                 check (char_length(display_name) between 1 and 40),
  avatar_url     text
                 check (char_length(avatar_url) <= 1024),
  -- Fields shown on the existing Profile / Edit Profile pages
  bio            text check (char_length(bio) <= 500),
  primary_system text check (primary_system in ('dnd5e', 'pathfinder2e', 'callofcthulhu', 'other')),
  favorite_class text check (char_length(favorite_class) <= 60),
  alignment      text check (alignment in ('lg', 'ng', 'cg', 'ln', 'tn', 'cn', 'le', 'ne', 'ce')),
  availability   text check (char_length(availability) <= 120),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing profile for each auth user. Private to its owner until sharing features exist.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profile creation on sign-up
-- SECURITY DEFINER so it can insert regardless of RLS; it only ever writes the
-- row for the user being created. Username comes from sign-up metadata and is
-- made unique (or left empty) so a taken name can never block registration.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted   text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  display  text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username', ''));
  chosen   text := null;
begin
  wanted := regexp_replace(wanted, '[^a-z0-9_]', '_', 'g');
  if wanted ~ '^[a-z0-9_]{3,24}$' then
    if not exists (select 1 from public.profiles where username = wanted) then
      chosen := wanted;
    else
      chosen := left(wanted, 19) || '_' || substr(md5(random()::text), 1, 4);
      if exists (select 1 from public.profiles where username = chosen) then
        chosen := null;
      end if;
    end if;
  end if;

  if display = '' then
    display := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, chosen, nullif(left(display, 40), ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privileges: no anonymous access at all; signed-in users may only touch the
-- editable columns (id, created_at and updated_at can't be changed by clients).
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, avatar_url, bio, primary_system, favorite_class, alignment, availability)
  on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio, primary_system, favorite_class, alignment, availability)
  on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Fallback for accounts created before the trigger existed: a user may create only their own row.
create policy "Profiles: create own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: profiles are removed only when the auth user is deleted (ON DELETE CASCADE).
