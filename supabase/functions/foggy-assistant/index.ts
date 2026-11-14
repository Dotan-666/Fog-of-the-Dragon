/**
 * Supabase Edge Function: foggy-assistant — Foggy's chat, adventure writing, structured generation, music cue sheets and
 * combat suggestions (see core.ts). Gemini is called only here, with the server secret GEMINI_API_KEY.
 *
 * Every request: verify the user → validate → access from the database AS THE CALLER (plan, switch, campaign) → daily cap →
 * context the caller is allowed to read (RLS: their campaign, their adventure) → Gemini → parse and validate → store the
 * conversation (service role) → answer. Nothing here changes adventures, homebrew or combat: the app applies what the user
 * approves through the existing stores. Prompts, answers and the key are never logged.
 *
 * Secrets: GEMINI_API_KEY; optional GEMINI_MODEL (default gemini-2.5-flash-lite), FOGGY_DAILY_TEXT_FOGGIE (default 150),
 * FOGGY_DAILY_TEXT_FOGGIE_PLUS (default 500). Deploy: supabase functions deploy foggy-assistant --no-verify-jwt
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { callGemini, cleanKey } from '../_shared/gemini.ts';
import {
  MAX_BODY_BYTES, validateRequest, clean, chatRequest, parseChat, adventureRequest, parseAdventure, generateRequest, parseGenerated,
  catalogFrom, musicRequest, parseMusic, combatFrom, combatRequest, parseCombat, prepFrom, prepareRequest, parsePrepare, recapFrom, recapRequest, parseRecap,
  type Context, type Req,
} from './core.ts';

const MODEL = (Deno.env.get('GEMINI_MODEL') || '').trim() || 'gemini-2.5-flash-lite';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
interface Access { plan: string; tier: string | null; enabled: boolean; dashboard: boolean; campaign: boolean; canGenerate: boolean }

function cap(tier: string | null): number {
  const n = (v: string | undefined, d: number) => { const x = Number(v); return Number.isInteger(x) && x >= 0 ? x : d; };
  if (tier === 'foggie_plus') return n(Deno.env.get('FOGGY_DAILY_TEXT_FOGGIE_PLUS'), 500);
  if (tier === 'foggie') return n(Deno.env.get('FOGGY_DAILY_TEXT_FOGGIE'), 150);
  return 0;
}

/** What Foggy may know, read WITH THE CALLER's session (Row Level Security decides). */
async function buildContext(user: SupabaseClient, r: Req, isDm: boolean) {
  const ctx: Context = {};
  const editable: string[] = [];
  const placeIds: string[] = [];
  let places = '';
  let adventureId = r.adventureId;
  if (r.campaignId) {
    const c = await user.from('campaigns').select('name, description, starting_level, adventure_id, owner_id, status').eq('id', r.campaignId).maybeSingle();
    if (!c.data) return null;
    ctx.campaign = `${c.data.name} (starting level ${c.data.starting_level}, ${c.data.status})\n${String(c.data.description || '').slice(0, 1500)}`;
    if (!adventureId && isDm) adventureId = c.data.adventure_id;
    const m = await user.from('campaign_members').select('role, character_name, character_data').eq('campaign_id', r.campaignId).eq('status', 'active');
    if (m.data) ctx.party = m.data.filter((x) => x.role === 'player').map((x) => {
      const ch = (x.character_data || {}) as { choices?: { classId?: string; level?: number; speciesId?: string } };
      return `- ${x.character_name || 'Unnamed character'}${ch.choices ? ` (level ${ch.choices.level || '?'} ${ch.choices.speciesId || ''} ${ch.choices.classId || ''})` : ''}`;
    }).join('\n');
    if (isDm) {
      const mem = await user.from('campaign_memories').select('kind, title, content, occurred_on').eq('campaign_id', r.campaignId).order('created_at', { ascending: false }).limit(12);
      if (mem.data?.length) ctx.logbook = mem.data.map((x) => `- [${x.kind}] ${x.title}: ${String(x.content || '').slice(0, 400)}`).join('\n');
    }
  }
  if (adventureId) {
    const a = await user.from('adventures').select('id, title, description, content').eq('id', adventureId).maybeSingle();
    if (a.data) {
      const content = (a.data.content || {}) as { chapters?: { id: string; title: string; summary?: string; dmNotes?: string; sections?: { id: string; kind: string; title: string; playerText?: string; dmNotes?: string }[] }[] };
      const lines: string[] = [`${a.data.title}: ${String(a.data.description || '').slice(0, 800)}`];
      for (const ch of (content.chapters || []).slice(0, 40)) {
        lines.push(`### ${ch.title}\n${String(ch.summary || '').slice(0, 600)}${ch.dmNotes ? '\nDM notes: ' + String(ch.dmNotes).slice(0, 400) : ''}`);
        placeIds.push(ch.id);
        places += `${ch.id}: chapter "${ch.title}"\n`;
        for (const s of (ch.sections || []).slice(0, 40)) {
          lines.push(`- (${s.kind}) ${s.title}: ${String(s.playerText || '').slice(0, 300)}`);
          editable.push(`${s.id}: ${s.kind} "${s.title}" in "${ch.title}"`);
          placeIds.push(s.id);
          places += `${s.id}: ${s.kind} "${s.title}"\n`;
        }
      }
      ctx.adventure = lines.join('\n').slice(0, 40_000);
    } else if (r.adventureId) return null;
  }
  return { ctx, editable, placeIds, places, adventureId };
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

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: 'Request too large.', code: 'too_large' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON.', code: 'bad_request' }); }
  const v = validateRequest(body);
  if (!v.ok) return reply(400, { error: v.error, code: 'bad_request' });
  const r = v.req;

  // Access (as the caller). Combat help: any Foggy plan, for a member of that campaign (players get player-level help).
  const acc = await user.rpc('foggy_access', { p_campaign: r.action === 'combat' ? null : r.campaignId });
  const access = acc.error ? null : (acc.data as Access);
  if (!access) return reply(503, { error: 'Foggy isn’t set up on the server yet.', code: 'not_set_up' });
  if (!access.dashboard) return reply(403, { error: 'Foggy is part of the Dungeon Master and Fogger of the Dragons plans.', code: 'plan' });
  if (r.scope === 'campaign' && r.action !== 'combat' && !access.campaign) return reply(403, { error: 'Campaign Foggy is part of the Fogger of the Dragons plan, for the Dungeon Master of an active campaign.', code: 'plan' });
  if (!access.enabled) return reply(503, { error: 'Foggy isn’t switched on yet.', code: 'not_enabled' });
  const key = cleanKey(Deno.env.get('GEMINI_API_KEY'));
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!key || !serviceKey) return reply(503, { error: 'Foggy has no AI key on the server yet.', code: 'not_configured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const used = (await admin.from('foggy_usage').select('id', { count: 'exact', head: true }).eq('owner_id', uid).eq('kind', 'text').gte('created_at', since.toISOString())).count || 0;
  const limit = cap(access.tier);
  if (used >= limit) return reply(429, { error: `You’ve reached today’s Foggy limit (${limit} requests). It resets at midnight UTC.`, code: 'daily_limit' });

  let isDm = false;
  if (r.campaignId) {
    const c = await user.from('campaigns').select('owner_id').eq('id', r.campaignId).maybeSingle();
    if (!c.data) return reply(404, { error: 'Campaign not found.', code: 'not_found' });
    isDm = c.data.owner_id === uid;
  }
  if ((r.action === 'prepare' || r.action === 'recap') && !isDm) return reply(403, { error: 'Only the campaign’s Dungeon Master can do this.', code: 'forbidden' });
  const built = await buildContext(user, r, isDm);
  if (!built) return reply(404, { error: 'That campaign or adventure wasn’t found.', code: 'not_found' });

  // Conversation (chat / adventure / generate)
  let threadId = r.threadId;
  let history: { role: string; content: string }[] = [];
  if (r.action !== 'combat' && r.action !== 'music_plan' && r.action !== 'prepare' && r.action !== 'recap') {
    if (threadId) {
      const t = await admin.from('foggy_threads').select('id, owner_id, workspace').eq('id', threadId).maybeSingle();
      if (!t.data || t.data.owner_id !== uid) return reply(404, { error: 'Conversation not found.', code: 'not_found' });
      if (t.data.workspace) built.ctx.workspace = JSON.stringify(t.data.workspace).slice(0, 30_000);
      const h = await admin.from('foggy_messages').select('role, content').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(16);
      history = (h.data || []).reverse();
    } else {
      const t = await admin.from('foggy_threads').insert({ owner_id: uid, scope: r.scope, campaign_id: r.scope === 'campaign' ? r.campaignId : null, mode: r.action === 'adventure' ? 'adventure' : 'chat', title: (r.message || clean(r.payload.idea, 80) || 'New conversation').slice(0, 60) }).select('id').single();
      if (t.error) return reply(500, { error: 'The conversation couldn’t be started.', code: 'error' });
      threadId = t.data.id;
    }
  }

  // Build the Gemini request
  let gem: Record<string, unknown>;
  let combatState = null;
  let catalog = null;
  let prepInv = null;
  if (r.action === 'chat') gem = chatRequest(history, r.message, built.ctx, built.editable);
  else if (r.action === 'adventure') gem = adventureRequest(r.step, r.payload, built.ctx, history.slice(-6));
  else if (r.action === 'generate') gem = generateRequest(String(r.payload.kind), r.message, built.ctx, history.slice(-6));
  else if (r.action === 'music_plan') {
    if (!built.adventureId || !built.places) return reply(400, { error: 'Choose an adventure with chapters first.', code: 'bad_request' });
    catalog = catalogFrom(r.payload.catalog);
    if (!catalog.length) return reply(400, { error: 'The music library is empty.', code: 'bad_request' });
    gem = musicRequest(built.ctx, catalog, built.places);
  } else if (r.action === 'prepare') {
    prepInv = prepFrom(r.payload.inventory);
    // Sections must belong to the campaign's adventure (checked here against the database, not trusted from the browser).
    if (prepInv) prepInv.items = prepInv.items.filter((i) => i.kind !== 'section' || built.placeIds.includes(i.id));
    if (!prepInv || !prepInv.items.length) return reply(400, { error: 'Nothing was found to prepare from yet.', code: 'bad_request' });
    gem = prepareRequest(prepInv, built.ctx);
  } else if (r.action === 'recap') {
    const rin = recapFrom(r.payload.session);
    if (!rin) return reply(400, { error: 'Write some session notes (or finish an encounter) first: Foggy only works from what happened.', code: 'bad_request' });
    gem = recapRequest(rin, built.ctx);
  } else {
    combatState = combatFrom(r.payload.state);
    if (!combatState || !combatState.actor.actions.length) return reply(400, { error: 'There is no combatant with actions to advise on.', code: 'bad_request' });
    gem = combatRequest(combatState, r.message, !isDm);
  }

  const g = await callGemini(key, MODEL, gem, 60_000, r.action === 'adventure' ? 8192 : 4096);
  await admin.from('foggy_usage').insert({ owner_id: uid, kind: 'text' });
  if (!g.ok) return reply(g.status === 429 ? 429 : 502, { error: g.message, code: g.code });

  // Parse and validate
  let result: Record<string, unknown> | null = null;
  let text = '';
  if (r.action === 'chat') {
    const c = parseChat(g.json, built.editable.map((e) => e.split(':')[0]));
    if (c) { result = c as unknown as Record<string, unknown>; text = c.reply; }
  } else if (r.action === 'adventure') {
    result = parseAdventure(r.step, g.json);
    text = r.step === 'questions' ? ((result?.questions as string[]) || []).join('\n') : r.step === 'outline' ? 'Proposed outline: ' + (result?.title || '') : 'Wrote: ' + (result?.title || '');
  } else if (r.action === 'generate') {
    result = parseGenerated(g.json);
    text = result ? 'Made a ' + r.payload.kind + ': ' + clean(result.name, 100) : '';
  } else if (r.action === 'music_plan') {
    result = parseMusic(g.json, catalog!, built.placeIds) as unknown as Record<string, unknown>;
  } else if (r.action === 'prepare') {
    result = parsePrepare(g.json, prepInv!) as unknown as Record<string, unknown>;
  } else if (r.action === 'recap') {
    result = parseRecap(g.json) as unknown as Record<string, unknown>;
  } else {
    result = parseCombat(g.json, combatState!) as unknown as Record<string, unknown>;
  }
  if (!result) return reply(502, { error: g.finishReason === 'MAX_TOKENS' ? 'Foggy’s answer was too long and got cut off. Ask for less at once.' : 'Foggy’s answer couldn’t be read. Try again.', code: 'ai_error' });

  // Store the conversation and drafts (service role; the user can read, delete and save them)
  const drafts: unknown[] = [];
  if (threadId) {
    const userText = r.message || clean(r.payload.idea, 4000) || clean(r.payload.instruction, 2000) || `(${r.action} ${r.step})`;
    await admin.from('foggy_messages').insert([
      { thread_id: threadId, owner_id: uid, role: 'user', content: userText.slice(0, 20000), data: { action: r.action, step: r.step || null } },
      { thread_id: threadId, owner_id: uid, role: 'assistant', content: (text || 'Done.').slice(0, 20000), data: { action: r.action, step: r.step || null, result } },
    ]);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (r.action === 'chat' && history.length === 0 && (result as { title?: string }).title) patch.title = String((result as { title?: string }).title).slice(0, 120);
    await admin.from('foggy_threads').update(patch).eq('id', threadId);
  }
  const toDraft = (kind: string, title: string, b: Record<string, unknown>) => ({ owner_id: uid, scope: r.scope, campaign_id: r.scope === 'campaign' ? r.campaignId : null, kind, title: title.slice(0, 120) || 'Untitled', body: b, prompt: (r.message || '').slice(0, 2000), model: MODEL });
  const rows: Record<string, unknown>[] = [];
  if (r.action === 'chat') for (const a of ((result as { artifacts?: { kind: string; title: string; summary: string; dmNotes: string; fields: Record<string, string> }[] }).artifacts || [])) {
    rows.push(toDraft(a.kind, a.title, { summary: a.summary, dmNotes: a.dmNotes, fields: a.fields }));
  }
  if (r.action === 'generate') {
    const kind = String(r.payload.kind);
    rows.push(toDraft(kind === 'magic-item' ? 'item' : kind, clean(result.name, 120), { summary: clean(result.summary, 4000), dmNotes: clean(result.secrets, 4000), fields: {}, homebrew: { kind, name: clean(result.name, 100), summary: clean(result.summary, 300), data: result } }));
  }
  if (rows.length) {
    const ins = await admin.from('foggy_content').insert(rows).select('id, scope, campaign_id, kind, title, body, prompt, status, saved_to, created_at');
    if (!ins.error) drafts.push(...(ins.data || []));
  }
  return reply(200, { ok: true, threadId, result, drafts, remainingToday: Math.max(0, limit - used - 1), isDm });
});
