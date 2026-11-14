/**
 * Start an adventure's encounter (campaign, DM only): prepares Combat from the encounter and takes the DM there.
 *
 *   FogEncounterLauncher.start(ctx, adventure, encounter) → { ok, notes } | { ok:false, message }
 *
 * What it does, using what already exists:
 *   - Combat: a new encounter (FogCombatModel) with the party (characters from the campaign) and the encounter's monsters,
 *     looked up by reference in Monsters & Spells (FogCompendium, SRD 5.2.1 + homebrew; never copied). Monsters that can't be
 *     found are listed, not invented. The encounter remembers where it came from (adventure, encounter, section) and its
 *     monster-turn mode (Manual / Foggy Assist / Full Auto). A running encounter is only replaced after the DM confirms.
 *   - Adventure position: the campaign's current section (campaign_progress) and the active session's position.
 *   - Map: if the encounter has a map asset with a picture, it is published to the campaign's shared map with tokens.
 *   - Music: the encounter's track is offered on the Combat page (it never starts by itself).
 *   - Then: Combat, with "← Back to the adventure" (FogCampaignReturn).
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogCombatModel; };
  var S = function () { return global.FogCombatSession; };
  var D = function () { return global.FogCampaignData; };

  async function start(ctx, adv, e) {
    if (!ctx.isDm) return { ok: false, message: 'Only the Dungeon Master starts encounters.' };
    if (ctx.campaign.status === 'archived') return { ok: false, message: 'Restore the campaign before running combat.' };
    if (global.FogCompendium && global.FogCompendium.ready) await global.FogCompendium.ready();
    if (global.FogCompendiumPage && global.FogCompendiumPage.loadHomebrew) await global.FogCompendiumPage.loadHomebrew();
    var cur = await S().load(ctx);
    if (!cur.ok) return cur;
    var running = cur.encounter && cur.encounter.status !== 'ended' && cur.encounter.combatants && cur.encounter.combatants.length;
    if (running && !(await global.FogCampaignUI.confirm({ title: 'Replace the current encounter?', message: '“' + cur.encounter.name + '” is ' + (cur.encounter.status === 'active' ? 'running' : 'being set up') + '. Starting “' + e.name + '” replaces it.', confirmLabel: 'Start “' + e.name + '”' }))) return { ok: false, cancelled: true };

    var notes = [];
    var enc = M().newEncounter(e.name);
    enc.key = 'cb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    enc.source = { adventureId: adv.id, adventureTitle: adv.title, encounterId: e.id, chapterId: e.chapterId || null, sectionId: e.sectionId || null };
    enc.autoMode = e.autoMode || 'manual';
    enc.music = e.musicRef || null;
    enc.mapAssetId = e.mapAssetId || null;
    ctx.campaign.roster.filter(function (m) { return m.role === 'player' && m.character; }).forEach(function (m) { M().addCombatant(enc, S().pcCombatant(m, ctx.campaign)); });
    var all = global.FogCompendium ? global.FogCompendium.monsters() : [];
    e.monsters.forEach(function (ref) {
      var entry = all.find(function (x) { return x.key === ref.ref; }) || all.find(function (x) { return x.name.toLowerCase() === ref.name.toLowerCase(); });
      if (!entry) { notes.push('“' + ref.name + '” isn’t in Monsters & Spells, so it wasn’t added.'); return; }
      for (var i = 0; i < ref.count; i++) {
        var r = M().addCombatant(enc, S().monsterCombatant(entry, ref.count > 1 ? entry.name + ' ' + (i + 1) : entry.name));
        if (!r.ok) { notes.push(r.message); break; }
      }
    });
    var saved = await D().saveCombat(ctx.id, enc, cur.encounter ? cur.version : null);
    if (!saved.ok) return saved;

    // Where the DM is in the adventure
    if (e.sectionId) {
      var p = await D().getProgress(ctx.id);
      if (p.ok) await D().saveProgress(ctx.id, { currentSection: e.sectionId, completed: p.progress.completed || [] });
    }
    var ses = await D().listSessions(ctx.id);
    var active = ses.ok ? ses.sessions.find(function (x) { return x.status === 'active'; }) : null;
    if (active) await D().updateSession(active.id, { position: { sectionId: e.sectionId || null, encounterId: e.id, combatKey: enc.key } });

    // The encounter's map, shared with the campaign (if it has a picture)
    if (e.mapAssetId && global.FogCampaignMaps) {
      var asset = adv.content.assets.find(function (a) { return a.id === e.mapAssetId; });
      if (asset && asset.images.length) {
        var pub = await global.FogCampaignMaps.publishAsset(ctx, asset, { key: 'encounter-' + e.id, title: e.name + ': ' + asset.title, combat: enc, show: true });
        if (!pub.ok) notes.push('The map couldn’t be shared: ' + pub.message);
      } else if (asset) notes.push('The map “' + asset.title + '” has no picture yet.');
    }
    ctx.emit('combat');
    ctx.goBack('combat', [], 'the adventure');
    if (notes.length) global.FogCampaignUI.notice(notes.join(' '), 'error');
    return { ok: true, notes: notes };
  }

  global.FogEncounterLauncher = { start: start };
})(window);
