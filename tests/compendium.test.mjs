/**
 * Monsters & Spells data: the generated SRD 5.2.1 monster file and the dataset registry (FogCompendium).
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'Assets/Data/srd-5.2.1-monsters.json'), 'utf8'));
const byName = (n) => data.monsters.find((m) => m.name === n);

function loadRegistry() {
  const window = { console };
  const monstersJson = JSON.stringify(data);
  const ctx = vm.createContext({
    window, console, URL,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(monstersJson)) }),
  });
  for (const f of ['JS/character-engine/data/srd-5.2.1-core.js', 'JS/character-engine/data/srd-5.2.1-spells.js', 'JS/Dashboard/compendium/compendium-store.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return window.FogCompendium;
}

test('monster data: SRD 5.2.1 (2024), CC BY 4.0, attribution, pinned sources, 330 complete stat blocks', () => {
  assert.equal(data.meta.edition, '2024 (SRD 5.2.1)');
  assert.equal(data.meta.origin, 'official-srd');
  assert.equal(data.meta.license, 'CC BY 4.0');
  assert.match(data.meta.attribution, /System Reference Document 5\.2\.1/);
  assert.match(data.meta.generatedFrom.markdown, /@[0-9a-f]{40}/);
  assert.equal(data.monsters.length, 330);
  assert.equal(data.monsters.filter((m) => m.complete).length, 330);
});

test('stat blocks match the SRD text (spot checks)', () => {
  const d = byName('Adult Red Dragon');
  assert.deepEqual([d.size, d.type, d.typeTags, d.alignment, d.ac, d.initiative, d.hp, d.cr, d.xp, d.proficiencyBonus], ['Huge', 'Dragon', 'Chromatic', 'Chaotic Evil', '19', '+12 (22)', '256 (19d12 + 133)', '17', 18000, 6]);
  assert.deepEqual(Object.values(d.abilities).map((a) => a.score), [27, 10, 25, 16, 13, 23]);
  assert.equal(d.abilities.dex.save, '+6');
  assert.deepEqual(d.legendaryActions.map((x) => x.name), ['Commanding Presence', 'Fiery Rays', 'Pounce']);
  assert.match(d.actions.find((a) => a.name === 'Spellcasting').text, /\*\*1\/Day:\*\* _Fireball_/);
  const g = byName('Goblin Warrior');
  assert.deepEqual([g.size, g.type, g.cr, g.hp], ['Small', 'Fey', '1/4', '10 (3d6)']);
  assert.deepEqual(g.bonusActions.map((x) => x.name), ['Nimble Escape']);
  const wolf = byName('Wolf');
  assert.equal(wolf.type, 'Beast');
  assert.ok(wolf.traits.length + wolf.actions.length > 0);
});

test('typos in the source tables are filled from 5e-database and recorded on the entry', () => {
  const w = byName("Will-o'-Wisp");
  assert.equal(w.abilities.str.score, 1);
  assert.ok(w.dataNotes && /STR/.test(w.dataNotes[0]));
});

test('registry: built-in spells (339, all complete) and monsters (330) with their dataset metadata', async () => {
  const C = loadRegistry();
  await C.ready();
  assert.equal(C.errors().length, 0, C.errors().join(" "));
  const spells = C.spells();
  assert.equal(spells.length, 339);
  assert.equal(spells.filter((s) => !s.complete).length, 0, 'no spell is missing a required field');
  assert.equal(spells.find((s) => s.id === 'guidance').components, 'V, S');
  assert.equal(C.monsters().length, 330);
  assert.equal(C.monsters()[0].dataset.license, 'CC BY 4.0');
  assert.equal(C.datasets().map((d) => d.origin).join(), "official-srd,official-srd");
});

test('registry: new datasets must declare origin, edition and (unless homebrew) license and attribution', async () => {
  const C = loadRegistry();
  await C.ready();
  assert.equal(C.register({ meta: { id: 'x', kind: 'monster', origin: 'official-srd', edition: '2024' }, entries: [] }).ok, false, 'license required');
  assert.equal(C.register({ meta: { id: 'y', kind: 'spell', origin: 'mystery', edition: '2024', license: 'x', attribution: 'x' }, entries: [] }).ok, false, 'origin must be known');
  assert.equal(C.register({ meta: { id: 'z', kind: 'spell', origin: 'homebrew' }, entries: [] }).ok, false, 'edition required');
  const r = C.register({ meta: { id: 'my-homebrew', kind: 'monster', origin: 'homebrew', edition: '2024 (SRD 5.2.1)', name: 'My monsters' }, entries: [{ id: 'cinder-imp', name: 'Cinder Imp', size: 'Tiny', type: 'Fiend', ac: '13', hp: '10 (3d4 + 3)', speed: '20 ft., Fly 40 ft.', cr: '1/2', crValue: 0.5, abilities: { str: { score: 6 } }, traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [] }] });
  assert.ok(r.ok);
  const imp = C.monsters().find((m) => m.id === 'cinder-imp');
  assert.equal(imp.dataset.origin, 'homebrew');
  assert.equal(C.register({ meta: { id: 'my-homebrew', kind: 'monster', origin: 'homebrew', edition: '2024' }, entries: [] }).ok, false, 'ids are unique');
});
