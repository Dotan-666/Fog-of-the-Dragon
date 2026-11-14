/**
 * Test stand-in (harness only): player attack requests with the same rules as public.submit_combat_request /
 * decide_combat_request (migration 20261119120000_foggy_assistant.sql), and a stand-in for Foggy's server
 * (window.FogFoggyBackend) whose combat advice follows the real rules: only the actions and targets it was sent.
 * ?playerplan=<plan> gives the players a plan (for player-side Foggy help).
 */
(function (global) {
  'use strict';
  var q = new URLSearchParams(location.search);
  var I = global.__mockInternals;
  var data = I.data;
  (global.__mockInit = global.__mockInit || []).push(function (S) { S.combatRequests = S.combatRequests || []; if (q.get('playerplan')) { S.plans[I.USERS.p1.id] = q.get('playerplan'); S.plans[I.USERS.p2.id] = q.get('playerplan'); } });
  function S() { return I.S; }
  function push(r) { var h = global.__cwHandlers && global.__cwHandlers.current; if (h && h.onCombatRequest) h.onCombatRequest(r || null); }

  data.submitCombatRequest = function (cid, req) {
    if (!I.isMember(cid) || I.isOwner(cid)) return I.no('Only players of this campaign send attack requests (the Dungeon Master applies attacks directly).');
    var e = S().combats[cid];
    var pub = e && e.pub;
    if (!pub || pub.status !== 'active') return I.no('No combat is running.');
    if (pub.paused) return I.no('Combat is paused.');
    if (!pub.combatants.some(function (c) { return c.id === req.attackerId && c.userId === I.me; })) return I.no('You can only attack with your own character.');
    if (pub.turnId !== req.attackerId) return I.no('Wait for your turn.');
    if (!req.targetIds.length || !req.targetIds.every(function (t) { return pub.combatants.some(function (c) { return c.id === t && !c.defeated; }); })) return I.no('Choose a target that is in the fight.');
    if (!req.action || !req.action.name) return I.no('Choose an attack.');
    var dup = S().combatRequests.find(function (r) { return r.campaignId === cid && r.clientKey === req.clientKey; });
    if (dup) return I.ok({ id: dup.id });
    if (S().combatRequests.filter(function (r) { return r.campaignId === cid && r.requester === I.me && r.status === 'pending'; }).length >= 3) return I.no('Wait for the Dungeon Master to answer your earlier requests.');
    var row = { id: I.uid(), campaignId: cid, requester: I.me, clientKey: req.clientKey, attackerId: req.attackerId, targetIds: req.targetIds.slice(), action: I.clone(req.action), status: 'pending', note: '', createdAt: new Date().toISOString() };
    S().combatRequests.push(row); I.save(); push(row);
    return I.ok({ id: row.id });
  };
  data.listCombatRequests = function (cid, statuses) {
    var list = S().combatRequests.filter(function (r) { return r.campaignId === cid && (I.isOwner(cid) || r.requester === I.me) && (!statuses || statuses.indexOf(r.status) >= 0); });
    return I.ok({ requests: I.clone(list) });
  };
  data.decideCombatRequest = function (id, decision, note) {
    var r = S().combatRequests.find(function (x) { return x.id === id; });
    if (!r) return I.no('Request not found.');
    if (decision === 'cancelled' ? r.requester !== I.me : !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master decides.');
    if (r.status !== 'pending') return I.ok({ status: r.status });
    r.status = decision; r.note = note || ''; I.save(); push(r);
    return I.ok({ status: decision });
  };

  // Foggy's server, for the harness: answers follow the real validation (known actions and targets only).
  global.__foggyCalls = [];
  global.FogFoggyBackend = function (fn, body) {
    global.__foggyCalls.push({ fn: fn, body: JSON.parse(JSON.stringify(body)) });
    if (fn === 'foggy-assistant' && body.action === 'combat') {
      var st = body.payload.state;
      var attack = (st.actor.actions || []).find(function (a) { return /Attack Roll|to hit/.test(a.text); }) || st.actor.actions[0];
      var target = (st.others || []).find(function (o) { return st.actor.kind === 'pc' ? o.kind !== 'pc' : o.kind === 'pc'; }) || st.others[0];
      if (q.get('foggy') === 'invent') return Promise.resolve({ ok: true, result: { reply: 'Use Tail Swipe on everyone.', action: '', targetIds: [], reason: '', invented: true } });
      return Promise.resolve({ ok: true, result: { reply: st.actor.name + ' should use ' + attack.name + ' on ' + target.name + '.', action: attack.name, targetIds: [target.id], reason: 'It is the closest threat.', invented: false } });
    }
    if (fn === 'foggy-listen') {
      var say = global.__say || { cueId: '', confidence: 0, transcript: '' };
      (global.__heard = global.__heard || []).push(body.cues.length);
      return Promise.resolve({ ok: true, transcript: say.transcript, cueId: say.cueId, confidence: say.confidence });
    }
    return Promise.resolve({ ok: false, code: 'unavailable', message: 'Not in this test.' });
  };
  // ?foggyaccess=plus: the server says Foggy is on and the DM has Foggie+ (Campaign Foggy, listening)
  if (q.get('foggyaccess') === 'plus') global.FogFoggyBackend.access = function () { return Promise.resolve({ ok: true, source: 'server', access: { plan: 'fogger-of-the-dragons', tier: 'foggie_plus', enabled: true, dashboard: true, campaign: true, canGenerate: true } }); };

  global.__fogCombatMock = {
    requests: function () { return I.clone(S().combatRequests); },
  };
})(window);
