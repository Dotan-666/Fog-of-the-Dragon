/**
 * Supabase Edge Function: scheduler background tick (fallback when pg_cron is not available).
 *
 * Runs the availability scheduler's background work for every campaign (deadlines, suggestions, reminders, expiry):
 * public.run_schedule_processing(), which only the service role may call. Everything it does is idempotent, so being
 * called twice, late or by two schedulers at once does no harm.
 *
 * Secrets (provided by the Edge runtime): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Set one more yourself so that only
 * your scheduler can trigger it:   supabase secrets set SCHEDULER_TICK_SECRET=<a long random string>
 * Deploy:  supabase functions deploy scheduler-tick --no-verify-jwt
 * Call it every 10 minutes from any scheduler (for example a GitHub Actions cron or cron-job.org) with the header
 *   Authorization: Bearer <SCHEDULER_TICK_SECRET>
 * Not needed when migration 20261117120100_scheduler_background.sql reported that the pg_cron job is scheduled.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Constant-time comparison, so the secret can't be guessed from response timing. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const secret = Deno.env.get('SCHEDULER_TICK_SECRET') || '';
  const given = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret.length < 24 || !same(given, secret)) return reply(401, { error: 'Not allowed.' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('run_schedule_processing');
  if (error) return reply(500, { error: error.message });
  return reply(200, { ok: true, result: data });
});
