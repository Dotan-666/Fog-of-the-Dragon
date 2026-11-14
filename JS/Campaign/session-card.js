/**
 * Overview → "Next session" card (Dungeon Master only).
 *
 *   FogSessionCard.mount(host, ctx) → cleanup
 *
 * Nothing is created when the page loads: a session starts only when the DM presses "Start session". There is at most one
 * active session per campaign (the database enforces it; Start returns the one already running), so a second press, another
 * tab or a reload continues it instead of duplicating it.
 *
 * It shows: the session number, the next scheduled meeting, where the adventure stands (the campaign's current section,
 * or the active session's saved position), and the way in:
 *   - Start / Continue session → opens the adventure at that place (with "← Back to the Overview")
 *   - Prepare with Foggy+     → Foggy's session preparation (#foggy/prepare): nothing opens without the DM's approval
 *   - Meeting in the Fog      → joins the open room, or goes to the Campaign Feed card where the room is opened
 *   - End session             → closes it and points to the Logbook, where the recap is written
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  function esc(s) { return UI().esc(s); }
  function when(iso) { try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  function sectionTitle(adv, id) {
    if (!adv || !id) return null;
    for (var i = 0; i < adv.content.chapters.length; i++) {
      var ch = adv.content.chapters[i];
      for (var j = 0; j < ch.sections.length; j++) if (ch.sections[j].id === id) return ch.title + ' › ' + ch.sections[j].title;
    }
    return null;
  }
  function encounterName(adv, id) {
    var e = adv && id ? (adv.content.encounters || []).find(function (x) { return x.id === id; }) : null;
    return e ? e.name : null;
  }

  function mount(host, ctx) {
    if (!ctx.isDm) { host.hidden = true; return function () {}; }
    var alive = true, busy = false;
    var st = { loaded: false, sessions: [], notSetUp: false, error: '', next: null, room: null, progress: null, adv: null };

    function active() { return st.sessions.find(function (s) { return s.status === 'active'; }) || null; }
    function last() { return st.sessions.find(function (s) { return s.status === 'ended'; }) || null; }
    function position() {
      var a = active();
      var sec = (a && a.position && a.position.sectionId) || (st.progress && st.progress.currentSection) || null;
      return { sectionId: sec, encounterId: a && a.position ? a.position.encounterId : null };
    }

    function draw() {
      if (!alive) return;
      if (!st.loaded) { host.innerHTML = '<section class="cw-card cw-session-card"><p class="cw-loading" role="status">Checking the next session…</p></section>'; return; }
      if (st.notSetUp) { host.innerHTML = '<section class="cw-card cw-session-card"><h3 class="cw-card-title">Sessions</h3><p class="cw-muted">Session tracking needs the latest database update (migration 20261120120000_session_experience.sql).</p></section>'; return; }
      var a = active(), l = last();
      var pos = position();
      var where = sectionTitle(st.adv, pos.sectionId);
      var encName = encounterName(st.adv, pos.encounterId);
      var archived = ctx.campaign.status === 'archived';
      var head = a
        ? '<span class="cw-eyebrow">In progress</span><h3 class="cw-card-title">' + esc(a.title) + '</h3><p class="cw-muted">Started ' + esc(when(a.startedAt)) + (a.results.length ? ' · ' + a.results.length + ' encounter' + (a.results.length === 1 ? '' : 's') + ' recorded' : '') + '</p>'
        : '<span class="cw-eyebrow">Next session</span><h3 class="cw-card-title">Session ' + ((l ? l.number : 0) + 1) + '</h3><p class="cw-muted">' + (st.next ? 'Scheduled ' + esc(when(st.next.startsAt)) + (st.next.title ? ' · ' + esc(st.next.title) : '') : 'No meeting scheduled.') + (l ? ' Last session: ' + esc(l.title) + ', ' + esc(when(l.endedAt || l.startedAt)) + '.' : '') + '</p>';
      var place = '<p class="cw-session-where">' + (where ? '📍 ' + esc(where) + (encName ? ' · encounter “' + esc(encName) + '”' : '') : ctx.campaign.adventureId ? '📍 The adventure hasn’t been started yet.' : 'No adventure is linked to this campaign yet.') + '</p>';
      var room = st.room;
      var call = room ? (ctx.meeting && ctx.meeting.inCall() ? '<span class="cv-pill is-ok">You’re in the call</span>' : '<button type="button" class="btn btn-secondary btn-sm" data-ss="join">Join Meeting in the Fog</button>')
        : '<button type="button" class="btn btn-secondary btn-sm" data-ss="feed">Meeting in the Fog…</button>';
      host.innerHTML = '<section class="cw-card cw-session-card" aria-label="Session">' + head + place + (st.error ? '<p class="cw-banner is-warn" role="alert">' + esc(st.error) + '</p>' : '') +
        '<div class="cw-actions">' + (archived ? '<span class="cw-muted">This campaign is archived.</span>' :
          (a ? '<button type="button" class="btn btn-primary" data-ss="continue"' + (busy ? ' disabled' : '') + '>Continue the session</button>' : '<button type="button" class="btn btn-primary" data-ss="start"' + (busy ? ' disabled' : '') + '>Start session ' + ((l ? l.number : 0) + 1) + '</button>') +
          '<a class="btn btn-secondary btn-sm" href="#foggy/prepare">Prepare with Foggy+</a>' + call +
          (a ? '<button type="button" class="cv-link-btn" data-ss="end">End session</button>' : '')) + '</div>' +
        '<p class="cw-muted cw-fine">' + (a ? 'Encounter results are added to this session automatically when a fight ends.' : 'Starting a session records it in the Logbook; nothing starts by itself.') + '</p></section>';
    }

    async function load() {
      var calls = [D().listSessions(ctx.id), D().listMeetings(ctx.id), D().getProgress(ctx.id), D().getRooms ? D().getRooms(ctx.id) : Promise.resolve({ ok: false })];
      if (ctx.campaign.adventureId && global.FogAdventureStore) calls.push(global.FogAdventureStore.get(ctx.campaign.adventureId));
      var r = await Promise.all(calls);
      if (!alive) return;
      st.loaded = true;
      st.notSetUp = !!(r[0].ok && r[0].notSetUp);
      st.sessions = r[0].ok ? r[0].sessions : [];
      st.error = r[0].ok ? '' : r[0].message;
      var now = Date.now();
      st.next = r[1].ok ? r[1].meetings.filter(function (m) { return !D().meetingIsPast(m, now); }).sort(function (x, y) { return new Date(x.startsAt) - new Date(y.startsAt); })[0] || null : null;
      st.progress = r[2].ok ? r[2].progress : null;
      st.room = r[3].ok ? r[3].open : null;
      st.adv = r[4] && r[4].ok ? r[4].adventure : null;
      draw();
    }

    function openAdventure() {
      var pos = position();
      ctx.goBack('content', pos.sectionId ? [pos.sectionId] : [], 'the Overview');
    }

    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-ss]');
      if (!b || busy) return;
      var act = b.getAttribute('data-ss');
      if (act === 'continue') { openAdventure(); return; }
      if (act === 'feed') { ctx.goBack('feed', [], 'the Overview'); return; }
      if (act === 'join' && st.room && ctx.meeting) { ctx.meeting.join(st.room.id); if (ctx.meetingUI && ctx.meetingUI.open) ctx.meetingUI.open(); return; }
      if (act === 'start') {
        busy = true; draw();
        var r = await D().startSession(ctx.id, st.next ? st.next.id : null, st.next && st.next.title ? st.next.title : null);
        busy = false;
        if (!alive) return;
        if (!r.ok) { st.error = r.message; draw(); return; }
        await load();
        var s0 = active();
        var existing = s0 && s0.id === r.id && Date.now() - new Date(s0.startedAt).getTime() > 15000; // started elsewhere earlier
        UI().notice(existing ? s0.title + ' was already running: continuing it.' : (s0 ? s0.title : 'The session') + ' started.');
        openAdventure();
        return;
      }
      if (act === 'end') {
        var a = active();
        if (!a) return;
        var ok = await UI().confirm({ title: 'End ' + a.title + '?', message: 'The session is closed in the Logbook. You can write the recap and your notes there afterwards.', confirmLabel: 'End session' });
        if (!ok) return;
        busy = true; draw();
        var en = await D().endSession(a.id);
        busy = false;
        if (!alive) return;
        if (!en.ok) { st.error = en.message; draw(); return; }
        await load();
        UI().notice(a.title + ' ended. Write the recap in the Logbook → Sessions.');
      }
    });

    draw();
    load();
    var offs = [ctx.on('session', load), ctx.on('meeting', load), ctx.on('meeting-room', load)];
    return function () { alive = false; offs.forEach(function (o) { o(); }); };
  }

  global.FogSessionCard = { mount: mount };
})(window);
