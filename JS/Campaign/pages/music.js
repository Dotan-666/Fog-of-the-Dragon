/**
 * Music: the in-game controller (Dungeon Master only). It is a view of the SAME player, playlists and library as
 * Dashboard → Music (FogMusicPlayer / FogMusicStore / FogAudioCatalog): there is no second audio library or playback engine.
 *
 * Layout: keyboard shortcuts first, then the controller, scenes & cues, the playlist builder, and the music log last.
 *
 * Playlists are stored by FogMusicStore in this browser (like on the Music page): every change is saved immediately and is
 * the same data the Music Studio shows. Scenes & cues are saved per campaign in this browser too (they point at your playlists).
 *
 * Track details: #music/track/<catalog id> (from the library or a playlist; "← Back to Music" returns to the same playlist,
 * search and filters, which are kept for this browser tab).
 *
 * Keyboard (this page, never while typing in a field, on a focused button/link/list, or with a dialog open):
 *   Space play/pause · N next track · P previous track · S stop
 *   Tab / Shift+Tab: next / previous scripted cue, ONLY while "Cue mode" is switched on (Esc switches it off). Tab normally
 *   moves keyboard focus, so it is never taken over unless the Dungeon Master asks for it.
 */
(function (global) {
  'use strict';

  var Player = function () { return global.FogMusicPlayer; };
  var Store = function () { return global.FogMusicStore; };
  var Cat = function () { return global.FogAudioCatalog; };
  var UI = function () { return global.FogCampaignUI; };
  var SCENES = ['Exploration', 'Combat', 'Boss Fight', 'Tavern', 'Dungeon', 'Final Encounter', 'Travel', 'Mystery', 'Downtime'];

  function esc(s) { return UI().esc(s); }

  /** True when a key press belongs to something else (typing, a focused control, an open dialog). */
  function keyBelongsElsewhere(e) {
    var t = e.target;
    if (document.querySelector('dialog[open]')) return true;
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    if (!t || t === document.body || t === document.documentElement) return false;
    var tag = (t.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a', 'summary', 'details'].indexOf(tag) >= 0) return true;
    if (t.isContentEditable) return true;
    var role = t.getAttribute && t.getAttribute('role');
    return ['button', 'tab', 'slider', 'textbox', 'link', 'menuitem', 'option'].indexOf(role) >= 0;
  }

  function cueKey(ctx) { return 'fog_cues_' + ctx.id + '_' + ctx.me.id; }
  function loadCues(ctx) {
    try { var v = JSON.parse(global.localStorage.getItem(cueKey(ctx)) || '[]'); return Array.isArray(v) ? v.slice(0, 40) : []; } catch (e) { return []; }
  }
  function saveCues(ctx, cues) {
    try { global.localStorage.setItem(cueKey(ctx), JSON.stringify(cues)); return true; } catch (e) { return false; }
  }

  /** One catalog track: what it is, who made it, its license, and play / add to a playlist. */
  function renderTrack(host, ctx, id) {
    var alive = true;
    host.innerHTML = '<div class="cw-page cw-music cw-track"><p class="cw-loading" role="status">Loading the track…</p></div>';
    function draw() {
      if (!alive) return;
      var C = Cat();
      var r = C ? C.get(id) : null;
      if (!r) {
        host.innerHTML = '<div class="cw-page"><div class="cw-card cw-empty"><h2 class="cw-card-title">Track not found</h2><p>' + (C && C.error() ? esc(C.error()) : 'This track isn\'t in the music library (it may have been removed).') + '</p><a class="btn btn-secondary btn-sm" href="#music">Music</a></div></div>';
        return;
      }
      var lic = C.license(r.license) || {};
      var ref = 'rec:' + r.id;
      var lists = Store().playlists ? Store().playlists() : [];
      var row = function (k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; };
      host.innerHTML = '<div class="cw-page cw-music cw-track"><header class="cw-page-head"><div><h2 class="cw-page-title">' + esc(r.name) + '</h2>' +
        '<p class="cw-page-sub">' + esc(r.kind) + (r.category ? ' · ' + esc(C.categoryLabel(r.category)) : '') + '</p></div></header>' +
        '<section class="cw-card"><div class="cw-actions"><button type="button" class="btn btn-primary btn-sm" data-tk="play">▶ Play</button>' +
        (lists.length ? '<label class="cw-field cw-inline"><span>Add to</span><select class="form-control" id="tk-pl">' + lists.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></label><button type="button" class="btn btn-secondary btn-sm" data-tk="add">Add</button>' : '<span class="cw-muted">Create a playlist on the Music page to add this track to it.</span>') + '</div>' +
        '<dl class="cw-facts">' + row('By', esc(r.author || '')) + row('Source', r.sourceUrl && /^https:\/\//.test(r.sourceUrl) ? '<a href="' + esc(r.sourceUrl) + '" target="_blank" rel="noopener">' + esc(r.source || r.sourceUrl) + '</a>' : esc(r.source || '')) +
        row('License', lic.url && /^https:\/\//.test(lic.url) ? '<a href="' + esc(lic.url) + '" target="_blank" rel="noopener">' + esc(lic.name || r.license) + '</a>' : esc(lic.name || r.license || '')) +
        row('Moods', esc((r.moods || []).map(C.moodLabel).join(', '))) + row('Scenes', esc((r.scenes || []).map(C.sceneLabel).join(', '))) +
        row('Intensity', r.intensity ? esc(C.intensityLabel(r.intensity)) : '') + row('Loops', r.kind === 'sfx' ? '' : (r.loop === false ? 'No' : 'Yes')) + row('Tags', esc((r.tags || []).join(', '))) + '</dl>' +
        (r.attribution ? '<p class="cw-muted cw-fine">' + esc(r.attribution) + '</p>' : '') + '</section></div>';
    }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tk]');
      if (!b) return;
      if (b.getAttribute('data-tk') === 'play') Player().play('rec:' + id);
      else if (b.getAttribute('data-tk') === 'add') {
        var sel = host.querySelector('#tk-pl');
        var p = Store().getPlaylist(sel.value);
        if (!p) return;
        var res = Store().addToPlaylist(p.id, 'rec:' + id);
        if (!res.ok) UI().notice(res.message, 'error'); else UI().notice('Added to "' + p.name + '".');
      }
    });
    if (Cat()) Cat().ready().then(draw); else draw();
    return function () { alive = false; };
  }

  function render(host, ctx, params) {
    if (!Player() || !Store()) {
      host.innerHTML = '<div class="cw-page"><div class="cw-empty cw-empty-lg"><h2>Music isn\'t available</h2><p>The music player could not be loaded. Reload the page to try again.</p></div></div>';
      return null;
    }
    if (params && params.rest && params.rest[0] === 'track' && params.rest[1]) return renderTrack(host, ctx, params.rest[1]);
    var archived = ctx.campaign.status === 'archived';
    var cues = loadCues(ctx);
    var cueIndex = -1;
    var cueMode = false;
    var NAV = global.FogNav;
    var view = (NAV && NAV.state('view')) || {};
    var editing = view.editing || null; // playlist id being edited
    var query = view.query || '';
    var libMood = view.libMood || '';
    var libScene = view.libScene || '';
    function saveView() { if (NAV) NAV.state('view', { editing: editing, query: query, libMood: libMood, libScene: libScene }); }
    function trackLink(id, name) { return ctx.refLink ? '<a class="cw-ref-in" href="' + esc(ctx.refLink('music', ['track', id], 'Music')) + '">' + esc(name) + '</a>' : esc(name); }

    host.innerHTML = '<div class="cw-page cw-music"><header class="cw-page-head"><div><h2 class="cw-page-title">Music</h2>' +
      '<p class="cw-page-sub">Control the sound of the game. Playlists and uploads come from your Music Studio; only you hear this, through this device.</p></div>' +
      '<a class="btn btn-secondary btn-sm" href="' + esc(ctx.dashboardUrl('#music')) + '">Open Music Studio</a></header>' +
      '<section class="cw-card cw-keys" aria-labelledby="cm-keys-h"><h2 class="cw-card-title" id="cm-keys-h">Keyboard shortcuts</h2><div id="cm-keys"></div></section>' +
      '<section class="cw-card cv-session-music cw-music-card"><div id="cm-controller"></div></section>' +
      '<section class="cw-card"><h2 class="cw-card-title">Scenes &amp; cues</h2><div id="cm-cues"></div></section>' +
      '<section class="cw-card"><h2 class="cw-card-title">Playlists</h2><div id="cm-lists"></div></section>' +
      '<section class="cw-card"><h2 class="cw-card-title">Music log</h2><div id="cm-log"></div></section></div>';
    var $ = function (id) { return host.querySelector(id); };
    var unmount = global.FogSessionMusic ? global.FogSessionMusic.mount($('#cm-controller')) : function () {};

    // ---- Shortcuts ----------------------------------------------------------------------------------------------
    function drawKeys() {
      $('#cm-keys').innerHTML = '<ul class="cw-keylist"><li><kbd>Space</kbd> play / pause</li><li><kbd>N</kbd> next track</li><li><kbd>P</kbd> previous track</li><li><kbd>S</kbd> stop</li>' +
        '<li><kbd>Tab</kbd> next cue · <kbd>Shift</kbd>+<kbd>Tab</kbd> previous cue <span class="cw-muted">(cue mode only)</span></li></ul>' +
        '<div class="cw-cuemode"><button type="button" class="cw-mode-toggle' + (cueMode ? ' is-on' : '') + '" data-cm="cuemode" aria-pressed="' + cueMode + '"' + (cues.length ? '' : ' disabled') + '>Cue mode: ' + (cueMode ? 'on' : 'off') + '</button>' +
        '<span class="cw-muted cw-fine">' + (cues.length ? (cueMode ? 'Tab now advances the cue instead of moving keyboard focus. Press Esc or switch it off to use Tab normally.' : 'Switch on while you run the scene: Tab then plays the next cue. Off, Tab moves focus as usual.') : 'Add cues below to use Tab.') + '</span></div>' +
        '<p class="cw-muted cw-fine">Shortcuts work while you aren\'t typing in a field or focused on a button.</p>';
    }

    // ---- Controller is mounted above; scenes & cues -------------------------------------------------------------
    function targetLabel(c) {
      if (c.type === 'track') { var i = Player().info(c.ref); return 'Track: ' + (i && i.title || 'Unavailable'); }
      var p = Store().getPlaylist(c.id);
      return p ? 'Playlist: ' + p.name + ' (' + p.items.length + ')' : 'Playlist no longer exists';
    }
    function playCue(i) {
      var c = cues[i];
      if (!c) return false;
      if (c.type === 'track') { Player().play(c.ref); }
      else {
        var p = Store().getPlaylist(c.id);
        if (!p || !p.items.length) { UI().notice('That cue\'s playlist is empty or gone.', 'error'); return false; }
        var k = Store().prefs().shuffle ? Math.floor(Math.random() * p.items.length) : 0;
        Player().play(p.items[k], { queue: { playlistId: p.id, name: p.name, items: p.items }, index: k });
      }
      cueIndex = i;
      drawCues();
      return true;
    }
    function drawCues() {
      var pls = Store().playlists();
      var tracks = Cat() ? Cat().list().filter(function (r) { return r.kind !== 'sfx'; }) : [];
      var rows = cues.map(function (c, i) {
        return '<li class="cw-cue' + (i === cueIndex ? ' is-now' : '') + '"><span class="cw-cue-no">' + (i + 1) + '</span><div class="cw-cue-main"><strong>' + esc(c.label) + '</strong><span class="cw-muted">' + esc(targetLabel(c)) + '</span></div>' +
          '<div class="cw-cue-tools"><button type="button" class="cw-mini-btn" data-cm="cue-play" data-i="' + i + '">▶ Play</button><button type="button" class="cw-icon-btn" data-cm="cue-up" data-i="' + i + '" aria-label="Move cue ' + (i + 1) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="cw-icon-btn" data-cm="cue-down" data-i="' + i + '" aria-label="Move cue ' + (i + 1) + ' down"' + (i === cues.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="cw-icon-btn" data-cm="cue-del" data-i="' + i + '" aria-label="Remove cue ' + (i + 1) + '">✕</button></div></li>';
      }).join('');
      $('#cm-cues').innerHTML = '<p class="cw-muted">A cue is a scene or situation with the music for it, in the order you expect to need it. Tie each one to a playlist or a single track.</p>' +
        (cues.length ? '<ol class="cw-cues">' + rows + '</ol>' : '<p class="cw-muted">No cues yet.</p>') +
        '<form class="cw-cue-form" data-cm-form="cue" novalidate><label class="cw-field"><span>Scene or situation</span><input class="form-control" name="label" list="cm-scenes" maxlength="40" placeholder="Tavern, Boss Fight…" required></label><datalist id="cm-scenes">' + SCENES.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
        '<label class="cw-field"><span>Music</span><select class="form-control" name="target"><option value="">Choose…</option>' +
        (pls.length ? '<optgroup label="Playlists">' + pls.map(function (p) { return '<option value="pl:' + esc(p.id) + '">' + esc(p.name) + ' (' + p.items.length + ')</option>'; }).join('') + '</optgroup>' : '') +
        (tracks.length ? '<optgroup label="Single track">' + tracks.map(function (t) { return '<option value="rec:' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('') + '</optgroup>' : '') + '</select></label>' +
        '<button type="submit" class="btn btn-secondary btn-sm">Add cue</button></form><p class="cw-form-error" role="alert" hidden></p>';
    }
    function persistCues() { if (!saveCues(ctx, cues)) UI().notice('Could not save the cues in this browser (storage full or blocked).', 'error'); }

    // ---- Playlist builder ---------------------------------------------------------------------------------------
    function drawLists() {
      var pls = Store().playlists();
      if (editing && !Store().getPlaylist(editing)) editing = null;
      var cur = editing ? Store().getPlaylist(editing) : null;
      var left = '<div class="cw-pl-side"><ul class="cw-pl-list">' + (pls.length ? pls.map(function (p) {
        return '<li><button type="button" class="cw-pl-item' + (p.id === editing ? ' is-active' : '') + '" data-cm="pl-open" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === editing) + '"><strong>' + esc(p.name) + '</strong><span class="cw-muted">' + p.items.length + ' track' + (p.items.length === 1 ? '' : 's') + '</span></button></li>';
      }).join('') : '<li class="cw-muted">No playlists yet.</li>') + '</ul>' +
        '<form class="cw-newpl" data-cm-form="newpl" novalidate><label class="cw-visually-hidden" for="cm-newpl">New playlist name</label><input id="cm-newpl" class="form-control" name="name" maxlength="60" placeholder="New playlist name" required><button type="submit" class="btn btn-secondary btn-sm">Create</button></form></div>';
      var right;
      if (!cur) right = '<div class="cw-pl-edit cw-empty"><p>Choose a playlist to edit it, or create a new one.</p></div>';
      else {
        var words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var C = Cat();
        var lib = C ? C.list().filter(function (r) {
          if (libMood && (r.moods || []).indexOf(libMood) < 0) return false;
          if (libScene && (r.scenes || []).indexOf(libScene) < 0) return false;
          var hay = (r.name + ' ' + C.categoryLabel(r.category) + ' ' + (r.author || '') + ' ' + (r.tags || []).join(' ') + ' ' + (r.moods || []).map(C.moodLabel).join(' ') + ' ' + (r.scenes || []).map(C.sceneLabel).join(' ')).toLowerCase();
          return words.every(function (w) { return hay.indexOf(w) >= 0; });
        }).slice(0, 12) : [];
        var opt = function (list, cur, first) { return '<option value="">' + first + '</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join(''); };
        right = '<div class="cw-pl-edit"><form class="cw-rename" data-cm-form="rename" data-id="' + esc(cur.id) + '" novalidate><label class="cw-field"><span>Name</span><input class="form-control" name="name" maxlength="60" value="' + esc(cur.name) + '"></label><button type="submit" class="btn btn-secondary btn-sm">Rename</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-cm="pl-dup" data-id="' + esc(cur.id) + '">Duplicate</button><button type="button" class="cv-link-btn cv-danger" data-cm="pl-del" data-id="' + esc(cur.id) + '">Delete</button></form>' +
          '<p class="cw-live is-on" role="status">● Every change is saved as you make it.</p>' +
          '<h4 class="cv-subheading">Tracks</h4>' + (cur.items.length ? '<ol class="cw-tracks">' + cur.items.map(function (ref, i) {
            var inf = Player().info(ref) || {};
            return '<li><span class="cw-cue-no">' + (i + 1) + '</span><span class="cw-cue-main"><strong>' + (/^rec:/.test(ref) && !inf.missing ? trackLink(ref.slice(4), inf.title || ref) : esc(inf.title || ref)) + '</strong><span class="cw-muted">' + esc(inf.kind || '') + (inf.missing ? ' · unavailable' : '') + '</span></span>' +
              '<span class="cw-cue-tools"><button type="button" class="cw-mini-btn" data-cm="tr-play" data-ref="' + esc(ref) + '" aria-label="Preview ' + esc(inf.title || ref) + '">▶ Preview</button>' +
              '<button type="button" class="cw-icon-btn" data-cm="tr-up" data-id="' + esc(cur.id) + '" data-i="' + i + '" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button type="button" class="cw-icon-btn" data-cm="tr-down" data-id="' + esc(cur.id) + '" data-i="' + i + '" aria-label="Move down"' + (i === cur.items.length - 1 ? ' disabled' : '') + '>↓</button>' +
              '<button type="button" class="cw-icon-btn" data-cm="tr-del" data-id="' + esc(cur.id) + '" data-i="' + i + '" aria-label="Remove from the playlist">✕</button></span></li>';
          }).join('') + '</ol>' : '<p class="cw-muted">This playlist is empty. Add tracks from the library below.</p>') +
          '<h4 class="cv-subheading">Add from the library</h4><label class="cw-field"><span class="cw-visually-hidden">Search the library</span><input class="form-control" type="search" id="cm-search" value="' + esc(query) + '" placeholder="Search music, ambience and effects…" autocomplete="off"></label>' +
          (C ? '<div class="cw-lib-filters"><label class="cw-visually-hidden" for="cm-mood">Mood</label><select class="form-control" id="cm-mood">' + opt(C.moods(), libMood, 'Any mood') + '</select>' +
            '<label class="cw-visually-hidden" for="cm-scene">Scene</label><select class="form-control" id="cm-scene">' + opt(C.scenes(), libScene, 'Any scene') + '</select></div>' : '') +
          '<ul class="cw-lib">' + (lib.length ? lib.map(function (r) {
            return '<li><span class="cw-cue-main"><strong>' + trackLink(r.id, r.name) + '</strong><span class="cw-muted">' + esc(r.kind) + (r.category ? ' · ' + esc(C.categoryLabel(r.category)) : '') + ((r.moods || []).length ? ' · ' + esc(r.moods.map(C.moodLabel).join(', ')) : '') + (r.intensity ? ' · ' + esc(C.intensityLabel(r.intensity)) + ' intensity' : '') + '</span></span><span class="cw-cue-tools"><button type="button" class="cw-mini-btn" data-cm="tr-play" data-ref="rec:' + esc(r.id) + '">▶ Preview</button><button type="button" class="btn btn-secondary btn-sm" data-cm="tr-add" data-id="' + esc(cur.id) + '" data-ref="rec:' + esc(r.id) + '">Add</button></span></li>';
          }).join('') : '<li class="cw-muted">' + (Cat() ? 'Nothing matches.' : 'The library is still loading.') + '</li>') + '</ul></div>';
      }
      $('#cm-lists').innerHTML = '<div class="cw-pl-grid">' + left + right + '</div>';
    }

    function drawLog() {
      var hist = Store().history().slice(0, 12);
      $('#cm-log').innerHTML = hist.length
        ? '<ol class="cw-musiclog">' + hist.map(function (h) { return '<li><span>' + esc(h.title) + '</span><time datetime="' + esc(h.at) + '" class="cw-muted">' + esc(new Date(h.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</time></li>'; }).join('') + '</ol>'
        : '<p class="cw-muted">Nothing has been played yet. Start a scene above; what plays is listed here (the same history as the Music Studio).</p>';
    }

    // ---- Events -------------------------------------------------------------------------------------------------
    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-cm]');
      if (!b) return;
      var a = b.getAttribute('data-cm');
      var id = b.getAttribute('data-id');
      var i = Number(b.getAttribute('data-i'));
      var res;
      if (a === 'cuemode') { cueMode = !cueMode; drawKeys(); }
      else if (a === 'cue-play') playCue(i);
      else if (a === 'cue-up' || a === 'cue-down') { var j = a === 'cue-up' ? i - 1 : i + 1; if (cues[j]) { var t = cues[i]; cues[i] = cues[j]; cues[j] = t; if (cueIndex === i) cueIndex = j; else if (cueIndex === j) cueIndex = i; persistCues(); drawCues(); } }
      else if (a === 'cue-del') { cues.splice(i, 1); if (cueIndex >= cues.length) cueIndex = -1; if (!cues.length) cueMode = false; persistCues(); drawCues(); drawKeys(); }
      else if (a === 'pl-open') { editing = id; query = ''; drawLists(); }
      else if (a === 'pl-dup') {
        var src = Store().getPlaylist(id);
        res = Store().createPlaylist((src.name + ' (copy)').slice(0, 60));
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        src.items.forEach(function (ref) { Store().addToPlaylist(res.playlist.id, ref); });
        editing = res.playlist.id;
        UI().notice('Playlist duplicated.');
        drawLists();
      } else if (a === 'pl-del') {
        var p = Store().getPlaylist(id);
        var used = cues.filter(function (c) { return c.type === 'playlist' && c.id === id; }).length;
        if (!(await UI().confirm({ title: 'Delete "' + p.name + '"?', message: 'The playlist is deleted from your Music Studio too.' + (used ? ' ' + used + ' cue' + (used === 1 ? ' uses' : 's use') + ' it and will have no music.' : ''), confirmLabel: 'Delete playlist', danger: true }))) return;
        Store().deletePlaylist(id);
        editing = null;
        UI().notice('Playlist deleted.');
        drawLists(); drawCues();
      } else if (a === 'tr-play') Player().play(b.getAttribute('data-ref'));
      else if (a === 'tr-add') { res = Store().addToPlaylist(id, b.getAttribute('data-ref')); if (!res.ok) UI().notice(res.message, 'error'); else drawLists(); }
      else if (a === 'tr-del') { Store().removeFromPlaylist(id, i); drawLists(); }
      else if (a === 'tr-up') { Store().moveInPlaylist(id, i, -1); drawLists(); }
      else if (a === 'tr-down') { Store().moveInPlaylist(id, i, 1); drawLists(); }
    });

    host.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-cm-form]');
      if (!f) return;
      e.preventDefault();
      var kind = f.getAttribute('data-cm-form');
      if (kind === 'newpl') {
        var res = Store().createPlaylist(f.name.value);
        if (!res.ok) { UI().notice(res.message, 'error'); return; }
        editing = res.playlist.id;
        drawLists();
      } else if (kind === 'rename') {
        var r = Store().renamePlaylist(f.getAttribute('data-id'), f.name.value);
        if (!r.ok) UI().notice(r.message, 'error'); else { UI().notice('Renamed.'); drawLists(); drawCues(); }
      } else if (kind === 'cue') {
        var err = host.querySelector('#cm-cues .cw-form-error');
        var label = f.label.value.trim();
        var tv = f.target.value;
        if (!label || !tv) { err.textContent = 'Name the scene and choose its music.'; err.hidden = false; return; }
        if (cues.length >= 40) { err.textContent = 'A campaign can have up to 40 cues.'; err.hidden = false; return; }
        cues.push(tv.indexOf('pl:') === 0 ? { label: label, type: 'playlist', id: tv.slice(3) } : { label: label, type: 'track', ref: tv });
        persistCues();
        drawCues(); drawKeys();
      }
    });
    host.addEventListener('change', function (e) {
      if (e.target.id === 'cm-mood' || e.target.id === 'cm-scene') {
        if (e.target.id === 'cm-mood') libMood = e.target.value; else libScene = e.target.value;
        drawLists();
      }
    });
    host.addEventListener('input', function (e) {
      if (e.target.id === 'cm-search') {
        query = e.target.value;
        var pos = e.target.selectionStart;
        drawLists();
        var el = host.querySelector('#cm-search');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      }
    });

    function onKey(e) {
      if (archived) return;
      if (cueMode && e.key === 'Escape' && !document.querySelector('dialog[open]')) { cueMode = false; drawKeys(); return; }
      if (cueMode && e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]')) {
        var t = e.target;
        var typing = t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(t.tagName) >= 0 || (t && t.isContentEditable);
        if (!typing && cues.length) {
          e.preventDefault();
          var next = e.shiftKey ? cueIndex - 1 : cueIndex + 1;
          if (next < 0 || next >= cues.length) { UI().notice(next < 0 ? 'This is the first cue.' : 'That was the last cue.'); return; }
          playCue(next);
          return;
        }
      }
      if (keyBelongsElsewhere(e)) return;
      var k = e.key;
      if (k === ' ' || k === 'Spacebar') { e.preventDefault(); Player().toggle(); }
      else if (k === 'n' || k === 'N') { Player().next(); }
      else if (k === 'p' || k === 'P') { Player().prev(); }
      else if (k === 's' || k === 'S') { Player().stop(); }
    }
    document.addEventListener('keydown', onKey);

    // remember the playlist, search and filters (restored when coming back, e.g. from a track's details)
    host.addEventListener('click', function () { setTimeout(saveView, 0); });
    host.addEventListener('input', function () { setTimeout(saveView, 0); });
    host.addEventListener('change', function () { setTimeout(saveView, 0); });
    drawKeys(); drawCues(); drawLists(); drawLog();
    if (Cat()) Cat().ready().then(function () { drawCues(); drawLists(); });
    var offStore = Store().onChange(function () { drawLog(); });

    return function cleanup() {
      document.removeEventListener('keydown', onKey);
      offStore();
      unmount();
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.music = { render: render, keyBelongsElsewhere: keyBelongsElsewhere };
})(window);
