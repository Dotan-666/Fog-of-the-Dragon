/**
 * Character engine tests — run with: node --test "tests/*.test.mjs"
 * Loads the browser scripts into a sandbox with a fake window/localStorage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = [
  'JS/character-engine/data/srd-5.2.1-core.js',
  'JS/character-engine/data/srd-5.2.1-spells.js',
  'JS/character-engine/rules-api.js',
  'JS/character-engine/character-options.js',
  'JS/character-engine/derive-character.js',
  'JS/character-engine/validate-character.js',
  'JS/Dashboard/characters/character-store.js',
];

function load() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const window = { localStorage, console };
  const ctx = vm.createContext({ window, console, localStorage });
  SCRIPTS.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return { w: window, store };
}

const { w } = load();
const R = w.FogRules;
const Store = w.FogCharacterStore;
const V = w.FogValidateCharacter;
const O = w.FogCharacterOptions;
const derive = w.FogDeriveCharacter;
const J = (x) => JSON.parse(JSON.stringify(x)); // normalise sandbox objects for deepEqual

/** A complete, valid level 1 Fighter used as a base for tests. */
function fighter(level = 1) {
  const d = Store.createDraft();
  Object.assign(d.choices, {
    level,
    classId: 'fighter',
    backgroundId: 'soldier',
    backgroundTool: 'gaming-set-dice',
    backgroundIncrease: { mode: '2-1', plus2: 'str', plus1: 'con' },
    speciesId: 'dwarf',
    abilityMethod: 'standard-array',
    abilityScoresBase: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    skillProficiencies: ['perception', 'survival'],
    languages: ['dwarvish', 'giant'],
    classEquipment: 'A',
    backgroundEquipment: 'A',
    weaponMasteries: ['greatsword', 'flail', 'javelin'],
  });
  d.choices.feats = { 'class-fightingStyle': { featId: 'defense' } };
  d.narrative.name = 'Test Fighter';
  V.sanitizeChoices(d);
  return d;
}

function wizard(level) {
  const d = Store.createDraft();
  Object.assign(d.choices, {
    level,
    classId: 'wizard',
    backgroundId: 'sage',
    backgroundIncrease: { mode: '2-1', plus2: 'int', plus1: 'con' },
    speciesId: 'elf',
    speciesOptions: { lineage: 'high-elf', spellAbility: 'int', skill: 'perception' },
    abilityMethod: 'point-buy',
    abilityScoresBase: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 8 },
    skillProficiencies: ['investigation', 'medicine'],
    languages: ['elvish', 'draconic'],
    classEquipment: 'A',
    backgroundEquipment: 'A',
  });
  return d;
}

test('data: attribution is the SRD 5.2.1 statement and coverage is stated', () => {
  assert.match(R.meta.attribution, /^This work includes material from the System Reference Document 5\.2\.1/);
  assert.match(R.meta.attribution, /creativecommons\.org\/licenses\/by\/4\.0\/legalcode/);
  assert.deepEqual(J(R.meta.supportedClassIds), ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']);
});

test('data: level tables match the SRD 5.2.1 text', () => {
  const wiz = R.classes.wizard.levels;
  assert.deepEqual([14, 15, 16, 17, 18, 19, 20].map((l) => wiz[l].preparedSpells), [18, 19, 21, 22, 23, 24, 25]);
  const clr = R.classes.cleric.levels;
  assert.deepEqual([1, 5, 10, 20].map((l) => clr[l].preparedSpells), [4, 9, 15, 22]);
  assert.deepEqual(J(clr[20].slots), [4, 3, 3, 3, 3, 2, 2, 1, 1]);
  assert.equal(R.classes.rogue.levels[19].sneakAttack, '10d6');
  assert.deepEqual([1, 4, 10, 16].map((l) => R.classes.fighter.levels[l].weaponMastery), [3, 4, 5, 6]);
  assert.deepEqual(J(R.classes.fighter.featLevels.map((f) => f.level)), [4, 6, 8, 12, 14, 16, 19]);
  assert.deepEqual(J(R.classes.rogue.featLevels.map((f) => f.level)), [4, 8, 10, 12, 16, 19]);
  Object.values(R.classes).forEach((c) => assert.equal(c.subclassLevel, 3, c.name + ' subclass level'));
});

test('data: complete Cleric and Wizard spell lists, levels 0–9', () => {
  const total = (id) => Object.values(R.classes[id].spellList).flat().length;
  for (let l = 0; l <= 9; l++) {
    assert.ok(R.classes.cleric.spellList[l].length > 0, 'cleric level ' + l);
    assert.ok(R.classes.wizard.spellList[l].length > 0, 'wizard level ' + l);
  }
  assert.equal(total('cleric'), 109);
  assert.equal(total('wizard'), 218);
  assert.equal(R.spells.fireball.level, 3);
  assert.equal(R.spells.wish.level, 9);
});

test('proficiency bonus for levels 1–20', () => {
  const expected = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
  expected.forEach((pb, i) => assert.equal(w.FogRulesApi.proficiencyBonus(i + 1), pb));
  Object.values(R.classes).forEach((c) => expected.forEach((pb, i) => assert.equal(c.levels[i + 1].proficiencyBonus, pb)));
});

test('valid level 1 Fighter passes every step and derives correct numbers', () => {
  const d = fighter(1);
  assert.deepEqual(J(V.validateComplete(d)), []);
  const x = derive(d);
  // Str 15+2 = 17 (+3), Con 14+1 = 15 (+2), Dex 13 (+1)
  assert.equal(x.abilities.str.score, 17);
  assert.equal(x.abilities.con.score, 15);
  // HP: d10 max 10 + 2 Con, + Dwarven Toughness 1
  assert.equal(x.combat.hpMax, 13);
  // Chain Mail 16 + Defense 1 (no shield in option A)
  assert.equal(x.combat.ac, 17);
  assert.equal(x.savingThrows.str.modifier, 5);
  assert.equal(x.skills.athletics.proficient, true); // Soldier
  assert.equal(x.skills.athletics.modifier, 5);
  assert.equal(x.combat.speed, 30);
  const gs = x.attacks.find((a) => a.name === 'Greatsword');
  assert.equal(gs.attackBonus, 5);
  assert.equal(gs.mastery, 'Graze');
});

test('HP at levels 1, 5 and 20 uses fixed values per level', () => {
  const con0 = (classId, level) => {
    const d = fighter(level);
    d.choices.classId = classId;
    d.choices.speciesId = 'human';
    d.choices.abilityScoresBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    d.choices.backgroundIncrease = { mode: '2-1', plus2: 'str', plus1: 'dex' };
    return derive(d).combat.hpMax;
  };
  assert.equal(con0('fighter', 1), 10);
  assert.equal(con0('fighter', 5), 10 + 4 * 6);
  assert.equal(con0('fighter', 20), 10 + 19 * 6);
  assert.equal(con0('wizard', 20), 6 + 19 * 4);
  assert.equal(con0('rogue', 5), 8 + 4 * 5);
  assert.equal(con0('cleric', 20), 8 + 19 * 5);
});

test('background increase cannot exceed the background abilities or 20', () => {
  const d = fighter(1);
  d.choices.backgroundIncrease = { mode: '2-1', plus2: 'int', plus1: 'str' };
  V.sanitizeChoices(d); // int is not a Soldier ability -> cleared
  assert.equal(d.choices.backgroundIncrease.plus2, null);
  assert.ok(V.validateStep(d, 'abilities').length > 0);
  d.choices.abilityMethod = 'random';
  d.choices.abilityScoresBase.str = 19;
  d.choices.backgroundIncrease = { mode: '2-1', plus2: 'str', plus1: 'con' };
  assert.ok(V.validateStep(d, 'abilities').some((e) => /above 20/.test(e.message)));
  assert.equal(derive(d).abilities.str.score, 20);
});

test('point buy and standard array validation', () => {
  const d = fighter(1);
  d.choices.abilityMethod = 'point-buy';
  d.choices.abilityScoresBase = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }; // 27 points
  assert.deepEqual(J(V.validateStep(d, 'abilities')), []);
  d.choices.abilityScoresBase.int = 9; // 28 points
  assert.ok(V.validateStep(d, 'abilities').some((e) => /28 of 27/.test(e.message)));
  d.choices.abilityMethod = 'standard-array';
  d.choices.abilityScoresBase = { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 };
  assert.ok(V.validateStep(d, 'abilities').length > 0);
});

test('level 9 Wizard: slots, counts and spellbook limits', () => {
  const d = wizard(9);
  const so = O.spellOptions(d);
  assert.equal(so.cantrips.count, 4);
  assert.equal(so.prepared.count, 14);
  assert.equal(so.spellbook.count, 6 + 2 * 8);
  assert.equal(so.maxSpellLevel, 5);
  // Level 5 spells first available at Wizard 9 -> at most 2 spells of level 5+
  assert.deepEqual(J(so.spellbook.limits.find((l) => l.spellLevel === 5)), { spellLevel: 5, max: 2 });
  const derived = derive(d);
  assert.equal(derived.spellcasting.saveDC, 8 + 4 + 3); // Int 15+2 = 17 (+3)
});

test('sanitize: level 9 → 2 keeps valid choices and drops what is no longer allowed', () => {
  const d = wizard(9);
  d.choices.subclassId = 'evoker';
  const book = R.classes.wizard.spellList;
  d.choices.spells.cantrips = book[0].slice(0, 4);
  d.choices.spells.spellbook = book[1].slice(0, 16).concat(book[2].slice(0, 2), book[3].slice(0, 2), book[4].slice(0, 2));
  d.choices.spells.prepared = d.choices.spells.spellbook.slice(0, 14);
  d.choices.feats['level-4'] = { featId: 'ability-score-improvement', abilityIncrease: { int: 2 } };
  d.choices.feats['level-8'] = { featId: 'ability-score-improvement', abilityIncrease: { dex: 1, con: 1 } };
  V.sanitizeChoices(d);
  const skillsBefore = J(d.choices.skillProficiencies);

  d.choices.level = 2;
  const notices = V.sanitizeChoices(d);
  assert.equal(d.choices.subclassId, null);
  assert.equal(d.choices.feats['level-4'], undefined);
  assert.equal(d.choices.feats['level-8'], undefined);
  assert.deepEqual(J(d.choices.skillProficiencies), skillsBefore, 'class skills are kept');
  assert.equal(d.choices.spells.cantrips.length, 3);
  assert.ok(d.choices.spells.spellbook.every((id) => R.spells[id].level === 1));
  assert.equal(d.choices.spells.spellbook.length, 8);
  assert.ok(d.choices.spells.prepared.length <= 5);
  assert.ok(notices.some((n) => /subclass/i.test(n)));
  assert.ok(notices.some((n) => /Ability Score Improvement/.test(n)));
});

test('sanitize: changing class drops class-only choices but keeps origin choices', () => {
  const d = fighter(3);
  d.choices.subclassId = 'champion';
  V.sanitizeChoices(d);
  d.choices.classId = 'rogue';
  V.sanitizeChoices(d);
  assert.equal(d.choices.subclassId, null);
  assert.equal(d.choices.feats['class-fightingStyle'], undefined);
  assert.equal(d.choices.classEquipment, 'A'); // Rogue also has option A
  assert.equal(d.choices.backgroundId, 'soldier');
  assert.equal(d.choices.speciesId, 'dwarf');
  assert.ok(d.choices.weaponMasteries.length <= 2);
  assert.ok(!d.choices.skillProficiencies.includes('survival'), 'Survival is not a Rogue skill');
  assert.ok(d.choices.skillProficiencies.includes('perception'));
});

test('feat slots: Human gets an origin feat, Grappler requires Str or Dex 13', () => {
  const d = fighter(4);
  d.choices.speciesId = 'human';
  V.sanitizeChoices(d);
  const keys = O.featSlots(d).map((s) => s.key);
  assert.deepEqual(J(keys), ['background', 'species', 'class-fightingStyle', 'level-4']);
  const slot = O.slotByKey(d, 'level-4');
  assert.ok(O.allowedFeats(d, slot).some((f) => f.id === 'grappler'));
  d.choices.abilityScoresBase = { str: 8, dex: 8, con: 15, int: 15, wis: 15, cha: 8 };
  d.choices.abilityMethod = 'point-buy';
  d.choices.backgroundIncrease = { mode: '1-1-1' };
  assert.ok(!O.allowedFeats(d, slot).some((f) => f.id === 'grappler'));
});

test('Magic Initiate from the Acolyte background is fixed to the Cleric list', () => {
  const d = fighter(1);
  d.choices.backgroundId = 'acolyte';
  d.choices.backgroundIncrease = { mode: '1-1-1' };
  V.sanitizeChoices(d);
  const inst = d.choices.feats.background;
  assert.equal(inst.featId, 'magic-initiate');
  assert.equal(inst.spellList, 'cleric');
  assert.ok(V.validateStep(d, 'feats').some((e) => /2 cantrips/.test(e.message)));
  inst.cantrips = ['guidance', 'light'];
  inst.spell1 = 'bless';
  inst.spellAbility = 'wis';
  assert.deepEqual(J(V.validateStep(d, 'feats')), []);
  const other = derive(d).otherSpells.map((s) => s.spellId);
  assert.deepEqual(J(other), ['guidance', 'light', 'bless']);
});

test('Cleric: Life Domain spells are always prepared and do not count against prepared', () => {
  const d = fighter(5);
  d.choices.classId = 'cleric';
  d.choices.subclassId = 'life-domain';
  d.choices.classOptions = { divineOrder: 'thaumaturge' };
  V.sanitizeChoices(d);
  const so = O.spellOptions(d);
  assert.equal(so.cantrips.count, 5); // 4 + Thaumaturge
  assert.equal(so.prepared.count, 9);
  assert.deepEqual(J(so.alwaysPrepared), ['aid', 'bless', 'cure-wounds', 'lesser-restoration', 'mass-healing-word', 'revivify']);
  assert.ok(!so.prepared.from.includes('bless'));
});

test('Rogue: expertise needs proficiency, Thieves’ Cant plus one extra language', () => {
  const d = fighter(6);
  d.choices.classId = 'rogue';
  d.choices.skillProficiencies = ['stealth', 'acrobatics', 'perception', 'deception'];
  d.choices.classOptions = { expertise1: ['stealth', 'arcana'], expertise6: ['athletics', 'stealth'] };
  V.sanitizeChoices(d);
  assert.deepEqual(J(d.choices.classOptions.expertise1), ['stealth']);
  assert.deepEqual(J(d.choices.classOptions.expertise6), ['athletics']);
  const lo = O.languageOptions(d);
  assert.ok(lo.known.includes('thieves-cant'));
  assert.equal(lo.extra.count, 1);
  d.choices.classOptions.expertise1 = ['stealth', 'acrobatics'];
  d.choices.classOptions.expertise6 = ['athletics', 'perception'];
  d.choices.classOptions.extraLanguage = 'infernal';
  assert.deepEqual(J(V.validateStep(d, 'proficiencies')), []);
  const x = derive(d);
  assert.equal(x.skills.stealth.modifier, x.abilities.dex.modifier + 2 * x.proficiencyBonus);
  assert.equal(x.sneakAttackDice, '3d6');
});

test('store: save, reopen and migrate schema 1 documents', () => {
  const d = fighter(1);
  const res = Store.save(d);
  assert.equal(res.ok, true);
  const back = Store.get(d.id);
  assert.equal(back.narrative.name, 'Test Fighter');
  assert.equal(back.derived.combat.hpMax, 13);
  assert.equal(Store.listSummaries().length, 1);

  const old = { id: 'c_old', schemaVersion: 1, choices: { level: 4, classId: 'fighter' }, narrative: { name: 'Old Hero', backstory: 'x' }, meta: { createdAt: '2026-01-01T00:00:00.000Z' } };
  const m = Store.migrate(old);
  assert.equal(m.schemaVersion, 2);
  assert.equal(m.status, 'draft');
  assert.equal(m.choices.level, 4);
  assert.equal(m.choices.classId, null);
  assert.equal(m.narrative.name, 'Old Hero');
  assert.ok(m.migrationNotice);
});
