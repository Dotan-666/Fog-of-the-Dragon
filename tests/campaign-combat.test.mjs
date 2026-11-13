/**
 * Combat tracker rules (JS/Campaign/combat-model.js): turn order, rounds, damage with Temporary Hit Points,
 * defeated monsters, and what players are allowed to see.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

const window = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Campaign/combat-model.js'), 'utf8'), vm.createContext({ window, console, Math, Date, JSON }), { filename: 'combat-model.js' });
const M = window.FogCombatModel;
// Values created inside the vm sandbox have another Array prototype; compare them as JSON.
const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, msg);

function fight() {
  const e = M.newEncounter('Ambush');
  M.addCombatant(e, { id: 'a', kind: 'pc', name: 'Brienne', userId: 'u1', hpMax: 28, ac: 16, initMod: 2, initiative: 15 });
  M.addCombatant(e, { id: 'b', kind: 'pc', name: 'Tobias', userId: 'u2', hpMax: 20, ac: 12, initMod: 4, initiative: 12 });
  M.addCombatant(e, { id: 'g1', kind: 'monster', name: 'Goblin 1', hpMax: 10, ac: 15, initMod: 2, initiative: 12, notes: 'has the key', ref: 'srd:goblin' });
  M.addCombatant(e, { id: 'g2', kind: 'monster', name: 'Goblin 2', hpMax: 10, ac: 15, initMod: 2, initiative: 8, hidden: true });
  return e;
}

test('initiative order: highest first, ties go to the higher modifier, then who was added first', () => {
  const e = fight();
  same(M.turnOrder(e).map((c) => c.id), ['a', 'b', 'g1', 'g2']); // b and g1 tie at 12; b has +4
});

test('starting needs two combatants and everyone’s initiative', () => {
  const e = M.newEncounter('x');
  M.addCombatant(e, { id: 'a', kind: 'pc', name: 'A', hpMax: 5 });
  assert.match(M.start(e).message, /at least two/);
  M.addCombatant(e, { id: 'b', kind: 'monster', name: 'B', hpMax: 5, initiative: 3 });
  assert.match(M.start(e).message, /Initiative is missing for A/);
  M.setInitiative(e, 'a', 10);
  assert.ok(M.start(e).ok);
  assert.equal(e.round, 1);
  assert.equal(e.turnId, 'a');
  assert.match(M.start(e).message, /already running/);
});

test('turns advance in order and a new round begins after the last creature; previous goes back', () => {
  const e = fight();
  M.start(e);
  assert.equal(e.turnId, 'a');
  M.nextTurn(e); M.nextTurn(e); M.nextTurn(e);
  assert.equal(e.turnId, 'g2');
  assert.equal(e.round, 1);
  M.nextTurn(e);
  same([e.turnId, e.round], ['a', 2]);
  M.previousTurn(e);
  same([e.turnId, e.round], ['g2', 1]);
  const first = fight(); M.start(first);
  assert.match(M.previousTurn(first).message, /first turn/);
});

test('damage uses Temporary Hit Points first, never goes below 0; healing stops at the maximum and ignores temp', () => {
  const e = fight();
  M.setTempHp(e, 'a', 5);
  M.damage(e, 'a', 8);
  const a = M.find(e, 'a');
  same([a.tempHp, a.hp], [0, 25]);
  M.damage(e, 'a', 100);
  assert.equal(a.hp, 0);
  assert.equal(M.isDefeated(a), false, 'player characters at 0 HP stay in the fight (death saves)');
  M.heal(e, 'a', 500);
  assert.equal(a.hp, 28);
  assert.equal(a.tempHp, 0);
  assert.match(M.damage(e, 'a', 0).message, /greater than 0/);
  assert.match(M.damage(e, 'a', 'abc').message, /greater than 0/);
});

test('a monster at 0 HP is defeated and skipped; if it was its turn, play moves on', () => {
  const e = fight();
  M.start(e);
  M.nextTurn(e); M.nextTurn(e); // g1
  assert.equal(e.turnId, 'g1');
  M.damage(e, 'g1', 10);
  assert.ok(M.isDefeated(M.find(e, 'g1')));
  assert.equal(e.turnId, 'g2', 'turn passes to the next creature');
  same(M.turnOrder(e).map((c) => c.id), ['a', 'b', 'g2']);
  M.nextTurn(e);
  same([e.turnId, e.round], ['a', 2]);
});

test('removing the current combatant passes the turn on', () => {
  const e = fight();
  M.start(e);
  M.removeCombatant(e, 'a');
  assert.equal(e.turnId, 'b');
});

test('conditions toggle, unknown ones are refused, and the same character cannot join twice', () => {
  const e = fight();
  const names = ['Prone', 'Poisoned'];
  assert.ok(M.toggleCondition(e, 'a', 'Prone', names).ok);
  same(M.find(e, 'a').conditions, ['Prone']);
  assert.match(M.toggleCondition(e, 'a', 'Sleepy', names).message, /Unknown condition/);
  M.toggleCondition(e, 'a', 'Prone', names);
  same(M.find(e, 'a').conditions, []);
  assert.match(M.addCombatant(e, { kind: 'pc', name: 'Brienne again', userId: 'u1', hpMax: 5 }).message, /already in this encounter/);
});

test('initiative roll is d20 plus the modifier', () => {
  same(M.rollInitiative({ initMod: 3 }, () => 0), { roll: 1, total: 4 });
  same(M.rollInitiative({ initMod: -1 }, () => 0.999), { roll: 20, total: 19 });
});

test('players never receive monster hit points, AC, notes or hidden combatants', () => {
  const e = fight();
  M.start(e);
  M.damage(e, 'g1', 6);
  const view = M.publicView(e);
  const json = JSON.stringify(view);
  assert.ok(!/has the key|notes|"ac":15|Goblin 2/.test(json), json);
  const g1 = view.combatants.find((c) => c.id === 'g1');
  assert.equal(g1.health, 'bloodied');
  assert.equal(g1.hp, undefined);
  assert.equal(g1.hpMax, undefined);
  const pc = view.combatants.find((c) => c.id === 'a');
  same([pc.hp, pc.hpMax, pc.ac], [28, 28, 16]);
  same(view.order, ['a', 'b', 'g1']);
  // a hidden creature's turn highlights nobody
  M.nextTurn(e); M.nextTurn(e); M.nextTurn(e);
  assert.equal(e.turnId, 'g2');
  assert.equal(M.publicView(e).turnId, null);
});

test('an encounter holds at most 60 combatants', () => {
  const e = M.newEncounter('Horde');
  for (let i = 0; i < 60; i++) assert.ok(M.addCombatant(e, { kind: 'monster', name: 'Rat ' + i, hpMax: 1 }).ok);
  assert.match(M.addCombatant(e, { kind: 'monster', name: 'One too many', hpMax: 1 }).message, /up to 60/);
});

test('pause blocks turn changes until resumed; players are told; "up next" follows the order and skips the defeated', () => {
  const e = fight();
  assert.match(M.pause(e).message, /Only a running combat/);
  M.start(e);
  assert.equal(M.nextUp(e).id, 'b');
  assert.ok(M.pause(e).ok);
  assert.match(M.nextTurn(e).message, /paused/);
  assert.match(M.previousTurn(e).message, /paused/);
  assert.equal(e.turnId, 'a', 'nothing moved');
  const view = M.publicView(e);
  assert.equal(view.paused, true);
  assert.equal(view.nextId, 'b');
  M.resume(e);
  assert.ok(M.nextTurn(e).ok);
  assert.equal(e.turnId, 'b');
  M.damage(e, 'g1', 10); // the next one is defeated: it is skipped
  assert.equal(M.nextUp(e).id, 'g2');
  assert.equal(M.publicView(e).nextId, null, 'a hidden creature is never named as up next');
  M.end(e);
  assert.equal(e.paused, false);
  assert.equal(M.nextUp(e), null);
});
