/**
 * Foggy+ session preparation (Campaign → Foggy → Prepare the next session; #foggy/prepare). Dungeon Master only.
 *
 *   FogSessionPrep.mount(host, ctx) → cleanup
 *
 * 1. The app looks at what really exists (with the DM's own permissions): where the adventure stands, the next sections,
 *    the encounters there with their monsters (checked in Monsters & Spells), maps and music, the party's characters and the
 *    handouts. What's missing is listed (an encounter without a map picture, a monster that isn't in the bestiary…).
 * 2. Optional: "Ask Foggy+" sends that inventory to the server, which may only point at items from it (anything else is
 *    dropped there) and adds a summary and suggestions. Without Foggy+ the app's own list is still usable.
 * 3. The DM ticks what to open and presses "Open in tabs" (a click: browsers only allow pop-ups from a user action). Each
 *    distinct page opens once; tabs the browser blocks are listed as links to open by hand.
 * Nothing is started (no meeting, no combat) and no content is changed.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  function esc(s) { return UI().esc(s); }
  var KIND_LABEL = { section: 'Adventure', encounter: 'Encounters', monster: 'Monsters', map: 'Maps', music: 'Music', character: 'Characters', handout: 'Handouts', npc: 'NPCs' };
  var ORDER = ['section', 'encounter', 'monster', 'map', 'music', 'character', 'handout', 'npc'];
  var COMPENDIUM = ['character-engine/data/srd-5.2.1-core.js', 'Dashboard/compendium/compendium-store.js', 'Dashboard/compendium/compendium-render.js', 'Dashboard/homebrew/homebrew-model.js', 'Dashboard/homebrew/homebrew-store.js', 'Dashboard/compendium/compendium-page.js', 'Dashboard/music/audio-catalog.js'];

  /** Everything the app can find for the next session. Pure apart from its inputs (testable). */
  function inventory(o) {
    var adv = o.adventure, items = [], missing = [], hrefs = {};
    var R = o.href;
    function add(it, href) { if (items.some(function (x) { return x.id === it.id; })) return; items.push(it); hrefs[it.id] = href; }
    var flat = [];
    if (adv) adv.content.chapters.forEach(function (ch) { ch.sections.forEach(function (s) { flat.push({ ch: ch, s: s }); }); });
    var curId = o.sectionId || null;
    var idx = curId ? flat.findIndex(function (x) { return x.s.id === curId; }) : 0;
    if (idx < 0) idx = 0;
    var next = flat.slice(idx, idx + 4);
    var where = flat[idx] ? flat[idx].ch.title + ' › ' + flat[idx].s.title : adv ? 'The adventure hasn’t started.' : 'No adventure linked.';
    if (!adv) missing.push('No adventure is linked to this campaign (Campaign Settings).');
    next.forEach(function (x, i) { add({ id: x.s.id, kind: 'section', title: x.ch.title + ' › ' + x.s.title, note: (i === 0 ? 'current · ' : 'coming up · ') + x.s.kind }, R('content', [x.s.id])); });
    var secIds = next.map(function (x) { return x.s.id; });
    var encs = adv ? (adv.content.encounters || []) : [];
    var soon = encs.filter(function (e) { return e.sectionId && secIds.indexOf(e.sectionId) >= 0; });
    if (!soon.length) soon = encs.filter(function (e) { return !e.sectionId; }).slice(0, 3);
    soon.slice(0, 6).forEach(function (e) {
      add({ id: 'enc:' + e.id, kind: 'encounter', title: e.name, note: e.monsters.map(function (m) { return m.count + '× ' + m.name; }).join(', ') + (e.difficulty ? ' · ' + e.difficulty : '') }, R('content', e.sectionId ? [e.sectionId] : []));
      if (!e.monsters.length) missing.push('Encounter “' + e.name + '” has no monsters yet.');
      e.monsters.forEach(function (m) {
        var found = o.monsterExists ? o.monsterExists(m.ref, m.name) : null;
        if (found === false) missing.push('“' + m.name + '” (encounter “' + e.name + '”) isn’t in Monsters & Spells.');
        else add({ id: 'monster:' + (found && found.key ? found.key : m.ref || m.name), kind: 'monster', title: m.name, note: 'in “' + e.name + '”' }, R('bestiary', ['monster', found && found.key ? found.key : m.ref || m.name]));
      });
      if (e.mapAssetId) {
        var a = adv.content.assets.find(function (x) { return x.id === e.mapAssetId; });
        if (!a) missing.push('The map of “' + e.name + '” was removed from the adventure.');
        else if (!a.images.length) missing.push('The map “' + a.title + '” (encounter “' + e.name + '”) has no picture yet.');
        else add({ id: 'map:' + a.id, kind: 'map', title: a.title, note: 'shared to the Map when the encounter starts' }, R('map', []));
      } else missing.push('Encounter “' + e.name + '” has no map.');
      if (e.musicRef) {
        var t = o.track ? o.track(e.musicRef) : null;
        if (o.track && !t) missing.push('The music of “' + e.name + '” is no longer in the library.');
        else add({ id: 'music:' + e.musicRef, kind: 'music', title: t ? t.name : e.musicRef, note: 'for “' + e.name + '”' }, R('music', ['track', String(e.musicRef).replace(/^rec:/, '')]));
      } else missing.push('Encounter “' + e.name + '” has no music.');
      (e.npcs || []).forEach(function (n) {
        var asset = adv.content.assets.find(function (x) { return x.type === 'npc' && x.title.toLowerCase() === String(n).toLowerCase(); });
        if (asset) add({ id: 'npc:' + asset.id, kind: 'npc', title: asset.title, note: 'in “' + e.name + '”' }, R('content', e.sectionId ? [e.sectionId] : []));
      });
    });
    if (adv && !encs.length) missing.push('This adventure has no encounters yet (Adventures → Encounters).');
    (o.roster || []).filter(function (m) { return m.role === 'player'; }).forEach(function (m) {
      if (m.character) add({ id: 'character:' + m.userId, kind: 'character', title: m.characterName || m.displayName, note: 'played by ' + m.displayName }, R('characters', [m.userId]));
      else missing.push(m.displayName + ' has no character in the campaign yet.');
    });
    if (adv) adv.content.assets.filter(function (a) { return a.type === 'handout'; }).slice(0, 5).forEach(function (a) { add({ id: 'handout:' + a.id, kind: 'handout', title: a.title, note: a.images.length ? 'with a picture' : '' }, R('content', [])); });
    return { items: items, missing: missing, where: where, hrefs: hrefs };
  }

  function mount(host, ctx) {
    if (!ctx.isDm) { host.innerHTML = '<div class="cw-card cw-empty"><p>Session preparation is for the Dungeon Master.</p></div>'; return function () {}; }
    var alive = true;
    var inv = null, ai = null, busy = '', err = '', chosen = {}, opened = null, foggyOk = null;

    function hrefFor(section, rest) { return global.FogCampaignReturn ? global.FogCampaignReturn.href(section, rest, 'session preparation') : 'campaign.html?c=' + encodeURIComponent(ctx.id) + global.FogCampaignRouter.hrefFor(section, rest); }

    function draw() {
      if (!alive) return;
      if (!inv) { host.innerHTML = '<p class="cw-loading" role="status">Looking at what’s ready for the next session…</p>'; return; }
      var picks = ai ? ai.open.map(function (o) { return o.id; }) : null;
      var groups = ORDER.map(function (k) {
        var list = inv.items.filter(function (i) { return i.kind === k; });
        if (!list.length) return '';
        return '<div class="sp-group"><h4>' + KIND_LABEL[k] + '</h4><ul>' + list.map(function (i) {
          var why = ai ? (ai.open.find(function (o) { return o.id === i.id; }) || {}).why : '';
          return '<li><label class="cw-check"><input type="checkbox" data-sp-pick="' + esc(i.id) + '"' + (chosen[i.id] ? ' checked' : '') + '> <span><strong>' + esc(i.title) + '</strong>' + (i.note ? ' <span class="cw-muted">' + esc(i.note) + '</span>' : '') +
            (why ? '<br><span class="sp-why">Foggy: ' + esc(why) + '</span>' : (picks && picks.indexOf(i.id) < 0 ? '' : '')) + '</span></label></li>';
        }).join('') + '</ul></div>';
      }).join('');
      var n = Object.keys(chosen).filter(function (k) { return chosen[k]; }).length;
      var pages = distinctHrefs().length;
      host.innerHTML = '<section class="cw-card"><h3 class="cw-card-title">Where the adventure stands</h3><p>📍 ' + esc(inv.where) + '</p>' +
        (ai ? '<div class="sp-summary"><h4>Foggy’s summary</h4><p>' + esc(ai.summary) + '</p>' + (ai.suggestions.length ? '<h4>Suggestions</h4><ul>' + ai.suggestions.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') +
          (ai.ignored ? '<p class="cw-muted cw-fine">Foggy mentioned ' + ai.ignored + ' thing' + (ai.ignored === 1 ? '' : 's') + ' that don’t exist in your campaign; they were left out.</p>' : '') + '</div>' : '') +
        '<div class="cw-actions">' + (ai ? '' : '<button type="button" class="btn btn-primary btn-sm" data-sp="ask"' + (busy || foggyOk === false ? ' disabled' : '') + '>' + (busy === 'ask' ? 'Foggy is preparing…' : 'Ask Foggy+ for a plan') + '</button>') +
        (foggyOk === false ? '<span class="cw-muted">Foggy’s plan needs Foggy+ (Fogger of the Dragons). The list below is the app’s own and works without it.</span>' : '') + '</div></section>' +
        (err ? '<p class="cw-banner is-warn" role="alert">' + esc(err) + '</p>' : '') +
        '<div class="cw-grid cw-grid-2"><section class="cw-card"><h3 class="cw-card-title">What’s ready</h3>' + (groups || '<p class="cw-muted">Nothing found yet.</p>') + '</section>' +
        '<section class="cw-card"><h3 class="cw-card-title">Missing or worth preparing</h3>' + ((ai ? ai.missing : inv.missing).length ? '<ul class="sp-missing">' + (ai ? ai.missing : inv.missing).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '<p class="cw-muted">Nothing missing that the app can see.</p>') + '</section></div>' +
        '<section class="cw-card"><h3 class="cw-card-title">Open for the session</h3><p class="cw-muted">' + n + ' selected → ' + pages + ' tab' + (pages === 1 ? '' : 's') + ' (each page opens once). Browsers only allow several tabs from a click and some block them: anything blocked is listed below to open by hand. Nothing is started or changed.</p>' +
        '<div class="cw-actions"><button type="button" class="btn btn-primary btn-sm" data-sp="open"' + (pages ? '' : ' disabled') + '>Open ' + pages + ' tab' + (pages === 1 ? '' : 's') + '</button><button type="button" class="cv-link-btn" data-sp="all">Select all</button><button type="button" class="cv-link-btn" data-sp="none">Clear</button></div>' +
        (opened ? '<p role="status">' + opened.ok + ' opened.' + (opened.blocked.length ? ' The browser blocked ' + opened.blocked.length + ':' : '') + '</p>' + (opened.blocked.length ? '<ul>' + opened.blocked.map(function (b) { return '<li><a href="' + esc(b.href) + '" target="_blank" rel="noopener">' + esc(b.title) + '</a></li>'; }).join('') + '</ul>' : '') : '') + '</section>';
    }
    function distinctHrefs() {
      var seen = {}, out = [];
      inv.items.forEach(function (i) { if (!chosen[i.id]) return; var h = inv.hrefs[i.id]; if (!h || seen[h]) return; seen[h] = 1; out.push({ href: h, title: i.title }); });
      return out;
    }

    async function load() {
      try { await global.FogCampaignRouter.loadScripts(COMPENDIUM); } catch (e) { /* monsters can't be checked: said below */ }
      if (global.FogCompendium && global.FogCompendium.ready) await global.FogCompendium.ready();
      if (global.FogCompendiumPage && global.FogCompendiumPage.loadHomebrew) await global.FogCompendiumPage.loadHomebrew();
      if (global.FogAudioCatalog && global.FogAudioCatalog.ready) await global.FogAudioCatalog.ready();
      var c = ctx.campaign;
      var r = await Promise.all([c.adventureId ? global.FogAdventureStore.get(c.adventureId) : Promise.resolve({ ok: false }), D().getProgress(ctx.id), D().listSessions ? D().listSessions(ctx.id) : Promise.resolve({ ok: false })]);
      if (!alive) return;
      var active = r[2].ok ? r[2].sessions.find(function (s) { return s.status === 'active'; }) : null;
      var mons = global.FogCompendium ? global.FogCompendium.monsters() : null;
      inv = inventory({
        adventure: r[0].ok ? r[0].adventure : null,
        sectionId: (active && active.position && active.position.sectionId) || (r[1].ok ? r[1].progress.currentSection : null),
        roster: c.roster,
        monsterExists: mons ? function (ref, name) { return mons.find(function (m) { return m.key === ref; }) || mons.find(function (m) { return m.name.toLowerCase() === String(name).toLowerCase(); }) || false; } : null,
        track: global.FogAudioCatalog ? function (ref) { return global.FogAudioCatalog.get(String(ref).replace(/^rec:/, '')); } : null,
        href: hrefFor,
      });
      if (!mons) inv.missing.push('Monsters & Spells couldn’t be loaded, so the monsters weren’t checked.');
      inv.items.forEach(function (i) { chosen[i.id] = i.kind === 'section' || i.kind === 'encounter' || i.kind === 'map'; });
      if (global.FogFoggy && global.FogFoggy.access) {
        try { var acc = await global.FogFoggy.access(ctx.id); foggyOk = !!(acc.ok && acc.access && acc.access.campaign && (acc.source === 'local' || acc.access.enabled)); } catch (e) { foggyOk = false; }
      } else foggyOk = false;
      draw();
    }

    host.addEventListener('change', function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-sp-pick'); if (id) { chosen[id] = e.target.checked; draw(); } });
    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-sp]');
      if (!b) return;
      var a = b.getAttribute('data-sp');
      if (a === 'all') { inv.items.forEach(function (i) { chosen[i.id] = true; }); draw(); }
      else if (a === 'none') { chosen = {}; draw(); }
      else if (a === 'ask') {
        busy = 'ask'; err = ''; draw();
        var r = await global.FogFoggy.prepareSession({ campaignId: ctx.id, inventory: { items: inv.items, missing: inv.missing, where: inv.where } });
        busy = '';
        if (!alive) return;
        if (!r.ok) { err = r.message || 'Foggy couldn’t prepare the session.'; draw(); return; }
        ai = r.result;
        chosen = {};
        ai.open.forEach(function (o) { chosen[o.id] = true; });
        draw();
      } else if (a === 'open') {
        // One user click → the tabs (window.open must run inside this click handler to be allowed).
        var list = distinctHrefs();
        var res = { ok: 0, blocked: [] };
        list.forEach(function (l) {
          // (not the "noopener" feature: with it, window.open always returns null and blocked tabs couldn't be told apart)
          var w = null;
          try { w = global.open(l.href, '_blank'); } catch (er) { w = null; }
          if (w) { try { w.opener = null; } catch (er2) { /* cross-origin already */ } res.ok++; } else res.blocked.push(l);
        });
        opened = res;
        draw();
      }
    });

    draw();
    load();
    return function () { alive = false; };
  }

  global.FogSessionPrep = { mount: mount, inventory: inventory };
})(window);
