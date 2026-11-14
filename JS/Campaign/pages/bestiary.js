/**
 * Bestiary & Spells inside the campaign: the same data and entry layout as Dashboard → Monsters & Spells
 * (FogCompendium: SRD 5.2.1 monsters and spells, plus the DM's homebrew). Nothing is copied into the campaign.
 * The DM can open any monster and add it to the campaign's encounter (Combat). Players get the spell reference only:
 * monster stat blocks are DM material.
 *
 * Where an entry comes from is always shown and can be filtered: Official SRD (CC BY 4.0), Campaign homebrew (a copy the
 * DM shared with this campaign: campaign_homebrew) or My homebrew (your own library). An entry the DM shared is listed
 * once (as campaign homebrew), never twice.
 */
(function (global) {
  'use strict';

  var C = function () { return global.FogCompendium; };
  var R = function () { return global.FogCompendiumRender; };
  var UI = function () { return global.FogCampaignUI; };

  function esc(s) { return UI().esc(s); }

  async function render(host, ctx, params) {
    var alive = true;
    var isDm = ctx.isDm;
    var tab = isDm ? 'monsters' : 'spells';
    // Deep links: #bestiary/monster/<key> or #bestiary/spell/<key> (opened from an adventure, an encounter, Foggy…)
    var deep = params && params.rest && params.rest.length >= 2 ? { kind: params.rest[0], key: params.rest[1] } : null;
    var filters = { monsters: { q: '', type: '', crMin: '', crMax: '', src: '' }, spells: { q: '', level: '', cls: '', src: '' } };
    var selected = { monsters: null, spells: null };
    // The tab, filters and selection survive leaving and coming back (this browser tab only).
    var VIEW_KEY = 'fog_cw_bs_' + ctx.id;
    try {
      var saved = JSON.parse(global.sessionStorage.getItem(VIEW_KEY) || 'null');
      if (saved) {
        if (isDm && (saved.tab === 'monsters' || saved.tab === 'spells')) tab = saved.tab;
        ['monsters', 'spells'].forEach(function (w) {
          if (saved.filters && saved.filters[w]) Object.keys(filters[w]).forEach(function (k) { if (typeof saved.filters[w][k] === 'string') filters[w][k] = saved.filters[w][k]; });
          if (saved.selected && typeof saved.selected[w] === 'string') selected[w] = saved.selected[w];
        });
      }
    } catch (e) { /* preference only */ }
    function saveView() { try { global.sessionStorage.setItem(VIEW_KEY, JSON.stringify({ tab: tab, filters: filters, selected: selected })); } catch (e) { /* preference only */ } }

    host.innerHTML = '<div class="cw-page compendium-page cw-bestiary"><header class="cw-page-head"><div><h2 class="cw-page-title">Bestiary</h2>' +
      '<p class="cw-page-sub">' + (isDm ? 'Look up monsters, spells and rules while you run the game.' : 'Look up any spell from the SRD 5.2.1.') + ' Content: System Reference Document 5.2.1 (CC BY 4.0)' + (isDm ? ' and your homebrew' : '') + '.</p></div></header>' +
      (isDm ? '<nav class="cmp-tabs" role="tablist"><button type="button" role="tab" class="cmp-tab" data-bs-tab="monsters">Monsters <span id="bs-count-monsters"></span></button><button type="button" role="tab" class="cmp-tab" data-bs-tab="spells">Spells <span id="bs-count-spells"></span></button></nav>' : '') +
      '<p class="cmp-status" id="bs-status" role="alert" hidden></p>' +
      '<div class="cw-bestiary-grid"><section class="cw-card cw-bs-list-card"><div id="bs-filters"></div><ul class="cw-bs-list" id="bs-list" aria-label="Results"></ul></section>' +
      '<section class="cw-card cw-bs-detail" id="bs-detail" aria-live="polite"></section></div></div>';

    await C().ready();
    var notes = [];
    var M = global.FogHomebrewModel;
    var personalRaw = {};
    if (global.FogCompendiumPage) {
      var hb = await global.FogCompendiumPage.loadHomebrew(); // registers “Your homebrew” (monsters need isDm below)
      if (hb) notes.push(hb);
    }
    if (global.FogHomebrewStore) {
      var mine = await global.FogHomebrewStore.list(['monster', 'npc', 'spell']);
      if (mine.ok) mine.entries.forEach(function (e) { personalRaw[e.id] = e; });
    }
    var shared = { entries: [] };
    var cres = await global.FogCampaignData.listCampaignHomebrew(ctx.id);
    if (cres.ok) shared = cres; else notes.push(cres.message);
    var CAMPAIGN_SETS = { monster: 'campaign-homebrew-monsters', spell: 'campaign-homebrew-spells' };
    function registerCampaign(entries) {
      C().unregister(CAMPAIGN_SETS.monster);
      C().unregister(CAMPAIGN_SETS.spell);
      var meta = { origin: 'homebrew', name: 'Campaign homebrew', edition: '2024 rules format' };
      var asEntry = function (e) { return { id: e.sourceId, shareId: e.id, kind: e.kind, name: e.name, data: e.data }; };
      C().register({ meta: Object.assign({ id: CAMPAIGN_SETS.monster, kind: 'monster' }, meta), entries: entries.filter(function (e) { return e.kind !== 'spell'; }).map(asEntry).filter(M.hasStatBlock).map(function (e) { return Object.assign(M.toMonster(e), { shareId: e.shareId }); }) });
      C().register({ meta: Object.assign({ id: CAMPAIGN_SETS.spell, kind: 'spell' }, meta), entries: entries.filter(function (e) { return e.kind === 'spell'; }).map(asEntry).map(function (e) { return Object.assign(M.toSpell(e), { shareId: e.shareId }); }) });
    }
    if (M) registerCampaign(shared.entries);
    if (notes.length) { var st = host.querySelector('#bs-status'); st.textContent = notes.join(' '); st.hidden = false; }
    if (!alive) return null;
    var errs = C().errors();
    if (errs.length) { var s2 = host.querySelector('#bs-status'); s2.textContent = errs.join(' '); s2.hidden = false; }

    function sourceOf(e) {
      var id = e.dataset && e.dataset.id;
      if (id === CAMPAIGN_SETS.monster || id === CAMPAIGN_SETS.spell) return 'campaign';
      return e.dataset && e.dataset.origin === 'homebrew' ? 'personal' : 'srd';
    }
    function sharedIds() { return shared.entries.reduce(function (o, e) { o[e.sourceId] = true; return o; }, {}); }
    // Official, campaign and your own entries, each listed once: your own copy of something already shared is hidden.
    function visibleEntries(list) { var ids = sharedIds(); return list.filter(function (e) { return !(sourceOf(e) === 'personal' && ids[e.id]); }); }
    function monstersAll() { return isDm ? visibleEntries(C().monsters()) : []; }
    function spellsAll() { return visibleEntries(C().spells()); }

    var data = { monsters: monstersAll(), spells: spellsAll() };
    var listEl = host.querySelector('#bs-list');
    var filtersEl = host.querySelector('#bs-filters');
    var detailEl = host.querySelector('#bs-detail');

    function crSort(a, b) { return (a.crValue == null ? -1 : a.crValue) - (b.crValue == null ? -1 : b.crValue); }

    function filtered() {
      var f = filters[tab];
      var q = f.q.trim().toLowerCase();
      if (tab === 'monsters') {
        return data.monsters.filter(function (m) {
          if (f.src && sourceOf(m) !== f.src) return false;
          if (q && (m.name + ' ' + m.type + ' ' + (m.typeTags || '')).toLowerCase().indexOf(q) < 0) return false;
          if (f.type && m.type !== f.type) return false;
          if (f.crMin !== '' && (m.crValue == null || m.crValue < Number(f.crMin))) return false;
          if (f.crMax !== '' && (m.crValue == null || m.crValue > Number(f.crMax))) return false;
          return true;
        }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      }
      return data.spells.filter(function (s) {
        if (f.src && sourceOf(s) !== f.src) return false;
        if (q && (s.name + ' ' + (s.description || '')).toLowerCase().indexOf(q) < 0) return false;
        if (f.level !== '' && String(s.level) !== f.level) return false;
        if (f.cls && (s.classes || []).indexOf(f.cls) < 0) return false;
        return true;
      }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    var SRC_LABEL = { srd: 'Official SRD', campaign: 'Campaign homebrew', personal: 'My homebrew' };
    function srcSelect(cur) {
      var counts = { '': 0, srd: 0, campaign: 0, personal: 0 };
      (tab === 'monsters' ? data.monsters : data.spells).forEach(function (e) { counts[sourceOf(e)] += 1; counts[''] += 1; });
      return '<select class="form-control-dark" data-bs-f="src" aria-label="Source"><option value="">All content (' + counts[''] + ')</option>' +
        ['srd', 'campaign', 'personal'].map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + SRC_LABEL[k] + ' (' + counts[k] + ')</option>'; }).join('') + '</select>';
    }
    function badge(e) { var k = sourceOf(e); return '<span class="cw-src cw-src-' + k + '">' + SRC_LABEL[k] + '</span>'; }

    function drawFilters() {
      var f = filters[tab];
      if (tab === 'monsters') {
        var types = Object.keys(data.monsters.reduce(function (o, m) { o[m.type] = 1; return o; }, {})).sort();
        var crs = [['0', '0'], ['0.125', '1/8'], ['0.25', '1/4'], ['0.5', '1/2']].concat(Array.from({ length: 30 }, function (_, i) { return [String(i + 1), String(i + 1)]; }));
        var opt = function (list, cur, label) { return '<option value="">' + label + '</option>' + list.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (String(cur) === c[0] ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join(''); };
        filtersEl.innerHTML = '<div class="cmp-filters"><input class="form-control-dark" type="search" data-bs-f="q" value="' + esc(f.q) + '" placeholder="Search monsters by name or type…" aria-label="Search monsters" autocomplete="off">' +
          '<select class="form-control-dark" data-bs-f="type" aria-label="Creature type">' + opt(types.map(function (t) { return [t, t]; }), f.type, 'All types') + '</select>' +
          '<select class="form-control-dark" data-bs-f="crMin" aria-label="Lowest Challenge Rating">' + opt(crs, f.crMin, 'CR from') + '</select>' +
          '<select class="form-control-dark" data-bs-f="crMax" aria-label="Highest Challenge Rating">' + opt(crs, f.crMax, 'CR to') + '</select>' + srcSelect(f.src) + '</div>';
      } else {
        var classes = Object.keys(data.spells.reduce(function (o, s) { (s.classes || []).forEach(function (c) { o[c] = 1; }); return o; }, {})).sort();
        filtersEl.innerHTML = '<div class="cmp-filters"><input class="form-control-dark" type="search" data-bs-f="q" value="' + esc(f.q) + '" placeholder="Search spells by name or text…" aria-label="Search spells" autocomplete="off">' +
          '<select class="form-control-dark" data-bs-f="level" aria-label="Spell level"><option value="">All levels</option>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (l) { return '<option value="' + l + '"' + (String(f.level) === String(l) ? ' selected' : '') + '>' + (l === 0 ? 'Cantrip' : 'Level ' + l) + '</option>'; }).join('') + '</select>' +
          '<select class="form-control-dark" data-bs-f="cls" aria-label="Class"><option value="">All classes</option>' + classes.map(function (c) { return '<option value="' + esc(c) + '"' + (f.cls === c ? ' selected' : '') + '>' + esc(c.charAt(0).toUpperCase() + c.slice(1)) + '</option>'; }).join('') + '</select>' + srcSelect(f.src) + '</div>';
      }
    }

    function drawList() {
      var items = filtered();
      var total = tab === 'monsters' ? data.monsters.length : data.spells.length;
      var countEl = host.querySelector('#bs-count-' + tab);
      if (countEl) countEl.textContent = '(' + items.length + ')';
      if (!items.length) { listEl.innerHTML = '<li class="cw-empty"><p>' + (total ? 'Nothing matches these filters.' : 'No entries loaded.') + '</p></li>'; return; }
      var shown = items.slice(0, 120);
      listEl.innerHTML = shown.map(function (e) {
        var sub = tab === 'monsters' ? 'CR ' + e.cr + ' · ' + e.size + ' ' + e.type : (e.level === 0 ? 'Cantrip' : 'Level ' + e.level) + ' · ' + e.school;
        return '<li><button type="button" class="cw-bs-item' + (selected[tab] === e.key ? ' is-active' : '') + '" data-bs-pick="' + esc(e.key) + '" aria-pressed="' + (selected[tab] === e.key) + '"><strong>' + esc(e.name) + '</strong><span class="cw-muted">' + esc(sub) + '</span>' + badge(e) + '</button></li>';
      }).join('') + (items.length > shown.length ? '<li class="cw-muted cw-fine">Showing the first ' + shown.length + ' of ' + items.length + '. Narrow the search to see the rest.</li>' : '');
    }

    function drawDetail() {
      var key = selected[tab];
      var entry = key ? (tab === 'monsters' ? data.monsters : data.spells).find(function (e) { return e.key === key; }) : null;
      if (!entry) { detailEl.innerHTML = '<div class="cw-empty"><p>Choose ' + (tab === 'monsters' ? 'a monster' : 'a spell') + ' to read its ' + (tab === 'monsters' ? 'stat block' : 'description') + '.</p></div>'; return; }
      var add = tab === 'monsters' && isDm && ctx.campaign.status === 'active'
        ? '<div class="cw-bs-add"><label class="cw-muted" for="bs-count">How many</label><input id="bs-count" class="cw-num" type="number" min="1" max="20" value="1"><button type="button" class="btn btn-primary btn-sm" data-bs-add="' + esc(entry.key) + '">Add to encounter</button><a class="cw-link" href="#combat">Open Combat</a></div>' : '';
      var src = sourceOf(entry);
      var share = '';
      if (isDm && ctx.campaign.status === 'active') {
        if (src === 'personal') share = '<button type="button" class="btn btn-secondary btn-sm" data-bs-share="' + esc(entry.id) + '">Share with this campaign</button>';
        else if (src === 'campaign') share = '<button type="button" class="btn btn-secondary btn-sm" data-bs-unshare="' + esc(entry.shareId) + '">Stop sharing with the campaign</button>' + (personalRaw[entry.id] ? ' <button type="button" class="btn btn-secondary btn-sm" data-bs-share="' + esc(entry.id) + '">Update from my library</button>' : '');
      }
      detailEl.innerHTML = '<div class="cw-bs-source">' + badge(entry) + '<span class="cw-muted">' + (src === 'srd' ? 'System Reference Document 5.2.1, CC BY 4.0' : src === 'campaign' ? 'A copy the DM shared with this campaign' : 'From your own homebrew library: only you see it') + '</span>' + (share ? '<span class="cw-bs-share">' + share + '</span>' : '') + '</div>' + add + '<div class="cmp-entry">' + (tab === 'monsters' ? R().monster(entry) : R().spell(entry)) + '</div>';
    }

    function drawAll() { drawFilters(); drawList(); drawDetail(); host.querySelectorAll('[data-bs-tab]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-bs-tab') === tab); b.setAttribute('aria-selected', String(b.getAttribute('data-bs-tab') === tab)); }); }

    async function refreshShared() {
      var again = await global.FogCampaignData.listCampaignHomebrew(ctx.id);
      if (!alive || !again.ok) return;
      shared = again;
      registerCampaign(shared.entries);
      data = { monsters: monstersAll(), spells: spellsAll() };
      drawAll();
    }

    host.addEventListener('click', async function (e) {
      var t = e.target.closest('[data-bs-tab]');
      if (t) { tab = t.getAttribute('data-bs-tab'); saveView(); drawAll(); return; }
      var pick = e.target.closest('[data-bs-pick]');
      if (pick) { selected[tab] = pick.getAttribute('data-bs-pick'); saveView(); drawList(); drawDetail(); return; }
      var sh = e.target.closest('[data-bs-share]');
      if (sh) {
        var raw = personalRaw[sh.getAttribute('data-bs-share')];
        if (!raw) return;
        sh.disabled = true;
        var rs = await global.FogCampaignData.shareHomebrew(ctx.id, raw);
        sh.disabled = false;
        if (!rs.ok) { UI().notice(rs.message, 'error'); return; }
        UI().notice('“' + raw.name + '” is now shared with this campaign.');
        await refreshShared();
        return;
      }
      var un = e.target.closest('[data-bs-unshare]');
      if (un) {
        if (!(await UI().confirm({ title: 'Stop sharing this entry?', message: 'It disappears from the campaign’s homebrew. It stays in your own library.', confirmLabel: 'Stop sharing' }))) return;
        var ru = await global.FogCampaignData.unshareHomebrew(un.getAttribute('data-bs-unshare'));
        if (!ru.ok) { UI().notice(ru.message, 'error'); return; }
        selected[tab] = null;
        await refreshShared();
        return;
      }
      var add = e.target.closest('[data-bs-add]');
      if (add && global.FogCombatSession) {
        var entry = data.monsters.find(function (m) { return m.key === add.getAttribute('data-bs-add'); });
        if (!entry) return;
        add.disabled = true;
        var res = await global.FogCombatSession.addMonsters(ctx, entry, host.querySelector('#bs-count').value);
        add.disabled = false;
        if (!res.ok) UI().notice(res.message, 'error');
        else UI().notice(res.count + ' × ' + entry.name + ' added to the encounter.' + (res.started ? ' Combat is running: set their initiative in Combat.' : ''));
      }
    });
    host.addEventListener('input', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-bs-f');
      if (f && e.target.tagName === 'INPUT') { filters[tab][f] = e.target.value; saveView(); drawList(); }
    });
    host.addEventListener('change', function (e) {
      var f = e.target.getAttribute && e.target.getAttribute('data-bs-f');
      if (f && e.target.tagName === 'SELECT') { filters[tab][f] = e.target.value; saveView(); drawList(); }
    });

    if (deep) {
      var want = deep.kind === 'monster' ? 'monsters' : deep.kind === 'spell' ? 'spells' : null;
      if (want === 'monsters' && !isDm) notes.push('Monster stat blocks are for the Dungeon Master.');
      else if (want) {
        tab = want;
        var tail = String(deep.key).split(':').pop();
        var hit = data[want].find(function (e) { return e.key === deep.key || e.id === deep.key; }) ||
          data[want].find(function (e) { return e.id === tail || (e.name || '').toLowerCase() === String(deep.key).toLowerCase(); });
        // the linked entry is shown even if saved filters would hide it (the list view keeps its own saved state)
        if (hit) { selected[want] = hit.key; Object.keys(filters[want]).forEach(function (k) { filters[want][k] = ''; }); }
        else notes.push('“' + deep.key + '” isn’t in the bestiary (it may have been removed, or it is someone else’s homebrew).');
      }
    }
    if (notes.length) { var st2 = host.querySelector('#bs-status'); st2.textContent = notes.join(' '); st2.hidden = false; }
    drawAll();
    return function cleanup() { alive = false; };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.bestiary = { render: render };
})(window);
