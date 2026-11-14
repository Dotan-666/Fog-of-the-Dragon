/**
 * Combat tracker model (no UI, no database): the bookkeeping of one encounter.
 *
 * This is a tracker, not a rules engine. It remembers who is in the fight, their initiative, whose turn it is,
 * hit points, temporary hit points and conditions. It does not roll attacks, apply damage types, resistances,
 * saving throws or any other rule: the table does that and the Dungeon Master types the result in.
 * The only rules it applies are the SRD 5.2.1 ones for the numbers it holds:
 *   - Temporary Hit Points absorb damage first; healing never exceeds the maximum and never adds Temporary HP.
 *   - Initiative is a d20 + the Dexterity modifier (rolled on request; advantage and bonuses are typed in).
 *   - A creature is Bloodied while it has half its Hit Points or fewer (what players see for monsters).
 * Convenience (not a rule): a monster at 0 HP is marked defeated and skipped; player characters at 0 HP stay in
 * the order, because their turns still matter (Death Saving Throws).
 *
 * Encounter: { schema: 1, name, status: 'setup' | 'active' | 'ended', paused, round, turnId, combatants: [...], log: [...] }
 * Combatant: { id, kind: 'pc' | 'monster' | 'npc', name, userId, initiative, initMod, ac, hpMax, hp, tempHp,
 *              conditions: [name], hidden, removed, notes, ref }
 *
 * publicView(encounter) is what players receive: monster hit points, AC, notes and hidden combatants are left out.
 */
(function (global) {
  'use strict';

  var MAX_COMBATANTS = 60;
  var MAX_LOG = 150;
  var KINDS = ['pc', 'monster', 'npc'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function int(v, fallback) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : fallback;
  }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function newEncounter(name) {
    return { schema: 1, name: String(name || 'Encounter').slice(0, 80), status: 'setup', paused: false, round: 0, turnId: null, combatants: [], log: [] };
  }

  function normalizeCombatant(c) {
    var hpMax = Math.max(0, int(c.hpMax, 0));
    var hp = c.hp == null || c.hp === '' ? hpMax : int(c.hp, hpMax);
    return {
      id: c.id || uid(),
      kind: KINDS.indexOf(c.kind) >= 0 ? c.kind : 'monster',
      name: String(c.name || 'Creature').trim().slice(0, 80) || 'Creature',
      userId: c.userId || null,
      initiative: c.initiative == null || c.initiative === '' ? null : int(c.initiative, null),
      initMod: int(c.initMod, 0),
      ac: c.ac == null || c.ac === '' ? null : Math.max(0, int(c.ac, 0)),
      hpMax: hpMax,
      hp: Math.max(0, Math.min(hpMax, hp)),
      tempHp: Math.max(0, int(c.tempHp, 0)),
      conditions: Array.isArray(c.conditions) ? c.conditions.filter(function (x, i, a) { return typeof x === 'string' && a.indexOf(x) === i; }).slice(0, 20) : [],
      hidden: !!c.hidden,
      removed: !!c.removed,
      notes: String(c.notes || '').slice(0, 500),
      ref: c.ref || null, // for example the compendium entry the monster came from
    };
  }

  function find(enc, id) {
    for (var i = 0; i < enc.combatants.length; i++) if (enc.combatants[i].id === id) return enc.combatants[i];
    return null;
  }

  function addCombatant(enc, data) {
    if (enc.combatants.length >= MAX_COMBATANTS) return { ok: false, message: 'An encounter can hold up to ' + MAX_COMBATANTS + ' combatants.' };
    var c = normalizeCombatant(data);
    if (c.kind === 'pc' && c.userId && enc.combatants.some(function (x) { return x.kind === 'pc' && x.userId === c.userId; })) {
      return { ok: false, message: c.name + ' is already in this encounter.' };
    }
    enc.combatants.push(c);
    return { ok: true, combatant: c };
  }

  function removeCombatant(enc, id) {
    var wasTurn = enc.turnId === id;
    var order = turnOrder(enc);
    var idx = order.findIndex(function (c) { return c.id === id; });
    enc.combatants = enc.combatants.filter(function (c) { return c.id !== id; });
    if (wasTurn && enc.status === 'active') {
      var after = turnOrder(enc);
      enc.turnId = after.length ? (after[idx % after.length] || after[0]).id : null;
    }
  }

  function isDefeated(c) { return c.kind !== 'pc' && c.hpMax > 0 && c.hp === 0; }
  function inFight(c) { return !c.removed && !isDefeated(c); }

  /** Everyone still in the fight, highest initiative first; ties go to the higher modifier, then to who was added first. */
  function turnOrder(enc) {
    return enc.combatants
      .map(function (c, i) { return { c: c, i: i }; })
      .filter(function (x) { return inFight(x.c) && x.c.initiative != null; })
      .sort(function (a, b) {
        return (b.c.initiative - a.c.initiative) || (b.c.initMod - a.c.initMod) || (a.i - b.i);
      })
      .map(function (x) { return x.c; });
  }

  function missingInitiative(enc) {
    return enc.combatants.filter(function (c) { return inFight(c) && c.initiative == null; });
  }

  function pushLog(enc, text) {
    enc.log.push({ at: Date.now(), round: enc.round, text: String(text).slice(0, 200) });
    if (enc.log.length > MAX_LOG) enc.log = enc.log.slice(-MAX_LOG);
  }

  function start(enc) {
    if (enc.status === 'active') return { ok: false, message: 'The encounter is already running.' };
    var fighting = enc.combatants.filter(inFight);
    if (fighting.length < 2) return { ok: false, message: 'Add at least two combatants before starting.' };
    var missing = missingInitiative(enc);
    if (missing.length) return { ok: false, message: 'Initiative is missing for ' + missing.map(function (c) { return c.name; }).join(', ') + '.' };
    enc.status = 'active';
    enc.round = 1;
    enc.turnId = turnOrder(enc)[0].id;
    pushLog(enc, 'Combat started.');
    return { ok: true };
  }

  function currentCombatant(enc) {
    return enc.status === 'active' && enc.turnId ? find(enc, enc.turnId) : null;
  }

  /** Moves to the next creature in the order; a new round starts after the last one. */
  function nextTurn(enc) {
    if (enc.status !== 'active') return { ok: false, message: 'Start the encounter first.' };
    if (enc.paused) return { ok: false, message: 'Combat is paused. Resume it first.' };
    var order = turnOrder(enc);
    if (!order.length) return { ok: false, message: 'Nobody is left in the fight.' };
    var idx = order.findIndex(function (c) { return c.id === enc.turnId; });
    var next = idx < 0 ? 0 : idx + 1;
    if (next >= order.length) {
      next = 0;
      enc.round += 1;
      pushLog(enc, 'Round ' + enc.round + ' begins.');
    }
    enc.turnId = order[next].id;
    return { ok: true, combatant: order[next] };
  }

  function previousTurn(enc) {
    if (enc.status !== 'active') return { ok: false, message: 'Start the encounter first.' };
    if (enc.paused) return { ok: false, message: 'Combat is paused. Resume it first.' };
    var order = turnOrder(enc);
    if (!order.length) return { ok: false, message: 'Nobody is left in the fight.' };
    var idx = order.findIndex(function (c) { return c.id === enc.turnId; });
    var prev = idx - 1;
    if (prev < 0) {
      if (enc.round <= 1) return { ok: false, message: 'This is the first turn of the first round.' };
      prev = order.length - 1;
      enc.round -= 1;
    }
    enc.turnId = order[prev].id;
    return { ok: true, combatant: order[prev] };
  }

  /** Who acts after the current creature (null when nobody else is in the fight). */
  function nextUp(enc) {
    if (enc.status !== 'active') return null;
    var order = turnOrder(enc);
    if (order.length < 2) return null;
    var idx = order.findIndex(function (c) { return c.id === enc.turnId; });
    return order[(idx + 1) % order.length];
  }

  function pause(enc) {
    if (enc.status !== 'active') return { ok: false, message: 'Only a running combat can be paused.' };
    enc.paused = true;
    pushLog(enc, 'Combat paused.');
    return { ok: true };
  }

  function resume(enc) {
    enc.paused = false;
    pushLog(enc, 'Combat resumed.');
    return { ok: true };
  }

  function end(enc) {
    enc.paused = false;
    enc.status = 'ended';
    enc.turnId = null;
    pushLog(enc, 'Combat ended after ' + enc.round + ' round' + (enc.round === 1 ? '' : 's') + '.');
  }

  function reopen(enc) {
    // Back to setup: keeps the combatants (and their initiative), resets the round counter.
    enc.status = 'setup';
    enc.paused = false;
    enc.round = 0;
    enc.turnId = null;
  }

  /** Damage: Temporary Hit Points go first, then Hit Points (never below 0). */
  function damage(enc, id, amount) {
    var c = find(enc, id);
    var n = int(amount, NaN);
    if (!c || !(n > 0)) return { ok: false, message: 'Enter an amount greater than 0.' };
    var left = n;
    var absorbed = Math.min(c.tempHp, left);
    c.tempHp -= absorbed;
    left -= absorbed;
    c.hp = Math.max(0, c.hp - left);
    pushLog(enc, c.name + ' takes ' + n + ' damage' + (absorbed ? ' (' + absorbed + ' absorbed by Temporary Hit Points)' : '') + '.');
    if (isDefeated(c)) {
      pushLog(enc, c.name + ' is defeated.');
      if (enc.status === 'active' && enc.turnId === c.id) {
        var order = turnOrder(enc);
        if (order.length) {
          // The defeated creature's turn is over: continue with whoever comes next in the original order.
          var all = enc.combatants.filter(function (x) { return !x.removed && x.initiative != null; }).sort(function (a, b) { return (b.initiative - a.initiative) || (b.initMod - a.initMod); });
          var at = all.findIndex(function (x) { return x.id === c.id; });
          for (var k = 1; k <= all.length; k++) {
            var cand = all[(at + k) % all.length];
            if (inFight(cand)) {
              if (at + k >= all.length) { enc.round += 1; pushLog(enc, 'Round ' + enc.round + ' begins.'); }
              enc.turnId = cand.id;
              break;
            }
          }
        }
      }
    }
    return { ok: true };
  }

  function heal(enc, id, amount) {
    var c = find(enc, id);
    var n = int(amount, NaN);
    if (!c || !(n > 0)) return { ok: false, message: 'Enter an amount greater than 0.' };
    var before = c.hp;
    c.hp = Math.min(c.hpMax, c.hp + n);
    pushLog(enc, c.name + ' regains ' + (c.hp - before) + ' Hit Points.');
    return { ok: true };
  }

  function setTempHp(enc, id, amount) {
    var c = find(enc, id);
    var n = int(amount, NaN);
    if (!c || !(n >= 0)) return { ok: false, message: 'Enter 0 or more.' };
    // Temporary Hit Points don't stack: a new amount replaces the old one only if the DM chooses to; the tracker just sets it.
    c.tempHp = n;
    return { ok: true };
  }

  function toggleCondition(enc, id, name, conditionNames) {
    var c = find(enc, id);
    if (!c) return { ok: false, message: 'Unknown combatant.' };
    if (conditionNames && conditionNames.indexOf(name) < 0) return { ok: false, message: 'Unknown condition.' };
    var i = c.conditions.indexOf(name);
    if (i >= 0) {
      c.conditions.splice(i, 1);
      pushLog(enc, c.name + ' is no longer ' + name + '.');
    } else {
      c.conditions.push(name);
      pushLog(enc, c.name + ' is ' + name + '.');
    }
    return { ok: true };
  }

  function setInitiative(enc, id, value) {
    var c = find(enc, id);
    if (!c) return { ok: false, message: 'Unknown combatant.' };
    c.initiative = value === '' || value == null ? null : int(value, null);
    return { ok: true };
  }

  /** d20 + modifier. `rng` is injectable for tests (returns [0,1)). */
  function rollInitiative(c, rng) {
    var roll = Math.floor((rng || Math.random)() * 20) + 1;
    return { roll: roll, total: roll + c.initMod };
  }

  function bloodied(c) { return c.hpMax > 0 && c.hp > 0 && c.hp * 2 <= c.hpMax; }

  /** What the players see. Monster numbers, notes and hidden combatants never leave the DM's browser. */
  function publicView(enc) {
    var view = { schema: 1, name: enc.name, status: enc.status, paused: !!enc.paused, round: enc.round, turnId: null, nextId: null, combatants: [] };
    var shown = {};
    var order = turnOrder(enc);
    enc.combatants.forEach(function (c) {
      if (c.hidden || c.removed) return;
      shown[c.id] = true;
      var p = { id: c.id, kind: c.kind, name: c.name, userId: c.kind === 'pc' ? c.userId : null, initiative: c.initiative, conditions: c.conditions.slice(), defeated: isDefeated(c) };
      if (c.kind === 'pc') {
        p.hp = c.hp; p.hpMax = c.hpMax; p.tempHp = c.tempHp; p.ac = c.ac;
      } else {
        p.health = isDefeated(c) ? 'defeated' : bloodied(c) ? 'bloodied' : 'unhurt';
      }
      view.combatants.push(p);
    });
    var cur = enc.turnId;
    if (cur && shown[cur]) view.turnId = cur;
    else if (cur) view.turnId = null; // a hidden creature's turn: nobody is highlighted
    var up = nextUp(enc);
    if (up && shown[up.id]) view.nextId = up.id;
    view.order = order.filter(function (c) { return shown[c.id]; }).map(function (c) { return c.id; });
    return view;
  }

  /** A line in the event log (attacks, saves, effects). */
  function log(enc, text) { pushLog(enc, text); return { ok: true }; }

  global.FogCombatModel = {
    log: log,
    MAX_COMBATANTS: MAX_COMBATANTS,
    newEncounter: newEncounter,
    normalizeCombatant: normalizeCombatant,
    addCombatant: addCombatant,
    removeCombatant: removeCombatant,
    find: find,
    turnOrder: turnOrder,
    missingInitiative: missingInitiative,
    start: start,
    nextTurn: nextTurn,
    previousTurn: previousTurn,
    end: end,
    reopen: reopen,
    currentCombatant: currentCombatant,
    nextUp: nextUp,
    pause: pause,
    resume: resume,
    damage: damage,
    heal: heal,
    setTempHp: setTempHp,
    toggleCondition: toggleCondition,
    setInitiative: setInitiative,
    rollInitiative: rollInitiative,
    isDefeated: isDefeated,
    bloodied: bloodied,
    publicView: publicView,
    clone: clone,
  };
})(typeof window !== 'undefined' ? window : globalThis);
