-- =============================================================================
-- Foggy: generation switched on.
-- The Edge Function foggy-generate now writes drafts with Gemini. It still refuses (clear message, nothing generated) until
-- the Gemini key is set as a server secret:  Supabase Dashboard → Edge Functions → Secrets → GEMINI_API_KEY
-- (or: supabase secrets set GEMINI_API_KEY=...), and the function is deployed (supabase functions deploy foggy-generate).
-- Plans still decide who may use it (private.foggy_access). To pause Foggy for everyone:
--   update public.app_flags set enabled = false where key = 'foggy';
-- Run after 20261116120000_foggy.sql. Safe to run again (running it again switches Foggy back on).
-- =============================================================================

do $$
begin
  if to_regclass('public.app_flags') is null or to_regclass('public.foggy_content') is null then
    raise exception 'Run 20261116120000_foggy.sql first.';
  end if;
end;
$$;

insert into public.app_flags (key, enabled, note)
values ('foggy', true, 'AI generation (Edge Function foggy-generate, Gemini key in the server secret GEMINI_API_KEY).')
on conflict (key) do update set enabled = true, note = excluded.note, updated_at = now();
