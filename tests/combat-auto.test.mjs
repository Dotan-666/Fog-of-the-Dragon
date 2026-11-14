// Combat automation: defenses, conditions, roll modes, Multiattack, planning and executing a monster turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { console, setTimeout };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['JS/Campaign/combat-model.js', 'JS/Campaign/combat-actions.js', 'JS/Campaign/dice.js', 'JS/Campaign/combat-auto.js']) {
  vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
}
const { FogCombatAuto: X, FogCombatModel: M, FogCombatActions: A, FogDice } = ctx;
const monsters = JSON.parse(readFileSync('Assets/Data/srd-5.2.1-monsters.json', 'utf8')).monsters;
const byName = n => monsters.find(m => m.name === n);
/** rng that returns the given d-values in order (for an N-sided die, value v → (v-1)/N + tiny) */
function seq(values, sides = 20) { let i = 0; return () => { const v = values[Math.min(i++, values.length - 1)]; return (v - 1) / sides + 1e-9; }; }

test('defenses: immunities split into damage types and conditions', () => {
  const d = X.defenses({ immunities: 'Necrotic, Poison; Charmed, Exhaustion, Poisoned', resistances: 'Cold', vulnerabilities: 'Radiant' });
  assert.deepEqual([...d.immune], ['Necrotic', 'Poison']);
  assert.deepEqual([...d.condImmune], ['Charmed', 'Exhaustion', 'Poisoned']);
  assert.deepEqual([...d.resist], ['Cold']);
  assert.deepEqual([...d.vuln], ['Radiant']);
});

test('adjust: immune → 0, resistant → half (rounded down), vulnerable → double, mixed types unchanged', () => {
  const d = { immune: ['Poison'], resist: ['Cold'], vuln: ['Radiant'], condImmune: [] };
  assert.equal(X.adjust(9, ['Poison'], d).amount, 0);
  assert.equal(X.adjust(9, ['Cold'], d).amount, 4);
  assert.equal(X.adjust(9, ['Radiant'], d).amount, 18);
  assert.equal(X.adjust(9, ['Slashing'], d).amount, 9);
  const mixed = X.adjust(9, ['Slashing', 'Cold'], d);
  assert.equal(mixed.amount, 9);
  assert.match(mixed.note, /mixed/);
});

test('conditionsIn: only wording that imposes a condition', () => {
  assert.deepEqual([...X.conditionsIn('the target has the Grappled condition (escape DC 13).')], ['Grappled']);
  assert.deepEqual([...X.conditionsIn('the target is knocked Prone')], ['Prone']);
  assert.deepEqual([...X.conditionsIn('If the target is Prone, it takes extra damage.')], []);
});

test('rollModeFor: SRD conditions give advantage/disadvantage; both cancel', () => {
  const a = { name: 'Ogre', conditions: [] }, t = { name: 'Bree', conditions: ['Restrained'] };
  assert.equal(X.rollModeFor(a, t, 'melee').mode, 'advantage');
  assert.equal(X.rollModeFor({ name: 'Ogre', conditions: ['Poisoned'] }, t, 'melee').mode, 'normal');
  assert.equal(X.rollModeFor(a, { name: 'Bree', conditions: ['Prone'] }, 'ranged').mode, 'disadvantage');
});

test('multiattack reads the routine from real actions only', () => {
  const e = byName('Adult Red Dragon') || monsters.find(m => (m.actions || []).some(a => /^Multiattack/.test(a.name)));
  const acts = A.fromMonster(e);
  const r = X.multiattack(e, acts);
  assert.ok(r === null || r.every(a => acts.includes(a)));
});

test('plan: refuses player characters and incapacitated creatures; explains when nothing can be resolved', () => {
  const enc = M.newEncounter('T');
  M.addCombatant(enc, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 20, hpMax: 20, ac: 15 });
  const pc = enc.combatants[0];
  assert.equal(X.plan({ enc, actor: pc, actions: [] }).ok, false);
  M.addCombatant(enc, { name: 'Goblin', kind: 'monster', hp: 7, hpMax: 7, ac: 15 });
  const gob = enc.combatants[1];
  gob.conditions = ['Stunned'];
  const p1 = X.plan({ enc, actor: gob, actions: [] });
  assert.equal(p1.ok, false); assert.match(p1.reason, /Stunned/);
  gob.conditions = [];
  const p2 = X.plan({ enc, actor: gob, actions: [{ id: 'x', name: 'Taunt', group: 'action', type: 'text', damage: [] }] });
  assert.equal(p2.ok, false); assert.match(p2.reason, /yourself/);
});

test('plan + execute: a goblin attacks the PC, resolves against AC, applies damage and logs; ignores invented advice', async () => {
  const entry = byName('Goblin Warrior') || byName('Goblin');
  const actions = A.fromMonster(entry);
  const enc = M.newEncounter('T');
  M.addCombatant(enc, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 20, hpMax: 20, ac: 12 });
  M.addCombatant(enc, { name: 'Goblin', kind: 'monster', hp: 7, hpMax: 7, ac: 15, ref: 'srd:goblin' });
  const gob = enc.combatants[1], bree = enc.combatants[0];
  const p = X.plan({ enc, actor: gob, actions, entry, advice: { action: 'Fireball of Doom', targetIds: [bree.id] } });
  assert.equal(p.ok, true);
  assert.ok(actions.includes(p.steps[0].action), 'only real actions');
  // natural 18 to hit, then max damage dice
  const r = await X.execute({ enc, actor: gob, plan: p, M, dice: FogDice, rng: seq([18, 6, 6, 6, 6]), delayMs: 0, defensesOf: () => null, saveBonus: () => 0 });
  assert.equal(r.ok, true);
  assert.ok(bree.hp < 20, 'damage applied');
  assert.ok(enc.log.some(l => /vs AC 12 — hit/.test(l.text || l)), 'logged against AC');
});

test('execute: a natural 1 misses; stop between steps returns control', async () => {
  const enc = M.newEncounter('T');
  M.addCombatant(enc, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 20, hpMax: 20, ac: 5 });
  M.addCombatant(enc, { name: 'Brute', kind: 'monster', hp: 30, hpMax: 30, ac: 12 });
  const atk = { id: 'action:hit', name: 'Hit', group: 'action', type: 'attack', bonus: 10, attackKind: 'melee', damage: [{ dice: '1d6', type: 'Bludgeoning' }], onHit: '' };
  const plan = { ok: true, why: 'test', steps: [{ action: atk, targetIds: [enc.combatants[0].id] }, { action: atk, targetIds: [enc.combatants[0].id] }] };
  let n = 0;
  const r = await X.execute({ enc, actor: enc.combatants[1], plan, M, dice: FogDice, rng: seq([1]), delayMs: 0, shouldStop: () => n++ > 0 });
  assert.equal(enc.combatants[0].hp, 20, 'natural 1 always misses even with +10 vs AC 5');
  assert.equal(r.stopped, true);
});

test('execute: saving throw uses DC (not AC), halves on success, respects immunity', async () => {
  const enc = M.newEncounter('T');
  M.addCombatant(enc, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 40, hpMax: 40, ac: 30 });
  M.addCombatant(enc, { name: 'Wyrm', kind: 'monster', hp: 100, hpMax: 100, ac: 18 });
  const breath = { id: 'action:breath', name: 'Breath', group: 'action', type: 'save', ability: 'dex', abilityName: 'Dexterity', dc: 15, multi: true, half: true, damage: [{ dice: '4d6', type: 'Fire' }], onFail: '' };
  const plan = { ok: true, why: 'test', steps: [{ action: breath, targetIds: [enc.combatants[0].id] }] };
  // save roll 20 (+0) = success; damage 4d6 all 6s = 24 → halved 12
  await X.execute({ enc, actor: enc.combatants[1], plan, M, dice: FogDice, rng: seq([20, 6, 6, 6, 6].map((v, i) => i ? v * 20 / 6 : v)), delayMs: 0, saveBonus: () => 0, defensesOf: () => null });
  assert.equal(enc.combatants[0].hp, 28, 'AC 30 is irrelevant to a save; half of 24');
  const enc2 = M.newEncounter('T');
  M.addCombatant(enc2, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 40, hpMax: 40, ac: 10 });
  M.addCombatant(enc2, { name: 'Wyrm', kind: 'monster', hp: 100, hpMax: 100, ac: 18 });
  await X.execute({ enc: enc2, actor: enc2.combatants[1], plan: { ok: true, why: 't', steps: [{ action: breath, targetIds: [enc2.combatants[0].id] }] }, M, dice: FogDice, rng: seq([1]), delayMs: 0, saveBonus: () => 0, defensesOf: () => ({ immune: ['Fire'], resist: [], vuln: [], condImmune: [] }) });
  assert.equal(enc2.combatants[0].hp, 40, 'immune to Fire');
});

test('recharge: spent abilities are not planned; start of turn rolls to recharge', () => {
  const enc = M.newEncounter('T');
  M.addCombatant(enc, { name: 'Bree', kind: 'pc', userId: 'u1', hp: 20, hpMax: 20, ac: 12 });
  M.addCombatant(enc, { name: 'Hound', kind: 'monster', hp: 30, hpMax: 30, ac: 12 });
  const h = enc.combatants[1];
  const breath = { id: 'action:fire-breath', name: 'Fire Breath (Recharge 5–6)', recharge: 'Recharge 5–6', group: 'action', type: 'save', multi: true, dc: 12, ability: 'dex', abilityName: 'Dexterity', damage: [{ dice: '6d6', type: 'Fire' }] };
  const bite = { id: 'action:bite', name: 'Bite', group: 'action', type: 'attack', bonus: 4, damage: [{ dice: '1d8', type: 'Piercing' }] };
  enc.recharge = { [h.id]: { [breath.id]: 'spent' } };
  const p = X.plan({ enc, actor: h, actions: [breath, bite] });
  assert.equal(p.steps[0].action.id, 'action:bite');
  const lines = X.startOfTurn(enc, h, [breath, bite], () => 5 / 6 + 0.01);
  assert.match(lines[0], /recharges/);
  assert.equal(enc.recharge[h.id][breath.id], undefined);
});
