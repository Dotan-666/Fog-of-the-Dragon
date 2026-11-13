/**
 * The campaign's current encounter, shared by the Combat page and the Bestiary ("Add to encounter").
 *
 * The DM loads and saves the full encounter (FogCombatModel); players only ever get the public view the DM's browser
 * wrote alongside it (no monster hit points, AC or notes; see publicView in combat-model.js). Saves carry the version
 * that was loaded, so a second tab or device can't silently overwrite newer changes.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogCombatModel; };
  var D = function () { return global.FogCampaignData; };

  /** SRD 5.2.1 condition names (from the rules glossary: the entries tagged "Condition"). */
  function conditionNames() {
    var g = (global.FogRules && global.FogRules.glossary) || {};
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (e) { return e.tag === 'Condition'; }).map(function (e) { return e.name; }).sort();
  }

  function conditionText(name) {
    var g = (global.FogRules && global.FogRules.glossary) || {};
    var hit = Object.keys(g).map(function (k) { return g[k]; }).filter(function (e) { return e.tag === 'Condition' && e.name === name; })[0];
    return hit ? hit.text : '';
  }

  function firstInt(v, fallback) {
    var n = parseInt(String(v == null ? '' : v).replace(/[^\d+-]/g, ''), 10);
    return isFinite(n) ? n : fallback;
  }

  /** A compendium monster (SRD or homebrew) → a combatant. Numbers come from the stat block, never invented. */
  function monsterCombatant(entry, label) {
    var hp = entry.hpAverage != null ? entry.hpAverage : firstInt(entry.hp, 0);
    var dex = entry.abilities && entry.abilities.dex ? firstInt(entry.abilities.dex.mod, 0) : 0;
    return {
      kind: 'monster', name: label || entry.name, hpMax: hp, hp: hp, ac: firstInt(entry.ac, null),
      initMod: entry.initiative != null && /^[+-]?\d/.test(String(entry.initiative)) ? firstInt(String(entry.initiative).split(' ')[0], dex) : dex,
      ref: entry.key || null,
    };
  }

  function pcCombatant(member, campaign) {
    var s = global.FogCampaignParty.summarize(member.character, campaign);
    return {
      kind: 'pc', name: member.characterName || member.displayName, userId: member.userId,
      hpMax: s && s.hpMax != null ? s.hpMax : 0, hp: s && s.hpMax != null ? s.hpMax : 0,
      ac: s && s.ac != null ? s.ac : null, initMod: s && s.initMod != null ? s.initMod : 0,
    };
  }

  /** Loads the encounter: the DM gets the full one (with its version), players the public view. */
  async function load(ctx) {
    var res = await D().getCombat(ctx.id, ctx.isDm);
    if (!res.ok) return res;
    return { ok: true, encounter: res.encounter, version: res.version == null ? null : res.version };
  }

  /** Adds `count` copies of a monster to the encounter (creating one if needed) and saves. Names get 1, 2, 3 when several. */
  async function addMonsters(ctx, entry, count) {
    if (!ctx.isDm) return { ok: false, message: 'Only the Dungeon Master can run combat.' };
    if (ctx.campaign.status === 'archived') return { ok: false, message: 'Restore the campaign before running combat.' };
    var cur = await load(ctx);
    if (!cur.ok) return cur;
    var enc = cur.encounter && cur.encounter.status !== 'ended' ? cur.encounter : M().newEncounter('Encounter');
    var n = Math.max(1, Math.min(20, Number(count) || 1));
    var existing = enc.combatants.filter(function (c) { return c.ref === entry.key; }).length;
    for (var i = 0; i < n; i++) {
      var label = n > 1 || existing ? entry.name + ' ' + (existing + i + 1) : entry.name;
      var added = M().addCombatant(enc, monsterCombatant(entry, label));
      if (!added.ok) return added;
    }
    var saved = await D().saveCombat(ctx.id, enc, cur.encounter && cur.encounter.status !== 'ended' ? cur.version : null);
    if (!saved.ok) return saved;
    return { ok: true, count: n, started: enc.status === 'active' };
  }

  global.FogCombatSession = { conditionNames: conditionNames, conditionText: conditionText, monsterCombatant: monsterCombatant, pcCombatant: pcCombatant, load: load, addMonsters: addMonsters };
})(window);
