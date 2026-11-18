/**
 * Members: who is in the campaign, the invite code, and starting the campaign.
 *
 * People join with the campaign's invite code (join_campaign in the database); there is no e-mail invitation. The DM
 * can replace the code while the party is gathering, remove players before the campaign starts (afterwards the party is
 * locked by the database) and start the campaign. The only roles are Dungeon Master and Player.
 */
(function (global) {
  'use strict';

  var P = function () { return global.FogCampaignParty; };
  var UI = function () { return global.FogCampaignUI; };
  var D = function () { return global.FogCampaignData; };
  var S = function () { return global.FogCampaignStore; };

  function esc(s) { return UI().esc(s); }

  function card(title, desc, body, cls) {
    return '<section class="form-card cw-legacy-card' + (cls ? ' ' + cls : '') + '"><div class="card-header"><div><h2 class="card-title">' + title + '</h2>' +
      (desc ? '<p class="card-desc">' + desc + '</p>' : '') + '</div></div><div class="card-body">' + body + '</div></section>';
  }

  function render(host, ctx) {
    var alive = true;
    host.innerHTML = '<div class="cw-page cw-members"><header class="cw-page-head"><div><h2 class="cw-page-title">Members</h2>' +
      '<p class="cw-page-sub">Everyone in this campaign and what they can do.</p></div></header>' +
      '<div class="create-campaign-wrapper campaign-view-page cw-legacy"><p class="create-campaign-message" id="mb-message" role="status" hidden></p><div id="mb-body"></div></div></div>';
    var body = host.querySelector('#mb-body');
    var message = host.querySelector('#mb-message');
    var busy = false;

    function say(text) { message.textContent = text; message.hidden = !text; }

    function startCard(c) {
      if (c.status !== 'active') return '';
      if (c.phase === 'started') return '<p class="cv-banner is-ok">The campaign started ' + esc(P().fmtDateTime(c.startedAt)) + '. The party is set and locked.</p>';
      var issues = P().readiness(c);
      if (ctx.isDm) {
        return issues.length
          ? '<div class="cv-banner"><strong>Before you can start:</strong><ul>' + issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div><button type="button" class="btn btn-primary" data-mb="start" disabled>Start Campaign</button>'
          : '<p class="cv-banner is-ok">Everyone is here and every character is ready.</p><button type="button" class="btn btn-primary" data-mb="start">Start Campaign</button>';
      }
      return '<div class="cv-banner">' + (issues.length ? '<strong>Waiting before the DM can start:</strong><ul>' + issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : 'Everyone is ready. Waiting for the Dungeon Master to start the campaign.') + '</div>';
    }

    function memberRow(c, m) {
      var recruiting = c.phase === 'recruiting' && c.status === 'active';
      var who = '<div class="cv-member-who">' + P().avatarHtml(m) + '<div><strong>' + esc(m.displayName) + (m.isMe ? ' (you)' : '') + '</strong><span class="cv-member-role">' + (m.role === 'owner' ? 'Dungeon Master' : 'Player') + '</span></div></div>';
      var info = m.role === 'owner'
        ? '<span class="cv-note">Runs the campaign · created it ' + esc(P().fmtDate(c.createdAt)) + '</span>'
        : '<span class="cv-note">Joined ' + esc(P().fmtDate(m.joinedAt)) + (m.characterName ? ' · plays <strong>' + esc(m.characterName) + '</strong>' : ' · no character yet') + '</span>';
      var actions = [];
      if (ctx.isDm && recruiting && m.role !== 'owner') actions.push('<button type="button" class="cv-link-btn cv-danger" data-mb="remove" data-user="' + esc(m.userId) + '">Remove player</button>');
      if (ctx.isDm && c.phase === 'started' && c.status === 'active' && m.role !== 'owner') actions.push('<button type="button" class="cv-link-btn cv-danger" data-mb="correct-remove" data-user="' + esc(m.userId) + '">Correct: remove this player…</button>');
      return '<li class="cv-member">' + who + '<div class="cv-member-char">' + info + (actions.length ? '<div class="cv-member-actions">' + actions.join('') + '</div>' : '') + '</div></li>';
    }

    function invitedRows(c) {
      return (c.invited || []).map(function (m) {
        return '<li class="cv-member"><div class="cv-member-who">' + P().avatarHtml(m) + '<div><strong>' + esc(m.displayName) + '</strong><span class="cv-member-role">Invited</span></div></div>' +
          '<div class="cv-member-char"><span class="cv-pill is-warn">Invitation pending</span>' +
          (ctx.isDm ? '<div class="cv-member-actions"><button type="button" class="cv-link-btn cv-danger" data-mb="remove" data-user="' + esc(m.userId) + '">Withdraw invitation</button></div>' : '') + '</div></li>';
      }).join('');
    }

    function inviteCard(c) {
      if (c.status !== 'active') return '';
      if (c.phase !== 'recruiting') return card('Invite code', 'The party is locked, so nobody else can join this campaign.', '<p class="cv-note">The code stops working once a campaign has started.</p>');
      if (!ctx.isDm) return card('Invite players', 'Only the Dungeon Master can invite people.', '<p class="cv-note">Ask the Dungeon Master for the invite code to bring someone in.</p>');
      return card('Invite players', 'Share this code. Players enter it under Dashboard → Campaigns → Join Campaign while seats are open.',
        '<p class="cv-invite"><span class="cv-code" id="mb-code">' + esc(c.inviteCode) + '</span><button type="button" class="btn btn-secondary btn-sm" data-mb="copy">Copy code</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-mb="regenerate">Replace code</button></p>' +
        '<p class="cv-note">Replacing the code stops the old one from working (for example if it was shared by mistake). People who already joined stay.</p>');
    }

    function draw() {
      if (!alive) return;
      var c = ctx.campaign;
      var empty = Math.max(0, c.requiredPlayers - c.roster.length);
      var seats = Array.from({ length: empty }, function () {
        return '<li class="cv-member is-empty"><div class="cv-member-who"><span class="cv-avatar cv-avatar-letter" aria-hidden="true">?</span><div><strong>Open seat</strong><span class="cv-member-role">Waiting for a player</span></div></div></li>';
      }).join('');
      body.innerHTML =
        card('Party', c.roster.length + ' of ' + c.requiredPlayers + ' people have joined (including the DM).',
          startCard(c) + '<ul class="cv-members">' + c.roster.map(function (m) { return memberRow(c, m); }).join('') + invitedRows(c) + (c.phase === 'recruiting' ? seats : '') + '</ul>' +
          '<p class="cv-note">Roles: <strong>Dungeon Master</strong> (runs and manages the campaign) and <strong>Player</strong>. Roles can\'t be changed; the person who created the campaign is its Dungeon Master.</p>', 'cv-party') +
        inviteCard(c);
    }

    async function run(fn, okText) {
      if (busy) return;
      busy = true;
      say('Working…');
      try {
        var res = await fn();
        if (!alive) return;
        if (res && !res.ok) { say(res.message); return; }
        say(okText || '');
        await ctx.reload();
        draw();
      } finally { busy = false; }
    }

    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-mb]');
      if (!b) return;
      var c = ctx.campaign;
      var a = b.getAttribute('data-mb');
      if (a === 'copy') {
        var done = function () { say('Invite code ' + c.inviteCode + ' copied.'); };
        if (navigator.clipboard) navigator.clipboard.writeText(c.inviteCode).then(done, function () { say('Invite code: ' + c.inviteCode); });
        else say('Invite code: ' + c.inviteCode);
      } else if (a === 'regenerate') {
        var ok = await UI().confirm({ title: 'Replace the invite code?', message: 'The current code stops working immediately. People who already joined stay in the campaign.', confirmLabel: 'Replace code' });
        if (ok) run(function () { return D().regenerateInviteCode(ctx.id); }, 'The invite code was replaced.');
      } else if (a === 'remove') {
        var m = c.roster.concat(c.invited || []).find(function (x) { return x.userId === b.getAttribute('data-user'); });
        if (!m) return;
        var ok2 = await UI().confirm({ title: 'Remove ' + m.displayName + '?', message: 'They leave "' + c.name + '" and their character is removed from it. (The character stays in their own Characters list.) They can rejoin with the invite code while there is room.', confirmLabel: 'Remove', danger: true });
        if (ok2) run(function () { return S().removeMember(ctx.id, m.userId); }, m.displayName + ' was removed.');
      } else if (a === 'correct-remove') {
        var who = c.roster.find(function (x) { return x.userId === b.getAttribute('data-user'); });
        if (!who) return;
        var ans = await UI().reasonDialog({ title: 'Remove ' + who.displayName + ' from the started campaign', message: 'The party is locked, so this is a correction (for example a player who left the group). Their character leaves the campaign too.', confirmLabel: 'Remove player' });
        if (ans) run(function () { return S().overrideLock(ctx.id, 'remove_member', { user_id: who.userId }, ans.reason); }, who.displayName + ' was removed and the correction is in the campaign history.');
      } else if (a === 'start') {
        var ok3 = await UI().confirm({ title: 'Start "' + c.name + '"?', message: 'After this nobody can join, leave or change characters.', confirmLabel: 'Start campaign' });
        if (ok3) run(function () { return S().start(ctx.id); }, 'The campaign has started!');
      }
    });

    draw();
    var off = ctx.on('campaign', draw);
    return function cleanup() { alive = false; off(); };
  }

  global.FogCampaignPages = global.FogCampaignPages || {};
  global.FogCampaignPages.members = { render: render };
})(window);
