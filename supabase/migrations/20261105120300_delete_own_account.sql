-- =============================================================================
-- Fog of the Dragon — 004: let a signed-in user delete their own account
--
-- Used by Settings → Delete Account. Deletes only the calling user (auth.uid());
-- their profile, owned campaigns and memberships are removed by ON DELETE CASCADE.
-- The app removes the user's avatar files from Storage before calling this.
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is 'Deletes the calling user''s own account. Callable only by signed-in users.';
