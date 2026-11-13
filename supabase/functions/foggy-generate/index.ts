/**
 * Supabase Edge Function: Foggy (AI content helper). Writes one draft with Gemini and keeps it in public.foggy_content.
 *
 * Setup (site owner, once):
 *   1. Gemini key as a server secret (never in the frontend or in Git):
 *        Supabase Dashboard → Edge Functions → Secrets → GEMINI_API_KEY      or   supabase secrets set GEMINI_API_KEY=...
 *      Optional: GEMINI_MODEL (default gemini-2.5-flash), FOGGY_DAILY_FOGGIE (default 20), FOGGY_DAILY_FOGGIE_PLUS (default 60).
 *   2. supabase functions deploy foggy-generate
 *   3. The owner's switch, app_flags 'foggy', is turned on by migration 20261118120100_foggy_on.sql (turn it off in SQL to pause).
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
 *
 * Flow: verify the user → validate → access from the database AS THE CALLER (plan, switch, campaign ownership) → daily cap →
 * context (campaign / adventure the caller can read, through RLS) → Gemini → parseGenerated → insert with the service role.
 * The key and the prompt are never logged.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { MAX_BODY_BYTES, validateRequest, decide, dailyLimit, geminiRequest, parseGenerated, type Access } from './core.ts';

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
// A short burst guard per instance, on top of the daily cap kept in the database.
const recent = new Map<string, number[]>();
function burstOk(uid: string) {
  const now = Date.now();
  const list = (recent.get(uid) || []).filter((t) => now - t < 60_000);
  if (list.length >= 5) return false;
  list.push(now);
  recent.set(uid, list);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in to use Foggy.', code: 'auth' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return reply(401, { error: 'Sign in to use Foggy.', code: 'auth' });
  const uid = userData.user.id;

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large.', code: 'too_large' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });
  const r = v.request;

  // Access is decided by the database from the caller's plan (and the owner's switch), as the caller.
  const acc = await supabase.rpc('foggy_access', { p_campaign: r.campaignId });
  const access = acc.error ? null : (acc.data as Access);
  const key = Deno.env.get('GEMINI_API_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const admin = serviceKey ? createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } }) : null;

  let used = 0;
  const limit = dailyLimit(access?.tier ?? null, Deno.env.toObject());
  if (admin && access?.canGenerate) {
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const c = await admin.from('foggy_content').select('id', { count: 'exact', head: true }).eq('owner_id', uid).gte('created_at', since.toISOString());
    used = c.count || 0;
  }
  const d = decide(r, access, !!key && !!admin, used, limit);
  if (d.code !== 'generate') return reply(d.status, { error: d.message, code: d.code, generated: false });
  if (!burstOk(uid)) return reply(429, { error: 'Foggy is still thinking about your last requests. Try again in a minute.', code: 'busy', generated: false });

  // Context the caller is allowed to read (RLS): their campaign, their adventure.
  const context: { campaignName?: string | null; campaignSummary?: string | null; adventureTitle?: string | null } = {};
  if (r.campaignId) {
    const c = await supabase.from('campaigns').select('name, description').eq('id', r.campaignId).maybeSingle();
    if (c.data) { context.campaignName = c.data.name; context.campaignSummary = String(c.data.description || '').slice(0, 600) || null; }
  }
  if (r.adventureId) {
    const a = await supabase.from('adventures').select('title').eq('id', r.adventureId).maybeSingle();
    if (!a.data) return reply(404, { error: 'That adventure wasn’t found.', code: 'bad_request', generated: false });
    context.adventureTitle = a.data.title;
  }

  let draft: ReturnType<typeof parseGenerated> = null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiRequest(r, context)),
      signal: AbortSignal.timeout(40_000),
    });
    if (res.status === 429) return reply(429, { error: 'The AI service is busy. Try again in a little while.', code: 'busy', generated: false });
    if (!res.ok) {
      console.error('foggy-generate: Gemini status', res.status);
      return reply(502, { error: 'The AI service returned an error. Nothing was saved.', code: 'ai_error', generated: false });
    }
    draft = parseGenerated(r.kind, await res.json());
  } catch (e) {
    console.error('foggy-generate:', e instanceof Error ? e.name : 'error');
    return reply(502, { error: 'The AI service could not answer in time. Nothing was saved.', code: 'ai_error', generated: false });
  }
  if (!draft) return reply(502, { error: 'Foggy’s answer couldn’t be read. Try rephrasing. Nothing was saved.', code: 'ai_error', generated: false });

  const ins = await admin!.from('foggy_content').insert({
    owner_id: uid, scope: r.scope, campaign_id: r.campaignId, kind: r.kind, title: draft.title, body: draft.body, prompt: r.prompt, model: MODEL,
  }).select('id, scope, campaign_id, kind, title, body, prompt, status, saved_to, created_at').single();
  if (ins.error) {
    console.error('foggy-generate: insert failed', ins.error.code);
    return reply(500, { error: 'The draft was written but couldn’t be saved. Try again.', code: 'error', generated: false });
  }
  return reply(200, { generated: true, draft: ins.data, remainingToday: Math.max(0, limit - used - 1) });
});
