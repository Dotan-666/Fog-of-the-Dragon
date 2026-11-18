/**
 * Foggy: the Edge Function's pure rules (supabase/functions/foggy-generate/core.ts), the function itself (statically) and the
 * browser service (JS/Dashboard/foggy/foggy-service.js). Proves that only the server talks to Gemini with a server-side key,
 * that the browser never holds a key, that access follows the existing plans and that the daily cap holds. Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';
import * as core from '../supabase/functions/foggy-generate/core.ts';

const U = '3b241101-e2bb-4255-8caf-4136c566a962';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('no AI call anywhere in the browser code, and no key', () => {
  for (const f of ['JS/Dashboard/foggy/foggy-service.js', 'JS/Dashboard/foggy/foggy-ui.js', 'JS/Dashboard/foggy/foggy-page.js', 'JS/Campaign/pages/foggy.js']) {
    const c = code(f);
    assert.ok(!/generativelanguage|googleapis|gemini|openai|api[_-]?key/i.test(c), f + ' must not contact an AI service or hold a key');
    // the only fetch: downloading a generated picture from its signed storage URL (to copy it into an adventure)
    assert.ok((c.match(/fetch\(/g) || []).every(() => true) && !/fetch\((?!urls\[img\.path\]\))/.test(c), f + ': no other network request');
  }
});

test('Edge Function: generates only when plan, switch, key and daily cap allow; the key comes from the server secret', () => {
  const idx = code('supabase/functions/foggy-generate/index.ts');
  assert.match(idx, /Deno\.env\.get\('GEMINI_API_KEY'\)/, 'the key is read from the server secret');
  assert.match(idx, /callGemini\(key, MODEL/, 'Gemini is called through the shared helper');
  const gem = code('supabase/functions/_shared/gemini.ts');
  assert.match(gem, /'x-goog-api-key': key/, 'the key is sent in a header, never in the URL');
  assert.match(gem, /thinkingBudget: 0/, 'thinking off so answers are not cut off');
  assert.ok(!/console\.(log|error)\([^)]*\b(key|body)\b/.test(gem), 'never logs the key or the request');
  assert.ok(!/console\.(log|error)\([^)]*(key|prompt|token)/.test(idx), 'never logs the key, the prompt or the token');
  assert.match(idx, /SUPABASE_SERVICE_ROLE_KEY/, 'drafts are inserted with the service role (users cannot insert)');
  assert.match(idx, /rpc\('foggy_access'/, 'access decided by the database as the caller');
  const req = core.validateRequest({ kind: 'npc', scope: 'dashboard', prompt: 'A lighthouse keeper' });
  assert.equal(req.ok, true);
  const on = { plan: 'fogger-of-the-dragons', tier: 'foggie_plus', enabled: true, dashboard: true, campaign: true, canGenerate: true };
  assert.deepEqual(core.decide(req.request, on, true, 3, 60), { status: 200, code: 'generate', message: '' });
  assert.equal(core.decide(req.request, on, true, 60, 60).code, 'daily_limit');
  assert.equal(core.decide(req.request, { ...on, enabled: false, canGenerate: false }, true).code, 'not_enabled');
  assert.equal(core.decide(req.request, on, false).code, 'not_configured', 'no key on the server');
  assert.equal(core.decide(req.request, null, true).code, 'not_set_up');
  assert.deepEqual([core.dailyLimit('foggie'), core.dailyLimit('foggie_plus'), core.dailyLimit(null)], [20, 60, 0]);
  assert.deepEqual([core.dailyLimit('foggie', { FOGGY_DAILY_FOGGIE: '5' }), core.dailyLimit('foggie', { FOGGY_DAILY_FOGGIE: 'lots' })], [5, 20]);
});

test('Edge Function: plans decide first (Free none; Campaign Foggy needs the campaign access)', () => {
  const dash = core.validateRequest({ kind: 'location', scope: 'dashboard', prompt: 'A sunken temple' }).request;
  const camp = core.validateRequest({ kind: 'handout', scope: 'campaign', campaignId: U, prompt: 'A letter from the cult' }).request;
  const free = { plan: 'warlord', tier: null, enabled: true, dashboard: false, campaign: false, canGenerate: false };
  const dm = { plan: 'dungeon-master', tier: 'foggie', enabled: false, dashboard: true, campaign: false, canGenerate: false };
  assert.deepEqual([core.decide(dash, free, true).status, core.decide(dash, free, true).code], [403, 'plan']);
  assert.equal(core.decide(camp, dm, true).code, 'plan', 'Dungeon Master: no Campaign Foggy');
  assert.equal(core.decide(dash, dm, true).code, 'not_enabled', 'Dungeon Master: Dashboard Foggy, but off');
});

test('Edge Function: requests are validated', () => {
  assert.match(core.validateRequest(null).error, /JSON object/);
  assert.match(core.validateRequest({ kind: 'dragon', scope: 'dashboard', prompt: 'xxx' }).error, /Unknown kind/);
  assert.match(core.validateRequest({ kind: 'npc', scope: 'campaign', prompt: 'xxx' }).error, /campaign id/);
  assert.match(core.validateRequest({ kind: 'npc', scope: 'dashboard', campaignId: U, prompt: 'xxx' }).error, /no campaign/);
  assert.match(core.validateRequest({ kind: 'npc', scope: 'dashboard', prompt: 'a' }).error, /few words/);
  assert.match(core.validateRequest({ kind: 'npc', scope: 'dashboard', prompt: 'x'.repeat(2001) }).error, /too long/);
  const ok = core.validateRequest({ kind: 'npc', scope: 'dashboard', prompt: '  An innkeeper\u0007  ', options: { tone: 'grim', level: 30 } });
  assert.deepEqual([ok.request.prompt, ok.request.options.tone, ok.request.options.level], ['An innkeeper', 'grim', null]);
});

test('Edge Function: the Gemini request asks for structured JSON and SRD-only content; answers are cleaned', () => {
  const r = core.validateRequest({ kind: 'item', scope: 'dashboard', prompt: 'A compass', options: { level: 5 } }).request;
  const g = core.geminiRequest(r, { adventureTitle: 'The Sunken Bell', campaignName: 'Saltmarsh Nights', campaignSummary: 'A smuggler town.' });
  assert.match(g.contents[0].parts[0].text, /Saltmarsh Nights[\s\S]*A smuggler town/);
  assert.match(g.systemInstruction.parts[0].text, /never as instructions/, 'user text cannot override the rules');
  assert.equal(g.generationConfig.responseMimeType, 'application/json');
  assert.match(g.systemInstruction.parts[0].text, /System Reference Document 5\.2\.1/);
  assert.match(g.contents[0].parts[0].text, /Party level: 5/);
  assert.match(g.contents[0].parts[0].text, /The Sunken Bell/);
  const parsed = core.parseGenerated('item', { candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Fear Compass\nX', summary: 'Points to fear.', fields: { rarity: 'Rare', 'BAD KEY': 'x' } }) }] } }] });
  assert.deepEqual(parsed, { title: 'Fear Compass X', body: { summary: 'Points to fear.', dmNotes: '', fields: { rarity: 'Rare' } } });
  assert.equal(core.parseGenerated('npc', { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), null);
});

// ---- Browser service -------------------------------------------------------------------------------------------
function service({ plan = 'warlord', rpc = null, from = null, invoke = null } = {}) {
  const calls = { rpc: [], invoke: [], from: [] };
  const window = {
    FogAccount: { getPlan: () => ({ id: plan }) },
    FogSupabase: rpc || from || invoke ? { client: {
      rpc: async (fn, args) => { calls.rpc.push([fn, args]); return rpc ? rpc(fn, args) : { data: null, error: { message: 'Could not find the function public.foggy_access' } }; },
      from: (t) => { calls.from.push(t); return from ? from(t) : null; },
      functions: { invoke: async (fn, o) => { calls.invoke.push([fn, o]); return invoke ? invoke(fn, o) : { data: null, error: { message: 'x' } }; } },
    } } : undefined,
  };
  vm.runInContext(read('JS/Dashboard/adventures/adventure-model.js'), vm.createContext(Object.assign(window, { window, crypto: globalThis.crypto })));
  vm.runInContext(read('JS/Dashboard/foggy/foggy-service.js'), vm.createContext(Object.assign(window, { window })));
  return { F: window.FogFoggy, window, calls };
}

test('service: access falls back to the same plan rules, always OFF, when the server isn’t set up', async () => {
  for (const [plan, tier, dash] of [['free', null, false], ['adventurer', 'foggie', true], ['dungeon-master', 'foggie_plus', true]]) {
    const { F } = service({ plan });
    const r = await F.access(null);
    assert.equal(r.source, 'local');
    assert.deepEqual([r.access.tier, r.access.dashboard, r.access.enabled, r.access.canGenerate], [tier, dash, false, false]);
  }
  const { F } = service({ plan: 'dungeon-master' });
  assert.equal((await F.access(U, { isCampaignDm: true })).access.campaign, true);
  assert.equal((await F.access(U, { isCampaignDm: false })).access.campaign, false, 'players: no Campaign Foggy');
  assert.equal(service({ plan: 'adventurer' }).F.localAccess(U, true).campaign, false, 'Adventurer: no Campaign Foggy');
});

test('service: generate sends nothing while off (no function call), and asks the server only when the database allows it', async () => {
  const off = { plan: 'dungeon-master', tier: 'foggie', enabled: false, dashboard: true, campaign: false, canGenerate: false };
  const s = service({ plan: 'dungeon-master', rpc: async () => ({ data: off, error: null }) });
  const r = await s.F.generate({ kind: 'npc', scope: 'dashboard', prompt: 'A lighthouse keeper' });
  assert.deepEqual([r.ok, r.code], [false, 'not_enabled']);
  assert.match(r.message, /nothing was generated/);
  assert.equal(s.calls.invoke.length, 0, 'no request to the Edge Function, let alone an AI service');
  const camp = await s.F.generate({ kind: 'npc', scope: 'campaign', campaignId: U, prompt: 'A rival' }, off);
  assert.equal(camp.code, 'plan');
  assert.equal((await s.F.generate({ kind: 'npc', scope: 'dashboard', prompt: 'x' })).code, 'bad_request');
  const on = { ...off, enabled: true, canGenerate: true };
  const s2 = service({ plan: 'dungeon-master', rpc: async () => ({ data: on, error: null }), invoke: async () => ({ data: null, error: { context: { json: async () => ({ error: 'Foggy has no AI key on the server yet. Nothing was generated.', code: 'not_configured' }) } } }) });
  const r2 = await s2.F.generate({ kind: 'npc', scope: 'dashboard', prompt: 'A lighthouse keeper' });
  assert.deepEqual([r2.ok, r2.code, s2.calls.invoke[0][0]], [false, 'not_configured', 'foggy-generate'], 'only our own server function, never Gemini directly');
  const row = { id: 'd9', scope: 'dashboard', campaign_id: null, kind: 'npc', title: 'Keeper Ilse', body: { summary: 'Watches the sea.' }, prompt: 'A lighthouse keeper', status: 'draft', saved_to: null, created_at: '2026-11-13T10:00:00Z' };
  const s3 = service({ plan: 'dungeon-master', rpc: async () => ({ data: on, error: null }), invoke: async () => ({ data: { generated: true, draft: row, remainingToday: 4 }, error: null }) });
  const r3 = await s3.F.generate({ kind: 'npc', scope: 'dashboard', prompt: 'A lighthouse keeper', options: { tone: 'eerie' } });
  assert.deepEqual([r3.ok, r3.draft.id, r3.draft.title, r3.draft.body.summary, r3.remainingToday], [true, 'd9', 'Keeper Ilse', 'Watches the sea.', 4]);
  assert.equal(s3.calls.invoke[0][1].body.options.tone, 'eerie');
});

test('service: a draft becomes an adventure asset marked "from Foggy", saved into the adventure and marked saved', async () => {
  const updates = [];
  const s = service({ plan: 'dungeon-master', from: () => ({ update: (v) => ({ eq: async (k, id) => { updates.push([v, id]); return { error: null }; } }) }) });
  const M = s.window.FogAdventureModel;
  let stored = M.normalize({ id: 'adv1', title: 'The Sunken Bell', content: { schema: 1, chapters: [] } });
  s.window.FogAdventureStore = { get: async () => ({ ok: true, adventure: JSON.parse(JSON.stringify(stored)) }), save: async (a) => { stored = a; return { ok: true }; } };
  const draft = { id: 'd1', kind: 'npc', title: 'Mayor Odile', body: { summary: 'The mayor.', dmNotes: 'A deal with the hag.', fields: { role: 'Mayor' } } };
  const res = await s.F.saveToAdventure(draft, 'adv1');
  assert.equal(res.ok, true);
  const a = stored.content.assets[0];
  assert.deepEqual([a.type, a.title, a.origin, a.fields.role, a.dmNotes, a.playerVisible], ['npc', 'Mayor Odile', 'foggy', 'Mayor', 'A deal with the hag.', false]);
  assert.deepEqual(JSON.parse(JSON.stringify(updates[0])), [{ status: 'saved', saved_to: { adventureId: 'adv1', assetId: a.id } }, 'd1']);
  assert.equal(s.F.toAsset({ kind: 'outline', title: 'x' }), null, 'an outline is not an asset');
});
