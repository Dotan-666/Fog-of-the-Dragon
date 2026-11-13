/**
 * Supabase Edge Function: meeting-fog — join tokens for Meeting in the Fog (LiveKit), minted only after the database has
 * checked the caller (public.meeting_join_grant, called WITH the caller's session: active member or DM, active campaign,
 * open room). Media never passes through here or through Supabase.
 *
 * Secrets (server only — never in the frontend, never in Git):
 *   LIVEKIT_URL         wss://<your-project>.livekit.cloud   (or your own LiveKit server)
 *   LIVEKIT_API_KEY     the API key
 *   LIVEKIT_API_SECRET  the API secret
 *   Supabase Dashboard → Edge Functions → Secrets, or:  supabase secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
 * Deploy: supabase functions deploy meeting-fog
 *
 * Actions:  { action: 'status' }              → { configured }
 *           { action: 'join', roomId }        → { token, url, expiresAt, room }   (token valid 15 minutes)
 *           { action: 'close', roomId }       → DM only: closes the room in the database, then ends it on LiveKit
 * Tokens and secrets are never logged. Recording is never enabled (no egress is ever started; tokens can't record).
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { AccessToken, RoomServiceClient, TrackSource } from 'npm:livekit-server-sdk@2.19.2';
import { MAX_BODY_BYTES, TOKEN_TTL_SECONDS, validateRequest, providerConfig, apiHost, tokenGrant, tokenIdentity, type Grant } from './core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in first.', code: 'auth' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u, error: ue } = await supabase.auth.getUser(token);
  if (ue || !u?.user) return reply(401, { error: 'Sign in first.', code: 'auth' });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large.', code: 'too_large' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });

  const cfg = providerConfig(Deno.env.toObject());
  if (v.action === 'status') return reply(200, { configured: !!cfg });
  if (!cfg) return reply(503, { error: 'Video meetings aren’t set up on the server yet.', code: 'not_configured' });

  if (v.action === 'close') {
    const c = await supabase.rpc('close_meeting_room', { p_room: v.roomId });
    if (c.error) return reply(c.error.code === '42501' ? 403 : 400, { error: c.error.message, code: 'refused' });
    const room = await supabase.from('meeting_rooms').select('provider_room').eq('id', v.roomId).maybeSingle();
    if (room.data?.provider_room) {
      try { await new RoomServiceClient(apiHost(cfg.url), cfg.apiKey, cfg.apiSecret).deleteRoom(room.data.provider_room); }
      catch { /* the room may not exist on LiveKit (nobody connected): closed in the database is what matters */ }
    }
    return reply(200, { closed: true });
  }

  // join: the database decides (membership, archived campaign, open room) and records the participant once.
  const g = await supabase.rpc('meeting_join_grant', { p_room: v.roomId });
  if (g.error) {
    const msg = /archived/.test(g.error.message) ? 'This campaign is archived.' : /isn't open/.test(g.error.message) ? 'The room isn’t open.' : 'Room not found.';
    return reply(g.error.code === '42501' ? 404 : 409, { error: msg, code: g.error.code === '42501' ? 'not_found' : 'not_open' });
  }
  const grant = g.data as Grant;
  try {
    const at = new AccessToken(cfg.apiKey, cfg.apiSecret, tokenIdentity(grant));
    const vg = tokenGrant(grant);
    at.addGrant({ ...vg, canPublishSources: vg.canPublishSources.map((x) => (x === 'camera' ? TrackSource.CAMERA : TrackSource.MICROPHONE)) });
    const jwt = await at.toJwt();
    return reply(200, {
      token: jwt, url: cfg.url, expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
      room: { id: grant.roomId, campaignId: grant.campaignId, title: grant.title, role: grant.role, provider: grant.provider },
    });
  } catch (e) {
    console.error('meeting-fog: token error', e instanceof Error ? e.name : 'error');
    return reply(500, { error: 'Could not prepare the call. Try again.', code: 'error' });
  }
});
