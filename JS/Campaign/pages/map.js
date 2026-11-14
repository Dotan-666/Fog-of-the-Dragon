/**
 * Map: the campaign's shared, playable map (also what Meeting in the Fog participants look at).
 *
 * The DM shares a map (one of the adventure's map assets with a picture, or an image file), sets its grid, places tokens
 * (the party and the monsters of the current combat, or markers), chooses which map is on screen for everyone, and decides
 * whether players may move their own tokens. Everyone in the campaign sees the shown map and its VISIBLE tokens live; hidden
 * monsters never leave the DM's browser (they are stored apart, DM only). Moving a token is one small update checked by the
 * database (public.move_map_token): players can move only their own token, and only when allowed. Zoom is each viewer's own.
 * A decorative illustration can be shared too, but the grid makes it a board: tokens snap to its squares.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var Maps = function () { return global.FogCampaignMaps; };
  function esc(s) { return UI().esc(s); }

  async function render(host, ctx) {
    var alive = true, isDm = ctx.isDm, archived = ctx.campaign.status === 'archived';
    var maps = [], shownId = null, hidden = {}, urls = {}, notSetUp = false, error = '';
    var viewId = null;           // the map this viewer is looking at (DM: any; players: the shown one)
    var zoom = 1;
    try { zoom = Number(global.localStorage.getItem('fog_map_zoom')) || 1; } catch (e) { /* preference */ }
    var drag = null, busy = '';

    host.innerHTML = '<div class="cw-page cw-map"><header class="cw-page-head"><div><h2 class="cw-page-title">Map</h2>' +
      '<p class="cw-page-sub">' + (isDm ? 'Share a map with the party, place the tokens and move them. Everyone sees the map you show, live.' : 'The map your Dungeon Master is showing, live.') + '</p></div><p class="cw-live" id="mp-live" aria-live="polite"></p></header><div id="mp-body"></div></div>';
    var body = host.querySelector('#mp-body');

    function current() { return maps.find(function (m) { return m.id === viewId; }) || null; }
    function canMove(t, m) { return !archived && (isDm || (m.playersMove && t.userId === ctx.me.id)); }

    function board(m) {
      var cols = m.grid.cols || 20, rows = m.grid.rows || 20;
      var all = m.tokens.map(function (t) { return Object.assign({ hidden: false }, t); }).concat(isDm ? (hidden[m.id] || []).map(function (t) { return Object.assign({}, t, { hidden: true }); }) : []);
      return '<div class="mp-viewport" id="mp-viewport"><div class="mp-board" id="mp-board" style="--cols:' + cols + ';--rows:' + rows + ';width:' + Math.round(100 * zoom) + '%;aspect-ratio:' + cols + ' / ' + rows + '">' +
        (urls[m.imagePath] ? '<img class="mp-img" src="' + esc(urls[m.imagePath]) + '" alt="' + esc(m.title) + '" draggable="false">' : '<div class="mp-img mp-img-ph">Loading the map…</div>') +
        '<div class="mp-grid" aria-hidden="true"></div>' +
        all.map(function (t) {
          var mov = canMove(t, m);
          return '<button type="button" class="mp-token is-' + esc(t.kind) + (t.hidden ? ' is-hidden' : '') + (t.userId === ctx.me.id ? ' is-mine' : '') + (mov ? ' is-movable' : '') + '" data-token="' + esc(t.id) + '"' +
            ' style="left:' + ((t.x + 0.5) / cols * 100) + '%;top:' + ((t.y + 0.5) / rows * 100) + '%;' + (t.color ? '--tok:' + esc(t.color) : '') + '" title="' + esc(t.label + (t.hidden ? ' (hidden from players)' : '') + (mov ? ' — drag to move' : '')) + '"' + (mov ? '' : ' aria-disabled="true"') + '>' +
            '<span>' + esc((t.label || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()) + '</span></button>';
        }).join('') + '</div></div>';
    }

    function dmTools(m) {
      return '<section class="cw-card mp-tools" aria-label="Map controls"><div class="cw-actions">' +
        (m ? (shownId === m.id ? '<span class="cv-pill is-ok">On screen for everyone</span><button type="button" class="btn btn-secondary btn-sm" data-mp="hide">Stop showing</button>' : '<button type="button" class="btn btn-primary btn-sm" data-mp="show">Show this map to everyone</button>') +
          '<label class="cw-check"><input type="checkbox" data-mp="players-move"' + (m.playersMove ? ' checked' : '') + '> Players may move their own tokens</label>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-mp="sync">Add tokens from Combat</button><button type="button" class="btn btn-secondary btn-sm" data-mp="marker">+ Marker</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-mp="reset">Line tokens up again</button>' : '') + '</div>' +
        '<details class="mp-share"' + (maps.length ? '' : ' open') + '><summary>Share a map</summary><form class="mp-shareform" id="mp-share"><label class="cw-field"><span>Picture</span><select class="form-control" name="source" id="mp-source"><option value="">Choose…</option><option value="file">An image file…</option></select></label>' +
        '<input type="file" name="file" accept="image/png,image/jpeg,image/webp" hidden><label class="cw-field"><span>Title</span><input class="form-control" name="title" maxlength="120" placeholder="The flooded crypt"></label>' +
        '<label class="cw-field"><span>Grid (squares)</span><span class="mp-grid-in"><input class="cw-num" type="number" name="cols" min="4" max="40" value="20" aria-label="Columns"> × <input class="cw-num" type="number" name="rows" min="4" max="40" value="20" aria-label="Rows"></span></label>' +
        '<button type="submit" class="btn btn-primary btn-sm"' + (busy ? ' disabled' : '') + '>' + (busy || 'Share it') + '</button></form>' +
        '<p class="cw-muted cw-fine">The picture is copied into this campaign so the players can see it. Battle maps work best: Foggy’s playable maps already have a grid.</p></details></section>';
    }

    function draw() {
      if (!alive) return;
      if (notSetUp) { body.innerHTML = '<div class="cw-card cw-empty"><p>' + (isDm ? 'Shared maps aren’t set up in the database yet (migration 20261120120000_session_experience.sql).' : 'Maps aren’t available yet.') + '</p></div>'; return; }
      var m = current();
      var list = isDm ? '<nav class="mp-list" aria-label="Maps">' + maps.map(function (x) { return '<button type="button" class="mp-mapbtn' + (x.id === viewId ? ' is-on' : '') + '" data-mp="view" data-id="' + esc(x.id) + '">' + esc(x.title) + (x.id === shownId ? ' <span class="cv-pill is-ok">shown</span>' : '') + '</button>'; }).join('') + '</nav>' : '';
      var main = m ? '<div class="mp-head"><h3>' + esc(m.title) + '</h3><span class="cw-muted">' + m.grid.cols + ' × ' + m.grid.rows + ' squares</span><span class="mp-zoom"><button type="button" class="cw-mini-btn" data-mp="zoom-out" aria-label="Zoom out">−</button><button type="button" class="cw-mini-btn" data-mp="zoom-in" aria-label="Zoom in">+</button></span></div>' + board(m) +
        (!isDm ? '<p class="cw-muted cw-fine">' + (m.playersMove ? 'Drag your own token to move it.' : 'The Dungeon Master moves the tokens.') + '</p>' : '<p class="cw-muted cw-fine">Drag any token. Click a token to hide or reveal it, or remove it. Dashed tokens are hidden from the players.</p>')
        : '<div class="cw-card cw-empty"><p>' + (isDm ? (maps.length ? 'Choose a map.' : 'No map shared yet. Share one below, or start an encounter that has a map.') : 'The Dungeon Master isn’t showing a map right now.') + '</p></div>';
      body.innerHTML = (error ? '<p class="cw-banner is-warn" role="alert">' + esc(error) + '</p>' : '') + (isDm ? dmTools(m) + list : '') + main;
      if (isDm) fillSources();
    }
    async function fillSources() {
      var sel = host.querySelector('#mp-source');
      if (!sel || !ctx.campaign.adventureId || !global.FogAdventureStore) return;
      var r = await global.FogAdventureStore.get(ctx.campaign.adventureId);
      if (!alive || !r.ok || !host.querySelector('#mp-source')) return;
      r.adventure.content.assets.filter(function (a) { return a.type === 'map' && a.images.length; }).forEach(function (a) {
        var o = document.createElement('option'); o.value = 'asset:' + a.id; o.textContent = 'Adventure map: ' + a.title; sel.insertBefore(o, sel.lastChild);
      });
      host.__adventure = r.adventure;
    }

    async function load() {
      var r = await D().getMaps(ctx.id, isDm);
      if (!alive) return;
      if (!r.ok) { error = r.message; draw(); return; }
      notSetUp = !!r.notSetUp;
      maps = r.maps; shownId = r.shownId; hidden = r.hidden || {};
      if (!isDm) viewId = shownId;
      else if (!viewId || !maps.some(function (m) { return m.id === viewId; })) viewId = shownId || (maps[0] && maps[0].id) || null;
      var need = maps.map(function (m) { return m.imagePath; }).filter(function (p) { return !urls[p]; });
      if (need.length) Object.assign(urls, await D().mapImageUrls(need));
      if (!alive) return;
      if (!drag) draw();
    }

    async function saveWhole(m, tokens, hiddenList, extra) {
      var r = await D().saveMap(ctx.id, Object.assign({ key: m.key, title: m.title, imagePath: m.imagePath, grid: m.grid, tokens: tokens, hidden: hiddenList, playersMove: m.playersMove }, extra || {}), m.version);
      if (!r.ok) { UI().notice(r.message, 'error'); }
      await load();
    }

    // ---- dragging tokens (pointer events; snaps to the grid) ----
    function cellAt(ev, m) {
      var b = host.querySelector('#mp-board').getBoundingClientRect();
      var x = Math.floor((ev.clientX - b.left) / b.width * m.grid.cols), y = Math.floor((ev.clientY - b.top) / b.height * m.grid.rows);
      return { x: Math.max(0, Math.min(m.grid.cols - 1, x)), y: Math.max(0, Math.min(m.grid.rows - 1, y)) };
    }
    function onDown(ev) {
      var tEl = ev.target.closest('.mp-token.is-movable');
      if (!tEl) return;
      var m = current();
      drag = { el: tEl, id: tEl.getAttribute('data-token'), moved: false, start: { x: ev.clientX, y: ev.clientY } };
      tEl.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      tEl.classList.add('is-dragging');
      drag.m = m;
    }
    function onMove(ev) {
      if (!drag) return;
      if (Math.abs(ev.clientX - drag.start.x) + Math.abs(ev.clientY - drag.start.y) > 4) drag.moved = true;
      var b = host.querySelector('#mp-board').getBoundingClientRect();
      drag.el.style.left = Math.max(0, Math.min(100, (ev.clientX - b.left) / b.width * 100)) + '%';
      drag.el.style.top = Math.max(0, Math.min(100, (ev.clientY - b.top) / b.height * 100)) + '%';
    }
    async function onUp(ev) {
      if (!drag) return;
      var d = drag; drag = null;
      d.el.classList.remove('is-dragging');
      if (!d.moved) { if (isDm) tokenMenu(d.id); else draw(); return; }
      var c = cellAt(ev, d.m);
      var tk = d.m.tokens.concat(hidden[d.m.id] || []).find(function (t) { return t.id === d.id; });
      if (tk) { tk.x = c.x; tk.y = c.y; }
      draw();
      var r = await D().moveToken(d.m.id, d.id, c.x, c.y);
      if (!alive) return;
      if (!r.ok) UI().notice(r.message, 'error');
      load();
    }
    async function tokenMenu(id) {
      var m = current();
      var vis = m.tokens.find(function (t) { return t.id === id; });
      var hid = (hidden[m.id] || []).find(function (t) { return t.id === id; });
      var t = vis || hid;
      if (!t) return;
      var d = UI().dialog('<div class="cw-dialog-body"><h2 class="cw-dialog-title">' + esc(t.label) + '</h2><p class="cw-muted">' + (hid ? 'Hidden from the players.' : 'Visible to everyone.') + '</p>' +
        '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Close</button><button type="button" class="btn btn-secondary btn-sm" data-tk="remove">Remove token</button><button type="button" class="btn btn-primary btn-sm" data-tk="toggle">' + (hid ? 'Reveal to players' : 'Hide from players') + '</button></div></div>', { label: t.label });
      d.el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tk]');
        if (!b) return;
        var tokens = m.tokens.slice(), hl = (hidden[m.id] || []).slice();
        if (b.getAttribute('data-tk') === 'toggle') {
          if (hid) { hl = hl.filter(function (x) { return x.id !== id; }); tokens.push(hid); } else { tokens = tokens.filter(function (x) { return x.id !== id; }); hl.push(vis); }
        } else { tokens = tokens.filter(function (x) { return x.id !== id; }); hl = hl.filter(function (x) { return x.id !== id; }); }
        d.close();
        saveWhole(m, tokens, hl);
      });
    }

    async function onClick(e) {
      var b = e.target.closest('[data-mp]');
      if (!b) return;
      var a = b.getAttribute('data-mp');
      var m = current();
      if (a === 'zoom-in' || a === 'zoom-out') { zoom = Math.max(0.5, Math.min(3, zoom * (a === 'zoom-in' ? 1.25 : 0.8))); try { global.localStorage.setItem('fog_map_zoom', String(zoom)); } catch (er) { /* preference */ } draw(); return; }
      if (!isDm || archived) return;
      if (a === 'view') { viewId = b.getAttribute('data-id'); draw(); }
      else if (a === 'show' && m) { var r = await D().showMap(ctx.id, m.id); if (!r.ok) UI().notice(r.message, 'error'); else UI().notice('Everyone in the campaign now sees “' + m.title + '”.'); load(); }
      else if (a === 'hide') { await D().showMap(ctx.id, null); load(); }
      else if (a === 'sync' && m) {
        var cb = await D().getCombat(ctx.id, true);
        if (!cb.ok || !cb.encounter) { UI().notice('There is no encounter in Combat to take tokens from.', 'error'); return; }
        var tk = Maps().tokensFromCombat(cb.encounter, { tokens: m.tokens, hidden: hidden[m.id] || [] }, m.grid);
        saveWhole(m, tk.tokens, tk.hidden);
      } else if (a === 'marker' && m) {
        var label = global.prompt('Marker label (for example: Trap, Door, Exit)');
        if (!label) return;
        saveWhole(m, m.tokens.concat([{ id: 'mk' + Date.now().toString(36), kind: 'marker', label: label.slice(0, 40), x: Math.floor(m.grid.cols / 2), y: Math.floor(m.grid.rows / 2), color: Maps().COLORS.marker }]), hidden[m.id] || []);
      } else if (a === 'reset' && m) {
        if (!(await UI().confirm({ title: 'Line the tokens up again?', message: 'The party goes back to the left edge and the monsters to the right edge.', confirmLabel: 'Line them up' }))) return;
        var pcs = 0, mons = 0;
        var fix = function (t) { return Object.assign({}, t, t.kind === 'pc' ? { x: 1, y: Math.min(m.grid.rows - 1, 1 + 2 * pcs++) } : { x: Math.max(0, m.grid.cols - 2), y: Math.min(m.grid.rows - 1, 1 + 2 * mons++) }); };
        saveWhole(m, m.tokens.map(fix), (hidden[m.id] || []).map(fix));
      }
    }
    async function onChange(e) {
      var t = e.target;
      if (t.getAttribute('data-mp') === 'players-move') { var m = current(); if (m) saveWhole(m, m.tokens, hidden[m.id] || [], { playersMove: t.checked }); }
      if (t.id === 'mp-source') { var f = host.querySelector('#mp-share [name=file]'); f.hidden = t.value !== 'file'; if (t.value === 'file') f.click(); }
    }
    async function onSubmit(e) {
      if (e.target.id !== 'mp-share') return;
      e.preventDefault();
      var f = e.target, src = f.source.value;
      var grid = { cols: Math.max(4, Math.min(40, Number(f.cols.value) || 20)), rows: Math.max(4, Math.min(40, Number(f.rows.value) || 20)) };
      var title = f.title.value.trim();
      var cb = await D().getCombat(ctx.id, true);
      var combat = cb.ok && cb.encounter && cb.encounter.status !== 'ended' ? cb.encounter : null;
      busy = 'Sharing…'; draw();
      var r;
      if (src.indexOf('asset:') === 0 && host.__adventure) {
        var asset = host.__adventure.content.assets.find(function (a) { return a.id === src.slice(6); });
        r = await Maps().publishAsset(ctx, asset, { key: 'asset-' + asset.id, title: title || asset.title, grid: grid, combat: combat });
      } else if (src === 'file' && f.file.files[0]) {
        r = await Maps().publishFile(ctx, f.file.files[0], { key: 'file-' + Date.now().toString(36), title: title || f.file.files[0].name.replace(/\.[^.]+$/, ''), grid: grid, combat: combat });
      } else r = { ok: false, message: 'Choose a picture first.' };
      busy = '';
      if (!alive) return;
      if (!r.ok) { UI().notice(r.message, 'error'); draw(); return; }
      viewId = r.id;
      await load();
    }

    host.addEventListener('click', onClick);
    host.addEventListener('change', onChange);
    host.addEventListener('submit', onSubmit);
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    var timer = null;
    var off = ctx.on('map', function () { clearTimeout(timer); timer = setTimeout(load, 150); });
    var offLive = ctx.on('realtime', function (s) { var el = host.querySelector('#mp-live'); if (el) { el.className = 'cw-live' + (s === 'SUBSCRIBED' ? ' is-on' : ''); el.textContent = s === 'SUBSCRIBED' ? '● Live' : 'Live updates are off: reload to see changes'; } });
    body.innerHTML = '<p class="cw-loading" role="status">Loading the map…</p>';
    await load();
    return function () { alive = false; off(); offLive(); clearTimeout(timer); };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.map = { render: render };
})(window);
