/**
 * Dice roller (JS/Campaign/dice.js): notation, fair random numbers, totals, and the animation switch that follows the
 * Dashboard setting “3D Animated Dice”. Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

function load(settings, reduced = false) {
  const window = { crypto: globalThis.crypto, FogSettings: settings ? { get: () => settings } : undefined, matchMedia: () => ({ matches: reduced }) };
  const ctx = vm.createContext({ window, console, Math, Date, JSON, Uint32Array, Promise, setTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Campaign/dice.js'), 'utf8'), ctx, { filename: 'dice.js' });
  return window.FogDice;
}
const same = (a, b) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b);
const D = load({ dice3d: true });

test('notation: d20, 2d6+3, 4d8-1, d%, spaces; bad input is explained', () => {
  same(D.parse('d20'), { count: 1, sides: 20, modifier: 0 });
  same(D.parse('2d6+3'), { count: 2, sides: 6, modifier: 3 });
  same(D.parse(' 4 D 8 - 1 '), { count: 4, sides: 8, modifier: -1 });
  same(D.parse('d%'), { count: 1, sides: 100, modifier: 0 });
  same(D.parse('3d100'), { count: 3, sides: 100, modifier: 0 });
  for (const bad of ['', 'banana', '0d6', '21d6', 'd1', 'd1001', '2d6+', '2d6+1000', 'd20 d20', '1.5d6']) assert.ok(D.parse(bad).error, bad);
});

test('rolls: totals add the modifier; a roll can be as low as 1 and as high as the die; text shows the working', () => {
  const lo = D.rollSpec({ count: 2, sides: 6, modifier: 3 }, () => 0);
  same(lo.rolls, [1, 1]);
  assert.equal(lo.total, 5);
  assert.equal(lo.text, '2d6+3: [1 + 1] + 3 = 5');
  const hi = D.rollSpec({ count: 3, sides: 8, modifier: -2 }, () => 0.999999);
  same(hi.rolls, [8, 8, 8]);
  assert.equal(hi.total, 22);
  assert.equal(hi.text, '3d8−2: [8 + 8 + 8] − 2 = 22');
  assert.equal(D.rollSpec({ count: 1, sides: 20, modifier: 0 }, () => 0.5).text, 'd20: 11 = 11'.replace('d20', '1d20'));
});

test('random numbers are fair: every face of a d6 and a d20 comes up about equally often, none outside 1..sides', () => {
  for (const sides of [6, 20, 7]) {
    const n = 60000;
    const counts = new Array(sides + 1).fill(0);
    for (let i = 0; i < n; i++) counts[D.cryptoInt(sides)]++;
    assert.equal(counts[0], 0);
    const expected = n / sides;
    for (let f = 1; f <= sides; f++) assert.ok(Math.abs(counts[f] - expected) < expected * 0.08, `d${sides} face ${f}: ${counts[f]} vs ~${Math.round(expected)}`);
  }
});

test('animation follows the setting: on only when 3D Animated Dice is on and motion is not reduced', () => {
  assert.equal(load({ dice3d: true }).animationOn(), true);
  assert.equal(load({ dice3d: false }).animationOn(), false);
  assert.equal(load(undefined).animationOn(), false, 'no settings at all: no animation');
  assert.equal(load({ dice3d: true }, true).animationOn(), false, 'reduced motion wins');
});

test('roll(): without the animation the result comes straight back; bad notation never rolls', async () => {
  const off = load({ dice3d: false });
  const r = await off.roll('2d6+1');
  assert.equal(r.ok, true);
  assert.equal(r.rolls.length, 2);
  assert.ok(r.total >= 3 && r.total <= 13);
  const bad = await off.roll('nonsense');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Write a roll like/);
});
