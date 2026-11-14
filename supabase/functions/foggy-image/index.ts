/**
 * Supabase Edge Function: foggy-image — Foggy's pictures and maps. Text models can't make image files: this uses an image
 * model (Gemini image generation through generateContent) and stores the file in the private bucket "foggy-images".
 *
 * Secrets: GEMINI_API_KEY (same key; image output usually needs a paid Gemini API plan), optional FOGGY_IMAGE_MODEL
 * (default gemini-2.5-flash-image), FOGGY_IMAGE_PROVIDER (only "gemini" exists), FOGGY_DAILY_IMAGES_FOGGIE (default 10),
 * FOGGY_DAILY_IMAGES_FOGGIE_PLUS (default 40). Deploy: supabase functions deploy foggy-image --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { cleanKey, explainError, badField } from '../_shared/gemini.ts';
import { KINDS, validateRequest, buildPrompt, geminiImageBody, pickImage } from './core.ts';

const MODEL = (Deno.env.get('FOGGY_IMAGE_MODEL') || '').trim() || 'gemini-2.5-flash-image';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The image provider (interface: generate → bytes). */
async function geminiProvider(key: string, prompt: string, aspect: string) {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(geminiImageBody(prompt, aspect)), signal: AbortSignal.timeout(90_000),
    });
  } catch { return { ok: false as const, status: 504, code: 'ai_error', message: 'The image service took too long. Try again.' }; }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = explainError(res.status, text);
    console.error('foggy-image: provider', res.status, e.code, badField(text));
    const quota = e.code === 'busy' ? ' Image generation usually needs a paid Gemini API plan (the free tier may allow none).' : '';
    return { ok: false as const, status: res.status, code: e.code, message: e.message + quota + (e.code === 'bad_model' ? ' Set FOGGY_IMAGE_MODEL to an image model, for example gemini-3.1-flash-image.' : '') };
  }
  const picked = pickImage(await res.json().catch(() => null));
  if (!picked.ok) return { ok: false as const, status: 422, code: 'no_image', message: picked.reason };
  return { ok: true as const, bytes: b64ToBytes(picked.data), mime: picked.mime };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in to use Foggy.', code: 'auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ud, error: ue } = await user.auth.getUser(token);
  if (ue || !ud?.user) return reply(401, { error: 'Sign in to use Foggy.', code: 'auth' });
  const uid = ud.user.id;

  let body: unknown;
  try { body = JSON.parse((await request.text()).slice(0, 10_000)); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });
  const r = v.req;

  const acc = await user.rpc('foggy_access', { p_campaign: r.campaignId });
  const access = acc.error ? null : acc.data as { tier: string | null; enabled: boolean; dashboard: boolean; campaign: boolean };
  if (!access) return reply(503, { error: 'Foggy isn’t set up on the server yet.', code: 'not_set_up' });
  if (r.scope === 'dashboard' ? !access.dashboard : !access.campaign) return reply(403, { error: r.scope === 'campaign' ? 'Campaign Foggy is part of the Fogger of the Dragons plan.' : 'Foggy is part of the Dungeon Master and Fogger of the Dragons plans.', code: 'plan' });
  if (!access.enabled) return reply(503, { error: 'Foggy isn’t switched on yet.', code: 'not_enabled' });
  if ((Deno.env.get('FOGGY_IMAGE_PROVIDER') || 'gemini') !== 'gemini') return reply(503, { error: 'The configured image provider isn’t supported.', code: 'not_configured' });
  const key = cleanKey(Deno.env.get('GEMINI_API_KEY'));
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!key || !serviceKey) return reply(503, { error: 'Foggy has no AI key on the server yet.', code: 'not_configured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const n = (s: string | undefined, d: number) => { const x = Number(s); return Number.isInteger(x) && x >= 0 ? x : d; };
  const limit = access.tier === 'foggie_plus' ? n(Deno.env.get('FOGGY_DAILY_IMAGES_FOGGIE_PLUS'), 40) : n(Deno.env.get('FOGGY_DAILY_IMAGES_FOGGIE'), 10);
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const used = (await admin.from('foggy_usage').select('id', { count: 'exact', head: true }).eq('owner_id', uid).eq('kind', 'image').gte('created_at', since.toISOString())).count || 0;
  if (used >= limit) return reply(429, { error: `You’ve reached today’s picture limit (${limit}). It resets at midnight UTC.`, code: 'daily_limit' });

  const gen = await geminiProvider(key, buildPrompt(r), KINDS[r.kind].aspect);
  await admin.from('foggy_usage').insert({ owner_id: uid, kind: 'image' });
  if (!gen.ok) return reply(gen.status === 429 ? 429 : 502, { error: gen.message, code: gen.code });

  const id = crypto.randomUUID();
  const ext = gen.mime === 'image/jpeg' ? 'jpg' : gen.mime === 'image/webp' ? 'webp' : 'png';
  const path = `${uid}/${id}.${ext}`;
  const up = await admin.storage.from('foggy-images').upload(path, gen.bytes, { contentType: gen.mime, upsert: false });
  if (up.error) { console.error('foggy-image: upload failed'); return reply(500, { error: 'The picture was made but couldn’t be stored. Is migration 20261119120000_foggy_assistant.sql applied?', code: 'error' }); }
  const ins = await admin.from('foggy_images').insert({
    id, owner_id: uid, scope: r.scope, campaign_id: r.campaignId, kind: r.kind, playable: !!KINDS[r.kind].playable, grid: r.grid, title: r.title, prompt: r.prompt, path, mime: gen.mime, model: MODEL,
  }).select('*').single();
  if (ins.error) return reply(500, { error: 'The picture couldn’t be recorded.', code: 'error' });
  const signed = await admin.storage.from('foggy-images').createSignedUrl(path, 3600);
  return reply(200, { ok: true, image: ins.data, url: signed.data?.signedUrl || null, remainingToday: Math.max(0, limit - used - 1) });
});
