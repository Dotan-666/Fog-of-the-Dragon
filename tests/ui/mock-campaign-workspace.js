/**
 * Test-only stand-ins for sign-in and the Supabase-backed stores, used by tests/ui/campaign-harness.html to exercise the
 * real Campaign workspace code (Pages/campaign.html and JS/Campaign/*) without a server.
 *
 * The in-memory data follows the same permission rules as the database policies in
 * supabase/migrations/20261112120000_campaign_workspace.sql (those rules are tested for real in tests/db/rls.test.mjs):
 * only members read a campaign; only the DM writes meetings, combat, progress and reveals; players get the public combat view.
 *
 * Who is signed in:   ?as=dm | p1 | p2 | out     Which campaign: ?c=<id>     Theme: ?theme=light
 * State lives in localStorage ("__mock_cw") so switching user or refreshing keeps it; ?reset=1 starts over.
 * Test hooks: window.__mock.pushMessage(userKey, text) simulates a realtime message from someone else, .state(), .reset().
 */
(function (global) {
  'use strict';

  var KEY = '__mock_cw';
  var q = new URLSearchParams(location.search);
  var USERS = {
    dm: { id: 'u-dm', name: 'Morgan Hale' },
    p1: { id: 'u-p1', name: 'Riley Brook' },
    p2: { id: 'u-p2', name: 'Sam Okafor' },
    out: { id: 'u-out', name: 'Casey Outsider' },
  };
  var who = USERS[q.get('as')] ? q.get('as') : 'dm';
  var me = USERS[who].id;
  var CAMP_A = '11111111-1111-4111-8111-111111111111'; // the DM's started campaign (dm, p1, p2)
  var CAMP_B = '22222222-2222-4222-8222-222222222222'; // p1 runs this one; still gathering (p1, dm)
  var ADV = '33333333-3333-4333-8333-333333333333';
  var real = global.FogCampaignData; // the real file (pure helpers such as meetingIsPast / validateMeeting)

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ok(x) { return Promise.resolve(Object.assign({ ok: true }, x || {})); }
  function no(msg, extra) { return Promise.resolve(Object.assign({ ok: false, message: msg }, extra || {})); }
  function ago(ms) { return new Date(Date.now() - ms).toISOString(); }
  function ahead(ms) { return new Date(Date.now() + ms).toISOString(); }
  function uid() { return 'id-' + Math.random().toString(36).slice(2, 10); }

  // ---- State ------------------------------------------------------------------------------------------------------
  function seed(snaps) {
    return {
      snaps: snaps,
      campaigns: [
        { id: CAMP_A, ownerId: USERS.dm.id, name: 'The Ashen Crown', description: 'The kingdom of Valdris is dying, and the crown that could save it lies in a drowned keep.', status: 'active', phase: 'started', source: 'homebrew', startingLevel: 3, requiredPlayers: 3, privacy: 'private', inviteCode: 'FOD-1234-AB', coverUrl: null, createdAt: ago(40 * 86400000), startedAt: ago(30 * 86400000), archivedAt: null, adventureId: ADV },
        { id: CAMP_B, ownerId: USERS.p1.id, name: 'Beneath Saltmarsh', description: '', status: 'active', phase: 'recruiting', source: 'homebrew', startingLevel: 1, requiredPlayers: 3, privacy: 'private', inviteCode: 'FOD-5678-CD', coverUrl: null, createdAt: ago(3 * 86400000), startedAt: null, archivedAt: null, adventureId: null },
      ],
      members: [
        { c: CAMP_A, u: USERS.dm.id, role: 'owner', joinedAt: ago(40 * 86400000), char: null },
        { c: CAMP_A, u: USERS.p1.id, role: 'player', joinedAt: ago(38 * 86400000), char: 'p1' },
        { c: CAMP_A, u: USERS.p2.id, role: 'player', joinedAt: ago(37 * 86400000), char: 'p2' },
        { c: CAMP_B, u: USERS.p1.id, role: 'owner', joinedAt: ago(3 * 86400000), char: null },
        { c: CAMP_B, u: USERS.dm.id, role: 'player', joinedAt: ago(2 * 86400000), char: null },
      ],
      messages: [], meetings: [], rsvps: [], combats: {}, progress: {}, reveals: [],
    };
  }
  var S = null;
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  function userOf(id) { return Object.keys(USERS).map(function (k) { return USERS[k]; }).find(function (u) { return u.id === id; }) || { id: id, name: 'Unknown' }; }
  function camp(id) { return S.campaigns.find(function (c) { return c.id === id; }); }
  function memberRow(cid, uid2) { return S.members.find(function (m) { return m.c === cid && m.u === uid2; }); }
  function isMember(cid) { return !!memberRow(cid, me); }
  function isOwner(cid) { var c = camp(cid); return !!c && c.ownerId === me; }
  function active(cid) { var c = camp(cid); return !!c && c.status === 'active'; }
  var DENIED = 'You don’t have permission to do that in this campaign.';

  global.FogSupabase = { client: null, configError: null };
  global.FogAccount = {
    ready: function () { return Promise.resolve({ session: { user: { id: me } } }); },
    hasStoredSession: function () { return true; },
    escapeHtml: esc,
    getAccount: function () { return { id: me, profile: { displayName: USERS[who].name, email: who + '@example.com', avatarUrl: null } }; },
    isSafeAvatarUrl: function () { return false; },
    isSafeImageUrl: function (u) { return typeof u === 'string' && /^data:image\//.test(u); },
    compressImage: function () { return Promise.reject(new Error('Not available in the test harness.')); },
    getPlan: function () { return { id: 'warlord', name: 'Warlord', activeCampaigns: 1, maxPeople: 5 }; },
    signOut: function () { return Promise.resolve(); },
    relativeTime: function (iso) { return new Date(iso).toLocaleString(); },
  };
  // The notification bell's store (same shape as fog-account.js: list / add / markRead / clear, ids are kept once).
  var notes = [];
  function noteEvent() { global.dispatchEvent(new CustomEvent('fog:notifications')); }
  global.FogNotifications = {
    add: function (n) { if (n.id && notes.some(function (x) { return x.id === n.id; })) return; notes.unshift({ id: n.id || uid(), kind: n.kind || 'info', title: n.title, message: n.message || '', link: n.link || null, createdAt: n.createdAt || new Date().toISOString(), read: !!n.read }); noteEvent(); },
    list: function () { return notes; },
    markRead: function (id) { notes.forEach(function (x) { if (!id || x.id === id) x.read = true; }); noteEvent(); },
    clear: function () { notes = []; noteEvent(); },
  };
  global.FogSettings = {
    // ?dice=off turns the Dashboard setting “3D Animated Dice” off (it is on by default, like the real default)
    get: function () { return { theme: q.get('theme') === 'light' ? 'light' : 'dark', dice3d: q.get('dice') !== 'off' }; },
    apply: function () { document.documentElement.setAttribute('data-theme', q.get('theme') === 'light' ? 'light' : 'dark'); },
  };
  global.FogSettings.apply();

  // ---- Campaign store (same rules as the database functions) ---------------------------------------------------------
  function view(cid) {
    var c = camp(cid);
    if (!c || !isMember(cid)) return null;
    var out = clone(c);
    out.role = c.ownerId === me ? 'dm' : 'player';
    out.roster = S.members.filter(function (m) { return m.c === cid; }).map(function (m) {
      var u = userOf(m.u);
      return {
        userId: m.u, role: m.role, status: 'active', joinedAt: m.joinedAt, isMe: m.u === me, displayName: u.name, avatarUrl: null,
        character: m.char ? clone(S.snaps[m.char]) : null, characterName: m.char ? S.snaps[m.char].narrative.name : null,
        characterBuiltBy: m.char ? 'player' : null,
      };
    });
    out.memberCount = out.roster.length;
    return out;
  }
  var store = {
    plan: function () { return global.FogAccount.getPlan(); },
    isSafeCoverUrl: function () { return false; },
    compressCover: function () { return Promise.reject(new Error('Not available in the test harness.')); },
    get: function (id) { var v = view(id); return v ? ok({ campaign: v }) : no('This campaign doesn’t exist, or you aren’t part of it.', { notFound: true }); },
    list: function () { return ok({ campaigns: S.campaigns.filter(function (c) { return isMember(c.id); }).map(function (c) { return view(c.id); }) }); },
    update: function (id, patch) {
      if (!isOwner(id)) return no('Only the Dungeon Master can change campaign settings.');
      var c = camp(id);
      if (!patch.name || !String(patch.name).trim()) return no('Give your campaign a name.');
      if (c.phase === 'started' && (Number(patch.startingLevel) !== c.startingLevel || Number(patch.requiredPlayers) !== c.requiredPlayers)) return no('The starting setup is locked once the campaign has started.');
      c.name = patch.name.trim(); c.description = patch.description || ''; c.startingLevel = Number(patch.startingLevel); c.requiredPlayers = Number(patch.requiredPlayers); c.privacy = patch.privacy;
      save();
      return ok();
    },
    archive: function (id) { if (!isOwner(id)) return no('Only the Dungeon Master can do that.'); var c = camp(id); c.status = 'archived'; c.archivedAt = new Date().toISOString(); save(); return ok(); },
    restore: function (id) { if (!isOwner(id)) return no('Only the Dungeon Master can do that.'); var c = camp(id); c.status = 'active'; c.archivedAt = null; save(); return ok(); },
    remove: function (id) {
      if (!isOwner(id)) return no('Only the Dungeon Master can delete a campaign.');
      S.campaigns = S.campaigns.filter(function (c) { return c.id !== id; }); S.members = S.members.filter(function (m) { return m.c !== id; }); save(); return ok();
    },
    removeMember: function (id, userId) {
      var c = camp(id);
      if (!c || c.phase === 'started') return no('That isn’t possible once the campaign has started.');
      if (!(userId === me || isOwner(id))) return no('Only the Dungeon Master can do that.');
      S.members = S.members.filter(function (m) { return !(m.c === id && m.u === userId && m.role !== 'owner'); }); save(); return ok();
    },
    setAdventure: function (id, adv) { if (!isOwner(id)) return no('Only the Dungeon Master can do that.'); if (camp(id).phase === 'started') return no('The adventure is locked once the campaign has started.'); camp(id).adventureId = adv; save(); return ok(); },
    setCharacter: function () { return no('Not used in these tests.'); },
    clearCharacter: function (id, userId) { var m = memberRow(id, userId); if (m) m.char = null; save(); return ok(); },
    start: function (id) { if (!isOwner(id)) return no('Only the Dungeon Master can start this campaign.'); var c = camp(id); c.phase = 'started'; c.startedAt = new Date().toISOString(); (S.history = S.history || []).push({ id: uid(), campaignId: id, kind: 'started', summary: 'The campaign started. Its adventure, party and starting setup are now locked.', details: {}, at: c.startedAt }); save(); return ok(); },
    snapshot: function (doc) { return { schemaVersion: doc.schemaVersion, sourceCharacterId: doc.id, choices: doc.choices, narrative: doc.narrative }; },
  };

  // ---- Campaign data (same rules as the workspace migration) ----------------------------------------------------------
  var handlers = {};
  global.__cwHandlers = handlers;
  var data = {
    listMessages: function (cid, before) {
      if (!isMember(cid)) return ok({ messages: [], hasMore: false });
      var rows = S.messages.filter(function (m) { return m.campaignId === cid && (!before || m.createdAt < before); }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      return ok({ messages: clone(rows.slice(0, 30).reverse()), hasMore: rows.length > 30 });
    },
    sendMessage: function (cid, body) {
      var text = String(body || '').trim();
      if (!text) return no('Write a message first.');
      if (!isMember(cid) || !active(cid)) return no(DENIED);
      var m = { id: uid(), campaignId: cid, authorId: me, body: text, createdAt: new Date().toISOString() };
      S.messages.push(m); save();
      return ok({ message: clone(m) });
    },
    deleteMessage: function (id) {
      var m = S.messages.find(function (x) { return x.id === id; });
      if (!m || !(m.authorId === me || isOwner(m.campaignId))) return no('You can only delete your own messages.');
      S.messages = S.messages.filter(function (x) { return x.id !== id; }); save(); return ok();
    },
    subscribe: function (cid, h) { handlers.current = h; if (h.onStatus) setTimeout(function () { h.onStatus('SUBSCRIBED'); }, 0); return function () { handlers.current = null; }; },
    listMeetings: function (cid) {
      if (!isMember(cid)) return ok({ meetings: [] });
      var rows = S.meetings.filter(function (m) { return m.campaignId === cid; }).sort(function (a, b) { return a.startsAt < b.startsAt ? -1 : 1; });
      return ok({ meetings: clone(rows).map(function (m) { m.rsvps = S.rsvps.filter(function (r) { return r.meetingId === m.id; }).map(function (r) { return { userId: r.userId, response: r.response }; }); return m; }) });
    },
    createMeeting: function (cid, m) {
      var err = real.validateMeeting(m); if (err) return no(err);
      if (!isOwner(cid) || !active(cid)) return no(DENIED);
      var row = { id: uid(), campaignId: cid, createdBy: me, title: m.title.trim(), startsAt: m.startsAt, endsAt: m.endsAt || null, location: m.location || '', description: m.description || '', status: 'scheduled', summary: '', completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      S.meetings.push(row); save(); return ok({ meeting: clone(row) });
    },
    updateMeeting: function (id, m) {
      var err = real.validateMeeting(m); if (err) return no(err);
      var row = S.meetings.find(function (x) { return x.id === id; });
      if (!row || !isOwner(row.campaignId) || !active(row.campaignId)) return no('Only the Dungeon Master can change meetings, and not in an archived campaign.');
      Object.assign(row, { title: m.title.trim(), startsAt: m.startsAt, endsAt: m.endsAt || null, location: m.location || '', description: m.description || '' }); save(); return ok();
    },
    setMeetingStatus: function (id, status, summary) {
      var row = S.meetings.find(function (x) { return x.id === id; });
      if (!row || !isOwner(row.campaignId) || !active(row.campaignId)) return no('Only the Dungeon Master can change meetings, and not in an archived campaign.');
      if (row.status === 'completed' && status !== 'completed') return no('A completed meeting stays in the campaign history.');
      if (status === 'completed' && row.status !== 'completed') row.completedAt = new Date().toISOString();
      row.status = status; if (summary !== undefined) row.summary = summary; save(); return ok();
    },
    deleteMeeting: function (id) {
      var row = S.meetings.find(function (x) { return x.id === id; });
      if (!row || !isOwner(row.campaignId) || row.status === 'completed') return no('Completed meetings stay in the campaign history, and only the Dungeon Master can delete the others.');
      S.meetings = S.meetings.filter(function (x) { return x.id !== id; }); save(); return ok();
    },
    setRsvp: function (mid, response) {
      var row = S.meetings.find(function (x) { return x.id === mid; });
      if (!row || !isMember(row.campaignId) || row.status !== 'scheduled') return no(DENIED);
      var r = S.rsvps.find(function (x) { return x.meetingId === mid && x.userId === me; });
      if (r) r.response = response; else S.rsvps.push({ meetingId: mid, userId: me, response: response });
      save(); return ok();
    },
    getCombat: function (cid, asDm) {
      if (!isMember(cid)) return ok({ encounter: null });
      var e = S.combats[cid];
      if (asDm) { if (!isOwner(cid)) return ok({ encounter: null, version: null }); return ok({ encounter: e ? clone(e.state) : null, version: e ? e.version : null }); }
      return ok({ encounter: e ? clone(e.pub) : null });
    },
    saveCombat: function (cid, enc, expected) {
      if (!isOwner(cid)) return no('Only the Dungeon Master can run combat.');
      if (!active(cid)) return no('Restore the campaign before running combat.');
      var e = S.combats[cid];
      if (e && expected != null && expected !== e.version) return no('This encounter was changed somewhere else (another tab or device). Reload to continue.', { conflict: true });
      var version = e ? e.version + 1 : 1;
      S.combats[cid] = { state: clone(enc), pub: global.FogCombatModel.publicView(enc), version: version };
      save(); return ok({ version: version });
    },
    clearCombat: function (cid) { if (!isOwner(cid)) return no('Only the Dungeon Master can run combat.'); delete S.combats[cid]; save(); return ok(); },
    getProgress: function (cid) {
      if (!isOwner(cid)) return ok({ progress: { currentSection: null, completed: [], updatedAt: null } });
      var p = S.progress[cid]; return ok({ progress: p ? clone(p) : { currentSection: null, completed: [], updatedAt: null } });
    },
    saveProgress: function (cid, p) { if (!isOwner(cid) || !active(cid)) return no(DENIED); S.progress[cid] = { currentSection: p.currentSection || null, completed: (p.completed || []).slice(), updatedAt: new Date().toISOString() }; save(); return ok(); },
    listReveals: function (cid) { return ok({ reveals: isMember(cid) ? clone(S.reveals.filter(function (r) { return r.campaignId === cid; })).reverse() : [] }); },
    addReveal: function (cid, r) {
      if (!isOwner(cid) || !active(cid)) return no(DENIED);
      if (S.reveals.some(function (x) { return x.campaignId === cid && x.sectionId === r.sectionId; })) return no('Already shared with the players.');
      var row = { id: uid(), campaignId: cid, sectionId: r.sectionId, kind: r.kind, title: r.title, chapterTitle: r.chapterTitle || '', body: r.body || '', createdAt: new Date().toISOString() };
      S.reveals.push(row); save(); return ok({ reveal: clone(row) });
    },
    removeReveal: function (id) { var r = S.reveals.find(function (x) { return x.id === id; }); if (!r || !isOwner(r.campaignId)) return no(DENIED); S.reveals = S.reveals.filter(function (x) { return x.id !== id; }); save(); return ok(); },
    regenerateInviteCode: function (cid) { if (!isOwner(cid)) return no('Only the Dungeon Master can change the invite code.'); var code = 'FOD-' + Math.floor(1000 + Math.random() * 9000) + '-ZZ'; camp(cid).inviteCode = code; save(); return ok({ code: code }); },
  };

  // ---- The DM's adventure (only the DM's browser asks for it; the database refuses everyone else) -------------------------
  function adventure() {
    return {
      id: ADV, title: 'The Drowned Keep', description: 'A flooded fortress hides a crown.', coverImage: null, genre: 'Dungeon crawl', theme: 'Gothic', levelMin: 3, levelMax: 5, playtime: '4 sessions', status: 'ready', notes: '', version: 1,
      createdAt: ago(60 * 86400000), updatedAt: ago(5 * 86400000),
      content: { schema: 1, chapters: [
        { id: 'ch1', title: 'The Road to Valdris', summary: '', dmNotes: '', images: [], sections: [
          { id: 's1', kind: 'scene', title: 'The Rusty Flagon', playerText: 'Smoke curls under low beams. A hooded stranger waves you over.', dmNotes: 'The stranger is Lord Vance in disguise. He lies about the crown.', fields: {}, images: [] },
          { id: 's2', kind: 'npc', title: 'Lord Vance', playerText: 'A thin man with ink-stained fingers.', dmNotes: 'Secretly serves the lich.', fields: { role: 'Noble', motivation: 'Recover the crown for his master' }, images: [] },
          { id: 's3', kind: 'encounter', title: 'Ambush at the ford', playerText: '', dmNotes: 'Goblins strike when the party is mid-river.', fields: { creatures: '4 Goblin Warriors', difficulty: 'Low' }, images: [] },
        ] },
        { id: 'ch2', title: 'The Drowned Keep', summary: '', dmNotes: '', images: [], sections: [
          { id: 's4', kind: 'location', title: 'The flooded gate', playerText: 'Black water laps at a rusted portcullis.', dmNotes: 'A trapped sluice, DC 14.', fields: { features: 'Slick stone, echoing' }, images: [] },
        ] },
      ] },
    };
  }
  var adventures = {
    list: function () {
      var a = adventure(); a.chapterCount = 2; a.sectionCount = 4;
      var b = adventure(); b.id = '44444444-4444-4444-8444-444444444444'; b.title = 'The Salt Road'; b.chapterCount = 1; b.sectionCount = 2;
      return me === USERS.dm.id ? ok({ adventures: [a, b] }) : ok({ adventures: [] });
    },
    get: function (id) { return me === USERS.dm.id && id === ADV ? ok({ adventure: global.FogAdventureModel ? global.FogAdventureModel.normalize(adventure()) : adventure(), campaigns: [] }) : no('This adventure doesn’t exist or isn’t yours.', { notFound: true }); },
  };
  var homebrew = { list: function (k) { return global.__mockHomebrewStore ? global.__mockHomebrewStore.list(k) : ok({ entries: [] }); } };

  // ---- Wire up: real scripts loaded later by the router must not replace these ---------------------------------------------
  function lock(name, value) { Object.defineProperty(global, name, { get: function () { return value; }, set: function () {}, configurable: true }); }
  function boot(snaps) {
    var saved = null;
    try { saved = q.get('reset') ? null : JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    S = saved || seed(snaps);
    (global.__mockInit || []).forEach(function (fn) { fn(S); });
    save();
    lock('FogCampaignStore', store);
    lock('FogCampaignData', Object.assign({}, real, data));
    lock('FogAdventureStore', adventures);
    lock('FogHomebrewStore', homebrew);
  }

  global.__mockInternals = {
    get S() { return S; }, me: me, who: who, USERS: USERS, camp: camp, isOwner: isOwner, isMember: isMember, active: active, userOf: userOf, memberRow: memberRow,
    ok: ok, no: no, clone: clone, uid: uid, save: save, ago: ago, ahead: ahead, data: data, store: store, view: view, real: real, ADV: ADV, CAMP_A: CAMP_A, CAMP_B: CAMP_B,
  };

  global.__mock = {
    ids: { A: CAMP_A, B: CAMP_B, ADV: ADV },
    state: function () { return clone(S); },
    reset: function () { localStorage.removeItem(KEY); },
    // what another tab or device saving the encounter looks like (a newer version, here also round 7)
    combatSavedElsewhere: function (cid) { var e = S.combats[cid || CAMP_A]; if (!e) return false; e.version += 1; e.state.round = 7; e.pub.round = 7; save(); return true; },
    pushMessage: function (userKey, text) {
      var m = { id: uid(), campaignId: CAMP_A, authorId: USERS[userKey].id, body: text, createdAt: new Date().toISOString() };
      S.messages.push(m); save();
      if (handlers.current && handlers.current.onMessage) handlers.current.onMessage(clone(m));
    },
    pushCombat: function () { if (handlers.current && handlers.current.onCombat) handlers.current.onCombat(); },
    boot: boot,
  };
})(window);
