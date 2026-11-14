/**
 * Combat automation (no UI, no database): resolving attacks and saves against the real numbers, and playing a monster's
 * turn for the Dungeon Master ("Full Auto"). Everything comes from the stat block, the character sheet and the encounter;
 * nothing is invented. What the rules engine can't know (positions, cover, reactions, text-only abilities) is NOT simulated:
 * the turn says so in the log and leaves it to the DM.
 *
 *   FogCombatAuto.defenses(entry)              stat block → { resist, immune, vuln (damage types), condImmune (conditions) }
 *   FogCombatAuto.adjust(amount, types, def)   damage after immunity / resistance / vulnerability → { amount, note }
 *   FogCombatAuto.conditionsIn(text)           SRD conditions an action imposes ("has the Prone condition", "is Grappled")
 *   FogCombatAuto.rollModeFor(attacker, target, attackKind) → { mode, why[] }    from SRD 5.2.1 conditions
 *   FogCombatAuto.rechargeMin(text)            "Recharge 5–6" → 5
 *   FogCombatAuto.multiattack(entry, actions)  the Multiattack routine → [action, …] (only when it names real actions)
 *   FogCombatAuto.plan(o)                      what the creature does this turn → { ok, steps:[{ action, targetIds }], why } | { ok:false, reason }
 *   FogCombatAuto.execute(o)                   rolls and applies a plan step by step (stoppable) → Promise<{ ok, stopped, lines }>
 *   FogCombatAuto.startOfTurn(enc, actor, actions, rng)  recharge rolls → [log lines]
 *   FogCombatAuto.turnKey(enc)                 identifies this exact turn (guards against playing it twice)
 *
 * Never for player characters: plan() refuses them.
 */
(function (global) {
  'use strict';

  var DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
  var CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
  // Conditions that stop a creature from taking actions (SRD 5.2.1: Incapacitated, and the conditions that include it)
  var NO_ACTIONS = ['Incapacitated', 'Paralyzed', 'Petrified', 'Stunned', 'Unconscious'];

  function words(s) { return String(s || '').split(/[,;]|\band\b/).map(function (w) { return w.trim(); }).filter(Boolean); }
  function pick(list, s) { var out = []; words(s).forEach(function (w) { list.forEach(function (t) { if (new RegExp('^' + t + '\\b', 'i').test(w) && out.indexOf(t) < 0) out.push(t); }); }); return out; }

  /** Stat block strings ("Acid, Cold; Charmed, Frightened": damage types before ";", conditions after). */
  function defenses(entry) {
    var d = { resist: [], immune: [], vuln: [], condImmune: [] };
    if (!entry) return d;
    var imm = String(entry.immunities || '');
    var i = imm.indexOf(';');
    d.immune = pick(DAMAGE_TYPES, i >= 0 ? imm.slice(0, i) : imm);
    d.condImmune = pick(CONDITIONS, i >= 0 ? imm.slice(i + 1) : imm);
    d.resist = pick(DAMAGE_TYPES, String(entry.resistances || '').split(';')[0]);
    d.vuln = pick(DAMAGE_TYPES, String(entry.vulnerabilities || '').split(';')[0]);
    return d;
  }

  /**
   * One damage roll against one creature. types: the action's damage types. When an action deals several types the total
   * can't be split reliably, so it is applied unchanged unless all of them are affected the same way (then it's said why).
   */
  function adjust(amount, types, def) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    if (!def || !types || !types.length || !amount) return { amount: amount, note: '' };
    var uniq = types.filter(function (t, i, l) { return l.indexOf(t) === i; });
    var how = uniq.map(function (t) { return def.immune.indexOf(t) >= 0 ? 'immune' : def.resist.indexOf(t) >= 0 ? 'resist' : def.vuln.indexOf(t) >= 0 ? 'vuln' : 'normal'; });
    var same = how.every(function (h) { return h === how[0]; });
    if (!same) return { amount: amount, note: 'mixed damage types (' + uniq.join(', ') + '): check resistances by hand' };
    if (how[0] === 'immune') return { amount: 0, note: 'immune to ' + uniq.join('/') };
    if (how[0] === 'resist') return { amount: Math.floor(amount / 2), note: 'resistant to ' + uniq.join('/') + ' (halved from ' + amount + ')' };
    if (how[0] === 'vuln') return { amount: amount * 2, note: 'vulnerable to ' + uniq.join('/') + ' (doubled from ' + amount + ')' };
    return { amount: amount, note: '' };
  }

  function conditionsIn(text) {
    var t = String(text || '');
    var out = [];
    // Only wording that IMPOSES a condition ("the target has the Grappled condition", "is knocked Prone"); a check such as
    // "if the target is Prone" is not counted.
    CONDITIONS.forEach(function (c) {
      var re = new RegExp('\\b(?:has|have|gains?) the ' + c + ' condition' + (c === 'Prone' ? '|\\b(?:knocked|falls?) Prone' : ''), 'i');
      if (re.test(t) && !new RegExp('\\b(?:doesn.t|don.t|not) (?:have|has) the ' + c, 'i').test(t) && out.indexOf(c) < 0) out.push(c);
    });
    return out;
  }

  /** Advantage / disadvantage from SRD 5.2.1 conditions (only what the conditions themselves say). */
  function rollModeFor(attacker, target, attackKind) {
    var adv = [], dis = [];
    var ac = (attacker && attacker.conditions) || [], tc = (target && target.conditions) || [];
    if (ac.indexOf('Blinded') >= 0) dis.push(attacker.name + ' is Blinded');
    if (ac.indexOf('Poisoned') >= 0) dis.push(attacker.name + ' is Poisoned');
    if (ac.indexOf('Frightened') >= 0) dis.push(attacker.name + ' is Frightened (if the source is in sight)');
    if (ac.indexOf('Prone') >= 0) dis.push(attacker.name + ' is Prone');
    if (ac.indexOf('Restrained') >= 0) dis.push(attacker.name + ' is Restrained');
    if (ac.indexOf('Invisible') >= 0) adv.push(attacker.name + ' is Invisible');
    if (tc.indexOf('Blinded') >= 0) adv.push(target.name + ' is Blinded');
    if (tc.indexOf('Restrained') >= 0) adv.push(target.name + ' is Restrained');
    if (tc.indexOf('Paralyzed') >= 0) adv.push(target.name + ' is Paralyzed');
    if (tc.indexOf('Stunned') >= 0) adv.push(target.name + ' is Stunned');
    if (tc.indexOf('Unconscious') >= 0) adv.push(target.name + ' is Unconscious');
    if (tc.indexOf('Petrified') >= 0) adv.push(target.name + ' is Petrified');
    if (tc.indexOf('Invisible') >= 0) dis.push(target.name + ' is Invisible');
    if (tc.indexOf('Prone') >= 0) (attackKind === 'ranged' ? dis : adv).push(target.name + ' is Prone (' + (attackKind === 'ranged' ? 'ranged' : 'assumed within 5 feet') + ')');
    var mode = adv.length && !dis.length ? 'advantage' : dis.length && !adv.length ? 'disadvantage' : 'normal';
    return { mode: mode, why: adv.concat(dis), cancelled: !!(adv.length && dis.length) };
  }

  function rechargeMin(text) { var m = /Recharge\s+(\d)/i.exec(String(text || '')); return m ? Number(m[1]) : null; }

  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, once: 1, twice: 2 };
  /** "makes two Claw attacks and one Bite attack" → [Claw, Claw, Bite]; null when it can't be read with certainty. */
  function multiattack(entry, actions) {
    var ma = entry && (entry.actions || []).find(function (a) { return /^Multiattack/i.test(a.name || ''); });
    if (!ma) return null;
    var text = String(ma.text || '').replace(/_/g, '');
    var byName = function (n) { n = n.toLowerCase(); return actions.find(function (a) { return a.type !== 'text' && a.group === 'action' && a.name.toLowerCase().replace(/\s*\(.*\)$/, '') === n; }); };
    var out = [];
    var re = /\b(one|two|three|four|five|six)\s+([A-Z][\w' -]*?)\s+attacks?\b/g, m;
    while ((m = re.exec(text))) {
      var a = byName(m[2].trim());
      if (!a) return null; // a name we can't match exactly: let the DM run it
      for (var i = 0; i < NUM[m[1].toLowerCase()]; i++) out.push(a);
    }
    if (!out.length) {
      // "makes two attacks, using X or Y": use the strongest of the named ones
      var n = /makes\s+(one|two|three|four|five|six)\s+attacks/i.exec(text);
      var named = actions.filter(function (a) { return a.type === 'attack' && a.group === 'action' && text.indexOf(a.name.replace(/\s*\(.*\)$/, '')) >= 0; });
      if (n && named.length) { var best = named.sort(function (x, y) { return avg(y) - avg(x); })[0]; for (var j = 0; j < NUM[n[1].toLowerCase()]; j++) out.push(best); }
    }
    return out.length ? out : null;
  }

  function avg(a) { return (a.damage || []).reduce(function (s, d) { return s + (Number(d.average) || diceAvg(d.dice)); }, 0); }
  function diceAvg(dice) { var m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(dice || '')); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 + Number(m[3] || 0) : Number(dice) || 0; }
  function alive(c) { return c && !c.removed && !(c.kind === 'pc' ? false : c.hpMax > 0 && c.hp === 0); }
  function standing(c) { return c && !c.removed && c.hp > 0; }

  function turnKey(enc) { return enc ? enc.round + ':' + enc.turnId : ''; }

  function startOfTurn(enc, actor, actions, rng) {
    var lines = [];
    var spent = (enc.recharge && enc.recharge[actor.id]) || {};
    actions.forEach(function (a) {
      var min = rechargeMin(a.recharge);
      if (!min || !spent[a.id]) return;
      var r = 1 + Math.floor((rng ? rng() : Math.random()) * 6);
      if (r >= min) { delete spent[a.id]; lines.push(actor.name + '’s ' + a.name + ' recharges (rolled ' + r + ').'); }
      else lines.push(actor.name + '’s ' + a.name + ' doesn’t recharge (rolled ' + r + ', needs ' + min + '+).');
    });
    return lines;
  }

  /**
   * o: { enc, actor, actions, entry, advice?: { action, targetIds } }
   * Targets are the player characters still standing (hidden creatures and other monsters are never targeted). Positions
   * aren't known, so reach and range are assumed; the log says so.
   */
  function plan(o) {
    var enc = o.enc, c = o.actor;
    if (!c) return { ok: false, reason: 'Nobody is acting.' };
    if (c.kind === 'pc') return { ok: false, reason: 'Foggy never plays player characters.' };
    var blocked = (c.conditions || []).filter(function (x) { return NO_ACTIONS.indexOf(x) >= 0; });
    if (blocked.length) return { ok: false, reason: c.name + ' is ' + blocked.join(' and ') + ' and can’t take actions this turn.', skip: true };
    var targets = enc.combatants.filter(function (t) { return t.kind === 'pc' && standing(t) && !t.hidden; });
    if (!targets.length) return { ok: false, reason: 'No player character is standing for ' + c.name + ' to attack.' };
    var spent = (enc.recharge && enc.recharge[c.id]) || {};
    var usable = (o.actions || []).filter(function (a) { return a.group === 'action' && (a.type === 'attack' || a.type === 'save') && (a.damage || []).length && !(rechargeMin(a.recharge) && spent[a.id]) && !/\/Day/i.test(a.recharge || ''); });
    if (!usable.length) return { ok: false, reason: c.name + ' has no attack or saving-throw action Foggy can resolve (only text abilities, or none). Run this turn yourself.' };
    var weakest = targets.slice().sort(function (x, y) { return (x.hp - y.hp) || ((x.ac || 0) - (y.ac || 0)); })[0];
    // 1. Foggy's suggestion, when it names a real, usable action and real targets
    if (o.advice && o.advice.action) {
      var sug = usable.find(function (a) { return a.name === o.advice.action; });
      var tids = (o.advice.targetIds || []).filter(function (id) { return targets.some(function (t) { return t.id === id; }); });
      if (sug) {
        if (!tids.length) tids = [weakest.id];
        if (sug.type === 'save' && sug.multi) return { ok: true, steps: [{ action: sug, targetIds: tids }], why: 'Foggy chose ' + sug.name + '.' };
        return { ok: true, steps: [{ action: sug, targetIds: [tids[0]] }], why: 'Foggy chose ' + sug.name + ' against ' + targets.find(function (t) { return t.id === tids[0]; }).name + '.' };
      }
    }
    // 2. A ready recharge ability that hits several creatures
    var area = usable.filter(function (a) { return a.type === 'save' && a.multi; }).sort(function (x, y) { return avg(y) - avg(x); })[0];
    if (area && rechargeMin(area.recharge) && targets.length >= 2) {
      return { ok: true, steps: [{ action: area, targetIds: targets.map(function (t) { return t.id; }) }], why: area.name + ' is ready and can catch several characters (who is inside the area isn’t tracked: all standing characters are assumed).' };
    }
    // 3. The Multiattack routine, else the strongest single attack, against the most wounded character
    var routine = multiattack(o.entry, usable);
    if (routine) return { ok: true, steps: routine.map(function (a) { return { action: a, targetIds: [weakest.id] }; }), why: 'Multiattack against ' + weakest.name + ', the most wounded character.' };
    var best = usable.slice().sort(function (x, y) { return avg(y) - avg(x); })[0];
    return { ok: true, steps: [{ action: best, targetIds: best.type === 'save' && best.multi ? targets.map(function (t) { return t.id; }) : [weakest.id] }], why: best.name + ' (its strongest action) against ' + weakest.name + ', the most wounded character.' };
  }

  function rollDice(rollSpec, parse, text, rng) {
    if (/^\d+$/.test(String(text))) return { total: Number(text), text: String(text) };
    var spec = parse(text);
    if (spec.error) return { total: 0, text: text };
    var r = rollSpec(spec, rng);
    return { total: r.total, text: r.text, rolls: r.rolls };
  }

  /**
   * o: { enc, actor, plan, M (FogCombatModel), dice: { parse, rollSpec }, rng?, saveBonus(c, ability), defensesOf(c),
   *      conditionNames, shouldStop(), onStep(line), delayMs? }
   * Each step is applied to the encounter immediately (and logged) so a stop leaves a consistent state.
   */
  async function execute(o) {
    var enc = o.enc, c = o.actor, M = o.M, lines = [];
    var wait = function () { return new Promise(function (r) { setTimeout(r, o.delayMs == null ? 700 : o.delayMs); }); };
    function say(t) { lines.push(t); M.log(enc, '🤖 ' + t); if (o.onStep) o.onStep(t); }
    say('Foggy plays ' + c.name + '’s turn: ' + o.plan.why);
    for (var s = 0; s < o.plan.steps.length; s++) {
      if (o.shouldStop && o.shouldStop()) { say('Stopped by the Dungeon Master: the rest of the turn is yours.'); return { ok: true, stopped: true, lines: lines }; }
      var step = o.plan.steps[s], a = step.action;
      var types = (a.damage || []).map(function (d) { return d.type; });
      var conds = conditionsIn(a.type === 'attack' ? a.onHit : a.onFail);
      for (var ti = 0; ti < step.targetIds.length; ti++) {
        var t = M.find(enc, step.targetIds[ti]);
        if (!t || !standing(t)) continue;
        var def = o.defensesOf ? o.defensesOf(t) : null;
        if (a.type === 'attack') {
          var rm = rollModeFor(c, t, a.attackKind);
          var d20 = rollDice(o.dice.rollSpec, o.dice.parse, rm.mode === 'normal' ? '1d20' : '2d20', o.rng).rolls || [10];
          var nat = rm.mode === 'advantage' ? Math.max.apply(null, d20) : rm.mode === 'disadvantage' ? Math.min.apply(null, d20) : d20[0];
          var total = nat + (Number(a.bonus) || 0);
          var crit = nat === 20, hit = crit || (nat !== 1 && t.ac != null && total >= t.ac);
          var head = c.name + ' → ' + t.name + ', ' + a.name + ': ' + (rm.mode !== 'normal' ? rm.mode + ' (' + rm.why.join('; ') + '), d20 ' + d20.join('/') + ' → ' : 'd20 ' + nat + ' ') + (a.bonus >= 0 ? '+' : '') + a.bonus + ' = ' + total + (t.ac != null ? ' vs AC ' + t.ac : ' (no AC recorded)');
          if (t.ac == null && !crit && nat !== 1) { say(head + ' — no AC to compare with: decide it yourself.'); continue; }
          if (!hit) { say(head + ' — ' + (nat === 1 ? 'natural 1, miss.' : 'miss.')); continue; }
          var dmgText = [], dmg = 0;
          (a.damage || []).forEach(function (d) {
            var m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(d.dice);
            var dice = m ? (crit ? Number(m[1]) * 2 : Number(m[1])) + 'd' + m[2] + (m[3] || '') : d.dice;
            var r = rollDice(o.dice.rollSpec, o.dice.parse, dice, o.rng);
            dmg += r.total; dmgText.push(r.total + ' ' + d.type);
          });
          var adj = adjust(dmg, types, def);
          if (adj.amount > 0) M.damage(enc, t.id, adj.amount);
          var condTxt = applyConditions(o, t, conds, def);
          say(head + ' — ' + (crit ? 'critical hit! ' : 'hit: ') + adj.amount + ' damage (' + dmgText.join(' + ') + (adj.note ? '; ' + adj.note : '') + ').' + condTxt);
        } else {
          var bonus = o.saveBonus ? o.saveBonus(t, a.ability) : null;
          var sr = rollDice(o.dice.rollSpec, o.dice.parse, '1d20', o.rng).total;
          var st = sr + (bonus || 0);
          var ok = st >= a.dc;
          var raw = 0, parts = [];
          (a.damage || []).forEach(function (d) { var r = rollDice(o.dice.rollSpec, o.dice.parse, d.dice, o.rng); raw += r.total; parts.push(r.total + ' ' + d.type); });
          var base = ok ? (a.half ? Math.floor(raw / 2) : 0) : raw;
          var adj2 = adjust(base, types, def);
          if (adj2.amount > 0) M.damage(enc, t.id, adj2.amount);
          var condTxt2 = ok ? '' : applyConditions(o, t, conds, def);
          say(t.name + ' makes a DC ' + a.dc + ' ' + a.abilityName + ' save against ' + a.name + ': ' + sr + (bonus != null ? (bonus >= 0 ? ' +' : ' ') + bonus : ' (no save bonus known: +0 used)') + ' = ' + st + ' — ' + (ok ? 'success' : 'failure') + ', ' + adj2.amount + ' damage' + (raw ? ' (' + parts.join(' + ') + (ok && a.half ? ', halved' : '') + (adj2.note ? '; ' + adj2.note : '') + ')' : '') + '.' + condTxt2);
        }
      }
      if (rechargeMin(a.recharge)) { enc.recharge = enc.recharge || {}; enc.recharge[c.id] = enc.recharge[c.id] || {}; enc.recharge[c.id][a.id] = 'spent'; }
      if (s < o.plan.steps.length - 1) await wait();
    }
    if (/\b(within|feet|ft\.)/.test(o.plan.steps.map(function (x) { return x.action.reach || x.action.area || ''; }).join(' '))) say('Movement and range aren’t tracked: move ' + c.name + ' on the map if needed.');
    return { ok: true, stopped: false, lines: lines };
  }

  function applyConditions(o, t, conds, def) {
    if (!conds.length) return '';
    var added = [], skipped = [];
    conds.forEach(function (cn) {
      if (def && def.condImmune.indexOf(cn) >= 0) { skipped.push(cn + ' (immune)'); return; }
      if (t.conditions.indexOf(cn) >= 0) return;
      if ((o.conditionNames || CONDITIONS).indexOf(cn) < 0) return;
      o.M.toggleCondition(o.enc, t.id, cn, o.conditionNames || CONDITIONS);
      added.push(cn);
    });
    return (added.length ? ' ' + t.name + ' now has: ' + added.join(', ') + ' (check the ability text for escape DCs and duration).' : '') + (skipped.length ? ' Not applied: ' + skipped.join(', ') + '.' : '');
  }

  global.FogCombatAuto = {
    DAMAGE_TYPES: DAMAGE_TYPES, CONDITIONS: CONDITIONS, NO_ACTIONS: NO_ACTIONS,
    defenses: defenses, adjust: adjust, conditionsIn: conditionsIn, rollModeFor: rollModeFor, rechargeMin: rechargeMin,
    multiattack: multiattack, plan: plan, execute: execute, startOfTurn: startOfTurn, turnKey: turnKey,
  };
})(typeof window !== 'undefined' ? window : globalThis);
