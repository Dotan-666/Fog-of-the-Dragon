/**
 * Custom backgrounds (SRD "Parts of a Background" structure) next to the 4 SRD backgrounds.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, autoBuild, J } from './helpers/sandbox.mjs';

const { w } = load();
const O = w.FogCharacterOptions;
const V = w.FogValidateCharacter;
const derive = w.FogDeriveCharacter;

function custom(overrides = {}) {
  const cb = Object.assign({ name: 'Ship’s Hand', abilities: ['str', 'dex', 'wis'], featId: 'alert', skills: ['athletics', 'perception'], toolId: 'navigators-tools' }, overrides);
  return autoBuild(w, 'fighter', 1, {
    backgroundId: 'custom',
    choices: { backgroundId: 'custom', customBackground: cb, backgroundIncrease: { mode: '2-1', plus2: 'str', plus1: 'dex' } },
  });
}

test('the 4 SRD backgrounds stay available', () => {
  assert.deepEqual(J(w.FogRulesApi.listBackgrounds().map((b) => b.id)), ['acolyte', 'criminal', 'sage', 'soldier']);
});

test('a complete custom background validates and applies its feat, skills, tool, abilities and 50 GP', () => {
  const { doc, errors } = custom();
  assert.deepEqual(J(errors), []);
  const d = derive(doc);
  assert.ok(d.skills.athletics.proficient && d.skills.perception.proficient);
  assert.ok(d.proficiencies.tools.indexOf('Navigator’s Tools'.replace('’', "'")) >= 0);
  assert.ok(d.features.some((f) => f.name === 'Alert'));
  assert.equal(d.combat.initiative, d.abilities.dex.modifier + d.proficiencyBonus, 'Alert adds Proficiency Bonus');
  assert.equal(d.abilities.str.score, doc.choices.abilityScoresBase.str + 2);
  assert.ok(d.gold >= 50);
  assert.equal(O.backgroundOf(doc).name, 'Ship’s Hand');
});

test('custom background rules: 3 abilities, an Origin feat, 2 skills, a tool, a name', () => {
  const doc = custom().doc;
  doc.choices.customBackground = { name: '', abilities: ['str'], featId: 'grappler', skills: ['athletics'], toolId: null };
  const errs = V.validateStep(doc, 'background').map((e) => e.message).join(' | ');
  assert.match(errs, /name/);
  assert.match(errs, /3 different abilities/);
  assert.match(errs, /Origin feat/);
  assert.match(errs, /2 different skill/);
  assert.match(errs, /tool/);
});

test('sanitizing: a General feat or invalid picks are removed; choosing an SRD background drops the custom one', () => {
  const doc = custom().doc;
  doc.choices.customBackground.featId = 'grappler';
  doc.choices.customBackground.skills = ['athletics', 'athletics', 'stealth', 'arcana'];
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.customBackground.featId, null);
  assert.deepEqual(J(doc.choices.customBackground.skills), ['athletics', 'stealth']);
  assert.ok(!O.featSlots(doc).some((s) => s.key === 'background'), 'no background feat slot until a feat is chosen');
  doc.choices.backgroundId = 'sage';
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.customBackground, undefined);
});

test('custom background with Magic Initiate lets the player choose the spell list', () => {
  const { doc, errors } = custom({ featId: 'magic-initiate' });
  assert.deepEqual(J(errors), []);
  const slot = O.slotByKey(doc, 'background');
  assert.deepEqual(J(O.magicInitiateLists(doc, slot)), ['cleric', 'druid', 'wizard']);
});
