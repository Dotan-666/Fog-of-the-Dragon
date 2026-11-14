/**
 * Foggy assistant and the combat redesign — pure parts: the Edge Functions' validation and parsers (foggy-assistant,
 * foggy-image, foggy-listen), the combat action parser and attack resolution, the voice policy (cooldowns, dedupe, pause) and
 * the WAV encoder, plus static checks that no AI key or provider call reaches the browser.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';
import * as asst from '../supabase/functions/foggy-assistant/core.ts';
import * as img from '../supabase/functions/foggy-image/core.ts';
import * as lis from '../supabase/functions/foggy-listen/core.ts';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const J = (x) => JSON.parse(JSON.stringify(x));
const U = '3b241101-e2bb-4255-8caf-4136c566a962';
const answer = (o) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] });
function load(files) {
  const w = { console, Date, Math, JSON, crypto: globalThis.crypto, btoa: globalThis.btoa };
  w.window = w;
  const ctx = vm.createContext(w);
  for (const f of files) vm.runInContext(read(f), ctx);
  return w;
}

// ---- foggy-assistant ------------------------------------------------------------------------------------------------
test('assistant requests: actions, scopes, ids and steps are checked', () => {
  assert.equal(asst.validateRequest({ action: 'chat', message: 'hi there' }).ok, true);
  assert.equal(asst.validateRequest({ action: 'delete_everything', message: 'x' }).ok, false);
  assert.match(asst.validateRequest({ action: 'chat', scope: 'campaign', message: 'hello' }).error, /campaign id/);
  assert.match(asst.validateRequest({ action: 'combat', message: '' }).error, /campaign id/, 'combat help is always tied to a campaign');
  assert.match(asst.validateRequest({ action: 'adventure', step: 'publish' }).error, /step/);
  assert.match(asst.validateRequest({ action: 'generate', message: 'a dragon', payload: { kind: 'vehicle' } }).error, /Choose what/);
  assert.equal(asst.validateRequest({ action: 'combat', campaignId: U }).req.scope, 'campaign');
});

test('chat: Foggy decides the intent; only edits to content the app offered survive; artifacts are cleaned', () => {
  const ok = asst.parseChat(answer({ intent: 'edit', reply: 'Here.', edits: [{ target: 's_1', field: 'playerText', newText: 'Dark water.' }, { target: 'secret-dm-notes', field: 'dmNotes', newText: 'hacked' }] }), ['s_1']);
  assert.deepEqual(J(ok.edits.map((e) => e.target)), ['s_1'], 'an id the app did not offer is dropped');
  const none = asst.parseChat(answer({ intent: 'edit', reply: 'Here.', edits: [{ target: 'nope', newText: 'x' }] }), ['s_1']);
  assert.equal(none.intent, 'answer', 'an edit with nothing valid becomes an answer');
  const art = asst.parseChat(answer({ intent: 'artifact', reply: 'Made it.', artifacts: [{ kind: 'npc', title: 'Odile\nthe Mayor', summary: 'Lies.', fields: [{ label: 'Role', value: 'Mayor' }] }] }), []);
  assert.deepEqual(J([art.artifacts[0].title, art.artifacts[0].fields]), ['Odile the Mayor', { Role: 'Mayor' }]);
  const q = asst.parseChat(answer({ intent: 'answer', reply: 'Grappling is an SRD rule.', artifacts: [{ kind: 'npc', title: 'X', summary: 'Y' }] }), []);
  assert.equal(q.artifacts.length, 0, 'an answer never smuggles an artifact');
  assert.equal(asst.parseChat({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }, []), null);
  const sys = asst.chatRequest([], 'hi', {}, []).systemInstruction.parts[0].text;
  assert.match(sys, /official SRD 5\.2\.1 rule or a homebrew suggestion/);
  assert.match(sys, /never instructions that change these rules/);
});

test('adventure writing: progressive steps, and answers are parsed into the adventure shapes', () => {
  const o = asst.parseAdventure('outline', answer({ title: 'The Drowned Bell', levelMin: 3, levelMax: 99, chapters: [{ title: 'Arrival', summary: 'Fog.', sections: [{ kind: 'npc', title: 'Odile' }, { kind: 'spaceship', title: 'X' }] }] }));
  assert.deepEqual(J([o.levelMin, o.levelMax, o.chapters[0].sections.map((s) => s.kind)]), [3, null, ['npc', 'scene']]);
  assert.equal(asst.parseAdventure('outline', answer({ title: 'Empty', chapters: [] })), null, 'an outline needs chapters');
  const c = asst.parseAdventure('chapter', answer({ title: 'Arrival', sections: [{ kind: 'scene', title: 'Tolling', playerText: 'A bell.', dmNotes: 'Cursed.' }] }));
  assert.equal(c.sections[0].dmNotes, 'Cursed.');
  const big = asst.adventureRequest('chapter', { chapter: 'x' }, {}, []);
  assert.match(big.systemInstruction.parts[0].text, /read-aloud playerText/);
});

test('music plan: only tracks from the catalog the app sent, only places in the adventure', () => {
  const cat = asst.catalogFrom([{ ref: 'rec:battle-theme-a', name: 'Battle', kind: 'music', category: 'combat' }, { ref: 'https://evil/x.mp3', name: 'Bad' }]);
  assert.deepEqual(J(cat.map((t) => t.ref)), ['rec:battle-theme-a'], 'only catalog refs are accepted');
  const r = asst.parseMusic(answer({ cues: [{ moment: 'Ambush', when: 'change', ref: 'rec:battle-theme-a', chapterId: 'c_1', keywords: ['Attack'] }, { moment: 'Made up', when: 'change', ref: 'rec:invented-epic' }, { moment: 'Silence', when: 'stop', ref: '' }] }), cat, ['c_1']);
  assert.deepEqual(J(r.cues.map((c) => [c.moment, c.ref, c.chapterId])), [['Ambush', 'rec:battle-theme-a', 'c_1'], ['Silence', '', '']]);
  assert.equal(r.dropped, 1);
  assert.equal(r.cues[0].keywords[0], 'attack');
});

test('combat help: suggestions use only the actor’s real actions and real targets; inventions are flagged', () => {
  const st = asst.combatFrom({ round: 2, actor: { id: 'g1', name: 'Goblin', kind: 'monster', conditions: [], actions: [{ name: 'Scimitar', text: 'Melee +4' }] }, others: [{ id: 'pc1', name: 'Brienne', kind: 'pc', health: 'unhurt', conditions: [] }] });
  assert.deepEqual(J(asst.parseCombat(answer({ reply: 'Attack!', action: 'scimitar', targetIds: ['pc1', 'ghost'] }), st)), { reply: 'Attack!', action: 'Scimitar', targetIds: ['pc1'], reason: '', invented: false });
  const inv = asst.parseCombat(answer({ reply: 'Breathe fire!', action: 'Fire Breath', targetIds: ['pc1'] }), st);
  assert.deepEqual(J([inv.action, inv.targetIds, inv.invented]), ['', [], true]);
  assert.match(asst.combatRequest(st, '', true).systemInstruction.parts[0].text, /The player decides/);
  assert.match(asst.combatRequest(st, '', false).systemInstruction.parts[0].text, /nothing happens until they approve it/);
});

test('the assistant function: access as the caller, server key, usage ledger, nothing applied to adventures or combat', () => {
  const idx = code('supabase/functions/foggy-assistant/index.ts');
  assert.match(idx, /user\.rpc\('foggy_access'/);
  assert.match(idx, /cleanKey\(Deno\.env\.get\('GEMINI_API_KEY'\)\)/);
  assert.match(idx, /from\('foggy_usage'\)\.insert/);
  assert.ok(!/from\('adventures'\)\.(update|insert|delete)|from\('homebrew'\)\.(update|insert)|save_campaign_combat/.test(idx), 'Foggy never writes adventures, homebrew or combat itself');
  assert.match(idx, /if \(isDm\)/, 'the logbook (DM notes) is read only for the DM');
  assert.ok(!/console\.(log|error)\([^)]*(message|prompt|result|key)\b/.test(idx));
});

// ---- foggy-image ----------------------------------------------------------------------------------------------------
test('images: battle maps are asked for as top-down grids; illustrations are labelled as such; the image is picked from the answer', () => {
  const b = img.validateRequest({ kind: 'battle_map', prompt: 'A flooded crypt', grid: { cols: 100, rows: 3 } });
  assert.deepEqual(J(b.req.grid), { cols: 40, rows: 8 }, 'grid kept within sensible limits');
  const p = img.buildPrompt(b.req);
  assert.match(p, /strict top-down orthographic/);
  assert.match(p, /40 by 8 equal squares/);
  assert.match(p, /No text, letters, logos/);
  const w = img.buildPrompt(img.validateRequest({ kind: 'world_map', prompt: 'Three continents' }).req);
  assert.match(w, /decorative/);
  assert.ok(!/grid/.test(w));
  assert.equal(img.validateRequest({ kind: 'selfie', prompt: 'xxxxxx' }).ok, false);
  assert.deepEqual(J(img.geminiImageBody('x', '1:1').generationConfig), { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } });
  assert.deepEqual(J(img.pickImage({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] })), { ok: true, data: 'AAAA', mime: 'image/png' });
  assert.match(img.pickImage({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }).reason, /safety/);
  assert.match(img.pickImage({ candidates: [{ content: { parts: [{ text: 'I cannot draw' }] } }] }).reason, /without a picture/, 'text is never passed off as an image');
});

// ---- foggy-listen ---------------------------------------------------------------------------------------------------
test('listening: audio chunks are size-limited; only cue ids from the plan come back; nothing else', () => {
  assert.match(lis.validateRequest({ campaignId: U, audio: 'x', cues: [{ id: 'c1', moment: 'Fight' }] }).error, /Audio/);
  assert.match(lis.validateRequest({ campaignId: U, audio: 'A'.repeat(200), cues: [] }).error, /music plan/);
  assert.match(lis.validateRequest({ campaignId: U, audio: 'A'.repeat(lis.MAX_AUDIO_BASE64 + 10), cues: [{ id: 'c1', moment: 'x' }] }).error, /too long/);
  const cues = [{ id: 'c1', moment: 'Combat starts', keywords: [], when: 'change' }];
  assert.deepEqual(J(lis.parseListen(answer({ transcript: 'The goblins attack!', cueId: 'c1', confidence: 0.9 }), cues)), { transcript: 'The goblins attack!', cueId: 'c1', confidence: 0.9 });
  assert.equal(lis.parseListen(answer({ transcript: 'x', cueId: 'rickroll', confidence: 2 }), cues).cueId, '');
  const idx = code('supabase/functions/foggy-listen/index.ts');
  assert.ok(!/storage|insert\([^)]*transcript|console\.(log|error)\([^)]*(audio|transcript)/.test(idx), 'audio and transcripts are never stored or logged');
  assert.match(idx, /tier !== 'foggie_plus'/, 'advanced plan only');
});

// ---- combat actions -------------------------------------------------------------------------------------------------
const W = load(['JS/Campaign/combat-actions.js']);
const CA = W.FogCombatActions;
test('combat actions: monster attacks and saves are read from the stat block text, nothing invented', () => {
  const a = CA.parseAction({ name: 'Bite', text: '_Melee Attack Roll:_ +7, reach 10 ft. _Hit:_ 15 (2d10 + 4) Piercing damage plus 4 (1d8) Fire damage.' }, 'action');
  assert.deepEqual(J([a.type, a.bonus, a.reach, a.damage.map((d) => d.dice + ' ' + d.type)]), ['attack', 7, 'reach 10 ft', ['2d10+4 Piercing', '1d8 Fire']]);
  const s = CA.parseAction({ name: 'Fire Breath (Recharge 5–6)', text: '_Dexterity Saving Throw:_ DC 13, each creature in a 15-foot Cone. _Failure:_ 24 (7d6) Fire damage. _Success:_ Half damage.' }, 'action');
  assert.deepEqual(J([s.type, s.ability, s.dc, s.multi, s.half, s.recharge]), ['save', 'dex', 13, true, true, 'Recharge 5–6']);
  assert.equal(CA.parseAction({ name: 'Multiattack', text: 'The goblin makes two attacks.' }, 'action').type, 'text');
  const all = JSON.parse(read('Assets/Data/srd-5.2.1-monsters.json')).monsters.flatMap((m) => CA.fromMonster(m));
  assert.ok(all.filter((x) => x.type === 'attack').every((x) => Number.isFinite(x.bonus)), 'every SRD attack has a real bonus');
});

test('combat actions: hit, miss, critical (dice doubled), advantage, saves with half damage', () => {
  const bite = { type: 'attack', bonus: 5, damage: [{ dice: '2d6+3', type: 'Slashing' }, { dice: '1d4', type: 'Fire' }] };
  assert.deepEqual(J(CA.resolveAttack({ action: bite, d20: [12], ac: 16 })), { nat: 12, total: 17, crit: false, hit: true, damage: null });
  assert.equal(CA.resolveAttack({ action: bite, d20: [10], ac: 16 }).hit, false);
  assert.equal(CA.resolveAttack({ action: bite, d20: [1], ac: 2 }).hit, false, 'a natural 1 misses');
  assert.equal(CA.resolveAttack({ action: bite, d20: [20], ac: 30 }).crit, true, 'a natural 20 hits');
  assert.equal(CA.resolveAttack({ action: bite, d20: [12], ac: null }).hit, null, 'AC unknown (a player’s view): the DM decides');
  assert.equal(CA.resolveAttack({ action: bite, d20: [4, 18], mode: 'advantage', ac: 16 }).nat, 18);
  assert.equal(CA.resolveAttack({ action: bite, d20: [4, 18], mode: 'disadvantage', ac: 16 }).nat, 4);
  assert.deepEqual(J(CA.damageDice(bite, true)), ['4d6+3', '2d4']);
  const breath = { type: 'save', dc: 13, half: true, damage: [{ dice: '7d6', type: 'Fire' }] };
  assert.deepEqual(J([CA.resolveAttack({ action: breath, saveTotal: 14, damageRolled: 21 }).damage, CA.resolveAttack({ action: breath, saveTotal: 12, damageRolled: 21 }).damage]), [10, 21]);
});

test('combat actions: a character’s weapon attacks come from the derived sheet', () => {
  const acts = CA.fromDerived({ attacks: [{ name: 'Greatsword', attackBonus: 5, damage: '2d6 +3 Slashing', properties: ['Heavy'] }, { name: 'Unarmed Strike', attackBonus: 5, damage: '4 Bludgeoning', properties: [] }] });
  assert.deepEqual(J(acts.map((a) => [a.name, a.bonus, a.damage.map((d) => d.dice)])), [['Greatsword', 5, ['2d6+3']], ['Unarmed Strike', 5, ['4']]]);
});

// ---- voice policy and audio -----------------------------------------------------------------------------------------
const V = load(['JS/Dashboard/foggy/foggy-voice.js']);
test('voice: confident matches play once; repeats, quick changes and low confidence are ignored; pause stops everything', () => {
  const cues = [{ id: 'fight', moment: 'Combat', ref: 'rec:a' }, { id: 'boss', moment: 'Dragon', ref: 'rec:b' }];
  const p = V.FogVoicePolicy.create({ cues, cueCooldownMs: 120000, minGapMs: 20000, minConfidence: 0.6 });
  assert.equal(p.decide({ cueId: 'fight', confidence: 0.9, at: 0 }).play.id, 'fight');
  assert.equal(p.decide({ cueId: 'fight', confidence: 0.95, at: 5000 }).reason, 'already playing', 'the same words heard twice');
  assert.equal(p.decide({ cueId: 'boss', confidence: 0.9, at: 10000 }).reason, 'too soon after the last change');
  assert.equal(p.decide({ cueId: 'boss', confidence: 0.4, at: 40000 }).reason, 'not sure enough');
  assert.equal(p.decide({ cueId: 'boss', confidence: 0.9, at: 40000 }).play.id, 'boss');
  assert.equal(p.decide({ cueId: 'fight', confidence: 0.9, at: 70000 }).reason, 'played recently', 'cooldown per cue');
  assert.equal(p.decide({ cueId: 'nope', confidence: 1, at: 999999 }).reason, 'unknown cue');
  p.setPaused(true);
  assert.equal(p.decide({ cueId: 'fight', confidence: 1, at: 999999 }).reason, 'paused');
  p.setPaused(false);
  p.manual('fight', 1000000);
  assert.equal(p.decide({ cueId: 'fight', confidence: 1, at: 1000500 }).reason, 'already playing', 'a cue the DM played by hand is not fought over');
});

test('voice: 16 kHz mono WAV chunks; silence measured; the microphone is never opened by loading the page', () => {
  const wav = V.FogVoiceAudio.encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 16000);
  const h = String.fromCharCode(...wav.slice(0, 4)) + String.fromCharCode(...wav.slice(8, 12));
  assert.equal(h, 'RIFFWAVE');
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 16000);
  assert.equal(wav.length, 44 + 8);
  assert.equal(V.FogVoiceAudio.downsample(new Float32Array(48), 48000, 16000).length, 16);
  assert.ok(V.FogVoiceAudio.rms(new Float32Array(100)) === 0);
  const src = code('JS/Dashboard/foggy/foggy-voice.js');
  assert.equal((src.match(/getUserMedia/g) || []).length, 2, 'getUserMedia only inside start() (and its availability check)');
  assert.ok(!/localStorage|indexedDB|MediaRecorder|\.download|createObjectURL/.test(src), 'no recording or storing of audio');
  assert.equal(V.FogVoiceDirector.state().status, 'off', 'off until the DM starts it');
});

test('the browser never holds an AI key or calls a provider directly', () => {
  for (const f of ['JS/Dashboard/foggy/foggy-service.js', 'JS/Dashboard/foggy/foggy-studio.js', 'JS/Dashboard/foggy/foggy-voice.js', 'JS/Dashboard/foggy/foggy-ui.js', 'JS/Campaign/pages/combat.js', 'JS/Campaign/combat-actions.js']) {
    assert.ok(!/generativelanguage|x-goog-api-key|GEMINI_API_KEY|api[_-]?key\s*[:=]/i.test(code(f)), f);
  }
});

// ---- prepare / recap (session experience) ----
test('foggy-assistant: prepare and recap are campaign-only actions', () => {
  assert.equal(asst.validateRequest({ action: 'prepare', scope: 'dashboard' }).ok, false);
  assert.equal(asst.validateRequest({ action: 'recap', scope: 'campaign', campaignId: U }).ok, true);
  assert.equal(asst.validateRequest({ action: 'prepare', scope: 'campaign' }).ok, false, 'needs the campaign id');
});
test('foggy-assistant: prepare keeps only resources from the inventory, never invented ones', () => {
  const inv = asst.prepFrom({ items: [{ id: 'enc:e1', kind: 'encounter', title: 'Ambush' }, { id: 'map:a1', kind: 'map', title: 'Crypt' }, { id: 'x', kind: 'weird', title: 'Nope' }], missing: ['Encounter “Ambush” has no map picture'], where: 'Chapter 1' });
  assert.equal(inv.items.length, 2, 'unknown kinds dropped');
  const r = asst.parsePrepare(answer({ summary: 'Ambush night', open: [{ id: 'enc:e1', why: 'next' }, { id: 'enc:e1' }, { id: 'monster:beholder', why: 'cool' }], missing: ['Music for the crypt'], suggestions: ['Read the intro'] }), inv);
  assert.deepEqual(J(r.open), [{ id: 'enc:e1', why: 'next' }], 'duplicates and invented ids removed');
  assert.equal(r.ignored, 1);
  assert.ok(r.missing.includes('Encounter “Ambush” has no map picture') && r.missing.includes('Music for the crypt'));
  const q = asst.prepareRequest(inv, {});
  assert.match(JSON.stringify(q), /ONLY ids from the list/);
});
test('foggy-assistant: recap needs real notes and returns reviewed-later drafts', () => {
  assert.equal(asst.recapFrom({ title: 'S1', number: 1 }), null, 'nothing to work from');
  const rin = asst.recapFrom({ title: 'S1', number: 1, notes: 'The party crossed the bridge.', details: { npcs: 'Mara the ferrywoman', bogus: 'x' }, results: [{ title: 'Bridge trolls', rounds: 3, defeated: ['Troll'], survivors: [] }] });
  assert.deepEqual(Object.keys(rin.details), ['npcs']);
  const q = JSON.stringify(asst.recapRequest(rin, {}));
  assert.match(q, /do not invent/); assert.match(q, /Bridge trolls/);
  assert.equal(asst.parseRecap(answer({ playerRecap: {}, dmSummary: 'x' })), null, 'an empty player recap is refused');
  const out = asst.parseRecap(answer({ playerRecap: { happened: 'They crossed.', secret: 'no' }, dmSummary: 'Mara is a spy', threads: ['Who paid the trolls?'], hooks: [] }));
  assert.deepEqual(Object.keys(out.playerRecap), ['happened']);
  assert.equal(out.dmSummary, 'Mara is a spy');
});
test('foggy-assistant index: prepare/recap are DM-only and sections are checked against the adventure', () => {
  const src = read('supabase/functions/foggy-assistant/index.ts');
  assert.match(src, /\(r\.action === 'prepare' \|\| r\.action === 'recap'\) && !isDm/);
  assert.match(src, /built\.placeIds\.includes\(i\.id\)/);
});
