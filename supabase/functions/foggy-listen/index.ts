/**
 * Supabase Edge Function: foggy-listen — advanced Foggy (Fogger of the Dragons, the campaign's DM): one short audio chunk in,
 * { transcript, cueId, confidence } out. The audio and the transcript are NOT stored or logged.
 * Secrets: GEMINI_API_KEY; optional FOGGY_AUDIO_MODEL (default: GEMINI_MODEL, then gemini-2.5-flash-lite — it accepts audio),
 * FOGGY_DAILY_AUDIO_CHUNKS (default 1500, about 3 hours of 8-second chunks). Deploy: supabase functions deploy foggy-listen --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { callGemini, cleanKey } from '../_shared/gemini.ts';
import { validateRequest, listenRequest, parseListen } from './core.ts';

const MODEL = (Deno.env.get('FOGGY_AUDIO_MODEL') || Deno.env.get('GEMINI_MODEL') || '').trim() || 'gemini-2.5-flash-lite';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in first.', code: 'auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud, error: ue } = await user.auth.getUser(token);
  if (ue || !ud?.user) return reply(401, { error: 'Sign in first.', code: 'auth' });
  const uid = ud.user.id;

  let body: unknown;
  try { body = JSON.parse(await request.text()); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });

  const acc = await user.rpc('foggy_access', { p_campaign: v.campaignId });
  const access = acc.error ? null : acc.data as { tier: string | null; enabled: boolean; campaign: boolean };
  if (!access) return reply(503, { error: 'Foggy isn’t set up on the server yet.', code: 'not_set_up' });
  if (!access.campaign || access.tier !== 'foggie_plus') return reply(403, { error: 'Listening is part of Foggie+ (Fogger of the Dragons), for the Dungeon Master of this campaign.', code: 'plan' });
  if (!access.enabled) return reply(503, { error: 'Foggy isn’t switched on yet.', code: 'not_enabled' });
  const key = cleanKey(Deno.env.get('GEMINI_API_KEY'));
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!key || !serviceKey) return reply(503, { error: 'Listening needs the Gemini key on the server.', code: 'not_configured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const limit = Number.isInteger(Number(Deno.env.get('FOGGY_DAILY_AUDIO_CHUNKS'))) ? Number(Deno.env.get('FOGGY_DAILY_AUDIO_CHUNKS')) : 1500;
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const used = (await admin.from('foggy_usage').select('id', { count: 'exact', head: true }).eq('owner_id', uid).eq('kind', 'audio').gte('created_at', since.toISOString())).count || 0;
  if (used >= limit) return reply(429, { error: 'Today’s listening limit is used up. Music stays manual until midnight UTC.', code: 'daily_limit' });

  const g = await callGemini(key, MODEL, listenRequest(v.audio, v.cues, v.recent), 30_000, 1024);
  await admin.from('foggy_usage').insert({ owner_id: uid, kind: 'audio' });
  if (!g.ok) return reply(g.status === 429 ? 429 : 502, { error: g.message, code: g.code });
  const out = parseListen(g.json, v.cues);
  if (!out) return reply(502, { error: 'The speech couldn’t be understood.', code: 'ai_error' });
  return reply(200, { ok: true, ...out });
});
