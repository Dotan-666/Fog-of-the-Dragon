/**
 * Encounters of an adventure (content.encounters): list, add, edit, reorder, duplicate, remove. Used by the Dashboard's
 * adventure editor and by the campaign's Adventures page (where each encounter also gets "Start encounter").
 *
 *   FogEncounterEditor.mount(host, { adventure, onChange(adventure), onStart?(encounter), refLink?(kind, key, label),
 *                                    refHref?(kind, key, label), openId?, onOpen?(id) }) → cleanup
 *   refLink: an in-app link (same tab, with "← Back to …" there); refHref: an OPTIONAL extra ↗ link for a new tab.
 *   openId / onOpen: which encounter is expanded (so the caller can bring it back after navigating away and back).
 *
 * Monsters are references to stat blocks in Monsters & Spells (FogCompendium: SRD 5.2.1 and the DM's homebrew), chosen from
 * a search — never copied. The map is one of the adventure's map assets; the music a track from the licensed catalog.
 * The component edits the adventure object in place and calls onChange; saving is the caller's job.
 */
(function (global) {
  'use strict';

  var M = function () { return global.FogAdventureModel; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MODE_LABEL = { manual: 'Manual (the DM plays the monsters)', assist: 'Foggy Assist (Foggy suggests, the DM approves)', auto: 'Full Auto (Foggy plays the monsters’ turns)' };

  function mount(host, opts) {
    var adv = opts.adventure;
    var openId = opts.openId || null;
    function setOpen(id) { openId = id; if (opts.onOpen) opts.onOpen(id); }
    var query = '';
    function list() { if (!adv.content.encounters) adv.content.encounters = []; return adv.content.encounters; }
    function changed() { if (opts.onChange) opts.onChange(adv); }
    function monsters() { return global.FogCompendium ? global.FogCompendium.monsters().filter(function (m) { return m.complete !== false; }) : []; }
    function placeOptions(e) {
      var o = '<option value="">Not tied to a section</option>';
      adv.content.chapters.forEach(function (c) { c.sections.forEach(function (s) { o += '<option value="' + esc(s.id) + '"' + (e.sectionId === s.id ? ' selected' : '') + '>' + esc(c.title + ' › ' + s.title) + '</option>'; }); });
      return o;
    }
    function mapOptions(e) {
      var maps = adv.content.assets.filter(function (a) { return a.type === 'map'; });
      return '<option value="">No map</option>' + maps.map(function (a) { return '<option value="' + esc(a.id) + '"' + (e.mapAssetId === a.id ? ' selected' : '') + '>' + esc(a.title) + (a.images.length ? '' : ' (no picture yet)') + '</option>'; }).join('');
    }
    function musicOptions(e) {
      var Cat = global.FogAudioCatalog;
      var tracks = Cat ? Cat.list().filter(function (t) { return t.kind === 'music' || t.kind === 'ambience'; }) : [];
      return '<option value="">No music</option>' + tracks.map(function (t) { var r = 'rec:' + t.id; return '<option value="' + esc(r) + '"' + (e.musicRef === r ? ' selected' : '') + '>' + esc(t.name + ' (' + t.category + ')') + '</option>'; }).join('') +
        (e.musicRef && !tracks.some(function (t) { return 'rec:' + t.id === e.musicRef; }) ? '<option value="' + esc(e.musicRef) + '" selected>' + esc(e.musicRef) + '</option>' : '');
    }
    function monsterLink(m) {
      if (!m.ref || !(opts.refLink || opts.refHref)) return esc(m.name);
      var main = opts.refLink ? '<a class="cw-ref-in" href="' + esc(opts.refLink('monster', m.ref, adv.title)) + '">' + esc(m.name) + '</a>' : esc(m.name);
      return main + (opts.refHref ? ' <a class="cw-newtab" href="' + esc(opts.refHref('monster', m.ref, adv.title)) + '" target="_blank" rel="noopener" title="Open ' + esc(m.name) + ' in a new tab" aria-label="Open ' + esc(m.name) + ' in a new tab">↗</a>' : '');
    }
    function summary(e) {
      return e.monsters.length ? e.monsters.map(function (m) { return m.count + ' × ' + monsterLink(m); }).join(', ') : '<span class="adv-muted">No monsters yet</span>';
    }
    function form(e) {
      var hits = query.trim().length >= 2 ? monsters().filter(function (m) { return m.name.toLowerCase().indexOf(query.trim().toLowerCase()) >= 0; }).slice(0, 8) : [];
      return '<div class="enc-form" data-enc-id="' + esc(e.id) + '">' +
        '<div class="enc-row"><label class="adv-field"><span class="adv-label">Name</span><input class="form-control-dark" data-enc="name" value="' + esc(e.name) + '" maxlength="120"></label>' +
        '<label class="adv-field"><span class="adv-label">Difficulty</span><select class="form-control-dark" data-enc="difficulty">' + ['', 'Low', 'Moderate', 'High'].map(function (d) { return '<option value="' + d + '"' + (e.difficulty === d ? ' selected' : '') + '>' + (d || '—') + '</option>'; }).join('') + '</select></label>' +
        '<label class="adv-field"><span class="adv-label">Where in the adventure</span><select class="form-control-dark" data-enc="sectionId">' + placeOptions(e) + '</select></label></div>' +
        '<label class="adv-field adv-field-wide"><span class="adv-label">Introduction <em>read aloud; can be shared with the players</em></span><textarea class="form-control-dark" rows="2" data-enc="intro" maxlength="4000">' + esc(e.intro) + '</textarea></label>' +
        '<label class="adv-field adv-field-wide"><span class="adv-label">Description <em>for you: the situation, terrain, tactics</em></span><textarea class="form-control-dark" rows="2" data-enc="description" maxlength="4000">' + esc(e.description) + '</textarea></label>' +
        '<fieldset class="enc-monsters"><legend>Monsters <em>from Monsters &amp; Spells: the stat blocks are used, not copied</em></legend>' +
        (e.monsters.length ? '<ul>' + e.monsters.map(function (m, i) {
          return '<li><input class="cw-num enc-count" type="number" min="1" max="20" value="' + m.count + '" data-enc-count="' + i + '" aria-label="How many ' + esc(m.name) + '"> × ' + monsterLink(m) + (m.ref ? '' : ' <span class="adv-muted">(not linked to a stat block)</span>') +
            ' <button type="button" class="link-btn" data-enc-act="drop-monster" data-i="' + i + '" aria-label="Remove ' + esc(m.name) + '">Remove</button></li>';
        }).join('') + '</ul>' : '') +
        '<input type="search" class="form-control-dark" data-enc-search placeholder="Add a monster: type a name…" value="' + esc(query) + '" aria-label="Search monsters">' +
        (hits.length ? '<ul class="enc-hits">' + hits.map(function (m) { return '<li><button type="button" class="link-btn" data-enc-act="add-monster" data-key="' + esc(m.key) + '">' + esc(m.name) + ' <span class="adv-muted">CR ' + esc(m.cr) + (m.dataset && m.dataset.origin === 'homebrew' ? ' · homebrew' : '') + '</span></button></li>'; }).join('') + '</ul>' : (query.trim().length >= 2 ? '<p class="adv-muted">No monster matches.</p>' : '')) + '</fieldset>' +
        '<label class="adv-field adv-field-wide"><span class="adv-label">NPCs involved <em>one per line</em></span><textarea class="form-control-dark" rows="2" data-enc="npcs">' + esc(e.npcs.join('\n')) + '</textarea></label>' +
        '<div class="enc-row"><label class="adv-field"><span class="adv-label">Map <em>a map asset of this adventure</em></span><select class="form-control-dark" data-enc="mapAssetId">' + mapOptions(e) + '</select></label>' +
        '<label class="adv-field"><span class="adv-label">Music</span><select class="form-control-dark" data-enc="musicRef">' + musicOptions(e) + '</select></label>' +
        '<label class="adv-field"><span class="adv-label">Monster turns</span><select class="form-control-dark" data-enc="autoMode">' + M().ENCOUNTER_MODES.map(function (k) { return '<option value="' + k + '"' + (e.autoMode === k ? ' selected' : '') + '>' + esc(MODE_LABEL[k]) + '</option>'; }).join('') + '</select></label></div>' +
        '<label class="adv-field adv-field-wide"><span class="adv-label">Rewards and loot</span><textarea class="form-control-dark" rows="2" data-enc="rewards">' + esc(e.rewards) + '</textarea></label>' +
        '<label class="adv-field adv-field-wide"><span class="adv-label">Story triggers <em>what starts it, what follows</em></span><textarea class="form-control-dark" rows="2" data-enc="triggers">' + esc(e.triggers) + '</textarea></label>' +
        '<label class="adv-field adv-field-wide adv-dm"><span class="adv-label">🔒 DM-only notes</span><textarea class="form-control-dark" rows="2" data-enc="dmNotes">' + esc(e.dmNotes) + '</textarea></label></div>';
    }
    function draw() {
      var L = list();
      host.innerHTML = '<header class="adv-panel-head"><div><p class="adv-crumb">Adventure</p><h2>Encounters</h2></div>' +
        '<div class="adv-panel-tools"><button type="button" class="btn btn-primary btn-sm" data-enc-act="add">+ Add encounter</button></div></header>' +
        '<p class="adv-help">Fights and dangerous challenges in play order. Each one lists its monsters (from Monsters &amp; Spells), NPCs, map, music, rewards and private notes. In a campaign, <strong>Start encounter</strong> prepares Combat with all of it.</p>' +
        (L.length ? '<ol class="enc-list">' + L.map(function (e, i) {
          var open = openId === e.id;
          return '<li class="enc-item' + (open ? ' is-open' : '') + '"><div class="enc-head"><span class="enc-num">' + (i + 1) + '</span><button type="button" class="enc-title" data-enc-act="toggle" data-id="' + esc(e.id) + '" aria-expanded="' + open + '"><strong>' + esc(e.name) + '</strong>' + (e.difficulty ? ' <span class="adv-muted">· ' + esc(e.difficulty) + '</span>' : '') + '</button>' +
            '<span class="enc-tools">' + (opts.onStart ? '<button type="button" class="btn btn-primary btn-sm" data-enc-act="start" data-id="' + esc(e.id) + '">Start encounter</button>' : '') +
            '<button type="button" class="link-btn" data-enc-act="up" data-id="' + esc(e.id) + '"' + (i ? '' : ' disabled') + ' aria-label="Move up">↑</button><button type="button" class="link-btn" data-enc-act="down" data-id="' + esc(e.id) + '"' + (i < L.length - 1 ? '' : ' disabled') + ' aria-label="Move down">↓</button>' +
            '<button type="button" class="link-btn" data-enc-act="dup" data-id="' + esc(e.id) + '">Duplicate</button><button type="button" class="link-btn" data-enc-act="remove" data-id="' + esc(e.id) + '">Remove</button></span></div>' +
            '<p class="enc-sum">' + summary(e) + (e.mapAssetId ? ' · map' : '') + (e.musicRef ? ' · music' : '') + (e.autoMode !== 'manual' ? ' · ' + (e.autoMode === 'auto' ? 'Full Auto' : 'Foggy Assist') : '') + '</p>' +
            (open ? form(e) : '') + '</li>';
        }).join('') + '</ol>' : '<p class="adv-empty-assets">No encounters yet.</p>');
    }
    function find(id) { return list().find(function (e) { return e.id === id; }); }
    function onClick(ev) {
      var b = ev.target.closest('[data-enc-act]');
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-enc-act');
      var L = list();
      var e = find(b.getAttribute('data-id'));
      if (a === 'add') { var n = M().newEncounter('Encounter ' + (L.length + 1)); L.push(n); setOpen(n.id); query = ''; changed(); draw(); }
      else if (a === 'toggle') { setOpen(openId === e.id ? null : e.id); query = ''; draw(); }
      else if (a === 'start' && e) opts.onStart(e);
      else if ((a === 'up' || a === 'down') && e) { var i = L.indexOf(e), j = a === 'up' ? i - 1 : i + 1; L.splice(i, 1); L.splice(j, 0, e); changed(); draw(); }
      else if (a === 'dup' && e) { var c = JSON.parse(JSON.stringify(e)); c.id = M().newEncounter().id; c.name = (e.name + ' (copy)').slice(0, 120); L.splice(L.indexOf(e) + 1, 0, c); changed(); draw(); }
      else if (a === 'remove' && e) { if (!global.confirm('Remove the encounter “' + e.name + '”?')) return; L.splice(L.indexOf(e), 1); changed(); draw(); }
      else if (a === 'add-monster' || a === 'drop-monster') {
        var cur = find(b.closest('[data-enc-id]').getAttribute('data-enc-id'));
        if (a === 'add-monster') {
          var mon = monsters().find(function (m) { return m.key === b.getAttribute('data-key'); });
          if (mon) { var have = cur.monsters.find(function (m) { return m.ref === mon.key; }); if (have) have.count = Math.min(20, have.count + 1); else cur.monsters.push({ ref: mon.key, name: mon.name, count: 1 }); }
          query = '';
        } else cur.monsters.splice(Number(b.getAttribute('data-i')), 1);
        changed(); draw();
        var s = host.querySelector('[data-enc-search]'); if (s && a === 'add-monster') s.focus();
      }
    }
    function onInput(ev) {
      var t = ev.target;
      if (t.hasAttribute('data-enc-search')) { query = t.value; var pos = t.selectionStart; draw(); var s = host.querySelector('[data-enc-search]'); if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch (e) { /* type=search */ } } return; }
      var f = t.getAttribute('data-enc');
      var holder = t.closest('[data-enc-id]');
      if (!holder) return;
      var e = find(holder.getAttribute('data-enc-id'));
      if (f) { e[f] = f === 'npcs' ? t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20) : t.value; if (f === 'sectionId') { var ch = adv.content.chapters.find(function (c) { return c.sections.some(function (s) { return s.id === t.value; }); }); e.chapterId = ch ? ch.id : ''; } changed(); if (t.tagName === 'SELECT' && f !== 'sectionId') draw(); }
      if (t.hasAttribute('data-enc-count')) { e.monsters[Number(t.getAttribute('data-enc-count'))].count = Math.max(1, Math.min(20, Number(t.value) || 1)); changed(); }
    }
    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    draw();
    var alive = true;
    Promise.all([global.FogCompendium && global.FogCompendium.ready ? global.FogCompendium.ready() : null, global.FogAudioCatalog && global.FogAudioCatalog.ready ? global.FogAudioCatalog.ready() : null])
      .then(function () { if (alive && host.isConnected && !host.contains(document.activeElement)) draw(); }, function () { /* lists stay empty; typing still works */ });
    return function () { alive = false; host.removeEventListener('click', onClick); host.removeEventListener('input', onInput); host.removeEventListener('change', onInput); };
  }

  global.FogEncounterEditor = { mount: mount, MODE_LABEL: MODE_LABEL };
})(window);
