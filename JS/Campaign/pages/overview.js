/**
 * Overview: the campaign at a glance. Everything shown is read from the database (campaign, roster, meetings,
 * messages); nothing is invented. A section that can't load says so instead of showing placeholders.
 */
(function (global) {
  'use strict';

  var P = function () { return global.FogCampaignParty; };
  var D = function () { return global.FogCampaignData; };
  var UI = function () { return global.FogCampaignUI; };
  function esc(s) { return P().esc(s); }

  function nextMeeting(meetings, now) {
    return meetings.filter(function (m) { return !D().meetingIsPast(m, now); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); })[0] || null;
  }

  function nameOf(c, userId) {
    var m = c.roster.find(function (x) { return x.userId === userId; });
    return m ? m.displayName : 'A former member';
  }

  /** Real events only: campaign created/started, members joining, finished meetings, recent messages. */
  function buildActivity(c, meetings, messages) {
    var items = [];
    items.push({ at: c.createdAt, icon: '✦', text: 'Campaign created.' });
    if (c.startedAt) items.push({ at: c.startedAt, icon: '⚑', text: 'The campaign started.' });
    c.roster.forEach(function (m) {
      if (m.role !== 'owner' && m.joinedAt) items.push({ at: m.joinedAt, icon: '☺', text: m.displayName + ' joined the campaign.' });
    });
    meetings.forEach(function (m) {
      if (m.status === 'completed') items.push({ at: m.completedAt || m.startsAt, icon: '✔', text: 'Meeting completed: ' + m.title + '.', detail: m.summary ? m.summary.slice(0, 160) + (m.summary.length > 160 ? '…' : '') : '', link: '#meetings/' + m.id });
      else if (m.status === 'cancelled') items.push({ at: m.updatedAt, icon: '✖', text: 'Meeting cancelled: ' + m.title + '.', link: '#meetings/' + m.id });
      else items.push({ at: m.createdAt, icon: '▣', text: 'Meeting scheduled: ' + m.title + '.', link: '#meetings/' + m.id });
    });
    messages.forEach(function (m) {
      items.push({ at: m.createdAt, icon: '✉', text: nameOf(c, m.authorId) + ' wrote: ', detail: m.body.length > 140 ? m.body.slice(0, 140) + '…' : m.body, link: '#feed', quote: true });
    });
    return items.filter(function (i) { return i.at; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 8);
  }

  function heroCard(ctx) {
    var c = ctx.campaign;
    var dm = c.roster.find(function (m) { return m.role === 'owner'; });
    var rows = [
      ['Status', P().statusLabel(c)],
      ['Dungeon Master', (dm ? dm.displayName : '—') + (ctx.isDm ? ' (you)' : '')],
      ['Party', c.roster.length + ' of ' + c.requiredPlayers + ' people' + (c.phase === 'recruiting' ? ' joined' : '')],
      ['Starting level', String(c.startingLevel)],
      ['Created', P().fmtDate(c.createdAt)],
      c.startedAt ? ['Started', P().fmtDate(c.startedAt)] : null,
    ].filter(Boolean);
    return '<section class="cw-card cw-hero">' +
      (c.coverUrl ? '<img class="cw-hero-cover" src="' + esc(c.coverUrl) + '" alt="Cover image of ' + esc(c.name) + '">' : '<div class="cw-hero-cover cw-hero-cover-empty" aria-hidden="true"></div>') +
      '<div class="cw-hero-body"><h2 class="cw-card-title">About this campaign</h2>' +
      (c.description ? '<p class="cw-description">' + esc(c.description) + '</p>' : '<p class="cw-muted">No description yet.' + (ctx.isDm ? ' <a href="#settings">Add one in Campaign Settings</a>.' : '') + '</p>') +
      '<dl class="cw-facts">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></div></section>';
  }

  function setupBanner(ctx) {
    var c = ctx.campaign;
    if (c.status === 'archived') return '<p class="cw-banner">This campaign is archived and read-only. ' + (ctx.isDm ? '<a href="#settings">Restore it in Campaign Settings</a> to continue.' : 'The Dungeon Master can restore it.') + '</p>';
    if (c.phase !== 'recruiting') return '';
    var issues = P().readiness(c);
    if (!issues.length) {
      return '<div class="cw-banner is-ok"><strong>Everyone is here and every character is ready.</strong> ' + (ctx.isDm ? '<a href="#members">Start the campaign from Members</a>.' : 'Waiting for the Dungeon Master to start the campaign.') + '</div>';
    }
    return '<div class="cw-banner"><strong>The party is still gathering.</strong><ul>' + issues.slice(0, 4).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
      '<a class="btn btn-secondary btn-sm" href="#members">Members</a> <a class="btn btn-secondary btn-sm" href="#characters">Characters</a></div>';
  }

  function meetingCard(state, ctx) {
    var body;
    if (state.error) body = '<p class="cw-muted">' + esc(state.error) + '</p>';
    else if (!state.next) {
      body = '<div class="cw-empty"><p>No meeting is scheduled.</p>' + (ctx.isDm ? '<a class="btn btn-primary btn-sm" href="#meetings">Schedule a meeting</a>' : '<p class="cw-muted">The Dungeon Master hasn’t scheduled the next one yet.</p>') + '</div>';
    } else {
      var m = state.next;
      var d = new Date(m.startsAt);
      body = '<div class="cw-next"><div class="cw-next-date"><span class="cw-next-day">' + esc(d.toLocaleDateString(undefined, { weekday: 'long' })) + '</span>' +
        '<span class="cw-next-num">' + d.getDate() + '</span><span class="cw-next-month">' + esc(d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })) + '</span></div>' +
        '<div class="cw-next-info"><h3>' + esc(m.title) + '</h3>' +
        '<p class="cw-next-when">' + esc(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })) + ' · <span data-countdown="' + esc(m.startsAt) + '">' + esc(UI().countdown(m.startsAt)) + '</span></p>' +
        (m.location ? '<p class="cw-next-where">📍 ' + esc(m.location) + '</p>' : '') +
        (m.description ? '<p class="cw-muted">' + esc(m.description.length > 180 ? m.description.slice(0, 180) + '…' : m.description) + '</p>' : '') +
        '<a class="btn btn-primary btn-sm" href="#meetings/' + esc(m.id) + '">Open meeting details</a></div></div>';
    }
    return '<section class="cw-card"><h2 class="cw-card-title">Next meeting</h2>' + body + '</section>';
  }

  function activityCard(state, ctx) {
    var body;
    if (state.error) body = '<p class="cw-muted">' + esc(state.error) + '</p>';
    else {
      body = '<ul class="cw-activity">' + state.items.map(function (i) {
        var inner = '<span class="cw-activity-icon" aria-hidden="true">' + i.icon + '</span><span class="cw-activity-text"><span>' + esc(i.text) + '</span>' +
          (i.detail ? (i.quote ? '<q class="cw-quote">' + esc(i.detail) + '</q>' : '<span class="cw-muted cw-clamp">' + esc(i.detail) + '</span>') : '') + '</span>' +
          '<time class="cw-activity-time" datetime="' + esc(i.at) + '" title="' + esc(P().fmtDateTime(i.at)) + '">' + esc(UI().countdown(i.at).replace('started ', '')) + '</time>';
        return '<li>' + (i.link ? '<a class="cw-activity-row" href="' + esc(i.link) + '">' + inner + '</a>' : '<div class="cw-activity-row">' + inner + '</div>') + '</li>';
      }).join('') + '</ul>';
    }
    return '<section class="cw-card"><h2 class="cw-card-title">Recent activity</h2>' + body + '</section>';
  }

  function partyCard(ctx) {
    var c = ctx.campaign;
    var rows = c.roster.map(function (m) {
      var s = m.role === 'owner' ? null : P().summarize(m.character, c);
      return '<li class="cw-party-row">' + P().avatarHtml(m, 'cw-avatar') + '<div><strong>' + esc(m.displayName) + (m.isMe ? ' (you)' : '') + '</strong>' +
        '<span class="cw-muted">' + (m.role === 'owner' ? 'Dungeon Master' : s ? esc(m.characterName + ' · ' + s.short) : 'No character yet') + '</span></div></li>';
    }).join('');
    return '<section class="cw-card"><h2 class="cw-card-title">Current party</h2><ul class="cw-party">' + rows + '</ul>' +
      '<a class="cw-link" href="#members">Members</a> · <a class="cw-link" href="#characters">Characters</a></section>';
  }

  function quickActions(ctx) {
    var items = [
      ['characters', 'Open Characters'],
      ['meetings', 'Open Meetings'],
      ['combat', 'Open Combat'],
      ctx.isDm ? ['music', 'Open Music'] : null,
      ['content', 'Open Adventures'],
      ['logbook', 'Open Logbook'],
    ].filter(Boolean);
    var routes = global.FogCampaignRoutes;
    return '<section class="cw-card"><h2 class="cw-card-title">Quick actions</h2><div class="cw-quick">' +
      items.map(function (i) { return '<a class="cw-quick-btn" href="#' + i[0] + '"><span class="cw-nav-icon">' + routes[i[0]].icon + '</span>' + esc(i[1]) + '</a>'; }).join('') + '</div></section>';
  }

  async function render(root, ctx) {
    var alive = true;
    root.innerHTML = '<div class="cw-page cw-overview"><h2 class="cw-visually-hidden">Overview</h2><div id="ov-body"></div></div>';
    var body = root.querySelector('#ov-body');
    var state = { meeting: { next: null, error: null }, activity: { items: [], error: null } };
    var timer = null;

    function draw() {
      if (!alive) return;
      body.innerHTML = setupBanner(ctx) + heroCard(ctx) +
        '<div class="cw-grid cw-grid-2">' + meetingCard(state.meeting, ctx) + quickActions(ctx) + '</div>' +
        '<div class="cw-grid cw-grid-2 cw-grid-wide-left">' + activityCard(state.activity, ctx) + partyCard(ctx) + '</div>';
    }

    async function load() {
      var campaignId = ctx.id;
      var results = await Promise.all([D().listMeetings(campaignId), D().listMessages(campaignId)]);
      if (!alive) return;
      var meetings = results[0].ok ? results[0].meetings : [];
      var messages = results[1].ok ? results[1].messages.slice(-5) : [];
      state.meeting = results[0].ok ? { next: nextMeeting(meetings, Date.now()), error: null } : { next: null, error: results[0].message };
      var failed = !results[0].ok && !results[1].ok ? results[0].message : null;
      state.activity = failed ? { items: [], error: failed } : { items: buildActivity(ctx.campaign, meetings, messages), error: null };
      draw();
    }

    draw();
    await load();
    timer = global.setInterval(function () {
      root.querySelectorAll('[data-countdown]').forEach(function (el) { el.textContent = UI().countdown(el.getAttribute('data-countdown')); });
    }, 30000);
    var offs = [ctx.on('meeting', load), ctx.on('message', load), ctx.on('campaign', draw)];
    return function cleanup() {
      alive = false;
      global.clearInterval(timer);
      offs.forEach(function (off) { off(); });
    };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.overview = { render: render, nextMeeting: nextMeeting };
})(window);
