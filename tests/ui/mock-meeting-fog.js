/**
 * Test stand-in (harness only) for Meeting in the Fog: room data with the same rules as migration
 * 20261118120300_meeting_in_the_fog.sql, and — only with ?media=test — a fake media provider so the call interface can be
 * exercised without LiveKit. Without ?media=test the server answers "not configured", exactly like a real project with no
 * LiveKit secrets. ?mic=deny / ?cam=none simulate a blocked microphone and a missing camera.
 */
(function (global) {
  'use strict';
  var q = new URLSearchParams(location.search);
  var I = global.__mockInternals;
  var data = I.data;
  var real = I.real;

  (global.__mockInit = global.__mockInit || []).push(function (S) {
    S.rooms = S.rooms || [];
    S.roomParts = S.roomParts || [];
  });

  function S() { return I.S; }
  function now() { return new Date().toISOString(); }
  function room(id) { return S().rooms.find(function (r) { return r.id === id; }); }
  function row(r) { return { id: r.id, campaign_id: r.campaignId, meeting_id: r.meetingId, status: r.status, title: r.title, created_by: r.createdBy, created_at: r.createdAt, opened_at: r.openedAt, closed_at: r.closedAt, provider: 'livekit', audio_state: r.audio || {}, audio_seq: r.seq || 0 }; }
  function push(r) { var h = global.__cwHandlers && global.__cwHandlers.current; if (h && h.onRoom) h.onRoom(r ? real.roomFromRow(row(r)) : null); }
  function roleIn(cid) { return I.isOwner(cid) ? 'dm' : 'player'; }
  function syncMeetingRoom(m) {
    var r = S().rooms.find(function (x) { return x.meetingId === m.id; });
    if (m.venue === 'fog' && m.status === 'scheduled') {
      if (!r) S().rooms.push({ id: I.uid(), campaignId: m.campaignId, meetingId: m.id, status: 'scheduled', title: m.title, createdBy: m.createdBy, createdAt: now(), openedAt: null, closedAt: null });
      else if (r.status !== 'closed') r.title = m.title;
    } else if (r && r.status === 'scheduled') { r.status = 'closed'; r.closedAt = now(); }
  }

  // meetings remember where they happen
  var create = data.createMeeting, update = data.updateMeeting, status = data.setMeetingStatus;
  data.createMeeting = function (cid, m) {
    return Promise.resolve(create(cid, m)).then(function (res) {
      if (res.ok) { var rowm = S().meetings.find(function (x) { return x.id === res.meeting.id; }); rowm.venue = m.venue || null; syncMeetingRoom(rowm); I.save(); res.meeting.venue = rowm.venue; }
      return res;
    });
  };
  data.updateMeeting = function (id, m) {
    return Promise.resolve(update(id, m)).then(function (res) {
      if (res.ok && m.venue !== undefined) { var rowm = S().meetings.find(function (x) { return x.id === id; }); rowm.venue = m.venue || null; syncMeetingRoom(rowm); I.save(); }
      return res;
    });
  };
  data.setMeetingStatus = function (id, st, sum) {
    return Promise.resolve(status(id, st, sum)).then(function (res) {
      if (res.ok) { var rowm = S().meetings.find(function (x) { return x.id === id; }); syncMeetingRoom(rowm); I.save(); }
      return res;
    });
  };
  var list = data.listMeetings;
  data.listMeetings = function (cid) {
    return Promise.resolve(list(cid)).then(function (res) {
      if (res.ok) res.meetings.forEach(function (m) { var rowm = S().meetings.find(function (x) { return x.id === m.id; }); m.venue = rowm && rowm.venue || null; });
      return res;
    });
  };

  data.getRooms = function (cid) {
    if (!I.isMember(cid)) return I.ok({ open: null, scheduled: [], participants: [] });
    var rooms = S().rooms.filter(function (r) { return r.campaignId === cid && r.status !== 'closed'; }).map(function (r) { return real.roomFromRow(row(r)); });
    var open = rooms.filter(function (r) { return r.status === 'open'; })[0] || null;
    var parts = open ? S().roomParts.filter(function (p) { return p.roomId === open.id; }).map(function (p) { return { userId: p.userId, role: p.role, status: p.status, joinedAt: p.joinedAt, leftAt: p.leftAt, lastSeenAt: p.lastSeenAt }; }) : [];
    return I.ok({ open: open, scheduled: rooms.filter(function (r) { return r.status === 'scheduled'; }), participants: parts });
  };
  data.getRoom = function (id) { var r = room(id); return r && I.isMember(r.campaignId) ? I.ok({ room: real.roomFromRow(row(r)) }) : I.no('Room not found.'); };
  data.openRoom = function (cid, mid, title) {
    if (!I.isOwner(cid)) return I.no('Only the Dungeon Master can open Meeting in the Fog.');
    if (!I.active(cid)) return I.no('This campaign is archived.');
    var open = S().rooms.find(function (r) { return r.campaignId === cid && r.status === 'open'; });
    if (open) return I.ok({ roomId: open.id });
    var r = mid ? S().rooms.find(function (x) { return x.meetingId === mid; }) : null;
    if (r) { r.status = 'open'; r.openedAt = now(); r.closedAt = null; }
    else { r = { id: I.uid(), campaignId: cid, meetingId: mid || null, status: 'open', title: title || 'Meeting in the Fog', createdBy: I.me, createdAt: now(), openedAt: now(), closedAt: null }; S().rooms.push(r); }
    I.save();
    return I.ok({ roomId: r.id });
  };
  data.closeRoom = function (id) {
    var r = room(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master can close this room.');
    r.status = 'closed'; r.closedAt = now();
    S().roomParts.forEach(function (p) { if (p.roomId === id && p.status === 'joined') { p.status = 'left'; p.leftAt = now(); } });
    I.save();
    return I.ok();
  };
  data.mediaStatus = function () { return I.ok({ configured: q.get('media') === 'test' }); };
  data.joinRoom = function (id) {
    var r = room(id);
    if (!r || !I.isMember(r.campaignId)) return I.no('Room not found.', { code: 'not_found' });
    if (q.get('media') !== 'test') return { ok: false, code: 'not_configured', message: 'Video meetings aren’t set up on the server yet.' };
    if (!I.active(r.campaignId)) return I.no('This campaign is archived.', { code: 'not_open' });
    if (r.status !== 'open') return I.no('The room isn’t open.', { code: 'not_open' });
    var p = S().roomParts.find(function (x) { return x.roomId === id && x.userId === I.me; });
    if (p) { if (p.status === 'left') p.joins += 1; p.status = 'joined'; p.leftAt = null; p.lastSeenAt = now(); }
    else S().roomParts.push({ roomId: id, userId: I.me, role: roleIn(r.campaignId), status: 'joined', joinedAt: now(), leftAt: null, lastSeenAt: now(), joins: 1 });
    I.save();
    global.__fogTokens = (global.__fogTokens || 0) + 1;
    ensureTestProvider();
    return I.ok({ token: 'test-token-' + global.__fogTokens, url: 'wss://test.invalid', expiresAt: new Date(Date.now() + 900000).toISOString(), room: { id: r.id, campaignId: r.campaignId, title: r.title, role: roleIn(r.campaignId), provider: 'livekit' } });
  };
  data.leaveRoom = function (id) { var p = S().roomParts.find(function (x) { return x.roomId === id && x.userId === I.me; }); if (p && p.status === 'joined') { p.status = 'left'; p.leftAt = now(); I.save(); } global.__fogLeaves = (global.__fogLeaves || 0) + 1; return I.ok(); };
  data.leaveRoomOnUnload = function (id) { data.leaveRoom(id); return true; };
  data.heartbeat = function (id) { var r = room(id); var p = S().roomParts.find(function (x) { return x.roomId === id && x.userId === I.me; }); if (p && r && r.status === 'open') { p.lastSeenAt = now(); I.save(); } return I.ok({ stillOpen: !!(r && r.status === 'open') }); };
  data.rememberSession = function () {};
  data.setRoomAudio = function (id, seq, st) {
    var r = room(id);
    if (!r || !I.isOwner(r.campaignId)) return I.no('Only the Dungeon Master controls the room’s music.');
    if (seq <= (r.seq || 0)) return I.ok({ seq: r.seq });
    r.seq = seq; r.audio = Object.assign({}, st, { seq: seq, serverAt: now() }); I.save();
    (global.__fogAudio = global.__fogAudio || []).push(r.audio);
    return I.ok({ seq: seq });
  };
  data.serverClockOffset = function () { return I.ok({ offset: 0 }); };

  // ---- fake provider (tests only) ----
  var remotes = [];
  var adapterEvents = null;
  function ensureTestProvider() {
    if (!global.FogMedia || global.__fogTestRegistered) return;
    global.__fogTestRegistered = true;
    global.FogMedia.register('test', function () {
      var mic = false, cam = false, connected = false;
      var canvas = null;
      return {
        name: 'test',
        load: function () { return Promise.resolve(true); },
        connect: function (url, token, ev) { adapterEvents = ev; connected = true; global.__fogConnects = (global.__fogConnects || 0) + 1; global.__fogLastToken = token; ev.onState('connected'); return Promise.resolve(true); },
        disconnect: function () { if (!connected) return Promise.resolve(); connected = false; mic = false; cam = false; global.__fogTracksStopped = (global.__fogTracksStopped || 0) + 1; var ev = adapterEvents; adapterEvents = null; if (ev) ev.onState('disconnected', { reason: 'left' }); return Promise.resolve(); },
        publishMicrophone: function (on) { if (on && q.get('mic') === 'deny') { var e = new Error('Permission denied'); e.name = 'NotAllowedError'; return Promise.reject(e); } mic = !!on; global.__fogMicAsked = (global.__fogMicAsked || 0) + (on ? 1 : 0); if (adapterEvents) adapterEvents.onParticipants(); return Promise.resolve(mic); },
        publishCamera: function (on) { if (on && q.get('cam') === 'none') { var e = new Error('Requested device not found'); e.name = 'NotFoundError'; return Promise.reject(e); } cam = !!on; global.__fogCamAsked = (global.__fogCamAsked || 0) + (on ? 1 : 0); if (adapterEvents) adapterEvents.onParticipants(); return Promise.resolve(cam); },
        muteMicrophone: function () { return this.publishMicrophone(false); },
        disableCamera: function () { return this.publishCamera(false); },
        getParticipants: function () {
          if (!connected) return [];
          var meU = I.userOf(I.me);
          return [{ id: I.me, name: meU.name, isLocal: true, role: I.isOwner(I.ids ? I.ids.A : I.CAMP_A) ? 'dm' : 'player', micOn: mic, camOn: cam, hasVideo: cam, speaking: false, quality: 'excellent' }].concat(remotes.map(function (r) { return Object.assign({ isLocal: false, quality: 'good', hasVideo: false }, r); }));
        },
        attachVideo: function (id, el) {
          if (id !== I.me || !cam) return false;
          if (!canvas) { canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100; var c = canvas.getContext('2d'); c.fillStyle = '#5b1424'; c.fillRect(0, 0, 160, 100); }
          if (!el.srcObject && canvas.captureStream) el.srcObject = canvas.captureStream(5);
          return true;
        },
        attachAudio: function () {},
        listDevices: function (kind) { return Promise.resolve(kind === 'videoinput' && q.get('cam') === 'none' ? [] : [{ deviceId: kind + '-1', label: kind === 'videoinput' ? 'Test camera' : 'Test microphone' }, { deviceId: kind + '-2', label: kind === 'videoinput' ? 'Second camera' : 'Headset microphone' }]); },
        switchDevice: function (kind, id) { global.__fogDevice = kind + ':' + id; return Promise.resolve(true); },
        publishData: function () { return Promise.resolve(true); },
        handleConnectionState: function () { return connected ? 'connected' : 'disconnected'; },
      };
    });
  }
  if (q.get('media') === 'test') global.FogMeetingProvider = 'test';

  global.__fogMock = {
    remoteJoin: function (name, opts) { remotes.push(Object.assign({ id: 'remote-' + name, name: name, role: 'player', micOn: true, camOn: false, speaking: false }, opts || {})); if (adapterEvents) adapterEvents.onParticipants(); },
    remoteLeave: function (name) { remotes = remotes.filter(function (r) { return r.name !== name; }); if (adapterEvents) adapterEvents.onParticipants(); },
    speak: function (name, on) { remotes.forEach(function (r) { if (r.name === name) r.speaking = on; }); if (adapterEvents) adapterEvents.onParticipants(); },
    reconnecting: function () { if (adapterEvents) adapterEvents.onState('reconnecting'); },
    reconnected: function () { if (adapterEvents) adapterEvents.onState('connected'); },
    drop: function () { if (adapterEvents) adapterEvents.onState('disconnected', { reason: 'network' }); },
    // another device (the DM's) changes the room: what Realtime delivers
    dmCloses: function (cid) { var r = S().rooms.find(function (x) { return x.campaignId === (cid || I.CAMP_A) && x.status === 'open'; }); if (!r) return false; r.status = 'closed'; r.closedAt = now(); I.save(); push(r); return true; },
    dmOpens: function (cid, title) { var r = { id: I.uid(), campaignId: cid || I.CAMP_A, meetingId: null, status: 'open', title: title || 'Meeting in the Fog', createdBy: I.USERS.dm.id, createdAt: now(), openedAt: now(), closedAt: null }; S().rooms.push(r); I.save(); push(r); return r.id; },
    otherJoined: function (userKey, cid) { var r = S().rooms.find(function (x) { return x.campaignId === (cid || I.CAMP_A) && x.status === 'open'; }); if (!r) return; S().roomParts.push({ roomId: r.id, userId: I.USERS[userKey].id, role: userKey === 'dm' ? 'dm' : 'player', status: 'joined', joinedAt: now(), leftAt: null, lastSeenAt: now(), joins: 1 }); I.save(); push(null); },
    dmMusic: function (st, cid) { var r = S().rooms.find(function (x) { return x.campaignId === (cid || I.CAMP_A) && x.status === 'open'; }); if (!r) return; r.seq = (r.seq || 0) + 1; r.audio = Object.assign({ seq: r.seq, serverAt: now() }, st); I.save(); push(r); },
    rooms: function () { return I.clone(S().rooms); },
    parts: function () { return I.clone(S().roomParts); },
  };
})(window);
