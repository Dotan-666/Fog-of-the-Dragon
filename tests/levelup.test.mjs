/**
 * Level up (SRD 5.2.1 "Gaining a Level"): Hit Points per level are the fixed value or a recorded Hit Die roll,
 * and new levels bring the choices the rules engine asks for.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, autoBuild, J } from './helpers/sandbox.mjs';

const { w } = load();
const V = w.FogValidateCharacter;
const derive = w.FogDeriveCharacter;

test('hit points: fixed value by default, recorded Hit Die rolls replace it for their level', () => {
  const { doc } = autoBuild(w, 'fighter', 3);
  const con = derive(doc).abilities.con.modifier;
  const fixed = derive(doc).combat.hpMax;
  assert.equal(fixed, 10 + con + 2 * Math.max(1, 6 + con));
  doc.choices.hpRolls = { 3: { die: 10, value: 1 } };
  V.sanitizeChoices(doc);
  assert.equal(derive(doc).combat.hpMax, 10 + con + Math.max(1, 6 + con) + Math.max(1, 1 + con));
  assert.ok(derive(doc).combat.hpBreakdown.some((l) => /rolled 1/.test(l)));
});

test('sanitize drops rolls above the level, with the wrong die, or out of range', () => {
  const { doc } = autoBuild(w, 'wizard', 4);
  doc.choices.hpRolls = { 1: { die: 6, value: 3 }, 2: { die: 6, value: 4 }, 3: { die: 10, value: 4 }, 4: { die: 6, value: 7 }, 9: { die: 6, value: 2 } };
  V.sanitizeChoices(doc);
  assert.deepEqual(J(doc.choices.hpRolls), { 2: { die: 6, value: 4 } });
  doc.choices.level = 1;
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.hpRolls, undefined);
});

test('levelling a complete character up asks for the new level’s choices (Fighter 3 → 4 needs a feat)', () => {
  const { doc, errors } = autoBuild(w, 'fighter', 3);
  assert.deepEqual(J(errors), []);
  doc.choices.level = 4;
  V.sanitizeChoices(doc);
  const featErrors = V.validateStep(doc, 'feats');
  assert.ok(featErrors.length > 0, 'an Ability Score Improvement slot must be filled');
  assert.ok(V.validateComplete(doc).length > 0);
});

test('levelling up keeps every earlier choice', () => {
  const { doc } = autoBuild(w, 'cleric', 2);
  const before = J(doc.choices);
  doc.choices.level = 3;
  V.sanitizeChoices(doc);
  assert.equal(doc.choices.classId, before.classId);
  assert.deepEqual(J(doc.choices.abilityScoresBase), before.abilityScoresBase);
  assert.deepEqual(J(doc.choices.spells.cantrips), before.spells.cantrips);
  assert.deepEqual(J(doc.choices.spells.prepared), before.spells.prepared);
});
