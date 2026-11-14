/**
 * Combat actions (no UI, no database): what a combatant can actually do, read from the data the app already has.
 *
 *   FogCombatActions.fromMonster(entry)       an SRD 5.2.1 or homebrew stat block (compendium shape) → actions
 *   FogCombatActions.fromDerived(derived)     a character's derived sheet (FogDeriveCharacter) → weapon attacks + spells
 *   FogCombatActions.forCombatant(c, ctx)     the actions for one combatant in the encounter (looked up, never copied in)
 *   FogCombatActions.resolveAttack(opts)      the numbers of one attack against one target (pure; dice are passed in)
 *
 * Action: { id, name, group: action|bonus|reaction|legendary|spell, type: attack|save|text,
 *           bonus?, reach?, attackKind?, dc?, ability?, area?, multi?, half?, damage: [{ dice, average, type }], text, recharge? }
 * Only what the stat block or sheet says is returned: nothing is invented. Text-only abilities stay "text" (the DM resolves them).
 */
(function (global) {
  'use strict';

  var ABIL = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha' };
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'action'; }
  function strip(t) { return String(t || '').replace(/_/g, '').replace(/\*\*/g, '').trim(); }

  /** All "N (XdY + Z) Type damage" pieces in a text. */
  function damages(text) {
    var out = [];
    var re = /(\d+)\s*\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)\s*([A-Z][a-z]+)\s+damage/g;
    var m;
    while ((m = re.exec(text))) out.push({ average: Number(m[1]), dice: m[2].replace(/−/g, '-').replace(/\s+/g, ''), type: m[3] });
    if (!out.length) {
      var flat = /(?:Hit:_?\s*|Failure:_?\s*)(\d+)\s+([A-Z][a-z]+)\s+damage/.exec(text);
      if (flat) out.push({ average: Number(flat[1]), dice: flat[1], type: flat[2] });
    }
    return out;
  }

  function parseAction(a, group) {
    var name = String(a.name || '').trim();
    var text = String(a.text || '');
    var rech = /\((Recharge [^)]+|\d+\/Day[^)]*)\)/i.exec(name);
    var base = { id: group + ':' + slug(name), name: name, group: group, text: strip(text), recharge: rech ? rech[1] : null, damage: [] };
    var atk = /^_(Melee|Ranged|Melee or Ranged) Attack Roll:_\s*([+−-]\d+)\s*,?\s*([^_]*?)\s*_Hit:_\s*([\s\S]*)$/.exec(text);
    if (atk) {
      return Object.assign(base, {
        type: 'attack', attackKind: atk[1].toLowerCase(), bonus: Number(atk[2].replace('−', '-')), reach: atk[3].replace(/[.,]\s*$/, '').trim(),
        damage: damages(atk[4]), onHit: strip(atk[4]).slice(0, 400),
      });
    }
    var sv = /^_(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:_\s*DC\s*(\d+)\s*,?\s*([^_]*?)\s*(?:_Failure:_\s*([\s\S]*?))?\s*(?:_Success:_\s*([\s\S]*?))?\s*(?:_Failure or Success:_[\s\S]*)?$/.exec(text);
    if (sv) {
      var area = (sv[3] || '').replace(/[.,]\s*$/, '').trim();
      return Object.assign(base, {
        type: 'save', ability: ABIL[sv[1]], abilityName: sv[1], dc: Number(sv[2]), area: area,
        multi: /each|every|creatures/i.test(area), half: /half damage/i.test(sv[5] || ''),
        damage: damages(sv[4] || ''), onFail: strip(sv[4] || '').slice(0, 400), onSuccess: strip(sv[5] || '').slice(0, 200),
      });
    }
    return Object.assign(base, { type: 'text' });
  }

  function fromMonster(entry) {
    if (!entry) return [];
    var out = [];
    [['actions', 'action'], ['bonusActions', 'bonus'], ['reactions', 'reaction'], ['legendaryActions', 'legendary']].forEach(function (p) {
      (entry[p[0]] || []).forEach(function (a) { if (a && a.name) out.push(parseAction(a, p[1])); });
    });
    return out;
  }

  /** "1d8 +3 Slashing" / "4 Bludgeoning" (the derived sheet's damage text). */
  function parsePcDamage(s) {
    var m = /^\s*(\d+d\d+|\d+)\s*([+−-]\s*\d+)?\s*([A-Z][a-z]+)\s*$/.exec(String(s || ''));
    if (!m) return [];
    var dice = m[1] + (m[2] ? m[2].replace(/\s+/g, '').replace('−', '-') : '');
    return [{ dice: dice, average: null, type: m[3] }];
  }

  function fromDerived(d, spellLookup) {
    if (!d) return [];
    var out = (d.attacks || []).map(function (a) {
      return {
        id: 'attack:' + slug(a.name), name: a.name, group: 'action', type: 'attack', attackKind: /ranged|bow|crossbow|sling|dart/i.test(a.name) || (a.properties || []).some(function (p) { return /Ammunition|Thrown/i.test(p); }) ? 'ranged' : 'melee',
        bonus: a.attackBonus, reach: (a.properties || []).join(', '), damage: parsePcDamage(a.damage), text: a.name + ': ' + (a.attackBonus >= 0 ? '+' : '') + a.attackBonus + ' to hit, ' + a.damage + (a.notes ? '. ' + a.notes : ''),
        mastery: a.mastery || null,
      };
    });
    var sc = d.spellcasting;
    var ids = sc ? [].concat(sc.cantrips || [], sc.prepared || [], sc.alwaysPrepared || []) : [];
    var seen = {};
    ids.forEach(function (id) {
      if (seen[id]) return;
      seen[id] = true;
      var s = spellLookup ? spellLookup(id) : null;
      if (!s) return;
      var desc = strip(s.description || s.text || '');
      var save = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i.exec(desc);
      var attack = /(melee|ranged) spell attack/i.test(desc) || /spell attack/i.test(desc);
      var dmg = /(\d+d\d+)\s+([A-Z][a-z]+)\s+damage/i.exec(desc);
      out.push({
        id: 'spell:' + slug(s.name), name: s.name, group: 'spell', level: s.level, type: attack ? 'attack' : save ? 'save' : 'text',
        bonus: attack ? sc.attackBonus : undefined, dc: save ? sc.saveDC : undefined, ability: save ? ABIL[save[1].charAt(0).toUpperCase() + save[1].slice(1).toLowerCase()] : undefined,
        abilityName: save ? save[1].charAt(0).toUpperCase() + save[1].slice(1).toLowerCase() : undefined,
        damage: dmg ? [{ dice: dmg[1], average: null, type: dmg[2].charAt(0).toUpperCase() + dmg[2].slice(1).toLowerCase() }] : [],
        text: (s.level ? 'Level ' + s.level + ' spell. ' : 'Cantrip. ') + desc.slice(0, 600),
      });
    });
    return out;
  }

  /** The actions of one combatant, looked up from the compendium (monsters) or the party (characters). */
  function forCombatant(c, ctx) {
    if (!c) return [];
    if (c.kind === 'pc') {
      var m = ctx && ctx.campaign && (ctx.campaign.roster || []).find(function (r) { return r.userId === c.userId; });
      var s = m && m.character && global.FogCampaignParty ? global.FogCampaignParty.summarize(m.character, ctx.campaign) : null;
      var getSpell = global.FogRulesApi && global.FogRulesApi.getSpell ? function (id) { return global.FogRulesApi.getSpell(id); } : null;
      return s && s.derived ? fromDerived(s.derived, getSpell) : [];
    }
    if (c.ref && global.FogCompendium) return fromMonster(global.FogCompendium.monsters().find(function (m) { return m.key === c.ref; }));
    return [];
  }

  /**
   * The numbers of one attack or save against one target. Dice results are passed in (from FogDice or typed by hand), so this
   * stays pure and testable. attack: { d20: [a, b?], mode: normal|advantage|disadvantage } → total vs AC; natural 20 = critical
   * hit (damage dice doubled by the caller's roll), natural 1 = miss. save: the target's save total vs DC; half on success.
   */
  function resolveAttack(o) {
    var a = o.action;
    if (a.type === 'attack') {
      var dice = (o.d20 || []).filter(function (n) { return n >= 1 && n <= 20; });
      if (!dice.length) return { needsRoll: true };
      var nat = o.mode === 'advantage' ? Math.max.apply(null, dice) : o.mode === 'disadvantage' ? Math.min.apply(null, dice) : dice[0];
      var total = nat + (Number(a.bonus) || 0);
      var crit = nat === 20;
      var hit = crit ? true : nat === 1 ? false : o.ac == null ? null : total >= o.ac; // null: the DM decides (AC hidden from players)
      return { nat: nat, total: total, crit: crit, hit: hit, damage: hit === false ? 0 : o.damageRolled == null ? null : Math.max(0, o.damageRolled) };
    }
    if (a.type === 'save') {
      if (o.saveTotal == null) return { needsSave: true };
      var success = o.saveTotal >= a.dc;
      var dmg = o.damageRolled == null ? null : success ? (a.half ? Math.floor(o.damageRolled / 2) : 0) : o.damageRolled;
      return { success: success, damage: dmg };
    }
    return { manual: true };
  }

  /** Dice text for damage (doubled dice on a critical hit, per the SRD: roll the damage dice twice). */
  function damageDice(action, crit) {
    return (action.damage || []).map(function (d) {
      var m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(d.dice);
      if (!m) return d.dice;
      return (crit ? Number(m[1]) * 2 : Number(m[1])) + 'd' + m[2] + (m[3] || '');
    });
  }

  global.FogCombatActions = { fromMonster: fromMonster, fromDerived: fromDerived, forCombatant: forCombatant, parseAction: parseAction, resolveAttack: resolveAttack, damageDice: damageDice, parsePcDamage: parsePcDamage };
})(typeof window !== 'undefined' ? window : globalThis);
