/**
 * Optional AI guide: Edge Function core (supabase/functions/character-guide-ai/core.ts) and the
 * browser client's validation, caching and failure handling (JS/Dashboard/characters/guide-ai.js).
 * No network: the Supabase client and Gemini are replaced by stubs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, autoBuild, ENGINE_SCRIPTS, ROOT, J } from './helpers/sandbox.mjs';
import * as core from '../supabase/functions/character-guide-ai/core.ts';

const { w } = load(ENGINE_SCRIPTS.concat(['JS/Dashboard/characters/guide-ai.js']));
const AI = w.FogGuideAI;
const Guide = w.FogCharacterGuide;
const derive = w.FogDeriveCharacter;

function fighter() {
  const { doc } = autoBuild(w, 'fighter', 3);
  doc.id = 'chr_test_fighter';
  const d = derive(doc);
  return { doc, d, g: Guide.build(doc, d) };
}

test('server: accepts the facts the browser sends, rejects bad input', () => {
  const { d, g } = fighter();
  const facts = AI.factsFrom(g, d);
  assert.equal(core.validateFacts({ facts: J(facts) }), null);
  assert.match(core.validateFacts({ facts: { ...J(facts), rulesVersion: 'srd-5.1' } }), /rules version/);
  assert.match(core.validateFacts({ facts: { ...J(facts), hash: 'nope' } }), /hash/);
  assert.match(core.validateFacts({ facts: { ...J(facts), combat: ['x'.repeat(5000)] } }), /combat/);
  assert.match(core.validateFacts(null), /JSON object/);
  assert.ok(JSON.stringify({ facts }).length < core.MAX_BODY_BYTES, 'request fits the size limit');
});

test('server: the prompt contains only verified facts and forbids new rules', () => {
  const { d, g } = fighter();
  const req = core.geminiRequest(J(AI.factsFrom(g, d)));
  const sys = req.systemInstruction.parts[0].text;
  assert.match(sys, /Do not add any rule, number, dice, spell, feature/);
  assert.match(sys, /Do not decide whether anything is legal/);
  assert.equal(req.generationConfig.responseMimeType, 'application/json');
  assert.ok(!/API_KEY|apikey|sb_publishable|sb_secret/i.test(JSON.stringify(req)), 'no keys in the request');
});

test('server: parses model output, drops unknown sections, rejects non-JSON', () => {
  const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
  const ok = core.parseGeminiResponse(wrap('```json\n{"sections":[{"id":"who","paragraphs":["Hello"]},{"id":"hack","paragraphs":["x"]}]}\n```'));
  assert.deepEqual(ok, [{ id: 'who', paragraphs: ['Hello'] }]);
  assert.throws(() => core.parseGeminiResponse(wrap('not json')), /not JSON/);
  assert.throws(() => core.parseGeminiResponse({}), /Empty/);
  assert.throws(() => core.parseGeminiResponse(wrap('{"sections":[{"id":"bad","paragraphs":["x"]}]}')), /no usable/);
});

test('server: per-user rate limit', () => {
  const allow = core.makeRateLimiter(2, 60_000);
  assert.equal(allow('u1', 0), true);
  assert.equal(allow('u1', 1), true);
  assert.equal(allow('u1', 2), false);
  assert.equal(allow('u2', 2), true);
  assert.equal(allow('u1', 61_000), true);
});

test('client: AI text naming rules the character doesn’t have, or unknown numbers, is dropped', () => {
  const { d, g } = fighter();
  const facts = AI.factsFrom(g, d);
  const v = AI.validate([
    { id: 'howToPlay', paragraphs: [
      'Use Second Wind when you are hurt, and Action Surge on a big turn.', // real features → kept
      'Cast Fireball on groups of enemies.', // spell the Fighter doesn't have → dropped
      'Your Longsword hits at +9 to hit.', // number not in the facts → dropped
    ] },
    { id: 'who', paragraphs: ['You are a level 3 ' + 'Human Fighter.'] },
  ], facts, g);
  assert.deepEqual(J(v.sections.map((s) => s.paragraphs.length)), [1, 1]);
  assert.equal(v.dropped, 2);
});

test('client: disabled without config; deterministic guide still complete', async () => {
  const { doc, d, g } = fighter();
  assert.equal(AI.enabled(), false);
  await assert.rejects(AI.request(doc, g, d), /turned off/);
  assert.ok(g.abilities.length && g.howToPlay.combat.length && g.progression.length, 'fallback guide has content');
});

test('client: server errors become readable messages; stale or invalid answers are discarded', async () => {
  const { doc, d, g } = fighter();
  w.FOG_SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'sb_publishable_x', aiGuide: true };
  let reply = null;
  w.FogSupabase = { functions: { invoke: async () => reply } };
  assert.equal(AI.enabled(), true);
  AI.clear(doc.id);

  reply = { data: null, error: { context: { status: 429 } } };
  await assert.rejects(AI.request(doc, g, d), /busy/);
  reply = { data: null, error: { context: { status: 503 } } };
  await assert.rejects(AI.request(doc, g, d), /set up/);
  reply = { data: { hash: '00000000', sections: [{ id: 'who', paragraphs: ['Hi'] }] }, error: null };
  await assert.rejects(AI.request(doc, g, d), /older version/);
  reply = { data: { hash: g.hash, sections: [{ id: 'who', paragraphs: ['Cast Fireball now.'] }] }, error: null };
  await assert.rejects(AI.request(doc, g, d), /rules check/);

  reply = { data: { hash: g.hash, model: 'stub', sections: [{ id: 'who', paragraphs: ['A sturdy Human Fighter.'] }] }, error: null };
  const res = await AI.request(doc, g, d);
  assert.equal(res.cached, false);
  reply = null; // a second call must come from the cache, not the server
  const again = await AI.request(doc, g, d);
  assert.equal(again.cached, true);

  // Editing the character changes the hash: the cached text no longer applies
  doc.choices.level = 4;
  const { doc: lv4 } = autoBuild(w, 'fighter', 4, { choices: doc.choices });
  lv4.id = doc.id;
  const g4 = Guide.build(lv4);
  assert.notEqual(g4.hash, g.hash);
  assert.equal(AI.readCache(doc.id, g4.hash), null);
  delete w.FOG_SUPABASE_CONFIG;
  delete w.FogSupabase;
});

test('secrets: no API keys in frontend code or in the Edge Function source', () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|ts|html|mjs)$/.test(e.name)) files.push(p);
  });
  ['JS', 'Pages', 'supabase/functions'].forEach((d) => walk(path.join(ROOT, d)));
  const leaks = files.filter((f) => !/supabase-config\.js$/.test(f)).filter((f) => /AIza[0-9A-Za-z_-]{30,}|sb_secret_[A-Za-z0-9]|service_role["']?\s*:/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(leaks, []);
  const fn = fs.readFileSync(path.join(ROOT, 'supabase/functions/character-guide-ai/index.ts'), 'utf8');
  assert.match(fn, /Deno\.env\.get\('GEMINI_API_KEY'\)/);
  assert.match(fn, /auth\.getUser/);
});
