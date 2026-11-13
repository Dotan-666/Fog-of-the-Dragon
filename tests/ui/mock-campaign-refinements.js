/**
 * Test-only stand-ins for the second workspace migration (scheduling, homebrew sharing, memories, plans and purchases,
 * history, level-ups and DM corrections). Loaded after mock-campaign-workspace.js by tests/ui/campaign-harness.html.
 * It follows the same rules as supabase/migrations/20261113120000_campaign_refinements.sql (those rules are tested for real
 * in tests/db/rls.test.mjs); this file exists so the real interface code can be driven in a browser without a server.
 *
 * ?dmplan=warlord|dungeon-master|fogger-of-the-dragons  sets the campaign DM's plan (default dungeon-master)
 * Test hooks: __mock.markBookPaid() (what a payment webhook would do), __mock.setDmPlan(id).
 */
(function (global) {
  'use strict';

  var q = new URLSearchParams(location.search);
  var I = global.__mockInternals;
  var DENIED = 'You don’t have permission to do that in this campaign.';
  var PLAN_OK = ['dungeon-master', 'fogger-of-the-dragons'];
  var DAY = 86400000;
  var pixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  global.__mockInit = (global.__mockInit || []).concat(function (S) {
    ['schedules', 'campaignHomebrew', 'memories', 'history', 'notifs'].forEach(function (k) { S[k] = S[k] || []; });
    S.plans = S.plans || {};
    if (!S.plansSet) { S.plans[I.USERS.dm.id] = q.get('dmplan') || 'dungeon-master'; S.plansSet = true; }
    if (q.get('dmplan')) S.plans[I.USERS.dm.id] = q.get('dmplan');
    // the seeded campaign was started a while ago: its history says so (a real start writes this row in the database)
    if (!S.history.some(function (h) { return h.kind === 'started'; })) S.history.push({ id: I.uid(), campaignId: I.CAMP_A, kind: 'started', summary: 'The campaign started. Its adventure, party and starting setup are now locked.', details: {}, at: I.camp(I.CAMP_A).startedAt });
    S.bookPaid = S.bookPaid || null;
    S.personal = S.personal || [];
    // the DM's own homebrew library (what Homebrew would hold)
    if (!S.personal.length) {
      var M = global.FogHomebrewModel;
      var mon = M ? M.newEntry('monster', 'Ash Wraith') : null;
      var spl = M ? M.newEntry('spell', 'Ember Ward') : null;
      if (mon) { mon.id = 'hb-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'; mon.owner = I.USERS.dm.id; S.personal.push(mon); }
      if (spl) { spl.id = 'hb-bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'; spl.owner = I.USERS.dm.id; S.personal.push(spl); }
      var pm = M ? M.newEntry('monster', 'Riley Pet Rat') : null;
      if (pm) { pm.id = 'hb-cccccccc-3333-4333-8333-cccccccccccc'; pm.owner = I.USERS.p1.id; S.personal.push(pm); }
    }
    // deliver this user's pending notifications to the bell once (what FogCampaignNotifications.sync does)
    S.notifs.filter(function (n) { return n.user === I.me && !n.delivered; }).forEach(function (n) {
      global.FogNotifications.add({ id: 'srv_' + n.id, kind: 'campaign', title: n.title, message: n.body, link: n.link, createdAt: n.at });
      n.delivered = true;
    });
  });

  var S = function () { return I.S; };
  // The signed-in person's own plan follows the same map (?dmplan for the DM; everyone else Free unless set).
  var PLAN_NAMES = { warlord: 'Warlord', 'dungeon-master': 'Dungeon Master', 'fogger-of-the-dragons': 'Fogger of the Dragons' };
  global.FogAccount.getPlan = function () { var id = (I.S && I.S.plans && I.S.plans[I.me]) || 'warlord'; return { id: id, name: PLAN_NAMES[id] || id, activeCampaigns: 1, maxPeople: 5 }; };
  function ownerPlan(cid) { var c = I.camp(cid); return (S().plans[c.ownerId]) || 'warlord'; }
  function hasMemories(cid) { return PLAN_OK.indexOf(ownerPlan(cid)) >= 0; }
  function bookUnlocked(cid) { return !!S().bookPaid || ownerPlan(cid) === 'fogger-of-the-dragons'; }
  function activeMembers(cid) { return S().members.filter(function (m) { return m.c === cid; }).map(function (m) { return m.u; }); }
  function notify(cid, title, body, hash, skip, only) {
    (only ? [only] : activeMembers(cid)).forEach(function (u) { if (u !== skip) S().notifs.push({ id: I.uid(), user: u, title: title, body: body, link: 'campaign.html?c=' + cid + '#' + hash, at: new Date().toISOString(), delivered: false }); });
  }
  function history(cid, kind, summary, details) { S().history.push({ id: I.uid(), campaignId: cid, kind: kind, summary: summary, details: details || {}, at: new Date().toISOString() }); }
  function nameOf(uid) { return I.userOf(uid).name; }

  // ---------------------------------------------------------------------------- scheduling (mirrors the SQL functions)
  function sch(id) { return S().schedules.find(function (r) { return r.id === id; }); }
  function resps(r) { return r.responses.filter(function (x) { return x.round === r.round; }); }
  function unanimous(r, slot) {
    return r.required.every(function (u) { var x = resps(r).find(function (y) { return y.userId === u; }); return x && ['available', 'preferred'].indexOf(x.availability[slot]) >= 0; });
  }
  function expired(r) { return r.due && new Date(r.due) < new Date(); }
  function openSchedule(r) { r.status = 'waiting'; r.required = activeMembers(r.campaignId); notify(r.campaignId, 'Availability needed: ' + r.title, 'Tell the party when you can play.', 'meetings', I.me); }
  // Automatic proposal (mirrors private.schedule_best_slot / schedule_try_auto_propose).
  function bestSlot(r) {
    var declined = r.declinedSlots || [];
    var cands = r.slots.filter(function (sl) { return declined.indexOf(sl.id) < 0 && unanimous(r, sl.id); });
    cands.sort(function (a, b) {
      var pa = resps(r).filter(function (x) { return x.availability[a.id] === 'preferred'; }).length;
      var pb = resps(r).filter(function (x) { return x.availability[b.id] === 'preferred'; }).length;
      return pb - pa || (a.start < b.start ? -1 : 1);
    });
    return cands[0] ? cands[0].id : null;
  }
  // Suggestions (mirrors private.schedule_suggestions): ranked by who can come, then length fit, prefer, possibly, earliest.
  function suggestions(r) {
    var hostsAll = r.hosts.filter(function (h) { return h.round === r.round && h.share && resps(r).some(function (x) { return x.userId === h.userId && x.canHost; }); }).map(function (h) { return h.userId; });
    var list = r.slots.filter(function (sl) { return (r.declinedSlots || []).indexOf(sl.id) < 0 && new Date(sl.start) > new Date(); }).map(function (sl) {
      var yes = 0, pref = 0, maybe = 0, missing = [], wantIn = 0, wantOn = 0;
      r.required.forEach(function (u) {
        var x = resps(r).find(function (y) { return y.userId === u; });
        var a = x ? x.availability[sl.id] : null;
        if (a === 'available' || a === 'preferred') yes++; else missing.push(u);
        if (a === 'preferred') pref++;
        if (a === 'maybe') maybe++;
        if (x && x.suggestFormat === 'in_person') wantIn++;
        if (x && (x.suggestFormat === 'online' || x.suggestFormat === 'google_meet')) wantOn++;
      });
      var hosts = hostsAll.filter(function (h) { var x = resps(r).find(function (y) { return y.userId === h; }); return x && ['available', 'preferred'].indexOf(x.availability[sl.id]) >= 0; });
      var fits = !r.durationMinutes || (new Date(sl.end) - new Date(sl.start)) >= r.durationMinutes * 60000;
      return { slotId: sl.id, start: sl.start, end: sl.end, yes: yes, total: r.required.length, preferred: pref, maybe: maybe, everyone: yes === r.required.length, missing: missing, hosts: hosts, fits: fits,
        format: r.format !== 'either' ? r.format : hosts.length && wantIn >= wantOn ? 'in_person' : 'online' };
    });
    list.sort(function (a, b) { return (b.yes - a.yes) || (b.preferred - a.preferred) || (b.maybe - a.maybe) || (a.start < b.start ? -1 : 1); });
    list = list.slice(0, 5);
    list.sort(function (a, b) { return (Number(b.fits) - Number(a.fits)) || (b.yes - a.yes) || (b.preferred - a.preferred) || (b.maybe - a.maybe) || (a.start < b.start ? -1 : 1); });
    return list;
  }
  function finishCollection(r, reason) {
    r.status = 'consensus'; r.suggestions = suggestions(r); r.answersClosed = r.answersClosed || reason === 'deadline';
    if (!r.dmNotified) {
      var best = r.suggestions[0];
      var body = !best ? 'No offered time is still possible. Start another round with new times.' : best.everyone ? 'Best time: everyone can come.' : 'Closest option: ' + best.yes + ' of ' + best.total + ' can come. No time works for everyone.';
      notify(r.campaignId, (reason === 'deadline' ? 'Answers closed: ' : 'Everyone answered: ') + r.title, body, 'meetings/' + r.id, null, r.createdBy);
      r.dmNotified = true;
    }
    tryAutoPropose(r);
  }
  function tryAutoPropose(r) {
    if (!r.autoPropose || r.status !== 'consensus') return false;
    var slot = bestSlot(r);
    if (!slot) return false;
    var hosts = r.hosts.filter(function (h) { return h.round === r.round && h.share && resps(r).some(function (x) { return x.userId === h.userId && x.canHost; }); });
    var fmt = null, host = null;
    if (r.format !== 'online' && hosts.length === 1) { fmt = 'in_person'; host = hosts[0].userId; }
    else if (r.format !== 'in_person') fmt = 'online'; // Meeting in the Fog needs no link
    if (!fmt) return false;
    var version = (r.proposal ? r.proposal.version : 0) + 1;
    r.confirmations = r.confirmations.filter(function (x) { return x.round !== r.round; });
    r.proposal = { version: version, slot_id: slot, format: fmt, host_id: host, link: fmt === 'online' ? r.defaultLink || null : null, link_kind: fmt === 'online' ? (r.defaultLink ? 'manual' : 'fog') : null, auto: true };
    r.status = 'awaiting_confirmation';
    notify(r.campaignId, 'Everyone agrees: please confirm ' + r.title, 'The best time for everyone was proposed automatically. Check it and confirm.', 'meetings/' + r.id);
    return true;
  }

  var data = I.data;
  data.listSchedules = function (cid) {
    if (!I.isMember(cid)) return I.ok({ schedules: [] });
    S().schedules.forEach(function (r) {
      if (['waiting', 'consensus'].indexOf(r.status) >= 0 && !r.answersClosed && expired(r)) {
        if (resps(r).some(function (x) { return r.required.indexOf(x.userId) >= 0; })) finishCollection(r, 'deadline');
        else { r.status = 'expired'; notify(r.campaignId, 'No answers: ' + r.title, 'Nobody answered before the deadline.', 'meetings/' + r.id, null, r.createdBy); }
      } else if (r.status === 'awaiting_confirmation' && r.proposal && new Date(r.slots.find(function (x) { return x.id === r.proposal.slot_id; }).start) <= new Date()) r.status = 'expired';
      else if (r.campaignId === cid && r.status === 'waiting' && r.due && !r.remindedAt && new Date(r.due) - new Date() < 86400000) {
        r.remindedAt = new Date().toISOString();
        r.required.filter(function (u) { return !resps(r).some(function (x) { return x.userId === u; }); }).forEach(function (u) {
          notify(r.campaignId, 'Reminder: ' + r.title, 'Answers are due soon. Tell the party when you can play.', 'meetings/' + r.id, null, u);
        });
      }
    });
    I.save();
    var out = S().schedules.filter(function (r) { return r.campaignId === cid && (r.status !== 'draft' || I.isOwner(cid)); }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).map(function (r) {
      var c = I.clone(r);
      c.responses = I.clone(resps(r));
      c.confirmations = r.confirmations.filter(function (x) { return x.round === r.round; }).map(function (x) { return { userId: x.userId, version: x.version }; });
      c.hosts = r.hosts.filter(function (h) {
        if (h.round !== r.round) return false;
        var proposed = (r.status === 'awaiting_confirmation' || r.status === 'confirmed') && r.proposal && r.proposal.host_id === h.userId;
        return h.userId === I.me || (h.share && proposed);
      }).map(function (h) { return { userId: h.userId, location: h.location, share: h.share }; });
      delete c.hostsAll;
      return c;
    });
    return I.ok({ schedules: out });
  };
  data.createSchedule = function (cid, o, publish) {
    if (!I.isOwner(cid) || !I.active(cid)) return I.no('Only the Dungeon Master can ask for availability.');
    if (!o.slots || !o.slots.length) return I.no('Offer between 1 and 60 possible time slots.');
    if (o.due && new Date(o.due) <= new Date()) return I.no('The deadline must be in the future.');
    var r = { id: I.uid(), campaignId: cid, createdBy: I.me, title: o.title.trim(), notes: o.notes || '', format: o.format, durationMinutes: o.durationMinutes || null, slots: I.clone(o.slots), due: o.due || null, status: 'draft', round: 1, required: [], proposal: null, meetingId: null, createdAt: new Date().toISOString(), responses: [], hosts: [], confirmations: [], autoPropose: false, defaultLink: null, declinedSlots: [], remindedAt: null, suggestions: null, answersClosed: false, excludedUsers: [] };
    S().schedules.push(r);
    if (publish) openSchedule(r);
    I.save();
    return I.ok({ id: r.id });
  };
  data.setScheduleAutomation = function (id, auto, link) {
    var r = sch(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can change the automatic proposal.');
    if (['draft', 'waiting', 'consensus'].indexOf(r.status) < 0) return I.no('The automatic proposal can only be changed before a time is proposed.');
    link = (link || '').trim();
    if (link && !/^https:\/\/\S{4,180}$/.test(link)) return I.no('The meeting link must start with https://.');
    r.autoPropose = !!auto; r.defaultLink = link || null;
    tryAutoPropose(r);
    I.save();
    return I.ok();
  };
  data.publishSchedule = function (id) { var r = sch(id); if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can do that.'); if (r.status !== 'draft') return I.no('This request was already sent.'); openSchedule(r); I.save(); return I.ok(); };
  data.submitAvailability = function (id, o) {
    var r = sch(id);
    if (!r || r.required.indexOf(I.me) < 0) return I.no('This request isn’t waiting for your answer.');
    if (['waiting', 'consensus'].indexOf(r.status) < 0 || r.answersClosed) return I.no('This request is no longer collecting answers.');
    if (expired(r)) return I.no('The deadline for answers has passed.');
    var ids = r.slots.map(function (s) { return s.id; });
    for (var k in o.availability) if (ids.indexOf(k) < 0 || ['available', 'preferred', 'maybe', 'unavailable'].indexOf(o.availability[k]) < 0) return I.no('That answer doesn’t match this request.');
    r.responses = r.responses.filter(function (x) { return !(x.round === r.round && x.userId === I.me); });
    r.responses.push({ round: r.round, userId: I.me, availability: o.availability, canHost: !!o.canHost, hostNote: o.hostNote || '', suggestFormat: o.suggestFormat || null, suggestion: o.suggestion || '', updatedAt: new Date().toISOString() });
    r.hosts = r.hosts.filter(function (h) { return !(h.round === r.round && h.userId === I.me); });
    if (o.canHost && (o.hostLocation || '').trim()) r.hosts.push({ round: r.round, userId: I.me, location: o.hostLocation.trim(), share: !!o.shareLocation });
    var all = r.required.every(function (u) { return resps(r).some(function (x) { return x.userId === u; }); });
    var next = all ? 'consensus' : 'waiting';
    if (all) { finishCollection(r, 'all_answered'); r.suggestions = suggestions(r); next = r.status; }
    else r.status = next;
    I.save();
    return I.ok({ data: next });
  };
  data.proposeSchedule = function (id, o) {
    var r = sch(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can propose the final time.');
    if (['consensus', 'awaiting_confirmation'].indexOf(r.status) < 0) return I.no('Wait until everyone has answered.');
    if (!r.slots.some(function (s) { return s.id === o.slotId; })) return I.no('That time slot isn’t part of this request.');
    if (!unanimous(r, o.slotId)) return I.no('Not everyone is available at that time. Choose a time that works for all ' + r.required.length + ' people, or start another round.');
    if (['in_person', 'online'].indexOf(o.format) < 0 || (r.format !== 'either' && r.format !== o.format)) return I.no('Choose a format that matches this request.');
    var link = (o.link || '').trim();
    if (o.format === 'in_person') {
      var rs = resps(r).find(function (x) { return x.userId === o.hostId; });
      var h = r.hosts.find(function (x) { return x.round === r.round && x.userId === o.hostId; });
      if (!o.hostId || !rs || !rs.canHost || !h || !h.share) return I.no('An in-person meeting needs a host who can host and agreed to share the location with the party.');
      link = '';
    } else if (link && !/^https:\/\/\S{4,180}$/.test(link)) {
      return I.no('A meeting link must start with https:// (or leave it empty to meet in the Fog).');
    }
    var version = (r.proposal ? r.proposal.version : 0) + 1;
    r.confirmations = r.confirmations.filter(function (x) { return x.round !== r.round; });
    r.proposal = { version: version, slot_id: o.slotId, format: o.format, host_id: o.format === 'in_person' ? o.hostId : null, link: link || null, link_kind: o.format === 'online' ? (link ? 'manual' : 'fog') : null };
    r.status = 'awaiting_confirmation';
    notify(r.campaignId, 'Please confirm: ' + r.title, 'The DM proposed a final time. Check it and confirm.', 'meetings/' + r.id, I.me);
    I.save();
    return I.ok({ data: version });
  };
  data.proposeScheduleOption = function (id, o) {
    var r = sch(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can propose the final time.');
    var without = o.without || [];
    if (without.indexOf(r.createdBy) >= 0) return I.no('The Dungeon Master can’t be left out of the meeting.');
    // proposing a time counts as the DM's own yes for it
    var mine = resps(r).find(function (x) { return x.userId === r.createdBy; });
    if (!mine) { mine = { round: r.round, userId: r.createdBy, availability: {}, canHost: false, hostNote: '', suggestFormat: null, suggestion: '', updatedAt: new Date().toISOString() }; r.responses.push(mine); }
    if (mine.availability[o.slotId] !== 'preferred') mine.availability[o.slotId] = 'available';
    if (without.length) {
      if (r.required.length - without.length < 2) return I.no('At least two people must be left to meet.');
      r.required = r.required.filter(function (u) { return without.indexOf(u) < 0; });
      r.excludedUsers = (r.excludedUsers || []).concat(without);
      without.forEach(function (u) { notify(r.campaignId, 'Not this time: ' + r.title, 'The DM picked a time you said you can’t make.', 'meetings/' + r.id, null, u); });
    }
    return data.proposeSchedule(id, o);
  };
  data.confirmSchedule = function (id, version, slot) {
    var r = sch(id);
    if (!r || r.required.indexOf(I.me) < 0) return I.no('This request isn’t waiting for your confirmation.');
    if (r.status !== 'awaiting_confirmation' || !r.proposal) return I.no('There is nothing to confirm right now.');
    if (r.proposal.version !== version || r.proposal.slot_id !== slot) return I.no('The proposal changed. Look at the new proposal before confirming.');
    if (!unanimous(r, slot)) return I.no('Availability changed, so this time no longer works for everyone.');
    r.confirmations = r.confirmations.filter(function (x) { return !(x.round === r.round && x.userId === I.me); });
    r.confirmations.push({ round: r.round, userId: I.me, version: version });
    var done = r.required.filter(function (u) { return r.confirmations.some(function (x) { return x.round === r.round && x.userId === u && x.version === version; }); }).length;
    if (done < r.required.length) { I.save(); return I.ok({ data: null }); }
    var sl = r.slots.find(function (s) { return s.id === slot; });
    var starts = sl.start;
    var ends = r.durationMinutes ? new Date(new Date(starts).getTime() + r.durationMinutes * 60000).toISOString() : sl.end;
    var loc = r.proposal.format === 'in_person' ? r.hosts.find(function (h) { return h.round === r.round && h.userId === r.proposal.host_id; }).location : r.proposal.link;
    var m = { id: I.uid(), campaignId: r.campaignId, createdBy: r.createdBy, title: r.title, startsAt: starts, endsAt: ends, location: loc, description: (r.proposal.format === 'in_person' ? 'In person.' : 'Online. Meeting link ' + (r.proposal.link_kind === 'generated' ? 'generated automatically' : 'entered by hand by the DM (not generated)') + '.') + ' Agreed by everyone through the availability poll.', status: 'scheduled', summary: '', completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    S().meetings.push(m);
    r.required.forEach(function (u) { S().rsvps.push({ meetingId: m.id, userId: u, response: 'yes' }); });
    r.status = 'confirmed'; r.meetingId = m.id;
    notify(r.campaignId, 'Meeting confirmed: ' + r.title, 'Everyone agreed. It is now in Meetings.', 'meetings/' + m.id);
    I.save();
    return I.ok({ data: m.id });
  };
  data.declineSchedule = function (id) {
    var r = sch(id);
    if (!r || r.required.indexOf(I.me) < 0 || r.status !== 'awaiting_confirmation') return I.no('There is nothing for you to decline.');
    r.declinedSlots = (r.declinedSlots || []).concat(r.proposal ? [r.proposal.slot_id] : []);
    r.confirmations = r.confirmations.filter(function (x) { return x.round !== r.round; }); r.proposal = null; r.status = 'consensus';
    notify(r.campaignId, 'A time was declined: ' + r.title, 'Someone can’t make the proposed time.', 'meetings/' + r.id, null, r.createdBy);
    tryAutoPropose(r);
    I.save();
    return I.ok();
  };
  data.cancelSchedule = function (id) {
    var r = sch(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can do that.');
    if (['confirmed', 'cancelled'].indexOf(r.status) >= 0) return I.no('This request can’t be cancelled (a confirmed one is a meeting now: cancel the meeting instead).');
    r.status = 'cancelled'; I.save(); return I.ok();
  };
  data.reopenSchedule = function (id) {
    var r = sch(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can do that.');
    if (['confirmed', 'draft', 'waiting'].indexOf(r.status) >= 0) return I.no('This request can’t be reopened.');
    r.round += 1; r.proposal = null; r.due = null; r.declinedSlots = []; r.remindedAt = null; r.suggestions = null; r.answersClosed = false; r.dmNotified = false; r.excludedUsers = []; openSchedule(r); I.save(); return I.ok();
  };

  // ---------------------------------------------------------------------------- campaign homebrew
  data.listCampaignHomebrew = function (cid) {
    if (!I.isMember(cid)) return I.ok({ entries: [] });
    return I.ok({ entries: I.clone(S().campaignHomebrew.filter(function (e) { return e.campaignId === cid; })) });
  };
  data.shareHomebrew = function (cid, entry) {
    var src = S().personal.find(function (e) { return e.id === entry.id; });
    if (!I.isOwner(cid) || !I.active(cid) || !src || src.owner !== I.me) return I.no(DENIED);
    S().campaignHomebrew = S().campaignHomebrew.filter(function (e) { return !(e.campaignId === cid && e.sourceId === entry.id); });
    S().campaignHomebrew.push({ id: I.uid(), campaignId: cid, sourceId: entry.id, kind: src.kind, name: src.name, data: I.clone(src.data), sharedBy: I.me, createdAt: new Date().toISOString() });
    I.save();
    return I.ok();
  };
  data.unshareHomebrew = function (id) {
    var e = S().campaignHomebrew.find(function (x) { return x.id === id; });
    if (!e || !I.isOwner(e.campaignId)) return I.no(DENIED);
    S().campaignHomebrew = S().campaignHomebrew.filter(function (x) { return x.id !== id; }); I.save(); return I.ok();
  };
  global.__mockHomebrewStore = {
    list: function (kinds) {
      var rows = S().personal.filter(function (e) { return e.owner === I.me && (!kinds || kinds.indexOf(e.kind) >= 0); });
      return I.ok({ entries: I.clone(rows) });
    },
  };

  // ---------------------------------------------------------------------------- memories, plans, book, history
  data.featureAccess = function (cid) {
    if (!I.isMember(cid)) return I.no('Campaign not found.');
    var plan = ownerPlan(cid);
    return I.ok({ access: { ownerPlan: plan, memories: hasMemories(cid), bookUnlocked: bookUnlocked(cid), bookIncludedByPlan: plan === 'fogger-of-the-dragons', bookPurchased: !!S().bookPaid, bookPurchasedBy: S().bookPaid ? nameOf(S().bookPaid.by) : null } });
  };
  data.listMemories = function (cid) {
    if (!I.isMember(cid)) return I.ok({ memories: [] });
    var rows = S().memories.filter(function (m) { return m.campaignId === cid && (I.isOwner(cid) || (m.visibility === 'players' && m.status === 'published')); });
    return I.ok({ memories: I.clone(rows).sort(function (a, b) { return String(b.occurredOn || '') < String(a.occurredOn || '') ? -1 : 1; }) });
  };
  data.saveMemory = function (cid, m) {
    if (!String(m.title || '').trim()) return I.no('Give the memory a title.');
    if (!I.isOwner(cid) || !I.active(cid) || !hasMemories(cid)) return I.no('Only the Dungeon Master can change memories, and only while the campaign is active and the plan includes the Logbook.');
    var now = new Date().toISOString();
    var row = S().memories.find(function (x) { return x.id === m.id; });
    if (!row) { row = { id: I.uid(), campaignId: cid, createdAt: now }; S().memories.push(row); }
    Object.assign(row, { kind: m.kind, title: m.title.trim(), content: m.content || '', occurredOn: m.occurredOn || null, meetingId: m.meetingId || null, subject: m.subject || '', imagePath: m.imagePath || null, recap: m.recap || null, visibility: m.visibility, status: m.status, updatedAt: now, publishedAt: m.status === 'published' ? (row.publishedAt || now) : null });
    I.save();
    return I.ok({ memory: I.clone(row) });
  };
  data.deleteMemory = function (id) {
    var m = S().memories.find(function (x) { return x.id === id; });
    if (!m || !I.isOwner(m.campaignId)) return I.no('Only the Dungeon Master can delete memories.');
    S().memories = S().memories.filter(function (x) { return x.id !== id; }); I.save(); return I.ok();
  };
  data.uploadMemoryImage = function (cid, vis) { return I.ok({ path: cid + '/' + (vis === 'players' ? 'players' : 'dm') + '/' + I.uid().replace(/[^A-Za-z0-9]/g, '') + '.jpg' }); };
  data.removeMemoryImage = function () { return I.ok(); };
  data.memoryImageUrls = function (paths) { var o = {}; (paths || []).filter(Boolean).forEach(function (p) { o[p] = pixel; }); return Promise.resolve(o); };
  data.getBook = function (cid) {
    if (!I.isMember(cid)) return I.no('Campaign not found.');
    if (!bookUnlocked(cid)) return I.no('The campaign book isn’t unlocked for this campaign.');
    var c = I.camp(cid);
    return I.ok({ book: I.clone({
      campaign: { name: c.name, description: c.description, cover_url: null, started_at: c.startedAt, created_at: c.createdAt }, dm: nameOf(c.ownerId),
      party: S().members.filter(function (m) { return m.c === cid && m.role === 'player'; }).map(function (m) { return { player: nameOf(m.u), character: m.char ? S().snaps[m.char].narrative.name : null }; }),
      meetings: S().meetings.filter(function (m) { return m.campaignId === cid && m.status === 'completed'; }).map(function (m) { return { id: m.id, title: m.title, starts_at: m.startsAt, summary: m.summary }; }),
      memories: S().memories.filter(function (m) { return m.campaignId === cid && m.status === 'published' && m.visibility === 'players'; }).map(function (m) { return { id: m.id, kind: m.kind, title: m.title, content: m.content, occurred_on: m.occurredOn, meeting_id: m.meetingId, subject: m.subject, image_path: m.imagePath, recap: m.recap }; }),
      history: S().history.filter(function (h) { return h.campaignId === cid && ['started', 'level_up'].indexOf(h.kind) >= 0; }).map(function (h) { return { kind: h.kind, summary: h.summary, at: h.at }; }),
    }) });
  };
  data.listHistory = function (cid) {
    if (!I.isMember(cid)) return I.ok({ history: [] });
    return I.ok({ history: I.clone(S().history.filter(function (h) { return h.campaignId === cid; })).reverse().map(function (h) { return { id: h.id, kind: h.kind, summary: h.summary, details: h.details, at: h.at }; }) });
  };

  // ---------------------------------------------------------------------------- level-ups and corrections after the start
  var store = I.store;
  store.levelUp = function (id, doc) {
    var c = I.camp(id);
    var m = I.memberRow(id, I.me);
    if (!c || c.status !== 'active' || c.phase !== 'started') return I.no('Level-ups are recorded once the campaign has started.');
    if (!m || m.role !== 'player' || !m.char) return I.no('You don’t have a character in this campaign.');
    var old = S().snaps[m.char];
    var snap = store.snapshot(doc);
    var from = Number(old.choices.level);
    var to = Number(snap.choices.level);
    if (to !== from + 1 || to > 20) return I.no('A character can only gain one level at a time (from level ' + from + ' to ' + (from + 1) + ').');
    if (snap.sourceCharacterId !== old.sourceCharacterId || snap.choices.classId !== old.choices.classId || snap.choices.speciesId !== old.choices.speciesId || snap.choices.backgroundId !== old.choices.backgroundId) return I.no('A level-up must be the same character (same class, species and background), not a replacement.');
    S().snaps[m.char] = JSON.parse(JSON.stringify(snap));
    history(id, 'level_up', old.narrative.name + ' reached level ' + to + '.', { from: from, to: to });
    I.save();
    return I.ok({ level: to });
  };
  store.overrideLock = function (id, action, payload, reason) {
    var c = I.camp(id);
    if (!c || c.ownerId !== I.me) return I.no('Only the Dungeon Master can override a locked setting.');
    if (c.phase !== 'started') return I.no('Nothing is locked yet: change it normally.');
    if (String(reason || '').trim().length < 10) return I.no('Write a reason (at least 10 characters). It is saved in the campaign history.');
    if (action === 'set_adventure') c.adventureId = payload.adventure_id;
    else if (action === 'set_starting_level') c.startingLevel = payload.level;
    else if (action === 'replace_character') {
      var m = I.memberRow(id, payload.user_id);
      if (!m || m.role !== 'player') return I.no('That player isn’t in this campaign.');
      var key = 'repl-' + I.uid(); S().snaps[key] = I.clone(payload.character); S().snaps[key].narrative.name = payload.name; m.char = key;
    } else if (action === 'remove_member') {
      S().members = S().members.filter(function (x) { return !(x.c === id && x.u === payload.user_id && x.role !== 'owner'); });
    } else return I.no('Unknown override.');
    history(id, 'override', 'The DM corrected a locked setting (' + action + '). Reason: ' + reason.trim(), { action: action, reason: reason.trim() });
    I.save();
    return I.ok();
  };

  // Payments: ?pay=on pretends the site has payments switched on. buy() only records what was asked; it never unlocks anything
  // (in the real system only the payment provider's signed webhook does: __mock.markBookPaid() plays that part).
  var payments = {
    enabled: function () { return q.get('pay') === 'on'; },
    checkout: function (p, c) { global.__bought = { p: p, c: c || null }; return Promise.resolve({ ok: true, url: 'https://shop.lemonsqueezy.com/checkout/test' }); },
    buy: function (p, c) { global.__bought = { p: p, c: c || null }; return Promise.resolve({ ok: true, url: 'https://shop.lemonsqueezy.com/checkout/test' }); },
    // ?demopay=on: the owner switched demo payments on (Marketplace checkout with test cards)
    demo: function () { return Promise.resolve({ demoPayments: q.get('demopay') === 'on', testOwner: false }); },
    buyWithDemoCheckout: function (item, base) { global.__demoCheckout = { item: item, base: base }; return { ok: true }; },
  };
  Object.defineProperty(global, 'FogPayments', { get: function () { return payments; }, set: function () {}, configurable: true });

  global.__mock.setDmPlan = function (plan) { S().plans[I.USERS.dm.id] = plan; I.save(); };
  global.__mock.markBookPaid = function () { S().bookPaid = { by: I.USERS.p2.id, at: new Date().toISOString() }; I.save(); };
  global.__mock.homebrewStore = global.__mockHomebrewStore;
})(window);
