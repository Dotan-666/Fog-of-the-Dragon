/**
 * Meetings: the campaign scheduler and its history (public.campaign_meetings, public.campaign_meeting_rsvps).
 * The DM schedules, edits, completes (with a summary of what happened), cancels and deletes; every member answers
 * Yes / Maybe / No for upcoming meetings. A completed meeting is history: it can't be reopened or deleted.
 */
(function (global) {
  'use strict';

  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  var P = function () { return global.FogCampaignParty; };
  var ANSWERS = [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']];

  function esc(s) { return UI().esc(s); }

  function whenText(m) {
    var s = new Date(m.startsAt);
    var text = s.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (m.endsAt) {
      var e = new Date(m.endsAt);
      text += ' – ' + (e.toDateString() === s.toDateString() ? e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : e.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }
    return text;
  }

  function render(host, ctx, params) {
    var alive = true;
    var campaignId = ctx.id;
    var isDm = ctx.isDm;
    var archived = ctx.campaign.status === 'archived';
    var meetings = [];
    var tab = 'upcoming';
    var selected = params.rest[0] || null;
    var error = null;
    var schedulerCleanup = null;

    host.innerHTML = '<div class="cw-page cw-meetings"><header class="cw-page-head"><div><h2 class="cw-page-title">Meetings</h2>' +
      '<p class="cw-page-sub">Plan the next session, find a time that works for everyone, and keep a record of every one that happened.</p></div>' +
      (isDm && !archived ? '<button type="button" class="btn btn-primary btn-sm" data-mt="new">Schedule a meeting</button>' : '') + '</header>' +
      '<div class="cw-tabs" role="tablist"><button type="button" role="tab" class="cw-tab" data-mt-tab="upcoming" id="mt-tab-upcoming"></button><button type="button" role="tab" class="cw-tab" data-mt-tab="history" id="mt-tab-history"></button><button type="button" role="tab" class="cw-tab" data-mt-tab="scheduling" id="mt-tab-scheduling">Availability polls</button></div>' +
      '<div id="mt-list" role="tabpanel"></div></div>';
    var list = host.querySelector('#mt-list');

    function split() {
      var now = Date.now();
      var upcoming = meetings.filter(function (m) { return !D().meetingIsPast(m, now); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
      var past = meetings.filter(function (m) { return D().meetingIsPast(m, now); }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });
      return { upcoming: upcoming, history: past };
    }

    function rsvpBlock(m) {
      var players = ctx.campaign.roster;
      var answers = {};
      m.rsvps.forEach(function (r) { answers[r.userId] = r.response; });
      var mine = answers[ctx.me.id];
      var label = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
      var open = m.status === 'scheduled' && !D().meetingIsPast(m) && !archived;
      var counts = { yes: 0, maybe: 0, no: 0 };
      m.rsvps.forEach(function (r) { counts[r.response] += 1; });
      return '<div class="cw-rsvp"><h4>Who is coming</h4>' +
        (open ? '<div class="cw-rsvp-me" role="group" aria-label="Your answer">' + ANSWERS.map(function (a) {
          return '<button type="button" class="cw-chip' + (mine === a[0] ? ' is-on' : '') + '" data-mt="rsvp" data-id="' + esc(m.id) + '" data-answer="' + a[0] + '" aria-pressed="' + (mine === a[0]) + '">' + a[1] + '</button>';
        }).join('') + '</div>' : '') +
        '<p class="cw-muted">' + counts.yes + ' yes · ' + counts.maybe + ' maybe · ' + counts.no + ' no · ' + (players.length - m.rsvps.length) + ' waiting</p>' +
        '<ul class="cw-rsvp-list">' + players.map(function (p) {
          var a = answers[p.userId];
          return '<li>' + P().avatarHtml(p, 'cw-avatar cw-avatar-sm') + '<span>' + esc(p.displayName) + (p.isMe ? ' (you)' : '') + '</span><span class="cw-pill cw-pill-' + (a || 'none') + '">' + (a ? label[a] : 'No answer') + '</span></li>';
        }).join('') + '</ul></div>';
    }

    function card(m) {
      var past = D().meetingIsPast(m);
      var dueForSummary = past && m.status === 'scheduled';
      var pill = m.status === 'completed' ? '<span class="cw-pill cw-pill-done">Completed</span>' : m.status === 'cancelled' ? '<span class="cw-pill cw-pill-cancelled">Cancelled</span>' : dueForSummary ? '<span class="cw-pill cw-pill-warn">Time has passed</span>' : '<span class="cw-pill cw-pill-upcoming">Upcoming</span>';
      var actions = [];
      if (isDm && !archived) {
        if (m.status === 'scheduled') {
          actions.push('<button type="button" class="btn btn-secondary btn-sm" data-mt="edit" data-id="' + esc(m.id) + '">Edit</button>');
          actions.push('<button type="button" class="btn btn-primary btn-sm" data-mt="complete" data-id="' + esc(m.id) + '">Mark as completed</button>');
          actions.push('<button type="button" class="cv-link-btn" data-mt="cancel" data-id="' + esc(m.id) + '">Cancel meeting</button>');
        } else if (m.status === 'completed') {
          actions.push('<button type="button" class="btn btn-secondary btn-sm" data-mt="summary" data-id="' + esc(m.id) + '">' + (m.summary ? 'Edit summary' : 'Write summary') + '</button>');
        } else {
          actions.push('<button type="button" class="btn btn-secondary btn-sm" data-mt="reschedule" data-id="' + esc(m.id) + '">Reschedule</button>');
        }
        if (m.status !== 'completed') actions.push('<button type="button" class="cv-link-btn cv-danger" data-mt="delete" data-id="' + esc(m.id) + '">Delete</button>');
      }
      var summary = m.status === 'completed'
        ? '<div class="cw-summary"><h4>What happened</h4>' + (m.summary ? '<p>' + esc(m.summary) + '</p>' : '<p class="cw-muted">' + (isDm ? 'No summary yet. Write down what happened so the party can look back.' : 'The Dungeon Master hasn’t written a summary yet.') + '</p>') + '</div>' : '';
      return '<article class="cw-card cw-meeting' + (m.id === selected ? ' is-selected' : '') + (m.status === 'cancelled' ? ' is-cancelled' : '') + '" id="mt-' + esc(m.id) + '" data-id="' + esc(m.id) + '">' +
        '<header class="cw-meeting-head"><div><h3>' + esc(m.title) + '</h3><p class="cw-meeting-when">' + esc(whenText(m)) + (m.status === 'scheduled' && !past ? ' · <span class="cw-muted" data-countdown="' + esc(m.startsAt) + '">' + esc(UI().countdown(m.startsAt)) + '</span>' : '') + '</p></div>' + pill + '</header>' +
        (m.venue === 'fog' ? '<p class="cw-meeting-where">🎥 <strong>Meeting in the Fog</strong>' + (m.status === 'scheduled' && !past ? ' · the DM opens the room at meeting time; <a href="#feed">join from the Campaign Feed</a>' : '') + '</p>'
          : m.location ? '<p class="cw-meeting-where">📍 ' + esc(m.location) + '</p>' : '') +
        (m.description ? '<p class="cw-description">' + esc(m.description) + '</p>' : '') +
        summary + (m.status === 'cancelled' ? '' : rsvpBlock(m)) +
        (actions.length ? '<div class="cw-actions">' + actions.join('') + '</div>' : '') + '</article>';
    }

    // Reload the meeting lists without redrawing the scheduling tab that is on screen.
    async function refreshMeetings() {
      var res = await D().listMeetings(campaignId);
      if (!alive || !res.ok) return;
      meetings = res.meetings;
      var groups = split();
      host.querySelector('#mt-tab-upcoming').textContent = 'Upcoming (' + groups.upcoming.length + ')';
      host.querySelector('#mt-tab-history').textContent = 'History (' + groups.history.length + ')';
    }

    function mountScheduler() {
      var token = {};
      list.innerHTML = '';
      schedulerCleanup = function () { token.dead = true; };
      Promise.resolve(global.FogCampaignScheduler.render(list, ctx, { selected: selected, onChanged: function () { if (alive) refreshMeetings(); } })).then(function (cleanup) {
        if (token.dead || !alive) { if (typeof cleanup === 'function') cleanup(); return; }
        schedulerCleanup = cleanup;
      });
    }

    function draw() {
      if (!alive) return;
      var groups = split();
      host.querySelector('#mt-tab-upcoming').textContent = 'Upcoming (' + groups.upcoming.length + ')';
      host.querySelector('#mt-tab-history').textContent = 'History (' + groups.history.length + ')';
      ['upcoming', 'history', 'scheduling'].forEach(function (t) {
        var b = host.querySelector('#mt-tab-' + t);
        b.classList.toggle('is-active', t === tab);
        b.setAttribute('aria-selected', String(t === tab));
      });
      if (schedulerCleanup) { schedulerCleanup(); schedulerCleanup = null; }
      if (tab === 'scheduling') { mountScheduler(); return; }
      if (error) { list.innerHTML = '<div class="cw-empty"><p>' + esc(error) + '</p><button type="button" class="btn btn-secondary btn-sm" data-mt="retry">Try again</button></div>'; return; }
      var items = groups[tab];
      if (!items.length) {
        list.innerHTML = tab === 'upcoming'
          ? '<div class="cw-empty cw-empty-lg"><h3>No upcoming meetings</h3><p>' + (isDm ? (archived ? 'This campaign is archived.' : 'Schedule the next session so the party knows when to meet.') : 'The Dungeon Master hasn’t scheduled one yet.') + '</p></div>'
          : '<div class="cw-empty cw-empty-lg"><h3>No meeting history yet</h3><p>Completed and cancelled meetings are kept here.</p></div>';
        return;
      }
      list.innerHTML = '<div class="cw-stack">' + items.map(card).join('') + '</div>';
    }

    var first = true;
    async function load(scroll) {
      var res = await D().listMeetings(campaignId);
      if (!alive) return;
      if (!res.ok) { error = res.message; draw(); return; }
      error = null;
      meetings = res.meetings;
      if (selected) {
        var sel = meetings.find(function (m) { return m.id === selected; });
        if (sel) tab = D().meetingIsPast(sel) ? 'history' : 'upcoming';
        else if (first) tab = 'scheduling'; // a link to an availability request, not to a meeting
      }
      draw();
      first = false;
      if (scroll && selected && tab !== 'scheduling') {
        var el = host.querySelector('#mt-' + (global.CSS && CSS.escape ? CSS.escape(selected) : selected));
        if (el) el.scrollIntoView({ block: 'center' });
      }
    }

    // ---- Dialogs ----------------------------------------------------------------------------------------------
    function form(existing, isReschedule) {
      var m = existing || {};
      var defStart = UI().toLocalInput(m.startsAt || new Date(Date.now() + 7 * 86400000).setMinutes(0, 0, 0));
      var d = UI().dialog('<form class="cw-dialog-body" novalidate>' +
        '<h2 class="cw-dialog-title">' + (existing ? (isReschedule ? 'Reschedule meeting' : 'Edit meeting') : 'Schedule a meeting') + '</h2>' +
        '<label class="cw-field"><span>Title</span><input class="form-control" name="title" maxlength="120" required value="' + esc(m.title || '') + '" placeholder="Session 3: The Sunken Keep"></label>' +
        '<div class="cw-field-row"><label class="cw-field"><span>Starts</span><input class="form-control" type="datetime-local" name="start" required value="' + esc(defStart) + '"></label>' +
        '<label class="cw-field"><span>Ends (optional)</span><input class="form-control" type="datetime-local" name="end" value="' + esc(UI().toLocalInput(m.endsAt)) + '"></label></div>' +
        '<p class="cw-muted">Times use your device’s time zone (' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'local') + '); everyone sees them in their own.</p>' +
        '<div class="cw-field-row"><label class="cw-field"><span>Where</span><select class="form-control" name="venue">' +
          [['in_person', 'In person'], ['fog', 'Meeting in the Fog (video in the campaign)'], ['', 'Not decided']].map(function (o) { return '<option value="' + o[0] + '"' + ((m.venue || (existing ? '' : 'in_person')) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="cw-field" data-mt-loc><span>Location</span><input class="form-control" name="location" maxlength="200" value="' + esc(m.venue === 'fog' ? '' : m.location || '') + '" placeholder="Address"></label></div>' +
        '<p class="cw-muted cw-fine" data-mt-fog hidden>Meeting in the Fog: you open the room from the Campaign Feed at meeting time; everyone gets a Join button. No link needed.</p>' +
        '<label class="cw-field"><span>Description</span><textarea class="form-control" name="description" rows="3" maxlength="2000" placeholder="What to bring, what to prepare, where the story left off…">' + esc(m.description || '') + '</textarea></label>' +
        '<p class="cw-form-error" role="alert" hidden></p>' +
        '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">' + (existing ? 'Save meeting' : 'Schedule meeting') + '</button></div></form>', { label: 'Meeting' });
      var f = d.el.querySelector('form');
      var err = f.querySelector('.cw-form-error');
      var where = function () { var fog = f.venue.value === 'fog'; f.querySelector('[data-mt-loc]').hidden = fog; f.querySelector('[data-mt-fog]').hidden = !fog; };
      where();
      f.venue.addEventListener('change', where);
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var fog = f.venue.value === 'fog';
        var data = {
          title: f.title.value, startsAt: UI().fromLocalInput(f.start.value), endsAt: UI().fromLocalInput(f.end.value),
          location: fog ? 'Meeting in the Fog' : f.location.value, description: f.description.value, venue: f.venue.value || null,
        };
        var btn = f.querySelector('[type=submit]');
        btn.disabled = true;
        var res = existing ? await D().updateMeeting(existing.id, data) : await D().createMeeting(campaignId, data);
        btn.disabled = false;
        if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
        if (isReschedule && existing.status === 'cancelled') {
          var back = await D().setMeetingStatus(existing.id, 'scheduled');
          if (!back.ok) { err.textContent = back.message; err.hidden = false; return; }
        }
        d.close();
        UI().notice(existing ? 'Meeting saved.' : 'Meeting scheduled.');
        if (res.meeting) selected = res.meeting.id;
        load(!!res.meeting);
      });
      f.title.focus();
    }

    function summaryDialog(m, completing) {
      var d = UI().dialog('<form class="cw-dialog-body" novalidate><h2 class="cw-dialog-title">' + (completing ? 'Complete “' + esc(m.title) + '”' : 'Summary of “' + esc(m.title) + '”') + '</h2>' +
        '<p class="cw-muted">' + (completing ? 'The meeting moves to History and can’t be reopened or deleted. ' : '') + 'The summary is visible to everyone in the campaign.</p>' +
        '<label class="cw-field"><span>What happened</span><textarea class="form-control" name="summary" rows="8" maxlength="8000" placeholder="Where the party ended, what they discovered, open questions…">' + esc(m.summary || '') + '</textarea></label>' +
        '<p class="cw-form-error" role="alert" hidden></p>' +
        '<div class="cw-dialog-actions"><button type="button" class="btn btn-secondary btn-sm" data-dialog-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">' + (completing ? 'Mark as completed' : 'Save summary') + '</button></div></form>', { label: 'Meeting summary' });
      var f = d.el.querySelector('form');
      var err = f.querySelector('.cw-form-error');
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var res = await D().setMeetingStatus(m.id, 'completed', f.summary.value);
        if (!res.ok) { err.textContent = res.message; err.hidden = false; return; }
        d.close();
        UI().notice(completing ? 'Meeting completed and added to the history.' : 'Summary saved.');
        load();
      });
      f.summary.focus();
    }

    host.addEventListener('click', async function (e) {
      var tabBtn = e.target.closest('[data-mt-tab]');
      if (tabBtn) { tab = tabBtn.getAttribute('data-mt-tab'); draw(); return; }
      var b = e.target.closest('[data-mt]');
      if (!b) return;
      var a = b.getAttribute('data-mt');
      var m = meetings.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (a === 'new') form(null);
      else if (a === 'retry') load();
      else if (a === 'edit' && m) form(m);
      else if (a === 'reschedule' && m) form(m, true);
      else if (a === 'complete' && m) summaryDialog(m, true);
      else if (a === 'summary' && m) summaryDialog(m, false);
      else if (a === 'rsvp' && m) {
        var res = await D().setRsvp(m.id, b.getAttribute('data-answer'));
        if (!res.ok) UI().notice(res.message, 'error'); else load();
      } else if (a === 'cancel' && m) {
        var ok = await UI().confirm({ title: 'Cancel “' + m.title + '”?', message: 'The meeting stays in the history as cancelled. You can reschedule it later.', confirmLabel: 'Cancel meeting', danger: true });
        if (!ok || !alive) return;
        var r1 = await D().setMeetingStatus(m.id, 'cancelled');
        if (!r1.ok) UI().notice(r1.message, 'error'); else { UI().notice('Meeting cancelled.'); load(); }
      } else if (a === 'delete' && m) {
        var ok2 = await UI().confirm({ title: 'Delete “' + m.title + '”?', message: 'This removes the meeting and the answers to it for good. (Completed meetings can’t be deleted.)', confirmLabel: 'Delete meeting', danger: true });
        if (!ok2 || !alive) return;
        var r2 = await D().deleteMeeting(m.id);
        if (!r2.ok) UI().notice(r2.message, 'error'); else { UI().notice('Meeting deleted.'); load(); }
      }
    });

    var timer = global.setInterval(function () {
      host.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = UI().countdown(el.getAttribute('data-countdown')); });
    }, 30000);
    var offs = [ctx.on('meeting', function () { load(); }), ctx.on('campaign', draw)];

    return load(true).then(function () {
      return function cleanup() {
        alive = false;
        global.clearInterval(timer);
        if (schedulerCleanup) schedulerCleanup();
        offs.forEach(function (off) { off(); });
      };
    });
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.meetings = { render: render, whenText: whenText };
})(window);
