/**
 * Homebrew (JS/Dashboard/homebrew/homebrew-model.js + JS/Dashboard/compendium/compendium-render.js):
 * stat block math checked against the official SRD 5.2.1 monsters, cleaning, validation, rendering and registration.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

const window = { console };
const ctx = vm.createContext({ window, console, crypto: globalThis.crypto });
for (const f of ['JS/character-engine/data/srd-5.2.1-core.js', 'JS/Dashboard/homebrew/homebrew-model.js', 'JS/Dashboard/compendium/compendium-render.js', 'JS/Dashboard/compendium/compendium-store.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const M = window.FogHomebrewModel;
const R = window.FogCompendiumRender;
const SRD = JSON.parse(fs.readFileSync(path.join(ROOT, 'Assets/Data/srd-5.2.1-monsters.json'), 'utf8')).monsters;
const J = (x) => JSON.parse(JSON.stringify(x));

function goblinWarrior() {
  const e = M.newEntry('monster', 'Goblin Warrior');
  Object.assign(e.data, {
    size: 'Small', type: 'Fey', typeTags: 'Goblinoid', alignment: 'Chaotic Neutral', ac: 15, hitDice: 3,
    abilities: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 }, skills: { stealth: 2 },
    senses: 'Darkvision 60 ft.', languages: 'Common, Goblin', cr: '1/4',
  });
  const scimitar = Object.assign(M.newItem('attack'), { name: 'Scimitar', ability: 'dex', dice: 1, die: 6, damageType: 'Slashing', text: ', plus 2 (1d4) Slashing damage if the attack roll had Advantage.' });
  const shortbow = Object.assign(M.newItem('attack'), { name: 'Shortbow', attackType: 'ranged', ability: 'dex', range: '80/320', dice: 1, die: 6, damageType: 'Piercing', text: ', plus 2 (1d4) Piercing damage if the attack roll had Advantage.' });
  e.data.actions = [scimitar, shortbow];
  e.data.bonusActions = [Object.assign(M.newItem('text'), { name: 'Nimble Escape', text: 'The goblin takes the Disengage or Hide action.' })];
  return e;
}

test('a homebrew rebuild of the SRD Goblin Warrior produces the official stat block numbers and text', () => {
  const ours = M.toMonster(goblinWarrior());
  const srd = SRD.find((m) => m.id === 'goblin-warrior');
  for (const k of ['ac', 'hp', 'initiative', 'skills', 'senses', 'cr', 'xp', 'proficiencyBonus']) assert.equal(ours[k], srd[k], k);
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) assert.deepEqual(J(ours.abilities[a]), srd.abilities[a], a);
  assert.deepEqual(J(ours.actions), srd.actions);
  assert.deepEqual(J(ours.bonusActions), srd.bonusActions);
  assert.equal(ours.crDetails, srd.crDetails);
});

test('proficiency bonus and XP from the Challenge Rating match every SRD monster', () => {
  let n = 0;
  for (const m of SRD) {
    if (!M.CR_LIST.includes(m.cr)) continue;
    assert.equal(M.pbForCr(m.cr), m.proficiencyBonus, m.name + ' PB');
    // The SRD's Archmage block prints XP 8,000 for CR 12; every other CR 12 creature (and the XP table) gives 8,400.
    if (!/lair/i.test(m.crDetails || '') && m.xp != null && m.cr !== '0' && m.id !== 'archmage') assert.equal(M.CR_XP[m.cr], m.xp, m.name + ' XP');
    n++;
  }
  assert.ok(n > 300, 'checked ' + n + ' monsters');
});

test('hit points from Hit Dice match SRD monsters whose Hit Die follows their size', () => {
  let n = 0;
  for (const m of SRD) {
    const hd = /\((\d+)d(\d+)(?: ([+−-]) (\d+))?\)/.exec(m.hp || '');
    if (!hd || !m.abilities.con || M.HIT_DIE[m.size] !== Number(hd[2])) continue;
    const count = Number(hd[1]);
    const bonus = hd[3] ? (hd[3] === '+' ? 1 : -1) * Number(hd[4]) : 0;
    if (bonus !== count * M.mod(m.abilities.con.score)) continue; // a few blocks add other bonuses
    const e = M.newEntry('monster', m.name);
    Object.assign(e.data, { size: m.size, hitDice: count, abilities: Object.fromEntries(Object.entries(m.abilities).map(([k, v]) => [k, v.score])), cr: m.cr });
    assert.equal(M.toMonster(e).hp, m.hp, m.name);
    n++;
  }
  assert.ok(n > 250, 'checked ' + n + ' monsters');
});

test('attacks and saving throws are written in the 2024 stat block format from their parts', () => {
  const e = M.newEntry('monster', 'Ash Drake');
  Object.assign(e.data, { abilities: { str: 18, dex: 12, con: 16, int: 6, wis: 10, cha: 8 }, cr: '5' });
  const bite = Object.assign(M.newItem('attack'), { name: 'Bite', ability: 'str', reach: 10, dice: 2, die: 10, damageType: 'Piercing', extraDice: 1, extraDie: 8, extraType: 'Fire', bonus: 1 });
  const breath = Object.assign(M.newItem('save'), { name: 'Ash Breath', save: 'con', dcAbility: 'con', targets: 'each creature in a 30-foot Cone', dice: 6, die: 6, damageType: 'Fire', failure: 'The target has the Blinded condition until the end of its next turn.', success: 'Half damage only.' });
  const both = Object.assign(M.newItem('attack'), { name: 'Tail Spike', attackType: 'both', ability: 'dex', range: '20/60', dice: 1, die: 8, damageType: 'Piercing' });
  e.data.actions = [bite, breath, both];
  const out = M.toMonster(e).actions;
  // PB +3 at CR 5; Str +4; +1 magic bonus → +8 to hit, damage 2d10 + 5
  assert.equal(out[0].text, '_Melee Attack Roll:_ +8, reach 10 ft. _Hit:_ 16 (2d10 + 5) Piercing damage plus 4 (1d8) Fire damage.');
  // DC = 8 + 3 + Con 3 = 14
  assert.equal(out[1].text, '_Constitution Saving Throw:_ DC 14, each creature in a 30-foot Cone. _Failure:_ 21 (6d6) Fire damage. The target has the Blinded condition until the end of its next turn. _Success:_ Half damage only.');
  assert.equal(out[2].text, '_Melee or Ranged Attack Roll:_ +4, reach 5 ft. or range 20/60 ft. _Hit:_ 5 (1d8 + 1) Piercing damage.');
});

test('negative modifiers use the minus sign, initiative proficiency and expertise add the proficiency bonus', () => {
  const e = M.newEntry('monster', 'Slow Thing');
  Object.assign(e.data, { abilities: { str: 10, dex: 6, con: 10, int: 10, wis: 10, cha: 10 }, cr: '9' });
  assert.equal(M.toMonster(e).initiative, '−2 (8)');
  e.data.initiativeProf = 2; // +2×PB(4)
  assert.equal(M.toMonster(e).initiative, '+6 (16)');
  e.data.skills = { perception: 1 };
  assert.match(M.toMonster(e).senses, /Passive Perception 14$/);
  e.data.legendaryActions = [Object.assign(M.newItem('text'), { name: 'Move', text: 'It moves.' })];
  e.data.legendaryUses = 2;
  assert.match(M.toMonster(e).legendaryIntro, /^Legendary Action Uses: 2\. .*the slow thing can expend a use/);
});

test('normalize cleans and clamps stored data, drops unknown fields and keeps the kind fixed', () => {
  const dirty = {
    id: 'x1', kind: 'monster', name: '  Big   One  ', summary: 'a'.repeat(400), version: 4,
    data: { size: 'Colossal', abilities: { str: 99, dex: -3, con: 'x' }, saves: ['dex', 'luck'], skills: { stealth: 3, perception: 1, flying: 2 }, cr: '31', ac: 0, hitDice: 500, hpOverride: '', evil: '<script>', actions: [{ name: 'A'.repeat(200), mode: 'laser', dice: 99, die: 7 }] },
  };
  const n = M.normalize(dirty);
  assert.equal(n.name, 'Big   One');
  assert.equal(n.summary.length, 300);
  assert.equal(n.version, 4);
  assert.deepEqual([n.data.size, n.data.abilities.str, n.data.abilities.dex, n.data.abilities.con], ['Medium', 30, 1, 10]);
  assert.deepEqual(J(n.data.saves), ['dex']);
  assert.deepEqual(J(n.data.skills), { perception: 1 });
  assert.deepEqual([n.data.cr, n.data.ac, n.data.hitDice, n.data.hpOverride], ['1/4', 1, 99, null]);
  assert.equal(n.data.evil, undefined);
  assert.deepEqual([n.data.actions[0].name.length, n.data.actions[0].mode, n.data.actions[0].dice, n.data.actions[0].die], [80, 'text', 40, 6]);
  assert.equal(M.normalize({ kind: 'vehicle', name: 'Cart' }).kind, 'other');
  assert.equal(n.data.schema, 1);
});

test('validation: a name, named stat block entries and a described Material component are required', () => {
  assert.deepEqual(J(M.validate(M.newEntry('feat', 'Shield Breaker'))), []);
  assert.match(M.validate(Object.assign(M.newEntry('feat'), { name: ' ' }))[0], /name/);
  const m = M.newEntry('monster', 'Nameless');
  m.data.actions.push(M.newItem('attack'));
  assert.match(M.validate(m)[0], /Actions: entry 1 needs a name/);
  const npc = M.newEntry('npc', 'Talker');
  npc.data.actions.push(M.newItem('text'));
  assert.deepEqual(J(M.validate(npc)), [], 'an NPC without a stat block is not checked for actions');
  const sp = M.newEntry('spell', 'Ember Lash');
  sp.data.material = true;
  assert.match(M.validate(sp)[0], /Material/);
});

test('each kind gets a clear subtitle, and duplicates are new entries with new item ids', () => {
  const sp = M.normalize(Object.assign(M.newEntry('spell', 'Frost Thread'), { data: Object.assign(M.newEntry('spell').data, { level: 0, school: 'Evocation' }) }));
  assert.equal(M.subtitle(sp), 'Evocation cantrip');
  const it = M.normalize({ kind: 'magic-item', name: 'Lantern', data: { category: 'Weapon', baseItem: 'Longsword', rarity: 'Rare', attunement: true, attunementBy: 'a Paladin' } });
  assert.equal(M.subtitle(it), 'Weapon (Longsword), Rare (Requires Attunement by a Paladin)');
  const ft = M.normalize({ kind: 'feat', name: 'X', data: { category: 'General', prerequisite: 'Level 4+', repeatable: true } });
  assert.equal(M.subtitle(ft), 'General Feat (Prerequisite: Level 4+) · Repeatable');
  const g = Object.assign(goblinWarrior(), { id: 'abc', version: 3 });
  const copy = M.duplicate(g);
  assert.equal(copy.id, null);
  assert.equal(copy.name, 'Goblin Warrior (copy)');
  assert.notEqual(copy.data.actions[0].id, g.data.actions[0].id);
  assert.equal(M.subtitle(g), 'Small Fey · CR 1/4');
});

test('spells convert to the compendium spell shape (components, ritual, concentration)', () => {
  const e = M.newEntry('spell', 'Ember Lash');
  Object.assign(e.data, { level: 2, classes: ['wizard', 'sorcerer', 'nope'], material: true, materials: 'a glowing coal', concentration: true, duration: '1 minute', ritual: true, description: 'A whip of fire.' });
  const s = M.toSpell(e);
  assert.deepEqual([s.components, s.duration, s.castingTime, J(s.classes)], ['V, S, M (a glowing coal)', 'Concentration, up to 1 minute', 'Action or Ritual', ['sorcerer', 'wizard']]);
});

test('rendering escapes every value and shows each kind; NPC secrets are marked DM only', () => {
  const evil = '<img src=x onerror=alert(1)>';
  for (const kind of M.KIND_ORDER) {
    const e = M.newEntry(kind, evil);
    e.data.description = evil + ' **bold**';
    if (kind === 'npc') { e.data.secrets = 'Works for the cult.'; e.data.hasStats = true; }
    const html = R.homebrew(e);
    assert.ok(!html.includes('<img'), kind + ' escapes');
    assert.ok(html.includes('&lt;img src=x'), kind + ' shows the text');
    if (kind !== 'monster' && kind !== 'npc' && kind !== 'spell') assert.ok(html.includes('<strong>bold</strong>'), kind + ' markup');
    if (kind === 'npc') assert.match(html, /Secrets \(DM only\)[\s\S]*Works for the cult[\s\S]*Armor Class/);
  }
  const plain = M.newEntry('npc', 'Talker');
  assert.match(R.homebrew(plain), /No combat stats/);
});

test('homebrew datasets register in the Monsters & Spells registry and can be replaced', () => {
  const C = window.FogCompendium;
  const meta = { id: 'homebrew-monsters', kind: 'monster', origin: 'homebrew', name: 'Your homebrew', edition: '2024 rules format' };
  const g = Object.assign(goblinWarrior(), { id: 'hb1' });
  assert.ok(C.register({ meta, entries: [M.toMonster(g)] }).ok);
  assert.equal(C.monsters().filter((m) => m.dataset.origin === 'homebrew').length, 1);
  assert.equal(C.monsters()[0].complete, true);
  assert.ok(!C.register({ meta, entries: [] }).ok, 'same id twice is refused');
  C.unregister('homebrew-monsters');
  assert.ok(C.register({ meta, entries: [] }).ok, 'after unregister it can be registered again');
});

test('routes: Homebrew is a real page on the existing sidebar entry, and campaign creation loads the adventure store', () => {
  const rctx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Dashboard/routes-config.js'), 'utf8'), rctx);
  const routes = rctx.window.FogDashboardRoutes;
  assert.ok(!rctx.window.FogDashboardPlannedPages.includes('grimoire'));
  for (const name of ['grimoire', 'homebrew-edit']) {
    const r = routes[name];
    assert.ok(fs.existsSync(path.join(ROOT, 'Pages/Dashboard', r.fragment)), r.fragment);
    r.styles.forEach((s) => assert.ok(fs.existsSync(path.join(ROOT, 'Styles/Dashboard', s)), s));
    r.scripts.forEach((s) => assert.ok(fs.existsSync(path.join(ROOT, 'JS', s)), s));
  }
  assert.ok(routes['create-campaign'].scripts.includes('Dashboard/adventures/adventure-store.js'));
  assert.ok(routes['bestiary-spells'].scripts.includes('Dashboard/compendium/compendium-render.js'));
  const sidebar = fs.readFileSync(path.join(ROOT, 'Pages/dashboard.html'), 'utf8');
  assert.match(sidebar, /data-page="grimoire"/);
});

test('the real dashboard router sends #grimoire to the library and #grimoire/<id> to the editor', () => {
  const win = { location: { hash: '' }, addEventListener() {}, removeEventListener() {}, history: {}, document: {} };
  win.window = win;
  const rctx = vm.createContext({ window: win, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Dashboard/router.js'), 'utf8'), rctx, { filename: 'router.js' });
  const R = win.FogDashboardRouter;
  win.location.hash = '#grimoire';
  assert.deepEqual(J(R.parseHash()), { name: 'grimoire', params: {} });
  win.location.hash = '#grimoire/7f3e-abc';
  assert.deepEqual(J(R.parseHash()), { name: 'homebrew-edit', params: { id: '7f3e-abc' } });
  win.location.hash = '#adventures/a1';
  assert.equal(R.parseHash().name, 'adventure-edit', 'other routes are unchanged');
});

test('pictures: an entry keeps only its own homebrew image path; the renderer shows it under the title, escaped', () => {
  const e = M.newEntry('monster', 'Ash Wraith');
  e.data.image = { path: 'u-1/homebrew/hb1/pic.jpg' };
  assert.deepEqual(J(M.normalize(e).data.image), { path: 'u-1/homebrew/hb1/pic.jpg' });
  for (const bad of ['https://x/y.jpg', 'u-1/adventures/a1/pic.jpg', '../pic.jpg', 42]) {
    assert.equal(M.normalize(Object.assign({}, e, { data: Object.assign({}, e.data, { image: { path: bad } }) })).data.image, null, String(bad));
  }
  const html = R.homebrew(e, { imageUrl: 'https://proj.supabase.co/storage/v1/object/sign/content-images/u-1/homebrew/hb1/pic.jpg?token=a"b' });
  assert.match(html, /<\/header><figure class="cmp-portrait"><img src="https:\/\/proj\.supabase\.co\/[^"]*token=a&quot;b" alt="Ash Wraith">/);
  assert.ok(!R.homebrew(e, { imageUrl: 'javascript:alert(1)' }).includes('cmp-portrait'), 'only https, data:image and blob URLs');
  assert.ok(!R.homebrew(e).includes('cmp-portrait'));
  for (const k of M.KIND_ORDER) {
    assert.match(M.artUrl(k), new RegExp('Assets/Pictures/homebrew/' + k + '\.svg$'));
    assert.ok(fs.existsSync(path.join(ROOT, 'Assets/Pictures/homebrew', k + '.svg')), k + ' art exists');
    assert.equal(M.KINDS[k].icon, undefined, 'no emoji icons');
  }
  const attribution = fs.readFileSync(path.join(ROOT, 'Assets/Pictures/homebrew/ATTRIBUTION.md'), 'utf8');
  assert.match(attribution, /CC BY 3\.0|Creative Commons Attribution 3\.0/);
  assert.match(attribution, /Lorc/);
  assert.match(attribution, /Delapouite/);
});
