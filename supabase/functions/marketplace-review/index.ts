/**
 * Supabase Edge Function: marketplace-review — Gemini's first opinion on a listing waiting for review.
 *
 * Who may call it: the listing's creator (right after submitting; the app does this) or a marketplace moderator ("Ask
 * Gemini again"). The verdict is stored in public.marketplace_ai_reviews (moderators read it). With review_mode 'ai_auto'
 * a low-risk approval of a fully inspected, unreported listing is published through public.ai_publish_listing; anything
 * else waits for a human. With 'manual' nothing is sent to Gemini.
 *
 * Secrets: GEMINI_API_KEY (the same key as Foggy), optional GEMINI_REVIEW_MODEL (default gemini-2.5-flash).
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
 * Deploy: supabase functions deploy marketplace-review
 * Listing content, files and the key are never logged.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { MAX_BODY_BYTES, MAX_INLINE_BYTES, validateRequest, dossier, geminiRequest, parseVerdict, mayAutoPublish, planFiles, type Listing, type InlinePart } from './core.ts';

const MODEL = Deno.env.get('GEMINI_REVIEW_MODEL') || 'gemini-2.5-flash';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function encodeBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in first.', code: 'auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await user.auth.getUser(token);
  if (ue || !u?.user) return reply(401, { error: 'Sign in first.', code: 'auth' });
  const uid = u.user.id;

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large.', code: 'too_large' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return reply(503, { error: 'The reviewer isn’t set up on the server.', code: 'not_set_up' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: l, error: le } = await admin.from('marketplace_listings').select('*').eq('id', v.listingId).maybeSingle();
  if (le || !l) return reply(404, { error: 'Listing not found.', code: 'not_found' });
  const listing = l as Listing;
  const isMod = !!(await admin.from('marketplace_moderators').select('user_id').eq('user_id', uid).maybeSingle()).data;
  if (listing.creator_id !== uid && !isMod) return reply(403, { error: 'Only the creator or a moderator can ask for a review.', code: 'forbidden' });
  if (listing.status !== 'pending_review') return reply(409, { error: 'This listing isn’t waiting for review.', code: 'not_pending' });

  const settings = (await admin.from('marketplace_settings').select('review_mode').maybeSingle()).data;
  const mode = settings?.review_mode || 'ai_assist';
  if (mode === 'manual') return reply(200, { reviewed: false, mode, message: 'Listings are reviewed by moderators only.' });

  // One review per version of the listing; a moderator may ask again. The creator never gets the verdict itself.
  const existing = (await admin.from('marketplace_ai_reviews').select('*').eq('listing_id', listing.id).maybeSingle()).data;
  const sameVersion = existing && new Date(existing.listing_version).getTime() === new Date(listing.updated_at).getTime();
  if (sameVersion && !(isMod && v.force)) return reply(200, isMod ? { reviewed: true, cached: true, mode, review: existing } : { reviewed: true, mode, autoPublished: !!existing.auto_published });
  if (existing && !isMod && Date.now() - new Date(existing.created_at).getTime() < 120_000) return reply(429, { error: 'A review just ran. Try again in a couple of minutes.', code: 'busy' });

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return reply(503, { error: 'The AI reviewer has no Gemini key on the server yet; a moderator will review this listing.', code: 'not_configured' });

  // Gather what Gemini can inspect: text files as text, images and PDFs inline (within a size budget).
  const plan = planFiles(listing);
  const skipped = [...plan.skipped];
  const textFiles: { name: string; text: string }[] = [];
  for (const f of plan.text.slice(0, 6)) {
    const d = await admin.storage.from('marketplace').download(f.path);
    if (d.error || !d.data) { skipped.push(f.name); continue; }
    textFiles.push({ name: f.name, text: (await d.data.text()).slice(0, 20_000) });
  }
  const inline: InlinePart[] = [];
  let used = 0;
  for (const f of plan.inline) {
    const d = await admin.storage.from('marketplace').download(f.path);
    if (d.error || !d.data) { skipped.push(f.name); continue; }
    const bytes = new Uint8Array(await d.data.arrayBuffer());
    if (used + bytes.length > MAX_INLINE_BYTES) { skipped.push(f.name); continue; }
    used += bytes.length;
    inline.push({ mimeType: f.mimeType, data: encodeBase64(bytes) });
  }
  let text = dossier(listing, textFiles);
  if (skipped.length) text += `\n\nNot attached (too large or unreadable, so not checked): ${skipped.join(', ')}`;

  let verdict = null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiRequest(text, inline)),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) {
      console.error('marketplace-review: Gemini status', res.status);
      return reply(502, { error: 'The AI reviewer couldn’t answer; a moderator will review this listing.', code: 'ai_error' });
    }
    verdict = parseVerdict(await res.json());
  } catch (e) {
    console.error('marketplace-review:', e instanceof Error ? e.name : 'error');
    return reply(502, { error: 'The AI reviewer couldn’t answer in time; a moderator will review this listing.', code: 'ai_error' });
  }
  if (!verdict) return reply(502, { error: 'The AI reviewer’s answer couldn’t be read; a moderator will review this listing.', code: 'ai_error' });

  const inspected = { complete: skipped.length === 0, skipped, images: inline.filter((p) => p.mimeType.startsWith('image/')).length, pdfs: inline.filter((p) => p.mimeType === 'application/pdf').length, textFiles: textFiles.length };
  const row = {
    listing_id: listing.id, listing_version: listing.updated_at, decision: verdict.decision, risk: verdict.risk, summary: verdict.summary,
    reasons: verdict.reasons, suggested_note: verdict.suggestedNote, inspected, model: MODEL, auto_published: false, requested_by: uid, created_at: new Date().toISOString(),
  };
  const up = await admin.from('marketplace_ai_reviews').upsert(row, { onConflict: 'listing_id' });
  if (up.error) { console.error('marketplace-review: save failed', up.error.code); return reply(500, { error: 'The review couldn’t be saved.', code: 'error' }); }

  let autoPublished = false;
  const reports = (await admin.from('marketplace_reports').select('id', { count: 'exact', head: true }).eq('listing_id', listing.id).eq('status', 'open')).count || 0;
  if (mayAutoPublish(mode, verdict, inspected.complete, reports)) {
    const p = await admin.rpc('ai_publish_listing', { p_id: listing.id, p_version: listing.updated_at });
    autoPublished = p.data === true;
  }
  return reply(200, isMod ? { reviewed: true, mode, autoPublished, review: { ...row, auto_published: autoPublished } } : { reviewed: true, mode, autoPublished });
});
