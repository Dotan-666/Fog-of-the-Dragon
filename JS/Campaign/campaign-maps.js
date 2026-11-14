/**
 * Shared campaign maps (migration 20261120120000_session_experience.sql) — helpers used by the Map section and by
 * "Start encounter".
 *
 * The DM's adventure pictures are private to the DM (content-images bucket), so sharing a map COPIES the picture into the
 * campaign's own maps folder (campaign-memories/<campaign>/maps/, readable by members). Tokens: visible ones are in
 * campaign_maps.tokens (everyone in the campaign sees them); hidden monsters stay in campaign_map_dm (DM only).
 *
 *   FogCampaignMaps.publishAsset(ctx, asset, { key, title, combat?, show?, grid? }) → { ok, id }
 *   FogCampaignMaps.publishFile(ctx, file, { key, title, grid, show? })            → { ok, id }
 *   FogCampaignMaps.tokensFromCombat(encounter, existing) → { tokens, hidden }      (positions kept for tokens already placed)
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var COLORS = { pc: '#2f7fd8', monster: '#b3261e', npc: '#8a6d1f', marker: '#5b5b5b' };

  function tokensFromCombat(enc, existing, grid) {
    existing = existing || { tokens: [], hidden: [] };
    var placed = {};
    existing.tokens.concat(existing.hidden || []).forEach(function (t) { if (t.combatantId) placed[t.combatantId] = t; });
    var cols = (grid && grid.cols) || 20, rows = (grid && grid.rows) || 20;
    var tokens = existing.tokens.filter(function (t) { return !t.combatantId; });
    var hidden = (existing.hidden || []).filter(function (t) { return !t.combatantId; });
    var pcI = 0, monI = 0;
    (enc ? enc.combatants : []).filter(function (c) { return !c.removed; }).forEach(function (c) {
      var prev = placed[c.id];
      var t = {
        id: 't_' + String(c.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30), kind: c.kind, label: c.name.slice(0, 40), userId: c.kind === 'pc' ? c.userId : null, combatantId: c.id,
        // a first placement: the party along the left edge, the monsters along the right edge
        x: prev ? prev.x : c.kind === 'pc' ? 1 : Math.max(0, cols - 2), y: prev ? prev.y : Math.min(rows - 1, 1 + (c.kind === 'pc' ? pcI++ : monI++) * 2), color: COLORS[c.kind],
      };
      (c.hidden ? hidden : tokens).push(t);
    });
    return { tokens: tokens, hidden: hidden };
  }

  async function blobFromAsset(asset) {
    var img = asset.images[0];
    var urls = global.FogContentImages ? await global.FogContentImages.urls([img.path]) : {};
    var url = urls[img.path];
    if (!url) throw new Error('The map picture couldn’t be opened.');
    var res = await fetch(url);
    if (!res.ok) throw new Error('The map picture couldn’t be downloaded.');
    return new File([await res.blob()], 'map.jpg', { type: 'image/jpeg' });
  }

  async function publishFile(ctx, file, o) {
    var up = await D().uploadMapImage(ctx.id, file);
    if (!up.ok) return up;
    var grid = o.grid || { cols: 20, rows: 20 };
    var cur = await D().getMaps(ctx.id, true);
    var prev = cur.ok ? cur.maps.find(function (m) { return m.key === o.key; }) : null;
    var tk = o.combat ? tokensFromCombat(o.combat, prev ? { tokens: prev.tokens, hidden: cur.hidden[prev.id] || [] } : null, grid) : { tokens: prev ? prev.tokens : [], hidden: prev ? cur.hidden[prev.id] || [] : [] };
    var saved = await D().saveMap(ctx.id, { key: o.key, title: o.title, imagePath: up.path, grid: grid, tokens: tk.tokens, hidden: tk.hidden, playersMove: prev ? prev.playersMove : false }, prev ? prev.version : null);
    if (!saved.ok) return saved;
    if (o.show) { var sh = await D().showMap(ctx.id, saved.id); if (!sh.ok) return sh; }
    return { ok: true, id: saved.id };
  }

  async function publishAsset(ctx, asset, o) {
    if (!asset || !asset.images || !asset.images.length) return { ok: false, message: 'This map has no picture yet.' };
    var file;
    try { file = await blobFromAsset(asset); } catch (e) { return { ok: false, message: e.message }; }
    var g = /(\d{1,2})\s*[×x]\s*(\d{1,2})/.exec((asset.summary || '') + ' ' + (asset.images[0].caption || ''));
    return publishFile(ctx, file, Object.assign({ grid: g ? { cols: Math.min(40, Number(g[1])), rows: Math.min(40, Number(g[2])) } : { cols: 20, rows: 20 } }, o));
  }

  global.FogCampaignMaps = { tokensFromCombat: tokensFromCombat, publishAsset: publishAsset, publishFile: publishFile, COLORS: COLORS };
})(window);
