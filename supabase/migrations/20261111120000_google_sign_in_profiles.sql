-- =============================================================================
-- Fog of the Dragon — profiles for Google sign-in
--
-- Google accounts arrive without our own "username" / "display_name" metadata; Google sends "full_name" and
-- "name". The sign-up trigger now uses those for the display name. The username stays empty (the user can choose
-- one in Edit Profile), so a Google name never takes someone else's username.
-- Enabling Google itself is done in Supabase → Authentication → Providers → Google (see README).
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted   text := lower(coalesce(meta ->> 'username', ''));
  display  text := btrim(coalesce(meta ->> 'display_name', meta ->> 'username', meta ->> 'full_name', meta ->> 'name', ''));
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

  -- Display names are plain text: drop control characters a provider might send.
  display := btrim(regexp_replace(display, '[[:cntrl:]]', '', 'g'));
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
