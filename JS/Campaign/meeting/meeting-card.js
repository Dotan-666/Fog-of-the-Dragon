/**
 * Meeting in the Fog — the Campaign Feed's card. Small on purpose (no permanent video here): the call itself opens in the
 * shell-level panel and keeps going while you move around the workspace.
 *
 *   FogMeetingCard.mount(host, ctx) → cleanup
 *
 * States: not set up (database or server) · no room (next Fog meeting, Start for the DM, waiting for players) · room open
 * (title, who is connected, Join) · you are in the call · archived campaign. "Connected" comes from the database
 * (people who joined and whose browser checked in recently), never invented.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) {
    try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function time(iso) { try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>';

  function mount(host, ctx) {
    var alive = true;
    var data = null;     // { open, scheduled, participants, notSetUp }
    var media = null;    // { configured }
    var next = null;     // the next Fog meeting
    var busy = false;
    var err = '';

    function nameOf(uid) {
      var m = (ctx.campaign.roster || []).find(function (x) { return x.userId === uid; });
      return m ? m.displayName : 'Former member';
    }

    function draw() {
      if (!alive) return;
      var archived = ctx.campaign.status === 'archived';
      var sess = ctx.meeting ? ctx.meeting.state() : { status: 'idle' };
      var head = '<header class="mf-card-head"><span class="mf-card-icon">' + ICON + '</span><div><h3 id="fd-fog-h">Meeting in the Fog</h3>' +
        '<p class="cw-muted">Voice and video for this campaign. Only its members can join.</p></div></header>';
      if (!data) { host.innerHTML = head + '<p class="cw-loading">Loading…</p>'; return; }
      if (!ctx.meeting) { host.innerHTML = head + '<p class="cw-muted">Meeting in the Fog couldn’t start in this browser. Reload the page to try again.</p>'; return; }
      if (data.notSetUp) {
        host.innerHTML = head + '<p class="cw-muted">' + (ctx.isDm ? 'Meeting in the Fog isn’t set up in the database yet. The site owner needs to run supabase/migrations/20261118120300_meeting_in_the_fog.sql.' : 'Meeting in the Fog isn’t available yet.') + '</p>';
        return;
      }
      var notConfigured = media && !media.configured;
      var cfgNote = notConfigured ? '<p class="mf-card-note">' + (ctx.isDm ? 'Video meetings aren’t set up on the server yet: the site owner needs to add the LiveKit settings to the meeting-fog function. Until then nobody can join.' : 'Video meetings aren’t set up on the server yet.') + '</p>' : '';
      var o = data.open;
      var inThis = o && sess.room && sess.room.id === o.id && (sess.status === 'connected' || sess.status === 'reconnecting' || sess.status === 'joining');
      var body = '';
      if (archived) {
        body = '<p class="cw-muted">This campaign is archived, so its meeting room is closed.</p>';
      } else if (o) {
        var connected = D().connectedNow(data.participants);
        body = '<div class="mf-card-room"><p class="mf-card-title"><span class="mf-live is-on" aria-hidden="true"></span><strong>' + esc(o.title) + '</strong> <span class="cw-muted">· open since ' + esc(time(o.openedAt)) + '</span></p>' +
          '<p class="mf-card-people">' + (connected.length
            ? '<span class="cw-visually-hidden">Connected: </span>' + connected.map(function (p) { return '<span class="mf-chip">' + esc(nameOf(p.userId)) + (p.role === 'dm' ? ' <em>DM</em>' : '') + '</span>'; }).join('')
            : '<span class="cw-muted">Nobody is connected yet.</span>') + '</p></div>' +
          '<div class="mf-card-actions">' + (inThis
            ? '<span class="mf-pill">' + (sess.status === 'joining' ? 'Connecting…' : sess.status === 'reconnecting' ? 'Reconnecting…' : 'You’re in the call') + '</span><button type="button" class="btn btn-secondary btn-sm" data-fog="open">Open the call</button>'
            : '<button type="button" class="btn btn-primary btn-sm" data-fog="join"' + (notConfigured || busy ? ' disabled' : '') + '>Join</button>') +
          (ctx.isDm ? '<button type="button" class="btn btn-outline-crimson btn-sm" data-fog="close"' + (busy ? ' disabled' : '') + '>Close room</button>' : '') + '</div>';
      } else {
        body = (next ? '<p class="mf-card-next">Next meeting in the Fog: <strong>' + esc(next.title) + '</strong> · ' + esc(when(next.startsAt)) + '</p>' : '') +
          (ctx.isDm
            ? '<div class="mf-card-actions"><button type="button" class="btn btn-primary btn-sm" data-fog="start"' + (notConfigured || busy ? ' disabled' : '') + '>' + (next ? 'Open the room for “' + esc(next.title) + '”' : 'Start Meeting in the Fog') + '</button>' +
              (next ? '<button type="button" class="btn btn-secondary btn-sm" data-fog="start-adhoc"' + (notConfigured || busy ? ' disabled' : '') + '>Start a different call</button>' : '') + '</div>' +
              '<p class="cw-muted mf-card-hint">Players get a notification and a Join button here.</p>'
            : '<p class="cw-muted">' + (next ? 'Waiting for the Dungeon Master to open the room at meeting time.' : 'No call is open. The Dungeon Master opens the room when it’s time to play.') + '</p>');
      }
      if (sess.status === 'unavailable' || sess.status === 'error') body += '<p class="mf-card-note is-error">' + esc(sess.error) + '</p>';
      if (err) body += '<p class="mf-card-note is-error" role="alert">' + esc(err) + '</p>';
      host.innerHTML = head + cfgNote + body;
    }

    async function load() {
      var res = await Promise.all([D().getRooms(ctx.id), D().mediaStatus(), D().listMeetings(ctx.id)]);
      if (!alive) return;
      data = res[0].ok ? res[0] : { open: null, scheduled: [], participants: [], loadError: res[0].message };
      if (!res[0].ok) err = res[0].message;
      media = res[1];
      var now = Date.now();
      next = res[2].ok ? res[2].meetings.filter(function (m) { return m.venue === 'fog' && m.status === 'scheduled' && !D().meetingIsPast(m, now); })
        .sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); })[0] || null : null;
      draw();
    }

    async function onClick(e) {
      var b = e.target.closest('[data-fog]');
      if (!b || busy) return;
      var a = b.getAttribute('data-fog');
      err = '';
      if (a === 'open') { ctx.meetingUI.open(); return; }
      if (a === 'join') { ctx.meeting.join(data.open.id); draw(); return; }
      busy = true; draw();
      if (a === 'start' || a === 'start-adhoc') {
        var r = await D().openRoom(ctx.id, a === 'start' && next ? next.id : null, a === 'start' && next ? next.title : null);
        busy = false;
        if (!alive) return;
        if (!r.ok) { err = r.message; draw(); return; }
        await load();
        ctx.meeting.join(r.roomId); // the DM joins the room they opened
      } else if (a === 'close') {
        var ok = await global.FogCampaignUI.confirm({ title: 'Close the room for everyone?', message: 'Everyone in the call is disconnected.', confirmLabel: 'Close room', danger: true });
        if (!ok) { busy = false; draw(); return; }
        var c = await D().closeRoom(data.open.id);
        busy = false;
        if (!alive) return;
        if (!c.ok) { err = c.message; draw(); return; }
        if (ctx.meeting.inCall()) await ctx.meeting.leave();
        await load();
      }
    }

    host.addEventListener('click', onClick);
    var offs = [ctx.on('meeting-room', function () { load(); }), ctx.on('meeting', function () { load(); }), ctx.on('campaign', draw)];
    var lastStatus = ctx.meeting ? ctx.meeting.state().status : 'idle';
    var unsub = ctx.meeting ? ctx.meeting.subscribe(function (s) {
      // joining or leaving changes who is connected: ask the database again
      if (s.status !== lastStatus && (s.status === 'connected' || s.status === 'idle' || s.status === 'disconnected')) { lastStatus = s.status; load(); }
      else { lastStatus = s.status; draw(); }
    }) : function () {};
    var tick = setInterval(draw, 30000); // "connected" ages out when someone's browser stops checking in
    load();
    return function cleanup() { alive = false; clearInterval(tick); unsub(); offs.forEach(function (f) { f(); }); host.removeEventListener('click', onClick); };
  }

  global.FogMeetingCard = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
