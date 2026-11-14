/**
 * Test stand-in (harness only) for migration 20261120120000_session_experience.sql: sessions (one active per campaign, the
 * DM starts / updates / ends them, players read them), DM-only session notes, and shared maps with the same token rules as
 * public.move_map_token (the DM moves any token; a player only their own visible token, and only when the DM allows it;
 * hidden tokens are never given to players). Those rules are tested against the real database in tests/db/rls.test.mjs.
 * Also: Foggy's "prepare" and "recap" answers follow the server's rules (only inventory ids; only what the notes say).
 */
(function (global) {
  'use strict';
  var I = global.__mockInternals;
  var data = I.data;
  (global.__mockInit = global.__mockInit || []).push(function (S) { S.sessions = S.sessions || []; S.sessionNotes = S.sessionNotes || {}; S.maps = S.maps || []; S.mapHidden = S.mapHidden || {}; S.mapView = S.mapView || {}; S.mapImages = S.mapImages || {}; });
  function S() { return I.S; }
  function now() { return new Date().toISOString(); }
  function h() { return global.__cwHandlers && global.__cwHandlers.current; }
  function pushSession(s) { var x = h(); if (x && x.onSession) x.onSession(s); }
  function pushMap(m) { var x = h(); if (x && x.onMap) x.onMap(m); }
  function dmOf(cid) { return I.isOwner(cid) && I.active(cid); }

  // ---- sessions ----
  data.listSessions = function (cid) {
    if (!I.isMember(cid)) return I.ok({ sessions: [] });
    return I.ok({ sessions: I.clone(S().sessions.filter(function (s) { return s.campaignId === cid; })).sort(function (a, b) { return b.number - a.number; }) });
  };
  data.startSession = function (cid, meetingId, title) {
    if (!dmOf(cid)) return I.no('Only the Dungeon Master starts sessions.');
    var act = S().sessions.find(function (s) { return s.campaignId === cid && s.status === 'active'; });
    if (act) return I.ok({ id: act.id });
    var n = S().sessions.filter(function (s) { return s.campaignId === cid; }).reduce(function (m, s) { return Math.max(m, s.number); }, 0) + 1;
    var prog = (S().progress || {})[cid];
    var s = { id: I.uid(), campaignId: cid, number: n, title: title || 'Session ' + n, meetingId: meetingId || null, status: 'active', adventureId: I.camp(cid).adventureId, position: prog && prog.currentSection ? { sectionId: prog.currentSection } : null, results: [], startedAt: now(), endedAt: null };
    S().sessions.push(s); S().sessionNotes[s.id] = { notes: '', details: {} }; I.save(); pushSession(s);
    return I.ok({ id: s.id });
  };
  data.updateSession = function (id, patch) {
    var s = S().sessions.find(function (x) { return x.id === id; });
    if (!s || !dmOf(s.campaignId)) return I.no('Only the Dungeon Master can update the session.');
    if (patch.title) s.title = String(patch.title).slice(0, 120);
    if (patch.position) s.position = patch.position;
    if (patch.result) { s.results = s.results.filter(function (r) { return r.combatKey !== patch.result.combatKey; }); s.results.push(Object.assign({}, patch.result, { recordedAt: now() })); }
    I.save(); pushSession(s);
    return I.ok();
  };
  data.endSession = function (id) {
    var s = S().sessions.find(function (x) { return x.id === id; });
    if (!s || !dmOf(s.campaignId)) return I.no('Only the Dungeon Master can end the session.');
    s.status = 'ended'; s.endedAt = now(); I.save(); pushSession(s);
    return I.ok();
  };
  data.getSessionNotes = function (id) {
    var s = S().sessions.find(function (x) { return x.id === id; });
    if (!s || !I.isOwner(s.campaignId)) return I.ok({ notes: { notes: '', details: {} } }); // RLS: players simply get nothing
    return I.ok({ notes: I.clone(S().sessionNotes[id] || { notes: '', details: {} }) });
  };
  data.saveSessionNotes = function (cid, id, notes, details) {
    if (!I.isOwner(cid)) return I.no('Only the Dungeon Master can write session notes.');
    S().sessionNotes[id] = { notes: notes || '', details: I.clone(details || {}) }; I.save();
    return I.ok();
  };
  // memories remember their session (campaign_memories.session_id)
  var saveMem = data.saveMemory, listMem = data.listMemories;
  data.saveMemory = function (cid, m) {
    return Promise.resolve(saveMem(cid, m)).then(function (res) {
      if (res.ok && m.sessionId !== undefined) { var row = S().memories.find(function (x) { return x.id === res.memory.id; }); row.sessionId = m.sessionId || null; I.save(); res.memory.sessionId = row.sessionId; }
      return res;
    });
  };
  data.listMemories = function (cid) {
    return Promise.resolve(listMem(cid)).then(function (res) {
      if (res.ok) res.memories.forEach(function (m) { var row = S().memories.find(function (x) { return x.id === m.id; }); m.sessionId = row && row.sessionId || null; });
      return res;
    });
  };

  // ---- maps ----
  function visibleRow(m) { return { id: m.id, campaignId: m.campaignId, key: m.key, title: m.title, imagePath: m.imagePath, grid: I.clone(m.grid), tokens: I.clone(m.tokens), playersMove: m.playersMove, version: m.version, updatedAt: m.updatedAt }; }
  data.getMaps = function (cid, asDm) {
    if (!I.isMember(cid)) return I.ok({ maps: [], shownId: null, hidden: {} });
    var maps = S().maps.filter(function (m) { return m.campaignId === cid; }).map(visibleRow);
    var hidden = {};
    if (asDm && I.isOwner(cid)) maps.forEach(function (m) { hidden[m.id] = I.clone(S().mapHidden[m.id] || []); });
    return I.ok({ maps: maps, shownId: S().mapView[cid] || null, hidden: hidden });
  };
  data.uploadMapImage = function (cid, file) {
    if (!dmOf(cid)) return I.no('Only the Dungeon Master shares maps.');
    return new Promise(function (resolve) {
      var fr = new FileReader();
      fr.onload = function () { var path = cid + '/maps/' + I.uid() + '.jpg'; S().mapImages[path] = fr.result; I.save(); resolve(I.ok({ path: path })); };
      fr.onerror = function () { resolve(I.no('The picture couldn’t be read.')); };
      fr.readAsDataURL(file);
    });
  };
  data.mapImageUrls = function (paths) { var out = {}; (paths || []).forEach(function (p) { if (S().mapImages[p]) out[p] = S().mapImages[p]; }); return Promise.resolve(out); };
  function cleanTokens(list, grid) {
    return (list || []).slice(0, 80).map(function (t) { return { id: String(t.id).slice(0, 40), kind: t.kind, label: String(t.label || '').slice(0, 40), userId: t.userId || null, combatantId: t.combatantId || null, x: Math.max(0, Math.min(grid.cols - 1, Number(t.x) || 0)), y: Math.max(0, Math.min(grid.rows - 1, Number(t.y) || 0)), color: t.color || null }; });
  }
  data.saveMap = function (cid, m, expected) {
    if (!dmOf(cid)) return I.no('Only the Dungeon Master can change maps.');
    var row = S().maps.find(function (x) { return x.campaignId === cid && x.key === m.key; });
    if (row && expected != null && row.version !== expected) return I.no('The map changed in another tab. Reload it.');
    var grid = { cols: Math.max(4, Math.min(40, m.grid.cols | 0)), rows: Math.max(4, Math.min(40, m.grid.rows | 0)) };
    if (!row) { row = { id: I.uid(), campaignId: cid, key: m.key, version: 0 }; S().maps.push(row); }
    Object.assign(row, { title: m.title, imagePath: m.imagePath, grid: grid, tokens: cleanTokens(m.tokens, grid), playersMove: !!m.playersMove, version: row.version + 1, updatedAt: now() });
    S().mapHidden[row.id] = cleanTokens(m.hidden, grid);
    I.save(); pushMap(visibleRow(row));
    return I.ok({ id: row.id, version: row.version });
  };
  data.showMap = function (cid, mapId) {
    if (!dmOf(cid)) return I.no('Only the Dungeon Master chooses the map on screen.');
    S().mapView[cid] = mapId || null; I.save(); pushMap(null);
    return I.ok();
  };
  data.moveToken = function (mapId, tokenId, x, y) {
    var m = S().maps.find(function (r) { return r.id === mapId; });
    if (!m) return I.no('Map not found.');
    var dm = I.isOwner(m.campaignId);
    var t = m.tokens.find(function (k) { return k.id === tokenId; }) || (dm ? (S().mapHidden[m.id] || []).find(function (k) { return k.id === tokenId; }) : null);
    if (!t) return I.no('Token not found.');
    if (!dm && !(m.playersMove && t.userId === I.me && I.active(m.campaignId))) return I.no(m.playersMove ? 'You can only move your own token.' : 'The Dungeon Master moves the tokens.');
    t.x = Math.max(0, Math.min(m.grid.cols - 1, Math.round(x * 2) / 2)); t.y = Math.max(0, Math.min(m.grid.rows - 1, Math.round(y * 2) / 2));
    m.version++; I.save(); pushMap(visibleRow(m));
    return I.ok();
  };

  // ---- the adventure stand-in keeps encounters (and other content edits) like adventures.content in the database ----
  global.__mock.setAdventureContent = function (patch) { S().advContent = Object.assign({}, S().advContent || {}, patch); I.save(); };
  (global.__mockInit = global.__mockInit || []).push(function () {
    Promise.resolve().then(function () { // after the stores are locked in place
      var st = global.FogAdventureStore;
      if (!st || st.__sessionPatched) return;
      st.__sessionPatched = true;
      var get0 = st.get;
      st.get = function (id) {
        return Promise.resolve(get0(id)).then(function (r) {
          if (r.ok && S().advContent) { Object.assign(r.adventure.content, I.clone(S().advContent)); if (global.FogAdventureModel) r.adventure = global.FogAdventureModel.normalize(r.adventure); }
          return r;
        });
      };
      st.save = function (adv) {
        if (I.me !== I.USERS.dm.id) return Promise.resolve(I.no('This adventure isn’t yours.'));
        S().advContent = { encounters: I.clone(adv.content.encounters || []), assets: I.clone(adv.content.assets || []) };
        I.save();
        return Promise.resolve(I.ok({ version: (adv.version || 1) + 1 }));
      };
    });
  });

  // ---- Foggy: prepare / recap (wrapping the combat stand-in) ----
  var prev = global.FogFoggyBackend;
  var wrapped = function (fn, body) {
    if (fn === 'foggy-assistant' && body.action === 'prepare') {
      (global.__foggyCalls = global.__foggyCalls || []).push({ fn: fn, body: JSON.parse(JSON.stringify(body)) });
      var items = body.payload.inventory.items;
      var open = items.filter(function (i) { return i.kind === 'section' || i.kind === 'encounter' || i.kind === 'monster'; }).map(function (i) { return { id: i.id, why: 'Needed for “' + i.title + '”.' }; });
      open.push({ id: 'monster:beholder', why: 'invented' });
      var known = {}; items.forEach(function (i) { known[i.id] = 1; });
      return Promise.resolve({ ok: true, result: { summary: 'The party reaches ' + body.payload.inventory.where + '.', open: open.filter(function (o) { return known[o.id]; }), missing: body.payload.inventory.missing, suggestions: ['Read the encounter intro aloud.'], ignored: 1 } });
    }
    if (fn === 'foggy-assistant' && body.action === 'recap') {
      (global.__foggyCalls = global.__foggyCalls || []).push({ fn: fn, body: JSON.parse(JSON.stringify(body)) });
      var se = body.payload.session;
      if (!se.notes && !se.results.length) return Promise.resolve({ ok: false, code: 'bad_request', message: 'Write some session notes (or finish an encounter) first: Foggy only works from what happened.' });
      return Promise.resolve({ ok: true, result: { playerRecap: { happened: 'From the notes: ' + se.notes.slice(0, 80) }, dmSummary: 'DM view: ' + se.notes.slice(0, 40), threads: ['Who sent the goblins?'], hooks: ['The bridge'] } });
    }
    return prev ? prev(fn, body) : Promise.resolve({ ok: false, code: 'unavailable', message: 'No server in the harness.' });
  };
  if (prev && prev.access) wrapped.access = prev.access;
  global.FogFoggyBackend = wrapped;
})(window);
